import type { FastifyInstance } from 'fastify'
import { generateSlotsForDateRange } from '../modules/appointments/slots.service.js'

/**
 * Runs weekly (Sunday midnight).
 * Auto-generates doctor slots for the upcoming 2 weeks based on working_hours.
 * Idempotent — ON CONFLICT DO NOTHING in generateSlotsForDateRange.
 */
export async function runSlotGeneratorJob(app: FastifyInstance) {
  app.log.info('slot-generator.job: running')

  const { rows: doctors } = await app.db.query(
    `SELECT id FROM doctors WHERE is_available = true`,
    []
  )

  const today = new Date()
  const fromDate = today.toISOString().split('T')[0]!
  const toDate = new Date(today.getTime() + 14 * 86400_000).toISOString().split('T')[0]!

  for (const doctor of doctors) {
    await generateSlotsForDateRange(app, doctor.id, fromDate, toDate)
  }

  app.log.info(`slot-generator.job: processed ${doctors.length} doctors`)
}

export function startSlotGeneratorJob(app: FastifyInstance) {
  // Run immediately on startup, then weekly
  runSlotGeneratorJob(app).catch((err) => app.log.error(err, 'slot-generator.job failed on startup'))

  const WEEK_MS = 7 * 24 * 3600 * 1000
  setInterval(() => {
    runSlotGeneratorJob(app).catch((err) => app.log.error(err, 'slot-generator.job failed'))
  }, WEEK_MS)
}
