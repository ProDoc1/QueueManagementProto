/**
 * Seed-adm.ts
 *
 * Creates a single System Admin test account in Supabase Auth + system_admins table.
 *
 * Prerequisites
 *  1. Add SUPABASE_SERVICE_ROLE_KEY to apps/api/.env  (Supabase Dashboard → Project Settings → API → service_role)
 *  2. Ensure auth.users and system_admins RLS policies allow inserts, OR disable RLS locally.
 *  3. Run:  npx tsx apps/api/scripts/seed-admin.ts
 *
 * Reads from apps/web/.env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_ADMIN_EMAIL  (defaults to admin@mediqueue.com)
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

/* --------------------------------------------------------------------------- */

function loadEnv(filePath: string, target: Record<string, string>) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    target[key] = value
  }
}

const webEnvPath = path.resolve(process.cwd(), 'apps', 'web', '.env.local')
const apiEnvPath = path.resolve(process.cwd(), 'apps', 'api', '.env')
const envVars: Record<string, string> = {}
loadEnv(webEnvPath, envVars)
loadEnv(apiEnvPath, envVars)

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? envVars.NEXT_PUBLIC_ADMIN_EMAIL ?? 'admin@mediqueue.com').toLowerCase()
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'password123'
const ADMIN_NAME = process.env.ADMIN_FULL_NAME ?? 'System Admin'

if (!SUPABASE_URL) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL in apps/web/.env.local')
  process.exit(1)
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in apps/api/.env')
  console.error('Get it from: Supabase Dashboard → Project Settings → API → service_role key')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/* --------------------------------------------------------------------------- */
/* 1. Ensure Auth user exists                                                     */
/* --------------------------------------------------------------------------- */

async function ensureAuthUser() {
  const { data: { users } } = await admin.auth.admin.listUsers()
  const existing = users?.find((u) => (u.email ?? '').toLowerCase() === ADMIN_EMAIL) ?? null

  if (existing) {
    console.log(`[auth] User already exists → ${existing.email} (${existing.id})`)
    return existing
  }

  console.log(`[auth] Creating admin auth user: ${ADMIN_EMAIL}`)

  const { data, error } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { fullName: ADMIN_NAME, role: 'admin' },
    app_metadata: { role: 'admin' },
  })

  if (error) throw new Error(`Failed to create auth user: ${error.message}`)
  console.log(`[auth] Created → ${data.user?.email} (${data.user?.id})`)
  return data.user!
}

/* --------------------------------------------------------------------------- */
/* 2. Ensure profile row in system_admins                                         */
/* --------------------------------------------------------------------------- */

async function ensureAdminProfile(authUserId: string) {
  const { data: existing } = await admin
    .from('system_admins')
    .select('id, full_name, email')
    .eq('user_id', authUserId)
    .maybeSingle()

  if (existing) {
    console.log(`[profile] system_admins row already exists → ${existing.email}`)
    return existing
  }

  console.log(`[profile] Creating system_admins row for ${ADMIN_EMAIL}`)

  const { data, error } = await admin
    .from('system_admins')
    .insert({ user_id: authUserId, full_name: ADMIN_NAME, email: ADMIN_EMAIL })
    .select()
    .single()

  if (error) throw new Error(`Failed to create system_admins row: ${error.message}`)
  console.log(`[profile] Created → ${data.email}`)
}

/* --------------------------------------------------------------------------- */

async function main() {
  console.log(`Seeding System Admin\n`)
  console.log(`  email   : ${ADMIN_EMAIL}`)
  console.log(`  password: ${ADMIN_PASSWORD}\n`)

  const user = await ensureAuthUser()
  await ensureAdminProfile(user.id)

  console.log('\nDone. Login at: Select "System Admin" tile → email admin@mediqueue.com / password123')
}

main().catch((err) => { console.error(err); process.exit(1) })
