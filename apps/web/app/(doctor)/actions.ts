'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UpdatePatientSchema } from '@repo/schemas'
import type { UserRole } from '@repo/types'

async function getSession() {
  return createClient()
}

export async function getMyPatientProfile(userId: string) {
  const supabase = await getSession()
  const { data: patient } = await supabase
    .from('patients')
    .select(
      'id, date_of_birth, gender, blood_type, allergies, emergency_contact, insurance_info, users!inner(full_name, email, phone), penalty_profiles(penalty_level, no_show_count, late_cancel_count, penalty_expires_at)',
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (!patient) return null
  return {
    id: patient.id,
    dateOfBirth: patient.date_of_birth,
    gender: patient.gender,
    bloodType: patient.blood_type,
    allergies: patient.allergies,
    emergencyContact: patient.emergency_contact,
    insuranceInfo: patient.insurance_info,
    fullName: patient.users?.full_name,
    email: patient.users?.email,
    phone: patient.users?.phone,
    penaltyLevel: patient.penalty_profiles?.[0]?.penalty_level ?? 0,
    noShowCount: patient.penalty_profiles?.[0]?.no_show_count ?? 0,
  }
}

export async function getPatientProfileById(id: string) {
  const supabase = await getSession()
  const { data: patient } = await supabase
    .from('patients')
    .select(
      'id, date_of_birth, gender, blood_type, allergies, emergency_contact, users!inner(full_name, email, phone), penalty_profiles(penalty_level, no_show_count, late_cancel_count, penalty_expires_at)',
    )
    .eq('id', id)
    .maybeSingle()

  if (!patient) throw new Error('Patient not found')
  return {
    id: patient.id,
    dateOfBirth: patient.date_of_birth,
    gender: patient.gender,
    bloodType: patient.blood_type,
    allergies: patient.allergies,
    emergencyContact: patient.emergency_contact,
    fullName: patient.users?.full_name,
    email: patient.users?.email,
    phone: patient.users?.phone,
    penaltyLevel: patient.penalty_profiles?.[0]?.penalty_level ?? 0,
    noShowCount: patient.penalty_profiles?.[0]?.no_show_count ?? 0,
  }
}

export async function updateMyPatientProfile(userId: string, input: UpdatePatientSchema) {
  const supabase = await getSession()
  const { data: patient } = await supabase.from('patients').select('id').eq('user_id', userId).maybeSingle()
  if (!patient) throw new Error('Patient profile not found')

  const updates: Record<string, unknown> = {}
  if (input.dateOfBirth) updates.date_of_birth = input.dateOfBirth
  if (input.gender) updates.gender = input.gender
  if (input.bloodType) updates.blood_type = input.bloodType
  if (input.allergies) updates.allergies = input.allergies
  if (input.emergencyContact) updates.emergency_contact = input.emergencyContact
  if (input.insuranceInfo) updates.insurance_info = input.insuranceInfo

  if (Object.keys(updates).length === 0) return { success: true }

  const { error } = await supabase.from('patients').update(updates).eq('id', patient.id)
  if (error) throw new Error(error.message)
  revalidatePath('/patient/appointments')
  return { success: true }
}

export async function listDoctorsPublic(params: {
  specialization?: string
  available?: string
  after?: string
  limit?: number
}): Promise<{ data: any[]; nextCursor: string | null }> {
  const supabase = await getSession()
  const limit = Math.min(params.limit ?? 20, 100)
  let query = supabase
    .from('doctors')
    .select(
      'id, specialization, consultation_fee, slots_per_hour, is_available, users!inner(full_name, avatar_url, is_active), doctor_locations(latitude, longitude, clinic_name)',
      { count: 'exact' },
    )
    .eq('users.is_active', true)
    .order('users.full_name')
    .range(0, limit - 1)

  if (params.specialization) query = query.ilike('specialization', `%${params.specialization}%`)
  if (params.available === 'true') query = query.eq('is_available', true)
  if (params.after) query = query.gt('users.full_name', params.after)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []).map((row: any) => ({
    id: row.id,
    fullName: row.users?.full_name,
    specialization: row.specialization,
    consultationFee: row.consultation_fee,
    isAvailable: row.is_available,
    clinicName: row.doctor_locations?.[0]?.clinic_name,
  }))
  const nextCursor = rows.length === limit ? rows[rows.length - 1]?.fullName ?? null : null
  return { data: rows, nextCursor }
}

