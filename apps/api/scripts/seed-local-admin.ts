import 'dotenv/config'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

const PASSWORD = 'password123'

const TEST_USERS = [
  { email: 'admin@mediqueue.com',        fullName: 'System Admin',      role: 'admin' },
  { email: 'patient@test.com',           fullName: 'Test Patient',      role: 'patient' },
  { email: 'doctor@test.com',            fullName: 'Dr. Test Doctor',   role: 'doctor' },
  { email: 'receptionist@test.com',      fullName: 'Test Receptionist', role: 'receptionist' },
]

async function upsertUser(pool: pg.Pool, passwordHash: string, u: typeof TEST_USERS[0]) {
  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [u.email])
  if (rows.length > 0) {
    await pool.query('UPDATE users SET password_hash = $1, is_active = true WHERE email = $2', [passwordHash, u.email])
    console.log(`  [UPDATED] ${u.email}`)
    return rows[0].id as string
  }
  const userId = uuidv4()
  await pool.query(
    `INSERT INTO users (id, email, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5)`,
    [userId, u.email, passwordHash, u.fullName, u.role]
  )
  console.log(`  [CREATED] ${u.email}`)
  return userId
}

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    const passwordHash = await bcrypt.hash(PASSWORD, 12)
    console.log(`\nSeeding test accounts (password: ${PASSWORD})\n`)

    for (const u of TEST_USERS) {
      const userId = await upsertUser(pool, passwordHash, u)

      // Ensure linked profile rows exist
      if (u.role === 'patient') {
        const { rows } = await pool.query('SELECT id FROM patients WHERE user_id = $1', [userId])
        if (rows.length === 0) {
          const patientId = uuidv4()
          await pool.query(`INSERT INTO patients (id, user_id) VALUES ($1, $2)`, [patientId, userId])
          await pool.query(`INSERT INTO penalty_profiles (id, patient_id) VALUES ($1, $2)`, [uuidv4(), patientId])
          console.log(`    → patients + penalty_profiles row created`)
        }
      }

      if (u.role === 'doctor') {
        const { rows } = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [userId])
        if (rows.length === 0) {
          await pool.query(
            `INSERT INTO doctors (id, user_id, specialization, license_number, slots_per_hour, working_hours)
             VALUES ($1, $2, 'General Practice', $3, 4, '{}')`,
            [uuidv4(), userId, `LIC-${uuidv4().slice(0, 8).toUpperCase()}`]
          )
          console.log(`    → doctors row created`)
        }
      }
    }

    console.log('\nDone! All test accounts ready.')
  } finally {
    await pool.end()
  }
}

main().catch(console.error)
