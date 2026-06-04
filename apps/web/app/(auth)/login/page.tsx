'use client'

/**
 * Login page — role-tile selection flow
 *
 * Step 1: User selects their role from 4 tiles
 * Step 2: Login or Register form appears for that role
 *
 * DB: auth handled via /api/auth/login and /api/auth/register (Fastify)
 *     Replace mock credentials with real API calls once DB is live.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User, Building2, ShieldCheck, Stethoscope,
  ArrowLeft, Eye, EyeOff, ArrowRight, AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

// ─── Role definitions ─────────────────────────────────────────────────────────

type RoleKey = 'patient' | 'medical_center' | 'admin' | 'doctor'

interface RoleDef {
  key: RoleKey
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  accent: string          // Tailwind arbitrary value for the highlight colour
  accentBg: string        // bg class
  accentText: string      // text class
  accentBorder: string    // border class
  accentGlow: string      // shadow style
  canRegister: boolean    // show Register tab
  apiRole: string         // maps to DB users.role
  home: string            // redirect after login
  testEmail: string       // dev shortcut
}

const ROLES: RoleDef[] = [
  {
    key: 'patient',
    label: 'Patient',
    description: 'Book appointments, track your health records and queue status.',
    icon: User,
    accent: '#34A853',
    accentBg: 'bg-[#34A853]/10',
    accentText: 'text-[#34A853]',
    accentBorder: 'border-[#34A853]/30',
    accentGlow: '0 0 30px rgba(52,168,83,0.15)',
    canRegister: true,
    apiRole: 'patient',
    home: '/patient/book',
    testEmail: 'patient@test.com',
  },
  {
    key: 'medical_center',
    label: 'Medical Center',
    description: 'Manage your clinic profile, patient queues and walk-in tokens.',
    icon: Building2,
    accent: '#1A73E8',
    accentBg: 'bg-[#1A73E8]/10',
    accentText: 'text-[#1A73E8]',
    accentBorder: 'border-[#1A73E8]/30',
    accentGlow: '0 0 30px rgba(26,115,232,0.15)',
    canRegister: true,
    apiRole: 'receptionist',
    home: '/receptionist/queue',
    testEmail: 'receptionist@test.com',
  },
  {
    key: 'admin',
    label: 'System Admin',
    description: 'Platform-wide oversight, staff management and configuration.',
    icon: ShieldCheck,
    accent: '#EA4335',
    accentBg: 'bg-[#EA4335]/10',
    accentText: 'text-[#EA4335]',
    accentBorder: 'border-[#EA4335]/30',
    accentGlow: '0 0 30px rgba(234,67,53,0.15)',
    canRegister: false,
    apiRole: 'admin',
    home: '/admin/staff',
    testEmail: 'admin@test.com',
  },
  {
    key: 'doctor',
    label: 'Doctor',
    description: 'View your schedule, manage walk-in queues and patient records.',
    icon: Stethoscope,
    accent: '#F9AB00',
    accentBg: 'bg-[#F9AB00]/10',
    accentText: 'text-[#F9AB00]',
    accentBorder: 'border-[#F9AB00]/30',
    accentGlow: '0 0 30px rgba(249,171,0,0.15)',
    canRegister: false,
    apiRole: 'doctor',
    home: '/doctor/schedule',
    testEmail: 'doctor@test.com',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()

  // Step 1 state
  const [selectedRole, setSelectedRole] = useState<RoleDef | null>(null)

  // Step 2 state
  const [tab, setTab]           = useState<'login' | 'register'>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [fullName, setFullName] = useState('')
  const [clinicName, setClinicName] = useState('')  // for medical_center registration
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  function selectRole(role: RoleDef) {
    setSelectedRole(role)
    setTab('login')
    setEmail(''); setPassword(''); setConfirm(''); setFullName(''); setClinicName('')
    setError(''); setShowPw(false)
  }

  function goBack() {
    setSelectedRole(null)
    setError('')
  }

  // ── Login ────────────────────────────────────────────────────
  // DB: POST /api/auth/login  { email, password }
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRole) return
    setError(''); setLoading(true)
    try {
      const user = await login(email, password)
      router.push(selectedRole.home)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  // ── Register ─────────────────────────────────────────────────
  // DB: POST /api/auth/register  { fullName, email, password, role, clinicName? }
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRole) return
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return }
    setError(''); setLoading(true)
    try {
      // TODO: call apiRequest('/api/auth/register', { method: 'POST', body: { fullName, email, password, role: selectedRole.apiRole, clinicName } })
      // For now: simulate success then go to login tab
      await new Promise((r) => setTimeout(r, 700))
      setTab('login')
      setPassword(''); setConfirm('')
      setError('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  // ── Dev shortcut ─────────────────────────────────────────────
  function fillTestAccount() {
    if (!selectedRole) return
    setEmail(selectedRole.testEmail)
    setPassword('password123')
    setError('')
  }

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-[#0D1117] flex flex-col items-center justify-center p-6"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-[#1A73E8] flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(26,115,232,0.25)]">
          <span className="text-white text-lg font-black">MQ</span>
        </div>
        <h1 className="text-2xl font-black text-white">MediQueue</h1>
        <p className="text-gray-500 text-sm mt-1">
          {selectedRole ? `Signing in as ${selectedRole.label}` : 'Who are you signing in as?'}
        </p>
      </div>

      {/* ── Step 1: Role tiles ──────────────────────────────── */}
      {!selectedRole && (
        <div className="w-full max-w-lg">
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map((role) => {
              const Icon = role.icon
              return (
                <button
                  key={role.key}
                  onClick={() => selectRole(role)}
                  className={`group relative bg-[#141B2B] hover:bg-[#1A2237] border border-white/5 hover:${role.accentBorder} rounded-2xl p-5 text-left transition-all duration-200 hover:scale-[1.02]`}
                  style={{ '--hover-glow': role.accentGlow } as React.CSSProperties}
                >
                  {/* Icon */}
                  <div className={`w-11 h-11 rounded-xl ${role.accentBg} flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 ${role.accentText}`} />
                  </div>

                  {/* Label */}
                  <p className="text-sm font-bold text-white mb-1">{role.label}</p>

                  {/* Description */}
                  <p className="text-xs text-gray-500 leading-relaxed">{role.description}</p>

                  {/* Arrow */}
                  <div className={`mt-4 flex items-center gap-1 ${role.accentText} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    <span className="text-xs font-semibold">Continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>

                  {/* Bottom accent line */}
                  <div
                    className="absolute bottom-0 left-4 right-4 h-px opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                    style={{ background: role.accent }}
                  />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Step 2: Login / Register form ──────────────────── */}
      {selectedRole && (() => {
        const role = selectedRole
        const Icon = role.icon
        return (
          <div className="w-full max-w-md">
            <div
              className="bg-[#141B2B] rounded-2xl border border-white/5 overflow-hidden"
              style={{ boxShadow: role.accentGlow }}
            >
              {/* Role header */}
              <div className={`flex items-center gap-3 px-6 py-4 border-b border-white/5 ${role.accentBg}`}>
                <button
                  onClick={goBack}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors flex-shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <div className={`w-8 h-8 rounded-lg ${role.accentBg} border ${role.accentBorder} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${role.accentText}`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{role.label}</p>
                  <p className="text-[10px] text-gray-400">
                    {tab === 'login' ? 'Sign in to your account' : 'Create a new account'}
                  </p>
                </div>
              </div>

              <div className="p-6">
                {/* Tabs (only for roles that can register) */}
                {role.canRegister && (
                  <div className="flex gap-1 bg-[#0D1117] p-1 rounded-lg mb-5">
                    {(['login', 'register'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => { setTab(t); setError('') }}
                        className={`flex-1 py-2 rounded-md text-xs font-semibold transition-colors ${
                          tab === t
                            ? `text-white`
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                        style={tab === t ? { background: role.accent } : {}}
                      >
                        {t === 'login' ? 'Sign In' : 'Register'}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Login form ── */}
                {tab === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Email</label>
                      <input
                        type="email" required
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder={`you@${role.key === 'medical_center' ? 'clinic' : 'example'}.com`}
                        className={inputCls(role.accent)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Password</label>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'} required
                          value={password} onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`${inputCls(role.accent)} pr-10`}
                        />
                        <button type="button" onClick={() => setShowPw(!showPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {error && <ErrorBanner message={error} />}

                    <button
                      type="submit" disabled={loading}
                      className="w-full disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition-all mt-1"
                      style={{ background: role.accent }}
                    >
                      {loading ? 'Signing in…' : `Sign In as ${role.label}`}
                    </button>

                    {/* Dev test account shortcut */}
                    <button
                      type="button" onClick={fillTestAccount}
                      className="w-full text-xs text-gray-600 hover:text-gray-400 transition-colors py-1"
                    >
                      Use test account ({role.testEmail})
                    </button>
                  </form>
                )}

                {/* ── Register form ── */}
                {tab === 'register' && (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Full Name</label>
                      <input
                        type="text" required
                        value={fullName} onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your full name"
                        className={inputCls(role.accent)}
                      />
                    </div>

                    {/* Extra field for Medical Center */}
                    {role.key === 'medical_center' && (
                      <div>
                        <label className="text-xs text-gray-400 mb-1.5 block">Clinic / Medical Center Name</label>
                        {/* DB: clinics.name — created alongside the user on registration */}
                        <input
                          type="text" required
                          value={clinicName} onChange={(e) => setClinicName(e.target.value)}
                          placeholder="e.g. City Medical Centre"
                          className={inputCls(role.accent)}
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Email</label>
                      <input
                        type="email" required
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className={inputCls(role.accent)}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Password</label>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'} required
                          value={password} onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min. 8 characters"
                          className={`${inputCls(role.accent)} pr-10`}
                        />
                        <button type="button" onClick={() => setShowPw(!showPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Confirm Password</label>
                      <input
                        type="password" required
                        value={confirm} onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repeat password"
                        className={inputCls(role.accent)}
                      />
                    </div>

                    {error && <ErrorBanner message={error} />}

                    <button
                      type="submit" disabled={loading}
                      className="w-full disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition-all mt-1"
                      style={{ background: role.accent }}
                    >
                      {loading ? 'Creating account…' : `Create ${role.label} Account`}
                    </button>

                    {role.key === 'medical_center' && (
                      <p className="text-[10px] text-gray-600 text-center leading-relaxed">
                        Registration documents can be submitted from your Medi Center profile after sign-in.
                      </p>
                    )}
                  </form>
                )}
              </div>
            </div>

            {/* "Back to role selection" hint */}
            <p className="text-center text-xs text-gray-600 mt-4">
              Not a {role.label}?{' '}
              <button onClick={goBack} className="text-gray-400 hover:text-white transition-colors font-medium">
                Choose a different role
              </button>
            </p>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function inputCls(accent: string) {
  return [
    'w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg',
    'px-3 py-2.5 placeholder-gray-600 outline-none transition-colors',
    `focus:border-[${accent}]/50`,
  ].join(' ')
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 bg-[#EA4335]/10 border border-[#EA4335]/20 rounded-lg px-3 py-2.5">
      <AlertCircle className="w-3.5 h-3.5 text-[#EA4335] flex-shrink-0 mt-0.5" />
      <p className="text-xs text-[#EA4335]">{message}</p>
    </div>
  )
}
