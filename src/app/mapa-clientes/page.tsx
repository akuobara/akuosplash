"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, ExternalLink, ArrowLeft, Search } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { formatCurrency } from "@/lib/helpers";

interface Cliente {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  zona: string | null;
  lat: number | null;
  lng: number | null;
  deuda?: number;
}

declare global {
  interface Window {
    L?: any;
  }
}

function MapaClientesPage() {
  const searchParams = useSearchParams();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<{ marker: any; id: string }[]>([]);

  const clientesConGps = useMemo(
    () => clientes.filter((c) => c.lat != null && c.lng != null),
    [clientes]
  );

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return clientesConGps;
    const q = busqueda.toLowerCase().trim();
    return clientesConGps.filter((c) =>
      c.nombre.toLowerCase().includes(q) ||
      c.direccion?.toLowerCase().includes(q) ||
      c.zona?.toLowerCase().includes(q)
    );
  }, [clientesConGps, busqueda]);

  // Cargar clientes
  useEffect(() => {
    apiGet<{ clientes: Cliente[] }>("/api/clientes").then((data) => {
      setClientes(data.clientes);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Cargar Leaflet CSS + JS
  useEffect(() => {
    if (window.L) return;
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
    document.head.appendChild(script);
  }, []);

  // Init map — polling hasta que Leaflet esté listo
  useEffect(() => {
    if (loading) return;

    let tries = 0;
    const tryInit = setInterval(() => {
      tries++;
      if (tries > 50) {
        clearInterval(tryInit);
        setMapError("No se pudo cargar el mapa. Verificá tu conexión.");
        return;
      }
      if (!window.L || !mapRef.current) return;
      clearInterval(tryInit);

      // Limpiar mapa anterior
      if (mapInstance.current) {
        try { mapInstance.current.remove(); } catch {}
      }
      markersRef.current = [];

      const L = window.L;
      const startLat = filtrados[0]?.lat ?? -33.4489;
      const startLng = filtrados[0]?.lng ?? -70.6693;
      const startZoom = filtrados.length === 1 ? 16 : 11;

      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([startLat, startLng], startZoom);

      // Capa satelital (Esri World Imagery)
      const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "© Esri",
        maxZoom: 19,
      });
      // Capa de calles
      const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      });
      // Empezar con satelital
      satellite.addTo(map);
      L.control.layers({ "Satélite": satellite, "Calles": streets }, null, { position: "topleft", collapsed: false }).addTo(map);

      mapInstance.current = map;

      // CRÍTICO: invalidar tamaño antes de agregar markers
      map.invalidateSize();

      // Agregar markers
      const markersCreados: any[] = [];
      filtrados.forEach((c) => {
        const tieneDeuda = (c.deuda ?? 0) > 0;
        const color = tieneDeuda ? "#dc2626" : "#16a34a";
        const marker = L.circleMarker([c.lat!, c.lng!], {
          radius: 10,
          fillColor: color,
          color: "white",
          weight: 2,
          fillOpacity: 1,
        }).addTo(map);

        marker.bindPopup(
          `<div style="font-family: sans-serif; min-width: 180px;">
            <b style="font-size: 14px;">${c.nombre}</b>
            ${c.direccion ? `<br><span style="color: #666; font-size: 12px;">${c.direccion}</span>` : ""}
            ${c.zona ? `<br><span style="color: #999; font-size: 11px;">📍 ${c.zona}</span>` : ""}
            ${tieneDeuda ? `<br><b style="color: #dc2626; font-size: 12px;">Debe: ${formatCurrency(c.deuda ?? 0)}</b>` : ""}
            <br><a href="https://www.google.com/maps?q=${c.lat},${c.lng}" target="_blank" style="color: #2563eb; font-size: 12px;">Cómo llegar →</a>
          </div>`
        );
        marker.on("click", () => setSelectedId(c.id));
        markersRef.current.push({ marker, id: c.id });
        markersCreados.push(marker);
      });

      // Fit bounds — filtrar outliers para que no se vea todo el continente
      if (filtrados.length > 1) {
        const points = filtrados.map((c) => [c.lat!, c.lng!]);
        // Filtrar coordenadas que estén fuera de Chile razonable (lat -20 a -57, lng -66 a -75)
        const validPoints = points.filter(([lat, lng]) => lat > -57 && lat < -20 && lng > -75 && lng < -66);
        if (validPoints.length > 0) {
          const bounds = L.latLngBounds(validPoints);
          map.fitBounds(bounds, { padding: [40, 40] });
        } else {
          // Si no hay puntos válidos, centrar en Santiago
          map.setView([-33.4489, -70.6693], 11);
        }
      }

      // Forzar redraw después de que el mapa se recentre
      setTimeout(() => {
        map.invalidateSize();
        markersCreados.forEach((m) => { try { m.redraw(); } catch {} });
      }, 100);
      setTimeout(() => {
        map.invalidateSize();
        markersCreados.forEach((m) => { try { m.redraw(); } catch {} });
      }, 500);
    }, 100);

    return () => clearInterval(tryInit);
  }, [loading, filtrados]);

  // Centrar en cliente seleccionado
  useEffect(() => {
    if (!selectedId || !mapInstance.current || !window.L) return;
    const cliente = clientesConGps.find((c) => c.id === selectedId);
    if (cliente) {
      mapInstance.current.setView([cliente.lat!, cliente.lng!], 16);
      const m = markersRef.current.find((x) => x.id === selectedId);
      if (m) m.marker.openPopup();
    }
  }, [selectedId, clientesConGps]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <a href="/" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </a>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-600" />
          Mapa de clientes
          <span className="text-sm font-normal text-gray-500">({filtrados.length})</span>
        </h1>
      </header>

      {/* Buscador */}
      <div className="sticky top-[57px] z-20 bg-white border-b border-gray-200 px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar nombre/dirección/zona"
            className="pl-9"
          />
        </div>
      </div>

      {/* Mapa — pantalla completa */}
      <div className="relative" style={{ height: "calc(100vh - 120px)", minHeight: "300px" }}>
        <div ref={mapRef} className="absolute inset-0" style={{ zIndex: 1 }} />
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-center p-4">
            <p className="text-sm text-gray-500">{mapError}</p>
          </div>
        )}
      </div>

      {/* Cliente seleccionado — barra flotante */}
      {selectedId && (() => {
        const c = clientesConGps.find((x) => x.id === selectedId);
        if (!c) return null;
        return (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 p-3 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{c.nombre}</p>
                {c.direccion && <p className="text-xs text-gray-500 truncate">{c.direccion}</p>}
              </div>
              <a href={`https://www.google.com/maps?q=${c.lat},${c.lng}`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                  <ExternalLink className="mr-1 h-4 w-4" /> Cómo llegar
                </Button>
              </a>
            </div>
          </div>
        );
      })()}

      {/* Lista deslizable desde abajo */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 bg-white rounded-t-xl border-t border-gray-200 max-h-[40vh] overflow-y-auto shadow-lg transition-transform"
        style={{ transform: selectedId ? "translateY(100%)" : "none" }}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-2">
          <p className="text-sm font-medium">Clientes ({filtrados.length})</p>
        </div>
        <div className="divide-y divide-gray-100">
          {filtrados.map((c) => {
            const deuda = c.deuda ?? 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{c.nombre}</p>
                  {c.direccion && <p className="text-xs text-gray-500 truncate">{c.direccion}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  deuda > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                }`}>
                  {deuda > 0 ? "Debe" : "OK"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function MapaPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent" /></div>}>
      <MapaClientesPage />
    </Suspense>
  );
}
