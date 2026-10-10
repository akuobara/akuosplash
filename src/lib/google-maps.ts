/**
 * Google Maps JS API loader + helpers.
 *
 * Single entry-point: `loadGoogleMaps()` ensures the script is injected once,
 * resolves with the global `google.maps` namespace.
 *
 * Required env: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (browser key with restrictions:
 *   - Maps JavaScript API
 *   - Places API
 *   - Geocoding API
 *   - Directions API
 *   - referer: vercel.app / custom domain)
 */

declare global {
  interface Window {
    google?: any;
    __googleMapsLoader?: Promise<any> | null;
  }
}

export function getGoogleMapsApiKey(): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) {
    if (typeof console !== "undefined") {
      console.warn(
        "[google-maps] Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en variables de entorno."
      );
    }
    return "";
  }
  return key;
}

let loaderPromise: Promise<any> | null = null;

/**
 * Carga el script de Google Maps JS API (una sola vez).
 * Devuelve una promesa que resuelve con `window.google`.
 */
export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadGoogleMaps called on server"));
  }
  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }
  if (window.__googleMapsLoader) {
    return window.__googleMapsLoader;
  }
  if (loaderPromise) {
    return loaderPromise;
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no configurada"));
  }

  // Carga con callback para compatibilidad con `async` + `onload`.
  loaderPromise = new Promise<any>((resolve, reject) => {
    const callbackName = `__gmapsInit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    (window as any)[callbackName] = () => {
      try {
        delete (window as any)[callbackName];
        resolve(window.google);
      } catch (e) {
        reject(e);
      }
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places,geometry,marker,visualization&v=weekly&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      reject(new Error("No se pudo cargar el script de Google Maps"));
    };
    document.head.appendChild(script);
  });

  window.__googleMapsLoader = loaderPromise;
  return loaderPromise;
}

/* ──────────────────────────────────────────────────────────────────── */
/* Geocoding                                                            */
/* ──────────────────────────────────────────────────────────────────── */

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  addressComponents: any[];
}

/**
 * Geocoding: dirección string → coordenadas.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult[]> {
  const google = await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();
  return new Promise<GeocodeResult[]>((resolve, reject) => {
    geocoder.geocode(
      { address, region: "cl", componentRestrictions: { country: "cl" } },
      (results: any[], status: string) => {
        if (status === "OK" && results && results.length > 0) {
          resolve(
            results.map((r) => ({
              lat: r.geometry.location.lat(),
              lng: r.geometry.location.lng(),
              formattedAddress: r.formatted_address,
              addressComponents: r.address_components,
            }))
          );
        } else if (status === "ZERO_RESULTS") {
          resolve([]);
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      }
    );
  });
}

/**
 * Reverse geocoding: coordenadas → dirección.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const google = await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();
  return new Promise<string>((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
      if (status === "OK" && results && results.length > 0) {
        resolve(results[0].formatted_address);
      } else {
        resolve("");
      }
    });
  });
}

/* ──────────────────────────────────────────────────────────────────── */
/* Directions                                                          */
/* ──────────────────────────────────────────────────────────────────── */

export interface DirectionsStop {
  lat: number;
  lng: number;
  label?: string;
}

export interface OptimizedRoute {
  order: number[]; // índices originales en el orden óptimo
  legs: {
    distanceMeters: number;
    durationSeconds: number;
    startAddress: string;
    endAddress: string;
  }[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  route: any; // google.maps.DirectionsResult
}

/**
 * Calcula la ruta óptima pasando por N waypoints.
 * Si `optimize` es true, el servidor reordena los waypoints (excepto origin/destination).
 *
 * Nota: Directions API admite hasta 25 waypoints (incluyendo origin/destination).
 */
export async function getOptimizedRoute(
  origin: DirectionsStop,
  destination: DirectionsStop,
  waypoints: DirectionsStop[],
  optimize = true
): Promise<OptimizedRoute | null> {
  const google = await loadGoogleMaps();
  const service = new google.maps.DirectionsService();

  const wp = waypoints.slice(0, 23).map((w) => ({
    location: new google.maps.LatLng(w.lat, w.lng),
    stopover: true,
  }));

  return new Promise<OptimizedRoute | null>((resolve, reject) => {
    service.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        waypoints: wp,
        optimizeWaypoints: optimize,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        if (status === "OK" && result) {
          const legs = result.routes[0].legs;
          let totalDistance = 0;
          let totalDuration = 0;
          const legInfo = legs.map((leg: any) => {
            totalDistance += leg.distance?.value || 0;
            totalDuration += leg.duration?.value || 0;
            return {
              distanceMeters: leg.distance?.value || 0,
              durationSeconds: leg.duration?.value || 0,
              startAddress: leg.start_address,
              endAddress: leg.end_address,
            };
          });
          const order = result.routes[0].waypoint_order || [];
          resolve({
            order,
            legs: legInfo,
            totalDistanceMeters: totalDistance,
            totalDurationSeconds: totalDuration,
            route: result,
          });
        } else if (status === "ZERO_RESULTS" || status === "NOT_FOUND") {
          resolve(null);
        } else {
          reject(new Error(`Directions failed: ${status}`));
        }
      }
    );
  });
}

/**
 * Genera un deep-link a Google Maps con la ruta completa para abrir en el móvil.
 * Ej: https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...
 * Límite: la URL no debe exceder ~2048 caracteres.
 */
export function buildGoogleMapsDeepLink(
  origin: DirectionsStop | null,
  destination: DirectionsStop,
  waypoints: DirectionsStop[]
): string {
  const fmt = (s: DirectionsStop) => `${s.lat},${s.lng}`;
  const params = new URLSearchParams();
  params.set("api", "1");
  if (origin) params.set("origin", fmt(origin));
  params.set("destination", fmt(destination));
  params.set("travelmode", "driving");
  params.set("dir_action", "navigate");
  if (waypoints.length > 0) {
    // Solo podemos incluir waypoints hasta que la URL calce en ~2000 chars
    const wpStr: string[] = [];
    let total = 800; // margen
    for (const w of waypoints) {
      const s = fmt(w);
      if (total + s.length + 1 > 1900) break;
      wpStr.push(s);
      total += s.length + 1;
    }
    if (wpStr.length > 0) {
      params.set("waypoints", wpStr.join("|"));
    }
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/* ──────────────────────────────────────────────────────────────────── */
/* Formato de distancia / tiempo                                       */
/* ──────────────────────────────────────────────────────────────────── */

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} h ${m} min`;
}

/* ──────────────────────────────────────────────────────────────────── */
/* Geofencing — Haversine                                              */
/* ──────────────────────────────────────────────────────────────────── */

/**
 * Distancia en metros entre dos puntos GPS (Haversine).
 * No requiere Google Maps API — cálculo puro en el browser.
 */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // m
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Pide la ubicación actual del browser. Resuelve con {lat, lng, accuracyMeters}.
 * Rechaza si el browser no soporta geolocation o el usuario la rechaza.
 */
export function getCurrentPosition(): Promise<{
  lat: number;
  lng: number;
  accuracyMeters: number;
}> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Tu navegador no soporta geolocalización"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
        });
      },
      (err) => {
        reject(new Error(err.message || "No se pudo obtener tu ubicación"));
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}

