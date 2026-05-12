'use client'

import { useEffect, useState } from 'react'
import { getSocket } from '../../lib/socket'
import { apiRequest } from '../../lib/api-client'
import type { WalkInQueueEntry, QueueUpdateEvent } from '@repo/types'

interface Props {
  doctorId: string
  clinicId?: string
  token: string
  initial: WalkInQueueEntry[]
}

export default function QueueBoard({ doctorId, clinicId, token, initial }: Props) {
  const [queue, setQueue] = useState<WalkInQueueEntry[]>(initial)
  const [calling, setCalling] = useState(false)

  useEffect(() => {
    const socket = getSocket(token)
    if (clinicId) socket.emit('subscribe_clinic_queue', clinicId)

    socket.on('queue_update', (event: QueueUpdateEvent) => {
      if (event.doctorId === doctorId) {
        // Re-fetch queue on update
        apiRequest<WalkInQueueEntry[]>(`/api/queue?doctorId=${doctorId}`, { token })
          .then(setQueue)
          .catch(() => {})
      }
    })

    return () => { socket.off('queue_update') }
  }, [doctorId, clinicId, token])

  async function callNext() {
    setCalling(true)
    try {
      await apiRequest('/api/queue/call-next', {
        method: 'POST',
        token,
        body: { doctorId, clinicId },
      })
    } finally {
      setCalling(false)
    }
  }

  const waiting = queue.filter((e) => e.status === 'waiting')
  const current = queue.find((e) => e.status === 'called' || e.status === 'in_progress')

  return (
    <div className="space-y-4">
      {/* Current patient */}
      {current && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-600 font-medium uppercase tracking-wide mb-1">Currently Serving</p>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-3xl font-bold text-blue-800">#{current.queueNumber}</span>
              <span className="ml-3 text-lg text-blue-700">{current.patientName}</span>
            </div>
            <button
              onClick={callNext}
              disabled={calling}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
            >
              {calling ? 'Calling...' : 'Call Next'}
            </button>
          </div>
        </div>
      )}

      {!current && (
        <button
          onClick={callNext}
          disabled={calling || waiting.length === 0}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-semibold transition-colors text-lg"
        >
          {calling ? 'Calling...' : `Call First Patient (${waiting.length} waiting)`}
        </button>
      )}

      {/* Waiting list */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
          Waiting ({waiting.length})
        </h3>
        <div className="space-y-2">
          {waiting.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-gray-700">#{entry.queueNumber}</span>
                <span className="text-gray-800">{entry.patientName}</span>
                {entry.smsPhone && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">SMS</span>
                )}
              </div>
              <span className="text-sm text-gray-400">~{entry.estimatedWaitMinutes ?? '?'} min</span>
            </div>
          ))}
          {waiting.length === 0 && (
            <p className="text-gray-400 text-center py-4">No patients waiting</p>
          )}
        </div>
      </div>
    </div>
  )
}
