'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@repo/types'

async function getSession() {
  return createClient()
}

export async function getMyHealthRecords(userId: string) {
  const supabase = await getSession()
  const { data: patient } = await supabase.from('patients').select('id').eq('user_id', userId).maybeSingle()
  if (!patient) return []

  const { data, error } = await supabase
    .from('health_records')
    .select(
      'id, record_type, title, content, attachments, created_at, doctors!inner(id, users!inner(full_name))',
    )
    .eq('patient_id', patient.id)
    .eq('is_visible_to_patient', true)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => ({
    id: row.id,
    recordType: row.record_type,
    title: row.title,
    content: row.content,
    attachments: row.attachments,
    createdAt: row.created_at,
    doctorName: row.doctors?.users?.full_name,
  }))
}

export async function getPatientHealthRecords(patientId: string) {
  const supabase = await getSession()
  const { data, error } = await supabase
    .from('health_records')
    .select(
      'id, record_type, title, content, attachments, is_visible_to_patient, created_at, doctors(id, users!inner(full_name))',
    )
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => ({
    id: row.id,
    recordType: row.record_type,
    title: row.title,
    content: row.content,
    attachments: row.attachments,
    isVisibleToPatient: row.is_visible_to_patient,
    createdAt: row.created_at,
    doctorName: row.doctors?.users?.full_name,
  }))
}

export async function createHealthRecord(
  doctorUserId: string,
  input: {
    patientId: string
    doctorId: string
    appointmentId?: string
    recordType: string
    title: string
    content: Record<string, unknown>
    attachments?: string[]
    isVisibleToPatient?: boolean
  },
) {
  const supabase = await getSession()
  const { data: doctor } = await supabase.from('doctors').select('id').eq('user_id', doctorUserId).maybeSingle()
  if (!doctor) throw new Error('Doctor profile not found')

  const { data, error } = await supabase
    .from('health_records')
    .insert({
      id: require('uuid').v4(),
      patient_id: input.patientId,
      doctor_id: doctor.id,
      appointment_id: input.appointmentId ?? null,
      record_type: input.recordType,
      title: input.title,
      content: input.content,
      attachments: input.attachments ?? [],
      is_visible_to_patient: input.isVisibleToPatient ?? true,
    })
    .select('id, record_type, title, created_at')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/health-records')
  return data
}

export async function createPrescription(
  doctorUserId: string,
  input: {
    patientId: string
    appointmentId?: string
    items: unknown[]
    notes?: string
  },
) {
  const supabase = await getSession()
  const { data: doctor } = await supabase.from('doctors').select('id').eq('user_id', doctorUserId).maybeSingle()
  if (!doctor) throw new Error('Doctor profile not found')

  const { data, error } = await supabase
    .from('prescriptions')
    .insert({
      id: require('uuid').v4(),
      patient_id: input.patientId,
      doctor_id: doctor.id,
      appointment_id: input.appointmentId ?? null,
      items: input.items,
      notes: input.notes ?? null,
    })
    .select('id, created_at')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/health-records')
  return data
}

export async function createTemplate(doctorUserId: string, input: { name: string; visitNote?: string; prescriptionItems: unknown[] }) {
  const supabase = await getSession()
  const { data: doctor } = await supabase.from('doctors').select('id').eq('user_id', doctorUserId).maybeSingle()
  if (!doctor) throw new Error('Doctor profile not found')

  const { data, error } = await supabase
    .from('appointment_templates')
    .insert({
      id: require('uuid').v4(),
      doctor_id: doctor.id,
      name: input.name,
      visit_note: input.visitNote ?? null,
      prescription_items: input.prescriptionItems,
    })
    .select('id, name, created_at')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/health-records')
  return data
}

export async function getMyTemplates(doctorUserId: string) {
  const supabase = await getSession()
  const { data: doctor } = await supabase.from('doctors').select('id').eq('user_id', doctorUserId).maybeSingle()
  if (!doctor) return []

  const { data, error } = await supabase
    .from('appointment_templates')
    .select('id, name, visit_note, prescription_items')
    .eq('doctor_id', doctor.id)
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    visitNote: row.visit_note,
    prescriptionItems: row.prescription_items,
  }))
}

export async function getMyNotifications(userId: string, params?: { before?: string; limit?: number }) {
  const supabase = await getSession()
  const { data: patient } = await supabase.from('patients').select('id').eq('user_id', userId).maybeSingle()
  if (!patient) return []

  let query = supabase
    .from('notifications')
    .select('id, type, title, body, data, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(params?.limit ?? 20)

  if (params?.before) query = query.lt('created_at', params.before)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data,
    isRead: row.is_read,
    createdAt: row.created_at,
  }))
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const supabase = await getSession()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  return { success: true }
}

export async function markAllNotificationsRead(userId: string) {
  const supabase = await getSession()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw new Error(error.message)
  return { success: true }
}

export async function getDoctorSchedule(doctorUserId: string, params?: { date?: string }) {
  const supabase = await getSession()
  const { data: doctor } = await supabase.from('doctors').select('id').eq('user_id', doctorUserId).maybeSingle()
  if (!doctor) return []

  let query = supabase
    .from('appointments')
    .select(
      'id, appointment_date, status, type, slot_position, notes, patients!inner(id, users!inner(full_name))',
    )
    .eq('doctor_id', doctor.id)
    .order('appointment_date', { ascending: true })
    .limit(100)

  if (params?.date) query = query.gte('appointment_date', params.date).lt('appointment_date', `${params.date}T23:59:59`)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => ({
    id: row.id,
    appointmentDate: row.appointment_date,
    status: row.status,
    type: row.type,
    slotPosition: row.slot_position,
    notes: row.notes,
    patientName: row.patients?.users?.full_name,
  }))
}
