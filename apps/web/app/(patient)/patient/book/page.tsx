'use client'

import { useEffect, useState, Suspense } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useSearchParams } from 'next/navigation'
import { apiRequest } from '@/lib/api-client'
import PenaltyWarning from '@/components/appointments/PenaltyWarning'
import {
  MapPin, Star, Phone, Clock, Check, AlertTriangle, CheckCircle,
  ChevronLeft, X, Search, Filter, Navigation2, Navigation,
} from 'lucide-react'
import { Map, MapMarker, MarkerContent, MarkerLabel, MarkerPopup, MapControls } from "@/components/ui/mapcn-marker-popup"
import { ClinicCard } from '@/components/patient/ClinicCard'

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

// Stable basemap definitions that avoid the broken OpenFreeMap sprite/tile fetch chain.
const FREE_MAP_STYLES = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

// ─── City Map ─────────────────────────────────────────────────────────────────
function CityMap({ onSelect, clinics }: { onSelect: (c: any) => void; clinics: any[] }) {
  const [viewport, setViewport] = useState({
    center: [79.8612, 6.9271] as [number, number],
    zoom: 14,
    bearing: 0,
    pitch: 0,
  });

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setViewport((prev) => ({
          ...prev,
          center: [position.coords.longitude, position.coords.latitude],
        }));
      },
      (error) => {
        console.warn("Location unavailable, using default city center:", error.code, error.message);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl border border-border">
      <Map
        viewport={viewport}
        onViewportChange={setViewport}
        styles={FREE_MAP_STYLES}
        onStyleImageMissing={(e) => {
          const map = e.target;
          const missingImageId = (e as any).detail?.id || "wood-pattern";

          if (!map.hasImage(missingImageId)) {
            const canvas = document.createElement("canvas");
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext("2d");

            if (ctx) {
              const imageData = ctx.getImageData(0, 0, 1, 1);
              map.addImage(missingImageId, imageData);
            }
          }
        }}
      >
        {/* Controls aligned cleanly at the bottom right */}
        <MapControls position="bottom-right" showZoom showLocate />

        {clinics.map(clinic => {
          const lon = clinic.longitude ?? 79.8612;
          const lat = clinic.latitude ?? 6.9271;
          return (
            <MapMarker key={clinic.id} longitude={lon} latitude={lat}>
              {/* Custom Blueprint Pulse Marker matching the style in clinic-finder */}
              <MarkerContent>
                <div className="relative flex items-center justify-center cursor-pointer group">
                  <div className="absolute h-6 w-6 rounded-full bg-blue-500/30 border-2 border-blue-500/40 animate-ping" />
                  <div className="relative h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow-lg group-hover:scale-110 group-hover:bg-blue-500 transition-all duration-200 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                </div>
                <MarkerLabel position="bottom">{clinic.name}</MarkerLabel>
              </MarkerContent>

              {/* Popup card details matching the requested design with a premium glassmorphic feel */}
              <MarkerPopup className="w-64 p-0 overflow-hidden bg-[#141B2B] text-slate-200 shadow-2xl rounded-xl border border-white/5">
                {/* Visual Header / Cover Image */}
                <div className="relative h-28 w-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15)_0%,transparent_100%)] animate-pulse duration-1000" />
                  <span className="text-white/20 text-5xl font-black select-none tracking-wider font-mono">
                    {clinic.name.substring(0, 2).toUpperCase()}
                  </span>
                  <div className="absolute bottom-2.5 left-3 bg-black/40 backdrop-blur-md px-2.5 py-0.5 rounded text-[10px] text-emerald-400 font-semibold tracking-wide border border-emerald-500/20">
                    ★ 4.8 / 5
                  </div>
                </div>

                {/* Clinic Details */}
                <div className="p-4 space-y-3.5">
                  <div>
                    <p className="text-slate-400/80 text-[10px] font-semibold tracking-wider uppercase">
                      Medical Center
                    </p>
                    <h3 className="font-semibold text-sm text-slate-100 tracking-tight mt-0.5">
                      {clinic.name}
                    </h3>
                  </div>

                  <div className="flex flex-col gap-2 pt-0.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-emerald-400 font-medium">Open Now</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-400">0.3 km away</span>
                    </div>
                    <div className="text-[11px] text-slate-400 leading-normal flex flex-col gap-0.5">
                      <p>{clinic.address || "No address provided"}</p>
                      <p className="text-slate-500">{clinic.phone || ""}</p>
                    </div>
                  </div>

                  {/* Book Token Button */}
                  <div className="pt-2 border-t border-white/5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect(clinic)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-8.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all active:scale-95 duration-150"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Book Token
                    </button>
                  </div>
                </div>
              </MarkerPopup>
            </MapMarker>
          );
        })}
      </Map>
    </div>
  );
}

