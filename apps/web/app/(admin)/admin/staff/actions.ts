'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createStaffRecord(data: { fullName: string; email: string; role: string }) {
  const supabase = await createClient()
  
  const { fullName, email, role } = data
  // Note: we are currently just inserting into the data tables directly.
  
  if (role === 'doctor') {
    const { data, error } = await supabase
      .from('doctors')
      .insert([{ full_name: fullName, email, specialization: 'General Practice' }]) // Default specialization
      .select()
      .single()
      
    if (error) throw new Error(error.message)
    revalidatePath('/admin/staff')
    return { id: data.id, fullName: data.full_name, email: data.email, role: 'doctor' }
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
