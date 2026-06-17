'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  Building2, Plus, Search, X, CheckCircle, AlertCircle,
  MapPin, Phone, Globe, Clock, ChevronDown, Trash2, Edit3,
  ShieldCheck, ShieldOff, ShieldAlert, MoreVertical, Users,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Clinic {
  id: string
  name: string
  address: string | null
  phone: string | null
  timezone: string
  latitude: number | null
  longitude: number | null
  status: 'pending' | 'active' | 'suspended'
  createdAt: string
}

type ClinicStatus = 'pending' | 'active' | 'suspended'

const STATUS_CONFIG: Record<ClinicStatus, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:   { label: 'Pending',   color: 'text-[#F9AB00]', bg: 'bg-[#F9AB00]/15',  icon: ShieldAlert },
  active:    { label: 'Active',    color: 'text-[#34A853]', bg: 'bg-[#34A853]/15',  icon: ShieldCheck },
  suspended: { label: 'Suspended', color: 'text-[#EA4335]', bg: 'bg-[#EA4335]/15',  icon: ShieldOff   },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function field(label: string, node: React.ReactNode) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1.5 block">{label}</label>
      {node}
    </div>
  )
}

const inputCls =
  'w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 ' +
  'placeholder-gray-600 outline-none focus:border-[#1A73E8]/50 transition-colors'

// ── Subcomponents ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ClinicStatus }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color} ${cfg.bg}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

