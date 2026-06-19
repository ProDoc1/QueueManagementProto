-- System Admin Features — Account Bans, Audit Logs, Statistics, Maintenance Mode

-- ── Step 1: Update users role constraint ────────────────────────────────────
-- Rename 'admin' role to 'system_admin' in CHECK constraint
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('patient','doctor','receptionist','system_admin'));

-- Migrate existing 'admin' roles to 'system_admin'
UPDATE users SET role = 'system_admin' WHERE role = 'admin';

-- ── Step 2: Account Bans Table ──────────────────────────────────────────────
CREATE TABLE account_bans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  banned_by       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  banned_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  is_permanent    BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_account_bans_user_id      ON account_bans(user_id);
CREATE INDEX idx_account_bans_is_permanent ON account_bans(is_permanent);
CREATE INDEX idx_account_bans_expires_at   ON account_bans(expires_at) WHERE is_permanent = false;

-- ── Step 3: System Audit Log Table ─────────────────────────────────────────
CREATE TABLE system_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  resource_id UUID,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_audit_log_user       ON system_audit_log(user_id, created_at DESC);
CREATE INDEX idx_system_audit_log_action     ON system_audit_log(action, created_at DESC);
CREATE INDEX idx_system_audit_log_resource   ON system_audit_log(resource, resource_id, created_at DESC);
CREATE INDEX idx_system_audit_log_created_at ON system_audit_log(created_at DESC);

-- ── Step 4: Login Audit Log Table ──────────────────────────────────────────
CREATE TABLE login_audit_log (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  email           TEXT NOT NULL,
  role            TEXT,
  ip_address      INET,
  user_agent      TEXT,
  status          TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  failure_reason  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_login_audit_log_user_id   ON login_audit_log(user_id, created_at DESC);
CREATE INDEX idx_login_audit_log_email     ON login_audit_log(email, created_at DESC);
CREATE INDEX idx_login_audit_log_status    ON login_audit_log(status, created_at DESC);
CREATE INDEX idx_login_audit_log_created_at ON login_audit_log(created_at DESC);

-- ── Step 5: System Settings Table ──────────────────────────────────────────
CREATE TABLE system_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       JSONB NOT NULL DEFAULT '{}',
  updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_settings_key ON system_settings(key);
CREATE INDEX idx_system_settings_updated_at ON system_settings(updated_at DESC);

-- Initialize default system settings
INSERT INTO system_settings (key, value) VALUES
  ('maintenance_mode', '{"enabled": false, "message": "", "estimated_downtime_minutes": 0}'),
  ('version', '{"current": "1.0.0"}')
ON CONFLICT (key) DO NOTHING;

-- ── Step 6: Statistics Table (time-series data) ────────────────────────────
CREATE TABLE statistics (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stat_date               DATE NOT NULL UNIQUE,
  active_doctors          INT DEFAULT 0,
  registered_patients     INT DEFAULT 0,
  tokens_issued           INT DEFAULT 0,
  appointments_completed  INT DEFAULT 0,
  appointments_cancelled  INT DEFAULT 0,
  appointment_no_shows    INT DEFAULT 0,
  total_clinics           INT DEFAULT 0,
  error_count             INT DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_statistics_stat_date ON statistics(stat_date DESC);
CREATE INDEX idx_statistics_created_at ON statistics(created_at DESC);

-- ── Step 7: Create helper functions ────────────────────────────────────────

-- Check if user is banned
CREATE OR REPLACE FUNCTION is_user_banned(user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM account_bans
    WHERE user_id = user_id_param
    AND (is_permanent = true OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Get current system setting value
CREATE OR REPLACE FUNCTION get_system_setting(key_param TEXT)
RETURNS JSONB AS $$
BEGIN
  RETURN (SELECT value FROM system_settings WHERE key = key_param LIMIT 1);
END;
$$ LANGUAGE plpgsql STABLE;
