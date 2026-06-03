'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiRequest } from '@/lib/api-client'
import { CheckCircle, XCircle, Calendar } from 'lucide-react'

interface Appointment {
  id: string
  appointmentDate: string
  status: string
  type: string
  patientName: string
  slotPosition: number
}

const STATUS_STYLE: Record<string, string> = {
  scheduled:  'text-[#1A73E8] bg-[#1A73E8]/10',
  confirmed:  'text-[#34A853] bg-[#34A853]/10',
  completed:  'text-gray-500 bg-gray-500/10',
  no_show:    'text-[#EA4335] bg-[#EA4335]/10',
  cancelled:  'text-[#F9AB00] bg-[#F9AB00]/10',
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
        { token: accessToken },
      )
      setAppointments(res.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchSchedule() }, [accessToken, date])

  async function markAction(id: string, action: 'complete' | 'no-show') {
    if (!accessToken) return
    await apiRequest(`/api/appointments/${id}/${action}`, { method: 'PUT', token: accessToken })
    fetchSchedule()
  }

  const scheduled = appointments.filter((a) => a.status === 'scheduled' || a.status === 'confirmed')
  const done      = appointments.filter((a) => a.status === 'completed' || a.status === 'no_show' || a.status === 'cancelled')

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ scrollbarWidth: 'none' }}>
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Scheduled',  value: scheduled.length, color: '#1A73E8' },
          { label: 'Completed',  value: appointments.filter((a) => a.status === 'completed').length, color: '#34A853' },
          { label: 'No-Shows',   value: appointments.filter((a) => a.status === 'no_show').length,  color: '#EA4335' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#141B2B] rounded-xl p-4 border border-white/5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${kpi.color}20` }}>
              <Calendar className="w-4 h-4" style={{ color: kpi.color }} />
            </div>
            <p className="text-3xl font-black text-white">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Date picker + list */}
      <div className="bg-[#141B2B] rounded-xl border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">Appointments</h3>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-[#0D1117] border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 outline-none [color-scheme:dark]"
          />
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-500 text-sm">Loading schedule…</div>
        ) : appointments.length === 0 ? (
          <div className="py-16 text-center text-gray-600 text-sm">No appointments for this date</div>
        ) : (
          <div className="divide-y divide-white/5">
            {appointments.map((appt) => (
              <div key={appt.id} className={`flex items-center justify-between px-4 py-3.5 transition-colors ${
                appt.status === 'scheduled' || appt.status === 'confirmed' ? 'hover:bg-white/3' : 'opacity-60'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white ${
                    appt.status === 'scheduled' || appt.status === 'confirmed' ? 'bg-[#1A73E8]' : 'bg-gray-700'
                  }`}>
                    #{appt.slotPosition}
                  </div>
                  <div>
                    <p className="font-medium text-white text-sm">{appt.patientName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(appt.appointmentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' · '}{appt.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[appt.status] ?? 'text-gray-500 bg-gray-500/10'}`}>
                    {appt.status.replace('_', '-')}
                  </span>
                  {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                    <>
                      <button
                        onClick={() => markAction(appt.id, 'complete')}
                        className="flex items-center gap-1 text-xs bg-[#34A853]/15 hover:bg-[#34A853]/25 text-[#34A853] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Complete
                      </button>
                      <button
                        onClick={() => markAction(appt.id, 'no-show')}
                        className="flex items-center gap-1 text-xs bg-[#EA4335]/10 hover:bg-[#EA4335]/20 text-[#EA4335] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> No-Show
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
