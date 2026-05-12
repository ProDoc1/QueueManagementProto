import type { FastifyInstance } from 'fastify'
import type { PenaltyLevel } from '@repo/types'

const SUSPENSION_DAYS = 7
const LATE_CANCEL_WINDOW_HOURS = 2

export function computePenaltyLevel(noShowCount: number, lateCancelCount: number): PenaltyLevel {
  if (noShowCount >= 5) return 3
  if (noShowCount >= 3 || lateCancelCount >= 5) return 2
  if (noShowCount >= 2 || lateCancelCount >= 3) return 1
  return 0
}

/**
 * Atomically increments no_show_count and recomputes penalty_level in one statement
 * to eliminate the race between two concurrent no-shows computing level off the same value.
 */
export async function recordNoShow(app: FastifyInstance, patientId: string) {
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
             THEN NOW() + INTERVAL '${SUSPENSION_DAYS} days'
           ELSE penalty_expires_at
         END
     WHERE patient_id = $1`,
    [patientId]
  )
}

/**
 * Atomically increments late_cancel_count and recomputes penalty_level in one statement.
 */
export async function recordLateCancel(app: FastifyInstance, patientId: string) {
  await app.db.query(
    `UPDATE penalty_profiles
     SET late_cancel_count  = late_cancel_count + 1,
         last_infraction_at = NOW(),
         last_evaluated_at  = NOW(),
         updated_at         = NOW(),
         penalty_level      = CASE
           WHEN no_show_count >= 5 THEN 3
           WHEN no_show_count >= 3 OR late_cancel_count + 1 >= 5 THEN 2
           WHEN no_show_count >= 2 OR late_cancel_count + 1 >= 3 THEN 1
           ELSE 0
         END
     WHERE patient_id = $1`,
    [patientId]
  )
}

export async function getPatientPenalty(app: FastifyInstance, patientId: string) {
  const { rows: [profile] } = await app.db.query(
    `SELECT penalty_level AS "penaltyLevel", penalty_expires_at AS "penaltyExpiresAt",
            no_show_count AS "noShowCount", late_cancel_count AS "lateCancelCount"
     FROM penalty_profiles WHERE patient_id = $1`,
    [patientId]
  )
  if (!profile) return { penaltyLevel: 0 as PenaltyLevel, penaltyExpiresAt: null, noShowCount: 0, lateCancelCount: 0 }

  // Auto-downgrade: 7-day suspension has expired → restore to level 2 (counts still warrant it)
  if (profile.penaltyLevel === 3 && profile.penaltyExpiresAt && new Date(profile.penaltyExpiresAt) < new Date()) {
    const { rows: [updated] } = await app.db.query(
      `UPDATE penalty_profiles
       SET penalty_level = 2, penalty_expires_at = NULL, updated_at = NOW()
       WHERE patient_id = $1
       RETURNING penalty_level AS "penaltyLevel", penalty_expires_at AS "penaltyExpiresAt",
                 no_show_count AS "noShowCount", late_cancel_count AS "lateCancelCount"`,
      [patientId]
    )
    return updated ?? profile
  }

  return profile
}

export async function resetPenalty(app: FastifyInstance, patientId: string) {
  await app.db.query(
    `UPDATE penalty_profiles
     SET penalty_level      = 0,
         no_show_count      = 0,
         late_cancel_count  = 0,
         penalty_expires_at = NULL,
         last_infraction_at = NULL,
         updated_at         = NOW()
     WHERE patient_id = $1`,
    [patientId]
  )
}

/**
 * Returns true only if the appointment is in the future but within the late-cancel window.
 * Past appointments are handled by the no-show job — not double-counted here.
 */
export function isLateCancellation(appointmentDate: string): boolean {
  const hoursUntil = (new Date(appointmentDate).getTime() - Date.now()) / 3_600_000
  return hoursUntil >= 0 && hoursUntil < LATE_CANCEL_WINDOW_HOURS
}
