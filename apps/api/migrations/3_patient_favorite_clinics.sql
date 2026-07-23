-- Create patient_favorite_clinics table
CREATE TABLE IF NOT EXISTS patient_favorite_clinics (
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (patient_id, clinic_id)
);
