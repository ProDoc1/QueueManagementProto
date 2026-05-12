import type { FastifyInstance } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import type { AddWalkInInput } from '@repo/schemas'
import type { WalkInQueueEntry } from '@repo/types'

const AVG_CONSULTATION_MINUTES = 15

export async function addWalkIn(app: FastifyInstance, input: AddWalkInInput): Promise<WalkInQueueEntry> {
  const today = new Date().toISOString().split('T')[0]!

  const client = await app.db.connect()
  try {
    await client.query('BEGIN')

    // Advisory lock serializes queue number assignment per (doctor, date)
    // hashtext produces a stable int32 from a string
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [`queue:${input.doctorId}:${today}`]
    )

    const { rows: [seq] } = await client.query<{ nextNum: number }>(
      `SELECT COALESCE(MAX(queue_number), 0) + 1 AS "nextNum"
       FROM walk_in_queue
       WHERE doctor_id = $1 AND queue_date = $2`,
      [input.doctorId, today]
    )
    const queueNumber = seq?.nextNum ?? 1

    const { rows: [ahead] } = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM walk_in_queue
       WHERE doctor_id = $1 AND queue_date = $2 AND status = 'waiting'`,
      [input.doctorId, today]
    )
    const estimatedWait = parseInt(ahead?.count ?? '0') * AVG_CONSULTATION_MINUTES

    const { rows: [entry] } = await client.query<WalkInQueueEntry>(
      `INSERT INTO walk_in_queue
         (id, patient_name, patient_id, doctor_id, clinic_id, queue_date, queue_number,
          status, sms_phone, estimated_wait_minutes, checked_in_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'waiting', $8, $9, NOW())
       RETURNING id, patient_name AS "patientName", patient_id AS "patientId",
                 doctor_id AS "doctorId", clinic_id AS "clinicId",
                 queue_date AS "queueDate", queue_number AS "queueNumber",
                 status, sms_phone AS "smsPhone",
                 estimated_wait_minutes AS "estimatedWaitMinutes",
                 checked_in_at AS "checkedInAt"`,
      [uuidv4(), input.patientName, input.patientId ?? null, input.doctorId,
       input.clinicId ?? null, today, queueNumber, input.smsPhone ?? null, estimatedWait]
    )

    await client.query('COMMIT')

    // Broadcast to clinic room (keyed by clinicId) AND doctor-specific room as fallback
    if (input.clinicId) await broadcastQueueUpdate(app, input.clinicId, input.doctorId)
    await broadcastQueueUpdate(app, input.doctorId, input.doctorId, true)

    if (input.smsPhone) {
      sendQueueSms(app, input.smsPhone, queueNumber, estimatedWait, input.doctorId).catch((err) => {
        app.log.warn({ err, phone: input.smsPhone }, 'queue check-in SMS failed')
      })
    }

    return entry!
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Transitions:
 *   Current 'called' patient → 'in_progress' (they've entered the room)
 *   Next 'waiting' patient  → 'called'       (they're being summoned)
 */
export async function callNextPatient(app: FastifyInstance, doctorId: string, clinicId?: string) {
  const today = new Date().toISOString().split('T')[0]!

  // Move currently-called patient to in_progress
  await app.db.query(
    `UPDATE walk_in_queue SET status = 'in_progress'
     WHERE doctor_id = $1 AND queue_date = $2 AND status = 'called'`,
    [doctorId, today]
  )

  const { rows: [next] } = await app.db.query<WalkInQueueEntry>(
    `UPDATE walk_in_queue SET status = 'called', called_at = NOW()
     WHERE id = (
       SELECT id FROM walk_in_queue
       WHERE doctor_id = $1 AND queue_date = $2 AND status = 'waiting'
       ORDER BY queue_number LIMIT 1
     )
     RETURNING id, patient_name AS "patientName", queue_number AS "queueNumber",
               sms_phone AS "smsPhone", status`,
    [doctorId, today]
  )

  if (!next) return null

  if (clinicId) await broadcastQueueUpdate(app, clinicId, doctorId)
  await broadcastQueueUpdate(app, doctorId, doctorId, true)

  if (next.smsPhone) {
    sendCallSms(app, next.smsPhone, next.queueNumber, next.patientName).catch((err) => {
      app.log.warn({ err, phone: next.smsPhone }, 'queue call SMS failed')
    })
  }

  return next
}

export async function completeCurrentPatient(app: FastifyInstance, doctorId: string, clinicId?: string) {
  const today = new Date().toISOString().split('T')[0]!
  await app.db.query(
    `UPDATE walk_in_queue SET status = 'completed'
     WHERE doctor_id = $1 AND queue_date = $2 AND status = 'in_progress'`,
    [doctorId, today]
  )
  if (clinicId) await broadcastQueueUpdate(app, clinicId, doctorId)
  await broadcastQueueUpdate(app, doctorId, doctorId, true)
}

export async function getTodayQueue(app: FastifyInstance, doctorId: string): Promise<WalkInQueueEntry[]> {
  const today = new Date().toISOString().split('T')[0]!
  const { rows } = await app.db.query<WalkInQueueEntry>(
    `SELECT id, patient_name AS "patientName", patient_id AS "patientId",
            queue_number AS "queueNumber", status,
            estimated_wait_minutes AS "estimatedWaitMinutes",
            checked_in_at AS "checkedInAt", called_at AS "calledAt"
     FROM walk_in_queue
     WHERE doctor_id = $1 AND queue_date = $2
     ORDER BY queue_number`,
    [doctorId, today]
  )
  return rows
}

async function broadcastQueueUpdate(app: FastifyInstance, roomId: string, doctorId: string, isDoctorRoom = false) {
  const today = new Date().toISOString().split('T')[0]!

  const { rows: [summary] } = await app.db.query<{
    currentNumber: number | null; waitingCount: string
  }>(
    `SELECT
       (SELECT queue_number FROM walk_in_queue
        WHERE doctor_id = $1 AND queue_date = $2 AND status IN ('called','in_progress')
        ORDER BY called_at DESC LIMIT 1) AS "currentNumber",
       (SELECT COUNT(*)::text FROM walk_in_queue
        WHERE doctor_id = $1 AND queue_date = $2 AND status = 'waiting') AS "waitingCount"`,
    [doctorId, today]
  )

  const room = isDoctorRoom ? `doctor_queue:${roomId}` : `clinic_queue:${roomId}`
  app.io.to(room).emit('queue_update', {
    clinicId: roomId,
    doctorId,
    currentNumber: summary?.currentNumber ?? null,
    waitingCount: parseInt(summary?.waitingCount ?? '0'),
  })
}

async function sendQueueSms(app: FastifyInstance, phone: string, queueNumber: number, waitMinutes: number, doctorId: string) {
  const { rows: [doctor] } = await app.db.query(
    `SELECT u.full_name, COALESCE(dl.clinic_name, 'the clinic') AS clinic_name
     FROM doctors d
     JOIN users u ON d.user_id = u.id
     LEFT JOIN doctor_locations dl ON dl.doctor_id = d.id
     WHERE d.id = $1`,
    [doctorId]
  )
  const doctorName = doctor?.full_name ?? 'your doctor'
  const clinic = doctor?.clinic_name ?? 'the clinic'
  app.log.info({ phone, queueNumber, waitMinutes },
    `SMS [queue check-in]: Queue #${queueNumber} at ${clinic} (Dr. ${doctorName}). Est. wait: ${waitMinutes} min.`)
  // TODO: Twilio — twilio.messages.create({ to: phone, from: TWILIO_FROM, body: `...` })
}

async function sendCallSms(app: FastifyInstance, phone: string, queueNumber: number, patientName: string) {
  app.log.info({ phone, queueNumber, patientName },
    `SMS [queue called]: ${patientName}, Queue #${queueNumber} — please proceed to the consultation room now.`)
  // TODO: Twilio
}
