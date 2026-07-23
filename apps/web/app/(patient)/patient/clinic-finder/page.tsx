"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Map, MapMarker, MarkerContent, MarkerPopup, MapControls } from "@/components/ui/mapcn-marker-popup";
import { Navigation, Heart } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/api-client";

// Default coordinate viewport centering around Colombo, Sri Lanka (tilted and zoomed in for 3D buildings)
const INITIAL_VIEWPORT = {
  center: [79.8612, 6.9271] as [number, number],
  zoom: 15.5,
  bearing: 30,
  pitch: 55,
};

// Stable basemap definitions that avoid the broken OpenFreeMap sprite/tile fetch chain.
const FREE_MAP_STYLES = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

export default function ClinicFinderPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [viewport, setViewport] = useState(INITIAL_VIEWPORT);
  const [clinics, setClinics] = useState<any[]>([]);
  const [favoriteClinics, setFavoriteClinics] = useState<string[]>([]);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setViewport((prev) => ({
          ...prev,
          center: [position.coords.longitude, position.coords.latitude],
        }));
      },
      (error) => {
        console.warn("Location unavailable, using default city center:", error.code, error.message);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    if (accessToken) {
      Promise.all([
        apiRequest<any[]>('/api/clinics', { token: accessToken }),
        apiRequest<any[]>('/api/patients/favorites', { token: accessToken }).catch(() => [])
      ])
        .then(([data, favorites]) => {
          setClinics(data)
          setFavoriteClinics(favorites.map(f => f.id))
        })
        .catch((e) => console.log("API Error:", e.message));
    }
  }, [accessToken]);

  async function handleToggleFavorite(clinicId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!accessToken) return
    const isFav = favoriteClinics.includes(clinicId)
    setFavoriteClinics(prev => isFav ? prev.filter(id => id !== clinicId) : [...prev, clinicId])
    try {
      if (isFav) {
        await apiRequest(`/api/patients/favorites/${clinicId}`, { method: 'DELETE', token: accessToken })
      } else {
        await apiRequest('/api/patients/favorites', { method: 'POST', token: accessToken, body: { clinicId } })
      }
    } catch (err) {
      console.log('Error toggling favorite', err)
      setFavoriteClinics(prev => isFav ? [...prev, clinicId] : prev.filter(id => id !== clinicId))
    }
  }

  return (
    <div className="flex flex-col h-screen w-full gap-4 p-6 overflow-hidden">
      {/* Header section matching your dashboard theme */}
      <div className="flex flex-col gap-1 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Clinic Finder</h1>
        <p className="text-muted-foreground text-sm">
          Search clinic by name or location, discover nearby facilities, and view live queuing statuses.
        </p>
      </div>

      {/* Main Map Wrapper Grid Box */}
      <div className="relative flex-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-xs min-h-[500px] h-[calc(100vh-8rem)]">
        <Map
          viewport={viewport}
          styles={FREE_MAP_STYLES}
          theme="light"
          projection="mercator"
          onViewportChange={(nextViewport) => setViewport(nextViewport)}
          
          // This listener catches the missing asset and satisfies the engine
          onStyleImageMissing={(e) => {
            const map = e.target;
            const missingImageId = (e as any).detail?.id || "wood-pattern";
            
            // Check if it's already generated to avoid duplicate injections
            if (!map.hasImage(missingImageId)) {
              // Create a tiny 1x1 transparent canvas pixel bundle
              const canvas = document.createElement("canvas");
              canvas.width = 1;
              canvas.height = 1;
              const ctx = canvas.getContext("2d");
              
              if (ctx) {
                const imageData = ctx.getImageData(0, 0, 1, 1);
                // Inject it as a safe mock fallback asset
                map.addImage(missingImageId, imageData);
              }
            }
          }}
        >
          {/* Controls aligned cleanly at the bottom right */}
          <MapControls position="bottom-right" showZoom showLocate />

          {clinics.map((clinic) => {
            const lon = clinic.longitude ?? 79.8612;
            const lat = clinic.latitude ?? 6.9271;
            return (
              <MapMarker
                key={clinic.id}
                longitude={lon}
                latitude={lat}
              >
                {/* Custom Blueprint Pulse Marker */}
                <MarkerContent>
                  <div className="relative flex items-center justify-center cursor-pointer group">
                    <div className="absolute h-6 w-6 rounded-full bg-blue-500/30 border-2 border-blue-500/40 animate-ping" />
                    <div className="relative h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow-lg group-hover:scale-110 group-hover:bg-blue-500 transition-all duration-200 flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    </div>
                  </div>
                </MarkerContent>

                {/* Popup card details matching the requested design with a premium glassmorphic feel */}
                <MarkerPopup className="w-64 p-0 overflow-hidden bg-[#141B2B] text-slate-200 shadow-2xl rounded-xl border border-white/5" closeButton>
                  {/* Visual Header / Cover Image */}
                  <div className="relative h-28 w-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15)_0%,transparent_100%)] animate-pulse duration-1000" />
                    <span className="text-white/20 text-5xl font-black select-none tracking-wider font-mono">
                      {clinic.name.substring(0, 2).toUpperCase()}
                    </span>
                    <div className="absolute bottom-2.5 left-3 bg-black/40 backdrop-blur-md px-2.5 py-0.5 rounded text-[10px] text-emerald-400 font-semibold tracking-wide border border-emerald-500/20">
                      ★ 4.8 / 5
                    </div>
                  </div>

                  {/* Clinic Details */}
                  <div className="p-4 space-y-3.5">
                    <div>
                      <p className="text-slate-400/80 text-[10px] font-semibold tracking-wider uppercase">
                        Medical Center
                      </p>
                      <h3 className="font-semibold text-sm text-slate-100 tracking-tight mt-0.5">
                        {clinic.name}
                      </h3>
                    </div>

                    <div className="flex flex-col gap-2 pt-0.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-emerald-400 font-medium">Open Now</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400">0.3 km away</span>
                      </div>
                      <div className="text-[11px] text-slate-400 leading-normal flex flex-col gap-0.5">
                        <p>{clinic.address || "No address provided"}</p>
                        <p className="text-slate-500">{clinic.phone || ""}</p>
                      </div>
                    </div>

                    {/* Book Token Button */}
                    <div className="pt-2 border-t border-white/5 flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(clinic.id, e)}
                        className="w-8 h-8.5 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors shadow-sm"
                      >
                        <Heart className={`w-4 h-4 ${favoriteClinics.includes(clinic.id) ? 'fill-emerald-500 text-emerald-500' : 'text-slate-400'}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/patient/book?clinicId=${clinic.id}`)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 h-8.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all active:scale-95 duration-150"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Book Token
                      </button>
                    </div>
                  </div>
                </MarkerPopup>
              </MapMarker>
            );
          })}
        </Map>
      </div>
    </div>
  );
}