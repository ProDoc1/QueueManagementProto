import type { FastifyInstance } from 'fastify'
import { RegisterSchema, StaffRegisterSchema, LoginSchema } from '@repo/schemas'
import { registerUser, loginUser, refreshTokens, logoutUser, createStaffUser } from './auth.service.js'

const COOKIE_OPTS = (app: FastifyInstance) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
})

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const input = RegisterSchema.parse(request.body)
    const result = await registerUser(app, input)
    reply.setCookie('refreshToken', result.refreshToken, COOKIE_OPTS(app))
    return reply.code(201).send({ user: result.user, accessToken: result.accessToken })
  })

  app.post('/login', async (request, reply) => {
    const input = LoginSchema.parse(request.body)
    const result = await loginUser(app, input)
    reply.setCookie('refreshToken', result.refreshToken, COOKIE_OPTS(app))
    return { user: result.user, accessToken: result.accessToken }
  })

  app.post('/refresh', async (request, reply) => {
    const token = request.cookies.refreshToken
    if (!token) return reply.code(401).send({ error: 'No refresh token' })
    const result = await refreshTokens(app, token)
    reply.setCookie('refreshToken', result.refreshToken, COOKIE_OPTS(app))
    return { accessToken: result.accessToken }
  })

  // Logout current session only (jti extracted from cookie token)
  app.post('/logout', { preHandler: app.authenticate }, async (request, reply) => {
    const token = request.cookies.refreshToken
    let jti: string | undefined
    try {
      if (token) {
        const payload = app.jwt.verify(token) as { jti?: string }
        jti = payload.jti
      }
    } catch { /* token may already be expired — still clear it */ }

    await logoutUser(app, request.jwtUser.sub, jti)
    reply.clearCookie('refreshToken', { path: '/api/auth' })
    return { success: true }
  })

  // Sign out all sessions across all devices
  app.post('/logout-all', { preHandler: app.authenticate }, async (request, reply) => {
    await logoutUser(app, request.jwtUser.sub)
    reply.clearCookie('refreshToken', { path: '/api/auth' })
    return { success: true }
  })

  app.get('/me', { preHandler: app.authenticate }, async (request) => {
    const { rows } = await app.db.query(
      `SELECT id, email, phone, full_name AS "fullName", role, avatar_url AS "avatarUrl",
              is_active AS "isActive", created_at AS "createdAt"
       FROM users WHERE id = $1`,
      [request.jwtUser.sub]
    )
    return rows[0] ?? null
  })

  // Admin-only: create doctor or receptionist accounts
  app.post('/staff', { preHandler: app.requireRole(['admin']) }, async (request, reply) => {
    const input = StaffRegisterSchema.parse(request.body)
    const user = await createStaffUser(app, input)
    return reply.code(201).send(user)
  })
}
