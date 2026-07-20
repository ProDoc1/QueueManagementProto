'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'
import { ClinicCard } from '@/components/patient/ClinicCard'

export default function PatientFavoritesPage() {
  const { accessToken } = useAuth()
  const router = useRouter()
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (accessToken) {
      apiRequest<any[]>('/api/patients/favorites', { token: accessToken })
        .then(data => {
          setFavorites(data)
          setLoading(false)
        })
        .catch(err => {
          console.log('API Error:', err.message)
          setLoading(false)
        })
    }
  }, [accessToken])

  async function handleToggleFavorite(clinicId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!accessToken) return
    
    // Optimistically remove from view
    const removedClinic = favorites.find(f => f.id === clinicId)
    setFavorites(prev => prev.filter(f => f.id !== clinicId))
    
    try {
      await apiRequest(`/api/patients/favorites/${clinicId}`, { method: 'DELETE', token: accessToken })
    } catch (err) {
      console.log('Error toggling favorite', err)
      // Revert on error
      if (removedClinic) {
        setFavorites(prev => [...prev, removedClinic])
      }
    }
  }

  function handleClinicClick(clinic: any) {
    router.push(`/patient/book?clinicId=${clinic.id}`)
  }

  return (
    <div className="h-full flex flex-col p-6 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Saved Favourites</h2>
        <p className="text-sm text-gray-500 mt-1">
          Your preferred medical centers for quick booking.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pb-10" style={{ scrollbarWidth: 'none' }}>
        {loading ? (
          <div className="flex justify-center items-center py-20 text-gray-400 text-sm">
            Loading favourites...
          </div>
        ) : favorites.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-20 text-center bg-white rounded-2xl border border-gray-100 shadow-sm px-6">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="text-gray-900 font-semibold mb-1">No favourites yet</h3>
            <p className="text-gray-500 text-sm max-w-xs">
              Save medical centers by clicking the heart icon on any clinic to find them quickly here.
            </p>
            <button 
              onClick={() => router.push('/patient/book')}
              className="mt-6 text-sm bg-blue-50 text-blue-600 font-medium px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Explore Clinics
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.map(clinic => (
              <ClinicCard 
                key={clinic.id} 
                clinic={clinic} 
                onSelect={handleClinicClick}
                isFavorite={true}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
