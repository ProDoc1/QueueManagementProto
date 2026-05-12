import type { FastifyInstance } from 'fastify'
import { BookAppointmentSchema, CancelAppointmentSchema, GenerateSlotsSchema } from '@repo/schemas'
import { bookAppointment, cancelAppointment, markNoShow } from './appointments.service.js'
import { getAvailableSlots, generateSlotsForDateRange } from './slots.service.js'
import { getPatientPenalty, resetPenalty } from './penalty.service.js'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export async function appointmentRoutes(app: FastifyInstance) {
  // Patient's own appointments — paginated, cursor-based
  app.get('/', { preHandler: app.authenticate }, async (request) => {
    const { limit: rawLimit, before, status } = request.query as {
      limit?: string; before?: string; status?: string
    }
    const limit = Math.min(parseInt(rawLimit ?? String(DEFAULT_LIMIT), 10), MAX_LIMIT)

    const conditions = ['p.user_id = $1']
    const params: unknown[] = [request.jwtUser.sub, limit]

    if (before) { params.push(before); conditions.push(`a.appointment_date < $${params.length}`) }
    if (status) { params.push(status); conditions.push(`a.status = $${params.length}`) }

    const { rows } = await app.db.query(
      `SELECT a.id, a.appointment_date AS "appointmentDate", a.status, a.type,
              a.is_late_number AS "isLateNumber", a.slot_position AS "slotPosition",
              a.notes, a.created_at AS "createdAt",
              u.full_name AS "doctorName", d.specialization
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.appointment_date DESC
       LIMIT $2`,
      params
    )

    return {
      data: rows,
      nextCursor: rows.length === limit ? rows[rows.length - 1]?.appointmentDate : null,
    }
  })

  // Book appointment
  app.post('/', { preHandler: app.requireRole(['patient']) }, async (request, reply) => {
    const input = BookAppointmentSchema.parse(request.body)
    const appointment = await bookAppointment(app, request.jwtUser.sub, input)
    return reply.code(201).send(appointment)
  })

  // Available slots for a doctor on a date (public)
  app.get('/slots', async (request) => {
    const { doctorId, date } = request.query as { doctorId: string; date: string }
    return getAvailableSlots(app, doctorId, date)
  })

  // Generate slots for a date range
  app.post('/slots/generate', { preHandler: app.requireRole(['admin', 'doctor']) }, async (request) => {
    const input = GenerateSlotsSchema.parse(request.body)
    return generateSlotsForDateRange(app, input.doctorId, input.fromDate, input.toDate)
  })

  // Cancel appointment
  app.put('/:id/cancel', { preHandler: app.authenticate }, async (request) => {
    const { id } = request.params as { id: string }
    const { reason } = CancelAppointmentSchema.parse(request.body)
    await cancelAppointment(app, id, request.jwtUser.sub, reason)
    return { success: true }
  })

  // Mark complete — verifies doctor owns the appointment
  app.put('/:id/complete', { preHandler: app.requireRole(['doctor', 'receptionist', 'admin']) }, async (request) => {
    const { id } = request.params as { id: string }
    const { rows: [appt] } = await app.db.query(
      `SELECT d.user_id AS "doctorUserId" FROM appointments a JOIN doctors d ON a.doctor_id = d.id WHERE a.id = $1`,
      [id]
    )
    if (!appt) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 })
    if (request.jwtUser.role === 'doctor' && appt.doctorUserId !== request.jwtUser.sub) {
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
    }
    await app.db.query(
      `UPDATE appointments SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    )
    return { success: true }
  })

  // Mark no-show
  app.put('/:id/no-show', { preHandler: app.requireRole(['doctor', 'receptionist']) }, async (request) => {
    const { id } = request.params as { id: string }
    await markNoShow(app, id, request.jwtUser.sub)
    return { success: true }
  })

  // Current patient's penalty
  app.get('/penalty/me', { preHandler: app.requireRole(['patient']) }, async (request) => {
    const { rows: [patient] } = await app.db.query(
      `SELECT id FROM patients WHERE user_id = $1`, [request.jwtUser.sub]
    )
    if (!patient) return { penaltyLevel: 0 }
    return getPatientPenalty(app, patient.id)
  })

  // Admin: reset penalty
  app.put('/penalty/:patientId/reset', { preHandler: app.requireRole(['admin']) }, async (request) => {
    const { patientId } = request.params as { patientId: string }
    await resetPenalty(app, patientId)
    return { success: true }
  })

  // Doctor's schedule — paginated
  app.get('/schedule', { preHandler: app.requireRole(['doctor']) }, async (request) => {
    const { date, limit: rawLimit, before } = request.query as {
      date?: string; limit?: string; before?: string
    }
    const limit = Math.min(parseInt(rawLimit ?? String(DEFAULT_LIMIT), 10), MAX_LIMIT)

    const conditions = ['d.user_id = $1']
    const params: unknown[] = [request.jwtUser.sub, limit]

    if (date) { params.push(date); conditions.push(`DATE(a.appointment_date) = $${params.length}`) }
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
       ORDER BY a.appointment_date
       LIMIT $2`,
      params
    )

    return {
      data: rows,
      nextCursor: rows.length === limit ? rows[rows.length - 1]?.appointmentDate : null,
    }
  })
}
