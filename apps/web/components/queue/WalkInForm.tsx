'use client'

import { useState } from 'react'
import { apiRequest } from '../../lib/api-client'
import type { WalkInQueueEntry } from '@repo/types'

interface Props {
  doctors: { id: string; fullName: string; specialization: string }[]
  clinicId?: string
  token: string
  onAdded: (entry: WalkInQueueEntry) => void
}

export default function WalkInForm({ doctors, clinicId, token, onAdded }: Props) {
  const [patientName, setPatientName] = useState('')
  const [smsPhone, setSmsPhone] = useState('')
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ queueNumber: number; waitMinutes: number } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const entry = await apiRequest<WalkInQueueEntry>('/api/queue', {
        method: 'POST',
        token,
        body: {
          patientName: patientName.trim(),
          smsPhone: smsPhone.trim() || undefined,
          doctorId,
          clinicId,
        },
      })
      setSuccess({ queueNumber: entry.queueNumber, waitMinutes: entry.estimatedWaitMinutes ?? 0 })
      onAdded(entry)
      setPatientName('')
      setSmsPhone('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add patient')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Add Walk-in Patient</h2>
      <p className="text-sm text-gray-500 mb-4">No app or account required. Patient phone is optional — used for SMS notifications only.</p>

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-semibold text-lg">Queue Number: #{success.queueNumber}</p>
          <p className="text-green-700 text-sm">Estimated wait: ~{success.waitMinutes} minutes</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name *</label>
          <input
            type="text"
            required
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="Enter patient's full name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number (optional)</label>
          <input
            type="tel"
            value={smsPhone}
            onChange={(e) => setSmsPhone(e.target.value)}
            placeholder="+94 71 234 5678"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Patient will receive SMS when their turn is approaching</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Doctor *</label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                Dr. {d.fullName} — {d.specialization}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {loading ? 'Adding...' : 'Add to Queue'}
        </button>
      </form>
    </div>
  )
}
