import type { FastifyInstance } from 'fastify'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export async function notificationRoutes(app: FastifyInstance) {
  // Paginated notifications list — cursor-based via created_at
  app.get('/', { preHandler: app.authenticate }, async (request) => {
    const { limit: rawLimit, before } = request.query as { limit?: string; before?: string }
    const limit = Math.min(parseInt(rawLimit ?? String(DEFAULT_LIMIT), 10), MAX_LIMIT)

    const { rows } = await app.db.query(
      `SELECT id, type, title, body, data, is_read AS "isRead", created_at AS "createdAt"
       FROM notifications
       WHERE user_id = $1
         ${before ? 'AND created_at < $3' : ''}
       ORDER BY created_at DESC
       LIMIT $2`,
      before ? [request.jwtUser.sub, limit, before] : [request.jwtUser.sub, limit]
    )

    return {
      data: rows,
      nextCursor: rows.length === limit ? rows[rows.length - 1]?.createdAt : null,
    }
  })

  app.put('/:id/read', { preHandler: app.authenticate }, async (request) => {
    const { id } = request.params as { id: string }
    await app.db.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
      [id, request.jwtUser.sub]
    )
    return { success: true }
  })

  app.put('/read-all', { preHandler: app.authenticate }, async (request) => {
    await app.db.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [request.jwtUser.sub]
    )
    return { success: true }
  })
}
