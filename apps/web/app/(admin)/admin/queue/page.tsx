import { Activity, Building2, Users, ActivitySquare, Server, Stethoscope, Clock } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'

function pad(n: number) { return String(n).padStart(2, '0') }

export default async function GlobalInfrastructureMonitor() {
  const supabase = await createClient()

  // Fetch all necessary data
  const [
    { data: clinics },
    { data: doctorClinics },
    { data: doctors },
    { data: users },
    { data: walkInQueue }
  ] = await Promise.all([
    supabase.from('clinics').select('*'),
    supabase.from('doctor_clinics').select('*'),
    supabase.from('doctors').select('*'),
    supabase.from('users').select('id, full_name'),
    supabase.from('walk_in_queue').select('*').eq('queue_date', new Date().toISOString().split('T')[0])
  ]);

  // Aggregate stats
  const totalActiveClinics = clinics?.filter(c => c.status === 'active').length || 0;
  const totalPlatformTraffic = walkInQueue?.length || 0;
  const activeQueuesSet = new Set(
    (walkInQueue || [])
      .filter(q => q.status === 'in_progress' || q.status === 'called' || q.status === 'waiting')
      .map(q => q.doctor_id)
  );
  const totalLiveQueues = activeQueuesSet.size;

  // Process Clinics Data
  const CLINICS_DATA = (clinics || []).map(clinic => {
    const clinicDoctors = (doctorClinics || [])
      .filter(dc => dc.clinic_id === clinic.id)
      .map(dc => {
        const doctor = (doctors || []).find(d => d.id === dc.doctor_id);
        const user = (users || []).find(u => u.id === doctor?.user_id);
        
        const doctorQueue = (walkInQueue || []).filter(q => q.doctor_id === doctor?.id);
        const currentTokenObj = doctorQueue.find(q => q.status === 'in_progress' || q.status === 'called');
        const currentToken = currentTokenObj?.queue_number || 0;
        const waiting = doctorQueue.filter(q => q.status === 'waiting').length;

        return {
          id: doctor?.id || Math.random().toString(),
          doctorName: user?.full_name || doctor?.full_name || 'Unknown Doctor',
          specialization: doctor?.specialization || 'General',
          currentToken,
          waiting
        }
      });

    return {
      id: clinic.id,
      name: clinic.name,
      location: clinic.address || 'Location not specified',
      status: clinic.status === 'active' ? 'Operational' : (clinic.status === 'suspended' ? 'Suspended' : 'Pending'),
      queues: clinicDoctors
    }
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ scrollbarWidth: 'none' }}>
      
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Global Infrastructure Monitor</h2>
          <p className="text-xs text-gray-500 mt-0.5">Master overview of all live queues and platform traffic</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 bg-[#34A853]/15 text-[#34A853] text-xs font-semibold px-2.5 py-1 rounded-full">
            <Server className="w-3.5 h-3.5" />
            System Healthy
          </span>
        </div>
      </div>

      {/* Top Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#141B2B] rounded-xl p-5 border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Active Clinics</p>
            <p className="text-3xl font-black text-white">{totalActiveClinics}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#1A73E8]/10 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-[#1A73E8]" />
          </div>
        </div>

        <div className="bg-[#141B2B] rounded-xl p-5 border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Live Queues</p>
            <p className="text-3xl font-black text-white">{totalLiveQueues}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#F9AB00]/10 flex items-center justify-center">
            <ActivitySquare className="w-6 h-6 text-[#F9AB00]" />
          </div>
        </div>

        <div className="bg-[#141B2B] rounded-xl p-5 border border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Platform Traffic</p>
            <p className="text-3xl font-black text-[#34A853]">{totalPlatformTraffic}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#34A853]/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-[#34A853]" />
          </div>
        </div>
      </div>

      {/* Clinics Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {CLINICS_DATA.map((clinic) => (
          <div key={clinic.id} className="bg-[#141B2B] rounded-xl border border-white/5 overflow-hidden flex flex-col">
            
            {/* Clinic Card Header */}
            <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1A73E8]/15 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-[#1A73E8]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{clinic.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{clinic.location}</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                clinic.status === 'Suspended' 
                  ? 'bg-[#EA4335]/15 text-[#EA4335]' 
                  : clinic.status === 'Operational'
                    ? 'bg-[#34A853]/15 text-[#34A853]'
                    : 'bg-[#F9AB00]/15 text-[#F9AB00]'
              }`}>
                {clinic.status}
              </span>
            </div>

            {/* Read-Only Data Table */}
            <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-white/5 bg-[#0D1117]/50">
                    <th className="px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Active Doctor</th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-center">Currently Serving</th>
                    <th className="px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-center">Waiting</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {clinic.queues.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-6 text-center text-xs text-gray-500">
                        No doctors assigned to this clinic.
                      </td>
                    </tr>
                  ) : (
                    clinic.queues.map((queue) => (
                      <tr key={queue.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                              <Stethoscope className="w-4 h-4 text-gray-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-200">{queue.doctorName}</p>
                              <p className="text-[10px] text-gray-500">{queue.specialization}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="inline-flex items-center justify-center bg-[#34A853]/10 border border-[#34A853]/20 px-3 py-1.5 rounded-lg min-w-[80px]">
                            <span className="text-[#34A853] text-sm font-bold tracking-wider">
                              {queue.currentToken > 0 ? `#${pad(queue.currentToken)}` : '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-gray-500" />
                            <span className="text-white text-sm font-semibold">{queue.waiting}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        ))}
      </div>

    </div>
  )
}