export type GeofenceStatus = "ok" | "near" | "far" | "no_gps" | "error";

export interface GeofenceCheck {
  status: GeofenceStatus;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  message: string;
}

/**
 * Verifica si el chofer está cerca del cliente.
 * - < 100 m → ok (verde)
 * - 100–500 m → near (amarillo)
 * - > 500 m → far (rojo)
 * - cliente sin lat/lng → no_gps
 */
export function evaluateGeofence(
  choferLat: number,
  choferLng: number,
  choferAccuracy: number | null,
  clienteLat: number | null,
  clienteLng: number | null
): GeofenceCheck {
  if (clienteLat == null || clienteLng == null) {
    return {
      status: "no_gps",
      distanceMeters: null,
      accuracyMeters: choferAccuracy,
      message: "El cliente no tiene ubicación GPS registrada. No se puede verificar la llegada.",
    };
  }
  const d = haversineMeters(choferLat, choferLng, clienteLat, clienteLng);
  if (d <= 100) {
    return {
      status: "ok",
      distanceMeters: d,
      accuracyMeters: choferAccuracy,
      message: `Llegada confirmada — a ${Math.round(d)} m del cliente.`,
    };
  }
  if (d <= 500) {
    return {
      status: "near",
      distanceMeters: d,
      accuracyMeters: choferAccuracy,
      message: `Estás a ${Math.round(d)} m del cliente. Si la ubicación registrada no es exacta, podés confirmar de todas formas.`,
    };
  }
  return {
    status: "far",
    distanceMeters: d,
    accuracyMeters: choferAccuracy,
    message: `Estás a ${Math.round(d)} m del cliente registrado. ¿Seguro que es la ubicación correcta?`,
  };
}
