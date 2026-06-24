"use client";

import MapLibreGL, { type PopupOptions, type MarkerOptions } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X, Minus, Plus, Locate, Maximize, Loader2 } from "lucide-react";

function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(" ");
}

const defaultStyles = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};

type Theme = "light" | "dark";

function getDocumentTheme(): Theme | null {
  if (typeof document === "undefined") return null;
  if (document.documentElement.classList.contains("dark")) return "dark";
  if (document.documentElement.classList.contains("light")) return "light";
  return null;
}

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useResolvedTheme(themeProp?: "light" | "dark"): Theme {
  const [detectedTheme, setDetectedTheme] = useState<Theme>(
    () => getDocumentTheme() ?? getSystemTheme(),
  );

  useEffect(() => {
    if (themeProp) return;

    const observer = new MutationObserver(() => {
      const docTheme = getDocumentTheme();
      if (docTheme) {
        setDetectedTheme(docTheme);
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (!getDocumentTheme()) {
        setDetectedTheme(e.matches ? "dark" : "light");
      }
    };
    mediaQuery.addEventListener("change", handleSystemChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, [themeProp]);

  return themeProp ?? detectedTheme;
}

type MapContextValue = {
  map: MapLibreGL.Map | null;
  isLoaded: boolean;
};

const MapContext = createContext<MapContextValue | null>(null);

export function useMap() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error("useMap must be used within a Map component");
  }
  return context;
}

type MapViewport = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
};

type MapStyleOption = string | MapLibreGL.StyleSpecification;
type MapRef = MapLibreGL.Map;

type MapProps = {
  children?: ReactNode;
  className?: string;
  theme?: Theme;
  styles?: {
    light?: MapStyleOption;
    dark?: MapStyleOption;
  };
  projection?: any; 
  viewport?: Partial<MapViewport>;
  onViewportChange?: (viewport: MapViewport) => void;
  loading?: boolean;
  onStyleImageMissing?: (e: MapLibreGL.MapStyleDataEvent & { detail: { id: string } }) => void;
} & Omit<MapLibreGL.MapOptions, "container" | "style">;

const DEFAULT_INITIAL_VIEWPORT: MapViewport = {
  center: [0, 0],
  zoom: 1,
  bearing: 0,
  pitch: 0,
};

function DefaultLoader() {
  return (
    <div className="bg-[#0B0F19]/60 absolute inset-0 z-50 flex items-center justify-center backdrop-blur-xs">
      <div className="flex gap-1">
        <span className="bg-blue-500/60 w-1.5 h-1.5 animate-pulse rounded-full" />
        <span className="bg-blue-500/60 w-1.5 h-1.5 animate-pulse rounded-full [animation-delay:150ms]" />
        <span className="bg-blue-500/60 w-1.5 h-1.5 animate-pulse rounded-full [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function getViewport(map: MapLibreGL.Map): MapViewport {
  const center = map.getCenter();
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  };
}

export const Map = forwardRef<MapRef, MapProps>(function Map(
  {
    children,
    className,
    theme: themeProp,
    styles,
    projection,
    viewport,
    onViewportChange,
    loading = false,
    onStyleImageMissing,
    ...props
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<MapLibreGL.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const currentStyleRef = useRef<MapStyleOption | null>(null);
  const styleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const internalUpdateRef = useRef(false);
  const resolvedTheme = useResolvedTheme(themeProp);
    
  const isControlled = viewport !== undefined && onViewportChange !== undefined;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  const mapStyles = useMemo(
    () => ({
      dark: styles?.dark ?? defaultStyles.dark,
      light: styles?.light ?? defaultStyles.light,
    }),
    [styles],
  );

  useImperativeHandle(ref, () => mapInstance as MapLibreGL.Map, [mapInstance]);

  const clearStyleTimeout = useCallback(() => {
    if (styleTimeoutRef.current) {
      clearTimeout(styleTimeoutRef.current);
      styleTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const initialStyle = resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;
    currentStyleRef.current = initialStyle;

    const initialCenter = viewport?.center ?? DEFAULT_INITIAL_VIEWPORT.center;
    const initialZoom = viewport?.zoom ?? DEFAULT_INITIAL_VIEWPORT.zoom;
    const initialBearing = viewport?.bearing ?? DEFAULT_INITIAL_VIEWPORT.bearing;
    const initialPitch = viewport?.pitch ?? DEFAULT_INITIAL_VIEWPORT.pitch;

    const map = new MapLibreGL.Map({
      container: containerRef.current,
      style: initialStyle,
      center: initialCenter,
      zoom: initialZoom,
      bearing: initialBearing,
      pitch: initialPitch,
      renderWorldCopies: false,
      attributionControl: { compact: true },
      ...props,
    });

    const styleDataHandler = () => {
      clearStyleTimeout();
      styleTimeoutRef.current = setTimeout(() => {
        setIsStyleLoaded(true);
        if (projection && (map as any).setProjection) {
          (map as any).setProjection(projection);
        }
      }, 100);
    };
    const loadHandler = () => setIsLoaded(true);

    const handleMove = () => {
      if (internalUpdateRef.current) return;
      onViewportChangeRef.current?.(getViewport(map));
    };

    map.on("load", loadHandler);
    map.on("styledata", styleDataHandler);
    map.on("move", handleMove);

    if (onStyleImageMissing) {
      map.on("styleimagemissing", (e) => onStyleImageMissing(e as any));
    }

    setMapInstance(map);

    return () => {
      clearStyleTimeout();
      map.off("load", loadHandler);
      map.off("styledata", styleDataHandler);
      map.off("move", handleMove);
      
      if (onStyleImageMissing) {
        map.off("styleimagemissing", (e) => onStyleImageMissing(e as any));
      }

      map.remove();
      setIsLoaded(false);
      setIsStyleLoaded(false);
      setMapInstance(null);
    };
  }, []);

  useEffect(() => {
    if (!mapInstance || !isControlled || !viewport) return;
    if (mapInstance.isMoving()) return;

    const current = getViewport(mapInstance);
    const next = {
      center: viewport.center ?? current.center,
      zoom: viewport.zoom ?? current.zoom,
      bearing: viewport.bearing ?? current.bearing,
      pitch: viewport.pitch ?? current.pitch,
    };

    if (
      next.center[0] === current.center[0] &&
      next.center[1] === current.center[1] &&
      next.zoom === current.zoom &&
      next.bearing === current.bearing &&
      next.pitch === current.pitch
    ) {
      return;
    }

    internalUpdateRef.current = true;
    mapInstance.jumpTo(next);
    internalUpdateRef.current = false;
  }, [mapInstance, isControlled, viewport]);

  useEffect(() => {
    if (!mapInstance || !resolvedTheme) return;

    const newStyle = resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;
    if (currentStyleRef.current === newStyle) return;

    clearStyleTimeout();
    currentStyleRef.current = newStyle;
    setIsStyleLoaded(false);
    mapInstance.setStyle(newStyle, { diff: true });
  }, [mapInstance, resolvedTheme, mapStyles, clearStyleTimeout]);

  const contextValue = useMemo(
    () => ({
      map: mapInstance,
      isLoaded: isLoaded && isStyleLoaded,
    }),
    [mapInstance, isLoaded, isStyleLoaded],
  );

  return (
    <MapContext.Provider value={contextValue}>
      <div ref={containerRef} className={cn("relative h-full w-full", className)}>
        {(!isLoaded || loading) && <DefaultLoader />}
        {mapInstance && children}
      </div>
    </MapContext.Provider>
  );
});

type MarkerContextValue = {
  marker: MapLibreGL.Marker;
  map: MapLibreGL.Map | null;
};

const MarkerContext = createContext<MarkerContextValue | null>(null);

function useMarkerContext() {
  const context = useContext(MarkerContext);
  if (!context) {
    throw new Error("Marker components must be used within MapMarker");
  }
  return context;
}

type MapMarkerProps = {
  longitude: number;
  latitude: number;
  children: ReactNode;
  onClick?: (e: MouseEvent) => void;
  onMouseEnter?: (e: MouseEvent) => void;
  onMouseLeave?: (e: MouseEvent) => void;
  onDragStart?: (lngLat: { lng: number; lat: number }) => void;
  onDrag?: (lngLat: { lng: number; lat: number }) => void;
  onDragEnd?: (lngLat: { lng: number; lat: number }) => void;
} & Omit<MarkerOptions, "element">;

export function MapMarker({
  longitude,
  latitude,
  children,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onDragStart,
  onDrag,
  onDragEnd,
  draggable = false,
  ...markerOptions
}: MapMarkerProps) {
  const { map } = useMap();

  const callbacksRef = useRef({ onClick, onMouseEnter, onMouseLeave, onDragStart, onDrag, onDragEnd });
  callbacksRef.current = { onClick, onMouseEnter, onMouseLeave, onDragStart, onDrag, onDragEnd };

  const marker = useMemo(() => {
    const el = document.createElement("div");
    el.style.position = "absolute";
    
    const markerInstance = new MapLibreGL.Marker({
      ...markerOptions,
      element: el,
      draggable,
    }).setLngLat([longitude, latitude]);

    el.addEventListener("click", (e) => callbacksRef.current.onClick?.(e));
    el.addEventListener("mouseenter", (e) => callbacksRef.current.onMouseEnter?.(e));
    el.addEventListener("mouseleave", (e) => callbacksRef.current.onMouseLeave?.(e));

    markerInstance.on("dragstart", () => {
      const l = markerInstance.getLngLat();
      callbacksRef.current.onDragStart?.({ lng: l.lng, lat: l.lat });
    });
    markerInstance.on("drag", () => {
      const l = markerInstance.getLngLat();
      callbacksRef.current.onDrag?.({ lng: l.lng, lat: l.lat });
    });
    markerInstance.on("dragend", () => {
      const l = markerInstance.getLngLat();
      callbacksRef.current.onDragEnd?.({ lng: l.lng, lat: l.lat });
    });

    return markerInstance;
  }, []);

  useEffect(() => {
    if (!map) return;
    marker.addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, marker]);

  useEffect(() => {
    marker.setLngLat([longitude, latitude]);
  }, [longitude, latitude, marker]);

  return (
    <MarkerContext.Provider value={{ marker, map }}>
      {children}
    </MarkerContext.Provider>
  );
}

export function MarkerContent({ children, className }: { children?: ReactNode; className?: string }) {
  const { marker } = useMarkerContext();
  return createPortal(
    <div className={cn("relative cursor-pointer z-20", className)}>
      {children || <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />}
    </div>,
    marker.getElement(),
  );
}

export function MarkerPopup({
  children,
  className,
  closeButton = false,
  ...popupOptions
}: { children: ReactNode; className?: string; closeButton?: boolean } & Omit<PopupOptions, "className" | "closeButton">) {
  const { marker, map } = useMarkerContext();
  const container = useMemo(() => document.createElement("div"), []);

  const popup = useMemo(() => {
    return new MapLibreGL.Popup({
      offset: 16,
      ...popupOptions,
      closeButton: false,
    }).setMaxWidth("none").setDOMContent(container);
  }, []);

  useEffect(() => {
    if (!map) return;
    marker.setPopup(popup);
    return () => {
      marker.setPopup(null);
    };
  }, [map, marker, popup, container]);

  return createPortal(
    <div className={cn("bg-[#141B2B] text-slate-200 relative max-w-62 rounded-xl border border-white/5 p-3 shadow-xl z-50", className)}>
      {closeButton && (
        <button
          type="button"
          onClick={() => popup.remove()}
          className="absolute top-1 right-1 p-1 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {children}
    </div>,
    container,
  );
}

export function MapControls({
  position = "bottom-right",
  showZoom = true,
  showLocate = false,
  showFullscreen = false,
  className,
  onLocate,
}: {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  showZoom?: boolean;
  showLocate?: boolean;
  showFullscreen?: boolean;
  className?: string;
  onLocate?: (coords: { longitude: number; latitude: number }) => void;
}) {
  const { map } = useMap();
  const [locating, setLocating] = useState(false);

  const posClasses = {
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
  };

  const handleLocate = () => {
    setLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords = { longitude: pos.coords.longitude, latitude: pos.coords.latitude };
        map?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 14, duration: 1200 });
        onLocate?.(coords);
        setLocating(false);
      }, () => setLocating(false));
    }
  };

  return (
    <div className={cn("absolute z-30 flex flex-col gap-2 bg-[#141B2B] border border-white/5 p-1 rounded-lg shadow-xl", posClasses[position], className)}>
      {showZoom && (
        <>
          <button onClick={() => map?.zoomTo(map.getZoom() + 1)} className="p-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded transition-colors">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={() => map?.zoomTo(map.getZoom() - 1)} className="p-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded border-t border-white/5 transition-colors">
            <Minus className="w-4 h-4" />
          </button>
        </>
      )}
      {showLocate && (
        <button onClick={handleLocate} className="p-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded border-t border-white/5 transition-colors">
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Locate className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

export function MarkerLabel({
  children,
  position = "bottom",
  className,
}: {
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className={cn(
        "absolute whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-slate-100 shadow-sm border border-slate-800 pointer-events-none select-none z-10",
        positionClasses[position],
        className
      )}
    >
      {children}
    </div>
  );
}

export function MarkerTooltip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap rounded bg-slate-950 px-2 py-1 text-xs text-white shadow-md z-30 pointer-events-none",
        className
      )}
    >
      {children}
    </div>
  );
}