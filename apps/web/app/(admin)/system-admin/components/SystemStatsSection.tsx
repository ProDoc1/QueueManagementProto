'use client'

import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Download, TrendingUp, FileText, X, PieChart as PieIcon } from 'lucide-react'

export function SystemStatsSection() {
  const [period, setPeriod] = useState('all')
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [reportPeriod, setReportPeriod] = useState('last-week')
  
  const [data, setData] = useState([
    { stat_date: 'Mon', tokens_issued: 24, appointments_completed: 18 },
    { stat_date: 'Tue', tokens_issued: 35, appointments_completed: 28 },
    { stat_date: 'Wed', tokens_issued: 45, appointments_completed: 40 },
    { stat_date: 'Thu', tokens_issued: 30, appointments_completed: 22 },
    { stat_date: 'Fri', tokens_issued: 55, appointments_completed: 48 },
    { stat_date: 'Sat', tokens_issued: 20, appointments_completed: 15 },
    { stat_date: 'Sun', tokens_issued: 10, appointments_completed: 8 },
  ])

  const handleDownloadPDF = () => {
    setIsExportModalOpen(false)
    // Points directly to your dynamic reporting route passing selected timeframe
    window.open(`/api/system-admin/reports/export?period=${reportPeriod}`, '_blank')
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Filter and Export Toolbar */}
      <div className="flex items-center justify-between border-t border-white/5 pt-6">
        <div className="flex items-center gap-2">
          {['Today', 'Last Week', 'Last Month', 'All'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p.toLowerCase().replace(' ', '-'))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                period === p.toLowerCase().replace(' ', '-')
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#141B2B] text-gray-400 border border-white/5 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141B2B] border border-white/5 rounded-lg text-xs text-gray-400 hover:text-white transition-colors">
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs text-white font-semibold transition-colors shadow-lg shadow-blue-500/10"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Generate PDF Report</span>
          </button>
        </div>
      </div>

      {/* Charts Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Line Chart - Traffic Analytics */}
        <div className="lg:col-span-2 bg-[#141B2B] p-5 rounded-xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <h4 className="text-xs font-semibold text-white">Daily Traffic & Operations Insights</h4>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="stat_date" stroke="#4B5563" fontSize={10} tickLine={false} />
                <YAxis stroke="#4B5563" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0D1117', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px' }} />
                <Line type="monotone" dataKey="tokens_issued" stroke="#1A73E8" strokeWidth={2} dot={false} name="Tokens Issued" />
                <Line type="monotone" dataKey="appointments_completed" stroke="#34A853" strokeWidth={2} dot={false} name="Completed Appointments" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart - Appointment Status Distribution */}
        <div className="bg-[#141B2B] p-5 rounded-xl border border-white/5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <PieIcon className="w-4 h-4 text-emerald-500" />
            <h4 className="text-xs font-semibold text-white">Queue Distribution Breakdown</h4>
          </div>
          <div className="h-44 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Completed', value: 65 },
                    { name: 'Cancelled', value: 20 },
                    { name: 'No-Show', value: 15 }
                  ]}
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  <Cell fill="#34A853" />
                  <Cell fill="#EA4335" />
                  <Cell fill="#F9AB00" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Status Indicators Legend */}
          <div className="grid grid-cols-3 gap-1 text-center text-[10px] text-gray-400 border-t border-white/5 pt-4">
            <div>
              <span className="inline-block w-2 h-2 rounded-full bg-[#34A853] mr-1"></span>
              <span>Completed</span>
            </div>
            <div>
              <span className="inline-block w-2 h-2 rounded-full bg-[#EA4335] mr-1"></span>
              <span>Cancelled</span>
            </div>
            <div>
              <span className="inline-block w-2 h-2 rounded-full bg-[#F9AB00] mr-1"></span>
              <span>No-Show</span>
            </div>
          </div>
        </div>
      </div>

      {/* Time Range Prompt Modal Overlay */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#141B2B] border border-white/5 w-full max-w-md p-6 rounded-xl space-y-4 shadow-2xl transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <FileText className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold">Configure Analysis Export</h3>
              </div>
              <button 
                onClick={() => setIsExportModalOpen(false)} 
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-400">Target Analytics Timeline Window</label>
              <select 
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value)}
                className="w-full bg-[#0D1117] border border-white/5 rounded-lg p-2.5 text-xs text-white outline-none focus:border-blue-500 transition-colors cursor-pointer"
              >
                <option value="today">Today (Live Stream Logs)</option>
                <option value="last-week">Last 7 Days (Weekly Rolling Window)</option>
                <option value="last-month">Last 30 Days (Monthly Operational Matrix)</option>
                <option value="all">Complete History Archive (All Fields)</option>
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 font-medium py-2 rounded-lg text-xs transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDownloadPDF}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-xs transition-colors shadow-lg shadow-blue-600/10"
              >
                Compile and Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}