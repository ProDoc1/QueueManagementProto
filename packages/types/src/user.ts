export type UserRole = 'admin' | 'doctor' | 'patient' | 'receptionist'

export interface User {
  id: string
  email: string
  phone: string | null
  fullName: string
  role: UserRole
  avatarUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface JwtPayload {
  sub: string
  role: UserRole
  email: string
}
