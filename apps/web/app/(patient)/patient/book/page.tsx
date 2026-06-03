'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiRequest } from '@/lib/api-client'
import PenaltyWarning from '@/components/appointments/PenaltyWarning'
import {
  MapPin, Star, Phone, Clock, Check, AlertTriangle, CheckCircle,
  ChevronLeft, X, Search, Filter, Navigation2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Doctor {
  id: string
  fullName: string
  specialization: string
  consultationFee: number
  isAvailable: boolean
  clinicName?: string | null
}
interface Slot { id: string; hour: number; capacity: number; bookedCount: number }
interface Session {
  doctor: Doctor
  slots: Slot[]
  startHour: number
  endHour: number
  totalCapacity: number
  bookedCount: number
}
interface PenaltyInfo { penaltyLevel: number }
type BookingStep = 1 | 2 | 3
type Screen = 'finder' | 'profile'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PALETTE = ['#1A73E8', '#34A853', '#9C27B0', '#F9AB00', '#0097A7', '#F4511E']
const getColor = (i: number) => PALETTE[i % PALETTE.length]!
const getInitials = (name: string) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

function fmt12(hour: number) {
  if (hour === 0) return '12:00 AM'
  if (hour < 12) return `${hour}:00 AM`
  if (hour === 12) return '12:00 PM'
  return `${hour - 12}:00 PM`
}

// ─── City Map ─────────────────────────────────────────────────────────────────
function CityMap({ accentColor }: { accentColor: string }) {
  return (
    <div className="relative w-full h-full overflow-hidden bg-[#E8EDF2]">
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 15% 15%, #C5D9EE 0%, #C5D9EE 35%, transparent 60%)' }}
      />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="50" x2="100" y2="50" stroke="white" strokeWidth="1.2" />
        <line x1="0" y1="73" x2="100" y2="73" stroke="white" strokeWidth="1.2" />
        <line x1="23" y1="0" x2="23" y2="100" stroke="white" strokeWidth="1.2" />
        <line x1="47" y1="0" x2="47" y2="100" stroke="white" strokeWidth="1.2" />
        <line x1="71" y1="0" x2="71" y2="100" stroke="white" strokeWidth="1.2" />
        <line x1="0" y1="32" x2="100" y2="32" stroke="white" strokeWidth="0.6" />
        <path d="M 0 60 Q 25 50 47 50 T 100 62" stroke="white" strokeWidth="0.8" fill="none" />
        <path d="M 23 0 Q 28 25 35 50 Q 42 75 47 100" stroke="white" strokeWidth="0.7" fill="none" />
      </svg>
      {/* Single clinic pin */}
      <div
        className="absolute"
        style={{ left: '43%', top: '38%', transform: 'translate(-50%,-50%)', zIndex: 10 }}
      >
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-30"
          style={{ background: accentColor, transform: 'scale(2)', animationDuration: '2.5s' }}
        />
        <div
          className="relative w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
          style={{ background: accentColor }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white" />
        </div>
        <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap bg-white rounded-lg shadow-lg border border-black/5 px-3 py-1.5 pointer-events-none">
          <p className="text-xs font-semibold text-gray-800">MediQueue Clinic</p>
          <span className="inline-flex items-center gap-1 text-[10px] text-[#137333] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34A853]" /> Open Now
          </span>
        </div>
      </div>
      {/* Controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button className="w-7 h-7 bg-white rounded shadow-md flex items-center justify-center text-gray-500 hover:bg-gray-50 text-sm font-bold">+</button>
        <button className="w-7 h-7 bg-white rounded shadow-md flex items-center justify-center text-gray-500 hover:bg-gray-50 text-sm font-bold">−</button>
      </div>
      <div className="absolute bottom-3 left-3">
        <button className="flex items-center gap-1.5 bg-white rounded-lg shadow-md px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50">
          <Navigation2 className="w-3 h-3" /> Locate me
        </button>
      </div>
    </div>
  )
}

// ─── Clinic card ──────────────────────────────────────────────────────────────
function ClinicCard({ onSelect }: { onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="flex-shrink-0 w-52 bg-white rounded-xl p-3 text-left transition-all duration-150 border border-transparent shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_18px_rgba(0,0,0,0.12)] hover:border-[#1A73E8]/30"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="w-10 h-10 rounded-lg bg-[#1A73E8] flex items-center justify-center text-sm font-bold text-white">MQ</div>
        <div className="flex items-center gap-1 text-[11px] text-gray-400">
          <MapPin className="w-3 h-3" />0.3 km
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-800 leading-tight mb-1.5">MediQueue Clinic</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {['General', 'Specialist'].map((s) => (
          <span key={s} className="inline-block px-2 py-0.5 rounded-md bg-[#E8F0FE] text-[#1A73E8] text-[11px] font-medium">{s}</span>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
          <Star className="w-3 h-3 fill-[#F9AB00] text-[#F9AB00]" />4.8
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#E6F4EA] text-[#137333]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34A853]" />Open Now
        </span>
      </div>
    </button>
  )
}

// ─── Booking modal ────────────────────────────────────────────────────────────
function BookingModal({
  session, step, selectedSlot, assignedToken, loading,
  onSelectSlot, onConfirm, onClose,
}: {
  session: Session; step: BookingStep; selectedSlot: Slot | null
  assignedToken: number | null; loading: boolean
  onSelectSlot: (s: Slot) => void; onConfirm: () => void; onClose: () => void
}) {
  const color = getColor(0)
  const isEarly = assignedToken !== null && assignedToken <= 8

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5">
          <h3 className="text-base font-semibold text-gray-800">Book a Token</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-5 py-4">
          {(['Select Slot', 'Confirm', 'Done'] as const).map((label, i) => {
            const num = (i + 1) as BookingStep
            const done = step > num; const active = step === num
            return (
              <div key={label} className="flex items-center flex-1">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all ${
                    done ? 'bg-[#34A853] border-[#34A853] text-white' :
                    active ? 'bg-[#1A73E8] border-[#1A73E8] text-white' : 'bg-white border-gray-200 text-gray-400'
                  }`}>
                    {done ? <Check className="w-3 h-3" /> : num}
                  </div>
                  <span className={`text-xs hidden sm:block ${active ? 'font-semibold text-gray-700' : 'text-gray-400'}`}>{label}</span>
                </div>
                {i < 2 && <div className={`flex-1 h-px mx-2 ${done ? 'bg-[#34A853]' : 'bg-gray-200'}`} />}
              </div>
            )
          })}
        </div>

        <div className="px-5 pb-5">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-[#f7f8fc] rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: color }}>
                    {getInitials(session.doctor.fullName)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{session.doctor.fullName}</p>
                    <p className="text-xs text-gray-500">{session.doctor.specialization}</p>
                    <p className="text-xs text-[#1A73E8] font-medium mt-0.5">{fmt12(session.startHour)} – {fmt12(session.endHour)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Capacity</span>
                    <span className="font-medium text-gray-700">{session.totalCapacity - session.bookedCount} of {session.totalCapacity} remaining</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#34A853]" style={{ width: `${(session.bookedCount / session.totalCapacity) * 100}%` }} />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Select a time slot</p>
                {session.slots.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No slots available</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {session.slots.map((slot) => {
                      const full = slot.bookedCount >= slot.capacity
                      return (
                        <button key={slot.id} disabled={full} onClick={() => onSelectSlot(slot)}
                          className={`rounded-lg py-2 text-sm font-medium transition-all ${
                            full ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                            selectedSlot?.id === slot.id ? 'bg-[#1A73E8] text-white' :
                            'bg-[#E8F0FE] text-[#1A73E8] hover:bg-[#BBDEFB]'
                          }`}>
                          {slot.hour}:00
                          <span className="block text-[10px] opacity-70">{slot.capacity - slot.bookedCount} left</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <button onClick={onConfirm} disabled={!selectedSlot}
                className="w-full bg-[#1A73E8] hover:bg-[#1557B0] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                Continue →
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && selectedSlot && (
            <div className="space-y-4">
              <div className="bg-[#f7f8fc] rounded-xl p-4 space-y-3">
                {[
                  ['Doctor', session.doctor.fullName],
                  ['Specialization', session.doctor.specialization],
                  ['Session', `${fmt12(session.startHour)} – ${fmt12(session.endHour)}`],
                  ['Slot', `${selectedSlot.hour}:00`],
                  ['Clinic', 'MediQueue Clinic'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium text-gray-800">{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={onConfirm} disabled={loading}
                className="w-full bg-[#1A73E8] hover:bg-[#1557B0] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                {loading ? 'Booking…' : 'Confirm Booking'}
              </button>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && assignedToken !== null && (
            <div className="space-y-4 text-center">
              {isEarly && (
                <div className="flex items-start gap-2 bg-[#FEF7E0] border border-[#F9AB00]/30 rounded-xl px-3 py-2.5 text-left">
                  <AlertTriangle className="w-4 h-4 text-[#F9AB00] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#7B5800] font-medium">
                    Your token is in the current active group — please arrive by {fmt12(session.startHour)}.
                  </p>
                </div>
              )}
              <div className="w-14 h-14 rounded-full bg-[#E6F4EA] flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-[#34A853]" />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Your Token Number</p>
                <div className="inline-block border-2 border-[#1A73E8] rounded-2xl px-8 py-4">
                  <span className="text-5xl font-bold text-[#1A73E8]">#{String(assignedToken).padStart(2, '0')}</span>
                </div>
              </div>
              <div className="bg-[#f7f8fc] rounded-xl p-3 text-sm text-gray-600">
                <Clock className="w-4 h-4 inline mr-1.5 text-gray-400" />
                Arrive between <span className="font-semibold text-gray-800">{fmt12(session.startHour)} – {fmt12(session.endHour)}</span>
              </div>
              <button onClick={onClose} className="w-full bg-[#34A853] hover:bg-[#2D8F47] text-white font-semibold py-3 rounded-xl transition-colors">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PatientBookPage() {
  const { accessToken } = useAuth()
  const [screen, setScreen] = useState<Screen>('finder')
  const [search, setSearch] = useState('')
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [penalty, setPenalty] = useState<PenaltyInfo | null>(null)

  // Booking state
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [bookingStep, setBookingStep] = useState<BookingStep>(1)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [assignedToken, setAssignedToken] = useState<number | null>(null)
  const [today] = useState(new Date().toISOString().split('T')[0]!)
  const [currentHour] = useState(new Date().getHours())

  useEffect(() => {
    if (accessToken) {
      apiRequest<{ penaltyLevel: number }>('/api/appointments/penalty/me', { token: accessToken })
        .then(setPenalty).catch(() => {})
    }
  }, [accessToken])

  // When entering the profile screen, fetch doctors + their slots
  useEffect(() => {
    if (screen !== 'profile') return
    setLoadingSessions(true)

    apiRequest<{ data: Doctor[] }>('/api/doctors')
      .then(async ({ data: docs }) => {
        setDoctors(docs)
        // Fetch slots for each doctor in parallel
        const results = await Promise.all(
          docs.map(async (doc) => {
            try {
              const slots = await apiRequest<Slot[]>(
                `/api/appointments/slots?doctorId=${doc.id}&date=${today}`,
              )
              return { doc, slots: slots ?? [] }
            } catch {
              return { doc, slots: [] }
            }
          }),
        )

        const built: Session[] = results
          .filter((r) => r.slots.length > 0)
          .map(({ doc, slots }) => {
            const hours = slots.map((s) => s.hour)
            const startHour = Math.min(...hours)
            const endHour = Math.max(...hours) + 1
            const totalCapacity = slots.reduce((sum, s) => sum + s.capacity, 0)
            const bookedCount = slots.reduce((sum, s) => sum + s.bookedCount, 0)
            return { doctor: doc, slots, startHour, endHour, totalCapacity, bookedCount }
          })

        setSessions(built)
      })
      .catch(() => {})
      .finally(() => setLoadingSessions(false))
  }, [screen, today])

  function openBooking(s: Session) {
    setActiveSession(s)
    setSelectedSlot(null)
    setBookingStep(1)
    setAssignedToken(null)
    setShowModal(true)
  }

  async function handleConfirm() {
    if (!activeSession) return
    if (bookingStep === 1) { setBookingStep(2); return }
    if (bookingStep === 2) {
      if (!selectedSlot || !accessToken) return
      setLoading(true)
      try {
        const appt = await apiRequest<{ slotPosition: number }>('/api/appointments', {
          method: 'POST',
          token: accessToken,
          body: { doctorId: activeSession.doctor.id, slotId: selectedSlot.id, date: today, type: 'general' },
        })
        setAssignedToken(appt.slotPosition ?? (activeSession.bookedCount + 1))
        setBookingStep(3)
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : 'Booking failed')
      } finally {
        setLoading(false)
      }
    }
  }

  // "On Duty Now" = session whose time range includes the current hour
  const onDutySession = sessions.find((s) => s.startHour <= currentHour && currentHour < s.endHour)
    ?? sessions.find((s) => s.doctor.isAvailable)

  const filteredSessions = sessions.filter((s) =>
    s.doctor.fullName.toLowerCase().includes(search.toLowerCase()) ||
    s.doctor.specialization.toLowerCase().includes(search.toLowerCase()),
  )

  // ── Clinic Finder ───────────────────────────────────────────────────────────
  if (screen === 'finder') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Search bar */}
        <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
          <div className="flex-1 flex items-center gap-2 bg-[#f1f3f9] rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search clinic by name or location..."
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
              readOnly
            />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            <Filter className="w-4 h-4" />Filter
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            <MapPin className="w-4 h-4 text-[#1A73E8]" />Nearby
          </button>
        </div>

        {/* Map */}
        <div className="flex-1 min-h-0 relative" style={{ minHeight: 260, maxHeight: '55%' }}>
          <CityMap accentColor="#1A73E8" />
        </div>

        {/* Nearby Clinics */}
        <div className="flex-shrink-0 bg-white border-t border-gray-200">
          <div className="px-5 pt-3 pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Nearby Clinics</h2>
              <p className="text-xs text-gray-400 mt-0.5">1 open now</p>
            </div>
            <button className="text-xs text-[#1A73E8] font-medium hover:underline flex items-center gap-1">
              Find More <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
          <div className="flex gap-3 px-5 pb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <ClinicCard onSelect={() => setScreen('profile')} />
          </div>
        </div>
      </div>
    )
  }

  // ── Clinic Profile ──────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto bg-[#f7f8fc]" style={{ scrollbarWidth: 'none' }}>
      {/* Cover */}
      <div className="relative h-28 flex-shrink-0" style={{ background: 'linear-gradient(135deg,#1A73E820,#1A73E840)' }}>
        <button
          onClick={() => setScreen('finder')}
          className="absolute top-4 left-4 w-8 h-8 bg-white/90 backdrop-blur rounded-lg flex items-center justify-center shadow-sm hover:bg-white"
        >
          <ChevronLeft className="w-4 h-4 text-gray-700" />
        </button>
        <div className="absolute bottom-0 left-5 translate-y-1/2 w-14 h-14 rounded-xl border-4 border-white shadow-md bg-[#1A73E8] flex items-center justify-center text-lg font-bold text-white">
          MQ
        </div>
      </div>

      <div className="px-5 pt-10 pb-8 space-y-6">
        {/* Clinic info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900">MediQueue Clinic</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 text-xs text-gray-600">
              <Star className="w-3 h-3 fill-[#F9AB00] text-[#F9AB00]" />4.8
            </span>
            <span className="text-xs text-gray-400">(312 reviews)</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#E6F4EA] text-[#137333]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34A853]" />Open Now
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            <span>12 Main Street, Central District</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
            <Phone className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            <span>+1 (555) 123-4567</span>
          </div>
        </div>

        {penalty && penalty.penaltyLevel > 0 && (
          <PenaltyWarning penaltyLevel={penalty.penaltyLevel as 0 | 1 | 2 | 3} />
        )}

        {/* On Duty Now */}
        {onDutySession && (
          <div className="bg-white rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">On Duty Now</h3>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: getColor(sessions.indexOf(onDutySession)) }}
              >
                {getInitials(onDutySession.doctor.fullName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm">{onDutySession.doctor.fullName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{onDutySession.doctor.specialization}</p>
              </div>
              <div className="flex items-center gap-1.5 bg-[#E6F4EA] px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-[#34A853] animate-pulse" />
                <span className="text-xs font-medium text-[#137333] whitespace-nowrap">Consulting</span>
              </div>
            </div>
          </div>
        )}

        {/* Today's Sessions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{"Today's Sessions"}</h3>
            <div className="flex items-center gap-2 bg-[#f1f3f9] rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search doctor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none w-28"
              />
            </div>
          </div>

          {loadingSessions ? (
            <div className="text-center py-10 text-gray-400 text-sm">Loading sessions…</div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No sessions available today</div>
          ) : (
            <div className="space-y-2.5">
              {filteredSessions.map((session, idx) => {
                const isFull = session.bookedCount >= session.totalCapacity
                const usedPct = session.totalCapacity > 0
                  ? Math.round((session.bookedCount / session.totalCapacity) * 100)
                  : 0
                const isActive = session === onDutySession

                return (
                  <div
                    key={session.doctor.id}
                    className={`bg-white rounded-xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)] ${isActive ? 'border border-[#1A73E8]/20' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-gray-700">
                            {fmt12(session.startHour)} – {fmt12(session.endHour)}
                          </span>
                          {isActive && (
                            <span className="text-[10px] bg-[#E8F0FE] text-[#1A73E8] px-1.5 py-0.5 rounded font-medium">
                              Active Now
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-800 mt-0.5">{session.doctor.fullName}</p>
                        <p className="text-xs text-gray-400">{session.doctor.specialization}</p>
                      </div>
                      {isFull ? (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium flex-shrink-0">Full</span>
                      ) : (
                        <button
                          onClick={() => openBooking(session)}
                          className="flex-shrink-0 bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Book Token
                        </button>
                      )}
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                        <span>{session.totalCapacity - session.bookedCount} of {session.totalCapacity} remaining</span>
                        <span>{usedPct}% filled</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${usedPct}%`,
                            background: usedPct >= 80 ? '#EA4335' : usedPct >= 50 ? '#F9AB00' : '#34A853',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Operating Hours */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Operating Hours</h3>
          <div className="bg-white rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] overflow-hidden">
            {[
              { day: 'Mon', hours: '8:00 AM – 6:00 PM' },
              { day: 'Tue', hours: '8:00 AM – 6:00 PM' },
              { day: 'Wed', hours: '8:00 AM – 8:00 PM' },
              { day: 'Thu', hours: '8:00 AM – 6:00 PM' },
              { day: 'Fri', hours: '9:00 AM – 5:00 PM' },
              { day: 'Sat', hours: '9:00 AM – 1:00 PM' },
              { day: 'Sun', hours: null },
            ].map((row, i, arr) => (
              <div
                key={row.day}
                className={`flex items-center justify-between px-4 py-2.5 text-sm ${i < arr.length - 1 ? 'border-b border-gray-100' : ''} ${!row.hours ? 'opacity-50' : ''}`}
              >
                <span className={`font-medium ${!row.hours ? 'line-through text-gray-400' : 'text-gray-700'}`}>{row.day}</span>
                <span className="text-gray-500">{row.hours ?? 'Closed'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Booking modal */}
      {showModal && activeSession && (
        <BookingModal
          session={activeSession}
          step={bookingStep}
          selectedSlot={selectedSlot}
          assignedToken={assignedToken}
          loading={loading}
          onSelectSlot={setSelectedSlot}
          onConfirm={handleConfirm}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
