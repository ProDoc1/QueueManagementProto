'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth, type UserRole } from '@/lib/auth-context'
import {
  LayoutDashboard, Activity, UserPlus, Clock, Building2,
  Bell, ChevronLeft, Settings, MonitorPlay, Calendar,
} from 'lucide-react'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { useI18n } from '@/lib/i18n'

type NavItem = { id: string; label: string; href: string; icon: React.ComponentType<{ className?: string }> }

const DOCTOR_NAV: NavItem[] = [
  { id: 'schedule', label: 'My Schedule',   href: '/doctor/schedule', icon: Calendar },
  { id: 'queue',    label: 'Walk-In Queue', href: '/doctor/queue',    icon: Activity },
]

const RECEPTIONIST_NAV: NavItem[] = [
  { id: 'queue', label: 'Live Queue', href: '/receptionist/queue', icon: Activity },
]

const ADMIN_NAV: NavItem[] = [
  { id: 'dashboard',   label: 'Dashboard',       href: '/admin/staff',          icon: LayoutDashboard },
  { id: 'staff',       label: 'Create Staff',    href: '/admin/staff',          icon: UserPlus },
  { id: 'medi-center', label: 'Medi Center',     href: '/admin/medi-center',    icon: Building2 },
  { id: 'queue',       label: 'Live Queue',      href: '/receptionist/queue',   icon: Activity },
]

const navByRole: Record<string, NavItem[]> = {
  doctor:       DOCTOR_NAV,
  receptionist: RECEPTIONIST_NAV,
  admin:        ADMIN_NAV,
}

const allowedRoles: UserRole[] = ['doctor', 'receptionist', 'admin']

const roleLabel: Record<string, string> = {
  doctor:       'Doctor Portal',
  receptionist: 'Receptionist',
  admin:        'Admin Panel',
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (!allowedRoles.includes(user.role)) { router.replace('/login'); return }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1117]">
        <div className="text-gray-500 text-sm">Loading…</div>
      </div>
    )
  }

  if (!user || !allowedRoles.includes(user.role)) return null

  const nav = navByRole[user.role] ?? []

  const activeId = nav.find((n) => pathname.startsWith(n.href))?.id ?? nav[0]?.id

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-[#0D1117] overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar */}
      <aside className="flex flex-col w-52 bg-[#111827] flex-shrink-0 border-r border-white/5">
        <div className="px-5 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1A73E8] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">MQ</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">MediQueue</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{roleLabel[user.role]}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {nav.map((item) => {
            const Icon = item.icon
            const isActive = activeId === item.id
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-[#1A2237] text-white font-medium border-l-2 border-[#1A73E8]'
                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#1A73E8]' : ''}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-2 py-3 border-t border-white/5 space-y-0.5">
          <Link
            href="/display/clinic"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          >
            <MonitorPlay className="w-3.5 h-3.5" /> {t('publicDisplay')}
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> {t('signOut')}
          </button>
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-[#34A853] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-white truncate">{user.fullName}</p>
              <p className="text-[10px] text-gray-500 truncate capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-[#111827] border-b border-white/5 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-white">
              {nav.find((n) => n.id === activeId)?.label ?? 'Dashboard'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">MediQueue Clinic</p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="flex items-center gap-1.5 bg-[#34A853]/15 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34A853] animate-pulse" />
              <span className="text-xs text-[#34A853] font-medium">Live</span>
            </div>
            <button className="relative w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <Bell className="w-4 h-4 text-gray-400" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#EA4335]" />
            </button>
            <div className="w-8 h-8 rounded-full bg-[#34A853] flex items-center justify-center text-white text-xs font-bold">
              {user.fullName.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    </div>
  )
}
