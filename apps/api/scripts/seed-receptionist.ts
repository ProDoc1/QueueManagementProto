/**
 * Seed a medical-center (receptionist) test account into Supabase Auth.
 *
 * Prereqs:
 *  - SUPABASE_SERVICE_ROLE_KEY set in apps/api/.env
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

function loadEnv(filePath: string, target: Record<string, string>) {
  if (!fs.existsSync(filePath)) return
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    target[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
}

const envVars: Record<string, string> = {}
loadEnv(path.resolve(process.cwd(), 'apps', 'web', '.env.local'), envVars)
loadEnv(path.resolve(process.cwd(), 'apps', 'api', '.env'), envVars)

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY!
const EMAIL = 'receptionist@test.com'
const PASSWORD = 'password123'
const FULL_NAME = 'Test Receptionist'

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: { users } } = await admin.auth.admin.listUsers()
  const existing = users?.find((u) => (u.email ?? '').toLowerCase() === EMAIL)
  if (existing) {
    console.log(`[auth] Receptionist user already exists → ${existing.email}`)
    return
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { fullName: FULL_NAME, role: 'receptionist' },
    app_metadata: { role: 'receptionist' },
  })
  if (error) throw new Error(error.message)
  console.log(`[auth] Created receptionist → ${data.user?.email}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
