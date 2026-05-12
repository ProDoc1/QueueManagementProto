import type { FastifyInstance } from 'fastify'

/**
 * Runs at end of day (midnight).
 * Archives walk-in queue entries older than today that are still 'waiting'.
 * Marks them as 'left' — they physically left without being seen.
 */
export async function runQueueCleanJob(app: FastifyInstance) {
  const { rowCount } = await app.db.query(
    `UPDATE walk_in_queue SET status = 'left'
     WHERE status = 'waiting' AND queue_date < CURRENT_DATE`,
    []
  )
  app.log.info(`queue-clean.job: archived ${rowCount} stale queue entries`)
}

export function startQueueCleanJob(app: FastifyInstance) {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  const msUntilMidnight = midnight.getTime() - now.getTime()

  setTimeout(() => {
    runQueueCleanJob(app).catch((err) => app.log.error(err, 'queue-clean.job failed'))
    setInterval(() => {
      runQueueCleanJob(app).catch((err) => app.log.error(err, 'queue-clean.job failed'))
    }, 24 * 3600 * 1000)
  }, msUntilMidnight)
}
