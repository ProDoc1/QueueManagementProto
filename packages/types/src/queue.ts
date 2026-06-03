export type QueueStatus = 'waiting' | 'called' | 'in_progress' | 'completed' | 'left'

export interface WalkInQueueEntry {
  id: string
  patientName: string
  patientId: string | null       // null if no account
  doctorId: string
  clinicId: string | null
  queueDate: string              // "YYYY-MM-DD"
  queueNumber: number
  status: QueueStatus
  smsPhone: string | null        // optional: notify by SMS
  estimatedWaitMinutes: number | null
  checkedInAt: string
  calledAt: string | null
  // joined
  doctorName?: string
}

