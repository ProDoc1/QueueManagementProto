import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { createClient, type RedisClientType } from 'redis'

declare module 'fastify' {
  interface FastifyInstance {
    redis: RedisClientType
  }
}

export const redisPlugin = fp(async (app: FastifyInstance) => {
  // reconnectStrategy: false → fail immediately instead of retrying forever
  const client = createClient({
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    socket: { connectTimeout: 2000, reconnectStrategy: false },
  }) as RedisClientType

  client.on('error', () => { /* suppress noisy error events after initial failure */ })

  try {
    await Promise.race([
      client.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis connect timeout')), 2500)
      ),
    ])
    app.log.info('Redis connected')
  } catch (err) {
    app.log.warn({ err }, 'Redis unavailable — server starting without cache')
    try { client.destroy() } catch { /* ignore */ }
  }

  app.decorate('redis', client)
  app.addHook('onClose', async () => {
    try { await client.quit() } catch { /* ignore */ }
  })
})
