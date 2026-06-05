'use client'

/**
 * auth-context.tsx — Custom API-based auth (Fastify backend only)
 * All auth calls go to /api/auth/* — no Supabase Auth used here.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { apiRequest } from './api-client'

export type UserRole = 'patient' | 'doctor' | 'receptionist' | 'admin'

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: UserRole
  avatarUrl: string | null
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // On mount — try to restore session from httpOnly refresh cookie
  useEffect(() => {
    async function restore() {
      try {
        const res = await apiRequest<{ accessToken: string }>('/api/auth/refresh', { method: 'POST' })
        setAccessToken(res.accessToken)
        const me = await apiRequest<AuthUser>('/api/auth/me', { token: res.accessToken })
        setUser(me)
      } catch {
        // No active session — that's fine, show login page
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await apiRequest<{ user: AuthUser; accessToken: string }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    setAccessToken(res.accessToken)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', token: accessToken ?? undefined })
    } catch { /* ignore */ }
    setUser(null)
    setAccessToken(null)
  }, [accessToken])

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
