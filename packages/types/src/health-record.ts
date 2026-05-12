export type RecordType =
  | 'visit_note'
  | 'lab_result'
  | 'prescription'
  | 'imaging'
  | 'vaccination'
  | 'summary'

export interface VitalsContent {
  bloodPressure?: string
  heartRate?: number
  temperature?: number
  weight?: number
  height?: number
  oxygenSaturation?: number
  notes?: string
}

export interface PrescriptionItem {
  drug: string
  dosage: string
  frequency: string
  duration: string
  instructions?: string
}

export interface PrescriptionContent {
  items: PrescriptionItem[]
  notes?: string
}

export type RecordContent = VitalsContent | PrescriptionContent | Record<string, unknown>

export interface HealthRecord {
  id: string
  patientId: string
  doctorId: string | null
  appointmentId: string | null
  recordType: RecordType
  title: string
  content: RecordContent
  attachments: string[]
  isVisibleToPatient: boolean
  createdAt: string
}

export interface Prescription {
  id: string
  patientId: string
  doctorId: string
  appointmentId: string
  items: PrescriptionItem[]
  notes: string | null
  pdfUrl: string | null
  createdAt: string
}

export interface AppointmentTemplate {
  id: string
  doctorId: string
  name: string
  visitNote: string | null
  prescriptionItems: PrescriptionItem[]
  createdAt: string
}
