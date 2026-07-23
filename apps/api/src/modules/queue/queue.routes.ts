import type { FastifyInstance } from 'fastify'
import { AddWalkInSchema } from '@repo/schemas'
import { addWalkIn, callNextPatient, completeCurrentPatient, getTodayQueue } from './queue.service.js'

const QueueEntry  = { $ref: 'WalkInQueueEntry#' }
const Unauthorized = { 401: { $ref: 'UnauthorizedError#' } }

export async function queueRoutes(app: FastifyInstance) {

  // ── GET today's queue ───────────────────────────────────────────────────────
  app.get('/', {
    preHandler: app.requireRole(['doctor', 'receptionist', ]),
    schema: {
      tags: ['Queue'],
      summary: "Get today's queue for a doctor",
      querystring: {
        type: 'object',
        required: ['doctorId'],
        properties: {
          doctorId: { type: 'string', format: 'uuid', description: 'Doctor ID (doctors.id)' },
        },
      },
      response: {
        200: { type: 'array', items: QueueEntry },
        ...Unauthorized,
      },
    },
  }, async (request) => {
    const { doctorId } = request.query as { doctorId: string }
    return getTodayQueue(app, doctorId)
  })

  // ── Public TV display (no auth) ─────────────────────────────────────────────
  app.get('/display/:clinicId', {
    schema: {
      tags: ['Queue'],
      summary: 'Public queue state for TV display — no authentication required',
      security: [],
      params: {
        type: 'object',
        required: ['clinicId'],
        properties: {
          clinicId: { type: 'string', description: 'Clinic ID (clinics.id)' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              queueNumber: { type: 'integer' },
              status:      { type: 'string' },
              patientName: { type: 'string' },
              doctorId:    { type: 'string' },
              doctorName:  { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request) => {
    const { clinicId } = request.params as { clinicId: string }
    const today = new Date().toISOString().split('T')[0]!
    const { rows } = await app.db.query(
      `SELECT w.queue_number AS "queueNumber", w.status, w.patient_name AS "patientName",
              d.id AS "doctorId", u.full_name AS "doctorName"
       FROM walk_in_queue w
       JOIN doctors d ON w.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE w.clinic_id = $1 AND w.queue_date = $2
         AND w.status IN ('waiting','called','in_progress')
       ORDER BY w.queue_number`,
      [clinicId, today]
    )
    return rows
  })

  // ── Add walk-in patient ─────────────────────────────────────────────────────
  app.post('/', {
    preHandler: app.requireRole(['receptionist', ]),
    schema: {
      tags: ['Queue'],
      summary: 'Add a walk-in patient to the queue',
      description: 'Assigns the next sequential token number for today. Optionally sends an SMS when a phone number is provided.',
      body: {
        type: 'object',
        required: ['patientName', 'doctorId'],
        properties: {
          patientName: { type: 'string',  example: 'Kamal Perera' },
          doctorId:    { type: 'string',  format: 'uuid' },
          clinicId:    { type: 'string',  description: 'clinics.id — required for TV screen broadcast' },
          smsPhone:    { type: 'string',  example: '+94771234567', description: 'Optional — triggers SMS notification' },
          patientId:   { type: 'string',  format: 'uuid', description: 'Optional — links to a registered patient account' },
        },
      },
      response: {
        201: { description: 'Token issued', ...QueueEntry },
        ...Unauthorized,
      },
    },
  }, async (request, reply) => {
    const input = AddWalkInSchema.parse(request.body)
    const entry = await addWalkIn(app, input)
    return reply.code(201).send(entry)
  })

  // ── Call next patient ───────────────────────────────────────────────────────
  app.post('/call-next', {
    preHandler: app.requireRole(['doctor', 'receptionist']),
    schema: {
      tags: ['Queue'],
      summary: 'Call next waiting patient — current moves to in_progress, next moves to called',
      description: 'Triggers an SMS to the called patient if they have a phone number on record. Also broadcasts a Socket.IO `queue_update` event.',
      body: {
        type: 'object',
        required: ['doctorId'],
        properties: {
          doctorId: { type: 'string', format: 'uuid' },
          clinicId: { type: 'string', description: 'Required for TV screen broadcast' },
        },
      },
      response: {
        200: {
          oneOf: [
            { ...QueueEntry, description: 'Next patient called' },
            { type: 'object', properties: { message: { type: 'string', example: 'No patients waiting in queue' } } },
          ],
        },
        ...Unauthorized,
      },
    },
  }, async (request) => {
    const { doctorId, clinicId } = request.body as { doctorId: string; clinicId?: string }
    const next = await callNextPatient(app, doctorId, clinicId)
    if (!next) return { message: 'No patients waiting in queue' }
    return next
  })

  // ── Complete current patient ────────────────────────────────────────────────
  app.post('/complete-current', {
    preHandler: app.requireRole(['doctor', 'receptionist']),
    schema: {
      tags: ['Queue'],
      summary: 'Mark the current in_progress patient as completed',
      body: {
        type: 'object',
        required: ['doctorId'],
        properties: {
          doctorId: { type: 'string', format: 'uuid' },
          clinicId: { type: 'string' },
        },
      },
      response: {
        200: { $ref: 'SuccessMessage#' },
        ...Unauthorized,
      },
    },
  }, async (request) => {
    const { doctorId, clinicId } = request.body as { doctorId: string; clinicId?: string }
    await completeCurrentPatient(app, doctorId, clinicId)
    return { success: true }
  })

  // ── Manual status override ──────────────────────────────────────────────────
  app.put('/:id/status', {
    preHandler: app.requireRole(['doctor', 'receptionist', ]),
    schema: {
      tags: ['Queue'],
      summary: 'Override a queue entry status (e.g. mark as no-show / left)',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid', description: 'walk_in_queue.id' },
        },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['waiting', 'called', 'in_progress', 'completed', 'left'] },
        },
      },
      response: {
        200: { $ref: 'SuccessMessage#' },
        400: { $ref: 'Error#' },
        ...Unauthorized,
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: string }
    const allowed = ['waiting', 'called', 'in_progress', 'completed', 'left']
    if (!allowed.includes(status)) throw Object.assign(new Error('Invalid status'), { statusCode: 400 })
    await app.db.query(`UPDATE walk_in_queue SET status = $1 WHERE id = $2`, [status, id])
    return { success: true }
  })
}
