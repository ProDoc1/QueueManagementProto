'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import {
  Map, FileText, Navigation, Heart, Bell, LogOut, ChevronRight, User,
} from 'lucide-react'

const NAV = [
  { id: 'finder',  label: 'Clinic Finder',  href: '/patient/book',         icon: Map },
  { id: 'tokens',  label: 'My Tokens',       href: '/patient/appointments', icon: FileText },
  { id: 'nearby',  label: 'Nearby',          href: '/patient/book',         icon: Navigation },
  { id: 'saved',   label: 'Favourites',      href: '/patient/favorites',    icon: Heart },
  { id: 'profile', label: 'My Profile',      href: '/patient/profile',      icon: User },
]

const BOTTOM_MOBILE = [
  { id: 'finder',  label: 'Home',    href: '/patient/book',         icon: Map },
  { id: 'tokens',  label: 'Tokens',  href: '/patient/appointments', icon: FileText },
  { id: 'profile', label: 'Profile', href: '/patient/profile',      icon: User },
]

export default function PatientShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (user.role !== 'patient') { router.replace('/login'); return }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  if (!user || user.role !== 'patient') return null

  const activeId = pathname.includes('/profile') ? 'profile' : pathname.includes('/appointments') ? 'tokens' : pathname.includes('/favorites') ? 'saved' : 'finder'

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-[#f7f8fc] overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-52 bg-white border-r border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-200">
          <div className="w-8 h-8 rounded-lg bg-[#1A73E8] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">MQ</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-none">MediQueue</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Patient Portal</p>
          </div>
        </div>

        <nav className="flex-1 py-2.5 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {NAV.map((item) => {
            const Icon = item.icon
            const isActive = activeId === item.id
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`mx-2 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-[#1A73E8] text-white font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-gray-200 space-y-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-[#1A73E8] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {user.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{user.fullName}</p>
              <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="md:hidden w-8 h-8 rounded-lg bg-[#1A73E8] flex items-center justify-center mr-1">
              <span className="text-white text-xs font-bold">MQ</span>
            </div>
            <h1 className="text-sm font-semibold text-gray-900">
              {activeId === 'tokens' ? 'My Tokens' : activeId === 'saved' ? 'Favourites' : activeId === 'profile' ? 'My Profile' : 'Clinic Finder'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center">
              <Bell className="w-4 h-4 text-gray-500" />
            </button>
            <Link href="/patient/appointments">
              <div className="relative w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center">
                <FileText className="w-4 h-4 text-gray-500" />
              </div>
            </Link>
            <div className="w-8 h-8 rounded-full bg-[#1A73E8] flex items-center justify-center text-white text-xs font-semibold">
              {user.fullName.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>

        {/* Bottom nav — mobile */}
        <div className="md:hidden flex-shrink-0 bg-white border-t border-gray-200 flex items-center justify-around px-2 py-2">
          {BOTTOM_MOBILE.map((tab) => {
            const Icon = tab.icon
            const isActive = activeId === tab.id
            return (
              <Link key={tab.id} href={tab.href} className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg">
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#1A73E8]' : 'text-gray-400'}`} />
                <span className={`text-[10px] font-medium ${isActive ? 'text-[#1A73E8]' : 'text-gray-400'}`}>
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
