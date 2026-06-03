import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Auth is handled client-side by PatientShell / AdminShell.
// The refreshToken cookie is set by the API on a different origin (localhost:4000)
// and is not visible to this middleware running on localhost:3001.
// No server-side route blocking — just pass all requests through.
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

