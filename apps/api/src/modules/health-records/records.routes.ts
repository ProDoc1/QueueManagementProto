import type { FastifyInstance } from 'fastify'
import { CreateHealthRecordSchema, CreatePrescriptionSchema, SaveTemplateSchema } from '@repo/schemas'
import { v4 as uuidv4 } from 'uuid'

export async function healthRecordRoutes(app: FastifyInstance) {
  // Patient views own records
  app.get('/mine', { preHandler: app.requireRole(['patient']) }, async (request) => {
    const { rows } = await app.db.query(
      `SELECT hr.id, hr.record_type AS "recordType", hr.title, hr.content,
              hr.attachments, hr.created_at AS "createdAt",
              u.full_name AS "doctorName"
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

  // Doctor views patient records
  app.get('/patient/:patientId', { preHandler: app.requireRole(['doctor', 'admin']) }, async (request) => {
    const { patientId } = request.params as { patientId: string }
    const { rows } = await app.db.query(
      `SELECT hr.id, hr.record_type AS "recordType", hr.title, hr.content,
              hr.attachments, hr.is_visible_to_patient AS "isVisibleToPatient",
              hr.created_at AS "createdAt"
       FROM health_records hr
       WHERE hr.patient_id = $1
       ORDER BY hr.created_at DESC`,
      [patientId]
    )
    return rows
  })

  // Create record (doctor)
  app.post('/', { preHandler: app.requireRole(['doctor']) }, async (request, reply) => {
    const input = CreateHealthRecordSchema.parse(request.body)
    const { rows: [doctor] } = await app.db.query(`SELECT id FROM doctors WHERE user_id = $1`, [request.jwtUser.sub])
    const { rows: [record] } = await app.db.query(
      `INSERT INTO health_records (id, patient_id, doctor_id, appointment_id, record_type, title, content, attachments, is_visible_to_patient)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, record_type AS "recordType", title, content, created_at AS "createdAt"`,
      [uuidv4(), input.patientId, doctor.id, input.appointmentId ?? null,
       input.recordType, input.title, JSON.stringify(input.content),
       input.attachments, input.isVisibleToPatient]
    )
    return reply.code(201).send(record)
  })

  // Prescription: create + queue PDF generation
  app.post('/prescriptions', { preHandler: app.requireRole(['doctor']) }, async (request, reply) => {
    const input = CreatePrescriptionSchema.parse(request.body)
    const { rows: [doctor] } = await app.db.query(`SELECT id FROM doctors WHERE user_id = $1`, [request.jwtUser.sub])
    const { rows: [rx] } = await app.db.query(
      `INSERT INTO prescriptions (id, patient_id, doctor_id, appointment_id, items, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at AS "createdAt"`,
      [uuidv4(), input.patientId, doctor.id, input.appointmentId ?? null,
       JSON.stringify(input.items), input.notes ?? null]
    )
    // TODO: queue Puppeteer PDF generation job
    return reply.code(201).send(rx)
  })

  // Save visit template (doctor)
  app.post('/templates', { preHandler: app.requireRole(['doctor']) }, async (request, reply) => {
    const input = SaveTemplateSchema.parse(request.body)
    const { rows: [doctor] } = await app.db.query(`SELECT id FROM doctors WHERE user_id = $1`, [request.jwtUser.sub])
    const { rows: [tmpl] } = await app.db.query(
      `INSERT INTO appointment_templates (id, doctor_id, name, visit_note, prescription_items)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, created_at AS "createdAt"`,
      [uuidv4(), doctor.id, input.name, input.visitNote ?? null, JSON.stringify(input.prescriptionItems)]
    )
    return reply.code(201).send(tmpl)
  })

  // Get doctor's templates
  app.get('/templates', { preHandler: app.requireRole(['doctor']) }, async (request) => {
    const { rows } = await app.db.query(
      `SELECT t.id, t.name, t.visit_note AS "visitNote", t.prescription_items AS "prescriptionItems"
       FROM appointment_templates t JOIN doctors d ON t.doctor_id = d.id
       WHERE d.user_id = $1 ORDER BY t.name`,
      [request.jwtUser.sub]
    )
    return rows
  })
}
