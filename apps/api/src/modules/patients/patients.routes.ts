import type { FastifyInstance } from 'fastify'
import { UpdatePatientSchema } from '@repo/schemas'

const Unauth  = { 401: { $ref: 'UnauthorizedError#' } }
const Success = { 200: { $ref: 'SuccessMessage#' } }

const PatientShape = {
  type: 'object',
  properties: {
    id:               { type: 'string', format: 'uuid' },
    fullName:         { type: 'string' },
    email:            { type: 'string', format: 'email' },
    phone:            { type: 'string', nullable: true },
    nic:              { type: 'string', nullable: true },
    address:          { type: 'string', nullable: true },
    dateOfBirth:      { type: 'string', format: 'date', nullable: true },
    gender:           { type: 'string', nullable: true },
    bloodType:        { type: 'string', nullable: true },
    allergies:        { type: 'array', items: { type: 'string' } },
    healthConditions: { type: 'array', items: { type: 'string' } },
    emergencyContact: { type: 'object', nullable: true, additionalProperties: true },
    penaltyLevel:     { type: 'integer' },
  },
}

export async function patientRoutes(app: FastifyInstance) {

  // ── Own profile ─────────────────────────────────────────────────────────────
  app.get('/me', {
    preHandler: app.requireRole(['patient']),
    schema: {
      tags: ['Patients'],
      summary: 'Get own patient profile',
      response: { 200: PatientShape, ...Unauth },
    },
  }, async (request) => {
    const { rows: [patient] } = await app.db.query(
      `SELECT p.id, p.date_of_birth AS "dateOfBirth", p.gender, p.blood_type AS "bloodType",
              p.allergies, p.health_conditions AS "healthConditions",
              p.nic, p.address,
              p.emergency_contact AS "emergencyContact", p.insurance_info AS "insuranceInfo",
              u.full_name AS "fullName", u.email, u.phone,
              pp.penalty_level AS "penaltyLevel"
       FROM patients p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN penalty_profiles pp ON pp.patient_id = p.id
       WHERE p.user_id = $1`,
      [request.jwtUser.sub]
    )
    return patient
  })

  // ── Update own profile ──────────────────────────────────────────────────────
  app.put('/me', {
    preHandler: app.requireRole(['patient']),
    schema: {
      tags: ['Patients'],
      summary: 'Update own patient profile',
      body: {
        type: 'object',
        properties: {
          fullName:         { type: 'string', example: 'John Doe' },
          phone:            { type: 'string', example: '+94771234567' },
          nic:              { type: 'string', example: '200012345678' },
          address:          { type: 'string', example: '123 Main St, Colombo' },
          dateOfBirth:      { type: 'string', format: 'date', example: '1990-05-20' },
          gender:           { type: 'string', enum: ['male','female','other'] },
          bloodType:        { type: 'string', example: 'O+' },
          allergies:        { type: 'array', items: { type: 'string' }, example: ['Penicillin'] },
          healthConditions: { type: 'array', items: { type: 'string' }, example: ['Diabetes'] },
          emergencyContact: { type: 'object', description: 'JSONB — name, phone, relationship' },
          insuranceInfo:    { type: 'object', description: 'JSONB — provider, policy number' },
        },
      },
      response: { ...Success, ...Unauth },
    },
  }, async (request) => {
    const input = UpdatePatientSchema.parse(request.body)

    // ── Update user-level fields (fullName, phone) on the users table ──
    const userSets: string[] = []
    const userParams: unknown[] = [request.jwtUser.sub]
    if (input.fullName) { userParams.push(input.fullName); userSets.push(`full_name = $${userParams.length}`) }
    if (input.phone)    { userParams.push(input.phone);    userSets.push(`phone = $${userParams.length}`) }
    if (userSets.length > 0) {
      userSets.push(`updated_at = NOW()`)
      await app.db.query(`UPDATE users SET ${userSets.join(', ')} WHERE id = $1`, userParams)
    }

    // ── Update patient-level fields on the patients table ──
    const sets: string[] = []
    const params: unknown[] = [request.jwtUser.sub]
    if (input.dateOfBirth)       { params.push(input.dateOfBirth);                         sets.push(`date_of_birth = $${params.length}`) }
    if (input.gender)            { params.push(input.gender);                              sets.push(`gender = $${params.length}`) }
    if (input.bloodType)         { params.push(input.bloodType);                           sets.push(`blood_type = $${params.length}`) }
    if (input.allergies)         { params.push(input.allergies);                           sets.push(`allergies = $${params.length}`) }
    if (input.healthConditions)  { params.push(input.healthConditions);                    sets.push(`health_conditions = $${params.length}`) }
    if (input.nic)               { params.push(input.nic);                                sets.push(`nic = $${params.length}`) }
    if (input.address)           { params.push(input.address);                            sets.push(`address = $${params.length}`) }
    if (input.emergencyContact)  { params.push(JSON.stringify(input.emergencyContact));    sets.push(`emergency_contact = $${params.length}`) }
    if (input.insuranceInfo)     { params.push(JSON.stringify(input.insuranceInfo));       sets.push(`insurance_info = $${params.length}`) }
    if (sets.length > 0) {
      await app.db.query(`UPDATE patients SET ${sets.join(', ')} WHERE user_id = $1`, params)
    }
    return { success: true }
  })

  // ── Doctor/staff views a patient ────────────────────────────────────────────
  app.get('/:id', {
    preHandler: app.requireRole(['doctor', 'receptionist', ]),
    schema: {
      tags: ['Patients'],
      summary: 'Get patient profile by ID — Doctor / Receptionist / Admin',
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
      response: {
        200: PatientShape,
        404: { $ref: 'Error#' },
        ...Unauth,
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { rows: [patient] } = await app.db.query(
      `SELECT p.id, p.date_of_birth AS "dateOfBirth", p.gender, p.blood_type AS "bloodType",
              p.allergies, p.emergency_contact AS "emergencyContact",
              u.full_name AS "fullName", u.email, u.phone,
              pp.penalty_level AS "penaltyLevel", pp.no_show_count AS "noShowCount"
       FROM patients p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN penalty_profiles pp ON pp.patient_id = p.id
       WHERE p.id = $1`,
      [id]
    )
    if (!patient) throw Object.assign(new Error('Patient not found'), { statusCode: 404 })
    return patient
  })

  // ── Favorite Clinics ───────────────────────────────────────────────────────
  app.get('/favorites', {
    preHandler: app.requireRole(['patient']),
    schema: {
      tags: ['Patients', 'Clinics'],
      summary: 'Get favorite clinics for the patient',
      response: {
        200: { type: 'array', items: { type: 'object', additionalProperties: true } },
        ...Unauth,
      },
    }
  }, async (request) => {
    // 1. Get the patient ID for the logged in user
    const { rows: [patient] } = await app.db.query(
      `SELECT id FROM patients WHERE user_id = $1`,
      [request.jwtUser.sub]
    )
    if (!patient) return []

    // 2. Fetch all favorited clinics
    const { rows: clinics } = await app.db.query(
      `SELECT c.id, c.name, c.address, c.phone, c.timezone, c.latitude, c.longitude, c.status, c.created_at AS "createdAt"
       FROM clinics c
       JOIN patient_favorite_clinics pfc ON c.id = pfc.clinic_id
       WHERE pfc.patient_id = $1
       ORDER BY pfc.created_at DESC`,
      [patient.id]
    )
    return clinics
  })

  app.post('/favorites', {
    preHandler: app.requireRole(['patient']),
    schema: {
      tags: ['Patients', 'Clinics'],
      summary: 'Add a clinic to favorites',
      body: { type: 'object', required: ['clinicId'], properties: { clinicId: { type: 'string', format: 'uuid' } } },
      response: { ...Success, ...Unauth },
    }
  }, async (request) => {
    const { clinicId } = request.body as { clinicId: string }
    const { rows: [patient] } = await app.db.query(
      `SELECT id FROM patients WHERE user_id = $1`,
      [request.jwtUser.sub]
    )
    if (!patient) throw Object.assign(new Error('Patient profile not found'), { statusCode: 404 })

    await app.db.query(
      `INSERT INTO patient_favorite_clinics (patient_id, clinic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [patient.id, clinicId]
    )
    return { success: true }
  })

  app.delete('/favorites/:clinicId', {
    preHandler: app.requireRole(['patient']),
    schema: {
      tags: ['Patients', 'Clinics'],
      summary: 'Remove a clinic from favorites',
      params: { type: 'object', required: ['clinicId'], properties: { clinicId: { type: 'string', format: 'uuid' } } },
      response: { ...Success, ...Unauth },
    }
  }, async (request) => {
    const { clinicId } = request.params as { clinicId: string }
    const { rows: [patient] } = await app.db.query(
      `SELECT id FROM patients WHERE user_id = $1`,
      [request.jwtUser.sub]
    )
    if (!patient) throw Object.assign(new Error('Patient profile not found'), { statusCode: 404 })

    await app.db.query(
      `DELETE FROM patient_favorite_clinics WHERE patient_id = $1 AND clinic_id = $2`,
      [patient.id, clinicId]
    )
    return { success: true }
  })
}
