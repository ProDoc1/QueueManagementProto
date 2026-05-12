import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import type { FastifyInstance } from 'fastify'

export const corsPlugin = fp(async (app: FastifyInstance) => {
  const allowed = (process.env.WEB_URL ?? 'http://localhost:3001').split(',').map((s) => s.trim())

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowed.some((o) => origin.startsWith(o))) return cb(null, true)
      cb(new Error('Not allowed by CORS'), false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
})
