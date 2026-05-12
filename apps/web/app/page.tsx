'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const roleHome: Record<string, string> = {
  patient:      '/patient/book',
  doctor:       '/doctor/schedule',
  receptionist: '/receptionist/queue',
  admin:        '/admin/staff',
}

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    router.replace(roleHome[user.role] ?? '/login')
  }, [user, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-400 text-sm">Redirecting…</div>
    </div>
  )
}
