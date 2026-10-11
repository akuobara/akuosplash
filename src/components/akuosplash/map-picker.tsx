"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, Check, Crosshair, Search } from "lucide-react";
import { toast } from "sonner";

interface MapPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (lat: number, lng: number, displayName: string) => void;
  initialLat?: number | null;
  initialLng?: number | null;
}

export function MapPicker({ open, onOpenChange, onSelect, initialLat, initialLng }: MapPickerProps) {
  const [lat, setLat] = useState<string>(initialLat != null ? String(initialLat) : "");
  const [lng, setLng] = useState<string>(initialLng != null ? String(initialLng) : "");
  const [locating, setLocating] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<{ lat: number; lng: number; address: string }[]>([]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  useEffect(() => {
    if (open) {
      setLat(initialLat != null ? String(initialLat) : "");
      setLng(initialLng != null ? String(initialLng) : "");
      setBusqueda("");
      setResultados([]);
    }
  }, [open, initialLat, initialLng]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        toast.success("Ubicación capturada");
      },
      (err) => {
        setLocating(false);
        toast.error("No se pudo obtener tu ubicación: " + (err.message || ""));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  // Buscar dirección con Google Geocoding API
  async function buscarDireccion() {
    if (!busqueda.trim()) return;
    if (!apiKey) {
      toast.error("API key de Google Maps no configurada");
      return;
    }
    setBuscando(true);
    setResultados([]);
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(busqueda)}&components=country:CL&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "OK" && data.results?.length > 0) {
        const mapped = data.results.map((r: any) => ({
          lat: r.geometry.location.lat,
          lng: r.geometry.location.lng,
          address: r.formatted_address,
        }));
        setResultados(mapped);
        // Auto-seleccionar el primer resultado
        if (mapped.length > 0) {
          setLat(String(mapped[0].lat));
          setLng(String(mapped[0].lng));
        }
      } else {
        toast.error("No se encontró la dirección. Probá con otra.");
      }
    } catch (e: any) {
      toast.error("Error al buscar: " + (e?.message || ""));
    } finally {
      setBuscando(false);
    }
  }

  function confirm() {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      toast.error("Latitud o longitud inválida");
      return;
    }
    onSelect(latNum, lngNum, `${latNum.toFixed(5)}, ${lngNum.toFixed(5)}`);
    onOpenChange(false);
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const hasCoords = !isNaN(latNum) && !isNaN(lngNum);
  const mapUrl = hasCoords
    ? `https://maps.googleapis.com/maps/api/staticmap?key=${apiKey}&center=${latNum},${lngNum}&zoom=16&size=600x300&markers=color:blue|${latNum},${lngNum}&scale=2`
    : `https://maps.googleapis.com/maps/api/staticmap?key=${apiKey}&center=-33.4489,-70.6693&zoom=11&size=600x300&scale=2`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle>Ubicación del cliente</DialogTitle>
          <DialogDescription>
            Buscá la dirección, usá tu GPS si estás en el lugar, o ingresá las coordenadas manualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Buscador de dirección */}
          <div className="flex gap-2">
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarDireccion(); } }}
              placeholder="Ej: Av Las Hualtatas 123, Las Condes"
              className="flex-1"
            />
            <Button onClick={buscarDireccion} disabled={buscando} size="sm">
              {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {/* Resultados de búsqueda */}
          {resultados.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-lg border border-border">
              {resultados.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setLat(String(r.lat)); setLng(String(r.lng)); setResultados([]); }}
                  className="flex w-full items-start gap-2 p-2 text-left text-sm hover:bg-muted/40"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="line-clamp-2">{r.address}</span>
                </button>
              ))}
            </div>
          )}

          {/* Botón GPS */}
          <Button onClick={useMyLocation} disabled={locating} variant="outline" className="w-full">
            {locating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Obteniendo ubicación...</>
            ) : (
              <><Crosshair className="mr-2 h-4 w-4" /> Usar mi ubicación actual (GPS)</>
            )}
          </Button>

          {/* Preview del mapa */}
          <img
            src={mapUrl}
            alt="Ubicación"
            style={{ width: "100%", height: "auto", borderRadius: "8px", border: "1px solid #e5e7eb", display: "block" }}
          />

          {/* Coordenadas manuales */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="lat" className="text-xs">Latitud</Label>
              <Input id="lat" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-33.4489" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lng" className="text-xs">Longitud</Label>
              <Input id="lng" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-70.6693" />
            </div>
          </div>

          {hasCoords && (
            <a
              href={`https://www.google.com/maps?q=${latNum},${lngNum}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <MapPin className="h-4 w-4" /> Ver en Google Maps
            </a>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={!hasCoords}>
            <Check className="mr-1 h-4 w-4" /> Guardar ubicación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
