import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { JwtPayload, UserRole } from '@repo/types'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    jwtUser: JwtPayload | null
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  const cookieSecret = process.env.COOKIE_SECRET ?? 'development-cookie-secret'
  const jwtSecret = process.env.JWT_SECRET ?? 'development-jwt-secret'

  await app.register(cookie, { secret: cookieSecret })
  await app.register(jwt, {
    secret: jwtSecret,
    sign: { expiresIn: '15m' },
  })

  app.decorateRequest('jwtUser', null)

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
      request.jwtUser = request.user as JwtPayload

      // Check if user is banned
      const isBanned = await app.db.query(
        `SELECT 1 FROM account_bans
         WHERE user_id = $1 AND (is_permanent = true OR expires_at > NOW())`,
        [request.jwtUser.sub]
      )

      if (isBanned.rows.length > 0) {
        return reply.code(403).send({ error: 'Account has been suspended' })
      }
    } catch {
      reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  app.decorate('requireRole', (roles: UserRole[]) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify()
        request.jwtUser = request.user as JwtPayload

        // Check if user is banned
        const isBanned = await app.db.query(
          `SELECT 1 FROM account_bans
           WHERE user_id = $1 AND (is_permanent = true OR expires_at > NOW())`,
          [request.jwtUser.sub]
        )

        if (isBanned.rows.length > 0) {
          return reply.code(403).send({ error: 'Account has been suspended' })
        }

        if (!roles.includes(request.jwtUser.role)) {
          reply.code(403).send({ error: 'Forbidden' })
        }
      } catch {
        reply.code(401).send({ error: 'Unauthorized' })
      }
    }
  )
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireRole: (roles: UserRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
