'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import type { UserRole } from '@repo/types'

async function getSession() {
  return createClient()
}

export async function addWalkIn(input: {
  patientName: string
  smsPhone?: string
  doctorId: string
  clinicId?: string
}) {
  const supabase = await getSession()

  const today = new Date().toISOString().split('T')[0]!
  const { data: existingMax } = await supabase
    .from('walk_in_queue')
    .select('queue_number')
    .eq('doctor_id', input.doctorId)
    .eq('queue_date', today)
    .order('queue_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextNumber = (existingMax?.queue_number ?? 0) + 1

  const { data: entry, error } = await supabase
    .from('walk_in_queue')
    .insert({
      id: uuidv4(),
      patient_name: input.patientName,
      sms_phone: input.smsPhone ?? null,
      patient_id: null,
      doctor_id: input.doctorId,
      clinic_id: input.clinicId ?? null,
      queue_date: today,
      queue_number: nextNumber,
      status: 'waiting',
      estimated_wait_minutes: 15,
      checked_in_at: new Date().toISOString(),
    })
    .select('id, patient_name, queue_number, status, sms_phone, estimated_wait_minutes, checked_in_at')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/receptionist/queue')
  revalidatePath('/doctor/queue')
  return entry
}

export async function callNextPatient(doctorId: string, clinicId?: string) {
  const supabase = await getSession()
  const today = new Date().toISOString().split('T')[0]!

  const { data: currentCalled } = await supabase
    .from('walk_in_queue')
    .select('id')
    .eq('doctor_id', doctorId)
    .eq('queue_date', today)
    .eq('status', 'called')
    .maybeSingle()

  if (currentCalled) {
    await supabase.from('walk_in_queue').update({ status: 'in_progress' }).eq('id', currentCalled.id)
  }

  const { data: nextWaiting } = await supabase
    .from('walk_in_queue')
    .select('id, queue_number, sms_phone, patient_name')
    .eq('doctor_id', doctorId)
    .eq('queue_date', today)
    .eq('status', 'waiting')
    .order('queue_number', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!nextWaiting) return null

  const { error: updateError } = await supabase
    .from('walk_in_queue')
    .update({ status: 'called', called_at: new Date().toISOString() })
    .eq('id', nextWaiting.id)

  if (updateError) throw new Error(updateError.message)
  revalidatePath('/receptionist/queue')
  revalidatePath('/doctor/queue')
  return {
    id: nextWaiting.id,
    queueNumber: nextWaiting.queue_number,
    patientName: nextWaiting.patient_name,
    smsPhone: nextWaiting.sms_phone,
    status: 'called',
  }
}

export async function completeCurrentPatient(doctorId: string, clinicId?: string) {
  const supabase = await getSession()
  const today = new Date().toISOString().split('T')[0]!

  const { error } = await supabase
    .from('walk_in_queue')
    .update({ status: 'completed' })
    .eq('doctor_id', doctorId)
    .eq('queue_date', today)
    .eq('status', 'in_progress')

  if (error) throw new Error(error.message)
  revalidatePath('/receptionist/queue')
  revalidatePath('/doctor/queue')
  return { success: true }
}

export async function getTodayQueue(doctorId: string) {
  const supabase = await getSession()
  const today = new Date().toISOString().split('T')[0]!

  const { data, error } = await supabase
    .from('walk_in_queue')
    .select(
      'id, patient_name, queue_number, status, sms_phone, estimated_wait_minutes, checked_in_at, called_at, doctors!inner(id, users!inner(full_name))',
    )
    .eq('doctor_id', doctorId)
    .eq('queue_date', today)
    .order('queue_number', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => ({
    id: row.id,
    patientName: row.patient_name,
    queueNumber: row.queue_number,
    status: row.status,
    smsPhone: row.sms_phone,
    estimatedWaitMinutes: row.estimated_wait_minutes,
    checkedInAt: row.checked_in_at,
    calledAt: row.called_at,
  }))
}

export async function getQueueDisplay(clinicId: string) {
  const supabase = await getSession()
  const today = new Date().toISOString().split('T')[0]!
  const { data, error } = await supabase
    .from('walk_in_queue')
    .select('queue_number, status, patient_name, doctor_id, doctors!inner(id, users!inner(full_name))')
    .eq('clinic_id', clinicId)
    .eq('queue_date', today)
    .in('status', ['waiting', 'called', 'in_progress'])
    .order('queue_number', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => ({
    queueNumber: row.queue_number,
    status: row.status,
    patientName: row.patient_name,
    doctorId: row.doctor_id,
    doctorName: (row.doctors as any)?.users?.full_name,
  }))
}

export async function updateQueueStatus(id: string, status: string, userId: string, role: UserRole) {
  const supabase = await getSession()
  const { error } = await supabase.from('walk_in_queue').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/receptionist/queue')
  revalidatePath('/doctor/queue')
  revalidatePath('/display/clinic')
  return { success: true }
}

export async function getDoctorsList() {
  const supabase = await getSession()
  const { data, error } = await supabase
    .from('doctors')
    .select('id, specialization, users!inner(full_name, is_active)')
    .eq('users.is_active', true)
    .order('users.full_name')

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => ({
    id: row.id,
    fullName: row.users?.full_name,
    specialization: row.specialization,
  }))
}
