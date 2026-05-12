import type { FastifyInstance } from 'fastify'
import { UpdatePatientSchema } from '@repo/schemas'

export async function patientRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: app.requireRole(['patient']) }, async (request) => {
    const { rows: [patient] } = await app.db.query(
      `SELECT p.id, p.date_of_birth AS "dateOfBirth", p.gender, p.blood_type AS "bloodType",
              p.allergies, p.emergency_contact AS "emergencyContact", p.insurance_info AS "insuranceInfo",
              u.full_name AS "fullName", u.email, u.phone,
              pp.penalty_level AS "penaltyLevel"
       FROM patients p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN penalty_profiles pp ON pp.patient_id = p.id
       WHERE p.user_id = $1`,
      [request.jwtUser.sub]
    )
    return patient
  })

  app.put('/me', { preHandler: app.requireRole(['patient']) }, async (request) => {
    const input = UpdatePatientSchema.parse(request.body)
    const sets: string[] = []
    const params: unknown[] = [request.jwtUser.sub]
    if (input.dateOfBirth) { params.push(input.dateOfBirth); sets.push(`date_of_birth = $${params.length}`) }
    if (input.gender) { params.push(input.gender); sets.push(`gender = $${params.length}`) }
    if (input.bloodType) { params.push(input.bloodType); sets.push(`blood_type = $${params.length}`) }
    if (input.allergies) { params.push(input.allergies); sets.push(`allergies = $${params.length}`) }
    if (input.emergencyContact) { params.push(JSON.stringify(input.emergencyContact)); sets.push(`emergency_contact = $${params.length}`) }
    if (input.insuranceInfo) { params.push(JSON.stringify(input.insuranceInfo)); sets.push(`insurance_info = $${params.length}`) }
    if (sets.length === 0) return { success: true }
    await app.db.query(
      `UPDATE patients SET ${sets.join(', ')} WHERE user_id = $1`,
      params
    )
    return { success: true }
  })

  app.get('/:id', { preHandler: app.requireRole(['doctor', 'receptionist', 'admin']) }, async (request) => {
    const { id } = request.params as { id: string }
    const { rows: [patient] } = await app.db.query(
      `SELECT p.id, p.date_of_birth AS "dateOfBirth", p.gender, p.blood_type AS "bloodType",
              p.allergies, p.emergency_contact AS "emergencyContact",
              u.full_name AS "fullName", u.email, u.phone,
              pp.penalty_level AS "penaltyLevel", pp.no_show_count AS "noShowCount"
       FROM patients p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN penalty_profiles pp ON pp.patient_id = p.id
       WHERE p.id = $1`,
      [id]
    )
    if (!patient) throw Object.assign(new Error('Patient not found'), { statusCode: 404 })
    return patient
  })
}
