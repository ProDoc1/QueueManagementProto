'use client'

import { MapPin, Star, Heart } from 'lucide-react'

interface ClinicCardProps {
  clinic: any
  onSelect?: (c: any) => void
  isFavorite?: boolean
  onToggleFavorite?: (clinicId: string, e: React.MouseEvent) => void
}

export function ClinicCard({ clinic, onSelect, isFavorite = false, onToggleFavorite }: ClinicCardProps) {
  return (
    <div
      onClick={() => onSelect?.(clinic)}
      className="relative flex-shrink-0 w-52 bg-white rounded-xl p-3 text-left transition-all duration-150 border border-transparent shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_18px_rgba(0,0,0,0.12)] hover:border-[#1A73E8]/30 cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="w-10 h-10 rounded-lg bg-[#1A73E8] flex items-center justify-center text-sm font-bold text-white">
          {clinic.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex flex-col items-end gap-1">
          {onToggleFavorite && (
            <button 
              onClick={(e) => onToggleFavorite(clinic.id, e)}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#EA4335] text-[#EA4335]' : 'text-gray-400'}`} />
            </button>
          )}
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <MapPin className="w-3 h-3" />0.3 km
          </div>
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-800 leading-tight mb-1.5">{clinic.name}</p>
      <div className="flex flex-wrap gap-1 mb-2">
        {['Medical Center'].map((s) => (
          <span key={s} className="inline-block px-2 py-0.5 rounded-md bg-[#E8F0FE] text-[#1A73E8] text-[11px] font-medium">{s}</span>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
          <Star className="w-3 h-3 fill-[#F9AB00] text-[#F9AB00]" />4.8
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#E6F4EA] text-[#137333]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#34A853]" />Open Now
        </span>
      </div>
    </div>
  )
}
