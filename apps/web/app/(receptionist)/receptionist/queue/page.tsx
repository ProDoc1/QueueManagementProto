'use client'

import ProtectedPage from '@/components/ui/ProtectedPage'
import WalkInForm from '@/components/queue/WalkInForm'
import QueueBoard from '@/components/queue/QueueBoard'
import { useAuth } from '@/lib/auth-context'
import { apiRequest } from '@/lib/api-client'
import { useEffect, useState } from 'react'
import type { WalkInQueueEntry } from '@repo/types'

type Doctor = { id: string; fullName: string; specialization: string; clinicName?: string | null }

export default function ReceptionistQueuePage() {
  const { accessToken } = useAuth()
  const token = accessToken ?? ''

  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [selectedDoctorId, setSelectedDoctorId] = useState('')
  const [clinicId, setClinicId] = useState('')
  const [loadingDoctors, setLoadingDoctors] = useState(true)

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

  function handleAdded(_entry: WalkInQueueEntry) {
    // QueueBoard refetches itself via socket; no extra state needed
  }

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId)

  return (
    <ProtectedPage allowedRoles={['receptionist', 'admin']}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Queue Management</h1>
            <p className="text-gray-500 text-sm mt-1">Add walk-in patients and manage today's queue</p>
          </div>

          {/* Doctor selector */}
          {!loadingDoctors && doctors.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Viewing queue for:</label>
              <select
                value={selectedDoctorId}
                onChange={(e) => {
                  setSelectedDoctorId(e.target.value)
                  const d = doctors.find((doc) => doc.id === e.target.value)
                  setClinicId(d?.clinicName ?? '')
                }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.fullName} — {d.specialization}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loadingDoctors ? (
          <div className="text-center py-20 text-gray-400 text-sm">Loading doctors…</div>
        ) : doctors.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-sm text-yellow-800">
            No doctors found. Make sure the API is running and at least one doctor is registered.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add walk-in */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Add Walk-In Patient</h2>
                <WalkInForm
                  doctors={doctors}
                  clinicId={clinicId}
                  token={token}
                  onAdded={handleAdded}
                />
              </div>
            </div>

            {/* Queue board */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h2 className="font-semibold text-gray-800 mb-4">
                  Today's Queue
                  {selectedDoctor && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      — Dr. {selectedDoctor.fullName}
                    </span>
                  )}
                </h2>
                <QueueBoard
                  key={selectedDoctorId}
                  doctorId={selectedDoctorId}
                  clinicId={clinicId}
                  token={token}
                />
              </div>
            </div>
          </div>
        )}

        {/* TV Display link */}
        {clinicId && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">TV Display Screen</p>
              <p className="text-xs text-blue-600">Share this URL with the clinic display screen</p>
            </div>
            <a
              href={`/display/${clinicId}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Open Display →
            </a>
          </div>
        )}
      </div>
    </ProtectedPage>
  )
}
