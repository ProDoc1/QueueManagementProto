import { createClient } from '@/utils/supabase/server'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import type { User, UserRole } from '@repo/types'
import type { RegisterInput, StaffRegisterInput, LoginInput } from '@repo/schemas'

export async function registerUser(input: RegisterInput): Promise<{ user: User; refreshToken: string }> {
  const supabase = await createClient()
  if (input.role !== 'patient') {
    throw new Error('Only patients can self-register')
  }

  const { data: existing } = await supabase.from('users').select('id').eq('email', input.email).maybeSingle()
  if (existing) throw new Error('Email already registered')

  const passwordHash = await bcrypt.hash(input.password, 12)
  const id = uuidv4()

  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({ id, email: input.email, password_hash: passwordHash, phone: input.phone ?? null, full_name: input.fullName, role: 'patient' })
    .select('id, email, phone, full_name, role, avatar_url, is_active, created_at, updated_at')
    .single()

  if (userError || !user) throw new Error(userError?.message ?? 'Registration failed')

  const patientId = uuidv4()
  await supabase.from('patients').insert({ id: patientId, user_id: id })
  await supabase.from('penalty_profiles').insert({ id: uuidv4(), patient_id: patientId })

  const typedUser: User = {
    id: user.id,
    email: user.email,
    phone: user.phone ?? null,
    fullName: user.full_name,
    role: user.role as UserRole,
    avatarUrl: user.avatar_url ?? null,
    isActive: user.is_active,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  }

  const refreshToken = uuidv4()
  await supabase.from('refresh_sessions').insert({
    id: `refresh:${typedUser.id}:${refreshToken}`,
    user_id: typedUser.id,
    hash: await bcrypt.hash(refreshToken, 8),
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  })

  return { user: typedUser, refreshToken }
}

export async function createStaffUser(input: StaffRegisterInput): Promise<User> {
  const supabase = await createClient()
  const { data: existing } = await supabase.from('users').select('id').eq('email', input.email).maybeSingle()
  if (existing) throw new Error('Email already registered')

  const passwordHash = await bcrypt.hash(input.password, 12)
  const id = uuidv4()

  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({ id, email: input.email, password_hash: passwordHash, phone: input.phone ?? null, full_name: input.fullName, role: input.role })
    .select('id, email, phone, full_name, role, avatar_url, is_active, created_at, updated_at')
    .single()

  if (userError || !user) throw new Error(userError?.message ?? 'Staff creation failed')

  if (input.role === 'doctor') {
    await supabase.from('doctors').insert({
      id: uuidv4(),
      user_id: id,
      specialization: 'General Practice',
      license_number: input.licenseNumber ?? `LIC-${uuidv4().slice(0, 8).toUpperCase()}`,
      slots_per_hour: 4,
      working_hours: {},
    })
  }

  const typedUser: User = {
    id: user.id,
    email: user.email,
    phone: user.phone ?? null,
    fullName: user.full_name,
    role: user.role as UserRole,
    avatarUrl: user.avatar_url ?? null,
    isActive: user.is_active,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  }
  return typedUser
}

export async function loginUser(input: LoginInput): Promise<{ user: User; refreshToken: string }> {
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('users')
    .select('id, email, password_hash, phone, full_name, role, avatar_url, is_active, created_at, updated_at')
    .eq('email', input.email)
    .maybeSingle()

  if (error || !row) throw new Error('Invalid credentials')

  const valid = await bcrypt.compare(input.password, row.password_hash)
  if (!valid) throw new Error('Invalid credentials')
  if (!row.is_active) throw new Error('Account suspended')

  const typedUser: User = {
    id: row.id,
    email: row.email,
    phone: row.phone ?? null,
    fullName: row.full_name,
    role: row.role as UserRole,
    avatarUrl: row.avatar_url ?? null,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

  const refreshToken = uuidv4()
  await supabase.from('refresh_sessions').insert({
    id: `refresh:${typedUser.id}:${refreshToken}`,
    user_id: typedUser.id,
    hash: await bcrypt.hash(refreshToken, 8),
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  })

  return { user: typedUser, refreshToken }
}

export async function refreshTokens(refreshToken: string): Promise<{ accessToken: string }> {
  const supabase = await createClient()
  const { data: session } = await supabase
    .from('refresh_sessions')
    .select('id, user_id, expires_at')
    .eq('id', `refresh:${refreshToken}`)
    .maybeSingle()

  if (!session || new Date(session.expires_at) < new Date()) throw new Error('Session expired')

  const { data: user } = await supabase.from('users').select('id, email, role, is_active').eq('id', session.user_id).maybeSingle()
  if (!user || !user.is_active) throw new Error('User not found')

  const typedUser: User = {
    id: user.id,
    email: user.email,
    phone: user.phone ?? null,
    fullName: '',
    role: user.role as UserRole,
    avatarUrl: null,
    isActive: user.is_active,
    createdAt: '',
    updatedAt: '',
  }

  const newRefreshToken = uuidv4()
  await supabase.from('refresh_sessions').delete().eq('id', `refresh:${typedUser.id}:${refreshToken}`)
  await supabase.from('refresh_sessions').insert({
    id: `refresh:${typedUser.id}:${newRefreshToken}`,
    user_id: typedUser.id,
    hash: await bcrypt.hash(newRefreshToken, 8),
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  })

  return { accessToken: uuidv4() }
}

export async function logoutUser(userId: string) {
  const supabase = await createClient()
  await supabase.from('refresh_sessions').delete().eq('user_id', userId)
}

export async function getCurrentUser(userId: string): Promise<User | null> {
  const supabase = await createClient()
  const { data: user } = await supabase
    .from('users')
    .select('id, email, phone, full_name, role, avatar_url, is_active, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle()

  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    phone: user.phone ?? null,
    fullName: user.full_name,
    role: user.role as UserRole,
    avatarUrl: user.avatar_url ?? null,
    isActive: user.is_active,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  }
}
