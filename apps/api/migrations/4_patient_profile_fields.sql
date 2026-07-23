-- Patient Profile Fields — NIC, address, health conditions

ALTER TABLE patients ADD COLUMN IF NOT EXISTS nic TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS health_conditions TEXT[] DEFAULT '{}';
