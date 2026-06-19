import type { FastifyInstance } from 'fastify'
import type { User } from '@repo/types'

export interface BanAccountInput {
  userId: string
  reason: string
  expiresAt?: string // ISO date string, undefined for permanent
}

export interface StatisticsData {
  period: string
  startDate: string
  endDate: string
  activeDoctor: number
  registeredPatients: number
  tokensIssued: number
  appointmentsCompleted: number
  appointmentsCancelled: number
  appointmentNoShows: number
  totalClinics: number
  platformErrors: number
  trend?: Array<{
    date: string
    activeDoctor: number
    registeredPatients: number
    tokensIssued: number
    appointmentsCompleted: number
  }>
}

export async function banAccount(
  app: FastifyInstance,
  input: BanAccountInput,
  bannedByUserId: string
): Promise<void> {
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
  const isPermanent = expiresAt === null

  await app.db.query(
    `INSERT INTO account_bans (user_id, reason, banned_by, expires_at, is_permanent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       reason = EXCLUDED.reason,
       expires_at = EXCLUDED.expires_at,
       is_permanent = EXCLUDED.is_permanent,
       banned_at = NOW()`,
    [input.userId, input.reason, bannedByUserId, expiresAt, isPermanent]
  )

  // Log to system audit
  await logAuditEvent(app, bannedByUserId, 'account_banned', 'account', input.userId, null, {
    reason: input.reason,
    isPermanent,
    expiresAt: expiresAt?.toISOString(),
  })
}

export async function unbanAccount(app: FastifyInstance, userId: string, unbannedByUserId: string): Promise<void> {
  const result = await app.db.query('DELETE FROM account_bans WHERE user_id = $1 RETURNING id', [userId])

  if (result.rows.length > 0) {
    await logAuditEvent(app, unbannedByUserId, 'account_unbanned', 'account', userId, null, {})
  }
}

export async function getBannedAccounts(
  app: FastifyInstance,
  limit: number = 50,
  offset: number = 0
): Promise<{ bans: any[]; total: number }> {
  const { rows: bans } = await app.db.query(
    `SELECT ab.id, ab.user_id, ab.reason, ab.banned_at, ab.expires_at, ab.is_permanent,
            u.email, u.full_name AS "fullName", u.role
     FROM account_bans ab
     JOIN users u ON ab.user_id = u.id
     ORDER BY ab.banned_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )

  const { rows: countRows } = await app.db.query('SELECT COUNT(*) as total FROM account_bans')
  const total = countRows[0]?.total ?? 0

  return { bans, total }
}

export async function changeUserRole(
  app: FastifyInstance,
  userId: string,
  newRole: string,
  changedByUserId: string
): Promise<User> {
  // Get current role
  const { rows: currentRows } = await app.db.query('SELECT role FROM users WHERE id = $1', [userId])
  const oldRole = currentRows[0]?.role

  const { rows: updated } = await app.db.query<User>(
    `UPDATE users SET role = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, email, phone, full_name AS "fullName", role, avatar_url AS "avatarUrl",
               is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [newRole, userId]
  )

  if (updated.length === 0) throw new Error('User not found')

  const user = updated[0]!

  // Log role change
  await logAuditEvent(app, changedByUserId, 'role_change', 'user', userId, { role: oldRole }, { role: newRole })

  return user
}

export async function getPlatformStatistics(app: FastifyInstance, period: string): Promise<StatisticsData> {
  const now = new Date()
  let startDate: Date
  let endDate: Date

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      endDate = new Date()
      break
    case 'lastWeek':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      endDate = new Date()
      break
    case 'lastMonth':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      endDate = new Date()
      break
    case 'last2Months':
      startDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
      endDate = new Date()
      break
    case 'all':
      startDate = new Date('2000-01-01')
      endDate = new Date()
      break
    default:
      throw new Error('Invalid period')
  }

  const formattedStartDate = startDate.toISOString().split('T')[0]
  const formattedEndDate = endDate.toISOString().split('T')[0]

  // Get aggregated data from statistics table
  const { rows: statsRows } = await app.db.query(
    `SELECT
       SUM(active_doctors) as active_doctor,
       SUM(registered_patients) as registered_patients,
       SUM(tokens_issued) as tokens_issued,
       SUM(appointments_completed) as appointments_completed,
       SUM(appointments_cancelled) as appointments_cancelled,
       SUM(appointment_no_shows) as appointment_no_shows,
       AVG(total_clinics)::INT as total_clinics,
       SUM(error_count) as platform_errors
     FROM statistics
     WHERE stat_date BETWEEN $1::DATE AND $2::DATE`,
    [formattedStartDate, formattedEndDate]
  )

  const stats = statsRows[0] || {}

  // Get daily trend
  const { rows: trendRows } = await app.db.query(
    `SELECT
       stat_date as date,
       active_doctors as active_doctor,
       registered_patients,
       tokens_issued,
       appointments_completed
     FROM statistics
     WHERE stat_date BETWEEN $1::DATE AND $2::DATE
     ORDER BY stat_date ASC`,
    [formattedStartDate, formattedEndDate]
  )

  return {
    period,
    startDate: formattedStartDate,
    endDate: formattedEndDate,
    activeDoctor: stats.active_doctor ?? 0,
    registeredPatients: stats.registered_patients ?? 0,
    tokensIssued: stats.tokens_issued ?? 0,
    appointmentsCompleted: stats.appointments_completed ?? 0,
    appointmentsCancelled: stats.appointments_cancelled ?? 0,
    appointmentNoShows: stats.appointment_no_shows ?? 0,
    totalClinics: stats.total_clinics ?? 0,
    platformErrors: stats.platform_errors ?? 0,
    trend: trendRows.map((row) => ({
      date: row.date,
      activeDoctor: row.active_doctor,
      registeredPatients: row.registered_patients,
      tokensIssued: row.tokens_issued,
      appointmentsCompleted: row.appointments_completed,
    })),
  }
}

