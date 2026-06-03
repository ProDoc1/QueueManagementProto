'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiRequest } from '@/lib/api-client'
import { getSocket } from '@/lib/socket'
import type { WalkInQueueEntry, QueueUpdateEvent } from '@repo/types'
import { UserPlus, Phone, Plus, Maximize2, X, Activity } from 'lucide-react'

interface Doctor {
  id: string
  fullName: string
  specialization: string
  clinicName?: string | null
}

type QueueStatus = 'waiting' | 'in-room' | 'done' | 'no-show'

const STATUS_COLORS: Record<string, string> = {
  waiting:     'text-[#F9AB00] bg-[#F9AB00]/10',
  called:      'text-[#1A73E8] bg-[#1A73E8]/10',
  in_progress: 'text-[#1A73E8] bg-[#1A73E8]/10',
  completed:   'text-[#34A853] bg-[#34A853]/10',
  left:        'text-gray-500 bg-gray-500/10',
}

export default function ReceptionistQueuePage() {
  const { accessToken } = useAuth()
  const token = accessToken ?? ''

  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedDoctorId, setSelectedDoctorId] = useState('')
  const [clinicId, setClinicId] = useState('')
  const [queue, setQueue] = useState<WalkInQueueEntry[]>([])
  const [patientName, setPatientName] = useState('')
  const [phone, setPhone] = useState('')
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [calling, setCalling] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [showFullScreen, setShowFullScreen] = useState(false)

  useEffect(() => {
    apiRequest<{ data: Doctor[] }>('/api/doctors', { token })
      .then(({ data: list }) => {
        setDoctors(list)
        const first = list[0]
        if (first) {
          setSelectedDoctorId(first.id)
          setClinicId(first.clinicName ?? '')
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDoctors(false))
  }, [token])

  function refetchQueue() {
    if (!selectedDoctorId) return
    apiRequest<WalkInQueueEntry[]>(`/api/queue?doctorId=${selectedDoctorId}`, { token })
      .then(setQueue).catch(() => {})
  }

  useEffect(() => {
    if (!selectedDoctorId) return
    refetchQueue()
    const socket = getSocket(token)
    if (clinicId) socket.emit('subscribe_clinic_queue', clinicId)
    socket.emit('subscribe_doctor_queue', selectedDoctorId)
    socket.on('queue_update', (event: QueueUpdateEvent) => {
      if (event.doctorId === selectedDoctorId) refetchQueue()
    })
    return () => { socket.off('queue_update') }
  }, [selectedDoctorId, clinicId, token])

  async function handleIssueToken() {
    if (!patientName.trim() || !selectedDoctorId) return
    setIssuing(true)
    try {
      await apiRequest('/api/queue', {
        method: 'POST', token,
        body: { patientName: patientName.trim(), smsPhone: phone.trim() || undefined, doctorId: selectedDoctorId, clinicId },
      })
      setPatientName('')
      setPhone('')
      refetchQueue()
    } catch { /* ignore */ }
    finally { setIssuing(false) }
  }

  async function handleCallNext() {
    setCalling(true)
    try {
      await apiRequest('/api/queue/call-next', { method: 'POST', token, body: { doctorId: selectedDoctorId, clinicId } })
      refetchQueue()
    } finally { setCalling(false) }
  }

  async function handleComplete() {
    setCompleting(true)
    try {
      await apiRequest('/api/queue/complete-current', { method: 'POST', token, body: { doctorId: selectedDoctorId } })
      refetchQueue()
    } finally { setCompleting(false) }
  }

  const waiting = queue.filter((e) => e.status === 'waiting')
  const current = queue.find((e) => e.status === 'called' || e.status === 'in_progress')
  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId)
  const currentNumber = current?.queueNumber ?? null

  // Full-screen TV display
  if (showFullScreen) {
    return (
      <div className="fixed inset-0 bg-[#0D1117] flex flex-col items-center justify-center z-50">
        <div className="text-center">
          <p className="text-[#34A853] text-sm font-semibold uppercase tracking-[0.3em] mb-2">MediQueue Clinic</p>
          <p className="text-gray-500 text-xs uppercase tracking-[0.2em] mb-8">
            {selectedDoctor ? `Dr. ${selectedDoctor.fullName} · ${selectedDoctor.specialization}` : ''}
          </p>
          <p className="text-gray-400 text-lg font-semibold uppercase tracking-[0.25em] mb-4">NOW SERVING</p>
          <p className="text-[12rem] font-black text-white leading-none tracking-tighter">
            {currentNumber !== null ? `#${String(currentNumber).padStart(2, '0')}` : '—'}
          </p>
          <p className="text-gray-500 mt-6 text-base">Please proceed to consultation room</p>
        </div>
        <button
          onClick={() => setShowFullScreen(false)}
          className="absolute top-6 right-6 text-gray-600 hover:text-white transition-colors flex items-center gap-2 text-sm"
        >
          <X className="w-5 h-5" /> Exit Full Screen
        </button>
      </div>
    )
  }

  if (loadingDoctors) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ scrollbarWidth: 'none' }}>
      {/* Doctor selector */}
      {doctors.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 whitespace-nowrap">Queue for:</label>
          <select
            value={selectedDoctorId}
            onChange={(e) => {
              setSelectedDoctorId(e.target.value)
              const d = doctors.find((doc) => doc.id === e.target.value)
              setClinicId(d?.clinicName ?? '')
            }}
            className="bg-[#141B2B] border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-[#1A73E8]/40"
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>Dr. {d.fullName} — {d.specialization}</option>
            ))}
          </select>
        </div>
      )}

      {/* Top two-column cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Issue walk-in token */}
        <div className="bg-[#141B2B] rounded-xl p-5 border border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-white">Issue Walk-In Token</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Patient Name</label>
              <input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Enter full name"
                className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 placeholder-gray-600 outline-none focus:border-[#34A853]/40 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Phone Number (optional)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+94 71 234 5678"
                  className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg pl-9 pr-3 py-2.5 placeholder-gray-600 outline-none focus:border-[#34A853]/40 transition-colors"
                />
              </div>
            </div>
          </div>
          <button
            onClick={handleIssueToken}
            disabled={issuing || !patientName.trim()}
            className="mt-4 w-full bg-[#34A853] hover:bg-[#2D8F47] disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> {issuing ? 'Issuing…' : 'Issue Token'}
          </button>
        </div>

        {/* Operational status */}
        <div className="bg-[#141B2B] rounded-xl p-5 border border-white/5 flex flex-col">
          <h3 className="text-sm font-semibold text-white mb-1">Operational Status</h3>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-[#34A853] animate-pulse flex-shrink-0" />
            <span className="text-xs text-gray-400">
              {selectedDoctor ? `Dr. ${selectedDoctor.fullName}` : 'No doctor selected'}
            </span>
          </div>
          <div className="flex items-end justify-between mb-5 flex-1">
            <div>
              <p className="text-xs text-gray-500 mb-1">Waiting</p>
              <p className="text-2xl font-bold text-white">{waiting.length}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Current Token</p>
              <p className="text-5xl font-black text-[#34A853] leading-none">
                {currentNumber !== null ? `#${String(currentNumber).padStart(2, '0')}` : '—'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {current && (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {completing ? 'Completing…' : 'Complete'}
              </button>
            )}
            <button
              onClick={handleCallNext}
              disabled={calling || waiting.length === 0}
              className="flex-1 bg-[#F9AB00] hover:bg-[#E09A00] disabled:opacity-50 text-[#1A1C20] font-bold py-3 rounded-lg text-sm transition-colors"
            >
              {calling ? 'Calling…' : 'Call Next Patient'}
            </button>
          </div>
        </div>
      </div>

      {/* TV screen preview */}
      <div className="bg-[#141B2B] rounded-xl overflow-hidden border border-white/5">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Public TV Screen Preview</span>
          </div>
          <button
            onClick={() => setShowFullScreen(true)}
            className="text-xs text-[#34A853] hover:underline flex items-center gap-1"
          >
            Open Full Screen <Maximize2 className="w-3 h-3" />
          </button>
        </div>
        <div className="bg-[#0D1117] px-6 py-10 text-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-[0.25em] mb-3">NOW SERVING</p>
          <p className="text-8xl font-black text-white leading-none mb-4">
            {currentNumber !== null ? `#${String(currentNumber).padStart(2, '0')}` : '—'}
          </p>
          <p className="text-gray-600 text-sm">Please proceed to consultation room</p>
        </div>
      </div>

      {/* Queue table */}
      <div className="bg-[#141B2B] rounded-xl border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">Active Queue</h3>
          <span className="text-xs text-gray-500">
            {waiting.length} waiting · {queue.filter((q) => q.status === 'completed').length} done
          </span>
        </div>
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-white/5">
                {['Token #', 'Patient Name', 'Phone', 'Status', 'Checked In', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-600 text-sm">No patients in queue</td>
                </tr>
              )}
              {queue.map((entry) => (
                <tr
                  key={entry.id}
                  className={`border-b border-white/5 transition-colors ${
                    entry.status === 'called' || entry.status === 'in_progress' ? 'bg-[#1A73E8]/8' : 'hover:bg-white/3'
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className={`text-sm font-bold ${entry.queueNumber === currentNumber ? 'text-[#34A853]' : 'text-white'}`}>
                      #{String(entry.queueNumber).padStart(2, '0')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-200">{entry.patientName}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{entry.smsPhone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[entry.status] ?? 'text-gray-500 bg-gray-500/10'}`}>
                      {entry.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(entry.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {entry.status === 'waiting' && (
                        <button
                          onClick={() => apiRequest(`/api/queue/${entry.id}/status`, { method: 'PUT', token, body: { status: 'completed' } }).then(refetchQueue)}
                          className="text-[11px] bg-[#34A853]/15 hover:bg-[#34A853]/25 text-[#34A853] px-2 py-1 rounded transition-colors"
                        >
                          Done
                        </button>
                      )}
                      {entry.status !== 'left' && entry.status !== 'completed' && (
                        <button
                          onClick={() => apiRequest(`/api/queue/${entry.id}/status`, { method: 'PUT', token, body: { status: 'left' } }).then(refetchQueue)}
                          className="text-[11px] bg-gray-500/15 hover:bg-gray-500/25 text-gray-400 px-2 py-1 rounded transition-colors"
                        >
                          No-Show
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TV display link */}
      {clinicId && (
        <div className="bg-[#141B2B] border border-white/5 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">TV Display Screen</p>
            <p className="text-xs text-gray-500">Share this URL with the clinic display screen</p>
          </div>
          <a
            href={`/display/${clinicId}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm bg-[#1A73E8] text-white px-4 py-2 rounded-lg hover:bg-[#1557B0] transition-colors"
          >
            Open Display →
          </a>
        </div>
      )}
    </div>
  )
}
