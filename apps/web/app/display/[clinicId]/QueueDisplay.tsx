'use client'

import { useEffect, useState } from 'react'
import { getSocket } from '../../../lib/socket'
import type { QueueUpdateEvent } from '@repo/types'

interface QueueRow {
  queueNumber: number
  status: string
  patientName: string
  doctorName: string
  doctorId: string
}

export default function QueueDisplay({ clinicId, initial }: { clinicId: string; initial: QueueRow[] }) {
  const [rows, setRows] = useState<QueueRow[]>(initial)
  const [currentNumber, setCurrentNumber] = useState<number | null>(
    initial.find((r) => r.status === 'called' || r.status === 'in_progress')?.queueNumber ?? null
  )
  const [waitingCount, setWaitingCount] = useState(initial.filter((r) => r.status === 'waiting').length)
  const [flash, setFlash] = useState(false)
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    const socket = getSocket()
    socket.emit('subscribe_clinic_queue', clinicId)

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', () => setConnected(false))

    socket.on('queue_update', (event: QueueUpdateEvent) => {
      if (event.clinicId !== clinicId) return
      setCurrentNumber(event.currentNumber)
      setWaitingCount(event.waitingCount)
      // Flash animation when number changes
      setFlash(true)
      setTimeout(() => setFlash(false), 1500)
    })

    return () => {
      socket.off('queue_update')
      socket.off('connect')
      socket.off('disconnect')
      socket.off('connect_error')
    }
  }, [clinicId])

  const now = new Date()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 text-white flex flex-col">
      {!connected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#141B2B] border border-white/10 rounded-2xl px-8 py-6 text-center">
            <div className="w-3 h-3 rounded-full bg-[#F9AB00] animate-ping mx-auto mb-3" />
            <p className="text-white font-semibold">Reconnecting…</p>
            <p className="text-gray-400 text-sm mt-1">Waiting for live connection</p>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="p-8 text-center border-b border-blue-600">
        <h1 className="text-4xl font-bold tracking-wide">Queue Display</h1>
        <p className="text-blue-200 mt-2 text-lg">
          {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </header>

      {/* Now Serving */}
      <div className="flex-1 flex flex-col items-center justify-center gap-12 p-8">
        <div className={`text-center transition-all duration-300 ${flash ? 'scale-110' : 'scale-100'}`}>
          <p className="text-2xl text-blue-200 mb-4 uppercase tracking-widest">Now Serving</p>
          <div className={`text-9xl font-black ${flash ? 'text-yellow-300' : 'text-white'} transition-colors`}>
            {currentNumber ?? '—'}
          </div>
        </div>

        {/* Waiting count */}
        <div className="bg-blue-800 rounded-2xl px-12 py-6 text-center">
          <p className="text-blue-300 text-lg uppercase tracking-widest mb-1">Patients Waiting</p>
          <p className="text-5xl font-bold">{waitingCount}</p>
        </div>

        {/* Queue list */}
        {rows.length > 0 && (
          <div className="w-full max-w-2xl">
            <h2 className="text-xl text-blue-200 mb-4 text-center uppercase tracking-wider">Queue</h2>
            <div className="space-y-2">
              {rows.slice(0, 8).map((row) => (
                <div
                  key={row.queueNumber}
                  className={`flex items-center justify-between rounded-xl px-6 py-3 ${
                    row.status === 'called' || row.status === 'in_progress'
                      ? 'bg-yellow-500 text-yellow-900 font-bold'
                      : 'bg-blue-800 text-blue-100'
                  }`}
                >
                  <span className="text-2xl font-bold">#{row.queueNumber}</span>
                  <span className="text-lg">{row.patientName}</span>
                  <span className={`text-sm px-3 py-1 rounded-full ${
                    row.status === 'waiting' ? 'bg-blue-600' : 'bg-yellow-400 text-yellow-900'
                  }`}>
                    {row.status === 'called' ? 'Please Proceed' : row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="p-4 text-center text-blue-400 text-sm">
        Please listen for your number or watch this screen. Thank you for your patience.
      </footer>
    </div>
  )
}
