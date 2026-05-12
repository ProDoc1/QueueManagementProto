import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import pg from 'pg'

const { Pool } = pg

declare module 'fastify' {
  interface FastifyInstance {
    db: pg.Pool
  }
}

export const postgresPlugin = fp(async (app: FastifyInstance) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })

  await pool.query('SELECT 1')
  app.decorate('db', pool)
  app.addHook('onClose', async () => { await pool.end() })
  app.log.info('PostgreSQL connected')
})
