'use client'

import ProtectedPage from '@/components/ui/ProtectedPage'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api-client'
import Link from 'next/link'

interface Appointment {
  id: string
  appointmentDate: string
  status: string
  type: string
  doctorName: string
  specialization: string
}

const statusColor: Record<string, string> = {
  scheduled:  'bg-blue-100 text-blue-800',
  confirmed:  'bg-green-100 text-green-800',
  completed:  'bg-gray-100 text-gray-600',
  no_show:    'bg-red-100 text-red-800',
  cancelled:  'bg-yellow-100 text-yellow-800',
}

export default function PatientAppointmentsPage() {
  const { accessToken } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchAppointments() {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await apiRequest<{ data: Appointment[] }>('/api/appointments', { token: accessToken })
      setAppointments(res.data)
    } catch { /* handle */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAppointments() }, [accessToken])

  async function cancel(id: string) {
    if (!accessToken || !confirm('Cancel this appointment?')) return
    await apiRequest(`/api/appointments/${id}/cancel`, {
      method: 'PUT',
      token: accessToken,
      body: { reason: 'Patient cancelled' },
    })
    fetchAppointments()
  }

  return (
    <ProtectedPage allowedRoles={['patient']}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Appointments</h1>
            <p className="text-gray-500 text-sm mt-1">Your upcoming and past appointments</p>
          </div>
          <Link href="/patient/book"
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-700 transition-colors">
            + Book New
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <p className="text-gray-400 text-sm mb-3">No appointments yet</p>
            <Link href="/patient/book" className="text-brand-600 text-sm hover:underline">Book your first appointment →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((appt) => (
              <div key={appt.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between shadow-sm">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{appt.doctorName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(appt.appointmentDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' at '}
                    {new Date(appt.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{appt.specialization}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[appt.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {appt.status}
                  </span>
                  {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                    <button onClick={() => cancel(appt.id)}
                      className="text-xs text-red-600 hover:underline">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedPage>
  )
}
