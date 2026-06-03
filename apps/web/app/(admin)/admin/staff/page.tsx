'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiRequest } from '@/lib/api-client'
import { UserPlus, X, CheckCircle } from 'lucide-react'

interface CreatedUser { id: string; fullName: string; email: string; role: string }

const ROLE_COLOR: Record<string, string> = {
  doctor:       'text-[#1A73E8] bg-[#1A73E8]/15',
  receptionist: 'text-[#9C27B0] bg-[#9C27B0]/15',
  admin:        'text-[#EA4335] bg-[#EA4335]/15',
}

export default function AdminStaffPage() {
  const { accessToken } = useAuth()
  const [form, setForm] = useState({ fullName: '', email: '', password: 'password123', role: 'doctor' })
  const [created, setCreated] = useState<CreatedUser[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await apiRequest<CreatedUser>('/api/auth/staff', {
        method: 'POST',
        token: accessToken ?? undefined,
        body: form,
      })
      setCreated((prev) => [user, ...prev])
      setForm((f) => ({ ...f, fullName: '', email: '' }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create staff')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ scrollbarWidth: 'none' }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Register Staff</h2>
          <p className="text-xs text-gray-500 mt-0.5">Add doctors and receptionists to the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500">{created.length} created this session</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Registration form */}
        <div className="bg-[#141B2B] rounded-xl p-5 border border-white/5">
          <h3 className="text-sm font-semibold text-white mb-4">New Staff Account</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1.5 block">Full Name</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={set('fullName')}
                  required
                  placeholder="Dr. Jane Doe"
                  className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 placeholder-gray-600 outline-none focus:border-[#1A73E8]/40 transition-colors"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1.5 block">Role</label>
                <select
                  value={form.role}
                  onChange={set('role')}
                  className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-[#1A73E8]/40 transition-colors"
                >
                  <option value="doctor">Doctor</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  required
                  placeholder="jane@clinic.com"
                  className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 placeholder-gray-600 outline-none focus:border-[#1A73E8]/40 transition-colors"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-1.5 block">Temporary Password</label>
                <input
                  type="text"
                  value={form.password}
                  onChange={set('password')}
                  required
                  minLength={8}
                  className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 placeholder-gray-600 outline-none focus:border-[#1A73E8]/40 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-[#EA4335]/10 border border-[#EA4335]/20 rounded-lg px-3 py-2.5">
                <X className="w-4 h-4 text-[#EA4335] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#EA4335]">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full font-semibold py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2 ${
                saved
                  ? 'bg-[#34A853] text-white'
                  : 'bg-[#1A73E8] hover:bg-[#1557B0] text-white disabled:opacity-50'
              }`}
            >
              {saved ? (
                <><CheckCircle className="w-4 h-4" />Account Created!</>
              ) : loading ? (
                'Creating…'
              ) : (
                <><UserPlus className="w-4 h-4" />Create Account</>
              )}
            </button>
          </form>
        </div>

        {/* Created this session */}
        <div className="bg-[#141B2B] rounded-xl p-5 border border-white/5">
          <h3 className="text-sm font-semibold text-white mb-4">Created This Session</h3>
          {created.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                <UserPlus className="w-5 h-5 text-gray-600" />
              </div>
              <p className="text-xs text-gray-600">No accounts created yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {created.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#1A73E8]/20 flex items-center justify-center text-[#1A73E8] text-xs font-bold">
                      {u.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{u.fullName}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${ROLE_COLOR[u.role] ?? 'text-gray-400 bg-gray-400/10'}`}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
