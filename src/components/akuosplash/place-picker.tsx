"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Store, Phone, MapPin, Clock, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { loadGoogleMaps } from "@/lib/google-maps";
import type { PlaceDetails } from "./address-autocomplete";

interface PlacePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (place: PlacePickerResult) => void;
  initialQuery?: string;
}

export interface PlacePickerResult extends PlaceDetails {
  phone?: string;
  internationalPhone?: string;
  website?: string;
  url?: string;
  openingHours?: string[];
  weekdayDescriptions?: string[];
  photos?: string[];
  rating?: number;
  userRatingsTotal?: number;
  businessStatus?: string;
}

export function PlacePicker({ open, onOpenChange, onSelect, initialQuery }: PlacePickerProps) {
  const [query, setQuery] = useState(initialQuery || "");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [placeDetails, setPlaceDetails] = useState<any>(null);

  const placesServiceRef = useRef<any>(null);

  // Cargar Google Maps
  useEffect(() => {
    if (googleReady) return;
    if (typeof window === "undefined") return;
    let cancelled = false;
    setLoading(true);
    loadGoogleMaps()
      .then(() => {
        if (cancelled) return;
        setGoogleReady(true);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || "No se pudo cargar Google Maps");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [googleReady]);

  // Inicializar PlacesService cuando abre
  useEffect(() => {
    if (!open || !googleReady) return;
    if (!placesServiceRef.current && (window as any).google?.maps?.places) {
      // Use a dummy map for the service (Place service needs a map attribute to be attached, but findPlaceFromQuery works without one)
      const dummyDiv = document.createElement("div");
      const dummyMap = new (window as any).google.maps.Map(dummyDiv, { center: { lat: 0, lng: 0 }, zoom: 1 });
      placesServiceRef.current = new (window as any).google.maps.places.PlacesService(dummyMap);
    }
  }, [open, googleReady]);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setQuery(initialQuery || "");
      setResults([]);
      setSelected(null);
      setPhotoUrls([]);
      setPlaceDetails(null);
      setError(null);
    }
  }, [open, initialQuery]);

  // Buscar negocios por nombre
  async function handleSearch() {
    if (!query.trim()) return;
    if (!placesServiceRef.current) {
      toast.error("Google Places aún se está cargando.");
      return;
    }
    setSearching(true);
    setResults([]);
    setSelected(null);
    setPhotoUrls([]);
    setPlaceDetails(null);
    try {
      const request = {
        query: query.trim(),
        fields: ["name", "formatted_address", "geometry", "place_id", "rating", "user_ratings_total", "business_status", "icon"],
        componentRestrictions: { country: "cl" },
      };
      placesServiceRef.current.findPlaceFromQuery(request, (places: any[], status: string) => {
        setSearching(false);
        if (status === "OK" && places && places.length > 0) {
          setResults(places);
          // Auto-seleccionar el primero si es único
          if (places.length === 1) {
            selectPlace(places[0]);
          }
        } else if (status === "ZERO_RESULTS") {
          toast.error("No se encontraron negocios con ese nombre. Probá con otro.");
        } else {
          toast.error(`Error en búsqueda: ${status}`);
        }
      });
    } catch (e: any) {
      setSearching(false);
      toast.error(e?.message || "No se pudo buscar");
    }
  }

  // Seleccionar un lugar de la lista y traer los detalles (fotos, teléfono, etc.)
  async function selectPlace(place: any) {
    if (!place?.place_id || !placesServiceRef.current) {
      // Sin place_id, usar lo que ya tenemos
      setSelected(place);
      return;
    }
    setSelected(place);
    setFetchingDetails(true);
    setPhotoUrls([]);
    setPlaceDetails(null);
    try {
      const request = {
        placeId: place.place_id,
        fields: [
          "name",
          "formatted_address",
          "geometry",
          "address_components",
          "international_phone_number",
          "formatted_phone_number",
          "website",
          "url",
          "opening_hours",
          "photos",
          "rating",
          "user_ratings_total",
          "business_status",
          "place_id",
        ],
      };
      placesServiceRef.current.getDetails(request, (placeDetail: any, status: string) => {
        setFetchingDetails(false);
        if (status === "OK" && placeDetail) {
          setPlaceDetails(placeDetail);
          // Foto URLs
          const urls = (placeDetail.photos || []).slice(0, 4).map((p: any) => {
            try {
              return p.getUrl({ maxWidth: 400, maxHeight: 300 });
            } catch {
              return null;
            }
          }).filter((u: any) => !!u);
          setPhotoUrls(urls);
        } else {
          // No falla el flujo si no hay detalles
        }
      });
    } catch (e: any) {
      setFetchingDetails(false);
    }
  }

  function confirmar() {
    if (!selected) return;
    const detail = placeDetails || {};
    const components = detail.address_components || selected.address_components || [];
    const get = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name;

    const result: PlacePickerResult = {
      lat: detail.geometry?.location?.lat() ?? selected.geometry?.location?.lat() ?? 0,
      lng: detail.geometry?.location?.lng() ?? selected.geometry?.location?.lng() ?? 0,
      formattedAddress: detail.formatted_address || selected.formatted_address || "",
      streetNumber: get("street_number"),
      route: get("route"),
      locality: get("locality") || get("administrative_area_level_3"),
      sublocality: get("sublocality") || get("sublocality_level_1"),
      administrativeAreaLevel2: get("administrative_area_level_2"),
      postalCode: get("postal_code"),
      country: get("country"),
      name: detail.name || selected.name || "",
      placeId: selected.place_id || detail.place_id,
      addressComponents: components,
      phone: detail.formatted_phone_number,
      internationalPhone: detail.international_phone_number,
      website: detail.website,
      url: detail.url,
      weekdayDescriptions: detail.opening_hours?.weekday_text,
      photos: photoUrls,
      rating: detail.rating ?? selected.rating,
      userRatingsTotal: detail.user_ratings_total ?? selected.user_ratings_total,
      businessStatus: detail.business_status ?? selected.business_status,
    };
    onSelect(result);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[95vw] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" /> Buscar negocio
          </DialogTitle>
          <DialogDescription>
            Buscá un negocio por su nombre (restaurant, oficina, colegio, etc.). Google devuelve dirección, teléfono, horarios y foto del local.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" /> {error}
            </p>
          </div>
        )}

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
              placeholder="Ej: Restaurant La Picá, Maipú"
              className="flex-1"
              disabled={searching || loading}
            />
            <Button onClick={handleSearch} disabled={searching || loading} size="sm">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {loading && (
            <p className="text-xs text-muted-foreground text-center">
              <Loader2 className="inline mr-1 h-3 w-3 animate-spin" /> Cargando Google Maps...
            </p>
          )}

          {/* Resultados de búsqueda (lista) */}
          {results.length > 1 && !selected && (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
              {results.map((p, i) => (
                <button
                  key={p.place_id || i}
                  type="button"
                  onClick={() => selectPlace(p)}
                  className="flex w-full items-start gap-3 p-3 text-left hover:bg-muted/30"
                >
                  <Store className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    {p.formatted_address && (
                      <p className="text-xs text-muted-foreground truncate">{p.formatted_address}</p>
                    )}
                    {p.rating != null && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">★ {p.rating} ({p.user_ratings_total} reseñas)</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Detalle del lugar seleccionado */}
          {selected && (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-base">{placeDetails?.name || selected.name}</p>
                  {placeDetails?.formatted_address || selected.formatted_address ? (
                    <p className="text-sm text-muted-foreground flex items-start gap-1 mt-1">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{placeDetails?.formatted_address || selected.formatted_address}</span>
                    </p>
                  ) : null}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  Cambiar
                </Button>
              </div>

              {fetchingDetails ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Obteniendo detalles del negocio...
                </p>
              ) : (
                <div className="space-y-2 text-sm">
                  {(placeDetails?.international_phone_number || placeDetails?.formatted_phone_number) && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      <a
                        href={`tel:${placeDetails?.international_phone_number || placeDetails?.formatted_phone_number}`}
                        className="text-primary hover:underline"
                      >
                        {placeDetails?.international_phone_number || placeDetails?.formatted_phone_number}
                      </a>
                    </p>
                  )}
                  {placeDetails?.website && (
                    <p className="flex items-center gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5 text-primary" />
                      <a
                        href={placeDetails.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate"
                      >
                        {placeDetails.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    </p>
                  )}
                  {placeDetails?.opening_hours?.weekday_text && placeDetails.opening_hours.weekday_text.length > 0 && (
                    <details className="rounded-md border border-border">
                      <summary className="cursor-pointer p-2 text-xs font-medium flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-primary" /> Horarios
                      </summary>
                      <ul className="px-3 pb-2 text-xs space-y-0.5 text-muted-foreground">
                        {placeDetails.opening_hours.weekday_text.map((d: string, i: number) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {placeDetails?.rating != null && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      ★ {placeDetails.rating} ({placeDetails.user_ratings_total} reseñas)
                    </p>
                  )}
                  {placeDetails?.business_status && placeDetails.business_status !== "OPERATIONAL" && (
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                      Estado: {placeDetails.business_status}
                    </p>
                  )}
                </div>
              )}

              {/* Galería de fotos */}
              {photoUrls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {photoUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Foto ${i + 1}`}
                      className="aspect-square w-full rounded-md object-cover border border-border"
                      loading="lazy"
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!selected || fetchingDetails}>
            <Store className="mr-1 h-4 w-4" /> Autocompletar datos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
