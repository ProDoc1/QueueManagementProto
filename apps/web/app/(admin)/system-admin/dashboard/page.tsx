import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Users, Activity, Building2, ShieldAlert, Wrench, FileText, UserCheck } from 'lucide-react'

// Force fresh data loading on every request
export const revalidate = 0

export default async function SystemAdminDashboard() {
  const supabase = await createClient()

  // 1. Structural Security Guard Clause (Server-Side)
  const { data: { user } } = await supabase.auth.getUser()
  
  // Fetch user profile info from public.users to check the system role
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  if (!profile || profile.role !== 'system_admin') {
    redirect('/login')
  }

  // 2. Query Live Production Database Counters directly
  const { count: activeDoctors } = await supabase.from('doctors').select('*', { count: 'exact', head: true })
  const { count: registeredPatients } = await supabase.from('patients').select('*', { count: 'exact', head: true })
  const { count: totalClinics } = await supabase.from('clinics').select('*', { count: 'exact', head: true })

  // Query today's queue metrics directly from the active live tracking table
  const todayString = new Date().toISOString().split('T')[0]!
  const { data: todayQueue } = await supabase
    .from('walk_in_queue')
    .select('status')
    .eq('queue_date', todayString)

  const tokensIssued = todayQueue?.length ?? 0
  const appointmentsCompleted = todayQueue?.filter(q => q.status === 'completed').length ?? 0
  const appointmentsCancelled = todayQueue?.filter(q => q.status === 'cancelled').length ?? 0
  const appointmentNoShows = todayQueue?.filter(q => q.status === 'no_show').length ?? 0

  // 3. SECURE SERVER ACTIONS (Handles button triggers instantaneously)
  async function toggleMaintenanceAction() {
    'use server'
    const supabaseClient = await createClient()
    
    const { data: setting } = await supabaseClient
      .from('system_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .maybeSingle()

    const currentlyEnabled = setting?.value === 'true'
    
    await supabaseClient.from('system_settings').upsert({
      key: 'maintenance_mode',
      value: currentlyEnabled ? 'false' : 'true',
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })

    revalidatePath('/(admin)/system-admin/dashboard', 'page')
  }

  const statCards = [
    {
      label: 'Active Doctors',
      value: activeDoctors ?? 0,
      icon: Users,
      color: 'bg-[#1A73E8]/10 text-[#1A73E8]',
    },
    {
      label: 'Registered Patients',
      value: registeredPatients ?? 0,
      icon: Users,
      color: 'bg-[#34A853]/10 text-[#34A853]',
    },
    {
      label: 'Appointments Today',
      value: tokensIssued,
      icon: Activity,
      color: 'bg-[#F9AB00]/10 text-[#F9AB00]',
    },
    {
      label: 'Total Clinics',
      value: totalClinics ?? 0,
      icon: Building2,
      color: 'bg-[#9C27B0]/10 text-[#9C27B0]',
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0B0F19] min-h-screen">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">System Admin Dashboard</h2>
        <p className="text-xs text-gray-400 mt-0.5">Platform governance, infrastructure tracking, and automated control metrics</p>
      </div>

      {/* Stats Dynamic Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon
          return (
            <div
              key={idx}
              className="bg-[#141B2B] rounded-xl p-5 border border-white/5 hover:border-white/10 transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 mb-1 font-medium">{card.label}</p>
                  <p className="text-3xl font-extrabold text-white tracking-tight">{card.value}</p>
                </div>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Operational Content Splits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Real-time Status Queue Breakdown */}
        <div className="bg-[#141B2B] rounded-xl p-6 border border-white/5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Queue Stream Summary</h3>
            <p className="text-xs text-gray-500 mb-4">Calculated live parsing from receptionist processing windows</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#34A853]" />
                <span className="text-xs text-gray-300 font-medium">Completed Token Sessions</span>
              </div>
              <span className="text-sm font-bold text-white bg-white/5 px-2.5 py-0.5 rounded-md font-mono">{appointmentsCompleted}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#EA4335]" />
                <span className="text-xs text-gray-300 font-medium">Cancelled by Center Staff</span>
              </div>
              <span className="text-sm font-bold text-white bg-white/5 px-2.5 py-0.5 rounded-md font-mono">{appointmentsCancelled}</span>
            </div>
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#F9AB00]" />
                <span className="text-xs text-gray-300 font-medium">Missed Consultation No-Shows</span>
              </div>
              <span className="text-sm font-bold text-white bg-white/5 px-2.5 py-0.5 rounded-md font-mono">{appointmentNoShows}</span>
            </div>
          </div>
        </div>

        {/* Live Functional Core Actions */}
        <div className="bg-[#141B2B] rounded-xl p-6 border border-white/5 space-y-4">
          <h3 className="text-sm font-semibold text-white">System Governance Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            <a href="/admin/system-admin/accounts" className="flex items-center gap-3 px-4 py-3 bg-red-600/10 hover:bg-red-600/20 border border-red-500/10 text-red-400 rounded-xl transition-all group">
              <ShieldAlert className="w-5 h-5" />
              <div className="text-left">
                <p className="text-xs font-bold text-white group-hover:text-red-400 transition-colors">Ban Account</p>
                <p className="text-[10px] text-gray-400">Suspend misbehaving profiles</p>
              </div>
            </a>

            <a href="/admin/system-admin/roles" className="flex items-center gap-3 px-4 py-3 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/10 text-purple-400 rounded-xl transition-all group">
              <UserCheck className="w-5 h-5" />
              <div className="text-left">
                <p className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">Manage Roles</p>
                <p className="text-[10px] text-gray-400">Escalate account access privileges</p>
              </div>
            </a>

            <form action={toggleMaintenanceAction} className="sm:col-span-2">
              <button type="submit" className="w-full flex items-center justify-between px-4 py-3 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/20 text-amber-400 rounded-xl transition-all text-left">
                <div className="flex items-center gap-3">
                  <Wrench className="w-5 h-5" />
                  <div>
                    <p className="text-xs font-bold text-white">Toggle Platform Maintenance Mode</p>
                    <p className="text-[10px] text-gray-400">Lock general user routing filters for upgrades</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold tracking-wider uppercase bg-amber-500/20 px-2 py-0.5 rounded-md">Trigger</span>
              </button>
            </form>

            <a href="/admin/system-admin/audit-logs" className="sm:col-span-2 flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 rounded-xl transition-all">
              <FileText className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs font-bold text-white">View Platform Security Audit Logs</p>
                <p className="text-[10px] text-gray-400">Review infrastructure tracking records and event trails</p>
              </div>
            </a>

          </div>
        </div>

      </div>
    </div>
  )
}