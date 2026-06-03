'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

export default function RegisterPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role: 'patient' }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Registration failed')
      }
      await login(form.email, form.password)
      router.push('/patient/book')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0D1117] flex flex-col items-center justify-center p-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#1A73E8] flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(26,115,232,0.25)]">
            <span className="text-white text-lg font-black">MQ</span>
          </div>
          <h1 className="text-2xl font-black text-white">Create Account</h1>
          <p className="text-gray-500 text-sm mt-1">Register as a patient</p>
        </div>

        <div className="bg-[#141B2B] rounded-2xl border border-white/5 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Full Name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={set('fullName')}
                required
                minLength={2}
                placeholder="John Smith"
                className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 placeholder-gray-600 outline-none focus:border-[#1A73E8]/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                required
                placeholder="you@example.com"
                className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 placeholder-gray-600 outline-none focus:border-[#1A73E8]/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                required
                minLength={8}
                placeholder="Min. 8 characters"
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
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-[#1A73E8] font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
