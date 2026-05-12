import { z } from 'zod'

const WorkingHoursSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
})

export const UpdateDoctorSchema = z.object({
  specialization: z.string().min(2).max(100).optional(),
  bio: z.string().max(2000).optional(),
  consultationFee: z.number().positive().optional(),
  slotsPerHour: z.number().int().min(1).max(12).optional(),
  workingHours: z.object({
    mon: WorkingHoursSchema.optional(),
    tue: WorkingHoursSchema.optional(),
    wed: WorkingHoursSchema.optional(),
    thu: WorkingHoursSchema.optional(),
    fri: WorkingHoursSchema.optional(),
    sat: WorkingHoursSchema.optional(),
    sun: WorkingHoursSchema.optional(),
  }).optional(),
})

export const UpdateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  clinicName: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  isLive: z.boolean().optional(),
})

export const BroadcastDelaySchema = z.object({
  delayMinutes: z.number().int().min(1).max(240),
  message: z.string().max(500).optional(),
})

export type UpdateDoctorInput = z.infer<typeof UpdateDoctorSchema>
export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>
export type BroadcastDelayInput = z.infer<typeof BroadcastDelaySchema>
