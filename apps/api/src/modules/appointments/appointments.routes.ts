import type { FastifyInstance } from 'fastify'
import { BookAppointmentSchema, CancelAppointmentSchema, GenerateSlotsSchema } from '@repo/schemas'
import { bookAppointment, cancelAppointment, markNoShow } from './appointments.service.js'
import { getAvailableSlots, generateSlotsForDateRange } from './slots.service.js'
import { getPatientPenalty, resetPenalty } from './penalty.service.js'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const Unauth  = { 401: { $ref: 'UnauthorizedError#' } }
const Success = { 200: { $ref: 'SuccessMessage#' } }
const IdParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } }

const ApptRow = {
  type: 'object',
  properties: {
    id:              { type: 'string', format: 'uuid' },
    appointmentDate: { type: 'string', format: 'date-time' },
    status:          { type: 'string', enum: ['scheduled','completed','cancelled','no_show'] },
    type:            { type: 'string', enum: ['in_person','virtual'] },
    isLateNumber:    { type: 'boolean' },
    slotPosition:    { type: 'integer' },
    doctorName:      { type: 'string' },
    specialization:  { type: 'string' },
  },
}

export async function appointmentRoutes(app: FastifyInstance) {

  // ── Patient's own appointments ──────────────────────────────────────────────
  app.get('/', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Appointments'],
      summary: "List current patient's appointments — cursor-paginated",
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['scheduled','completed','cancelled','no_show'] },
          before: { type: 'string', format: 'date-time', description: 'Pagination cursor' },
          limit:  { type: 'integer', default: 20, maximum: 100 },
        },
      },
      response: {
        200: { type: 'object', properties: { data: { type: 'array', items: ApptRow }, nextCursor: { type: 'string', nullable: true } } },
        ...Unauth,
      },
    },
  }, async (request) => {
    const { limit: rawLimit, before, status } = request.query as { limit?: string; before?: string; status?: string }
    const limit = Math.min(parseInt(rawLimit ?? String(DEFAULT_LIMIT), 10), MAX_LIMIT)
    const conditions = ['p.user_id = $1']
    const params: unknown[] = [request.jwtUser.sub, limit]
    if (before) { params.push(before); conditions.push(`a.appointment_date < $${params.length}`) }
    if (status) { params.push(status); conditions.push(`a.status = $${params.length}`) }
    const { rows } = await app.db.query(
      `SELECT a.id, a.appointment_date AS "appointmentDate", a.status, a.type,
              a.is_late_number AS "isLateNumber", a.slot_position AS "slotPosition",
              a.notes, a.created_at AS "createdAt", u.full_name AS "doctorName", d.specialization
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.appointment_date DESC LIMIT $2`,
      params
    )
    return { data: rows, nextCursor: rows.length === limit ? rows[rows.length - 1]?.appointmentDate : null }
  })

  // ── Book appointment ────────────────────────────────────────────────────────
  app.post('/', {
    preHandler: app.requireRole(['patient']),
    schema: {
      tags: ['Appointments'],
      summary: 'Book an appointment — atomic Redis slot reservation, penalty-aware',
      description: 'Penalty level 3 = rejected. Level 2 = assigned last slot position.',
      body: {
        type: 'object',
        required: ['doctorId', 'slotId'],
        properties: {
          doctorId: { type: 'string', format: 'uuid' },
          slotId:   { type: 'string', format: 'uuid' },
          type:     { type: 'string', enum: ['in_person','virtual'], default: 'in_person' },
          notes:    { type: 'string' },
        },
      },
      response: {
        201: { $ref: 'Appointment#' },
        409: { description: 'Slot full or booking blocked by penalty', $ref: 'Error#' },
        ...Unauth,
      },
    },
  }, async (request, reply) => {
    const input = BookAppointmentSchema.parse(request.body)
    const appointment = await bookAppointment(app, request.jwtUser.sub, input)
    return reply.code(201).send(appointment)
  })

  // ── Available slots ─────────────────────────────────────────────────────────
  app.get('/slots', {
    schema: {
      tags: ['Appointments'],
      summary: 'Get available slots for a doctor on a date — public',
      security: [],
      querystring: {
        type: 'object',
        required: ['doctorId', 'date'],
        properties: {
          doctorId: { type: 'string', format: 'uuid' },
          date:     { type: 'string', format: 'date', example: '2026-06-10' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id:        { type: 'string', format: 'uuid' },
              slotHour:  { type: 'integer', description: '24h — e.g. 9 = 09:00' },
              capacity:  { type: 'integer' },
              available: { type: 'integer' },
            },
          },
        },
      },
    },
  }, async (request) => {
    const { doctorId, date } = request.query as { doctorId: string; date: string }
    return getAvailableSlots(app, doctorId, date)
  })

  // ── Generate slots ──────────────────────────────────────────────────────────
  app.post('/slots/generate', {
    preHandler: app.requireRole(['doctor']),
    schema: {
      tags: ['Appointments'],
      summary: 'Generate slots for a date range from doctor working_hours — Admin/Doctor',
      body: {
        type: 'object',
        required: ['doctorId', 'fromDate', 'toDate'],
        properties: {
          doctorId: { type: 'string', format: 'uuid' },
          fromDate: { type: 'string', format: 'date', example: '2026-07-01' },
          toDate:   { type: 'string', format: 'date', example: '2026-07-31' },
        },
      },
      response: {
        200: { type: 'object', properties: { generated: { type: 'integer' } } },
        ...Unauth,
      },
    },
  }, async (request) => {
    const input = GenerateSlotsSchema.parse(request.body)
    return generateSlotsForDateRange(app, input.doctorId, input.fromDate, input.toDate)
  })

  // ── Cancel ──────────────────────────────────────────────────────────────────
  app.put('/:id/cancel', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Appointments'],
      summary: 'Cancel appointment — late-cancel penalty applied if < 2 hours before',
      params: IdParam,
      body: { type: 'object', properties: { reason: { type: 'string' } } },
      response: { ...Success, ...Unauth },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { reason } = CancelAppointmentSchema.parse(request.body)
    await cancelAppointment(app, id, request.jwtUser.sub, reason)
    return { success: true }
  })

  // ── Complete ────────────────────────────────────────────────────────────────
  app.put('/:id/complete', {
    preHandler: app.requireRole(['doctor', 'receptionist', ]),
    schema: {
      tags: ['Appointments'],
      summary: 'Mark appointment completed',
      params: IdParam,
      response: { ...Success, 404: { $ref: 'Error#' }, ...Unauth },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { rows: [appt] } = await app.db.query(
      `SELECT d.user_id AS "doctorUserId" FROM appointments a JOIN doctors d ON a.doctor_id = d.id WHERE a.id = $1`, [id]
    )
    if (!appt) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 })
    if (request.jwtUser.role === 'doctor' && appt.doctorUserId !== request.jwtUser.sub)
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
    await app.db.query(`UPDATE appointments SET status='completed', completed_at=NOW(), updated_at=NOW() WHERE id=$1`, [id])
    return { success: true }
  })

  // ── No-show ─────────────────────────────────────────────────────────────────
  app.put('/:id/no-show', {
    preHandler: app.requireRole(['doctor', 'receptionist']),
    schema: {
      tags: ['Appointments'],
      summary: 'Mark patient as no-show — increments penalty counter',
      params: IdParam,
      response: { ...Success, ...Unauth },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }
    await markNoShow(app, id, request.jwtUser.sub)
    return { success: true }
  })

  // ── Patient penalty ─────────────────────────────────────────────────────────
  app.get('/penalty/me', {
    preHandler: app.requireRole(['patient']),
    schema: {
      tags: ['Appointments'],
      summary: "Get own penalty profile — 0=none, 1=warning, 2=late slot, 3=blocked",
      response: {
        200: {
          type: 'object',
          properties: {
            penaltyLevel:    { type: 'integer' },
            noShowCount:     { type: 'integer' },
            lateCancelCount: { type: 'integer' },
            penaltyExpiresAt:{ type: 'string', format: 'date-time', nullable: true },
          },
        },
        ...Unauth,
      },
    },
  }, async (request) => {
    const { rows: [patient] } = await app.db.query(`SELECT id FROM patients WHERE user_id = $1`, [request.jwtUser.sub])
    if (!patient) return { penaltyLevel: 0 }
    return getPatientPenalty(app, patient.id)
  })

  // ── Admin: reset penalty ────────────────────────────────────────────────────
  app.put('/penalty/:patientId/reset', {
    preHandler: app.requireRole([]),
    schema: {
      tags: ['Appointments'],
      summary: 'Reset patient penalty to 0 — Admin only',
      params: { type: 'object', required: ['patientId'], properties: { patientId: { type: 'string', format: 'uuid' } } },
      response: { ...Success, ...Unauth },
    },
  }, async (request) => {
    const { patientId } = request.params as { patientId: string }
    await resetPenalty(app, patientId)
    return { success: true }
  })

  // ── Doctor schedule ─────────────────────────────────────────────────────────
  app.get('/schedule', {
    preHandler: app.requireRole(['doctor']),
    schema: {
      tags: ['Appointments'],
      summary: "Doctor's own schedule — filterable by date",
      querystring: {
        type: 'object',
        properties: {
          date:   { type: 'string', format: 'date', example: '2026-06-10' },
          before: { type: 'string', format: 'date-time' },
          limit:  { type: 'integer', default: 20, maximum: 100 },
        },
      },
      response: {
        200: { type: 'object', properties: { data: { type: 'array', items: ApptRow }, nextCursor: { type: 'string', nullable: true } } },
        ...Unauth,
      },
    },
  }, async (request) => {
    const { date, limit: rawLimit, before } = request.query as { date?: string; limit?: string; before?: string }
    const limit = Math.min(parseInt(rawLimit ?? String(DEFAULT_LIMIT), 10), MAX_LIMIT)
    const conditions = ['d.user_id = $1']
    const params: unknown[] = [request.jwtUser.sub, limit]
    if (date)   { params.push(date);   conditions.push(`DATE(a.appointment_date) = $${params.length}`) }
    if (before) { params.push(before); conditions.push(`a.appointment_date < $${params.length}`) }
    const { rows } = await app.db.query(
      `SELECT a.id, a.appointment_date AS "appointmentDate", a.status, a.type,
              a.slot_position AS "slotPosition", a.is_late_number AS "isLateNumber",
              a.notes, u.full_name AS "patientName", a.patient_id AS "patientId"
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       JOIN patients p ON a.patient_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.appointment_date LIMIT $2`,
      params
    )
    return { data: rows, nextCursor: rows.length === limit ? rows[rows.length - 1]?.appointmentDate : null }
  })
}
