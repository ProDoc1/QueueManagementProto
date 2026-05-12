import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import type { RegisterInput, StaffRegisterInput, LoginInput } from '@repo/schemas'
import type { User } from '@repo/types'

// Roles that can self-register. Doctors/receptionists must be created by admin.
const SELF_REGISTER_ROLES = ['patient'] as const

export async function registerUser(app: FastifyInstance, input: RegisterInput): Promise<{ user: User; accessToken: string; refreshToken: string }> {
  if (!SELF_REGISTER_ROLES.includes(input.role as typeof SELF_REGISTER_ROLES[number])) {
    throw Object.assign(
      new Error('Doctors and receptionists must be created by an administrator'),
      { statusCode: 403 }
    )
  }

  const existing = await app.db.query('SELECT id FROM users WHERE email = $1', [input.email])
  if (existing.rowCount && existing.rowCount > 0) {
    throw Object.assign(new Error('Email already registered'), { statusCode: 409 })
  }

  const passwordHash = await bcrypt.hash(input.password, 12)
  const userId = uuidv4()

  const { rows } = await app.db.query<User>(
    `INSERT INTO users (id, email, password_hash, phone, full_name, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, phone, full_name AS "fullName", role, avatar_url AS "avatarUrl",
               is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [userId, input.email, passwordHash, input.phone ?? null, input.fullName, 'patient']
  )
  const user = rows[0]!

  const patientId = uuidv4()
  await app.db.query(`INSERT INTO patients (id, user_id) VALUES ($1, $2)`, [patientId, userId])
  await app.db.query(
    `INSERT INTO penalty_profiles (id, patient_id) VALUES ($1, $2)`,
    [uuidv4(), patientId]
  )

  const tokens = await issueTokens(app, user)
  return { user, ...tokens }
}

/** Admin-only: create a doctor or receptionist account */
export async function createStaffUser(app: FastifyInstance, input: StaffRegisterInput): Promise<User> {
  const existing = await app.db.query('SELECT id FROM users WHERE email = $1', [input.email])
  if (existing.rowCount && existing.rowCount > 0) {
    throw Object.assign(new Error('Email already registered'), { statusCode: 409 })
  }

  const passwordHash = await bcrypt.hash(input.password, 12)
  const userId = uuidv4()

  const { rows } = await app.db.query<User>(
    `INSERT INTO users (id, email, password_hash, phone, full_name, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, phone, full_name AS "fullName", role, avatar_url AS "avatarUrl",
               is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [userId, input.email, passwordHash, input.phone ?? null, input.fullName, input.role]
  )
  const user = rows[0]!

  if (input.role === 'doctor') {
    await app.db.query(
      `INSERT INTO doctors (id, user_id, specialization, license_number, slots_per_hour, working_hours)
       VALUES ($1, $2, 'General Practice', $3, 4, '{}')`,
      [uuidv4(), userId, input.licenseNumber ?? `LIC-${uuidv4().slice(0, 8).toUpperCase()}`]
    )
  }

  return user
}

export async function loginUser(app: FastifyInstance, input: LoginInput): Promise<{ user: User; accessToken: string; refreshToken: string }> {
  const { rows } = await app.db.query(
    `SELECT id, email, password_hash, phone, full_name AS "fullName", role,
            avatar_url AS "avatarUrl", is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users WHERE email = $1`,
    [input.email]
  )
  const row = rows[0] as (User & { password_hash: string }) | undefined
  if (!row) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 })

  const valid = await bcrypt.compare(input.password, row.password_hash)
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 })

  if (!row.isActive) throw Object.assign(new Error('Account suspended'), { statusCode: 403 })

  const { password_hash: _, ...user } = row
  const tokens = await issueTokens(app, user as User)
  return { user: user as User, ...tokens }
}

/**
 * Issues access + refresh tokens.
 * Each token has a unique jti so multiple devices can hold independent sessions.
 * Stored as refresh:{userId}:{jti} → hash to support per-session revocation.
 */
async function issueTokens(app: FastifyInstance, user: User) {
  const jti = uuidv4()

  const accessToken = app.jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    { expiresIn: '15m' }
  )
  const refreshToken = app.jwt.sign(
    { sub: user.id, role: user.role, email: user.email, type: 'refresh', jti },
    { expiresIn: '7d' }
  )

  // SHA-256 is sufficient for high-entropy JWTs; bcrypt(8) is unnecessarily slow here
  const hash = await bcrypt.hash(refreshToken, 8)
  const sessionKey = `refresh:${user.id}:${jti}`
  const sessionSetKey = `refresh_sessions:${user.id}`

  await app.redis.setEx(sessionKey, 7 * 24 * 3600, hash)
  await app.redis.sAdd(sessionSetKey, jti)
  await app.redis.expire(sessionSetKey, 7 * 24 * 3600)

  return { accessToken, refreshToken }
}

export async function refreshTokens(app: FastifyInstance, refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  let payload: { sub: string; role: string; email: string; type: string; jti: string }
  try {
    payload = app.jwt.verify(refreshToken) as typeof payload
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 })
  }

  if (payload.type !== 'refresh') throw Object.assign(new Error('Invalid token type'), { statusCode: 401 })

  const sessionKey = `refresh:${payload.sub}:${payload.jti}`
  const stored = await app.redis.get(sessionKey)
  if (!stored) throw Object.assign(new Error('Session expired or already used'), { statusCode: 401 })

  const valid = await bcrypt.compare(refreshToken, stored)
  if (!valid) throw Object.assign(new Error('Token reuse detected — all sessions revoked'), { statusCode: 401 })

  // Revoke old token before issuing new one (rotation)
  await app.redis.del(sessionKey)
  await app.redis.sRem(`refresh_sessions:${payload.sub}`, payload.jti)

  const { rows } = await app.db.query<User>(
    `SELECT id, email, role FROM users WHERE id = $1 AND is_active = true`,
    [payload.sub]
  )
  const user = rows[0]
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 401 })

  return issueTokens(app, user)
}

export async function logoutUser(app: FastifyInstance, userId: string, jti?: string) {
  if (jti) {
    // Logout current session only
    await app.redis.del(`refresh:${userId}:${jti}`)
    await app.redis.sRem(`refresh_sessions:${userId}`, jti)
  } else {
    // Logout all sessions (e.g. "sign out everywhere")
    const jtis = await app.redis.sMembers(`refresh_sessions:${userId}`)
    if (jtis.length > 0) {
      await app.redis.del(jtis.map((j) => `refresh:${userId}:${j}`))
    }
    await app.redis.del(`refresh_sessions:${userId}`)
  }
}
