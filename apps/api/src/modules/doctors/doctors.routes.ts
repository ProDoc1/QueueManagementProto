import { v4 as uuidv4 } from 'uuid'
import type { FastifyInstance } from 'fastify'
import { UpdateDoctorSchema, UpdateLocationSchema, BroadcastDelaySchema } from '@repo/schemas'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const Unauthorized = { 401: { $ref: 'UnauthorizedError#' } }
const Success = { 200: { $ref: 'SuccessMessage#' } }

const DoctorProfile = {
  type: 'object',
  properties: {
    id:              { type: 'string', format: 'uuid' },
    fullName:        { type: 'string' },
    specialization:  { type: 'string' },
    bio:             { type: 'string', nullable: true },
    consultationFee: { type: 'number' },
    slotsPerHour:    { type: 'integer' },
    isAvailable:     { type: 'boolean' },
    clinicName:      { type: 'string', nullable: true },
    latitude:        { type: 'number', nullable: true },
    longitude:       { type: 'number', nullable: true },
    isLive:          { type: 'boolean', nullable: true },
    isLive:          { type: 'boolean', nullable: true },
    rating:          { type: 'number', nullable: true },
  },
}

const AdminDoctorProfile = {
  type: 'object',
  properties: {
    id:             { type: 'string', format: 'uuid' },
    userId:         { type: 'string', format: 'uuid' },
    fullName:       { type: 'string' },
    email:          { type: 'string' },
    specialization: { type: 'string' },
    licenseNumber:  { type: 'string' },
    isAvailable:    { type: 'boolean' },
    isActive:       { type: 'boolean' },
    createdAt:      { type: 'string' },
    clinics: {
      type: 'array',
      items: { type: 'string' },
    },
  },
}

