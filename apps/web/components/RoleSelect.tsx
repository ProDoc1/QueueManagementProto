'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context' // 1. Import your auth hook

const ROLE_COLORS: Record<string, string> = {
  system_admin: 'bg-[#EA4335]/15 text-[#EA4335] border-[#EA4335]/30',
  admin: 'bg-[#1A73E8]/15 text-[#1A73E8] border-[#1A73E8]/30',
  doctor: 'bg-[#9C27B0]/15 text-[#9C27B0] border-[#9C27B0]/30',
  receptionist: 'bg-[#F9AB00]/15 text-[#F9AB00] border-[#F9AB00]/30',
  patient: 'bg-[#34A853]/15 text-[#34A853] border-[#34A853]/30',
}

interface RoleSelectProps {
  userId: string
  currentRole: string
}

export default function RoleSelect({ userId, currentRole }: RoleSelectProps) {
  const [role, setRole] = useState(currentRole)
  const [updating, setUpdating] = useState(false)
  const router = useRouter()
  
  // 2. Access the live logged-in user's access token
  const { accessToken } = useAuth() 

  async function handleRoleChange(newRole: string) {
    setUpdating(true)
    try {
      // 3. Inject the token payload key right into the client call configuration
      await apiRequest(`/api/auth/users/${userId}/role`, {
        method: 'PUT',
        token: accessToken ?? undefined, // <-- Pass token explicitly here
        body: { role: newRole },
      })
      
      setRole(newRole)
      router.refresh()
    } catch (error) {
      alert('Failed to update user role')
      setRole(currentRole) 
    } finally {
      setUpdating(false)
    }
  }

  return (
    <select
      value={role}
      disabled={updating}
      onChange={(e) => handleRoleChange(e.target.value)}
      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide bg-transparent border cursor-pointer outline-none transition-all duration-200 ${
        ROLE_COLORS[role] ?? 'bg-white/10 text-gray-300'
      } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <option value="patient" className="bg-[#141B2B] text-white">Patient</option>
      <option value="receptionist" className="bg-[#141B2B] text-white">Receptionist</option>
      <option value="doctor" className="bg-[#141B2B] text-white">Doctor</option>
      <option value="admin" className="bg-[#141B2B] text-white">Admin</option>
      <option value="system_admin" className="bg-[#141B2B] text-white">System Admin</option>
    </select>
  )
}