"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, Crosshair, Home, Trash2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { loadGoogleMaps, getDepot, setDepot, getCurrentPosition, type Depot as DepotType } from "@/lib/google-maps";

interface DepotPanelProps {
  /** Namespace para guardar en localStorage (ej: "aljibe", "akuo"). */
  namespace?: string;
  /** Mostrar compacto (sólo botón + info inline). */
  compact?: boolean;
  /** Label del botón */
  buttonLabel?: string;
}

export function DepotPanel({ namespace = "default", compact = false, buttonLabel = "Depot" }: DepotPanelProps) {
  const [open, setOpen] = useState(false);
  const [depot, setDepotState] = useState<DepotType | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [nombreInput, setNombreInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Cargar estado inicial
  useEffect(() => {
    const d = getDepot(namespace);
    setDepotState(d);
    if (d) {
      setLatInput(String(d.lat));
      setLngInput(String(d.lng));
      setNombreInput(d.nombre || "");
    }
    setLoading(false);
  }, [namespace]);

  // Cargar Google Maps (para el botón "Buscar en mapa" futuro)
  useEffect(() => {
    if (ready) return;
    loadGoogleMaps()
      .then(() => setReady(true))
      .catch((e) => setError(e?.message || "No se pudo cargar Google Maps"));
  }, [ready]);

  function guardar() {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng)) {
      toast.error("Lat/lng inválidas");
      return;
    }
    const newDepot: DepotType = { lat, lng, nombre: nombreInput || undefined };
    setDepot(namespace, newDepot);
    setDepotState(newDepot);
    toast.success("Depot guardado");
    setOpen(false);
  }

  function limpiar() {
    setDepot(namespace, null);
    setDepotState(null);
    setLatInput("");
    setLngInput("");
    setNombreInput("");
    toast.info("Depot eliminado");
  }

  async function useMyLocation() {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setLatInput(String(pos.lat));
      setLngInput(String(pos.lng));
      toast.success("Ubicación actual capturada");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo obtener tu ubicación");
    } finally {
      setLocating(false);
    }
  }

  if (loading) {
    return <Loader2 className="h-3 w-3 animate-spin" />;
  }

  if (compact && !open) {
    return (
      <Button
        type="button"
        variant={depot ? "default" : "outline"}
        size="sm"
        onClick={() => setOpen(!open)}
        className="text-xs"
        title={depot ? `Depot: ${depot.nombre || `${depot.lat.toFixed(5)}, ${depot.lng.toFixed(5)}`}` : "Configurar depot"}
      >
        <Home className="h-3 w-3" />
        <span className="ml-1">{depot ? "Depot OK" : buttonLabel}</span>
      </Button>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant={depot ? "default" : "outline"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Home className="h-4 w-4" />
        <span className="ml-1">{depot ? "Depot configurado" : "Configurar depot"}</span>
      </Button>
    );
  }

  return (
    <div className={`rounded-lg border border-border bg-muted/20 p-3 space-y-2 ${compact ? "" : "max-w-md"}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Home className="h-4 w-4 text-primary" /> Depot (punto de partida)
        </p>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          {compact ? "Cerrar" : "Ocultar"}
        </Button>
      </div>

      {error && (
        <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Punto de salida y regreso del camión. Se usa para calcular distancia y tiempo de viaje a cada cliente.
        Se guarda en este navegador (no en la base de datos).
      </p>

      <div className="space-y-2">
        <div className="space-y-1">
          <Label htmlFor="depotNombre" className="text-xs">Nombre (opcional)</Label>
          <Input
            id="depotNombre"
            value={nombreInput}
            onChange={(e) => setNombreInput(e.target.value)}
            placeholder="Ej: Galpón Maipú"
            className="h-8 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="depotLat" className="text-xs">Latitud</Label>
            <Input
              id="depotLat"
              type="number"
              inputMode="decimal"
              step="any"
              value={latInput}
              onChange={(e) => setLatInput(e.target.value)}
              placeholder="-33.4489"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="depotLng" className="text-xs">Longitud</Label>
            <Input
              id="depotLng"
              type="number"
              inputMode="decimal"
              step="any"
              value={lngInput}
              onChange={(e) => setLngInput(e.target.value)}
              placeholder="-70.6693"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={useMyLocation}
            disabled={locating}
          >
            {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3" />}
            <span className="ml-1 text-xs">Mi ubicación actual</span>
          </Button>
          <Button type="button" size="sm" onClick={guardar}>
            Guardar
          </Button>
          {depot && (
            <Button type="button" variant="ghost" size="sm" onClick={limpiar}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {depot && (
          <div className="rounded-md bg-primary/5 border border-primary/20 p-2 text-xs">
            <p className="font-medium text-primary flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Depot actual
            </p>
            <p className="text-muted-foreground tabular-nums">
              {depot.nombre ? `${depot.nombre} — ` : ""}{depot.lat.toFixed(5)}, {depot.lng.toFixed(5)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