export async function doctorRoutes(app: FastifyInstance) {

  // ── List doctors ────────────────────────────────────────────────────────────
  app.get('/', {
    schema: {
      tags: ['Doctors'],
      summary: 'List doctors — filterable, cursor-paginated',
      security: [],
      querystring: {
        type: 'object',
        properties: {
          specialization: { type: 'string',  example: 'General Medicine' },
          available:      { type: 'string',  enum: ['true', 'false'] },
          after:          { type: 'string',  description: 'Cursor — fullName value from previous page' },
          limit:          { type: 'integer', default: 20, maximum: 100 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data:       { type: 'array', items: DoctorProfile },
            nextCursor: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const { specialization, available, after, limit: rawLimit } = request.query as Record<string, string>
    const limit = Math.min(parseInt(rawLimit ?? String(DEFAULT_LIMIT), 10), MAX_LIMIT)

    const conditions = ['u.is_active = true']
    const params: unknown[] = [limit]
    if (specialization) { params.push(specialization); conditions.push(`d.specialization ILIKE $${params.length}`) }
    if (available === 'true') conditions.push(`d.is_available = true`)
    if (after) { params.push(after); conditions.push(`u.full_name > $${params.length}`) }

    const { rows } = await app.db.query(
      `SELECT d.id, d.specialization, d.consultation_fee AS "consultationFee",
              d.slots_per_hour AS "slotsPerHour", d.is_available AS "isAvailable",
              u.full_name AS "fullName", u.avatar_url AS "avatarUrl",
              dl.latitude, dl.longitude, dl.clinic_name AS "clinicName"
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN doctor_locations dl ON dl.doctor_id = d.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.full_name LIMIT $1`,
      params
    )
    return { data: rows, nextCursor: rows.length === limit ? rows[rows.length - 1]?.fullName : null }
  })

  // ── System-Wide Admin Directory ──────────────────────────────────────────────
  app.get('/directory', {
    preHandler: app.requireRole(['admin']),
    schema: {
      tags: ['Doctors'],
      summary: 'System-Wide Doctor Directory for Admins',
      response: {
        200: { type: 'array', items: AdminDoctorProfile },
        ...Unauthorized,
      },
    },
  }, async () => {
    const { rows } = await app.db.query(
      `SELECT d.id, d.user_id AS "userId", COALESCE(d.specialization, 'General') AS "specialization", COALESCE(d.license_number, 'Pending') AS "licenseNumber",
              d.is_available AS "isAvailable", d.created_at AS "createdAt",
              u.full_name AS "fullName", u.email, u.is_active AS "isActive",
              COALESCE(
                (SELECT json_agg(c.name) FROM doctor_clinics dc JOIN clinics c ON dc.clinic_id = c.id WHERE dc.doctor_id = d.id),
                '[]'
              ) AS clinics
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       ORDER BY u.full_name`
    )
    return rows
  })

  // ── Doctor profile ──────────────────────────────────────────────────────────
  app.get('/:id', {
    schema: {
      tags: ['Doctors'],
      summary: 'Get full doctor profile including rating and live location',
      security: [],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: DoctorProfile,
        404: { $ref: 'Error#' },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { rows: [doctor] } = await app.db.query(
      `SELECT d.id, d.specialization, d.bio, d.consultation_fee AS "consultationFee",
              d.slots_per_hour AS "slotsPerHour", d.is_available AS "isAvailable",
              d.working_hours AS "workingHours",
              u.full_name AS "fullName", u.email, u.avatar_url AS "avatarUrl",
              dl.latitude, dl.longitude, dl.clinic_name AS "clinicName", dl.address, dl.is_live AS "isLive",
              ROUND(AVG(r.stars), 1) AS rating
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN doctor_locations dl ON dl.doctor_id = d.id
       LEFT JOIN ratings r ON r.doctor_id = d.id
       WHERE d.id = $1 GROUP BY d.id, u.id, dl.id`,
      [id]
    )
    if (!doctor) throw Object.assign(new Error('Doctor not found'), { statusCode: 404 })
    return doctor
  })

  // ── Update own profile ──────────────────────────────────────────────────────
  app.put('/me', {
    preHandler: app.requireRole(['doctor']),
    schema: {
      tags: ['Doctors'],
      summary: 'Update own doctor profile — Doctor only',
      body: {
        type: 'object',
        properties: {
          specialization:  { type: 'string' },
          bio:             { type: 'string' },
          consultationFee: { type: 'number' },
          slotsPerHour:    { type: 'integer', minimum: 1, maximum: 10 },
          workingHours:    { type: 'object',  description: 'JSONB — e.g. {"mon":{"start":"09:00","end":"17:00"}}' },
        },
      },
      response: { ...Success, ...Unauthorized },
    },
  }, async (request) => {
    const input = UpdateDoctorSchema.parse(request.body)
    const setClauses: string[] = []
    const params: unknown[] = [request.jwtUser.sub]
    if (input.specialization !== undefined) { params.push(input.specialization); setClauses.push(`specialization = $${params.length}`) }
    if (input.bio !== undefined) { params.push(input.bio); setClauses.push(`bio = $${params.length}`) }
    if (input.consultationFee !== undefined) { params.push(input.consultationFee); setClauses.push(`consultation_fee = $${params.length}`) }
    if (input.slotsPerHour !== undefined) { params.push(input.slotsPerHour); setClauses.push(`slots_per_hour = $${params.length}`) }
    if (input.workingHours !== undefined) { params.push(JSON.stringify(input.workingHours)); setClauses.push(`working_hours = $${params.length}`) }
    if (setClauses.length === 0) return { success: true }
    await app.db.query(`UPDATE doctors SET ${setClauses.join(', ')} WHERE user_id = $1`, params)
    return { success: true }
  })

  // ── Update live location ────────────────────────────────────────────────────
  app.put('/me/location', {
    preHandler: app.requireRole(['doctor']),
    schema: {
      tags: ['Doctors'],
      summary: 'Update live location — broadcasts doctor_location Socket.IO event',
      body: {
        type: 'object',
        required: ['latitude', 'longitude'],
        properties: {
          latitude:  { type: 'number', example: 6.9271 },
          longitude: { type: 'number', example: 79.8612 },
          clinicName: { type: 'string', example: 'City Medical Centre' },
          address:    { type: 'string' },
          isLive:     { type: 'boolean', default: true },
        },
      },
      response: { ...Success, ...Unauthorized },
    },
  }, async (request) => {
    const input = UpdateLocationSchema.parse(request.body)
    await app.db.query(
      `INSERT INTO doctor_locations (id, doctor_id, latitude, longitude, clinic_name, address, is_live, updated_at)
       SELECT $1, d.id, $2, $3, $4, $5, $6, NOW() FROM doctors d WHERE d.user_id = $7
       ON CONFLICT (doctor_id) DO UPDATE SET latitude=$2, longitude=$3, clinic_name=$4, address=$5, is_live=$6, updated_at=NOW()`,
      [uuidv4(), input.latitude, input.longitude, input.clinicName ?? null, input.address ?? null, input.isLive ?? true, request.jwtUser.sub]
    )
    app.io.to(`doctor:${request.jwtUser.sub}`).emit('doctor_location', {
      doctorId: request.jwtUser.sub, lat: input.latitude, lng: input.longitude, timestamp: new Date().toISOString(),
    })
    return { success: true }
  })

  // ── Broadcast delay ─────────────────────────────────────────────────────────
  app.post('/me/delay', {
    preHandler: app.requireRole(['doctor']),
    schema: {
      tags: ['Doctors'],
      summary: 'Broadcast a delay notice to all subscribed patients',
      body: {
        type: 'object',
        required: ['delayMinutes'],
        properties: {
          delayMinutes: { type: 'integer', minimum: 1, example: 20 },
          message:      { type: 'string',  example: 'Running 20 minutes late due to an emergency.' },
        },
      },
      response: { ...Success, ...Unauthorized },
    },
  }, async (request) => {
    const input = BroadcastDelaySchema.parse(request.body)
    const message = input.message ?? `Dr. is running ${input.delayMinutes} minutes late.`
    app.io.to(`doctor:${request.jwtUser.sub}`).emit('doctor_delay', {
      doctorId: request.jwtUser.sub, delayMinutes: input.delayMinutes, message,
    })
    return { success: true }
  })

  // ── Subscribe ───────────────────────────────────────────────────────────────
  app.post('/:id/subscribe', {
    preHandler: app.requireRole(['patient']),
    schema: {
      tags: ['Doctors'],
      summary: 'Subscribe to a doctor — receive delay/location notifications',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: { ...Success, ...Unauthorized },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { rows: [patient] } = await app.db.query(`SELECT id FROM patients WHERE user_id = $1`, [request.jwtUser.sub])
    await app.db.query(
      `INSERT INTO doctor_subscriptions (id, patient_id, doctor_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [uuidv4(), patient.id, id]
    )
    return { success: true }
  })

  // ── Unsubscribe ─────────────────────────────────────────────────────────────
  app.delete('/:id/subscribe', {
    preHandler: app.requireRole(['patient']),
    schema: {
      tags: ['Doctors'],
      summary: 'Unsubscribe from a doctor',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: { ...Success, ...Unauthorized },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { rows: [patient] } = await app.db.query(`SELECT id FROM patients WHERE user_id = $1`, [request.jwtUser.sub])
    await app.db.query(`DELETE FROM doctor_subscriptions WHERE patient_id = $1 AND doctor_id = $2`, [patient.id, id])
    return { success: true }
  })
}
