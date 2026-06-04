'use client'

/**
 * Receptionist — Live Queue
 *
 * DB tables used (connect when ready):
 *   walk_in_queue  — main queue entries  (id, patient_name, patient_id, doctor_id,
 *                    clinic_id, queue_date, queue_number, status, sms_phone,
 *                    source, estimated_wait_minutes, checked_in_at, called_at)
 *   doctors        — doctor list         (id, user_id, specialization)
 *   users          — doctor names        (id, full_name)
 *
 * All state is in-memory mock. Replace useState initialisers + handlers
 * with API calls once the DB is live.
 */

import { useState, useMemo } from 'react'
import {
  UserPlus, Phone, Plus, Maximize2, X, Activity,
  Wifi, Hash, CheckCircle2, AlertCircle, Clock,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'

// ─── Types ────────────────────────────────────────────────────────────────────

type TokenSource = 'online' | 'physical'   // DB: walk_in_queue.source
type QueueStatus = 'waiting' | 'called' | 'in_progress' | 'completed' | 'left'

interface QueueEntry {
  id: string
  tokenNumber: number          // DB: walk_in_queue.queue_number
  patientName: string          // DB: walk_in_queue.patient_name
  phone: string                // DB: walk_in_queue.sms_phone
  source: TokenSource          // DB: walk_in_queue.source
  status: QueueStatus          // DB: walk_in_queue.status
  issuedAt: Date               // DB: walk_in_queue.checked_in_at
  calledAt?: Date              // DB: walk_in_queue.called_at
}

interface Doctor {
  id: string                   // DB: doctors.id
  fullName: string             // DB: users.full_name  (JOIN doctors → users)
  specialization: string       // DB: doctors.specialization
}

// ─── Mock data (replace with API calls when DB is ready) ──────────────────────

const MOCK_DOCTORS: Doctor[] = [
  { id: 'dr-1', fullName: 'Dr. Priya Kumari',  specialization: 'General Medicine' },
  { id: 'dr-2', fullName: 'Dr. Anura Silva',   specialization: 'Paediatrics' },
]

// DB: SELECT * FROM walk_in_queue WHERE doctor_id=$1 AND queue_date=TODAY ORDER BY queue_number
const INITIAL_QUEUE: QueueEntry[] = [
  {
    id: 'q-1', tokenNumber: 1, patientName: 'Kamal Perera',
    phone: '+94 77 123 4567', source: 'online', status: 'completed',
    issuedAt: new Date(Date.now() - 90 * 60_000),
    calledAt: new Date(Date.now() - 80 * 60_000),
  },
  {
    id: 'q-2', tokenNumber: 2, patientName: 'Nimal Silva',
    phone: '', source: 'physical', status: 'in_progress',
    issuedAt: new Date(Date.now() - 60 * 60_000),
    calledAt: new Date(Date.now() - 10 * 60_000),
  },
  {
    id: 'q-3', tokenNumber: 3, patientName: 'Saman Fernando',
    phone: '+94 71 234 5678', source: 'online', status: 'waiting',
    issuedAt: new Date(Date.now() - 30 * 60_000),
  },
  {
    id: 'q-4', tokenNumber: 4, patientName: 'Priya Rajapaksa',
    phone: '', source: 'physical', status: 'waiting',
    issuedAt: new Date(Date.now() - 15 * 60_000),
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_PILL: Record<QueueStatus, string> = {
  waiting:     'text-[#F9AB00] bg-[#F9AB00]/10',
  called:      'text-[#1A73E8] bg-[#1A73E8]/10',
  in_progress: 'text-[#1A73E8] bg-[#1A73E8]/10',
  completed:   'text-[#34A853] bg-[#34A853]/10',
  left:        'text-gray-500  bg-gray-500/10',
}

function pad(n: number) { return String(n).padStart(2, '0') }
function fmtTime(d: Date) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }

// ─── Page component ───────────────────────────────────────────────────────────

export default function ReceptionistQueuePage() {
  const { t } = useI18n()

  // Doctor selector
  const [selectedDoctorId, setSelectedDoctorId] = useState(MOCK_DOCTORS[0]?.id ?? '')
  const selectedDoctor = MOCK_DOCTORS.find((d) => d.id === selectedDoctorId)

  // Queue state — DB: walk_in_queue rows for today
  const [queue, setQueue] = useState<QueueEntry[]>(INITIAL_QUEUE)

  // Form state
  const [activeTab, setActiveTab]         = useState<'online' | 'physical'>('online')
  const [patientName, setPatientName]     = useState('')
  const [phone, setPhone]                 = useState('')
  const [physicalToken, setPhysicalToken] = useState('')
  const [formError, setFormError]         = useState('')
  const [issuing, setIssuing]             = useState(false)

  // UI state
  const [showFullScreen, setShowFullScreen] = useState(false)
  const [calling, setCalling]               = useState(false)
  const [completing, setCompleting]         = useState(false)

  // Derived
  const waiting = useMemo(() => queue.filter((e) => e.status === 'waiting'), [queue])
  const current = useMemo(() => queue.find((e) => e.status === 'called' || e.status === 'in_progress'), [queue])
  const issuedNumbers = useMemo(() => new Set(queue.map((e) => e.tokenNumber)), [queue])
  const nextOnlineNumber = useMemo(
    () => (issuedNumbers.size > 0 ? Math.max(...issuedNumbers) + 1 : 1),
    [issuedNumbers],
  )

  // ── Handlers ────────────────────────────────────────────────

  // DB: INSERT INTO walk_in_queue (patient_name, sms_phone, doctor_id, queue_number, source='online', status='waiting', queue_date, checked_in_at=NOW())
  function handleIssueOnline() {
    if (!patientName.trim()) return
    setIssuing(true)
    setTimeout(() => {
      setQueue((prev) => [
        ...prev,
        {
          id: `q-${Date.now()}`, tokenNumber: nextOnlineNumber,
          patientName: patientName.trim(), phone: phone.trim(),
          source: 'online' as const, status: 'waiting' as const, issuedAt: new Date(),
        },
      ])
      setPatientName(''); setPhone(''); setIssuing(false)
    }, 350)
  }

  // DB: INSERT INTO walk_in_queue (..., queue_number=physicalToken, source='physical', ...)
  function handleRecordPhysical() {
    const num = parseInt(physicalToken, 10)
    if (!patientName.trim() || isNaN(num) || num < 1) return
    if (issuedNumbers.has(num)) { setFormError(t('alreadyIssued')); return }
    setFormError(''); setIssuing(true)
    setTimeout(() => {
      setQueue((prev) =>
        [...prev, {
          id: `q-${Date.now()}`, tokenNumber: num,
          patientName: patientName.trim(), phone: phone.trim(),
          source: 'physical' as const, status: 'waiting' as const, issuedAt: new Date(),
        }].sort((a, b) => a.tokenNumber - b.tokenNumber),
      )
      setPatientName(''); setPhone(''); setPhysicalToken(''); setIssuing(false)
    }, 350)
  }

  // DB: UPDATE walk_in_queue SET status='in_progress' WHERE status='called' AND doctor_id=$1
  //     UPDATE walk_in_queue SET status='called', called_at=NOW() WHERE id=(next waiting by queue_number)
  function handleCallNext() {
    if (waiting.length === 0) return
    setCalling(true)
    setTimeout(() => {
      setQueue((prev) => {
        const updated = prev.map((e) =>
          e.status === 'called' ? { ...e, status: 'in_progress' as QueueStatus } : e,
        )
        const nextId = updated.find((e) => e.status === 'waiting')?.id
        return updated.map((e) =>
          e.id === nextId ? { ...e, status: 'called' as QueueStatus, calledAt: new Date() } : e,
        )
      })
      setCalling(false)
    }, 350)
  }

  // DB: UPDATE walk_in_queue SET status='completed' WHERE status='in_progress' AND doctor_id=$1
  function handleComplete() {
    setCompleting(true)
    setTimeout(() => {
      setQueue((prev) =>
        prev.map((e) => e.status === 'in_progress' ? { ...e, status: 'completed' as QueueStatus } : e),
      )
      setCompleting(false)
    }, 350)
  }

  // DB: UPDATE walk_in_queue SET status=$1 WHERE id=$2
  function handleStatusChange(id: string, status: QueueStatus) {
    setQueue((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)))
  }

  // ── Full-screen TV ───────────────────────────────────────────

  if (showFullScreen) {
    return (
      <div className="fixed inset-0 bg-[#0D1117] flex flex-col items-center justify-center z-50">
        <div className="text-center">
          <p className="text-[#34A853] text-sm font-semibold uppercase tracking-[0.3em] mb-2">MediQueue Clinic</p>
          <p className="text-gray-500 text-xs uppercase tracking-[0.2em] mb-10">
            {selectedDoctor?.fullName} · {selectedDoctor?.specialization}
          </p>
          <p className="text-gray-400 text-lg font-semibold uppercase tracking-[0.25em] mb-6">{t('nowServing')}</p>
          <p className="text-[13rem] font-black text-white leading-none tracking-tighter tabular-nums">
            {current ? `#${pad(current.tokenNumber)}` : '—'}
          </p>
          <p className="text-gray-500 mt-8 text-base">{t('proceedToRoom')}</p>
          {waiting.length > 0 && (
            <p className="text-gray-600 mt-2 text-sm">{t('waitingCount')}: {waiting.length}</p>
          )}
        </div>
        <button
          onClick={() => setShowFullScreen(false)}
          className="absolute top-6 right-6 text-gray-600 hover:text-white transition-colors flex items-center gap-2 text-sm"
        >
          <X className="w-5 h-5" /> {t('exitFullScreen')}
        </button>
      </div>
    )
  }

  // ── Main layout ──────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ scrollbarWidth: 'none' }}>

      {/* Doctor selector */}
      {MOCK_DOCTORS.length > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400 whitespace-nowrap">{t('queueFor')}</label>
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="bg-[#141B2B] border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-[#1A73E8]/40"
          >
            {MOCK_DOCTORS.map((d) => (
              <option key={d.id} value={d.id}>{d.fullName} — {d.specialization}</option>
            ))}
          </select>
        </div>
      )}

      {/* Top two-column cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Issue / Record Token */}
        <div className="bg-[#141B2B] rounded-xl p-5 border border-white/5">

          {/* Tabs */}
          <div className="flex gap-1 mb-5 bg-[#0D1117] p-1 rounded-lg">
            <button
              onClick={() => { setActiveTab('online'); setFormError('') }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                activeTab === 'online' ? 'bg-[#1A73E8] text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" /> {t('onlineTab')}
            </button>
            <button
              onClick={() => { setActiveTab('physical'); setFormError('') }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                activeTab === 'physical' ? 'bg-[#F9AB00] text-[#1A1C20]' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Hash className="w-3.5 h-3.5" /> {t('physicalTab')}
            </button>
          </div>

          {activeTab === 'online' ? (
            /* ── Online token ── */
            <>
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-white">{t('issueOnlineToken')}</h3>
                <span className="ml-auto text-xs text-[#1A73E8] bg-[#1A73E8]/10 px-2 py-0.5 rounded-full font-semibold">
                  {t('nextTokenWillBe')} #{pad(nextOnlineNumber)}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">{t('patientName')}</label>
                  <input value={patientName} onChange={(e) => setPatientName(e.target.value)}
                    placeholder={t('enterName')}
                    className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 placeholder-gray-600 outline-none focus:border-[#1A73E8]/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">{t('phoneNumber')}</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                    <input value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="+94 71 234 5678"
                      className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg pl-9 pr-3 py-2.5 placeholder-gray-600 outline-none focus:border-[#1A73E8]/40 transition-colors"
                    />
                  </div>
                </div>
              </div>
              <button onClick={handleIssueOnline} disabled={issuing || !patientName.trim()}
                className="mt-4 w-full bg-[#1A73E8] hover:bg-[#1557B0] disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> {issuing ? t('issuingToken') : t('issueToken')}
              </button>
            </>
          ) : (
            /* ── Physical token ── */
            <>
              <div className="flex items-center gap-2 mb-4">
                <Hash className="w-4 h-4 text-[#F9AB00]" />
                <h3 className="text-sm font-semibold text-white">{t('recordPhysicalToken')}</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">{t('tokenNumber')}</label>
                  <input type="number" min={1} value={physicalToken}
                    onChange={(e) => { setPhysicalToken(e.target.value); setFormError('') }}
                    placeholder={t('enterTokenNo')}
                    className={`w-full bg-[#0D1117] border text-white text-sm rounded-lg px-3 py-2.5 placeholder-gray-600 outline-none transition-colors ${
                      formError ? 'border-[#EA4335]/60' : 'border-white/10 focus:border-[#F9AB00]/40'
                    }`}
                  />
                  {formError && (
                    <p className="text-xs text-[#EA4335] mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {formError}
                    </p>
                  )}
                  {/* Issued number chips */}
                  {issuedNumbers.size > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-[10px] text-gray-600 w-full mb-0.5">{t('issuedNumbers')}:</span>
                      {[...issuedNumbers].sort((a, b) => a - b).map((n) => {
                        const entry = queue.find((e) => e.tokenNumber === n)!
                        const active = ['waiting','called','in_progress'].includes(entry.status)
                        return (
                          <span key={n} title={active ? t('tokenAlreadyUsed') : entry.status}
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              active ? 'bg-[#EA4335]/15 text-[#EA4335]' : 'bg-white/5 text-gray-600'
                            }`}
                          >
                            #{pad(n)}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">{t('patientName')}</label>
                  <input value={patientName} onChange={(e) => setPatientName(e.target.value)}
                    placeholder={t('enterName')}
                    className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 placeholder-gray-600 outline-none focus:border-[#F9AB00]/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">{t('phoneNumber')}</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                    <input value={phone} onChange={(e) => setPhone(e.target.value)}
                      placeholder="+94 71 234 5678"
                      className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-lg pl-9 pr-3 py-2.5 placeholder-gray-600 outline-none focus:border-[#F9AB00]/40 transition-colors"
                    />
                  </div>
                </div>
              </div>
              <button onClick={handleRecordPhysical} disabled={issuing || !patientName.trim() || !physicalToken}
                className="mt-4 w-full bg-[#F9AB00] hover:bg-[#E09A00] disabled:opacity-50 text-[#1A1C20] font-bold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> {issuing ? t('recordingToken') : t('recordToken')}
              </button>
            </>
          )}
        </div>

        {/* Operational Status */}
        <div className="bg-[#141B2B] rounded-xl p-5 border border-white/5 flex flex-col">
          <h3 className="text-sm font-semibold text-white mb-1">{t('operationalStatus')}</h3>
          <div className="flex items-center gap-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-[#34A853] animate-pulse flex-shrink-0" />
            <span className="text-xs text-gray-400">{selectedDoctor?.fullName ?? '—'}</span>
          </div>
          <div className="flex items-end justify-between mb-6 flex-1">
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('waitingCount')}</p>
              <p className="text-3xl font-bold text-white">{waiting.length}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">{t('currentToken')}</p>
              <p className="text-6xl font-black text-[#34A853] leading-none tabular-nums">
                {current ? `#${pad(current.tokenNumber)}` : '—'}
              </p>
              {current && (
                <p className="text-xs text-gray-500 mt-1 truncate max-w-[130px] text-right">
                  {current.patientName}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {current && (
              <button onClick={handleComplete} disabled={completing}
                className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {completing ? t('completing') : t('complete')}
              </button>
            )}
            <button onClick={handleCallNext} disabled={calling || waiting.length === 0}
              className="flex-1 bg-[#F9AB00] hover:bg-[#E09A00] disabled:opacity-50 text-[#1A1C20] font-bold py-3 rounded-lg text-sm transition-colors"
            >
              {calling ? t('callingNext') : t('callNext')}
            </button>
          </div>
        </div>
      </div>

      {/* TV Screen preview */}
      <div className="bg-[#141B2B] rounded-xl overflow-hidden border border-white/5">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('tvPreview')}</span>
          </div>
          <button onClick={() => setShowFullScreen(true)}
            className="text-xs text-[#34A853] hover:underline flex items-center gap-1"
          >
            {t('openFullScreen')} <Maximize2 className="w-3 h-3" />
          </button>
        </div>
        <div className="bg-[#0D1117] px-6 py-10 text-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-[0.25em] mb-4">{t('nowServing')}</p>
          <p className="text-8xl font-black text-white leading-none mb-4 tabular-nums">
            {current ? `#${pad(current.tokenNumber)}` : '—'}
          </p>
          <p className="text-gray-600 text-sm">{t('proceedToRoom')}</p>
        </div>
      </div>

      {/* Active Queue table */}
      <div className="bg-[#141B2B] rounded-xl border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">{t('activeQueue')}</h3>
          <span className="text-xs text-gray-500">
            {waiting.length} {t('waitingCount').toLowerCase()} · {queue.filter((q) => q.status === 'completed').length} {t('completed').toLowerCase()}
          </span>
        </div>
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <table className="w-full min-w-[620px]">
            <thead>
              <tr className="border-b border-white/5">
                {[t('tokenCol'), t('sourceCol'), t('patientCol'), t('phoneCol'), t('statusCol'), t('checkedInCol'), t('actionsCol')].map((h) => (
                  <th key={h} className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-600 text-sm">{t('noPatients')}</td></tr>
              )}
              {queue.map((entry) => (
                <tr key={entry.id}
                  className={`border-b border-white/5 transition-colors ${
                    entry.status === 'called' || entry.status === 'in_progress' ? 'bg-[#1A73E8]/8' : 'hover:bg-white/3'
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className={`text-sm font-bold tabular-nums ${current?.id === entry.id ? 'text-[#34A853]' : 'text-white'}`}>
                      #{pad(entry.tokenNumber)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {entry.source === 'online' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#1A73E8] bg-[#1A73E8]/10">
                        <Wifi className="w-2.5 h-2.5" /> {t('online')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#F9AB00] bg-[#F9AB00]/10">
                        <Hash className="w-2.5 h-2.5" /> {t('physical')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-200">{entry.patientName}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{entry.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_PILL[entry.status]}`}>
                      {entry.status === 'in_progress' ? t('inProgress') :
                       entry.status === 'waiting'     ? t('waiting')    :
                       entry.status === 'called'      ? t('called')     :
                       entry.status === 'completed'   ? t('completed')  : t('left')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {fmtTime(entry.issuedAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {entry.status === 'waiting' && (
                        <button onClick={() => handleStatusChange(entry.id, 'completed')}
                          className="text-[11px] bg-[#34A853]/15 hover:bg-[#34A853]/25 text-[#34A853] px-2 py-1 rounded transition-colors"
                        >{t('done')}</button>
                      )}
                      {entry.status !== 'left' && entry.status !== 'completed' && (
                        <button onClick={() => handleStatusChange(entry.id, 'left')}
                          className="text-[11px] bg-gray-500/15 hover:bg-gray-500/25 text-gray-400 px-2 py-1 rounded transition-colors"
                        >{t('noShow')}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TV display link */}
      <div className="bg-[#141B2B] border border-white/5 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">{t('tvDisplayScreen')}</p>
          <p className="text-xs text-gray-500">{t('shareUrl')}</p>
        </div>
        <a href="/display/clinic" target="_blank" rel="noreferrer"
          className="text-sm bg-[#1A73E8] text-white px-4 py-2 rounded-lg hover:bg-[#1557B0] transition-colors flex-shrink-0"
        >
          {t('openDisplay')}
        </a>
      </div>

    </div>
  )
}
