import type { FastifyInstance } from 'fastify'
import { AddWalkInSchema } from '@repo/schemas'
import { addWalkIn, callNextPatient, completeCurrentPatient, getTodayQueue } from './queue.service.js'

export async function queueRoutes(app: FastifyInstance) {
  // Today's queue for a doctor
  app.get('/', { preHandler: app.requireRole(['doctor', 'receptionist', 'admin']) }, async (request) => {
    const { doctorId } = request.query as { doctorId: string }
    return getTodayQueue(app, doctorId)
  })

  // Public queue state for TV display screen (no auth required)
  app.get('/display/:clinicId', async (request) => {
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

  // Add walk-in patient (receptionist/admin only)
  app.post('/', { preHandler: app.requireRole(['receptionist', 'admin']) }, async (request, reply) => {
    const input = AddWalkInSchema.parse(request.body)
    const entry = await addWalkIn(app, input)
    return reply.code(201).send(entry)
  })

  // Call next: currently-called → in_progress, next waiting → called
  app.post('/call-next', { preHandler: app.requireRole(['doctor', 'receptionist']) }, async (request) => {
    const { doctorId, clinicId } = request.body as { doctorId: string; clinicId?: string }
    const next = await callNextPatient(app, doctorId, clinicId)
    if (!next) return { message: 'No patients waiting in queue' }
    return next
  })

  // Mark current in_progress patient as completed
  app.post('/complete-current', { preHandler: app.requireRole(['doctor', 'receptionist']) }, async (request) => {
    const { doctorId, clinicId } = request.body as { doctorId: string; clinicId?: string }
    await completeCurrentPatient(app, doctorId, clinicId)
    return { success: true }
  })

  // Manual status override (e.g. patient marked as 'left')
  app.put('/:id/status', { preHandler: app.requireRole(['doctor', 'receptionist', 'admin']) }, async (request) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: string }
    const allowed = ['waiting', 'called', 'in_progress', 'completed', 'left']
    if (!allowed.includes(status)) throw Object.assign(new Error('Invalid status'), { statusCode: 400 })
    await app.db.query(
      `UPDATE walk_in_queue SET status = $1 WHERE id = $2`, [status, id]
    )
    return { success: true }
  })
}
