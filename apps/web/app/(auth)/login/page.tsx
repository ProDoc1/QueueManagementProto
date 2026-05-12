'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

const roleHome: Record<string, string> = {
  patient:      '/patient/book',
  doctor:       '/doctor/schedule',
  receptionist: '/receptionist/queue',
  admin:        '/admin/staff',
}

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      const res = await fetch('/api/auth/me-redirect')
      // Role-based redirect handled after login context updates
      router.push('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-brand-900">MediQueue</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          New patient?{' '}
          <Link href="/register" className="text-brand-600 font-medium hover:underline">
            Create account
          </Link>
        </p>

        <div className="mt-6 border-t pt-4">
          <p className="text-xs text-gray-400 text-center mb-2">Test accounts</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            {[
              { role: 'Admin',        email: 'admin@test.com' },
              { role: 'Doctor',       email: 'doctor@test.com' },
              { role: 'Receptionist', email: 'receptionist@test.com' },
              { role: 'Patient',      email: 'patient@test.com' },
            ].map(({ role, email: e }) => (
              <button
                key={e}
                type="button"
                onClick={() => { setEmail(e); setPassword('password123') }}
                className="text-left bg-gray-50 hover:bg-brand-50 border border-gray-200 rounded px-2 py-1 transition-colors"
              >
                <span className="font-medium text-gray-700">{role}</span>
                <br />{e}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
