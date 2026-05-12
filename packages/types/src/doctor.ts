export interface WorkingHours {
  start: string // "09:00"
  end: string   // "17:00"
}

export interface WorkingSchedule {
  mon?: WorkingHours
  tue?: WorkingHours
  wed?: WorkingHours
  thu?: WorkingHours
  fri?: WorkingHours
  sat?: WorkingHours
  sun?: WorkingHours
}

export interface Doctor {
  id: string
  userId: string
  specialization: string
  licenseNumber: string
  bio: string | null
  consultationFee: number | null
  slotsPerHour: number
  isAvailable: boolean
  workingHours: WorkingSchedule
  createdAt: string
  // joined
  fullName?: string
  email?: string
  avatarUrl?: string | null
  rating?: number | null
  locationLat?: number | null
  locationLng?: number | null
  clinicName?: string | null
}

export interface DoctorLocation {
  id: string
  doctorId: string
  latitude: number
  longitude: number
  clinicName: string | null
  address: string | null
  isLive: boolean
  updatedAt: string
}
