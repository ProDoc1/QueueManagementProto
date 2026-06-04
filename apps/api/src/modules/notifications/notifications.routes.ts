import type { FastifyInstance } from 'fastify'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const Unauth  = { 401: { $ref: 'UnauthorizedError#' } }
const Success = { 200: { $ref: 'SuccessMessage#' } }

const NotifShape = {
  type: 'object',
  properties: {
    id:        { type: 'string', format: 'uuid' },
    type:      { type: 'string', example: 'appointment_reminder' },
    title:     { type: 'string', nullable: true },
    body:      { type: 'string' },
    data:      { type: 'object', description: 'JSONB payload — varies by type' },
    isRead:    { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
  },
}

export async function notificationRoutes(app: FastifyInstance) {

  // ── List notifications ──────────────────────────────────────────────────────
  app.get('/', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Notifications'],
      summary: 'List notifications — cursor-paginated, newest first',
      querystring: {
        type: 'object',
        properties: {
          before: { type: 'string', format: 'date-time', description: 'Pagination cursor (createdAt)' },
          limit:  { type: 'integer', default: 20, maximum: 100 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data:       { type: 'array', items: NotifShape },
            nextCursor: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        ...Unauth,
      },
    },
  }, async (request) => {
    const { limit: rawLimit, before } = request.query as { limit?: string; before?: string }
    const limit = Math.min(parseInt(rawLimit ?? String(DEFAULT_LIMIT), 10), MAX_LIMIT)
    const { rows } = await app.db.query(
      `SELECT id, type, title, body, data, is_read AS "isRead", created_at AS "createdAt"
       FROM notifications
       WHERE user_id = $1 ${before ? 'AND created_at < $3' : ''}
       ORDER BY created_at DESC LIMIT $2`,
      before ? [request.jwtUser.sub, limit, before] : [request.jwtUser.sub, limit]
    )
    return { data: rows, nextCursor: rows.length === limit ? rows[rows.length - 1]?.createdAt : null }
  })

  // ── Mark one read ───────────────────────────────────────────────────────────
  app.put('/:id/read', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Notifications'],
      summary: 'Mark a notification as read',
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
      response: { ...Success, ...Unauth },
    },
  }, async (request) => {
    const { id } = request.params as { id: string }
    await app.db.query(`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`, [id, request.jwtUser.sub])
    return { success: true }
  })

  // ── Mark all read ───────────────────────────────────────────────────────────
  app.put('/read-all', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Notifications'],
      summary: 'Mark all notifications as read',
      response: { ...Success, ...Unauth },
    },
  }, async (request) => {
    await app.db.query(`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`, [request.jwtUser.sub])
    return { success: true }
  })
}
