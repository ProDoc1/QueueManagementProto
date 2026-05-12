-- Medical Center Platform — Initial Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT,
  phone          TEXT,
  full_name      TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('admin','doctor','patient','receptionist')),
  avatar_url     TEXT,
  oauth_provider TEXT,
  oauth_id       TEXT,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  -- At least one auth method required
  CONSTRAINT users_auth_method CHECK (password_hash IS NOT NULL OR oauth_provider IS NOT NULL)
);

-- CLINICS
CREATE TABLE clinics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  address    TEXT,
  latitude   DOUBLE PRECISION,
  longitude  DOUBLE PRECISION,
  phone      TEXT,
  -- IANA timezone name (e.g. 'Asia/Colombo', 'America/New_York')
  timezone   TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOCTORS
CREATE TABLE doctors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialization   TEXT NOT NULL DEFAULT 'General Practice',
  license_number   TEXT UNIQUE NOT NULL,
  bio              TEXT,
  consultation_fee NUMERIC(10,2),
  slots_per_hour   INT NOT NULL DEFAULT 4 CHECK (slots_per_hour BETWEEN 1 AND 12),
  is_available     BOOLEAN DEFAULT true,
  working_hours    JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- DOCTOR <-> CLINIC (many-to-many)
CREATE TABLE doctor_clinics (
  doctor_id  UUID REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_id  UUID REFERENCES clinics(id) ON DELETE CASCADE,
  PRIMARY KEY (doctor_id, clinic_id)
);

-- PATIENTS
CREATE TABLE patients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth     DATE,
  gender            TEXT,
  blood_type        TEXT,
  allergies         TEXT[] DEFAULT '{}',
  emergency_contact JSONB,
  insurance_info    JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- PENALTY PROFILES
CREATE TABLE penalty_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id         UUID UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  no_show_count      INT DEFAULT 0 CHECK (no_show_count >= 0),
  late_cancel_count  INT DEFAULT 0 CHECK (late_cancel_count >= 0),
  penalty_level      INT DEFAULT 0 CHECK (penalty_level IN (0,1,2,3)),
  penalty_expires_at TIMESTAMPTZ,
  last_infraction_at TIMESTAMPTZ,   -- tracks 60-day good-behaviour window
  last_evaluated_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- DOCTOR SLOTS
CREATE TABLE doctor_slots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id    UUID REFERENCES doctors(id) ON DELETE CASCADE,
  slot_date    DATE NOT NULL,
  slot_hour    INT NOT NULL CHECK (slot_hour >= 0 AND slot_hour <= 23),
  capacity     INT NOT NULL DEFAULT 4 CHECK (capacity > 0),
  booked_count INT DEFAULT 0 CHECK (booked_count >= 0),
  is_blocked   BOOLEAN DEFAULT false,
  block_reason TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (doctor_id, slot_date, slot_hour),
  -- Defense-in-depth: DB should never exceed capacity (Redis is the primary gate)
  CONSTRAINT slots_count_within_capacity CHECK (booked_count <= capacity)
);

CREATE INDEX idx_slots_doctor_date           ON doctor_slots(doctor_id, slot_date);
CREATE INDEX idx_slots_available             ON doctor_slots(doctor_id, slot_date, slot_hour)
  WHERE is_blocked = false;

-- APPOINTMENTS
CREATE TABLE appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          UUID REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id           UUID REFERENCES doctors(id) ON DELETE RESTRICT,
  slot_id             UUID REFERENCES doctor_slots(id) ON DELETE RESTRICT,
  appointment_date    TIMESTAMPTZ NOT NULL,
  slot_position       INT NOT NULL DEFAULT 1,
  status              TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','confirmed','in_progress','completed','cancelled','no_show')),
  type                TEXT NOT NULL DEFAULT 'in_person' CHECK (type IN ('in_person','virtual')),
  is_late_number      BOOLEAN DEFAULT false,
  notes               TEXT,
  cancellation_reason TEXT,
  cancelled_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointments_doctor_date    ON appointments(doctor_id, appointment_date);
CREATE INDEX idx_appointments_patient        ON appointments(patient_id);
CREATE INDEX idx_appointments_slot           ON appointments(slot_id);
CREATE INDEX idx_appointments_patient_status ON appointments(patient_id, status);
CREATE INDEX idx_appointments_doctor_status  ON appointments(doctor_id, appointment_date, status);

