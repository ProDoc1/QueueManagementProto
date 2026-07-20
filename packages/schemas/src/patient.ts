import { z } from 'zod'

export const UpdatePatientSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
  nic: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  allergies: z.array(z.string().max(100)).max(50).optional(),
  healthConditions: z.array(z.string().max(200)).max(30).optional(),
  emergencyContact: z.object({
    name: z.string().min(2).max(100),
    phone: z.string().regex(/^\+?[1-9]\d{7,14}$/),
    relation: z.string().max(50),
  }).optional(),
  insuranceInfo: z.object({
    provider: z.string().max(100),
    policyNumber: z.string().max(50),
    groupNumber: z.string().max(50).optional(),
    expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).optional(),
})

export type UpdatePatientInput = z.infer<typeof UpdatePatientSchema>

