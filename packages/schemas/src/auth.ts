import { z } from 'zod'

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
  role: z.literal('patient').default('patient'),
})

export const StaffRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
  role: z.enum(['doctor', 'receptionist', 'admin']),
  licenseNumber: z.string().optional(),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type StaffRegisterInput = z.infer<typeof StaffRegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
