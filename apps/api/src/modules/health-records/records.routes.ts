import type { FastifyInstance } from 'fastify'
import { CreateHealthRecordSchema, CreatePrescriptionSchema, SaveTemplateSchema } from '@repo/schemas'
import { v4 as uuidv4 } from 'uuid'

const Unauth  = { 401: { $ref: 'UnauthorizedError#' } }
const Success = { 200: { $ref: 'SuccessMessage#' } }

const RecordShape = {
  type: 'object',
  properties: {
    id:         { type: 'string', format: 'uuid' },
    recordType: { type: 'string', enum: ['visit_note','prescription','lab_result','vaccination','other'] },
    title:      { type: 'string' },
    content:    { type: 'object', description: 'JSONB — free-form structured content' },
    attachments:{ type: 'array', items: { type: 'string' }, description: 'S3 URLs' },
    doctorName: { type: 'string', nullable: true },
    createdAt:  { type: 'string', format: 'date-time' },
  },
}

export async function healthRecordRoutes(app: FastifyInstance) {

  // ── Patient: own visible records ────────────────────────────────────────────
  app.get('/mine', {
    preHandler: app.requireRole(['patient']),
    schema: {
      tags: ['Health Records'],
      summary: 'Get own health records — only records marked visible to patient',
      response: { 200: { type: 'array', items: RecordShape }, ...Unauth },
    },
  }, async (request) => {
    const { rows } = await app.db.query(
      `SELECT hr.id, hr.record_type AS "recordType", hr.title, hr.content,
              hr.attachments, hr.created_at AS "createdAt", u.full_name AS "doctorName"
       FROM health_records hr
       JOIN patients p ON hr.patient_id = p.id
       LEFT JOIN doctors d ON hr.doctor_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       WHERE p.user_id = $1 AND hr.is_visible_to_patient = true
       ORDER BY hr.created_at DESC`,
      [request.jwtUser.sub]
    )
    return rows
  })

  // ── Doctor: view patient records ────────────────────────────────────────────
  app.get('/patient/:patientId', {
    preHandler: app.requireRole(['doctor', ]),
    schema: {
      tags: ['Health Records'],
      summary: "View all of a patient's records — Doctor / Admin",
      params: { type: 'object', required: ['patientId'], properties: { patientId: { type: 'string', format: 'uuid' } } },
      response: { 200: { type: 'array', items: RecordShape }, ...Unauth },
    },
  }, async (request) => {
    const { patientId } = request.params as { patientId: string }
    const { rows } = await app.db.query(
      `SELECT hr.id, hr.record_type AS "recordType", hr.title, hr.content,
              hr.attachments, hr.is_visible_to_patient AS "isVisibleToPatient", hr.created_at AS "createdAt"
       FROM health_records hr
       WHERE hr.patient_id = $1
       ORDER BY hr.created_at DESC`,
      [patientId]
    )
    return rows
  })

  // ── Doctor: create record ───────────────────────────────────────────────────
  app.post('/', {
    preHandler: app.requireRole(['doctor']),
    schema: {
      tags: ['Health Records'],
      summary: 'Create a health record — Doctor only',
      body: {
        type: 'object',
        required: ['patientId', 'recordType', 'title', 'content'],
        properties: {
          patientId:           { type: 'string', format: 'uuid' },
          appointmentId:       { type: 'string', format: 'uuid' },
          recordType:          { type: 'string', enum: ['visit_note','lab_result','vaccination','other'] },
          title:               { type: 'string', example: 'Follow-up visit' },
          content:             { type: 'object', description: 'Free-form JSONB content' },
          attachments:         { type: 'array', items: { type: 'string' }, description: 'S3 URLs' },
          isVisibleToPatient:  { type: 'boolean', default: true },
        },
      },
      response: { 201: RecordShape, ...Unauth },
    },
  }, async (request, reply) => {
    const input = CreateHealthRecordSchema.parse(request.body)
    const { rows: [doctor] } = await app.db.query(`SELECT id FROM doctors WHERE user_id = $1`, [request.jwtUser.sub])
    const { rows: [record] } = await app.db.query(
      `INSERT INTO health_records (id, patient_id, doctor_id, appointment_id, record_type, title, content, attachments, is_visible_to_patient)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, record_type AS "recordType", title, content, created_at AS "createdAt"`,
      [uuidv4(), input.patientId, doctor.id, input.appointmentId ?? null,
       input.recordType, input.title, JSON.stringify(input.content), input.attachments, input.isVisibleToPatient]
    )
    return reply.code(201).send(record)
  })

  // ── Doctor: create prescription ─────────────────────────────────────────────
  app.post('/prescriptions', {
    preHandler: app.requireRole(['doctor']),
    schema: {
      tags: ['Health Records'],
      summary: 'Create prescription — queues Puppeteer PDF generation — Doctor only',
      body: {
        type: 'object',
        required: ['patientId', 'items'],
        properties: {
          patientId:     { type: 'string', format: 'uuid' },
          appointmentId: { type: 'string', format: 'uuid' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                drug: { type: 'string', example: 'Amoxicillin 500mg' },
                dose: { type: 'string', example: '1 tab 3x daily' },
                days: { type: 'integer', example: 7 },
              },
            },
          },
          notes: { type: 'string' },
        },
      },
      response: {
        201: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, createdAt: { type: 'string', format: 'date-time' } } },
        ...Unauth,
      },
    },
  }, async (request, reply) => {
    const input = CreatePrescriptionSchema.parse(request.body)
    const { rows: [doctor] } = await app.db.query(`SELECT id FROM doctors WHERE user_id = $1`, [request.jwtUser.sub])
    const { rows: [rx] } = await app.db.query(
      `INSERT INTO prescriptions (id, patient_id, doctor_id, appointment_id, items, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at AS "createdAt"`,
      [uuidv4(), input.patientId, doctor.id, input.appointmentId ?? null, JSON.stringify(input.items), input.notes ?? null]
    )
    return reply.code(201).send(rx)
  })

  // ── Doctor: save template ───────────────────────────────────────────────────
  app.post('/templates', {
    preHandler: app.requireRole(['doctor']),
    schema: {
      tags: ['Health Records'],
      summary: 'Save a quick-fill visit template — Doctor only',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name:              { type: 'string', example: 'URTI — standard treatment' },
          visitNote:         { type: 'string', example: 'Patient presents with sore throat and mild fever.' },
          prescriptionItems: { type: 'array', items: { type: 'object' } },
        },
      },
      response: {
        201: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' } } },
        ...Unauth,
      },
    },
  }, async (request, reply) => {
    const input = SaveTemplateSchema.parse(request.body)
    const { rows: [doctor] } = await app.db.query(`SELECT id FROM doctors WHERE user_id = $1`, [request.jwtUser.sub])
    const { rows: [tmpl] } = await app.db.query(
      `INSERT INTO appointment_templates (id, doctor_id, name, visit_note, prescription_items)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, created_at AS "createdAt"`,
      [uuidv4(), doctor.id, input.name, input.visitNote ?? null, JSON.stringify(input.prescriptionItems)]
    )
    return reply.code(201).send(tmpl)
  })

  // ── Doctor: list own templates ──────────────────────────────────────────────
  app.get('/templates', {
    preHandler: app.requireRole(['doctor']),
    schema: {
      tags: ['Health Records'],
      summary: "List doctor's saved visit templates",
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id:                { type: 'string', format: 'uuid' },
              name:              { type: 'string' },
              visitNote:         { type: 'string', nullable: true },
              prescriptionItems: { type: 'array', items: { type: 'object' } },
            },
          },
        },
        ...Unauth,
      },
    },
  }, async (request) => {
    const { rows } = await app.db.query(
      `SELECT t.id, t.name, t.visit_note AS "visitNote", t.prescription_items AS "prescriptionItems"
       FROM appointment_templates t JOIN doctors d ON t.doctor_id = d.id
       WHERE d.user_id = $1 ORDER BY t.name`,
      [request.jwtUser.sub]
    )
    return rows
  })
}