// ─── Clinic card ──────────────────────────────────────────────────────────────

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
function PatientBookContent() {
  const { accessToken } = useAuth()
  const searchParams = useSearchParams()
  const initialClinicId = searchParams.get('clinicId')

  const [screen, setScreen] = useState<Screen>('finder')
  const [search, setSearch] = useState('')
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [clinics, setClinics] = useState<any[]>([])
  const [favoriteClinics, setFavoriteClinics] = useState<string[]>([])
  const [selectedClinic, setSelectedClinic] = useState<any | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [penalty, setPenalty] = useState<PenaltyInfo | null>(null)

  // Fetch all active clinics and favorites
  useEffect(() => {
    if (accessToken) {
      Promise.all([
        apiRequest<any[]>('/api/clinics', { token: accessToken }),
        apiRequest<any[]>('/api/patients/favorites', { token: accessToken }).catch(() => [])
      ])
        .then(([data, favorites]) => {
          setClinics(data)
          setFavoriteClinics(favorites.map(f => f.id))
          if (initialClinicId) {
            const clinic = data.find((c: any) => c.id === initialClinicId)
            if (clinic) {
              setSelectedClinic(clinic)
              setScreen('profile')
            }
          }
        })
        .catch((e) => console.log("API Error:", e.message))
    }
  }, [accessToken, initialClinicId])

  async function handleToggleFavorite(clinicId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!accessToken) return
    const isFav = favoriteClinics.includes(clinicId)
    setFavoriteClinics(prev => isFav ? prev.filter(id => id !== clinicId) : [...prev, clinicId])
    try {
      if (isFav) {
        await apiRequest(`/api/patients/favorites/${clinicId}`, { method: 'DELETE', token: accessToken })
      } else {
        await apiRequest('/api/patients/favorites', { method: 'POST', token: accessToken, body: { clinicId } })
      }
    } catch (err) {
      console.log('Error toggling favorite', err)
      setFavoriteClinics(prev => isFav ? [...prev, clinicId] : prev.filter(id => id !== clinicId))
    }
  }
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

  // When entering the profile screen, fetch doctors for the selected clinic + their slots
  useEffect(() => {
    if (screen !== 'profile' || !selectedClinic) return
    setLoadingSessions(true)

    apiRequest<any[]>(`/api/clinics/${selectedClinic.id}/doctors`, { token: accessToken ?? undefined })
      .then(async (docs) => {
        // map doctorId to id
        const mappedDocs = docs.map((d: any) => ({ ...d, id: d.doctorId }))
        setDoctors(mappedDocs)
        
        // Fetch slots for each doctor in parallel
        const results = await Promise.all(
          mappedDocs.map(async (doc) => {
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
      .catch((e) => console.log("API Error:", e.message))
      .finally(() => setLoadingSessions(false))
  }, [screen, selectedClinic, today, accessToken])

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

  const filteredClinics = clinics.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.address && c.address.toLowerCase().includes(search.toLowerCase()))
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="p-0.5 hover:bg-gray-250 rounded-full transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
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
          <CityMap 
            clinics={filteredClinics}
            onSelect={(c) => { setSelectedClinic(c); setScreen('profile') }} 
          />
        </div>

        {/* Nearby Clinics */}
        <div className="flex-shrink-0 bg-white border-t border-gray-200">
          <div className="px-5 pt-3 pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Nearby Clinics</h2>
              <p className="text-xs text-gray-400 mt-0.5">{filteredClinics.length} active</p>
            </div>
            <button className="text-xs text-[#1A73E8] font-medium hover:underline flex items-center gap-1">
              Find More <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
          <div className="flex gap-3 px-5 pb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {filteredClinics.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 w-full text-center">No clinics found matching your search.</div>
            ) : (
              filteredClinics.map(clinic => (
                <ClinicCard 
                  key={clinic.id} 
                  clinic={clinic}
                  onSelect={(c) => { setSelectedClinic(c); setScreen('profile') }}
                  isFavorite={favoriteClinics.includes(clinic.id)}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))
            )}
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
          <h2 className="text-lg font-semibold text-gray-900">{selectedClinic?.name}</h2>
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
            <span>{selectedClinic?.address || "No address"}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
            <Phone className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            <span>{selectedClinic?.phone || "No phone"}</span>
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

export default function PatientBookPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-gray-500">Loading...</div>}>
      <PatientBookContent />
    </Suspense>
  )
}
