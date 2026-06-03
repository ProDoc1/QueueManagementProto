'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiRequest } from '@/lib/api-client'
import { getSocket } from '@/lib/socket'
import type { WalkInQueueEntry, QueueUpdateEvent } from '@repo/types'
import { Activity } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  waiting:     'text-[#F9AB00] bg-[#F9AB00]/10',
  called:      'text-[#1A73E8] bg-[#1A73E8]/10',
  in_progress: 'text-[#1A73E8] bg-[#1A73E8]/10',
  completed:   'text-[#34A853] bg-[#34A853]/10',
  left:        'text-gray-500 bg-gray-500/10',
}

export default function DoctorQueuePage() {
  const { user, accessToken } = useAuth()
  const token = accessToken ?? ''
  const [doctorId, setDoctorId] = useState<string | null>(null)
  const [queue, setQueue] = useState<WalkInQueueEntry[]>([])
  const [calling, setCalling] = useState(false)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    if (!user) return
    apiRequest<{ id: string }>('/api/doctors/me', { token })
      .then((d) => setDoctorId(d.id))
      .catch(() => setDoctorId(user.id))
  }, [user, token])

  function refetch() {
    if (!doctorId) return
    apiRequest<WalkInQueueEntry[]>(`/api/queue?doctorId=${doctorId}`, { token })
      .then(setQueue).catch(() => {})
  }

  useEffect(() => {
    if (!doctorId) return
    refetch()
    const socket = getSocket(token)
    socket.emit('subscribe_doctor_queue', doctorId)
    socket.on('queue_update', (event: QueueUpdateEvent) => {
      if (event.doctorId === doctorId) refetch()
    })
    return () => { socket.off('queue_update') }
  }, [doctorId, token])

  async function callNext() {
    if (!doctorId) return
    setCalling(true)
    try {
      await apiRequest('/api/queue/call-next', { method: 'POST', token, body: { doctorId } })
      refetch()
    } finally { setCalling(false) }
  }

  async function completeCurrent() {
    if (!doctorId) return
    setCompleting(true)
    try {
      await apiRequest('/api/queue/complete-current', { method: 'POST', token, body: { doctorId } })
      refetch()
    } finally { setCompleting(false) }
  }

  const waiting = queue.filter((e) => e.status === 'waiting')
  const current = queue.find((e) => e.status === 'called' || e.status === 'in_progress')

  if (!doctorId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading queue…</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ scrollbarWidth: 'none' }}>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#141B2B] rounded-xl p-4 border border-white/5">
          <div className="w-8 h-8 rounded-lg bg-[#F9AB00]/15 flex items-center justify-center mb-2">
            <Activity className="w-4 h-4 text-[#F9AB00]" />
          </div>
          <p className="text-3xl font-black text-white">{waiting.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Waiting</p>
        </div>
        <div className="bg-[#141B2B] rounded-xl p-4 border border-white/5">
          <p className="text-xs text-gray-500 mb-1">Current Token</p>
          <p className="text-5xl font-black text-[#34A853] leading-none">
            {current ? `#${String(current.queueNumber).padStart(2, '0')}` : '—'}
          </p>
        </div>
      </div>

      {/* Current patient */}
      {current && (
        <div className="bg-[#1A73E8]/10 border border-[#1A73E8]/20 rounded-xl p-5">
          <p className="text-xs text-[#1A73E8] font-medium uppercase tracking-wide mb-2">Currently Serving</p>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-3xl font-bold text-[#1A73E8]">#{String(current.queueNumber).padStart(2, '0')}</span>
              <span className="ml-3 text-lg text-white">{current.patientName}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={completeCurrent}
                disabled={completing}
                className="bg-[#34A853]/20 hover:bg-[#34A853]/30 disabled:opacity-50 text-[#34A853] px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                {completing ? 'Completing…' : 'Complete'}
              </button>
              <button
                onClick={callNext}
                disabled={calling}
                className="bg-[#F9AB00] hover:bg-[#E09A00] disabled:opacity-50 text-[#1A1C20] px-6 py-2 rounded-lg text-sm font-bold transition-colors"
              >
                {calling ? 'Calling…' : 'Call Next'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!current && (
        <button
          onClick={callNext}
          disabled={calling || waiting.length === 0}
          className="w-full bg-[#34A853] hover:bg-[#2D8F47] disabled:opacity-50 text-white px-6 py-3 rounded-xl font-semibold transition-colors text-lg"
        >
          {calling ? 'Calling…' : `Call First Patient (${waiting.length} waiting)`}
        </button>
      )}

      {/* Waiting list */}
      <div className="bg-[#141B2B] rounded-xl border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">Waiting ({waiting.length})</h3>
        </div>
        {waiting.length === 0 ? (
          <p className="text-gray-600 text-center py-8 text-sm">No patients waiting</p>
        ) : (
          <div className="divide-y divide-white/5">
            {waiting.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-white">#{String(entry.queueNumber).padStart(2, '0')}</span>
                  <span className="text-gray-200 text-sm">{entry.patientName}</span>
                  {entry.smsPhone && (
                    <span className="text-[11px] bg-[#34A853]/15 text-[#34A853] px-2 py-0.5 rounded-full">SMS</span>
                  )}
                </div>
                <span className="text-xs text-gray-500">~{entry.estimatedWaitMinutes ?? '?'} min</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