export async function getAppointments(userId: string, params?: { status?: string; before?: string }) {
  const supabase = await getSession()
  const { data: patient } = await supabase.from('patients').select('id').eq('user_id', userId).maybeSingle()
  if (!patient) return { data: [], nextCursor: null }

  let query = supabase
    .from('appointments')
    .select(
      'id, appointment_date, status, type, is_late_number, slot_position, notes, created_at, doctors!inner(id, users!inner(full_name, specialization))',
    )
    .eq('patient_id', patient.id)
    .order('appointment_date', { ascending: false })
    .limit(params?.before ? 20 : 20)

  if (params?.status) query = query.eq('status', params.status)
  if (params?.before) query = query.lt('appointment_date', params.before)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []).map((row: any) => ({
    id: row.id,
    appointmentDate: row.appointment_date,
    status: row.status,
    type: row.type,
    isLateNumber: row.is_late_number,
    slotPosition: row.slot_position,
    notes: row.notes,
    doctorName: row.doctors?.users?.full_name,
    specialization: row.doctors?.specialization,
  }))

  return { data: rows, nextCursor: null }
}

export async function bookAppointment(userId: string, input: {
  doctorId: string
  slotId: string
  type?: string
}): Promise<{ slotPosition: number }> {
  const supabase = await getSession()
  const { data: patient } = await supabase.from('patients').select('id').eq('user_id', userId).maybeSingle()
  if (!patient) throw new Error('Patient profile not found')

  const penaltyProfile = await supabase.from('penalty_profiles').select('penalty_level, penalty_expires_at').eq('patient_id', patient.id).maybeSingle()
  const penaltyLevel = penaltyProfile.data?.penalty_level ?? 0
  if (penaltyLevel === 3) throw new Error('Booking suspended due to repeated no-shows')

  const { data: slot, error: slotError } = await supabase
    .from('doctor_slots')
    .select('id, doctor_id, slot_date, slot_hour, capacity, booked_count, is_blocked')
    .eq('id', input.slotId)
    .single()
  if (slotError || !slot) throw new Error('Slot not found')
  if (slot.is_blocked) throw new Error('Slot is blocked')
  if (slot.doctor_id !== input.doctorId) throw new Error('Slot does not belong to this doctor')

  const { data: existing } = await supabase
    .from('appointments')
    .select('id')
    .eq('patient_id', patient.id)
    .eq('slot_id', input.slotId)
    .neq('status', 'cancelled')

  if (existing && existing.length > 0) throw new Error('Already booked for this slot')

  const newBookedCount = slot.booked_count + 1
  if (newBookedCount > slot.capacity) throw new Error('Slot is full')

  const appointmentId = uuidv4()
  const appointmentDate = new Date(
    parseInt(slot.slot_date.split('-')[0]!),
    parseInt(slot.slot_date.split('-')[1]!) - 1,
    parseInt(slot.slot_date.split('-')[2]!),
    slot.slot_hour,
    0,
    0,
  ).toISOString()

  const { error: insertError } = await supabase.from('appointments').insert({
    id: appointmentId,
    patient_id: patient.id,
    doctor_id: input.doctorId,
    slot_id: input.slotId,
    appointment_date: appointmentDate,
    slot_position: newBookedCount,
    status: 'scheduled',
    type: input.type ?? 'in_person',
    is_late_number: penaltyLevel >= 2,
    notes: null,
  })
  if (insertError) throw new Error(insertError.message)

  const { error: updateError } = await supabase
    .from('doctor_slots')
    .update({ booked_count: newBookedCount, updated_at: new Date().toISOString() })
    .eq('id', input.slotId)

  if (updateError) {
    await supabase.from('appointments').delete().eq('id', appointmentId)
    throw new Error(updateError.message)
  }

  return { slotPosition: newBookedCount }
}

export async function getAvailableSlots(doctorId: string, date: string) {
  const supabase = await getSession()
  const { data, error } = await supabase
    .from('doctor_slots')
    .select('id, slot_hour, capacity, booked_count, is_blocked, block_reason')
    .eq('doctor_id', doctorId)
    .eq('slot_date', date)
    .eq('is_blocked', false)
    .lt('booked_count', supabase.raw('capacity'))
    .order('slot_hour')

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => ({
    id: row.id,
    hour: row.slot_hour,
    capacity: row.capacity,
    bookedCount: row.booked_count,
  }))
}

