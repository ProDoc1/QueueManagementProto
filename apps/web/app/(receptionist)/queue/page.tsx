'use client'

import ProtectedPage from '@/components/ui/ProtectedPage'
import WalkInForm from '@/components/queue/WalkInForm'
import QueueBoard from '@/components/queue/QueueBoard'
import { useState } from 'react'

// TODO: replace with real doctorId + clinicId from auth/doctor selection
const DEMO_DOCTOR_ID = ''
const DEMO_CLINIC_ID = ''

export default function ReceptionistQueuePage() {
  const [refresh, setRefresh] = useState(0)

  return (
    <ProtectedPage allowedRoles={['receptionist', 'admin']}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Queue Management</h1>
          <p className="text-gray-500 text-sm mt-1">Add walk-in patients and manage today's queue</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add walk-in */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Add Walk-In Patient</h2>
              {DEMO_DOCTOR_ID ? (
                <WalkInForm onSuccess={() => setRefresh((r) => r + 1)} />
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                  ⚠️ Set DEMO_DOCTOR_ID at the top of this file to enable walk-in entry.
                </div>
              )}
            </div>
          </div>

          {/* Queue board */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Today's Queue</h2>
              {DEMO_DOCTOR_ID ? (
                <QueueBoard key={refresh} doctorId={DEMO_DOCTOR_ID} clinicId={DEMO_CLINIC_ID} />
              ) : (
                <div className="text-gray-400 text-sm text-center py-12">
                  Set DEMO_DOCTOR_ID to see the queue
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TV Display link */}
        {DEMO_CLINIC_ID && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">TV Display Screen</p>
              <p className="text-xs text-blue-600">Share this URL with the clinic display screen</p>
            </div>
            <a
              href={`/display/${DEMO_CLINIC_ID}`}
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
