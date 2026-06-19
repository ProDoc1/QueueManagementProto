import { createClient } from '@/utils/supabase/server'
import { UserCheck } from 'lucide-react'
import RoleSelect from '@/components/RoleSelect'

const ROLE_COLORS: Record<string, string> = {
  system_admin: 'bg-[#EA4335]/15 text-[#EA4335]',
  admin: 'bg-[#1A73E8]/15 text-[#1A73E8]',
  doctor: 'bg-[#9C27B0]/15 text-[#9C27B0]',
  receptionist: 'bg-[#F9AB00]/15 text-[#F9AB00]',
  patient: 'bg-[#34A853]/15 text-[#34A853]',
}

export default async function RolesPage() {
  const supabase = await createClient()
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, role, created_at')
    .order('role', { ascending: true })

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ scrollbarWidth: 'none' }}>
      <div className="flex items-center gap-3">
        <UserCheck className="w-5 h-5 text-[#9C27B0]" />
        <div>
          <h2 className="text-base font-semibold text-white">Role Management</h2>
          <p className="text-xs text-gray-500 mt-0.5">View and manage platform user roles and access privileges</p>
        </div>
      </div>

      <div className="bg-[#141B2B] rounded-xl border border-white/5 overflow-hidden">
        {!users || users.length === 0 ? (
          <div className="px-6 py-12 text-center text-xs text-gray-500">No users found.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-[#0D1117]/50">
                <th className="px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4 text-sm text-gray-200 font-medium">{u.full_name || '—'}</td>
                  <td className="px-5 py-4 text-xs text-gray-400">{u.email}</td>
                  <td className="px-5 py-4">
                    <RoleSelect userId={u.id} currentRole={u.role} />
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
