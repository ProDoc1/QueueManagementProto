export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'late_number'

export type AppointmentType = 'in_person' | 'virtual'

export interface DoctorSlot {
  id: string
  doctorId: string
  slotDate: string       // "YYYY-MM-DD"
  slotHour: number       // 0–23
  capacity: number
  bookedCount: number
  isBlocked: boolean
  blockReason: string | null
  createdAt: string
}

export interface Appointment {
  id: string
  patientId: string
  doctorId: string
  slotId: string
  appointmentDate: string
  slotPosition: number
  status: AppointmentStatus
  type: AppointmentType
  isLateNumber: boolean
  notes: string | null
  cancellationReason: string | null
  cancelledAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  // joined
  doctorName?: string
  patientName?: string
  specialization?: string
}

export interface Waitlist {
  id: string
  patientId: string
  slotId: string
  position: number
  notified: boolean
  createdAt: string
}
