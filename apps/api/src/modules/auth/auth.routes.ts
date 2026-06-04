import type { FastifyInstance } from 'fastify'
import { RegisterSchema, StaffRegisterSchema, LoginSchema } from '@repo/schemas'
import { registerUser, loginUser, refreshTokens, logoutUser, createStaffUser } from './auth.service.js'

const COOKIE_OPTS = (app: FastifyInstance) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
})

// ── Shared schema fragments ────────────────────────────────────────────────────

const AuthBody = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email:    { type: 'string', format: 'email',    example: 'patient@test.com' },
    password: { type: 'string', minLength: 8,       example: 'password123' },
  },
}

const AuthResponse = {
  type: 'object',
  properties: {
    accessToken: { type: 'string', description: 'Short-lived JWT — use as Bearer token' },
    user: { $ref: 'User#' },
  },
}

const Unauthorized = { 401: { $ref: 'UnauthorizedError#' } }

// ── Routes ────────────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance) {

  app.post('/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Register a new patient account',
      security: [],
      body: {
        type: 'object',
        required: ['fullName', 'email', 'password'],
        properties: {
          fullName: { type: 'string', example: 'Kamal Perera' },
          email:    { type: 'string', format: 'email', example: 'kamal@example.com' },
          password: { type: 'string', minLength: 8,    example: 'password123' },
          phone:    { type: 'string', example: '+94771234567' },
        },
      },
      response: {
        201: { description: 'Account created', ...AuthResponse },
        400: { $ref: 'Error#' },
      },
    },
  }, async (request, reply) => {
    const input = RegisterSchema.parse(request.body)
    const result = await registerUser(app, input)
    reply.setCookie('refreshToken', result.refreshToken, COOKIE_OPTS(app))
    return reply.code(201).send({ user: result.user, accessToken: result.accessToken })
  })

  app.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Login — returns access token + sets httpOnly refresh cookie',
      security: [],
      body: AuthBody,
      response: {
        200: { description: 'Login successful', ...AuthResponse },
        401: { $ref: 'UnauthorizedError#' },
      },
    },
  }, async (request, reply) => {
    const input = LoginSchema.parse(request.body)
    const result = await loginUser(app, input)
    reply.setCookie('refreshToken', result.refreshToken, COOKIE_OPTS(app))
    return { user: result.user, accessToken: result.accessToken }
  })

  app.post('/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Rotate refresh token — returns new access token',
      security: [],
      description: 'Reads the `refreshToken` httpOnly cookie set at login. Returns a new access token and rotates the cookie.',
      response: {
        200: {
          type: 'object',
          properties: { accessToken: { type: 'string' } },
        },
        401: { $ref: 'UnauthorizedError#' },
      },
    },
  }, async (request, reply) => {
    const token = request.cookies.refreshToken
    if (!token) return reply.code(401).send({ error: 'No refresh token' })
    const result = await refreshTokens(app, token)
    reply.setCookie('refreshToken', result.refreshToken, COOKIE_OPTS(app))
    return { accessToken: result.accessToken }
  })

  app.post('/logout', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Auth'],
      summary: 'Logout current session',
      response: {
        200: { $ref: 'SuccessMessage#' },
        ...Unauthorized,
      },
    },
  }, async (request, reply) => {
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

  app.post('/logout-all', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Auth'],
      summary: 'Logout all sessions (all devices)',
      response: {
        200: { $ref: 'SuccessMessage#' },
        ...Unauthorized,
      },
    },
  }, async (request, reply) => {
    await logoutUser(app, request.jwtUser.sub)
    reply.clearCookie('refreshToken', { path: '/api/auth' })
    return { success: true }
  })

  app.get('/me', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Auth'],
      summary: 'Get current user profile',
      response: {
        200: { $ref: 'User#' },
        ...Unauthorized,
      },
    },
  }, async (request) => {
    const { rows } = await app.db.query(
      `SELECT id, email, phone, full_name AS "fullName", role, avatar_url AS "avatarUrl",
              is_active AS "isActive", created_at AS "createdAt"
       FROM users WHERE id = $1`,
      [request.jwtUser.sub]
    )
    return rows[0] ?? null
  })

  app.post('/staff', {
    preHandler: app.requireRole(['admin']),
    schema: {
      tags: ['Auth'],
      summary: 'Create a staff account (doctor or receptionist) — Admin only',
      body: {
        type: 'object',
        required: ['fullName', 'email', 'password', 'role'],
        properties: {
          fullName: { type: 'string',  example: 'Dr. Priya Kumari' },
          email:    { type: 'string',  format: 'email', example: 'priya@clinic.lk' },
          password: { type: 'string',  minLength: 8 },
          role:     { type: 'string',  enum: ['doctor', 'receptionist'] },
        },
      },
      response: {
        201: { $ref: 'User#' },
        ...Unauthorized,
      },
    },
  }, async (request, reply) => {
    const input = StaffRegisterSchema.parse(request.body)
    const user = await createStaffUser(app, input)
    return reply.code(201).send(user)
  })
}