export async function cancelAppointment(appointmentId: string, userId: string, reason?: string) {
  const supabase = await getSession()
  const { data: patient } = await supabase.from('patients').select('id').eq('user_id', userId).maybeSingle()
  if (!patient) throw new Error('Patient profile not found')

  const { data: appt } = await supabase
    .from('appointments')
    .select('id, slot_id, patient_id, status, appointment_date')
    .eq('id', appointmentId)
    .single()

  if (!appt) throw new Error('Appointment not found')
  if (appt.patient_id !== patient.id) throw new Error('Forbidden')
  if (!['scheduled', 'confirmed'].includes(appt.status)) throw new Error('Cannot cancel this appointment')

  const isLate = new Date(appt.appointment_date) < new Date(Date.now() + 2 * 60 * 60 * 1000)

  const { error: updateError } = await supabase
    .from('appointments')
    .update({ status: 'cancelled', cancellation_reason: reason ?? null, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', appointmentId)

  if (updateError) throw new Error(updateError.message)

  const { data: slot } = await supabase
    .from('doctor_slots')
    .select('booked_count')
    .eq('id', appt.slot_id)
    .single()

  if (slot) {
    await supabase
      .from('doctor_slots')
      .update({ booked_count: Math.max((slot.booked_count ?? 0) - 1, 0), updated_at: new Date().toISOString() })
      .eq('id', appt.slot_id)
  }

  if (isLate) {
    const { data: penalty } = await supabase.from('penalty_profiles').select('late_cancel_count').eq('patient_id', patient.id).maybeSingle()
    const newCount = (penalty?.late_cancel_count ?? 0) + 1
    await supabase.from('penalty_profiles').update({ late_cancel_count: newCount, updated_at: new Date().toISOString() }).eq('patient_id', patient.id)
  }

  return { success: true }
}

export async function markAppointmentComplete(appointmentId: string, userId: string, role: UserRole) {
  const supabase = await getSession()
  const { data: appt } = await supabase.select('appointments(id, doctors!inner(user_id))').eq('id', appointmentId).single()
  if (!appt) throw new Error('Appointment not found')
  if (role === 'doctor' && (appt.doctors as any).user_id !== userId) throw new Error('Forbidden')

  const { error } = await supabase
    .from('appointments')
    .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', appointmentId)
  if (error) throw new Error(error.message)
  return { success: true }
}

export async function markAppointmentNoShow(appointmentId: string, userId: string) {
  const supabase = await getSession()
  const { data: doctor } = await supabase.from('doctors').select('id, user_id').eq('user_id', userId).maybeSingle()
  if (!doctor) throw new Error('Doctor profile not found')

  const { data: appt } = await supabase
    .from('appointments')
    .select('id, patient_id, status')
    .eq('id', appointmentId)
    .single()
  if (!appt) throw new Error('Not found')
  if (appt.status === 'no_show') throw new Error('Already marked as no-show')
  if ((appt as any).doctors?.user_id !== userId) throw new Error('Forbidden')

  const { error: apptError } = await supabase
    .from('appointments')
    .update({ status: 'no_show', updated_at: new Date().toISOString() })
    .eq('id', appointmentId)
  if (apptError) throw new Error(apptError.message)

  const { data: penalty } = await supabase
    .from('penalty_profiles')
    .select('no_show_count, penalty_level')
    .eq('patient_id', appt.patient_id)
    .single()

  const noShowCount = (penalty?.no_show_count ?? 0) + 1
  let penaltyLevel = 0
  if (noShowCount >= 5) penaltyLevel = 3
  else if (noShowCount >= 3) penaltyLevel = 2
  else if (noShowCount >= 2) penaltyLevel = 1

  const penaltyExpiresAt =
    penaltyLevel === 3 && (penalty?.penalty_level ?? 0) < 3
      ? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      : penalty?.penalty_expires_at ?? null

  await supabase
    .from('penalty_profiles')
    .update({
      no_show_count: noShowCount,
      last_infraction_at: new Date().toISOString(),
      last_evaluated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      penalty_level: penaltyLevel,
      penalty_expires_at: penaltyExpiresAt,
    })
    .eq('patient_id', appt.patient_id)

  return { success: true }
}

export async function getPenaltyProfile(userId: string) {
  const supabase = await getSession()
  const { data: patient } = await supabase.from('patients').select('id').eq('user_id', userId).maybeSingle()
  if (!patient) return { penaltyLevel: 0 }

  const { data: penalty } = await supabase
    .from('penalty_profiles')
    .select('penalty_level, penalty_expires_at, no_show_count, late_cancel_count')
    .eq('patient_id', patient.id)
    .maybeSingle()

  if (!penalty) return { penaltyLevel: 0 }
  if (penalty.penalty_level > 0 && penalty.penalty_expires_at && new Date(penalty.penalty_expires_at) < new Date()) {
    await supabase
      .from('penalty_profiles')
      .update({ penalty_level: 0, no_show_count: 0, late_cancel_count: 0, penalty_expires_at: null, updated_at: new Date().toISOString() })
      .eq('patient_id', patient.id)
    return { penaltyLevel: 0 }
  }

  return {
    penaltyLevel: penalty.penalty_level,
    noShowCount: penalty.no_show_count,
    lateCancelCount: penalty.late_cancel_count,
    penaltyExpiresAt: penalty.penalty_expires_at,
  }
}

export async function resetPenalty(patientId: string) {
  const supabase = await getSession()
  const { error } = await supabase
    .from('penalty_profiles')
    .update({ penalty_level: 0, no_show_count: 0, late_cancel_count: 0, penalty_expires_at: null, updated_at: new Date().toISOString() })
    .eq('patient_id', patientId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/staff')
  return { success: true }
}
