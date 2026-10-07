"use client";

import { useState, useRef, useEffect } from "react";
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
import { Loader2, Search, MapPin, Check } from "lucide-react";
import { toast } from "sonner";

interface MapPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (lat: number, lng: number, displayName: string) => void;
  initialLat?: number | null;
  initialLng?: number | null;
}

interface SearchResult {
  lat: string;
  lon: string;
  display_name: string;
}

// Tipos para Leaflet
declare global {
  interface Window {
    L?: any;
  }
}

export function MapPicker({ open, onOpenChange, onSelect, initialLat, initialLng }: MapPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [lat, setLat] = useState<number | null>(initialLat ?? null);
  const [lng, setLng] = useState<number | null>(initialLng ?? null);
  const [displayName, setDisplayName] = useState("");

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletLoaded = useRef(false);

  // Cargar Leaflet CSS y JS
  useEffect(() => {
    if (leafletLoaded.current) return;
    if (typeof window === "undefined") return;

    // CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // JS
    if (!window.L) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => {
        leafletLoaded.current = true;
      };
      document.head.appendChild(script);
    } else {
      leafletLoaded.current = true;
    }
  }, []);

  // Inicializar mapa cuando el diálogo se abre
  useEffect(() => {
    if (!open || !mapRef.current) return;

    const initMap = () => {
      if (!window.L || !mapRef.current) return;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markerRef.current = null;
      }

      const startLat = lat ?? -33.4489;
      const startLng = lng ?? -70.6693;
      const startZoom = lat != null ? 16 : 11;

      const map = window.L.map(mapRef.current).setView([startLat, startLng], startZoom);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      // Si hay coordenadas iniciales, poner marcador
      if (lat != null && lng != null) {
        markerRef.current = window.L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current.on("dragend", (e: any) => {
          const pos = e.target.getLatLng();
          setLat(pos.lat);
          setLng(pos.lng);
          reverseGeocode(pos.lat, pos.lng);
        });
      }

      // Click en el mapa para colocar marcador
      map.on("click", (e: any) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        setLat(clickLat);
        setLng(clickLng);

        if (markerRef.current) {
          markerRef.current.setLatLng([clickLat, clickLng]);
        } else {
          markerRef.current = window.L.marker([clickLat, clickLng], { draggable: true }).addTo(map);
          markerRef.current.on("dragend", (ev: any) => {
            const pos = ev.target.getLatLng();
            setLat(pos.lat);
            setLng(pos.lng);
            reverseGeocode(pos.lat, pos.lng);
          });
        }
        reverseGeocode(clickLat, clickLng);
      });

      mapInstance.current = map;

      // Forzar recálculo de tamaño
      setTimeout(() => map.invalidateSize(), 200);
    };

    // Esperar a que Leaflet cargue
    if (window.L) {
      initMap();
    } else {
      const interval = setInterval(() => {
        if (window.L) {
          clearInterval(interval);
          initMap();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [open]);

  // Cleanup al cerrar
  useEffect(() => {
    if (!open && mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
      markerRef.current = null;
    }
  }, [open]);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setLat(initialLat ?? null);
      setLng(initialLng ?? null);
      setDisplayName("");
      setResults([]);
      setQuery("");
    }
  }, [open, initialLat, initialLng]);

  // Mover el mapa cuando cambian las coordenadas por búsqueda
  function flyTo(newLat: number, newLng: number) {
    setLat(newLat);
    setLng(newLng);
    if (mapInstance.current && window.L) {
      mapInstance.current.setView([newLat, newLng], 16);
      if (markerRef.current) {
        markerRef.current.setLatLng([newLat, newLng]);
      } else {
        markerRef.current = window.L.marker([newLat, newLng], { draggable: true }).addTo(mapInstance.current);
        markerRef.current.on("dragend", (e: any) => {
          const pos = e.target.getLatLng();
          setLat(pos.lat);
          setLng(pos.lng);
          reverseGeocode(pos.lat, pos.lng);
        });
      }
    }
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=cl`,
        { headers: { "Accept-Language": "es" } }
      );
      const data = await res.json();
      if (data.length === 0) {
        toast.error("No se encontraron resultados. Prueba con otra dirección.");
        setSearching(false);
        return;
      }
      setResults(data);
    } catch {
      toast.error("No se pudo buscar. Verifica tu conexión.");
    } finally {
      setSearching(false);
    }
  }

  function selectResult(r: SearchResult) {
    const newLat = parseFloat(r.lat);
    const newLng = parseFloat(r.lon);
    setDisplayName(r.display_name);
    flyTo(newLat, newLng);
    setResults([]);
  }

  // Búsqueda inversa: de coordenadas a dirección
  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`,
        { headers: { "Accept-Language": "es" } }
      );
      const data = await res.json();
      if (data.display_name) {
        setDisplayName(data.display_name);
      }
    } catch {
      // Si falla, no pasa nada
    }
  }

  function confirm() {
    if (lat != null && lng != null) {
      onSelect(lat, lng, displayName);
      onOpenChange(false);
    } else {
      toast.error("Haz clic en el mapa para marcar la ubicación");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ubicación del cliente</DialogTitle>
          <DialogDescription>
            Haz clic en el mapa para marcar la ubicación. También puedes buscar por dirección o arrastrar el marcador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Buscador */}
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Buscar: Los Aromos 123, Maipú"
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searching} size="sm">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {/* Resultados */}
          {results.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded-lg border border-border">
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectResult(r)}
                  className="flex w-full items-start gap-2 p-2 text-left text-sm hover:bg-muted/40"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="line-clamp-2">{r.display_name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Mapa interactivo */}
          <div
            ref={mapRef}
            className="h-72 w-full rounded-lg border border-border"
            style={{ zIndex: 0 }}
          />

          {/* Coordenadas actuales */}
          {lat != null && lng != null ? (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-2 text-center text-xs space-y-1">
              <p className="font-medium text-primary flex items-center justify-center gap-1">
                <MapPin className="h-3 w-3" /> Ubicación marcada
              </p>
              <p className="text-muted-foreground tabular-nums">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </p>
              {displayName && (
                <p className="text-muted-foreground line-clamp-2">{displayName}</p>
              )}
              <a
                href={`https://www.google.com/maps?q=${lat},${lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Ver en Google Maps
              </a>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
              Haz clic en el mapa para marcar la ubicación del cliente
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={lat == null}>
            <Check className="mr-1 h-4 w-4" /> Guardar ubicación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
