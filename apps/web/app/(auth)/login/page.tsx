'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

const ROLE_HOME: Record<string, string> = {
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
      const user = await login(email, password)
      router.push(ROLE_HOME[user?.role ?? ''] ?? '/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0D1117] flex flex-col items-center justify-center p-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#1A73E8] flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(26,115,232,0.25)]">
            <span className="text-white text-lg font-black">MQ</span>
          </div>
          <h1 className="text-2xl font-black text-white">MediQueue</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="bg-[#141B2B] rounded-2xl border border-white/5 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 placeholder-gray-600 outline-none focus:border-[#1A73E8]/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 placeholder-gray-600 outline-none focus:border-[#1A73E8]/50 transition-colors"
              />
            </div>

            {error && (
              <div className="bg-[#EA4335]/10 border border-[#EA4335]/20 rounded-lg px-3 py-2.5 text-xs text-[#EA4335]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A73E8] hover:bg-[#1557B0] disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-5">
            New patient?{' '}
            <Link href="/register" className="text-[#1A73E8] font-medium hover:underline">
              Create account
            </Link>
          </p>

          {/* Test accounts */}
          <div className="mt-6 border-t border-white/5 pt-5">
            <p className="text-xs text-gray-600 text-center mb-3">Test accounts</p>
            <div className="grid grid-cols-2 gap-2">
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
                  className="text-left bg-[#0D1117] hover:bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 transition-colors"
                >
                  <span className="block text-xs font-medium text-gray-300">{role}</span>
                  <span className="block text-[10px] text-gray-600 truncate">{e}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
