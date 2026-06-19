import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

export const maintenanceMiddleware = fp(async (app: FastifyInstance) => {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Allow health checks and auth routes without maintenance check
    if (request.url.startsWith('/healthz') || request.url.startsWith('/api/auth')) {
      return
    }

    try {
      const { rows } = await app.db.query(
        `SELECT value FROM system_settings WHERE key = 'maintenance_mode'`
      )

      if (rows.length > 0) {
        const settings = rows[0]?.value as any
        if (settings?.enabled) {
          // Allow system_admin users
          try {
            await request.jwtVerify()
            if ((request.user as any)?.role === 'system_admin') {
              return
            }
          } catch {
            // Not authenticated, continue to maintenance check
          }

          // Return 503 for non-system_admin users
          return reply.code(503).send({
            error: 'Service Unavailable',
            message: settings?.message || 'The system is under maintenance. Please try again later.',
            estimatedDowntimeMinutes: settings?.estimated_downtime_minutes || 0,
          })
        }
      }
    } catch (err: any) {
      app.log.warn({ err }, 'Failed to check maintenance mode')
    }
  })
})
