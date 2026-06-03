'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { apiRequest } from '@/lib/api-client'
import { FileText, ArrowRight, ChevronLeft, Zap, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Appointment {
  id: string
  appointmentDate: string
  status: string
  type: string
  doctorName: string
  specialization: string
  slotPosition?: number
}

interface QueueDisplayRow {
  queueNumber: number
  status: string
  patientName: string
  doctorName: string
  doctorId: string
}

const STATUS_COLOR: Record<string, string> = {
  scheduled:  'text-[#1A73E8] bg-[#1A73E8]/10',
  confirmed:  'text-[#34A853] bg-[#34A853]/10',
  completed:  'text-gray-500 bg-gray-500/10',
  no_show:    'text-[#EA4335] bg-[#EA4335]/10',
  cancelled:  'text-[#F9AB00] bg-[#F9AB00]/10',
}

// ─── Live Tracker screen ──────────────────────────────────────────────────────
function LiveTracker({
  appointment,
  onBack,
  onCancel,
}: {
  appointment: Appointment
  onBack: () => void
  onCancel: (id: string) => void
}) {
  const myToken = appointment.slotPosition ?? 1
  const TOTAL = 20

  const [currentToken, setCurrentToken] = useState(0)
  const [flash, setFlash] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const { accessToken } = useAuth()

  // Fetch real queue position on mount, poll every 5 s
  useEffect(() => {
    async function fetchCurrent() {
      try {
        const rows = await apiRequest<QueueDisplayRow[]>('/api/queue/display/clinic')
        const serving = rows.find((r) => r.status === 'called' || r.status === 'in_progress')
        if (serving) setCurrentToken(serving.queueNumber)
      } catch {
        // keep existing value
      }
    }
    fetchCurrent()
    const id = setInterval(fetchCurrent, 5000)
    return () => clearInterval(id)
  }, [])

  function simulateNext() {
    setCurrentToken((p) => {
      const next = Math.min(p + 1, TOTAL)
      setFlash(true)
      setTimeout(() => setFlash(false), 800)
      return next
    })
  }

  async function handleCancel() {
    if (!confirm('Cancel this booking?') || !accessToken) return
    setCancelling(true)
    try {
      await apiRequest(`/api/appointments/${appointment.id}/cancel`, {
        method: 'PUT',
        token: accessToken,
        body: { reason: 'Patient cancelled' },
      })
      onCancel(appointment.id)
    } catch {
      alert('Cancellation failed')
    } finally {
      setCancelling(false)
    }
  }

  const isNext = myToken === currentToken + 1
  const tokens = Array.from({ length: TOTAL }, (_, i) => i + 1)

  const apptDate = new Date(appointment.appointmentDate)
  const timeStr = apptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const endDate = new Date(apptDate.getTime() + 4 * 60 * 60 * 1000)
  const endStr = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="h-full overflow-y-auto bg-[#f7f8fc] flex flex-col" style={{ scrollbarWidth: 'none' }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <p className="text-sm font-semibold text-gray-800">MediQueue Clinic</p>
          <p className="text-xs text-gray-400">
            {appointment.doctorName} · {timeStr} – {endStr}
          </p>
        </div>
      </div>

      <div className="flex-1 px-5 py-6 space-y-5">
        {/* "You're up next" alert */}
        {isNext && (
          <div className="bg-[#EA4335] rounded-xl px-4 py-3 flex items-center gap-3 animate-pulse">
            <Zap className="w-5 h-5 text-white flex-shrink-0" />
            <p className="text-sm font-semibold text-white">{"You're up next! Please proceed to the clinic."}</p>
          </div>
        )}

        {/* Circular counters */}
        <div className="flex gap-4">
          {/* Now Serving */}
          <div className="flex-1 bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] flex flex-col items-center">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Now Serving</p>
            <div className="relative">
              <svg viewBox="0 0 80 80" className="w-24 h-24">
                <circle cx="40" cy="40" r="36" fill="none" stroke="#E8F0FE" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="36" fill="none" stroke="#1A73E8" strokeWidth="6"
                  strokeDasharray={`${(currentToken / TOTAL) * 226} 226`}
                  strokeLinecap="round" transform="rotate(-90 40 40)"
                  className={flash ? 'animate-pulse' : ''}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-[#1A73E8]">
                  {String(currentToken).padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>

          {/* Your Token */}
          <div className={`flex-1 bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] flex flex-col items-center ${isNext ? 'ring-2 ring-[#EA4335]' : ''}`}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your Token</p>
            <div className="relative">
              <svg viewBox="0 0 80 80" className="w-24 h-24">
                <circle cx="40" cy="40" r="36" fill="none" stroke="#E6F4EA" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="36" fill="none"
                  stroke={isNext ? '#EA4335' : '#34A853'} strokeWidth="6"
                  strokeDasharray={`${(myToken / TOTAL) * 226} 226`}
                  strokeLinecap="round" transform="rotate(-90 40 40)"
                  className={isNext ? 'animate-pulse' : ''}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-3xl font-bold ${isNext ? 'text-[#EA4335]' : 'text-[#34A853]'}`}>
                  {String(myToken).padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Queue progress grid */}
        <div className="bg-white rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Queue Progress</p>
          <div className="flex flex-wrap gap-1.5">
            {tokens.map((t) => (
              <div
                key={t}
                className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold transition-all ${
                  t < currentToken
                    ? 'bg-gray-100 text-gray-300'
                    : t === currentToken
                    ? 'bg-[#1A73E8] text-white scale-110 shadow-md'
                    : t === myToken
                    ? 'bg-[#34A853] text-white'
                    : 'bg-gray-50 text-gray-400 border border-gray-100'
                }`}
              >
                {t}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#1A73E8] inline-block" />Serving</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#34A853] inline-block" />Yours</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-gray-100 inline-block" />Done</span>
          </div>
        </div>

        {/* Demo button */}
        <button
          onClick={simulateNext}
          className="w-full bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
        >
          Simulate Next Token (Demo)
        </button>

        {/* Cancel */}
        <div className="text-center">
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="text-sm text-gray-400 hover:text-[#EA4335] transition-colors border border-gray-200 px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {cancelling ? 'Cancelling…' : 'Cancel Booking'}
          </button>
          <p className="text-xs text-gray-300 mt-1">Cancellation allowed up to 1 hour before session start</p>
        </div>
      </div>
    </div>
  )
}

// ─── My Tokens list ───────────────────────────────────────────────────────────
export default function PatientAppointmentsPage() {
  const { accessToken } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [tracking, setTracking] = useState<Appointment | null>(null)

  async function fetchAppointments() {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await apiRequest<{ data: Appointment[] }>('/api/appointments', { token: accessToken })
      setAppointments(res.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAppointments() }, [accessToken])

  function handleCancelled(id: string) {
    setAppointments((prev) => prev.filter((a) => a.id !== id))
    setTracking(null)
  }

  // ── Live Tracker ────────────────────────────────────────────────────────────
  if (tracking) {
    return (
      <LiveTracker
        appointment={tracking}
        onBack={() => setTracking(null)}
        onCancel={handleCancelled}
      />
    )
  }

  // ── My Tokens list ──────────────────────────────────────────────────────────
  const active = appointments.filter((a) => a.status === 'scheduled' || a.status === 'confirmed')
  const past   = appointments.filter((a) => a.status !== 'scheduled' && a.status !== 'confirmed')

  return (
    <div className="h-full overflow-y-auto bg-[#f7f8fc] px-5 py-5" style={{ scrollbarWidth: 'none' }}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-gray-800">My Tokens</h2>
        <Link
          href="/patient/book"
          className="bg-[#1A73E8] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#1557B0] transition-colors"
        >
          + Book New
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-gray-400 text-sm">Loading…</div>
        </div>
      ) : appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-400">No active tokens</p>
          <Link
            href="/patient/book"
            className="mt-4 bg-[#1A73E8] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#1557B0] transition-colors"
          >
            Find a Session
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Active tokens */}
          {active.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Active</p>
              <div className="space-y-3">
                {active.map((appt) => (
                  <TokenCard
                    key={appt.id}
                    appt={appt}
                    onTrack={() => setTracking(appt)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past tokens */}
          {past.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Past</p>
              <div className="space-y-3">
                {past.map((appt) => (
                  <TokenCard key={appt.id} appt={appt} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Token card ───────────────────────────────────────────────────────────────
function TokenCard({
  appt,
  onTrack,
}: {
  appt: Appointment
  onTrack?: () => void
}) {
  const isActive = appt.status === 'scheduled' || appt.status === 'confirmed'
  const apptDate = new Date(appt.appointmentDate)
  const timeStr  = apptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
      <div className="flex items-start justify-between gap-3">
        {/* Left: clinic + doctor info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1A73E8] flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            MQ
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">MediQueue Clinic</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {appt.doctorName} · {timeStr}
            </p>
          </div>
        </div>

        {/* Right: token number */}
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-400">Token</p>
          <p className="text-2xl font-bold text-[#1A73E8]">
            #{String(appt.slotPosition ?? '—').padStart(2, '0')}
          </p>
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-2 mt-3">
        {isActive ? (
          <span className="inline-flex items-center gap-1 bg-[#E8F0FE] text-[#1A73E8] text-xs font-medium px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1A73E8] animate-pulse" />Active
          </span>
        ) : (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[appt.status] ?? 'text-gray-500 bg-gray-100'}`}>
            {appt.status.replace('_', ' ')}
          </span>
        )}

        {isActive && onTrack && (
          <button
            onClick={onTrack}
            className="ml-auto flex items-center gap-1 text-xs text-[#1A73E8] font-medium hover:underline"
          >
            Track Live <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}