export async function getAuditLogs(
  app: FastifyInstance,
  filters: {
    userId?: string
    action?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  }
): Promise<{ logs: any[]; total: number }> {
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0
  const conditions: string[] = []
  const params: any[] = []

  let paramIndex = 1
  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex++}`)
    params.push(filters.userId)
  }
  if (filters.action) {
    conditions.push(`action = $${paramIndex++}`)
    params.push(filters.action)
  }
  if (filters.startDate) {
    conditions.push(`created_at >= $${paramIndex++}::TIMESTAMPTZ`)
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    conditions.push(`created_at <= $${paramIndex++}::TIMESTAMPTZ`)
    params.push(filters.endDate)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const { rows: logs } = await app.db.query(
    `SELECT id, user_id, action, resource, resource_id, old_value, new_value, ip_address, created_at
     FROM system_audit_log
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  )

  const { rows: countRows } = await app.db.query(
    `SELECT COUNT(*) as total FROM system_audit_log ${whereClause}`,
    params
  )
  const total = countRows[0]?.total ?? 0

  return { logs, total }
}

export async function getLoginAuditLogs(
  app: FastifyInstance,
  filters: {
    email?: string
    userId?: string
    status?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  }
): Promise<{ logs: any[]; total: number }> {
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0
  const conditions: string[] = []
  const params: any[] = []

  let paramIndex = 1
  if (filters.email) {
    conditions.push(`email = $${paramIndex++}`)
    params.push(filters.email)
  }
  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex++}`)
    params.push(filters.userId)
  }
  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`)
    params.push(filters.status)
  }
  if (filters.startDate) {
    conditions.push(`created_at >= $${paramIndex++}::TIMESTAMPTZ`)
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    conditions.push(`created_at <= $${paramIndex++}::TIMESTAMPTZ`)
    params.push(filters.endDate)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const { rows: logs } = await app.db.query(
    `SELECT id, user_id, email, role, ip_address, user_agent, status, created_at
     FROM login_audit_log
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  )

  const { rows: countRows } = await app.db.query(
    `SELECT COUNT(*) as total FROM login_audit_log ${whereClause}`,
    params
  )
  const total = countRows[0]?.total ?? 0

  return { logs, total }
}

export async function setMaintenanceMode(
  app: FastifyInstance,
  enabled: boolean,
  message: string,
  estimatedDowntimeMinutes: number,
  updatedByUserId: string
): Promise<void> {
  const value = {
    enabled,
    message,
    estimated_downtime_minutes: estimatedDowntimeMinutes,
    updated_at: new Date().toISOString(),
  }

  // Get old value for audit
  const { rows: oldRows } = await app.db.query('SELECT value FROM system_settings WHERE key = $1', [
    'maintenance_mode',
  ])
  const oldValue = oldRows[0]?.value

  await app.db.query(
    `UPDATE system_settings SET value = $1, updated_by = $2, updated_at = NOW()
     WHERE key = 'maintenance_mode'`,
    [JSON.stringify(value), updatedByUserId]
  )

  // Log settings change
  await logAuditEvent(
    app,
    updatedByUserId,
    'settings_updated',
    'system_settings',
    null,
    oldValue,
    value
  )
}

export async function getSystemSettings(app: FastifyInstance): Promise<any> {
  const { rows } = await app.db.query('SELECT key, value FROM system_settings ORDER BY key ASC')
  const settings: Record<string, any> = {}
  rows.forEach((row) => {
    settings[row.key] = row.value
  })
  return settings
}

export async function logAuditEvent(
  app: FastifyInstance,
  userId: string,
  action: string,
  resource: string,
  resourceId: string | null,
  oldValue: any,
  newValue: any,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<void> {
  try {
    await app.db.query(
      `INSERT INTO system_audit_log (user_id, action, resource, resource_id, old_value, new_value, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        action,
        resource,
        resourceId,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        ipAddress ?? null,
        userAgent ?? null,
      ]
    )
  } catch (err) {
    app.log.warn({ err }, 'Failed to log audit event')
  }
}

export async function isAccountBanned(app: FastifyInstance, userId: string): Promise<boolean> {
  const { rows } = await app.db.query(
    `SELECT 1 FROM account_bans
     WHERE user_id = $1 AND (is_permanent = true OR expires_at > NOW())`,
    [userId]
  )
  return rows.length > 0
}

export async function getSystemAdmin(app: FastifyInstance, userId: string): Promise<any> {
  const { rows: users } = await app.db.query(
    `SELECT id, email, phone, full_name AS "fullName", role, avatar_url AS "avatarUrl", is_active AS "isActive", created_at AS "createdAt"
     FROM users
     WHERE id = $1 AND role = 'system_admin'`,
    [userId]
  )
  return users[0]
}

export async function getAllSystemAdmins(app: FastifyInstance, limit: number = 50, offset: number = 0): Promise<any> {
  const { rows: users } = await app.db.query(
    `SELECT id, email, phone, full_name AS "fullName", role, avatar_url AS "avatarUrl", is_active AS "isActive", created_at AS "createdAt"
     FROM users
     WHERE role = 'system_admin'
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )

  const { rows: countRows } = await app.db.query('SELECT COUNT(*) as total FROM users WHERE role = $1', [
    'system_admin',
  ])
  const total = countRows[0]?.total ?? 0

  return { users, total }
}
