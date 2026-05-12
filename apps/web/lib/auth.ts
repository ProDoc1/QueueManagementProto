'use client'

import { apiRequest } from './api-client'
import type { User } from '@repo/types'

export async function login(email: string, password: string): Promise<{ user: User; accessToken: string }> {
  return apiRequest('/api/auth/login', { method: 'POST', body: { email, password } })
}

export async function register(data: {
  email: string; password: string; fullName: string; phone?: string; role?: string
}): Promise<{ user: User; accessToken: string }> {
  return apiRequest('/api/auth/register', { method: 'POST', body: data })
}

export async function refreshToken(): Promise<{ accessToken: string }> {
  return apiRequest('/api/auth/refresh', { method: 'POST' })
}

export async function logout(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST' })
}

export async function getMe(token: string): Promise<User> {
  return apiRequest('/api/auth/me', { token })
}
