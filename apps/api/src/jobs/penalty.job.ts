import type { FastifyInstance } from 'fastify'

/**
 * Runs every 15 minutes.
 * 1. Marks overdue 'scheduled'/'confirmed' appointments as 'no_show' and applies penalties.
 * 2. Clears penalties for patients who have had 60+ days of no infractions (good behaviour).
 * Idempotent: filtered to status = 'scheduled' OR 'confirmed' so re-runs are safe.
 */
export async function runPenaltyJob(app: FastifyInstance) {
  app.log.info('penalty.job: running')

  // Step 1: detect no-shows and apply penalty in a single atomic statement per patient
  const { rows: noShows } = await app.db.query<{ patientId: string }>(
    `UPDATE appointments
     SET status = 'no_show', updated_at = NOW()
     WHERE status IN ('scheduled', 'confirmed')
       AND appointment_date < NOW() - INTERVAL '30 minutes'
     RETURNING patient_id AS "patientId"`,
    []
  )

  if (noShows.length > 0) {
    app.log.info(`penalty.job: marked ${noShows.length} appointments as no_show`)

    // Deduplicate patients (same patient may have multiple appointments in the window)
    const uniquePatients = [...new Set(noShows.map((r) => r.patientId))]
    for (const patientId of uniquePatients) {
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
        [patientId]
      )
    }
  }

  // Step 2: 60-day good-behaviour cooldown — fully clear penalty for patients with no recent infractions
  const { rowCount: cleared } = await app.db.query(
    `UPDATE penalty_profiles
     SET penalty_level      = 0,
         no_show_count      = 0,
         late_cancel_count  = 0,
         penalty_expires_at = NULL,
         last_infraction_at = NULL,
         updated_at         = NOW()
     WHERE penalty_level > 0
       AND (penalty_expires_at IS NULL OR penalty_expires_at < NOW())
       AND last_infraction_at IS NOT NULL
       AND last_infraction_at < NOW() - INTERVAL '60 days'`,
    []
  )
  if (cleared && cleared > 0) {
    app.log.info(`penalty.job: cleared penalties for ${cleared} patients (60-day good behaviour)`)
  }
}

export function startPenaltyJob(app: FastifyInstance) {
  const INTERVAL_MS = 15 * 60 * 1000
  const timer = setInterval(() => {
    runPenaltyJob(app).catch((err) => app.log.error(err, 'penalty.job failed'))
  }, INTERVAL_MS)

  app.addHook('onClose', async () => clearInterval(timer))
}
