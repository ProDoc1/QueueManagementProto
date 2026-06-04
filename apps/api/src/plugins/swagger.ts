import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'

export const swaggerPlugin = fp(async (app: FastifyInstance) => {

  // ── Shared schemas — added to Fastify schema store AND OpenAPI components ───
  // Routes reference these as { $ref: 'SchemaId#' }
  // @fastify/swagger maps them to #/components/schemas/SchemaId in the spec.
  app.addSchema({
    $id: 'Error', title: 'Error',
    type: 'object',
    properties: {
      statusCode: { type: 'integer' },
      error:      { type: 'string'  },
      message:    { type: 'string'  },
    },
  })
  app.addSchema({
    $id: 'UnauthorizedError', title: 'UnauthorizedError',
    type: 'object',
    properties: {
      statusCode: { type: 'integer' },
      error:      { type: 'string'  },
      message:    { type: 'string'  },
    },
  })
  app.addSchema({
    $id: 'SuccessMessage', title: 'SuccessMessage',
    type: 'object',
    properties: { success: { type: 'boolean' } },
  })
  app.addSchema({
    $id: 'User', title: 'User',
    type: 'object',
    properties: {
      id:       { type: 'string' },
      email:    { type: 'string' },
      fullName: { type: 'string' },
      role:     { type: 'string', enum: ['patient','doctor','receptionist','admin'] },
      isActive: { type: 'boolean' },
    },
  })
  app.addSchema({
    $id: 'WalkInQueueEntry', title: 'WalkInQueueEntry',
    type: 'object',
    properties: {
      id:                   { type: 'string' },
      patientName:          { type: 'string' },
      patientId:            { type: 'string', nullable: true },
      doctorId:             { type: 'string' },
      clinicId:             { type: 'string', nullable: true },
      queueDate:            { type: 'string' },
      queueNumber:          { type: 'integer' },
      status:               { type: 'string', enum: ['waiting','called','in_progress','completed','left'] },
      smsPhone:             { type: 'string', nullable: true },
      estimatedWaitMinutes: { type: 'integer' },
      checkedInAt:          { type: 'string' },
      calledAt:             { type: 'string', nullable: true },
    },
  })
  app.addSchema({
    $id: 'Appointment', title: 'Appointment',
    type: 'object',
    properties: {
      id:              { type: 'string' },
      patientId:       { type: 'string' },
      doctorId:        { type: 'string' },
      slotId:          { type: 'string' },
      status:          { type: 'string', enum: ['scheduled','completed','cancelled','no_show'] },
      type:            { type: 'string', enum: ['in_person','virtual'] },
      appointmentDate: { type: 'string' },
      isLateNumber:    { type: 'boolean' },
    },
  })

  // ── OpenAPI spec ─────────────────────────────────────────────────────────────
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'MediQueue API',
        version: '0.1.0',
        description: `
**MediQueue** – Medical Centre Queue Management Platform

### Quick start
1. Call \`POST /api/auth/login\` with one of the test credentials below
2. Copy the \`accessToken\` from the response
3. Click **Authorize ↗** and enter \`Bearer <token>\`

### Test credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@test.com | password123 |
| Doctor | doctor@test.com | password123 |
| Receptionist | receptionist@test.com | password123 |
| Patient | patient@test.com | password123 |
        `.trim(),
      },
      servers: [{ url: 'http://localhost:4000', description: 'Local dev' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'Auth',           description: 'Register, login, token refresh, logout' },
        { name: 'Queue',          description: 'Walk-in queue — issue tokens, call next, TV display' },
        { name: 'Doctors',        description: 'Profiles, live location, delay broadcast, subscriptions' },
        { name: 'Appointments',   description: 'Slot booking, cancellation, no-show, penalty' },
        { name: 'Patients',       description: 'Patient profiles' },
        { name: 'Health Records', description: 'Visit notes, prescriptions, templates' },
        { name: 'Notifications',  description: 'In-app notification centre' },
        { name: 'Health',         description: 'Service health check' },
      ],
    },
  })

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      tryItOutEnabled: true,
      persistAuthorization: true,
      defaultModelsExpandDepth: 2,
    },
    staticCSP: true,
  })

  app.log.info('📖  Swagger UI → http://localhost:4000/docs')
})
