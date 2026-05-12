import type { PenaltyLevel } from '@repo/types'

interface Props {
  penaltyLevel: PenaltyLevel
  penaltyExpiresAt?: string | null
  noShowCount?: number
}

const MESSAGES = {
  0: null,
  1: {
    type: 'warning' as const,
    title: 'Attendance Warning',
    body: 'You have missed appointments recently. Further no-shows may restrict your booking.',
  },
  2: {
    type: 'caution' as const,
    title: 'Late Number Assigned',
    body: 'Due to previous missed appointments, you will be assigned a late slot position when booking.',
  },
  3: {
    type: 'error' as const,
    title: 'Booking Temporarily Suspended',
    body: 'Your booking is suspended due to repeated missed appointments.',
  },
}

const COLORS = {
  warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  caution: 'bg-orange-50 border-orange-300 text-orange-800',
  error: 'bg-red-50 border-red-300 text-red-800',
}

export default function PenaltyWarning({ penaltyLevel, penaltyExpiresAt, noShowCount }: Props) {
  const msg = MESSAGES[penaltyLevel]
  if (!msg) return null

  return (
    <div className={`border rounded-xl p-4 ${COLORS[msg.type]}`}>
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <div>
          <p className="font-semibold">{msg.title}</p>
          <p className="text-sm mt-1">{msg.body}</p>
          {noShowCount !== undefined && noShowCount > 0 && (
            <p className="text-xs mt-1 opacity-70">Missed appointments: {noShowCount}</p>
          )}
          {penaltyExpiresAt && penaltyLevel === 3 && (
            <p className="text-sm mt-1">
              Suspension lifts: <strong>{new Date(penaltyExpiresAt).toLocaleDateString()}</strong>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
