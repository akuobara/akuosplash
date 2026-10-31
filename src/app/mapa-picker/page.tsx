"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, ArrowLeft, Check, Crosshair, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";

declare global {
  interface Window {
    L?: any;
  }
}

interface ClienteLite {
  id: string;
  nombre: string;
  lat: number | null;
  lng: number | null;
}

function MapaPickerInner() {
  const searchParams = useSearchParams();
  const initialLat = searchParams.get("lat");
  const initialLng = searchParams.get("lng");

  const [lat, setLat] = useState<number | null>(initialLat ? parseFloat(initialLat) : null);
  const [lng, setLng] = useState<number | null>(initialLng ? parseFloat(initialLng) : null);
  const [mapReady, setMapReady] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [locating, setLocating] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [clientes, setClientes] = useState<ClienteLite[]>([]);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsDenied, setGpsDenied] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  // Pedir GPS inmediatamente al cargar la página (antes de que el mapa inicialice)
  // Esto dispara el prompt de permiso del browser
  useEffect(() => {
    if (lat != null && lng != null) return; // si ya hay coords, no pedir GPS
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setGpsDenied(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  // Cargar clientes para centrar el mapa en su zona
  useEffect(() => {
    apiGet<{ clientes: ClienteLite[] }>("/api/clientes").then((data) => {
      setClientes(data.clientes || []);
    }).catch(() => {});
  }, []);

  // Cargar Leaflet
  useEffect(() => {
    if (window.L) { setMapReady(true); return; }
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);
  }, []);

  // Init map
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    let tries = 0;
    const tryInit = setInterval(() => {
      tries++;
      if (tries > 50) { clearInterval(tryInit); return; }
      if (!window.L || !mapRef.current) return;
      clearInterval(tryInit);
      if (mapInstance.current) return;
      const L = window.L;

      // Prioridad de centro: coords iniciales > GPS > clientes > Santiago
      let startLat = -33.4489;
      let startLng = -70.6693;
      let startZoom = 11;
      if (lat != null && lng != null) {
        startLat = lat;
        startLng = lng;
        startZoom = 16;
      } else if (gpsCoords) {
        startLat = gpsCoords.lat;
        startLng = gpsCoords.lng;
        startZoom = 14;
      }

      const map = L.map(mapRef.current).setView([startLat, startLng], startZoom);

      // Capa de calles (OpenStreetMap)
      const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      });

      // Capa satelital (Esri World Imagery)
      const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "© Esri",
        maxZoom: 19,
      });

      // Empezar con satelital (mejor para encontrar estanques)
      satellite.addTo(map);

      // Control para cambiar entre calles y satélite
      L.control.layers({
        "Satélite": satellite,
        "Calles": streets,
      }, null, { position: "topleft", collapsed: false }).addTo(map);
      mapInstance.current = map;
      setMapInitialized(true); // disparar re-render para que el effect de markers corra

      // Los markers de clientes se agregan en el effect de abajo (depende de [clientes, mapInitialized])

      if (lat != null && lng != null) {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current.on("dragend", (e: any) => {
          const p = e.target.getLatLng();
          setLat(p.lat);
          setLng(p.lng);
        });
      }

      map.on("click", (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        setLat(clickLat);
        setLng(clickLng);
        if (markerRef.current) {
          markerRef.current.setLatLng([clickLat, clickLng]);
        } else {
          markerRef.current = L.marker([clickLat, clickLng], { draggable: true }).addTo(map);
          markerRef.current.on("dragend", (ev: any) => {
            const p = ev.target.getLatLng();
            setLat(p.lat);
            setLng(p.lng);
          });
        }
      });

      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 500);
    }, 100);

    return () => clearInterval(tryInit);
  }, [mapReady, gpsCoords]);

  // Recentrar el mapa cuando llega el GPS (si el mapa ya inicializó)
  useEffect(() => {
    if (!gpsCoords || !mapInstance.current) return;
    if (lat != null) return; // no recentrar si ya marcó un punto
    mapInstance.current.setView([gpsCoords.lat, gpsCoords.lng], 14);
  }, [gpsCoords]);

  // Agregar markers de clientes + recentrar cuando carguen los datos
  // Este effect corre cuando:
  //   - 'clientes' cambia (API devuelve datos)
  //   - 'mapInitialized' cambia a true (mapa terminó de inicializar)
  // Usamos el STATE mapInitialized (no el ref mapInstance.current) porque los cambios
  // a un ref NO disparan re-render, lo que causaba que los markers no se agregaran si
  // la API respondía antes de que el mapa inicializara.
  useEffect(() => {
    if (!mapInitialized || !mapInstance.current || !window.L) return;
    if (clientes.length === 0) return; // no hacer nada si no hay clientes cargados todavía
    const L = window.L;
    const map = mapInstance.current;

    // CRÍTICO: invalidar el tamaño ANTES de agregar markers.
    // Si el mapa no tiene tamaño válido, Leaflet no puede calcular _point de cada circleMarker
    // y los paths quedan como "M0 0" (sin dibujar el círculo).
    map.invalidateSize();

    // Agregar markers de TODOS los clientes con GPS
    const markersCreados: any[] = [];
    clientes.filter((c) => c.lat != null && c.lng != null).forEach((c) => {
      const m = L.circleMarker([c.lat!, c.lng!], {
        radius: 8,
        fillColor: "#2563eb",
        color: "white",
        weight: 2,
        fillOpacity: 0.8,
      }).addTo(map).bindTooltip(c.nombre, { permanent: false });
      markersCreados.push(m);
    });

    // Forzar redraw de los markers después de que el mapa se recentre.
    // Sin esto, los paths pueden quedar con d="M0 0" si el setView dispara antes
    // de que Leaflet recalcule las posiciones pixel.
    setTimeout(() => {
      markersCreados.forEach((m) => {
        try { m.redraw(); } catch {}
      });
      map.invalidateSize();
    }, 50);

    // Recentrar si no hay punto marcado ni GPS
    if (lat != null) return;
    if (gpsCoords) return;
    const conGps = clientes.filter((c) => c.lat != null && c.lng != null);
    if (conGps.length === 0) return;
    const avgLat = conGps.reduce((s, c) => s + (c.lat as number), 0) / conGps.length;
    const avgLng = conGps.reduce((s, c) => s + (c.lng as number), 0) / conGps.length;
    map.setView([avgLat, avgLng], 13);
    setTimeout(() => {
      map.invalidateSize();
      markersCreados.forEach((m) => { try { m.redraw(); } catch {} });
    }, 200);
  }, [clientes, mapInitialized, lat, gpsCoords]);

  function useMyLocation() {
    if (!navigator.geolocation) { toast.error("Sin geolocalización"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        if (mapInstance.current && window.L) {
          mapInstance.current.setView([latitude, longitude], 16);
          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude]);
          } else {
            markerRef.current = window.L.marker([latitude, longitude], { draggable: true }).addTo(mapInstance.current);
            markerRef.current.on("dragend", (e: any) => {
              const p = e.target.getLatLng();
              setLat(p.lat);
              setLng(p.lng);
            });
          }
        }
        toast.success("Ubicación capturada");
      },
      () => { setLocating(false); toast.error("No se pudo obtener ubicación. ¿Permitiste el acceso GPS?"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Buscar lugar con Google Geocoding
  async function buscar() {
    if (!busqueda.trim()) return;
    setBuscando(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(busqueda)}&components=country:CL&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "OK" && data.results?.length > 0) {
        const r = data.results[0];
        const lat2 = r.geometry.location.lat;
        const lng2 = r.geometry.location.lng;
        if (mapInstance.current) {
          mapInstance.current.setView([lat2, lng2], 14);
        }
        toast.success(`Encontrado: ${r.formatted_address}`);
      } else {
        toast.error("No encontrado. Probá con: La Serena, Coquimbo, etc.");
      }
    } catch { toast.error("Error al buscar"); }
    finally { setBuscando(false); }
  }

  function guardar() {
    if (lat == null || lng == null) { toast.error("Tocá el mapa para marcar la ubicación"); return; }
    sessionStorage.setItem("mapPickerResult", JSON.stringify({ lat, lng }));
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between gap-2">
        <a href="/" className="text-gray-500 hover:text-gray-700 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </a>
        <h1 className="text-sm font-semibold flex items-center gap-1.5 shrink-0">
          <MapPin className="h-4 w-4 text-blue-600" />
          Marcar ubicación
        </h1>
        <Button onClick={guardar} disabled={lat == null} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shrink-0">
          <Check className="mr-1 h-4 w-4" /> Guardar
        </Button>
      </header>

      {/* Buscador */}
      <div className="sticky top-[41px] z-20 bg-white border-b border-gray-200 px-3 py-2 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }}
            placeholder="Buscar: La Serena, Coquimbo, Ovalle..."
            className="pl-8 h-9"
          />
        </div>
        <Button onClick={buscar} disabled={buscando} size="sm" variant="outline">
          {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        <Button onClick={useMyLocation} disabled={locating} size="sm" variant="outline" title="Mi GPS">
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4 text-blue-600" />}
        </Button>
      </div>

      {/* Mapa */}
      <div className="relative" style={{ height: "calc(100vh - 90px)" }}>
        <div ref={mapRef} className="absolute inset-0" style={{ zIndex: 1 }} />
      </div>

      {/* Info bar */}
      {lat != null && lng != null && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500">Ubicación marcada</p>
            <p className="text-sm font-medium tabular-nums">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
          </div>
          <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline whitespace-nowrap">
            Google Maps →
          </a>
        </div>
      )}
    </div>
  );
}

export default function MapaPickerPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
      <MapaPickerInner />
    </Suspense>
  );
}
