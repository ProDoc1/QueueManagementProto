import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { createClient, type RedisClientType } from 'redis'

declare module 'fastify' {
  interface FastifyInstance {
    redis: RedisClientType
  }
}

export const redisPlugin = fp(async (app: FastifyInstance) => {
  const client = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' }) as RedisClientType
  await client.connect()
  app.decorate('redis', client)
  app.addHook('onClose', async () => { await client.quit() })
  app.log.info('Redis connected')
})
