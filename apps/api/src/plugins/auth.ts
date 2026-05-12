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
    jwtUser: JwtPayload
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  await app.register(cookie, { secret: process.env.COOKIE_SECRET! })
  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
    sign: { expiresIn: '15m' },
  })

  app.decorateRequest('jwtUser', null)

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
      request.jwtUser = request.user as JwtPayload
    } catch {
      reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  app.decorate('requireRole', (roles: UserRole[]) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify()
        request.jwtUser = request.user as JwtPayload
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
