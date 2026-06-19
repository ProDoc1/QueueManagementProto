export interface AccountBan {
  id: string
  userId: string
  reason: string
  bannedBy: string
  bannedAt: string
  expiresAt: string | null
  isPermanent: boolean
}

export interface AuditLog {
  id: number
  userId: string | null
  action: string
  resource: string
  resourceId: string | null
  oldValue: any
  newValue: any
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export interface LoginAuditLog {
  id: number
  userId: string | null
  email: string
  role: string | null
  ipAddress: string | null
  userAgent: string | null
  status: 'success' | 'failed'
  failureReason: string | null
  createdAt: string
}

export interface SystemSettings {
  maintenanceMode: {
    enabled: boolean
    message: string
    estimated_downtime_minutes: number
  }
  version: {
    current: string
  }
}
