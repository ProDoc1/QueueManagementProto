import type { FastifyInstance } from 'fastify'
import {
  banAccount,
  unbanAccount,
  getBannedAccounts,
  changeUserRole,
  getPlatformStatistics,
  getAuditLogs,
  getLoginAuditLogs,
  setMaintenanceMode,
  getSystemSettings,
  logAuditEvent,
  getAllSystemAdmins,
  getSystemAdmin,
} from './system-admin.service.js'

export async function systemAdminRoutes(app: FastifyInstance) {
  // ── Account Management ─────────────────────────────────────────────────

  app.post('/accounts/ban', {
    preHandler: app.requireRole(['system_admin']),
    schema: {
      tags: ['System Admin'],
      summary: 'Ban/freeze a user account',
      body: {
        type: 'object',
        required: ['userId', 'reason'],
        properties: {
          userId: { type: 'string', format: 'uuid', description: 'User ID to ban' },
          reason: { type: 'string', description: 'Reason for banning' },
          expiresAt: { type: 'string', format: 'date-time', description: 'Optional expiry date (ISO format)' },
        },
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
      },
    },
  }, async (request, reply) => {
    const { userId, reason, expiresAt } = request.body as any
    await banAccount(app, { userId, reason, expiresAt }, request.jwtUser.sub)
    return reply.code(200).send({ success: true })
  })

  app.delete('/accounts/:userId/ban', {
    preHandler: app.requireRole(['system_admin']),
    schema: {
      tags: ['System Admin'],
      summary: 'Unban a user account',
      params: {
        type: 'object',
        properties: { userId: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
      },
    },
  }, async (request, reply) => {
    const { userId } = request.params as any
    await unbanAccount(app, userId, request.jwtUser.sub)
    return reply.code(200).send({ success: true })
  })

  app.get('/accounts/banned', {
    preHandler: app.requireRole(['system_admin']),
    schema: {
      tags: ['System Admin'],
      summary: 'List banned accounts',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 50 },
          offset: { type: 'integer', default: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            bans: { type: 'array' },
            total: { type: 'integer' },
          },
        },
      },
    },
  }, async (request) => {
    const { limit = 50, offset = 0 } = request.query as any
    const result = await getBannedAccounts(app, limit, offset)
    return result
  })

  // ── Role Management ────────────────────────────────────────────────────

  app.patch('/roles/:userId', {
    preHandler: app.requireRole(['system_admin']),
    schema: {
      tags: ['System Admin'],
      summary: 'Change user role',
      params: {
        type: 'object',
        properties: { userId: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['newRole'],
        properties: {
          newRole: { type: 'string', enum: ['doctor', 'receptionist', 'system_admin'] },
        },
      },
      response: {
        200: { type: 'object' },
      },
    },
  }, async (request) => {
    const { userId } = request.params as any
    const { newRole } = request.body as any
    const user = await changeUserRole(app, userId, newRole, request.jwtUser.sub)
    return user
  })

  app.get('/roles', {
    preHandler: app.requireRole(['system_admin']),
    schema: {
      tags: ['System Admin'],
      summary: 'List all system admins',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 50 },
          offset: { type: 'integer', default: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            users: { type: 'array' },
            total: { type: 'integer' },
          },
        },
      },
    },
  }, async (request) => {
    const { limit = 50, offset = 0 } = request.query as any
    const result = await getAllSystemAdmins(app, limit, offset)
    return result
  })

  // ── Statistics ─────────────────────────────────────────────────────────

  app.get('/statistics', {
    preHandler: app.requireRole(['system_admin']),
    schema: {
      tags: ['System Admin'],
      summary: 'Get platform statistics',
      querystring: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'lastWeek', 'lastMonth', 'last2Months', 'all'],
            default: 'today',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            period: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            activeDoctor: { type: 'integer' },
            registeredPatients: { type: 'integer' },
            tokensIssued: { type: 'integer' },
            appointmentsCompleted: { type: 'integer' },
            appointmentsCancelled: { type: 'integer' },
            appointmentNoShows: { type: 'integer' },
            totalClinics: { type: 'integer' },
            platformErrors: { type: 'integer' },
            trend: { type: 'array' },
          },
        },
      },
    },
  }, async (request) => {
    const { period = 'today' } = request.query as any
    return getPlatformStatistics(app, period)
  })

  app.post('/statistics/export', {
    preHandler: app.requireRole(['system_admin']),
    schema: {
      tags: ['System Admin'],
      summary: 'Export statistics as PDF or JSON',
      body: {
        type: 'object',
        required: ['period', 'format'],
        properties: {
          period: { type: 'string', enum: ['today', 'lastWeek', 'lastMonth', 'last2Months', 'all'] },
          format: { type: 'string', enum: ['pdf', 'json'] },
        },
      },
      response: {
        200: { type: 'string' },
        400: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { period, format } = request.body as any
    const stats = await getPlatformStatistics(app, period)

    if (format === 'json') {
      reply.header('Content-Type', 'application/json')
      reply.header('Content-Disposition', `attachment; filename="statistics-${period}-${Date.now()}.json"`)
      return JSON.stringify(stats, null, 2)
    } else if (format === 'pdf') {
      // PDF export will be implemented in the frontend using jsPDF
      return reply.code(400).send({ error: 'PDF export must be done from frontend' })
    }
  })

  // ── Audit Logs ─────────────────────────────────────────────────────────

  app.get('/audit-logs', {
    preHandler: app.requireRole(['system_admin']),
    schema: {
      tags: ['System Admin'],
      summary: 'Get system audit logs',
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          action: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          limit: { type: 'integer', default: 50 },
          offset: { type: 'integer', default: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            logs: { type: 'array' },
            total: { type: 'integer' },
          },
        },
      },
    },
  }, async (request) => {
    const { userId, action, startDate, endDate, limit = 50, offset = 0 } = request.query as any
    return getAuditLogs(app, {
      userId,
      action,
      startDate,
      endDate,
      limit,
      offset,
    })
  })

  app.get('/audit-logs/logins', {
    preHandler: app.requireRole(['system_admin']),
    schema: {
      tags: ['System Admin'],
      summary: 'Get login audit logs',
      querystring: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          userId: { type: 'string' },
          status: { type: 'string', enum: ['success', 'failed'] },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          limit: { type: 'integer', default: 50 },
          offset: { type: 'integer', default: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            logs: { type: 'array' },
            total: { type: 'integer' },
          },
        },
      },
    },
  }, async (request) => {
    const { email, userId, status, startDate, endDate, limit = 50, offset = 0 } = request.query as any
    return getLoginAuditLogs(app, {
      email,
      userId,
      status,
      startDate,
      endDate,
      limit,
      offset,
    })
  })

  // ── System Settings ────────────────────────────────────────────────────

  app.get('/settings', {
    preHandler: app.requireRole(['system_admin']),
    schema: {
      tags: ['System Admin'],
      summary: 'Get system settings',
      response: {
        200: { type: 'object' },
      },
    },
  }, async (request) => {
    return getSystemSettings(app)
  })

  app.patch('/settings', {
    preHandler: app.requireRole(['system_admin']),
    schema: {
      tags: ['System Admin'],
      summary: 'Update system settings',
      body: {
        type: 'object',
        properties: {
          maintenanceMode: { type: 'boolean' },
          maintenanceMessage: { type: 'string' },
          estimatedDowntimeMinutes: { type: 'integer' },
        },
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
      },
    },
  }, async (request, reply) => {
    const { maintenanceMode, maintenanceMessage, estimatedDowntimeMinutes } = request.body as any

    if (maintenanceMode !== undefined) {
      await setMaintenanceMode(
        app,
        maintenanceMode,
        maintenanceMessage || '',
        estimatedDowntimeMinutes || 0,
        request.jwtUser.sub
      )
    }

    return reply.code(200).send({ success: true })
  })

  app.delete('/maintenance', {
    preHandler: app.requireRole(['system_admin']),
    schema: {
      tags: ['System Admin'],
      summary: 'Disable maintenance mode',
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
      },
    },
  }, async (request, reply) => {
    await setMaintenanceMode(app, false, '', 0, request.jwtUser.sub)
    return reply.code(200).send({ success: true })
  })

  // ── System Health ──────────────────────────────────────────────────────

  app.get('/health', {
    preHandler: app.requireRole(['system_admin']),
    schema: {
      tags: ['System Admin'],
      summary: 'Get system health status',
      response: {
        200: {
          type: 'object',
          properties: {
            dbStatus: { type: 'string' },
            redisStatus: { type: 'string' },
            apiStatus: { type: 'string' },
            lastError: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async (request) => {
    let dbStatus = 'ok'
    let redisStatus = 'ok'
    let lastError = null

    try {
      await app.db.query('SELECT 1')
    } catch (err: any) {
      dbStatus = 'error'
      lastError = err.message
    }

    if (app.redisAvailable) {
      try {
        await app.redis.ping()
      } catch (err: any) {
        redisStatus = 'error'
        lastError = err.message
      }
    } else {
      redisStatus = 'unavailable'
    }

    return {
      dbStatus,
      redisStatus,
      apiStatus: 'ok',
      lastError,
      timestamp: new Date().toISOString(),
    }
  })
}
