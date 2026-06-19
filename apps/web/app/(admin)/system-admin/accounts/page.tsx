import { ShieldAlert } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import AccountsTable, { type PlatformUser } from '@/components/AccountsTable'

async function getAllUsers(): Promise<PlatformUser[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('getAllUsers error:', error.message)
    return []
  }

  return (data ?? []).map((row: any) => ({
    id:        row.id,
    fullName:  row.full_name ?? '',
    email:     row.email,
    role:      row.role,
    isActive:  row.is_active,
    createdAt: row.created_at,
  }))
}

export default async function AccountsPage() {
  const users = await getAllUsers()

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ scrollbarWidth: 'none' }}>
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 text-[#EA4335]" />
        <div>
          <h2 className="text-base font-semibold text-white">Account Management</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            View, search, suspend, or restore any platform account
          </p>
        </div>
      </div>

      <AccountsTable initialUsers={users} />
    </div>
  )
}