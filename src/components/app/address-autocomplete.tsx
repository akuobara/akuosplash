"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, AlertTriangle } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps";

export interface PlaceDetails {
  lat: number;
  lng: number;
  formattedAddress: string;
  streetNumber?: string;
  route?: string; // street name
  locality?: string; // comuna / city
  sublocality?: string; // barrio
  administrativeAreaLevel2?: string; // provincia / region (Chile: Región Metropolitana)
  postalCode?: string;
  country?: string;
  phone?: string;
  name?: string;
  placeId?: string;
  addressComponents: any[];
}

interface AddressAutocompleteProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onSelect?: (place: PlaceDetails) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Render extra actions after the input (e.g. "Buscar en mapa" button). */
  trailing?: ReactNode;
  label?: string;
  required?: boolean;
}

/**
 * Input de dirección con Google Places Autocomplete adjunto.
 *
 * Cuando el usuario selecciona una sugerencia, se llama a `onSelect` con los
 * componentes parseados de la dirección (calle, número, comuna, etc.) para
 * que el formulario pueda autocompletar otros campos (lat/lng, zona, etc.).
 *
 * El `value`/`onChange` siguen funcionando como Input normal si el usuario
 * no usa el autocomplete.
 */
export function AddressAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  disabled,
  trailing,
  label,
  required,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const listenersRef = useRef<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Cargar Google Maps
  useEffect(() => {
    if (ready) return;
    if (typeof window === "undefined") return;
    let cancelled = false;
    setLoading(true);
    loadGoogleMaps()
      .then(() => {
        if (cancelled) return;
        setReady(true);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || "No se pudo cargar Google Maps");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [ready]);

  // Attaching Autocomplete al input
  useEffect(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return;
    const google = (window as any).google;
    if (!google?.maps?.places) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["geocode"], // addresses only (no businesses)
      componentRestrictions: { country: "cl" },
      fields: [
        "formatted_address",
        "geometry",
        "address_components",
        "place_id",
        "name",
      ],
    });

    listenersRef.current.push(
      google.maps.event.addListener(autocompleteRef.current, "place_changed", () => {
        const place = autocompleteRef.current.getPlace();
        if (!place || !place.geometry?.location) return;

        const components = place.address_components || [];
        const get = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name;
        const getShort = (type: string) => components.find((c: any) => c.types.includes(type))?.short_name;

        const details: PlaceDetails = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          formattedAddress: place.formatted_address || "",
          streetNumber: get("street_number"),
          route: get("route"),
          locality: get("locality") || get("administrative_area_level_3"),
          sublocality: get("sublocality") || get("sublocality_level_1"),
          administrativeAreaLevel2: get("administrative_area_level_2"),
          postalCode: get("postal_code"),
          country: get("country"),
          name: place.name,
          placeId: place.place_id,
          addressComponents: components,
        };
        // silence unused
        void getShort;

        if (onSelect) {
          onSelect(details);
        }
        if (place.formatted_address) {
          onChange(place.formatted_address);
        }
      })
    );

    return () => {
      listenersRef.current.forEach((l) => {
        try { google.maps.event.removeListener(l); } catch {}
      });
      listenersRef.current = [];
      autocompleteRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="flex items-center gap-1 text-sm font-medium">
          <MapPin className="h-4 w-4 text-primary" />
          {label}
          {required && <span className="text-destructive">*</span>}
        </label>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            id={id}
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || "Ej: Av Las Hualtatas 123, Las Condes"}
            className={className}
            disabled={disabled || loading}
          />
          {loading && (
            <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        {trailing}
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </p>
      )}
      {!error && ready && (
        <p className="text-xs text-muted-foreground">
          Escribí la dirección y seleccioná una sugerencia de Google para autocompletar ubicación y zona.
        </p>
      )}
    </div>
  );
}
