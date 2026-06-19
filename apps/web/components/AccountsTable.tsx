'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import { Search, ShieldOff, ShieldCheck, Loader2 } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  system_admin: 'bg-[#EA4335]/15 text-[#EA4335]',
  admin:        'bg-[#1A73E8]/15 text-[#1A73E8]',
  doctor:       'bg-[#9C27B0]/15 text-[#9C27B0]',
  receptionist: 'bg-[#F9AB00]/15 text-[#F9AB00]',
  patient:      'bg-[#34A853]/15 text-[#34A853]',
}

export interface PlatformUser {
  id: string
  fullName: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}

interface Props {
  initialUsers: PlatformUser[]
}

const ROLES = ['all', 'patient', 'doctor', 'receptionist', 'admin', 'system_admin']
const STATUSES = ['all', 'active', 'suspended']

export default function AccountsTable({ initialUsers }: Props) {
  const { accessToken } = useAuth()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch]       = useState('')
  const [roleFilter, setRole]     = useState('all')
  const [statusFilter, setStatus] = useState('all')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError]         = useState('')

  // ── Client-side filter (instant) ──────────────────────────────────────────
  const filtered = initialUsers.filter((u) => {
    const matchSearch =
      !search ||
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole   = roleFilter   === 'all' || u.role === roleFilter
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active'    &&  u.isActive) ||
      (statusFilter === 'suspended' && !u.isActive)
    return matchSearch && matchRole && matchStatus
  })

  // ── Toggle suspend / activate ──────────────────────────────────────────────
  async function handleToggle(user: PlatformUser) {
    setLoadingId(user.id)
    setError('')
    try {
      await apiRequest(`/api/auth/users/${user.id}/status`, {
        method: 'PATCH',
        token: accessToken ?? undefined,
        body: { isActive: !user.isActive },
      })
      startTransition(() => router.refresh())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update account status')
    } finally {
      setLoadingId(null)
    }
  }

  const suspended = initialUsers.filter((u) => !u.isActive).length
  const active    = initialUsers.filter((u) =>  u.isActive).length

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Users',  value: initialUsers.length, color: 'text-white' },
          { label: 'Active',       value: active,              color: 'text-[#34A853]' },
          { label: 'Suspended',    value: suspended,           color: 'text-[#EA4335]' },
        ].map((s) => (
          <div key={s.label} className="bg-[#141B2B] rounded-xl px-4 py-3 border border-white/5">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-[#EA4335]/10 border border-[#EA4335]/20 rounded-lg px-4 py-2.5 text-xs text-[#EA4335]">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-[#141B2B] rounded-xl border border-white/5 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-white/5">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="w-full bg-[#0D1117] border border-white/10 text-white text-xs rounded-lg pl-8 pr-3 py-2 placeholder-gray-600 outline-none focus:border-[#1A73E8]/40 transition-colors"
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRole(e.target.value)}
            className="bg-[#0D1117] border border-white/10 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-[#1A73E8]/40 transition-colors capitalize"
          >
            {ROLES.map((r) => (
              <option key={r} value={r} className="capitalize">{r === 'all' ? 'All Roles' : r.replace('_', ' ')}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-[#0D1117] border border-white/10 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-[#1A73E8]/40 transition-colors"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          <span className="text-[11px] text-gray-600 ml-auto whitespace-nowrap">
            {filtered.length} / {initialUsers.length} users
          </span>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center text-xs text-gray-500">No users match your filters.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0D1117]/50">
                <th className="px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((u) => {
                const isLoading = loadingId === u.id || (isPending && loadingId === u.id)
                return (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* User info */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold text-gray-300 flex-shrink-0">
                          {(u.fullName || u.email).slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white leading-tight">{u.fullName || '—'}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role badge */}
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${ROLE_COLORS[u.role] ?? 'bg-white/10 text-gray-300'}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        u.isActive
                          ? 'bg-[#34A853]/15 text-[#34A853]'
                          : 'bg-[#EA4335]/15 text-[#EA4335]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-[#34A853]' : 'bg-[#EA4335]'}`} />
                        {u.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>

                    {/* Joined */}
                    <td className="px-5 py-3.5 text-[11px] text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleToggle(u)}
                        disabled={!!loadingId}
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          u.isActive
                            ? 'bg-[#EA4335]/10 text-[#EA4335] hover:bg-[#EA4335]/20 border border-[#EA4335]/20'
                            : 'bg-[#34A853]/10 text-[#34A853] hover:bg-[#34A853]/20 border border-[#34A853]/20'
                        }`}
                      >
                        {isLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : u.isActive ? (
                          <ShieldOff className="w-3 h-3" />
                        ) : (
                          <ShieldCheck className="w-3 h-3" />
                        )}
                        {u.isActive ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
