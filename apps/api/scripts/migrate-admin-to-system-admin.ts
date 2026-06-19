/**
 * Data migration script to rename 'admin' role to 'system_admin'
 *
 * This script should be run AFTER applying the migration:
 * apps/api/migrations/2_system_admin_features.sql
 *
 * Usage:
 * npx ts-node apps/api/scripts/migrate-admin-to-system-admin.ts
 */

import 'dotenv/config'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

async function migrate() {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    console.log('Starting migration: admin → system_admin...')

    // Update users table
    const result = await client.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE role = $2 RETURNING id, email, role',
      ['system_admin', 'admin']
    )

    console.log(`✓ Updated ${result.rowCount} user(s) from 'admin' to 'system_admin'`)

    // Log the migration event
    if (result.rowCount && result.rowCount > 0) {
      const userIds = result.rows.map((r) => r.id)
      await client.query(
        `INSERT INTO system_audit_log (user_id, action, resource, resource_id, old_value, new_value, created_at)
         VALUES (NULL, $1, $2, NULL, $3, $4, NOW())`,
        ['data_migration', 'user_roles', JSON.stringify({ user_ids }), JSON.stringify({ role: 'system_admin', count: result.rowCount })]
      )
      console.log('✓ Logged migration event to system_audit_log')
    }

    await client.query('COMMIT')
    console.log('\n✅ Migration completed successfully!')
    console.log(`Total users migrated: ${result.rowCount}`)

    // Print migrated users
    console.log('\nMigrated users:')
    result.rows.forEach((row) => {
      console.log(`  - ${row.email} (ID: ${row.id})`)
    })

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
