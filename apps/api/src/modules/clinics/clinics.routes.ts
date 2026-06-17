import type { FastifyInstance } from 'fastify'

const Unauthorized = { 401: { $ref: 'UnauthorizedError#' } }

const ClinicBody = {
  type: 'object',
  required: ['name'],
  properties: {
    name:     { type: 'string',  example: 'City Medical Centre' },
    address:  { type: 'string',  example: '42 Hospital Road, Colombo' },
    phone:    { type: 'string',  example: '+94112345678' },
    timezone: { type: 'string',  example: 'Asia/Colombo' },
    latitude:  { type: 'number', example: 6.9271 },
    longitude: { type: 'number', example: 79.8612 },
    status:   { type: 'string',  enum: ['pending', 'active', 'suspended'], example: 'active' },
  },
}

const ClinicResponse = {
  type: 'object',
  properties: {
    id:        { type: 'string' },
    name:      { type: 'string' },
    address:   { type: 'string', nullable: true },
    phone:     { type: 'string', nullable: true },
    timezone:  { type: 'string' },
    latitude:  { type: 'number', nullable: true },
    longitude: { type: 'number', nullable: true },
    status:    { type: 'string', enum: ['pending', 'active', 'suspended'] },
    createdAt: { type: 'string' },
  },
}

