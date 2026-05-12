'use client'

import ProtectedPage from '@/components/ui/ProtectedPage'
import { useAuth } from '@/lib/auth-context'
import { useState } from 'react'
import { apiRequest } from '@/lib/api-client'

interface CreatedUser { id: string; fullName: string; email: string; role: string }

export default function AdminStaffPage() {
  const { accessToken } = useAuth()
  const [form, setForm] = useState({ fullName: '', email: '', password: 'password123', role: 'doctor' })
  const [created, setCreated] = useState<CreatedUser[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create staff')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Create Staff Account</h1>
          <p className="text-gray-500 text-sm mt-1">Add doctors and receptionists to the platform</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" value={form.fullName} onChange={set('fullName')} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                  placeholder="Dr. Jane Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={set('role')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600">
                  <option value="doctor">Doctor</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={set('email')} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                placeholder="jane@clinic.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
              <input type="text" value={form.password} onChange={set('password')} required minLength={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600" />
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 border border-red-200">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-brand-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-60">
              {loading ? 'Creating…' : 'Create Account'}
            </button>
          </form>
        </div>

        {created.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Created This Session</h2>
            <div className="space-y-2">
              {created.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{u.fullName}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">{u.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  )
}
