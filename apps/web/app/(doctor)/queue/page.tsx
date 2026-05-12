'use client'

import ProtectedPage from '@/components/ui/ProtectedPage'
import QueueBoard from '@/components/queue/QueueBoard'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api-client'

export default function DoctorQueuePage() {
  const { user, accessToken } = useAuth()
  const [doctorId, setDoctorId] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !accessToken) return
    // Fetch the doctor record for the logged-in user
    apiRequest<{ id: string }>('/api/doctors/me', { token: accessToken })
      .then((d) => setDoctorId(d.id))
      .catch(() => {
        // Fallback: use userId directly (doctor record lookup TODO)
        setDoctorId(user.id)
      })
  }, [user, accessToken])

  return (
    <ProtectedPage allowedRoles={['doctor']}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Walk-In Queue</h1>
          <p className="text-gray-500 text-sm mt-1">Patients waiting to see you today</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {doctorId ? (
            <QueueBoard doctorId={doctorId} clinicId="" />
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm">Loading queue…</div>
          )}
        </div>
      </div>
    </ProtectedPage>
  )
}
