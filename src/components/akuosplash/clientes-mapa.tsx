"use client";

import { useState, useMemo } from "react";
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

export function ClientesMapa({ open, onOpenChange, clientes, onSelectCliente }: ClientesMapaProps) {
  const [busqueda, setBusqueda] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  // Construir URL de Google Static Maps
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  let mapUrl: string;

  if (selected) {
    // Cliente seleccionado: zoom 16, un marker
    const color = (selected.deuda ?? 0) > 0 ? "red" : "green";
    mapUrl = `https://maps.googleapis.com/maps/api/staticmap?key=${apiKey}&center=${selected.lat},${selected.lng}&zoom=16&size=600x400&markers=color:${color}|${selected.lat},${selected.lng}&scale=2`;
  } else {
    // Vista general: mostrar hasta 30 markers (límite de URL)
    const markersToShow = filtrados.slice(0, 30);
    const greenMarkers = markersToShow.filter((c) => (c.deuda ?? 0) <= 0).map((c) => `${c.lat},${c.lng}`).join("|");
    const redMarkers = markersToShow.filter((c) => (c.deuda ?? 0) > 0).map((c) => `${c.lat},${c.lng}`).join("|");
    const parts = ["https://maps.googleapis.com/maps/api/staticmap?key=" + apiKey + "&size=600x400&zoom=11&scale=2"];
    if (greenMarkers) parts.push(`markers=color:green|${greenMarkers}`);
    if (redMarkers) parts.push(`markers=color:red|${redMarkers}`);
    mapUrl = parts.join("&");
    // Si la URL es muy larga, mostrar solo el centro sin markers
    if (mapUrl.length > 2000) {
      const centerLat = filtrados.reduce((s, c) => s + (c.lat || 0), 0) / (filtrados.length || 1);
      const centerLng = filtrados.reduce((s, c) => s + (c.lng || 0), 0) / (filtrados.length || 1);
      mapUrl = `https://maps.googleapis.com/maps/api/staticmap?key=${apiKey}&center=${centerLat.toFixed(4)},${centerLng.toFixed(4)}&zoom=11&size=600x400&scale=2`;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[95vw] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Mapa de clientes
            <span className="text-sm font-normal text-muted-foreground">
              ({filtrados.length} visibles)
            </span>
          </DialogTitle>
          <DialogDescription>
            Tocá un cliente en la lista para verlo en el mapa. Verde = al día. Rojo = con deuda.
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

        {/* Mapa — imagen estática de Google Maps */}
        <img
          src={mapUrl}
          alt="Mapa de clientes"
          style={{ width: "100%", height: "auto", borderRadius: "8px", border: "1px solid #e5e7eb", display: "block" }}
        />

        {/* Cliente seleccionado: link a Google Maps */}
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
        <div className="mt-2 max-h-[300px] overflow-y-auto space-y-1">
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
                      {c.zona && <p className="text-xs text-muted-foreground/80">📍 {c.zona}</p>}
                    </div>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      deuda > 0
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {deuda > 0 ? "Debe" : "OK"}
                    </span>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${c.lat},${c.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  >
                    <ExternalLink className="h-3 w-3" /> Cómo llegar
                  </a>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
