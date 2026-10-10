"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
import { Loader2, Search, MapPin, Check, Crosshair, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { loadGoogleMaps, reverseGeocode } from "@/lib/google-maps";

interface MapPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (lat: number, lng: number, displayName: string) => void;
  initialLat?: number | null;
  initialLng?: number | null;
}

interface PlaceResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export function MapPicker({ open, onOpenChange, onSelect, initialLat, initialLng }: MapPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [lat, setLat] = useState<number | null>(initialLat ?? null);
  const [lng, setLng] = useState<number | null>(initialLng ?? null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const googleLoaded = useRef(false);
  const listenersRef = useRef<any[]>([]);

  // Inicializar Google Maps script
  useEffect(() => {
    if (googleLoaded.current) return;
    if (typeof window === "undefined") return;
    let cancelled = false;
    setLoading(true);
    loadGoogleMaps()
      .then(() => {
        if (cancelled) return;
        googleLoaded.current = true;
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || "No se pudo cargar Google Maps");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Init map cuando el dialog abre
  const initMap = useCallback(() => {
    if (!window.google?.maps || !mapRef.current) return;
    if (mapInstance.current) {
      // Limpieza previa
      listenersRef.current.forEach((l) => {
        try { window.google.maps.event.removeListener(l); } catch {}
      });
      listenersRef.current = [];
      window.google.maps.event.clearInstanceListeners(mapInstance.current);
      mapInstance.current = null;
      markerRef.current = null;
    }

    const startLat = lat ?? -33.4489;
    const startLng = lng ?? -70.6693;
    const startZoom = lat != null ? 16 : 11;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: startLat, lng: startLng },
      zoom: startZoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: "greedy",
    });
    mapInstance.current = map;

    // Marcador inicial
    if (lat != null && lng != null) {
      markerRef.current = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        draggable: true,
        animation: window.google.maps.Animation.DROP,
      });
      listenersRef.current.push(
        window.google.maps.event.addListener(markerRef.current, "dragend", (e: any) => {
          if (e?.latLng) {
            const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            setLat(p.lat);
            setLng(p.lng);
            reverseGeocode(p.lat, p.lng).then(setDisplayName);
          }
        })
      );
    }

    // Click en mapa para mover/crear marker
    listenersRef.current.push(
      window.google.maps.event.addListener(map, "click", (e: any) => {
        if (e?.latLng) {
          const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          setLat(p.lat);
          setLng(p.lng);
          if (markerRef.current) {
            markerRef.current.setPosition(p);
          } else {
            markerRef.current = new window.google.maps.Marker({
              position: p,
              map,
              draggable: true,
            });
            listenersRef.current.push(
              window.google.maps.event.addListener(markerRef.current, "dragend", (ev: any) => {
                if (ev?.latLng) {
                  const q = { lat: ev.latLng.lat(), lng: ev.latLng.lng() };
                  setLat(q.lat);
                  setLng(q.lng);
                  reverseGeocode(q.lat, q.lng).then(setDisplayName);
                }
              })
            );
          }
          reverseGeocode(p.lat, p.lng).then(setDisplayName);
        }
      })
    );

    // Places Autocomplete en el input de búsqueda
    if (searchInputRef.current && !autocompleteRef.current) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(searchInputRef.current, {
        types: ["geocode"],
        componentRestrictions: { country: "cl" },
        fields: ["formatted_address", "geometry", "name", "place_id"],
      });
      listenersRef.current.push(
        window.google.maps.event.addListener(autocompleteRef.current, "place_changed", () => {
          const place = autocompleteRef.current.getPlace();
          if (!place?.geometry?.location) {
            return;
          }
          const p = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };
          setLat(p.lat);
          setLng(p.lng);
          setDisplayName(place.formatted_address || place.name || "");
          setShowResults(false);
          flyTo(p.lat, p.lng);
        })
      );
      // Crear Places Service para text-search
      placesServiceRef.current = new window.google.maps.places.PlacesService(map);
    }

    // Forzar recálculo de tamaño (Dialog anim)
    setTimeout(() => {
      if (mapInstance.current) {
        window.google.maps.event.trigger(mapInstance.current, "resize");
      }
    }, 250);
  }, [lat, lng]);

  useEffect(() => {
    if (!open) return;
    if (!window.google?.maps) {
      // esperar a que cargue
      const interval = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(interval);
          initMap();
        }
      }, 200);
      return () => clearInterval(interval);
    }
    initMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cleanup al cerrar
  useEffect(() => {
    if (!open && mapInstance.current) {
      try {
        listenersRef.current.forEach((l) => {
          try { window.google?.maps?.event?.removeListener(l); } catch {}
        });
        listenersRef.current = [];
        if (window.google?.maps?.event) {
          window.google.maps.event.clearInstanceListeners(mapInstance.current);
        }
      } catch {}
      mapInstance.current = null;
      markerRef.current = null;
      autocompleteRef.current = null;
      placesServiceRef.current = null;
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
      setShowResults(false);
    }
  }, [open, initialLat, initialLng]);

  // Mover el mapa cuando cambian las coordenadas por búsqueda
  function flyTo(newLat: number, newLng: number) {
    setLat(newLat);
    setLng(newLng);
    if (mapInstance.current && window.google?.maps) {
      mapInstance.current.panTo({ lat: newLat, lng: newLng });
      mapInstance.current.setZoom(16);
      if (markerRef.current) {
        markerRef.current.setPosition({ lat: newLat, lng: newLng });
      } else {
        markerRef.current = new window.google.maps.Marker({
          position: { lat: newLat, lng: newLng },
          map: mapInstance.current,
          draggable: true,
        });
        listenersRef.current.push(
          window.google.maps.event.addListener(markerRef.current, "dragend", (e: any) => {
            if (e?.latLng) {
              const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
              setLat(p.lat);
              setLng(p.lng);
              reverseGeocode(p.lat, p.lng).then(setDisplayName);
            }
          })
        );
      }
    }
  }

  // Búsqueda por texto (Places API findPlaceFromInput no está en JS API; usamos findPlaceFromQuery)
  async function handleSearch() {
    if (!query.trim()) return;
    if (!window.google?.maps?.places) {
      toast.error("Google Maps aún se está cargando. Intenta de nuevo en 2 segundos.");
      return;
    }
    setSearching(true);
    setShowResults(true);
    setResults([]);
    try {
      const service = new window.google.maps.places.PlacesService(mapInstance.current);
      const request = {
        query,
        fields: ["formatted_address", "geometry", "name", "place_id"],
        componentRestrictions: { country: "cl" },
      };
      service.findPlaceFromQuery(request as any, (places: any[], status: string) => {
        if (status === "OK" && places && places.length > 0) {
          const mapped: PlaceResult[] = places.map((p) => ({
            lat: p.geometry.location.lat(),
            lng: p.geometry.location.lng(),
            formattedAddress: p.formatted_address || p.name,
          }));
          // Si solo hay 1 resultado, saltar directo
          if (mapped.length === 1) {
            const r = mapped[0];
            setDisplayName(r.formattedAddress);
            flyTo(r.lat, r.lng);
            setShowResults(false);
          } else {
            setResults(mapped);
          }
        } else {
          toast.error("No se encontraron resultados. Prueba con otra dirección.");
          setShowResults(false);
        }
        setSearching(false);
      });
    } catch (e: any) {
      toast.error("No se pudo buscar: " + (e?.message || ""));
      setSearching(false);
    }
  }

  function selectResult(r: PlaceResult) {
    setDisplayName(r.formattedAddress);
    flyTo(r.lat, r.lng);
    setResults([]);
    setShowResults(false);
  }

  // Usar geolocation del browser
  function useMyLocation() {
    if (!navigator?.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLat(p.lat);
        setLng(p.lng);
        flyTo(p.lat, p.lng);
        reverseGeocode(p.lat, p.lng).then((addr) => {
          if (addr) setDisplayName(addr);
        });
        toast.success("Ubicación actual marcada");
      },
      (err) => {
        setLocating(false);
        toast.error("No se pudo obtener tu ubicación: " + (err.message || ""));
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
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
            Busca la dirección, haz clic en el mapa, o usa "Mi ubicación" si estás en el lugar.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" /> {error}
            </p>
            <p className="mt-1 text-xs">
              Verifica que la API key <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> esté configurada.
            </p>
          </div>
        ) : null}

        <div className="space-y-3">
          {/* Buscador con Autocomplete */}
          <div className="flex gap-2">
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Escribe: Av Las Hualtatas 123, Las Condes"
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searching || loading} size="sm">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
            <Button
              onClick={useMyLocation}
              disabled={locating || loading}
              size="sm"
              variant="outline"
              title="Usar mi ubicación actual"
            >
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
            </Button>
          </div>

          {/* Resultados */}
          {showResults && results.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectResult(r)}
                  className="flex w-full items-start gap-2 p-2 text-left text-sm hover:bg-muted/40"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="line-clamp-2">{r.formattedAddress}</span>
                </button>
              ))}
            </div>
          )}

          {/* Mapa interactivo */}
          <div
            ref={mapRef}
            className="h-80 w-full rounded-lg border border-border"
            style={{ zIndex: 0 }}
          >
            {loading && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando Google Maps...
              </div>
            )}
          </div>

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
          <Button onClick={confirm} disabled={lat == null || loading}>
            <Check className="mr-1 h-4 w-4" /> Guardar ubicación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
