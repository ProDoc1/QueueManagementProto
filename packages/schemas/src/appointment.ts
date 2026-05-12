import { z } from 'zod'

export const BookAppointmentSchema = z.object({
  doctorId: z.string().uuid(),
  slotId: z.string().uuid(),
  notes: z.string().max(1000).optional(),
  type: z.enum(['in_person', 'virtual']).default('in_person'),
})

export const CancelAppointmentSchema = z.object({
  reason: z.string().max(500).optional(),
})

export const GenerateSlotsSchema = z.object({
  doctorId: z.string().uuid(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const BlockSlotSchema = z.object({
  reason: z.string().max(200).optional(),
})

export type BookAppointmentInput = z.infer<typeof BookAppointmentSchema>
export type CancelAppointmentInput = z.infer<typeof CancelAppointmentSchema>
export type GenerateSlotsInput = z.infer<typeof GenerateSlotsSchema>
