"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MapPin, ExternalLink } from "lucide-react";

export interface ClienteMapa {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  zona: string | null;
  lat: number | null;
  lng: number | null;
  deuda?: number;
}

interface ClientesMapaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: ClienteMapa[];
  onSelectCliente?: (id: string) => void;
}

declare global {
  interface Window {
    L?: any;
  }
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

export function ClientesMapa({ open, onOpenChange, clientes, onSelectCliente }: ClientesMapaProps) {
  const [busqueda, setBusqueda] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const selected = selectedId ? clientesConGps.find((c) => c.id === selectedId) : null;

  // Cargar Leaflet CSS + JS cuando el dialog se abre
  useEffect(() => {
    if (!open) return;
    if (window.L) return;

    if (!document.getElementById("leaflet-css-map")) {
      const link = document.createElement("link");
      link.id = "leaflet-css-map";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    document.head.appendChild(script);
  }, [open]);

  // Init map cuando Leaflet está cargado Y el dialog está abierto Y hay datos
  useEffect(() => {
    if (!open) return;
    if (filtrados.length === 0) return;

    let tries = 0;
    const tryInit = setInterval(() => {
      tries++;
      if (tries > 50) {
        clearInterval(tryInit);
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
      const startZoom = filtrados.length === 1 ? 16 : 12;

      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([startLat, startLng], startZoom);

      // Capa satelital
      const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "© Esri",
        maxZoom: 19,
      });
      const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      });
      satellite.addTo(map);
      L.control.layers({ "Satélite": satellite, "Calles": streets }, null, { position: "topleft", collapsed: false }).addTo(map);

      mapInstance.current = map;

      // Agregar markers para TODOS los clientes (sin límite de 30)
      filtrados.forEach((c) => {
        const tieneDeuda = (c.deuda ?? 0) > 0;
        const color = tieneDeuda ? "#dc2626" : "#16a34a";
        const marker = L.circleMarker([c.lat!, c.lng!], {
          radius: 8,
          fillColor: color,
          color: "white",
          weight: 2,
          fillOpacity: 1,
        }).addTo(map);

        marker.bindPopup(
          `<div style="font-family: sans-serif; min-width: 160px;">
            <b style="font-size: 13px;">${c.nombre}</b>
            ${c.direccion ? `<br><span style="color: #666; font-size: 11px;">${c.direccion}</span>` : ""}
            ${c.zona ? `<br><span style="color: #999; font-size: 10px;">${c.zona}</span>` : ""}
            ${tieneDeuda ? `<br><b style="color: #dc2626; font-size: 11px;">Debe: ${formatCurrency(c.deuda ?? 0)}</b>` : ""}
            <br><a href="https://www.google.com/maps?q=${c.lat},${c.lng}" target="_blank" style="color: #2563eb; font-size: 11px;">Cómo llegar →</a>
          </div>`
        );
        marker.on("click", () => setSelectedId(c.id));
        markersRef.current.push({ marker, id: c.id });
      });

      // Fit bounds
      if (filtrados.length > 1) {
        const points = filtrados.map((c) => [c.lat!, c.lng!]);
        const validPoints = points.filter(([lat, lng]) => lat > -57 && lat < -20 && lng > -75 && lng < -66);
        if (validPoints.length > 0) {
          const bounds = L.latLngBounds(validPoints);
          map.fitBounds(bounds, { padding: [30, 30] });
        }
      }

      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 500);
    }, 100);

    return () => clearInterval(tryInit);
  }, [open, filtrados]);

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

  // Cleanup al cerrar
  useEffect(() => {
    if (!open && mapInstance.current) {
      try { mapInstance.current.remove(); } catch {}
      mapInstance.current = null;
      markersRef.current = [];
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[95vw] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Mapa de clientes
            <span className="text-sm font-normal text-muted-foreground">
              ({filtrados.length} visibles de {clientes.length} total, {clientesConGps.length} con GPS)
            </span>
          </DialogTitle>
          <DialogDescription>
            Tocá un cliente en la lista o en el mapa. Verde = al día. Rojo = con deuda.
          </DialogDescription>
        </DialogHeader>

        {/* Buscador */}
        <div className="flex gap-2 mb-2">
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar nombre/dirección/zona"
            className="flex-1"
          />
        </div>

        {/* Mapa Leaflet interactivo */}
        <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height: "400px" }}>
          <div ref={mapRef} className="absolute inset-0" style={{ zIndex: 1 }} />
        </div>

        {/* Cliente seleccionado */}
        {selected && (
          <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 p-2 flex items-center justify-between gap-2">
            <div>
              <p className="font-medium text-sm">{selected.nombre}</p>
              {selected.direccion && <p className="text-xs text-muted-foreground">{selected.direccion}</p>}
            </div>
            <a
              href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline whitespace-nowrap"
            >
              <ExternalLink className="h-4 w-4" /> Cómo llegar
            </a>
          </div>
        )}

        {/* Lista de clientes */}
        <div className="mt-2 max-h-[200px] overflow-y-auto space-y-1">
          {filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay clientes con GPS que coincidan.
            </p>
          ) : (
            filtrados.map((c) => {
              const deuda = c.deuda ?? 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left rounded-lg border p-2 transition ${
                    c.id === selectedId ? "border-primary bg-primary/10" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{c.nombre}</p>
                      {c.direccion && <p className="text-xs text-muted-foreground truncate">{c.direccion}</p>}
                    </div>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      deuda > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    }`}>
                      {deuda > 0 ? "Debe" : "OK"}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
