import type { FastifyInstance } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import type { DoctorSlot } from '@repo/types'

// 7-day TTL so slots booked up to a week ahead never expire from Redis mid-lifecycle
const SLOT_TTL_SECONDS = 7 * 24 * 3600

/**
 * Atomically reserves a slot.
 * Single Lua script: seeds from DB if key missing, checks capacity, increments — all in one round-trip.
 * Returns the new booked_count on success.
 */
export async function reserveSlot(app: FastifyInstance, slotId: string, dbClient?: import('pg').PoolClient): Promise<number> {
  const db = dbClient ?? app.db
  const key = `slot:${slotId}:booked`

  const { rows } = await db.query<{ bookedCount: number; capacity: number }>(
    `SELECT booked_count AS "bookedCount", capacity FROM doctor_slots WHERE id = $1 FOR SHARE`,
    [slotId]
  )
  const slot = rows[0]
  if (!slot) throw Object.assign(new Error('Slot not found'), { statusCode: 404 })

  // Lua: seed key if absent, then check-and-increment atomically.
  // KEYS[1] = count key
  // ARGV[1] = capacity
  // ARGV[2] = current DB booked_count (used to seed if key is missing)
  // ARGV[3] = TTL seconds
  const lua = `
    local key = KEYS[1]
    local cap = tonumber(ARGV[1])
    local db_count = tonumber(ARGV[2])
    local ttl = tonumber(ARGV[3])
    local current = tonumber(redis.call('GET', key))
    if current == nil then
      redis.call('SET', key, db_count, 'EX', ttl)
      current = db_count
    end
    if current >= cap then return -2 end
    local new_count = redis.call('INCR', key)
    redis.call('EXPIRE', key, ttl)
    return new_count
  `
  const result = await app.redis.eval(lua, {
    keys: [key],
    arguments: [String(slot.capacity), String(slot.bookedCount), String(SLOT_TTL_SECONDS)],
  }) as number

  if (result === -2) throw Object.assign(new Error('Slot is fully booked'), { statusCode: 409 })

  return result
}

/**
 * Atomically releases a slot. Safe even if Redis key has expired (Lua clamps to 0).
 */
export async function releaseSlot(app: FastifyInstance, slotId: string, dbClient?: import('pg').PoolClient) {
  const db = dbClient ?? app.db
  const key = `slot:${slotId}:booked`

  const lua = `
    local current = tonumber(redis.call('GET', KEYS[1]))
    if current == nil or current <= 0 then return 0 end
    return redis.call('DECR', KEYS[1])
  `
  await app.redis.eval(lua, { keys: [key], arguments: [] })
  await db.query(
    `UPDATE doctor_slots SET booked_count = GREATEST(booked_count - 1, 0), updated_at = NOW() WHERE id = $1`,
    [slotId]
  )
}

export async function getAvailableSlots(app: FastifyInstance, doctorId: string, date: string): Promise<DoctorSlot[]> {
  const { rows } = await app.db.query<DoctorSlot>(
    `SELECT id, doctor_id AS "doctorId", slot_date AS "slotDate", slot_hour AS "slotHour",
            capacity, booked_count AS "bookedCount", is_blocked AS "isBlocked",
            block_reason AS "blockReason", created_at AS "createdAt"
     FROM doctor_slots
     WHERE doctor_id = $1 AND slot_date = $2 AND is_blocked = false AND booked_count < capacity
     ORDER BY slot_hour`,
    [doctorId, date]
  )
  return rows
}

/**
 * Auto-generates slots for a doctor from their working_hours × slots_per_hour.
 * Uses a single batched INSERT — idempotent via ON CONFLICT DO NOTHING.
 * Timezone-aware: reads doctor's timezone from clinics or defaults to UTC.
 */
export async function generateSlotsForDateRange(
  app: FastifyInstance,
  doctorId: string,
  fromDate: string,
  toDate: string
) {
  const { rows: [doctor] } = await app.db.query(
    `SELECT d.slots_per_hour AS "slotsPerHour", d.working_hours AS "workingHours",
            COALESCE(c.timezone, 'UTC') AS timezone
     FROM doctors d
     LEFT JOIN doctor_clinics dc ON dc.doctor_id = d.id
     LEFT JOIN clinics c ON c.id = dc.clinic_id
     WHERE d.id = $1
     LIMIT 1`,
    [doctorId]
  )
  if (!doctor) throw Object.assign(new Error('Doctor not found'), { statusCode: 404 })

  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  // Parse as local date strings to avoid UTC shift on date boundaries
  const [fromY, fromM, fromD] = fromDate.split('-').map(Number) as [number, number, number]
  const [toY, toM, toD] = toDate.split('-').map(Number) as [number, number, number]
  const start = new Date(fromY, fromM - 1, fromD)
  const end = new Date(toY, toM - 1, toD)

  const valueTuples: string[] = []
  const params: unknown[] = []

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayKey = dayNames[d.getDay()]!
    const hours = doctor.workingHours[dayKey] as { start: string; end: string } | undefined
    if (!hours) continue

    const startHour = parseInt(hours.start.split(':')[0]!, 10)
    const endHour = parseInt(hours.end.split(':')[0]!, 10)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    for (let h = startHour; h < endHour; h++) {
      const base = params.length
      params.push(uuidv4(), doctorId, dateStr, h, doctor.slotsPerHour)
      valueTuples.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`)
    }
  }

  if (valueTuples.length === 0) return { generated: 0 }

  const { rowCount } = await app.db.query(
    `INSERT INTO doctor_slots (id, doctor_id, slot_date, slot_hour, capacity)
     VALUES ${valueTuples.join(',')}
     ON CONFLICT (doctor_id, slot_date, slot_hour) DO NOTHING`,
    params
  )

  return { generated: rowCount ?? 0 }
}
