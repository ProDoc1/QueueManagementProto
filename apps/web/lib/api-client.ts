'use client'

import { useAuth, type UserRole } from './auth-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

type RequestOptions = {
  method?: string
  body?: unknown
  token?: string
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`
  if (opts.body) headers['Content-Type'] = 'application/json'

  let res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })

  // Auto-refresh: if we get a 401 and had a token, try refreshing it once
  if (res.status === 401 && opts.token) {
    try {
      const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (refreshRes.ok) {
        const { accessToken } = await refreshRes.json() as { accessToken: string }
        headers['Authorization'] = `Bearer ${accessToken}`
        res = await fetch(`${API_URL}${path}`, {
          method: opts.method ?? 'GET',
          credentials: 'include',
          headers,
          body: opts.body ? JSON.stringify(opts.body) : undefined,
        })
      }
    } catch {
      // Refresh failed — fall through to the original 401 error
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw Object.assign(new Error(err.error ?? 'Request failed'), { status: res.status })
  }

  return res.json()
}

export async function listDoctorsPublic(params: {
  specialization?: string
  available?: string
  after?: string
  limit?: number
}): Promise<{ data: any[]; nextCursor: string | null }> {
  const res = await fetch('/api/doctors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'Request failed')
  }
  return res.json()
}

export async function getAppointmentsForPatient(userId: string) {
  const res = await fetch('/api/appointments/patient', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch appointments')
  return res.json()
}

export async function bookAppointmentForPatient(userId: string, input: {
  doctorId: string
  slotId: string
  type?: string
}) {
  const res = await fetch('/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...input }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'Booking failed')
  }
  return res.json()
}

export async function cancelAppointmentForPatient(appointmentId: string, userId: string, reason?: string) {
  const res = await fetch(`/api/appointments/${appointmentId}/cancel`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, reason }),
  })
  if (!res.ok) throw new Error('Cancellation failed')
  return res.json()
}

export async function getAvailableSlotsForDoctor(doctorId: string, date: string) {
  const res = await fetch(`/api/appointments/slots?doctorId=${doctorId}&date=${date}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch slots')
  return res.json()
}

export async function getQueueForDoctor(doctorId: string, token: string) {
  const res = await fetch(`/api/queue?doctorId=${doctorId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch queue')
  return res.json()
}

export async function callNextForDoctor(doctorId: string, clinicId?: string, token = '') {
  const res = await fetch('/api/queue/call-next', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ doctorId, clinicId }),
  })
  if (!res.ok) throw new Error('Failed to call next')
  return res.json()
}

export async function completeCurrentForDoctor(doctorId: string, token = '') {
  const res = await fetch('/api/queue/complete-current', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ doctorId }),
  })
  if (!res.ok) throw new Error('Failed to complete')
  return res.json()
}

export async function getDoctorProfileMe(token: string) {
  const res = await fetch('/api/doctors/me', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch profile')
  return res.json()
}

export async function updateDoctorProfile(input: Record<string, unknown>, token: string) {
  const res = await fetch('/api/doctors/me', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to update profile')
  return res.json()
}

export async function getDoctorSchedule(userId: string, date?: string) {
  const res = await fetch('/api/appointments/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, date }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch schedule')
  return res.json()
}

export async function getQueueDisplay(clinicId: string) {
  const res = await fetch(`/api/queue/display/${clinicId}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch display')
  return res.json()
}

export async function addWalkInPatient(input: {
  patientName: string
  smsPhone?: string
  doctorId: string
  clinicId?: string
}, token: string) {
  const res = await fetch('/api/queue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'Failed to add patient')
  }
  return res.json()
}

export async function getPenaltyStatus(userId: string, token: string) {
  const res = await fetch('/api/appointments/penalty/me', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return { penaltyLevel: 0 }
  return res.json()
}

export async function getTemplateList(token: string) {
  const res = await fetch('/api/health-records/templates', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  return res.json()
}

export function useAuthClient() {
  const { user, accessToken } = useAuth()
  return {
    user,
    accessToken: accessToken ?? '',
    isAuthenticated: !!user,
    isPatient: user?.role === 'patient',
    isDoctor: user?.role === 'doctor',
    isReceptionist: user?.role === 'receptionist',
    isAdmin: user?.role === 'admin',
    role: (user?.role ?? 'patient') as UserRole,
  }
}