export async function clinicRoutes(app: FastifyInstance) {

  // ── List all clinics ─────────────────────────────────────────────────────────
  app.get('/', {
    preHandler: app.requireRole(['admin', 'doctor', 'receptionist']),
    schema: {
      tags: ['Clinics'],
      summary: 'List all clinics',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'active', 'suspended'] },
          search: { type: 'string' },
        },
      },
      response: {
        200: { type: 'array', items: ClinicResponse },
        ...Unauthorized,
      },
    },
  }, async (request) => {
    const { status, search } = request.query as { status?: string; search?: string }

    let sql = `SELECT id, name, address, phone, timezone, latitude, longitude, status, created_at AS "createdAt"
               FROM clinics WHERE 1=1`
    const params: unknown[] = []

    if (status) {
      params.push(status)
      sql += ` AND status = $${params.length}`
    }
    if (search) {
      params.push(`%${search}%`)
      sql += ` AND (name ILIKE $${params.length} OR address ILIKE $${params.length})`
    }

    sql += ' ORDER BY created_at DESC'
    const { rows } = await app.db.query(sql, params)
    return rows
  })

  // ── Get single clinic ────────────────────────────────────────────────────────
  app.get('/:id', {
    preHandler: app.requireRole(['admin', 'doctor', 'receptionist']),
    schema: {
      tags: ['Clinics'],
      summary: 'Get clinic by ID',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: ClinicResponse,
        404: { $ref: 'Error#' },
        ...Unauthorized,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { rows } = await app.db.query(
      `SELECT id, name, address, phone, timezone, latitude, longitude, status, created_at AS "createdAt"
       FROM clinics WHERE id = $1`,
      [id]
    )
    if (!rows[0]) return reply.code(404).send({ error: 'Clinic not found' })
    return rows[0]
  })

  // ── Create clinic ────────────────────────────────────────────────────────────
  app.post('/', {
    preHandler: app.requireRole(['admin']),
    schema: {
      tags: ['Clinics'],
      summary: 'Create (onboard) a new medical center — Admin only',
      body: ClinicBody,
      response: {
        201: { description: 'Clinic created', ...ClinicResponse },
        ...Unauthorized,
      },
    },
  }, async (request, reply) => {
    const { name, address, phone, timezone, latitude, longitude, status } = request.body as {
      name: string; address?: string; phone?: string; timezone?: string
      latitude?: number; longitude?: number; status?: string
    }

    const { rows } = await app.db.query(
      `INSERT INTO clinics (name, address, phone, timezone, latitude, longitude, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, address, phone, timezone, latitude, longitude, status, created_at AS "createdAt"`,
      [name, address ?? null, phone ?? null, timezone ?? 'Asia/Colombo', latitude ?? null, longitude ?? null, status ?? 'pending']
    )
    return reply.code(201).send(rows[0])
  })

  // ── Update clinic ────────────────────────────────────────────────────────────
  app.put('/:id', {
    preHandler: app.requireRole(['admin']),
    schema: {
      tags: ['Clinics'],
      summary: 'Update clinic details or change status — Admin only',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: ClinicBody,
      response: {
        200: ClinicResponse,
        404: { $ref: 'Error#' },
        ...Unauthorized,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { name, address, phone, timezone, latitude, longitude, status } = request.body as {
      name: string; address?: string; phone?: string; timezone?: string
      latitude?: number; longitude?: number; status?: string
    }

    const { rows } = await app.db.query(
      `UPDATE clinics SET
         name = COALESCE($1, name),
         address = COALESCE($2, address),
         phone = COALESCE($3, phone),
         timezone = COALESCE($4, timezone),
         latitude = COALESCE($5, latitude),
         longitude = COALESCE($6, longitude),
         status = COALESCE($7, status)
       WHERE id = $8
       RETURNING id, name, address, phone, timezone, latitude, longitude, status, created_at AS "createdAt"`,
      [name ?? null, address ?? null, phone ?? null, timezone ?? null, latitude ?? null, longitude ?? null, status ?? null, id]
    )
    if (!rows[0]) return reply.code(404).send({ error: 'Clinic not found' })
    return rows[0]
  })

  // ── Approve / change status ──────────────────────────────────────────────────
  app.patch('/:id/status', {
    preHandler: app.requireRole(['admin']),
    schema: {
      tags: ['Clinics'],
      summary: 'Approve, suspend, or reset a clinic status — Admin only',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['pending', 'active', 'suspended'] },
        },
      },
      response: {
        200: { $ref: 'SuccessMessage#' },
        404: { $ref: 'Error#' },
        ...Unauthorized,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: string }
    const { rowCount } = await app.db.query(
      `UPDATE clinics SET status = $1 WHERE id = $2`,
      [status, id]
    )
    if (!rowCount) return reply.code(404).send({ error: 'Clinic not found' })
    return { success: true }
  })

  // ── Delete clinic ────────────────────────────────────────────────────────────
  app.delete('/:id', {
    preHandler: app.requireRole(['admin']),
    schema: {
      tags: ['Clinics'],
      summary: 'Delete a clinic — Admin only',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { $ref: 'SuccessMessage#' },
        404: { $ref: 'Error#' },
        ...Unauthorized,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { rowCount } = await app.db.query(`DELETE FROM clinics WHERE id = $1`, [id])
    if (!rowCount) return reply.code(404).send({ error: 'Clinic not found' })
    return { success: true }
  })

  // ── List doctors assigned to a clinic ───────────────────────────────────────
  app.get('/:id/doctors', {
    preHandler: app.requireRole(['admin', 'receptionist']),
    schema: {
      tags: ['Clinics'],
      summary: 'List doctors assigned to this clinic',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              doctorId:       { type: 'string' },
              fullName:       { type: 'string' },
              email:          { type: 'string' },
              specialization: { type: 'string' },
              isAvailable:    { type: 'boolean' },
            },
          },
        },
        ...Unauthorized,
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { rows } = await app.db.query(
      `SELECT d.id AS "doctorId", u.full_name AS "fullName", u.email,
              d.specialization, d.is_available AS "isAvailable"
       FROM doctor_clinics dc
       JOIN doctors d ON dc.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE dc.clinic_id = $1
       ORDER BY u.full_name`,
      [id]
    )
    return rows
  })

  // ── Assign doctor to clinic ──────────────────────────────────────────────────
  app.post('/:id/doctors', {
    preHandler: app.requireRole(['admin']),
    schema: {
      tags: ['Clinics'],
      summary: 'Assign a doctor to this clinic — Admin only',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['doctorId'],
        properties: {
          doctorId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        201: { $ref: 'SuccessMessage#' },
        ...Unauthorized,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { doctorId } = request.body as { doctorId: string }
    await app.db.query(
      `INSERT INTO doctor_clinics (doctor_id, clinic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [doctorId, id]
    )
    return reply.code(201).send({ success: true })
  })

  // ── Remove doctor from clinic ────────────────────────────────────────────────
  app.delete('/:id/doctors/:doctorId', {
    preHandler: app.requireRole(['admin']),
    schema: {
      tags: ['Clinics'],
      summary: 'Remove a doctor from this clinic — Admin only',
      params: {
        type: 'object',
        required: ['id', 'doctorId'],
        properties: {
          id:       { type: 'string', format: 'uuid' },
          doctorId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: { $ref: 'SuccessMessage#' },
        ...Unauthorized,
      },
    },
  }, async (request) => {
    const { id, doctorId } = request.params as { id: string; doctorId: string }
    await app.db.query(
      `DELETE FROM doctor_clinics WHERE clinic_id = $1 AND doctor_id = $2`,
      [id, doctorId]
    )
    return { success: true }
  })
}
