import Fastify from 'fastify'
import { authPlugin } from './plugins/auth.js'
import { postgresPlugin } from './plugins/postgres.js'
import { redisPlugin } from './plugins/redis.js'
import { socketPlugin } from './plugins/socket.js'
import { corsPlugin } from './plugins/cors.js'
import { rateLimitPlugin } from './plugins/rate-limit.js'
import { auditMiddleware } from './shared/middleware/audit.js'
import { authRoutes } from './modules/auth/auth.routes.js'
import { doctorRoutes } from './modules/doctors/doctors.routes.js'
import { appointmentRoutes } from './modules/appointments/appointments.routes.js'
import { patientRoutes } from './modules/patients/patients.routes.js'
import { healthRecordRoutes } from './modules/health-records/records.routes.js'
import { queueRoutes } from './modules/queue/queue.routes.js'
import { notificationRoutes } from './modules/notifications/notifications.routes.js'

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } })

async function main() {
  await app.register(corsPlugin)
  await app.register(rateLimitPlugin)
  await app.register(postgresPlugin)
  await app.register(redisPlugin)
  await app.register(authPlugin)
  await app.register(socketPlugin)
  await app.register(auditMiddleware)

  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(doctorRoutes, { prefix: '/api/doctors' })
  await app.register(appointmentRoutes, { prefix: '/api/appointments' })
  await app.register(patientRoutes, { prefix: '/api/patients' })
  await app.register(healthRecordRoutes, { prefix: '/api/health-records' })
  await app.register(queueRoutes, { prefix: '/api/queue' })
  await app.register(notificationRoutes, { prefix: '/api/notifications' })

  app.get('/healthz', async () => ({ status: 'ok' }))

  const port = Number(process.env.PORT ?? 4000)
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`API running on port ${port}`)

  // Background jobs only run when RUN_JOBS=true to avoid duplicate execution across replicas.
  // In production, run a dedicated worker container with RUN_JOBS=true.
  if (process.env.RUN_JOBS === 'true') {
    app.log.info('Starting background jobs (RUN_JOBS=true)')
    const { startPenaltyJob } = await import('./jobs/penalty.job.js')
    const { startReminderJob } = await import('./jobs/reminder.job.js')
    const { startSlotGeneratorJob } = await import('./jobs/slot-generator.job.js')
    const { startQueueCleanJob } = await import('./jobs/queue-clean.job.js')
    startPenaltyJob(app)
    startReminderJob(app)
    startSlotGeneratorJob(app)
    startQueueCleanJob(app)
  }
}

// Graceful shutdown: let in-flight requests finish, close DB/Redis cleanly
async function shutdown(signal: string) {
  app.log.info(`Received ${signal}, shutting down gracefully`)
  await app.close()
  process.exit(0)
}

process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT', () => { void shutdown('SIGINT') })

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
