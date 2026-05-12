import type { FastifyInstance } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import type { BookAppointmentInput } from '@repo/schemas'
import type { Appointment } from '@repo/types'
import { reserveSlot, releaseSlot } from './slots.service.js'
import { getPatientPenalty, recordLateCancel, isLateCancellation } from './penalty.service.js'

export async function bookAppointment(app: FastifyInstance, userId: string, input: BookAppointmentInput): Promise<Appointment> {
  const { rows: [patient] } = await app.db.query(
    `SELECT id FROM patients WHERE user_id = $1`,
    [userId]
  )
  if (!patient) throw Object.assign(new Error('Patient profile not found'), { statusCode: 404 })

  const penalty = await getPatientPenalty(app, patient.id)
  if (penalty.penaltyLevel === 3) {
    throw Object.assign(
      new Error(`Booking suspended until ${penalty.penaltyExpiresAt}. Repeated no-shows detected.`),
      { statusCode: 403 }
    )
  }

  const client = await app.db.connect()
  try {
    await client.query('BEGIN')

    // Lock the slot row so concurrent bookings see the latest booked_count
    const { rows: [slot] } = await client.query(
      `SELECT id, doctor_id AS "doctorId", slot_date AS "slotDate", slot_hour AS "slotHour",
              capacity, booked_count AS "bookedCount", is_blocked AS "isBlocked"
       FROM doctor_slots WHERE id = $1 FOR UPDATE`,
      [input.slotId]
    )
    if (!slot) throw Object.assign(new Error('Slot not found'), { statusCode: 404 })
    if (slot.isBlocked) throw Object.assign(new Error('Slot is blocked'), { statusCode: 409 })
    if (slot.doctorId !== input.doctorId) throw Object.assign(new Error('Slot does not belong to this doctor'), { statusCode: 400 })

    // The partial unique index (patient_id, slot_id) WHERE status <> 'cancelled' enforces this at DB level too
    const { rows: existing } = await client.query(
      `SELECT id FROM appointments WHERE patient_id = $1 AND slot_id = $2 AND status <> 'cancelled'`,
      [patient.id, input.slotId]
    )
    if (existing.length > 0) throw Object.assign(new Error('Already booked for this slot'), { statusCode: 409 })

    const bookedPosition = await reserveSlot(app, input.slotId, client)
    const isLateNumber = penalty.penaltyLevel >= 2

    const appointmentDate = buildAppointmentDate(slot.slotDate, slot.slotHour)

    const { rows: [appointment] } = await client.query<Appointment>(
      `INSERT INTO appointments (id, patient_id, doctor_id, slot_id, appointment_date, slot_position, status, type, is_late_number, notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8, $9)
       RETURNING id, patient_id AS "patientId", doctor_id AS "doctorId", slot_id AS "slotId",
                 appointment_date AS "appointmentDate", slot_position AS "slotPosition",
                 status, type, is_late_number AS "isLateNumber", notes,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [uuidv4(), patient.id, input.doctorId, input.slotId, appointmentDate,
       bookedPosition, input.type, isLateNumber, input.notes ?? null]
    )

    // Sync Redis booked_count to DB inside the same transaction
    await client.query(
      `UPDATE doctor_slots SET booked_count = $1, updated_at = NOW() WHERE id = $2`,
      [bookedPosition, input.slotId]
    )

    await client.query('COMMIT')

    app.io.to(`doctor:${input.doctorId}`).emit('slot_update', {
      slotId: input.slotId,
      availableCount: slot.capacity - bookedPosition,
    })

    return appointment!
  } catch (err) {
    await client.query('ROLLBACK')
    // Release the Redis counter if booking failed after reserveSlot succeeded
    await releaseSlot(app, input.slotId).catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export async function cancelAppointment(app: FastifyInstance, appointmentId: string, userId: string, reason?: string) {
  // Alias all columns explicitly so TypeScript and runtime both get camelCase
  const { rows: [appt] } = await app.db.query<{
    id: string; slotId: string; patientId: string; doctorId: string
    appointmentDate: string; status: string; userOwnerId: string
  }>(
    `SELECT a.id,
            a.slot_id             AS "slotId",
            a.patient_id          AS "patientId",
            a.doctor_id           AS "doctorId",
            a.appointment_date    AS "appointmentDate",
            a.status,
            p.user_id             AS "userOwnerId"
     FROM appointments a
     JOIN patients p ON a.patient_id = p.id
     WHERE a.id = $1`,
    [appointmentId]
  )
  if (!appt) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 })
  if (appt.userOwnerId !== userId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
  if (!['scheduled', 'confirmed'].includes(appt.status)) {
    throw Object.assign(new Error('Cannot cancel this appointment'), { statusCode: 400 })
  }

  await app.db.query(
    `UPDATE appointments
     SET status = 'cancelled', cancellation_reason = $1, cancelled_at = NOW(), updated_at = NOW()
     WHERE id = $2`,
    [reason ?? null, appointmentId]
  )

  await releaseSlot(app, appt.slotId)

  if (isLateCancellation(appt.appointmentDate)) {
    await recordLateCancel(app, appt.patientId)
  }

  notifyWaitlist(app, appt.slotId).catch(() => {})
}

export async function markNoShow(app: FastifyInstance, appointmentId: string, doctorUserId: string) {
  const { rows: [appt] } = await app.db.query<{
    id: string; patientId: string; doctorUserId: string; status: string
  }>(
    `SELECT a.id,
            a.patient_id AS "patientId",
            a.status,
            d.user_id    AS "doctorUserId"
     FROM appointments a
     JOIN doctors d ON a.doctor_id = d.id
     WHERE a.id = $1`,
    [appointmentId]
  )
  if (!appt) throw Object.assign(new Error('Not found'), { statusCode: 404 })
  if (appt.doctorUserId !== doctorUserId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 })
  if (appt.status === 'no_show') throw Object.assign(new Error('Already marked as no-show'), { statusCode: 409 })

  // Single-statement: update status and penalty in one go via a stored pattern
  await app.db.query(
    `UPDATE appointments SET status = 'no_show', updated_at = NOW() WHERE id = $1`,
    [appointmentId]
  )

  // recordNoShow is now a single atomic statement
  await app.db.query(
    `UPDATE penalty_profiles
     SET no_show_count      = no_show_count + 1,
         last_infraction_at = NOW(),
         last_evaluated_at  = NOW(),
         updated_at         = NOW(),
         penalty_level      = CASE
           WHEN no_show_count + 1 >= 5 THEN 3
           WHEN no_show_count + 1 >= 3 THEN 2
           WHEN no_show_count + 1 >= 2 THEN 1
           ELSE 0
         END,
         penalty_expires_at = CASE
           WHEN no_show_count + 1 >= 5 AND penalty_level < 3
             THEN NOW() + INTERVAL '7 days'
           ELSE penalty_expires_at
         END
     WHERE patient_id = $1`,
    [appt.patientId]
  )
}

async function notifyWaitlist(app: FastifyInstance, slotId: string) {
  const { rows: [next] } = await app.db.query<{ id: string; userId: string }>(
    `SELECT w.id, p.user_id AS "userId"
     FROM waitlist w
     JOIN patients p ON w.patient_id = p.id
     WHERE w.slot_id = $1 AND w.notified = false
     ORDER BY w.position
     LIMIT 1`,
    [slotId]
  )
  if (!next) return
  await app.db.query(`UPDATE waitlist SET notified = true WHERE id = $1`, [next.id])
  app.io.to(`user:${next.userId}`).emit('waitlist_available', { slotId })
}

function buildAppointmentDate(slotDate: string, slotHour: number): Date {
  // Parse date components to avoid UTC midnight shift
  const [y, m, d] = slotDate.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d, slotHour, 0, 0, 0)
}
