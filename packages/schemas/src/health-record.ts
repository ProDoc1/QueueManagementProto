import { z } from 'zod'

export const CreateHealthRecordSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  recordType: z.enum(['visit_note', 'lab_result', 'prescription', 'imaging', 'vaccination', 'summary']),
  title: z.string().min(2).max(200),
  content: z.record(z.unknown()),
  attachments: z.array(z.string().url()).max(20).optional().default([]),
  isVisibleToPatient: z.boolean().default(true),
})

export const CreatePrescriptionSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  items: z.array(z.object({
    drug: z.string().min(1).max(200),
    dosage: z.string().min(1).max(100),
    frequency: z.string().min(1).max(100),
    duration: z.string().min(1).max(100),
    instructions: z.string().max(500).optional(),
  })).min(1).max(20),
  notes: z.string().max(1000).optional(),
})

export const SaveTemplateSchema = z.object({
  name: z.string().min(2).max(100),
  visitNote: z.string().max(5000).optional(),
  prescriptionItems: z.array(z.object({
    drug: z.string().min(1).max(200),
    dosage: z.string().min(1).max(100),
    frequency: z.string().min(1).max(100),
    duration: z.string().min(1).max(100),
    instructions: z.string().max(500).optional(),
  })).max(20).default([]),
})

export type CreateHealthRecordInput = z.infer<typeof CreateHealthRecordSchema>
export type CreatePrescriptionInput = z.infer<typeof CreatePrescriptionSchema>
export type SaveTemplateInput = z.infer<typeof SaveTemplateSchema>
