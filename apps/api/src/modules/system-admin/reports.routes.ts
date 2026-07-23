import { FastifyInstance } from 'fastify'

export async function reportRoutes(app: FastifyInstance) {
  app.get('/reports/export', {
    preHandler: app.requireRole(['system_admin']),
  }, async (request, reply) => {
    const { period } = request.query as { period: string }

    // Report rendering is currently handled from the frontend.
    // Keep the route available but return a clear message instead of importing an unavailable PDF renderer.
    return reply.code(400).send({ error: 'PDF export must be done from frontend' })
  })
}