'use client'

import ProtectedPage from '@/components/ui/ProtectedPage'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api-client'

interface Appointment {
  id: string
  appointmentDate: string
  status: string
  type: string
  patientName: string
  slotPosition: number
}

const statusColor: Record<string, string> = {
  scheduled:   'bg-blue-100 text-blue-800',
  confirmed:   'bg-green-100 text-green-800',
  completed:   'bg-gray-100 text-gray-600',
  no_show:     'bg-red-100 text-red-800',
  cancelled:   'bg-yellow-100 text-yellow-800',
}

export default function DoctorSchedulePage() {
  const { accessToken } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!)

  async function fetchSchedule() {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await apiRequest<{ data: Appointment[] }>(
        `/api/appointments/schedule?date=${date}`,
        { token: accessToken }
      )
      setAppointments(res.data)
    } catch { /* handle */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchSchedule() }, [accessToken, date])

  async function markAction(id: string, action: 'complete' | 'no-show') {
    if (!accessToken) return
    await apiRequest(`/api/appointments/${id}/${action}`, { method: 'PUT', token: accessToken })
    fetchSchedule()
  }

  return (
    <ProtectedPage allowedRoles={['doctor']}>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
            <p className="text-gray-500 text-sm mt-1">Today's appointments</p>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
          />
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading schedule…</div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <p className="text-gray-400 text-sm">No appointments for this date</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((appt) => (
              <div key={appt.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold text-sm">
                    #{appt.slotPosition}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{appt.patientName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(appt.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' · '}{appt.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[appt.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {appt.status}
                  </span>
                  {appt.status !== 'completed' && appt.status !== 'cancelled' && (
                    <>
                      <button
                        onClick={() => markAction(appt.id, 'complete')}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Complete
                      </button>
                      <button
                        onClick={() => markAction(appt.id, 'no-show')}
                        className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        No-show
                      </button>
                    </>
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
