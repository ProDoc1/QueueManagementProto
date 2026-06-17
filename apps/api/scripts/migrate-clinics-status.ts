import 'dotenv/config'
import pg from 'pg'

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  try {
    await pool.query(`
      ALTER TABLE clinics
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('pending','active','suspended'))
    `)
    console.log('✓ clinics.status column ensured')
  } finally {
    await pool.end()
  }
}

main().catch(console.error)
