import { z } from 'zod'

export const AddWalkInSchema = z.object({
  patientName: z.string().min(2).max(100),
  smsPhone: z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
  doctorId: z.string().uuid(),
  clinicId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),  // if patient has an account
})

export const ConvertWalkInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export type AddWalkInInput = z.infer<typeof AddWalkInSchema>
export type ConvertWalkInInput = z.infer<typeof ConvertWalkInSchema>