-- Prevents duplicate active bookings for the same patient in the same slot
CREATE UNIQUE INDEX idx_appointments_no_dup  ON appointments(patient_id, slot_id)
  WHERE status <> 'cancelled';

-- WAITLIST
CREATE TABLE waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  slot_id    UUID REFERENCES doctor_slots(id) ON DELETE CASCADE,
  position   INT NOT NULL,
  notified   BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (patient_id, slot_id)
);

CREATE INDEX idx_waitlist_slot_position ON waitlist(slot_id, position) WHERE notified = false;

-- HEALTH RECORDS
CREATE TABLE health_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id            UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id             UUID REFERENCES doctors(id) ON DELETE SET NULL,
  appointment_id        UUID REFERENCES appointments(id) ON DELETE SET NULL,
  record_type           TEXT NOT NULL
                          CHECK (record_type IN ('visit_note','lab_result','prescription','imaging','vaccination','summary')),
  title                 TEXT NOT NULL,
  content               JSONB NOT NULL DEFAULT '{}',
  attachments           TEXT[] DEFAULT '{}',
  is_visible_to_patient BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_records_patient   ON health_records(patient_id, created_at DESC);
CREATE INDEX idx_health_records_appt      ON health_records(appointment_id);

-- PRESCRIPTIONS
CREATE TABLE prescriptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id      UUID REFERENCES doctors(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  items          JSONB NOT NULL DEFAULT '[]',
  notes          TEXT,
  pdf_url        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id, created_at DESC);

-- APPOINTMENT TEMPLATES (doctor quick-fill)
CREATE TABLE appointment_templates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id          UUID REFERENCES doctors(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  visit_note         TEXT,
  prescription_items JSONB NOT NULL DEFAULT '[]',
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- DOCTOR LOCATIONS
CREATE TABLE doctor_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   UUID UNIQUE REFERENCES doctors(id) ON DELETE CASCADE,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  clinic_name TEXT,
  address     TEXT,
  is_live     BOOLEAN DEFAULT false,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- DOCTOR SUBSCRIPTIONS
CREATE TABLE doctor_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id     UUID REFERENCES doctors(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (patient_id, doctor_id)
);

CREATE INDEX idx_doctor_subscriptions_doctor ON doctor_subscriptions(doctor_id);

-- WALK-IN QUEUE
CREATE TABLE walk_in_queue (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name           TEXT NOT NULL,
  patient_id             UUID REFERENCES patients(id) ON DELETE SET NULL,
  doctor_id              UUID REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_id              UUID REFERENCES clinics(id) ON DELETE SET NULL,
  queue_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  queue_number           INT NOT NULL,
  status                 TEXT DEFAULT 'waiting'
                           CHECK (status IN ('waiting','called','in_progress','completed','left')),
  sms_phone              TEXT,
  estimated_wait_minutes INT,
  checked_in_at          TIMESTAMPTZ DEFAULT NOW(),
  called_at              TIMESTAMPTZ,
  -- Prevents duplicate queue numbers for the same doctor on the same day
  UNIQUE (doctor_id, queue_date, queue_number)
);

CREATE INDEX idx_queue_doctor_date   ON walk_in_queue(doctor_id, queue_date);
CREATE INDEX idx_queue_active_status ON walk_in_queue(doctor_id, queue_date, status)
  WHERE status IN ('waiting','called','in_progress');

-- VIDEO ROOMS
CREATE TABLE video_rooms (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  room_name      TEXT UNIQUE NOT NULL,
  started_at     TIMESTAMPTZ,
  ended_at       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- RATINGS
CREATE TABLE ratings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID REFERENCES patients(id) ON DELETE SET NULL,
  doctor_id      UUID REFERENCES doctors(id) ON DELETE CASCADE,
  appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE SET NULL,
  stars          INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ratings_doctor ON ratings(doctor_id);

-- INSURANCE VERIFICATIONS
CREATE TABLE insurance_verifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  status         TEXT DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  verified_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  notes          TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS (90-day retention enforced by nightly job)
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data       JSONB,
  is_read    BOOLEAN DEFAULT false,
  sent_via   TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user       ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- AUDIT LOG (append-only; partitioned by month in production)
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  resource_id UUID,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user       ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_resource   ON audit_log(resource, resource_id, created_at DESC);
