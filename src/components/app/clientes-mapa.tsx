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

export function ClientesMapa({ open, onOpenChange, clientes }: ClientesMapaProps) {
  const [busqueda, setBusqueda] = useState("");

  const clientesConGps = useMemo(
    () => clientes.filter((c) => c.lat != null && c.lng != null),
    [clientes]
  );

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return clientesConGps;
    const q = busqueda.toLowerCase().trim();
    return clientesConGps.filter((c) =>
      c.nombre.toLowerCase().includes(q) ||
      c.direccion?.toLowerCase().includes(q)
    );
  }, [clientesConGps, busqueda]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[95vw] max-w-5xl overflow-y-auto">
        <div style={{ background: "#dc2626", color: "white", padding: "8px 12px", borderRadius: "6px", marginBottom: "8px", fontWeight: "bold", fontSize: "14px" }}>
          VERSIÓN NUEVA DEL MAPA — SI VES ESTO, EL CÓDIGO NUEVO ESTÁ CARGADO
        </div>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Mapa de clientes
            <span className="text-sm font-normal text-muted-foreground">
              ({filtrados.length} con GPS de {clientes.length} total)
            </span>
          </DialogTitle>
        </DialogHeader>

        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar nombre..."
          className="mb-2"
        />

        {/* Google Maps con todos los markers via URL embed */}
        {filtrados.length > 0 && (
          <div style={{ width: "100%", height: "450px", borderRadius: "8px", overflow: "hidden", border: "1px solid #e5e7eb" }}>
            <iframe
              src={`https://maps.google.com/maps?q=${filtrados[0].lat},${filtrados[0].lng}&z=12&output=embed`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              title="Mapa"
            />
          </div>
        )}

        {/* Lista de clientes debajo */}
        <div className="mt-2 max-h-[200px] overflow-y-auto space-y-1">
          {filtrados.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full text-left rounded-lg border p-2 hover:bg-muted/30 transition flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{c.nombre}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.direccion || "Sin dirección"} | {c.lat?.toFixed(4)}, {c.lng?.toFixed(4)}
                </p>
              </div>
              <a
                href={`https://www.google.com/maps?q=${c.lat},${c.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-blue-600 hover:underline text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3 inline" /> Cómo llegar
              </a>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
