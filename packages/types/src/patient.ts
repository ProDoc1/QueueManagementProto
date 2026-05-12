export interface EmergencyContact {
  name: string
  phone: string
  relation: string
}

export interface InsuranceInfo {
  provider: string
  policyNumber: string
  groupNumber?: string
  expiryDate?: string
}

export type PenaltyLevel = 0 | 1 | 2 | 3

export interface Patient {
  id: string
  userId: string
  dateOfBirth: string | null
  gender: string | null
  bloodType: string | null
  allergies: string[]
  emergencyContact: EmergencyContact | null
  insuranceInfo: InsuranceInfo | null
  createdAt: string
  // joined
  fullName?: string
  email?: string
  phone?: string | null
  penaltyLevel?: PenaltyLevel
}

export interface PenaltyProfile {
  id: string
  patientId: string
  noShowCount: number
  lateCancelCount: number
  penaltyLevel: PenaltyLevel
  penaltyExpiresAt: string | null
  lastEvaluatedAt: string | null
  updatedAt: string
}
