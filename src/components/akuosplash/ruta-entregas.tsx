"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Navigation, ExternalLink, MapPin, AlertTriangle, RefreshCw, Home, Smartphone, Copy, QrCode } from "lucide-react";
import { toast } from "sonner";
import {
  loadGoogleMaps,
  getOptimizedRoute,
  getDistancesFromOrigin,
  buildGoogleMapsDeepLink,
  getDepot,
  formatDistance,
  formatDuration,
  type DirectionsStop,
  type Depot as DepotType,
} from "@/lib/google-maps";
import { DepotPanel } from "./depot-panel";
import { ShareRouteButton } from "./share-route-button";

export interface RutaEntregaStop {
  id: string;
  nombre: string;
  direccion?: string | null;
  lat: number | null;
  lng: number | null;
  litros?: number | null;
  total?: number | null;
  metodoPago?: string | null;
  estadoPago?: string | null;
  clienteId?: string | null;
}

interface RutaEntregasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Paradas de la ruta. Si viene `origen`, el primer elemento es el destino final. */
  paradas: RutaEntregaStop[];
  /** Origen opcional (depósito/casa del chofer). Si no se especifica, se usa la primera parada. */
  origen?: { lat: number; lng: number; nombre?: string } | null;
  titulo?: string;
  /** Función que se llama cuando el usuario quiere ver el detalle de una parada */
  onSelectParada?: (parada: RutaEntregaStop) => void;
}

