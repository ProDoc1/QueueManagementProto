'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, type UserRole } from '@/lib/auth-context'

interface Props {
  allowedRoles: UserRole[]
  children: React.ReactNode
}

export default function ProtectedPage({ allowedRoles, children }: Props) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (!allowedRoles.includes(user.role)) { router.replace('/'); return }
  }, [user, loading, router, allowedRoles])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading…</div>
      </div>
    )
  }

  if (!user || !allowedRoles.includes(user.role)) return null

  return <>{children}</>
}
