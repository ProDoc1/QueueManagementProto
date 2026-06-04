'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { UserRole } from '@repo/types'

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: UserRole
  avatarUrl: string | null
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.user) {
        const metadata = session.user.user_metadata ?? {}
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          fullName: metadata.fullName ?? '',
          role: ((metadata.role as UserRole) || 'patient'),
          avatarUrl: metadata.avatarUrl ?? null,
        })
      }
      setLoading(false)
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const metadata = session.user.user_metadata ?? {}
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          fullName: metadata.fullName ?? '',
          role: ((metadata.role as UserRole) || 'patient'),
          avatarUrl: metadata.avatarUrl ?? null,
        })
      } else {
        setUser(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('User not found')
    const metadata = data.user.user_metadata ?? {}
    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email ?? '',
      fullName: metadata.fullName ?? '',
      role: ((metadata.role as UserRole) || 'patient'),
      avatarUrl: metadata.avatarUrl ?? null,
    }
    setUser(authUser)
    return authUser
  }, [supabase])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [supabase])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
