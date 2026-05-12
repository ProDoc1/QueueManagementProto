'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '../../lib/api-client'
import type { AppointmentTemplate } from '@repo/types'

interface Props {
  token: string
  onSelect: (template: AppointmentTemplate) => void
}

export default function QuickTemplateSelector({ token, onSelect }: Props) {
  const [templates, setTemplates] = useState<AppointmentTemplate[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    apiRequest<AppointmentTemplate[]>('/api/health-records/templates', { token })
      .then(setTemplates)
      .catch(() => {})
  }, [token])

  if (templates.length === 0) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Quick Template
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <p className="text-xs text-gray-400 px-3 py-2 border-b">Select a template to auto-fill</p>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onSelect(t); setOpen(false) }}
              className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors"
            >
              <p className="text-sm font-medium text-gray-800">{t.name}</p>
              {t.prescriptionItems.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">{t.prescriptionItems.length} prescription item(s)</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
