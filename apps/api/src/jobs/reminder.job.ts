import type { FastifyInstance } from 'fastify'

/**
 * Runs every 30 minutes.
 * Sends reminders 24hr and 2hr before appointments via SMS/email.
 * Uses a Redis flag to avoid double-sending.
 */
export async function runReminderJob(app: FastifyInstance) {
  const windows = [
    { hours: 24, label: '24h' },
    { hours: 2, label: '2h' },
  ]

  for (const { hours, label } of windows) {
    const { rows } = await app.db.query(
      `SELECT a.id, a.appointment_date AS "appointmentDate",
              u.email, u.phone, u.full_name AS "patientName",
              du.full_name AS "doctorName"
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN users u ON p.user_id = u.id
       JOIN doctors d ON a.doctor_id = d.id
       JOIN users du ON d.user_id = du.id
       WHERE a.status IN ('scheduled','confirmed')
         AND a.appointment_date BETWEEN NOW() + INTERVAL '${hours - 0.5} hours'
             AND NOW() + INTERVAL '${hours + 0.5} hours'`,
      []
    )

    for (const appt of rows) {
      const dedupKey = `reminder:${appt.id}:${label}`
      const sent = await app.redis.get(dedupKey)
      if (sent) continue

      app.log.info(`Reminder [${label}]: ${appt.patientName} — ${appt.doctorName} at ${appt.appointmentDate}`)
      // TODO: send via Resend (email) + Twilio (SMS)

      await app.redis.setEx(dedupKey, 2 * 3600, '1')
    }
  }
}

export function startReminderJob(app: FastifyInstance) {
  const INTERVAL_MS = 30 * 60 * 1000
  setInterval(() => {
    runReminderJob(app).catch((err) => app.log.error(err, 'reminder.job failed'))
  }, INTERVAL_MS)
}
