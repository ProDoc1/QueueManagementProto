'use client'

import ProtectedPage from '@/components/ui/ProtectedPage'
import PenaltyWarning from '@/components/appointments/PenaltyWarning'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api-client'

interface Doctor { id: string; fullName: string; specialization: string; consultationFee: number; isAvailable: boolean }
interface Slot { id: string; hour: number; capacity: number; bookedCount: number }
interface PenaltyInfo { penaltyLevel: number }

export default function BookPage() {
  const { accessToken } = useAuth()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!)
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [penalty, setPenalty] = useState<PenaltyInfo | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiRequest<{ data: Doctor[] }>('/api/doctors').then((r) => setDoctors(r.data)).catch(() => {})
    if (accessToken) {
      apiRequest<PenaltyInfo>('/api/appointments/penalty/me', { token: accessToken }).then(setPenalty).catch(() => {})
    }
  }, [accessToken])

  useEffect(() => {
    if (!selectedDoctor) return
    setSelectedSlot(null)
    apiRequest<Slot[]>(`/api/appointments/slots?doctorId=${selectedDoctor.id}&date=${date}`)
      .then(setSlots).catch(() => setSlots([]))
  }, [selectedDoctor, date])

  async function handleBook() {
    if (!selectedDoctor || !selectedSlot || !accessToken) return
    setLoading(true)
    try {
      await apiRequest('/api/appointments', {
        method: 'POST',
        token: accessToken,
        body: { doctorId: selectedDoctor.id, slotId: selectedSlot.id, date, type: 'general' },
      })
      setSuccess(true)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Booking failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) return (
    <ProtectedPage allowedRoles={['patient']}>
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Appointment Booked!</h2>
        <p className="text-gray-500 text-sm mb-6">
          Your appointment with {selectedDoctor?.fullName} on {date} at {selectedSlot?.hour}:00 is confirmed.
        </p>
        <button onClick={() => { setSuccess(false); setSelectedSlot(null) }}
          className="text-sm text-brand-600 hover:underline">Book another</button>
      </div>
    </ProtectedPage>
  )

  return (
    <ProtectedPage allowedRoles={['patient']}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Book Appointment</h1>
          <p className="text-gray-500 text-sm mt-1">Choose a doctor and time slot</p>
        </div>

        {penalty && penalty.penaltyLevel > 0 && (
          <div className="mb-6">
            <PenaltyWarning level={penalty.penaltyLevel as 0|1|2|3} />
          </div>
        )}

        {/* Step 1 — Doctor */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <h2 className="font-semibold text-gray-800 mb-4">1. Select Doctor</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {doctors.length === 0 && <p className="text-gray-400 text-sm">No doctors available</p>}
            {doctors.map((doc) => (
              <button key={doc.id} onClick={() => setSelectedDoctor(doc)}
                className={`text-left border rounded-xl p-4 transition-all ${selectedDoctor?.id === doc.id ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-brand-300'}`}>
                <p className="font-medium text-sm text-gray-900">{doc.fullName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{doc.specialization}</p>
                <p className="text-xs text-gray-400 mt-1">Fee: ${doc.consultationFee}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2 — Date + Slots */}
        {selectedDoctor && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
            <h2 className="font-semibold text-gray-800 mb-4">2. Select Date & Time</h2>
            <input type="date" value={date} min={new Date().toISOString().split('T')[0]!}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-600" />
            <div className="grid grid-cols-4 gap-2">
              {slots.length === 0 && <p className="col-span-4 text-gray-400 text-sm">No slots available for this date</p>}
              {slots.map((slot) => {
                const full = slot.bookedCount >= slot.capacity
                return (
                  <button key={slot.id} disabled={full} onClick={() => setSelectedSlot(slot)}
                    className={`rounded-lg py-2 text-sm font-medium transition-all ${
                      full ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                      selectedSlot?.id === slot.id ? 'bg-brand-600 text-white' :
                      'bg-brand-50 text-brand-700 hover:bg-brand-100'
                    }`}>
                    {slot.hour}:00
                    <span className="block text-xs opacity-60">{slot.capacity - slot.bookedCount} left</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 3 — Confirm */}
        {selectedSlot && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4">3. Confirm Booking</h2>
            <div className="bg-gray-50 rounded-xl p-4 text-sm mb-4 space-y-1">
              <p><span className="text-gray-500">Doctor:</span> <span className="font-medium">{selectedDoctor?.fullName}</span></p>
              <p><span className="text-gray-500">Date:</span> <span className="font-medium">{date}</span></p>
              <p><span className="text-gray-500">Time:</span> <span className="font-medium">{selectedSlot.hour}:00</span></p>
            </div>
            <button onClick={handleBook} disabled={loading}
              className="w-full bg-brand-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-60">
              {loading ? 'Booking…' : 'Confirm Appointment'}
            </button>
          </div>
        )}
      </div>
    </ProtectedPage>
  )
}
