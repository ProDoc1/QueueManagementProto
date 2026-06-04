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
    dateOfBirth:      { type: 'string', format: 'date', nullable: true },
    gender:           { type: 'string', nullable: true },
    bloodType:        { type: 'string', nullable: true },
    allergies:        { type: 'array', items: { type: 'string' } },
    emergencyContact: { type: 'object', nullable: true },
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
              p.allergies, p.emergency_contact AS "emergencyContact", p.insurance_info AS "insuranceInfo",
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
          dateOfBirth:      { type: 'string', format: 'date', example: '1990-05-20' },
          gender:           { type: 'string', enum: ['male','female','other'] },
          bloodType:        { type: 'string', example: 'O+' },
          allergies:        { type: 'array', items: { type: 'string' }, example: ['Penicillin'] },
          emergencyContact: { type: 'object', description: 'JSONB — name, phone, relationship' },
          insuranceInfo:    { type: 'object', description: 'JSONB — provider, policy number' },
        },
      },
      response: { ...Success, ...Unauth },
    },
  }, async (request) => {
    const input = UpdatePatientSchema.parse(request.body)
    const sets: string[] = []
    const params: unknown[] = [request.jwtUser.sub]
    if (input.dateOfBirth)      { params.push(input.dateOfBirth);                         sets.push(`date_of_birth = $${params.length}`) }
    if (input.gender)           { params.push(input.gender);                              sets.push(`gender = $${params.length}`) }
    if (input.bloodType)        { params.push(input.bloodType);                           sets.push(`blood_type = $${params.length}`) }
    if (input.allergies)        { params.push(input.allergies);                           sets.push(`allergies = $${params.length}`) }
    if (input.emergencyContact) { params.push(JSON.stringify(input.emergencyContact));    sets.push(`emergency_contact = $${params.length}`) }
    if (input.insuranceInfo)    { params.push(JSON.stringify(input.insuranceInfo));       sets.push(`insurance_info = $${params.length}`) }
    if (sets.length === 0) return { success: true }
    await app.db.query(`UPDATE patients SET ${sets.join(', ')} WHERE user_id = $1`, params)
    return { success: true }
  })

  // ── Doctor/staff views a patient ────────────────────────────────────────────
  app.get('/:id', {
    preHandler: app.requireRole(['doctor', 'receptionist', 'admin']),
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
}
