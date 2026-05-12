import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest } from 'fastify'

// Routes that write to audit_log — health records, appointments, and patient data access
const AUDITED_PATTERNS: { method: string; pattern: RegExp; action: string; resource: string }[] = [
  { method: 'GET',    pattern: /^\/api\/health-records/,          action: 'viewed',    resource: 'health_record' },
  { method: 'POST',   pattern: /^\/api\/health-records/,          action: 'created',   resource: 'health_record' },
  { method: 'GET',    pattern: /^\/api\/appointments/,            action: 'viewed',    resource: 'appointment' },
  { method: 'POST',   pattern: /^\/api\/appointments$/,           action: 'booked',    resource: 'appointment' },
  { method: 'PUT',    pattern: /^\/api\/appointments\/.+\/cancel/, action: 'cancelled', resource: 'appointment' },
  { method: 'PUT',    pattern: /^\/api\/appointments\/.+\/no-show/, action: 'no_show',  resource: 'appointment' },
  { method: 'GET',    pattern: /^\/api\/patients\//,              action: 'viewed',    resource: 'patient' },
  { method: 'POST',   pattern: /^\/api\/health-records\/prescriptions/, action: 'created', resource: 'prescription' },
]

export const auditMiddleware = fp(async (app: FastifyInstance) => {
  app.addHook('onResponse', async (request: FastifyRequest, reply) => {
    // Only audit authenticated requests that succeeded (2xx) or were forbidden (for security logging)
    if (!request.jwtUser) return
    if (reply.statusCode >= 500) return

    const url = request.url.split('?')[0]!
    const match = AUDITED_PATTERNS.find(
      (p) => p.method === request.method && p.pattern.test(url)
    )
    if (!match) return

    // Extract resource_id from URL path if present (e.g. /api/appointments/uuid)
    const uuidMatch = url.match(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
    const resourceId = uuidMatch?.[1] ?? null

    // Fire-and-forget — audit log failure must not break the request
    app.db.query(
      `INSERT INTO audit_log (user_id, action, resource, resource_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        request.jwtUser.sub,
        match.action,
        match.resource,
        resourceId,
        request.ip,
        request.headers['user-agent'] ?? null,
      ]
    ).catch((err) => app.log.error(err, 'audit_log insert failed'))
  })
})
