export type NotificationType =
  | 'appointment_reminder'
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'doctor_delay'
  | 'penalty_issued'
  | 'waitlist_available'
  | 'follow_up_suggestion'
  | 'queue_called'
  | 'queue_update'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  data: Record<string, unknown> | null
  isRead: boolean
  sentVia: string[]
  createdAt: string
}

// Socket.IO event payloads
export interface DoctorDelayEvent {
  doctorId: string
  delayMinutes: number
  message: string
}

export interface SlotUpdateEvent {
  slotId: string
  availableCount: number
}

export interface DoctorLocationEvent {
  doctorId: string
  lat: number
  lng: number
  timestamp: string
}

export interface DoctorStatusEvent {
  doctorId: string
  status: 'available' | 'busy' | 'offline'
}

export interface QueueUpdateEvent {
  clinicId: string
  doctorId: string
  currentNumber: number | null
  waitingCount: number
}
