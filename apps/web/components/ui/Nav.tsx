'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'

const roleLinks: Record<string, { label: string; href: string }[]> = {
  patient: [
    { label: 'Book Appointment', href: '/patient/book' },
    { label: 'My Appointments', href: '/patient/appointments' },
  ],
  doctor: [
    { label: 'Schedule', href: '/doctor/schedule' },
    { label: 'Queue', href: '/doctor/queue' },
  ],
  receptionist: [
    { label: 'Queue', href: '/receptionist/queue' },
  ],
  admin: [
    { label: 'Create Staff', href: '/admin/staff' },
  ],
}

const roleBadgeColor: Record<string, string> = {
  patient:      'bg-green-100 text-green-800',
  doctor:       'bg-blue-100 text-blue-800',
  receptionist: 'bg-purple-100 text-purple-800',
  admin:        'bg-red-100 text-red-800',
}

export default function Nav() {
  const { user, logout } = useAuth()
  const router = useRouter()

  if (!user) return null

  const links = roleLinks[user.role] ?? []

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-brand-600 font-bold text-lg tracking-tight">
          MediQueue
        </Link>
        <div className="flex gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-gray-600 hover:text-brand-600 font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${roleBadgeColor[user.role]}`}>
          {user.role}
        </span>
        <span className="text-sm text-gray-700 font-medium">{user.fullName}</span>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  )
}