export function RutaEntregas({
  open,
  onOpenChange,
  paradas,
  origen,
  titulo = "Ruta óptima de entregas",
  onSelectParada,
}: RutaEntregasProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [route, setRoute] = useState<Awaited<ReturnType<typeof getOptimizedRoute>> | null>(null);
  const [reordenadas, setReordenadas] = useState<RutaEntregaStop[]>([]);
  const [optimizando, setOptimizando] = useState(false);
  const [depot, setDepotState] = useState<DepotType | null>(null);
  const [depotDistances, setDepotDistances] = useState<{
    toFirst: { distanceText: string | null; durationText: string | null; distanceMeters: number | null; durationSeconds: number | null } | null;
    fromLast: { distanceText: string | null; durationText: string | null; distanceMeters: number | null; durationSeconds: number | null } | null;
  }>({ toFirst: null, fromLast: null });

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const listenersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const depotMarkerRef = useRef<any>(null);

  // Filtrar paradas con GPS
  const paradasValidas = useMemo(
    () => paradas.filter((p) => p.lat != null && p.lng != null),
    [paradas]
  );
  const sinGps = paradas.length - paradasValidas.length;

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

  // Calcular la ruta óptima
  const calcularRuta = useCallback(async () => {
    if (!googleReady) return;
    if (paradasValidas.length < 2) {
      setRoute(null);
      setReordenadas(paradasValidas);
      return;
    }
    setOptimizando(true);
    setError(null);
    try {
      // Origen: explícito o primera parada
      // Destino: última parada (si hay origen) o última parada
      // Waypoints: las del medio
      let originStop: DirectionsStop;
      let destinationStop: DirectionsStop;
      let waypoints: DirectionsStop[];

      if (origen) {
        originStop = { lat: origen.lat, lng: origen.lng, label: origen.nombre };
        destinationStop = {
          lat: paradasValidas[paradasValidas.length - 1].lat!,
          lng: paradasValidas[paradasValidas.length - 1].lng!,
          label: paradasValidas[paradasValidas.length - 1].nombre,
        };
        waypoints = paradasValidas.slice(0, -1).map((p) => ({
          lat: p.lat!,
          lng: p.lng!,
          label: p.nombre,
        }));
      } else {
        // Sin origen explícito: la primera parada es el origen, la última es destino, las del medio son waypoints
        originStop = { lat: paradasValidas[0].lat!, lng: paradasValidas[0].lng!, label: paradasValidas[0].nombre };
        destinationStop = {
          lat: paradasValidas[paradasValidas.length - 1].lat!,
          lng: paradasValidas[paradasValidas.length - 1].lng!,
          label: paradasValidas[paradasValidas.length - 1].nombre,
        };
        waypoints = paradasValidas.slice(1, -1).map((p) => ({
          lat: p.lat!,
          lng: p.lng!,
          label: p.nombre,
        }));
      }

      const result = await getOptimizedRoute(originStop, destinationStop, waypoints, true);
      setRoute(result);
      // Reordenar paradas según el orden óptimo devuelto por Google
      if (result?.order && result.order.length > 0) {
        // result.order[i] es el índice en `waypoints` (los del medio) del waypoint que corresponde a la posición i.
        // El orden final es: origin, waypoints[order[0]], waypoints[order[1]], ..., destination
        if (origen) {
          const optimas: RutaEntregaStop[] = [
            // origen virtual — no lo metemos en la lista de paradas reales
            ...result.order.map((idx) => paradasValidas[idx]),
            paradasValidas[paradasValidas.length - 1],
          ];
          setReordenadas(optimas);
        } else {
          // Sin origen explícito: origin es paradasValidas[0], waypoints = slice(1,-1)
          const middleWaypoints = paradasValidas.slice(1, -1);
          const optimas: RutaEntregaStop[] = [
            paradasValidas[0],
            ...result.order.map((idx) => middleWaypoints[idx]),
            paradasValidas[paradasValidas.length - 1],
          ];
          setReordenadas(optimas);
        }
      } else {
        setReordenadas(paradasValidas);
      }
    } catch (e: any) {
      console.error("[ruta-entregas] error calculando ruta:", e);
      setError(e?.message || "No se pudo calcular la ruta");
      setReordenadas(paradasValidas);
    } finally {
      setOptimizando(false);
    }
  }, [googleReady, paradasValidas, origen]);

  // Limpiar listeners + markers
  const cleanup = useCallback(() => {
    const google = (window as any).google;
    if (!google?.maps) return;
    listenersRef.current.forEach((l) => {
      try { google.maps.event.removeListener(l); } catch {}
    });
    listenersRef.current = [];
    markersRef.current.forEach((m) => {
      try { m.setMap(null); } catch {}
    });
    markersRef.current = [];
    if (directionsRendererRef.current) {
      try { directionsRendererRef.current.setMap(null); } catch {}
      directionsRendererRef.current = null;
    }
    if (infoWindowRef.current) {
      try { infoWindowRef.current.close(); } catch {}
      infoWindowRef.current = null;
    }
    if (depotMarkerRef.current) {
      try { depotMarkerRef.current.setMap(null); } catch {}
      depotMarkerRef.current = null;
    }
  }, []);

  // Renderizar la ruta en el mapa
  useEffect(() => {
    if (!open || !googleReady || !mapRef.current) return;
    if (!route?.route) return;

    cleanup();

    const google = (window as any).google;
    if (!mapInstance.current) {
      mapInstance.current = new google.maps.Map(mapRef.current, {
        zoom: 12,
        center: { lat: -33.4489, lng: -70.6693 },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: "greedy",
      });
    }
    const map = mapInstance.current;

    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true, // nosotros dibujamos los markers numerados
      });
    }
    directionsRendererRef.current.setDirections(route.route);

    // Dibujar markers numerados en cada parada (incluyendo origen y destino)
    const allPoints: { stop: RutaEntregaStop; numero: number; isOrigin?: boolean; isDestination?: boolean }[] = [];
    if (origen) {
      allPoints.push({
        stop: {
          id: "_origen",
          nombre: origen.nombre || "Origen",
          lat: origen.lat,
          lng: origen.lng,
        },
        numero: 0,
        isOrigin: true,
      });
    }
    reordenadas.forEach((p, i) => {
      allPoints.push({
        stop: p,
        numero: origen ? i + 1 : i,
      });
    });
    if (!origen) {
      // última parada se muestra con icono de "destino final"
      allPoints[allPoints.length - 1].isDestination = true;
    } else {
      allPoints[allPoints.length - 1].isDestination = true;
    }

    const bounds = new google.maps.LatLngBounds();
    infoWindowRef.current = new google.maps.InfoWindow();

    allPoints.forEach((pt) => {
      const position = { lat: pt.stop.lat!, lng: pt.stop.lng! };
      const label = pt.isOrigin ? "A" : pt.isDestination && !origen && allPoints.length === 1 ? "" : String(pt.numero);
      const color = pt.isOrigin ? "#1d4ed8" : pt.isDestination ? "#9333ea" : "#0284c7";

      const marker = new google.maps.Marker({
        position,
        map,
        title: pt.stop.nombre,
        label: {
          text: label,
          color: "white",
          fontSize: "12px",
          fontWeight: "bold",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "white",
          strokeWeight: 2,
        },
      });
      markersRef.current.push(marker);
      bounds.extend(position);

      listenersRef.current.push(
        google.maps.event.addListener(marker, "click", () => {
          if (infoWindowRef.current) {
            const deuda = (pt.stop as any).deuda;
            const litros = pt.stop.litros;
            const total = pt.stop.total;
            const direccion = pt.stop.direccion;
            const metodoPago = pt.stop.metodoPago;
            const html = `
              <div style="font-family: sans-serif; min-width: 220px; max-width: 280px;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                  <span style="background: ${color}; color: white; border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px;">${label}</span>
                  <span style="font-weight: 600; font-size: 13px;">${escapeHtml(pt.stop.nombre)}</span>
                </div>
                ${direccion ? `<div style="color: #555; font-size: 12px; margin-bottom: 3px;">${escapeHtml(direccion)}</div>` : ""}
                ${litros ? `<div style="font-size: 12px;">Litros: <strong>${litros} L</strong></div>` : ""}
                ${total ? `<div style="font-size: 12px;">Total: <strong>$${total.toLocaleString("es-CL")}</strong></div>` : ""}
                ${metodoPago ? `<div style="font-size: 11px; color: #888;">Pago: ${escapeHtml(metodoPago)}</div>` : ""}
                <a href="https://www.google.com/maps?q=${pt.stop.lat},${pt.stop.lng}" target="_blank" style="color: #2563eb; font-size: 12px; text-decoration: underline;">Cómo llegar</a>
              </div>
            `;
            infoWindowRef.current.setContent(html);
            infoWindowRef.current.open(map, marker);
          }
        })
      );
    });

    if (allPoints.length > 1) {
      map.fitBounds(bounds, 60);
    } else if (allPoints.length === 1) {
      map.setCenter({ lat: allPoints[0].stop.lat!, lng: allPoints[0].stop.lng! });
      map.setZoom(15);
    }

    setTimeout(() => {
      if (mapInstance.current) {
        google.maps.event.trigger(mapInstance.current, "resize");
      }
    }, 250);

    return () => {
      cleanup();
    };
  }, [open, googleReady, route, reordenadas, origen, cleanup]);

  // Calcular ruta al abrir
  useEffect(() => {
    if (!open || !googleReady) return;
    calcularRuta();
  }, [open, googleReady, calcularRuta]);

  // Cargar depot
  useEffect(() => {
    if (!open) return;
    const d = getDepot("akuo");
    setDepotState(d);
  }, [open]);

  // Calcular distancias round-trip desde el depot cuando hay ruta óptima
  useEffect(() => {
    if (!open || !googleReady || !depot || reordenadas.length === 0) {
      setDepotDistances({ toFirst: null, fromLast: null });
      return;
    }
    let cancelled = false;
    const first = reordenadas[0];
    const last = reordenadas[reordenadas.length - 1];
    Promise.all([
      getDistancesFromOrigin(
        { lat: depot.lat, lng: depot.lng },
        [{ lat: first.lat!, lng: first.lng! }]
      ),
      getDistancesFromOrigin(
        { lat: depot.lat, lng: depot.lng },
        [{ lat: last.lat!, lng: last.lng! }]
      ),
    ])
      .then(([r1, r2]) => {
        if (cancelled) return;
        setDepotDistances({
          toFirst: {
            distanceText: r1[0]?.distanceText ?? null,
            durationText: r1[0]?.durationText ?? null,
            distanceMeters: r1[0]?.distanceMeters ?? null,
            durationSeconds: r1[0]?.durationSeconds ?? null,
          },
          fromLast: {
            distanceText: r2[0]?.distanceText ?? null,
            durationText: r2[0]?.durationText ?? null,
            distanceMeters: r2[0]?.distanceMeters ?? null,
            durationSeconds: r2[0]?.durationSeconds ?? null,
          },
        });
      })
      .catch(() => {
        if (!cancelled) setDepotDistances({ toFirst: null, fromLast: null });
      });
    return () => { cancelled = true; };
  }, [open, googleReady, depot, reordenadas]);

  // Dibujar marker del depot en el mapa
  useEffect(() => {
    if (!open || !googleReady || !mapInstance.current) return;
    const google = (window as any).google;
    if (depotMarkerRef.current) {
      try { depotMarkerRef.current.setMap(null); } catch {}
      depotMarkerRef.current = null;
    }
    if (!depot) return;
    depotMarkerRef.current = new google.maps.Marker({
      position: { lat: depot.lat, lng: depot.lng },
      map: mapInstance.current,
      title: depot.nombre || "Depot",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 18,
        fillColor: "#1d4ed8",
        fillOpacity: 1,
        strokeColor: "white",
        strokeWeight: 3,
      },
      label: { text: "D", color: "white", fontSize: "12px", fontWeight: "bold" },
      zIndex: 9999,
    });
  }, [open, googleReady, depot]);

  // Cleanup al cerrar
  useEffect(() => {
    if (!open) {
      cleanup();
      setRoute(null);
      setReordenadas([]);
      mapInstance.current = null;
    } else {
      // reset cuando abre
      setRoute(null);
      setReordenadas([]);
    }
  }, [open, cleanup]);

  // Construir deep-link para abrir en el móvil
  const mobileDeepLink = useMemo(() => {
    if (reordenadas.length < 2) return null;
    const origin = origen
      ? { lat: origen.lat, lng: origen.lng, label: origen.nombre }
      : { lat: reordenadas[0].lat!, lng: reordenadas[0].lng!, label: reordenadas[0].nombre };
    const destination = {
      lat: reordenadas[reordenadas.length - 1].lat!,
      lng: reordenadas[reordenadas.length - 1].lng!,
      label: reordenadas[reordenadas.length - 1].nombre,
    };
    const waypoints = origen
      ? reordenadas.slice(0, -1)
      : reordenadas.slice(1, -1);
    return buildGoogleMapsDeepLink(
      origin,
      destination,
      waypoints.map((w) => ({ lat: w.lat!, lng: w.lng!, label: w.nombre }))
    );
  }, [reordenadas, origen]);

  const totalDistancia = route?.totalDistanceMeters ?? 0;
  const totalDuracion = route?.totalDurationSeconds ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[95vw] max-w-6xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" /> {titulo}
            <span className="text-sm font-normal text-muted-foreground">
              ({paradasValidas.length} paradas{sinGps > 0 ? ` · ${sinGps} sin GPS` : ""})
            </span>
          </DialogTitle>
          <DialogDescription>
            Ruta optimizada por Google Maps. Verde ya está incluido el orden sugerido para minimizar distancia.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" /> {error}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-3 h-[72vh]">
          {/* Panel lateral: lista de paradas en orden óptimo */}
          <div className="flex flex-col gap-2 md:border-r md:border-border md:pr-3 overflow-hidden">
            {optimizando ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Optimizando ruta...
              </div>
            ) : reordenadas.length > 0 ? (
              <>
                {route && (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-2 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Distancia total (entre paradas)</span>
                      <strong className="text-primary">{formatDistance(totalDistancia)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tiempo estimado</span>
                      <strong className="text-primary">{formatDuration(totalDuracion)}</strong>
                    </div>
                    {(depotDistances.toFirst || depotDistances.fromLast) && (
                      <div className="border-t border-primary/20 mt-1 pt-1 space-y-0.5 text-[10px]">
                        {depotDistances.toFirst && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-0.5">
                              <Home className="h-2.5 w-2.5" /> Depot → primera parada
                            </span>
                            <strong className="text-primary tabular-nums">
                              {depotDistances.toFirst.distanceText} · {depotDistances.toFirst.durationText}
                            </strong>
                          </div>
                        )}
                        {depotDistances.fromLast && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-0.5">
                              <Home className="h-2.5 w-2.5" /> Última parada → Depot
                            </span>
                            <strong className="text-primary tabular-nums">
                              {depotDistances.fromLast.distanceText} · {depotDistances.fromLast.durationText}
                            </strong>
                          </div>
                        )}
                        {depotDistances.toFirst && depotDistances.fromLast &&
                         depotDistances.toFirst.distanceMeters != null &&
                         depotDistances.fromLast.distanceMeters != null &&
                         totalDistancia > 0 && (
                          <div className="flex justify-between border-t border-primary/20 mt-1 pt-1">
                            <span className="font-medium text-muted-foreground">Recorrido total + depot</span>
                            <strong className="text-primary tabular-nums">
                              {formatDistance(
                                totalDistancia +
                                  depotDistances.toFirst.distanceMeters +
                                  depotDistances.fromLast.distanceMeters
                              )}
                            </strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <DepotPanel namespace="akuo" compact buttonLabel="Configurar depot" />
                {mobileDeepLink && (
                  <div className="flex gap-2">
                    <a
                      href={mobileDeepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-blue-600 hover:bg-blue-700 px-3 py-2 text-sm text-white font-medium transition"
                    >
                      <Navigation className="h-4 w-4" /> Abrir en Maps
                    </a>
                    <ShareRouteButton url={mobileDeepLink} label="Enviar al móvil" />
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => calcularRuta()}
                  disabled={optimizando}
                >
                  <RefreshCw className="mr-1 h-3 w-3" /> Recalcular
                </Button>
              </>
            ) : null}

            <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
              {reordenadas.length === 0 && !optimizando ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {paradasValidas.length < 2
                    ? "Se necesitan al menos 2 paradas con GPS para calcular una ruta."
                    : "Calculando ruta..."}
                </p>
              ) : (
                reordenadas.map((p, i) => {
                  const leg = route?.legs?.[i];
                  return (
                    <button
                      key={p.id + "_" + i}
                      type="button"
                      onClick={() => onSelectParada?.(p)}
                      className="w-full text-left rounded-lg border border-border p-2 hover:bg-muted/30 transition"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="shrink-0 inline-flex items-center justify-center text-white text-[11px] font-bold rounded-full w-6 h-6"
                          style={{ backgroundColor: "#0284c7" }}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{p.nombre}</p>
                          {p.direccion && (
                            <p className="text-xs text-muted-foreground truncate">{p.direccion}</p>
                          )}
                          {p.litros ? (
                            <p className="text-xs text-muted-foreground">{p.litros} L · ${p.total?.toLocaleString("es-CL") || 0}</p>
                          ) : null}
                          {leg && (
                            <p className="text-[11px] text-muted-foreground/80 mt-1">
                              {leg.distanceMeters ? formatDistance(leg.distanceMeters) : "?"} · {leg.durationSeconds ? formatDuration(leg.durationSeconds) : "?"}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Mapa */}
          <div className="relative min-h-[300px] md:min-h-0">
            <div ref={mapRef} className="absolute inset-0 rounded-lg border border-border">
              {loading && (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando Google Maps...
                </div>
              )}
              {!loading && !googleReady && !error && (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <MapPin className="mr-2 h-4 w-4" /> Esperando Google Maps...
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
