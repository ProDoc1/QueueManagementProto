'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  Stethoscope, Search, ShieldAlert,
  MapPin, CheckCircle, AlertCircle, X, Globe, UserCheck, UserX
} from 'lucide-react'

interface AdminDoctor {
  id: string
  userId: string
  fullName: string
  email: string
  specialization: string
  licenseNumber: string
  isAvailable: boolean
  isActive: boolean
  createdAt: string
  clinics: string[]
}

export default function AdminDoctorsDirectory() {
  const { accessToken } = useAuth()
  const [doctors, setDoctors] = useState<AdminDoctor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000'

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchDoctors = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/doctors/directory`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(await res.text())
      setDoctors(await res.json())
    } catch {
      showToast('Failed to load doctors', false)
    } finally {
      setLoading(false)
    }
  }, [accessToken, API])

  useEffect(() => { fetchDoctors() }, [fetchDoctors])

  const filtered = doctors.filter(d =>
    search ? 
      d.fullName.toLowerCase().includes(search.toLowerCase()) ||
      d.email.toLowerCase().includes(search.toLowerCase()) ||
      d.licenseNumber.toLowerCase().includes(search.toLowerCase()) ||
      d.specialization.toLowerCase().includes(search.toLowerCase())
    : true
  )

  const total = doctors.length
  const active = doctors.filter(d => d.isActive).length
  const inactive = doctors.filter(d => !d.isActive).length

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ scrollbarWidth: 'none' }}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl border transition-all ${
          toast.ok
            ? 'bg-[#34A853]/15 border-[#34A853]/30 text-[#34A853]'
            : 'bg-[#EA4335]/15 border-[#EA4335]/30 text-[#EA4335]'
        }`}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">System-Wide Doctor Directory</h2>
          <p className="text-xs text-gray-500 mt-0.5">Master view of all registered doctors across all clinics</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Doctors', value: total,   color: 'text-white',       bg: 'bg-white/5'         },
          { label: 'Active',        value: active,  color: 'text-[#34A853]',   bg: 'bg-[#34A853]/10'   },
          { label: 'Suspended',     value: inactive,color: 'text-[#EA4335]',   bg: 'bg-[#EA4335]/10'   },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-white/5`}>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter / Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, email, license, or specialty..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#141B2B] border border-white/5 text-white text-xs rounded-xl pl-9 pr-3 py-2.5 placeholder-gray-600 outline-none focus:border-white/20 transition-colors"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-[#141B2B] rounded-xl border border-white/5 p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/5" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 bg-white/5 rounded w-3/4" />
                  <div className="h-2 bg-white/5 rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2 bg-white/5 rounded w-full" />
                <div className="h-2 bg-white/5 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <Stethoscope className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-400">No doctors found</h3>
          <p className="text-xs text-gray-600 mt-1 max-w-xs">
            {search ? 'Try changing your search terms.' : 'There are no registered doctors yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(doctor => {
            const date = new Date(doctor.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div key={doctor.id} className="bg-[#141B2B] rounded-xl border border-white/5 p-5 hover:border-white/10 transition-all duration-200 group">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#F9AB00]/15 flex items-center justify-center flex-shrink-0">
                      <Stethoscope className="w-5 h-5 text-[#F9AB00]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">{doctor.fullName}</h3>
                      <p className="text-[10px] text-gray-500 mt-0.5">{doctor.specialization}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {doctor.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#34A853] bg-[#34A853]/15">
                        <UserCheck className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#EA4335] bg-[#EA4335]/15">
                        <UserX className="w-3 h-3" /> Suspended
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400 font-mono">{doctor.licenseNumber}</p>
                      <p className="text-[10px] text-gray-600">License Number</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Globe className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400 truncate">{doctor.email}</p>
                      <p className="text-[10px] text-gray-600">Account Email</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 mt-0.5" />
                    <div>
                      {doctor.clinics.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {doctor.clinics.map(c => (
                            <span key={c} className="text-[10px] bg-white/5 text-gray-300 px-1.5 py-0.5 rounded">
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic mt-0.5">No assigned clinics</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                  <p className="text-[10px] text-gray-600">Registered {date}</p>
                  <p className="text-[10px] text-gray-500">
                    ID: {doctor.id.substring(0, 8)}...
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
