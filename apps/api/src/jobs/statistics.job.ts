import type { FastifyInstance } from 'fastify'
import { CronJob } from 'cron'

export function startStatisticsJob(app: FastifyInstance) {
  // Run daily at midnight UTC
  const job = new CronJob('0 0 * * *', async () => {
    await aggregateStatistics(app)
  })

  job.start()
  app.log.info('Statistics aggregation job started')
}

async function aggregateStatistics(app: FastifyInstance) {
  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayDate = yesterday.toISOString().split('T')[0]

    // Check if already aggregated for today
    const { rows: existing } = await app.db.query('SELECT 1 FROM statistics WHERE stat_date = $1', [
      yesterdayDate,
    ])

    if (existing.length > 0) {
      app.log.info(`Statistics already aggregated for ${yesterdayDate}`)
      return
    }

    // Count active doctors
    const activeDoctors = await app.db.query(
      `SELECT COUNT(*) as count FROM doctors WHERE is_available = true`
    )

    // Count registered patients
    const registeredPatients = await app.db.query(`SELECT COUNT(*) as count FROM patients`)

    // Count appointments created yesterday
    const appointmentsYesterday = await app.db.query(
      `SELECT COUNT(*) as count FROM appointments WHERE created_at::date = $1`,
      [yesterdayDate]
    )

    // Count completed, cancelled, no-show appointments yesterday
    const appointmentsCompleted = await app.db.query(
      `SELECT COUNT(*) as count FROM appointments WHERE status = 'completed' AND created_at::date = $1`,
      [yesterdayDate]
    )

    const appointmentsCancelled = await app.db.query(
      `SELECT COUNT(*) as count FROM appointments WHERE status = 'cancelled' AND created_at::date = $1`,
      [yesterdayDate]
    )

    const appointmentNoShows = await app.db.query(
      `SELECT COUNT(*) as count FROM appointments WHERE status = 'no_show' AND created_at::date = $1`,
      [yesterdayDate]
    )

    // Count total clinics
    const totalClinics = await app.db.query(`SELECT COUNT(*) as count FROM clinics`)

    // Estimate platform errors from logs (for now, just count)
    const errorCount = 0 // This would require structured error logging

    // Insert aggregated data
    await app.db.query(
      `INSERT INTO statistics (stat_date, active_doctors, registered_patients, tokens_issued, appointments_completed, appointments_cancelled, appointment_no_shows, total_clinics, error_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (stat_date) DO UPDATE SET
         active_doctors = EXCLUDED.active_doctors,
         registered_patients = EXCLUDED.registered_patients,
         tokens_issued = EXCLUDED.tokens_issued,
         appointments_completed = EXCLUDED.appointments_completed,
         appointments_cancelled = EXCLUDED.appointments_cancelled,
         appointment_no_shows = EXCLUDED.appointment_no_shows,
         total_clinics = EXCLUDED.total_clinics,
         error_count = EXCLUDED.error_count,
         created_at = NOW()`,
      [
        yesterdayDate,
        activeDoctors.rows[0]?.count ?? 0,
        registeredPatients.rows[0]?.count ?? 0,
        appointmentsYesterday.rows[0]?.count ?? 0,
        appointmentsCompleted.rows[0]?.count ?? 0,
        appointmentsCancelled.rows[0]?.count ?? 0,
        appointmentNoShows.rows[0]?.count ?? 0,
        totalClinics.rows[0]?.count ?? 0,
        errorCount,
      ]
    )

    app.log.info(`Statistics aggregated for ${yesterdayDate}`)
  } catch (err) {
    app.log.error(err, 'Failed to aggregate statistics')
  }
}
