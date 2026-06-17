'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createStaffRecord(data: { fullName: string; email: string; role: string; password?: string }) {
  const supabase = await createClient()
  
  const { fullName, email, role, password } = data
  // Note: we are currently just inserting into the data tables directly.

  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .insert([{ full_name: fullName, email, role, password_hash: password || 'temp_hash', is_active: true }])
    .select()
    .single()
    
  if (userError) throw new Error(userError.message)
  
  if (role === 'doctor') {
    const { data: result, error } = await supabase
      .from('doctors')
      .insert([{ user_id: userRecord.id, full_name: fullName, email, specialization: 'General Practice', temporary_password: password }]) // Default specialization
      .select()
      .single()
      
    if (error) throw new Error(error.message)
    revalidatePath('/admin/staff')
    return { id: result.id, fullName: userRecord.full_name, email: userRecord.email, role: 'doctor' }
  } else if (role === 'receptionist') {
    const { data, error } = await supabase
      .from('receptionists')
      .insert([{ full_name: fullName, email }])
      .select()
      .single()
      
    if (error) throw new Error(error.message)
    revalidatePath('/admin/staff')
    return { id: data.id, fullName: data.full_name, email: data.email, role: 'receptionist' }
  } else if (role === 'admin') {
    const { data, error } = await supabase
      .from('system_admins')
      .insert([{ full_name: fullName, email }])
      .select()
      .single()
      
    if (error) throw new Error(error.message)
    revalidatePath('/admin/staff')
    return { id: data.id, fullName: data.full_name, email: data.email, role: 'admin' }
  } else {
    throw new Error('Invalid role specified.')
  }
}
