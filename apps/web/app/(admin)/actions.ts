'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@repo/types'

async function getSession() {
  return createClient()
}

export async function getAdminStaff() {
  const supabase = await getSession()
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, created_at')
    .in('role', ['doctor', 'receptionist', 'admin'])
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  }))
}



export async function createStaffRecord(input: {
  fullName: string
  email: string
  role: string
}) {
  const supabase = await getSession()
  const passwordHash = require('bcryptjs').hashSync('password123', 12)
  const userId = require('uuid').v4()

  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      id: userId,
      email: input.email,
      password_hash: passwordHash,
      full_name: input.fullName,
      role: input.role,
      is_active: true,
    })
    .select('id, email, full_name, role')
    .single()

  if (userError) throw new Error(userError.message)
  revalidatePath('/admin/staff')
  return user
}

export async function listDoctorsForAdmin() {
  const supabase = await getSession()
  const { data, error } = await supabase
    .from('doctors')
    .select('id, specialization, users!inner(full_name, email, avatar_url)')
    .order('users(full_name)')

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => ({
    id: row.id,
    fullName: row.users?.full_name,
    email: row.users?.email,
    avatarUrl: row.users?.avatar_url,
    specialization: row.specialization,
  }))
}