function ClinicCard({
  clinic, onStatusChange, onEdit, onDelete,
}: {
  clinic: Clinic
  onStatusChange: (id: string, status: ClinicStatus) => void
  onEdit: (clinic: Clinic) => void
  onDelete: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const date = new Date(clinic.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="bg-[#141B2B] rounded-xl border border-white/5 p-5 hover:border-white/10 transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#1A73E8]/15 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-[#1A73E8]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{clinic.name}</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Added {date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={clinic.status} />
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 transition-colors"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-8 z-20 bg-[#1A2237] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[160px]"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button onClick={() => { onEdit(clinic); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                  <Edit3 className="w-3.5 h-3.5" /> Edit Details
                </button>
                {clinic.status !== 'active' && (
                  <button onClick={() => { onStatusChange(clinic.id, 'active'); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#34A853] hover:bg-[#34A853]/10 transition-colors">
                    <ShieldCheck className="w-3.5 h-3.5" /> Approve
                  </button>
                )}
                {clinic.status !== 'pending' && (
                  <button onClick={() => { onStatusChange(clinic.id, 'pending'); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#F9AB00] hover:bg-[#F9AB00]/10 transition-colors">
                    <ShieldAlert className="w-3.5 h-3.5" /> Set Pending
                  </button>
                )}
                {clinic.status !== 'suspended' && (
                  <button onClick={() => { onStatusChange(clinic.id, 'suspended'); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#EA4335] hover:bg-[#EA4335]/10 transition-colors">
                    <ShieldOff className="w-3.5 h-3.5" /> Suspend
                  </button>
                )}
                <div className="border-t border-white/5 my-1" />
                <button onClick={() => { onDelete(clinic.id); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#EA4335] hover:bg-[#EA4335]/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2">
        {clinic.address && (
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400 leading-relaxed">{clinic.address}</p>
          </div>
        )}
        {clinic.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
            <p className="text-xs text-gray-400">{clinic.phone}</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
          <p className="text-xs text-gray-400">{clinic.timezone}</p>
        </div>
      </div>

      {/* Quick approve action for pending */}
      {clinic.status === 'pending' && (
        <button
          onClick={() => onStatusChange(clinic.id, 'active')}
          className="mt-4 w-full bg-[#34A853]/15 hover:bg-[#34A853]/25 border border-[#34A853]/20 text-[#34A853] text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Approve & Activate
        </button>
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  clinic?: Clinic | null
  onClose: () => void
  onSave: (data: Partial<Clinic>) => Promise<void>
}

function ClinicModal({ clinic, onClose, onSave }: ModalProps) {
  const isEdit = !!clinic
  const [form, setForm] = useState({
    name:      clinic?.name      ?? '',
    address:   clinic?.address   ?? '',
    phone:     clinic?.phone     ?? '',
    timezone:  clinic?.timezone  ?? 'Asia/Colombo',
    status:    clinic?.status    ?? ('pending' as ClinicStatus),
    latitude:  clinic?.latitude  != null ? String(clinic.latitude)  : '',
    longitude: clinic?.longitude != null ? String(clinic.longitude) : '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      await onSave({
        name:      form.name,
        address:   form.address || undefined,
        phone:     form.phone   || undefined,
        timezone:  form.timezone,
        status:    form.status  as ClinicStatus,
        latitude:  form.latitude  ? parseFloat(form.latitude)  : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111827] rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#1A73E8]/15 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-[#1A73E8]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{isEdit ? 'Edit Clinic' : 'Onboard New Medical Center'}</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">{isEdit ? 'Update clinic details' : 'Register a new clinic or hospital'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {field('Clinic / Hospital Name *', (
            <input type="text" required placeholder="e.g. City Medical Centre" value={form.name} onChange={set('name')} className={inputCls} />
          ))}

          {field('Address', (
            <input type="text" placeholder="42 Hospital Road, Colombo" value={form.address} onChange={set('address')} className={inputCls} />
          ))}

          <div className="grid grid-cols-2 gap-3">
            {field('Phone', (
              <input type="text" placeholder="+94112345678" value={form.phone} onChange={set('phone')} className={inputCls} />
            ))}
            {field('Timezone', (
              <select value={form.timezone} onChange={set('timezone')} className={inputCls}>
                <option value="Asia/Colombo">Asia/Colombo</option>
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="Asia/Karachi">Asia/Karachi</option>
                <option value="Asia/Dubai">Asia/Dubai</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="Europe/London">Europe/London</option>
              </select>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field('Latitude (optional)', (
              <input type="number" step="any" placeholder="6.9271" value={form.latitude} onChange={set('latitude')} className={inputCls} />
            ))}
            {field('Longitude (optional)', (
              <input type="number" step="any" placeholder="79.8612" value={form.longitude} onChange={set('longitude')} className={inputCls} />
            ))}
          </div>

          {field('Initial Status', (
            <select value={form.status} onChange={set('status')} className={inputCls}>
              <option value="pending">Pending Review</option>
              <option value="active">Active (Approved)</option>
              <option value="suspended">Suspended</option>
            </select>
          ))}

          {error && (
            <div className="flex items-start gap-2 bg-[#EA4335]/10 border border-[#EA4335]/20 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-[#EA4335] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#EA4335]">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 font-semibold py-2.5 rounded-xl text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-[#1A73E8] hover:bg-[#1557B0] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Clinic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MediCenterPage() {
  const { accessToken } = useAuth()
  const [clinics, setClinics]       = useState<Clinic[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilter]   = useState<'all' | ClinicStatus>('all')
  const [modal, setModal]           = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing]       = useState<Clinic | null>(null)
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000'

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchClinics = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.set('status', filterStatus)
      const res = await fetch(`${API}/api/clinics?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(await res.text())
      setClinics(await res.json())
    } catch {
      showToast('Failed to load clinics', false)
    } finally {
      setLoading(false)
    }
  }, [accessToken, filterStatus, API])

  useEffect(() => { fetchClinics() }, [fetchClinics])

  async function handleSave(data: Partial<Clinic>) {
    const isEdit = !!editing
    const url    = isEdit ? `${API}/api/clinics/${editing!.id}` : `${API}/api/clinics`
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(e.error ?? 'Request failed')
    }
    showToast(isEdit ? 'Clinic updated!' : 'Medical center onboarded!')
    setEditing(null)
    fetchClinics()
  }

  async function handleStatusChange(id: string, status: ClinicStatus) {
    const res = await fetch(`${API}/api/clinics/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) { showToast('Failed to update status', false); return }
    showToast(`Status changed to ${status}`)
    setClinics(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  async function handleDelete(id: string) {
    const res = await fetch(`${API}/api/clinics/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) { showToast('Failed to delete clinic', false); return }
    showToast('Clinic removed')
    setConfirmDelete(null)
    setClinics(prev => prev.filter(c => c.id !== id))
  }

  const filtered = clinics.filter(c =>
    search ? c.name.toLowerCase().includes(search.toLowerCase()) ||
             (c.address ?? '').toLowerCase().includes(search.toLowerCase()) : true
  )

  // Stats
  const total     = clinics.length
  const active    = clinics.filter(c => c.status === 'active').length
  const pending   = clinics.filter(c => c.status === 'pending').length
  const suspended = clinics.filter(c => c.status === 'suspended').length

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

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111827] rounded-2xl border border-white/10 p-6 w-full max-w-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#EA4335]/15 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-[#EA4335]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Delete Clinic?</h3>
              <p className="text-xs text-gray-500 mt-1">This will permanently remove the clinic and all associated records.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 font-semibold py-2.5 rounded-xl text-sm transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 bg-[#EA4335] hover:bg-[#C62828] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Medical Centers</h2>
          <p className="text-xs text-gray-500 mt-0.5">Onboard and manage clinics & hospitals on the platform</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModal('create') }}
          className="flex items-center gap-2 bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-[0_0_20px_rgba(26,115,232,0.25)]"
        >
          <Plus className="w-3.5 h-3.5" />
          Onboard New Center
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',     value: total,     color: 'text-white',       bg: 'bg-white/5'         },
          { label: 'Active',    value: active,    color: 'text-[#34A853]',   bg: 'bg-[#34A853]/10'   },
          { label: 'Pending',   value: pending,   color: 'text-[#F9AB00]',   bg: 'bg-[#F9AB00]/10'   },
          { label: 'Suspended', value: suspended, color: 'text-[#EA4335]',   bg: 'bg-[#EA4335]/10'   },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-white/5`}>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter / Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            placeholder="Search clinics…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#141B2B] border border-white/5 text-white text-xs rounded-xl pl-9 pr-3 py-2.5 placeholder-gray-600 outline-none focus:border-white/20 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-[#141B2B] border border-white/5 rounded-xl p-1">
          {(['all', 'active', 'pending', 'suspended'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                filterStatus === s ? 'bg-[#1A73E8] text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {s}
            </button>
          ))}
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
                <div className="h-2 bg-white/5 rounded" />
                <div className="h-2 bg-white/5 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-400">No clinics found</h3>
          <p className="text-xs text-gray-600 mt-1 max-w-xs">
            {search || filterStatus !== 'all' ? 'Try changing your filters.' : 'Click "Onboard New Center" to register the first clinic.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(clinic => (
            <ClinicCard
              key={clinic.id}
              clinic={clinic}
              onStatusChange={handleStatusChange}
              onEdit={c => { setEditing(c); setModal('edit') }}
              onDelete={id => setConfirmDelete(id)}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <ClinicModal
          clinic={editing}
          onClose={() => { setModal(null); setEditing(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
