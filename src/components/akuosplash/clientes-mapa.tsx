"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Search, Navigation, ExternalLink, AlertTriangle, Crosshair, Flame, Home } from "lucide-react";
import { toast } from "sonner";
import {
  loadGoogleMaps,
  buildGoogleMapsDeepLink,
  getDistancesFromOrigin,
  getDepot,
  setDepot,
  formatDistance,
  formatDuration,
  type Depot as DepotType,
} from "@/lib/google-maps";
import { DepotPanel } from "./depot-panel";

export interface ClienteMapa {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  zona: string | null;
  lat: number | null;
  lng: number | null;
  deuda?: number;
  deudaInicial?: number;
  _count?: { entregas?: number } | number;
}

interface ClientesMapaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: ClienteMapa[];
  onSelectCliente?: (id: string) => void;
}

type HeatmapMode = "off" | "cantidad" | "deuda" | "actividad";

export function ClientesMapa({ open, onOpenChange, clientes, onSelectCliente }: ClientesMapaProps) {
  const [busqueda, setBusqueda] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("off");
  const [depot, setDepotState] = useState<DepotType | null>(null);
  const [depotKey, setDepotKey] = useState(0); // para forzar recarga
  const [distances, setDistances] = useState<Record<string, { distanceMeters: number | null; durationSeconds: number | null; distanceText: string | null; durationText: string | null }>>({});
  const [distancesLoading, setDistancesLoading] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const boundsRef = useRef<any>(null);
  const listenersRef = useRef<any[]>([]);
  const heatmapRef = useRef<any>(null);
  const depotMarkerRef = useRef<any>(null);

  const DEPOT_NAMESPACE = "akuo"; // cada app podría tener su propio depot

  const clientesConGps = useMemo(
    () => clientes.filter((c) => c.lat != null && c.lng != null),
    [clientes]
  );
  const clientesSinGps = useMemo(
    () => clientes.filter((c) => !c.lat || !c.lng),
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
    if (infoWindowRef.current) {
      try { infoWindowRef.current.close(); } catch {}
      infoWindowRef.current = null;
    }
    if (heatmapRef.current) {
      try { heatmapRef.current.setMap(null); } catch {}
      heatmapRef.current = null;
    }
    if (depotMarkerRef.current) {
      try { depotMarkerRef.current.setMap(null); } catch {}
      depotMarkerRef.current = null;
    }
  }, []);

  // Cargar depot al abrir
  useEffect(() => {
    if (!open) return;
    const d = getDepot(DEPOT_NAMESPACE);
    setDepotState(d);
  }, [open, depotKey]);

  // Dibujar/quitar marker del depot cuando cambia
  useEffect(() => {
    if (!open || !googleReady || !mapInstance.current) return;
    const google = (window as any).google;

    // Quitar marker anterior
    if (depotMarkerRef.current) {
      try { depotMarkerRef.current.setMap(null); } catch {}
      depotMarkerRef.current = null;
    }

    if (!depot) return;

    // Agregar marker especial (home icon)
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
      label: {
        text: "D",
        color: "white",
        fontSize: "12px",
        fontWeight: "bold",
      },
      zIndex: 9999,
    });
    if (boundsRef.current) {
      boundsRef.current.extend({ lat: depot.lat, lng: depot.lng });
    }
  }, [open, googleReady, depot]);

  // Calcular distancias cuando hay depot
  useEffect(() => {
    if (!open || !googleReady || !depot || filtrados.length === 0) {
      setDistances({});
      return;
    }
    let cancelled = false;
    setDistancesLoading(true);
    const destinations = filtrados.slice(0, 25).map((c) => ({ lat: c.lat!, lng: c.lng!, label: c.nombre }));
    getDistancesFromOrigin({ lat: depot.lat, lng: depot.lng }, destinations)
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, { distanceMeters: number | null; durationSeconds: number | null; distanceText: string | null; durationText: string | null }> = {};
        results.forEach((r, i) => {
          const c = filtrados[i];
          if (c) {
            map[c.id] = {
              distanceMeters: r.distanceMeters,
              durationSeconds: r.durationSeconds,
              distanceText: r.distanceText,
              durationText: r.durationText,
            };
          }
        });
        setDistances(map);
      })
      .catch((e) => {
        console.error("[depot distances]", e);
        if (!cancelled) setDistances({});
      })
      .finally(() => {
        if (!cancelled) setDistancesLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, googleReady, depot, filtrados]);


  // Renderizar/cambiar heatmap cuando cambia el modo
  useEffect(() => {
    if (!open || !googleReady || !mapInstance.current) return;
    const google = (window as any).google;
    if (!google?.maps?.visualization?.HeatmapLayer) {
      // Visualization library no cargó
      return;
    }

    // Quitar heatmap existente
    if (heatmapRef.current) {
      try { heatmapRef.current.setMap(null); } catch {}
      heatmapRef.current = null;
    }

    if (heatmapMode === "off") return;
    if (filtrados.length === 0) return;

    // Construir los puntos con peso según el modo
    let maxWeight = 1;
    if (heatmapMode === "deuda") {
      maxWeight = Math.max(1, ...filtrados.map((c) => c.deuda ?? 0));
    } else if (heatmapMode === "actividad") {
      maxWeight = Math.max(
        1,
        ...filtrados.map((c) => {
          const n =
            typeof c._count === "number"
              ? c._count
              : c._count?.entregas ?? 0;
          return n;
        })
      );
    }

    const data = filtrados.map((c) => {
      let weight = 1;
      if (heatmapMode === "deuda") {
        weight = Math.max(0, (c.deuda ?? 0) / maxWeight) * 10;
      } else if (heatmapMode === "actividad") {
        const n =
          typeof c._count === "number" ? c._count : c._count?.entregas ?? 0;
        weight = Math.max(0, n / maxWeight) * 10;
      }
      return {
        location: new google.maps.LatLng(c.lat!, c.lng!),
        weight: Math.max(0.1, weight),
      };
    });

    heatmapRef.current = new google.maps.visualization.HeatmapLayer({
      data,
      map: mapInstance.current,
      radius: 50,
      dissipating: true,
      gradient: [
        "rgba(0, 255, 255, 0)",
        "rgba(0, 255, 255, 1)",
        "rgba(0, 191, 255, 1)",
        "rgba(0, 127, 255, 1)",
        "rgba(0, 63, 255, 1)",
        "rgba(0, 0, 223, 1)",
        "rgba(0, 0, 191, 1)",
        "rgba(0, 0, 127, 1)",
        "rgba(63, 0, 91, 1)",
        "rgba(127, 0, 63, 1)",
        "rgba(191, 0, 31, 1)",
        "rgba(255, 0, 0, 1)",
      ],
    });
  }, [open, googleReady, heatmapMode, filtrados]);

  // Inicializar mapa cuando abre
  useEffect(() => {
    if (!open) return;
    if (!googleReady) return;
    if (!mapRef.current) return;

    // cleanup previo
    cleanup();

    const google = (window as any).google;
    const map = new google.maps.Map(mapRef.current, {
      zoom: 11,
      center: { lat: -33.4489, lng: -70.6693 },
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      gestureHandling: "greedy",
    });
    mapInstance.current = map;
    infoWindowRef.current = new google.maps.InfoWindow();
    boundsRef.current = new google.maps.LatLngBounds();

    // Renderizar markers
    filtrados.forEach((c) => {
      const position = { lat: c.lat!, lng: c.lng! };
      const tieneDeuda = (c.deuda ?? 0) > 0;
      // Icono SVG de color según deuda
      const color = tieneDeuda ? "#dc2626" : "#16a34a";
      const label = c.nombre.slice(0, 1).toUpperCase();
      const marker = new google.maps.Marker({
        position,
        map,
        title: c.nombre,
        label: {
          text: label,
          color: "white",
          fontSize: "12px",
          fontWeight: "bold",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 16,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "white",
          strokeWeight: 2,
        },
      });
      markersRef.current.push(marker);
      boundsRef.current.extend(position);

      listenersRef.current.push(
        google.maps.event.addListener(marker, "click", () => {
          if (infoWindowRef.current) {
            const deuda = c.deuda ?? 0;
            const contentHtml = `
              <div style="font-family: sans-serif; min-width: 200px; max-width: 280px;">
                <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${escapeHtml(c.nombre)}</div>
                ${c.direccion ? `<div style="color: #555; font-size: 12px; margin-bottom: 2px;">${escapeHtml(c.direccion)}</div>` : ""}
                ${c.zona ? `<div style="color: #888; font-size: 11px; margin-bottom: 4px;">Zona: ${escapeHtml(c.zona)}</div>` : ""}
                ${c.telefono ? `<div style="color: #555; font-size: 12px; margin-bottom: 4px;">Tel: ${escapeHtml(c.telefono)}</div>` : ""}
                <div style="font-size: 12px; font-weight: 600; color: ${deuda > 0 ? "#dc2626" : "#16a34a"}; margin-bottom: 6px;">
                  ${deuda > 0 ? "Debe: " + formatMoney(deuda) : "Al día"}
                </div>
                <a href="https://www.google.com/maps?q=${c.lat},${c.lng}" target="_blank" style="color: #2563eb; font-size: 12px; text-decoration: underline;">
                  Cómo llegar
                </a>
              </div>
            `;
            infoWindowRef.current.setContent(contentHtml);
            infoWindowRef.current.open(map, marker);
          }
          setSelectedId(c.id);
        })
      );
    });

    // Fit bounds si hay markers, sino centrar en Santiago
    if (filtrados.length > 0) {
      if (filtrados.length === 1) {
        map.setCenter({ lat: filtrados[0].lat!, lng: filtrados[0].lng! });
        map.setZoom(15);
      } else {
        map.fitBounds(boundsRef.current, 60);
      }
    }

    setTimeout(() => {
      if (mapInstance.current) {
        google.maps.event.trigger(mapInstance.current, "resize");
      }
    }, 250);

    return () => {
      cleanup();
      mapInstance.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, googleReady, filtrados]);

  // Cleanup al cerrar
  useEffect(() => {
    if (!open) {
      cleanup();
      setSelectedId(null);
      setBusqueda("");
      setDistances({});
      setHeatmapMode("off");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Centrar el mapa en un cliente seleccionado
  useEffect(() => {
    if (!open || !selectedId || !mapInstance.current) return;
    const cliente = clientesConGps.find((c) => c.id === selectedId);
    if (!cliente) return;
    mapInstance.current.panTo({ lat: cliente.lat!, lng: cliente.lng! });
    mapInstance.current.setZoom(16);
  }, [selectedId, open, clientesConGps]);

  // Generar ruta deep-link a Google Maps con todos los clientes visibles
  const rutaDeepLink = useMemo(() => {
    if (filtrados.length < 2) return null;
    const first = filtrados[0];
    const last = filtrados[filtrados.length - 1];
    const waypoints = filtrados.slice(1, -1);
    return buildGoogleMapsDeepLink(
      { lat: first.lat!, lng: first.lng!, label: first.nombre },
      { lat: last.lat!, lng: last.lng!, label: last.nombre },
      waypoints.map((w) => ({ lat: w.lat!, lng: w.lng!, label: w.nombre }))
    );
  }, [filtrados]);

  function verEnMaps(c: ClienteMapa) {
    window.open(`https://www.google.com/maps?q=${c.lat},${c.lng}`, "_blank", "noopener");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[95vw] max-w-6xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Mapa de clientes
            <span className="text-sm font-normal text-muted-foreground">
              ({filtrados.length} visibles · {clientesSinGps.length} sin GPS)
            </span>
          </DialogTitle>
          <DialogDescription>
            Haz clic en un marcador para ver los detalles del cliente. Verde = al día. Rojo = con deuda.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" /> {error}
            </p>
            <p className="mt-1 text-xs">
              Verifica que <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> esté configurada en Vercel.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 h-[70vh]">
          {/* Panel lateral: lista filtrable */}
          <div className="flex flex-col gap-2 md:border-r md:border-border md:pr-3 overflow-hidden">
            <div className="flex gap-2">
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar nombre/dirección/zona"
                className="flex-1"
              />
              {busqueda && (
                <Button variant="ghost" size="sm" onClick={() => setBusqueda("")}>
                  Limpiar
                </Button>
              )}
            </div>

            {rutaDeepLink && (
              <a
                href={rutaDeepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1 rounded-md bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs text-white font-medium transition"
              >
                <Navigation className="h-3 w-3" /> Ruta Google Maps ({filtrados.length} paradas)
              </a>
            )}

            {/* Depot — punto de origen del camión */}
            <DepotPanel
              namespace={DEPOT_NAMESPACE}
              compact
              buttonLabel="Configurar depot"
            />
            {depot && distancesLoading && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Calculando distancias…
              </p>
            )}
            {depot && !distancesLoading && Object.keys(distances).length > 0 && (
              <p className="text-xs text-muted-foreground">
                Mostrando distancia desde depot a cada cliente.
              </p>
            )}

            {/* Toggle heatmap */}
            <div className="rounded-md border border-border bg-muted/30 p-1.5">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Flame className="h-3 w-3" /> Heatmap
              </p>
              <div className="grid grid-cols-4 gap-1">
                {([
                  { v: "off", label: "Off" },
                  { v: "cantidad", label: "Cant." },
                  { v: "deuda", label: "Deuda" },
                  { v: "actividad", label: "Activ." },
                ] as { v: HeatmapMode; label: string }[]).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setHeatmapMode(opt.v)}
                    className={`rounded px-1.5 py-1 text-[11px] font-medium transition ${
                      heatmapMode === opt.v
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {heatmapMode !== "off" && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {heatmapMode === "cantidad" && "Más rojo = más clientes en la misma zona."}
                  {heatmapMode === "deuda" && "Más rojo = mayor concentración de saldo deudor."}
                  {heatmapMode === "actividad" && "Más rojo = más entregas históricas."}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
              {filtrados.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay clientes con ubicación GPS que coincidan.
                </p>
              ) : (
                filtrados.map((c) => {
                  const deuda = c.deuda ?? 0;
                  const isSelected = c.id === selectedId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left rounded-lg border p-2 transition ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{c.nombre}</p>
                          {c.direccion && (
                            <p className="text-xs text-muted-foreground truncate">{c.direccion}</p>
                          )}
                          {c.zona && (
                            <p className="text-xs text-muted-foreground/80 truncate">📍 {c.zona}</p>
                          )}
                          {distances[c.id]?.distanceMeters != null && (
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <Home className="h-2.5 w-2.5" />
                              {distances[c.id].distanceText || formatDistance(distances[c.id].distanceMeters!)}
                              {distances[c.id].durationText ? ` · ${distances[c.id].durationText}` : ""}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                            deuda > 0
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                          }`}
                        >
                          {deuda > 0 ? "Debe" : "OK"}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            verEnMaps(c);
                          }}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Cómo llegar
                        </button>
                        {onSelectCliente && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCliente(c.id);
                              onOpenChange(false);
                            }}
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <MapPin className="h-3 w-3" /> Ver ficha
                          </button>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            {clientesSinGps.length > 0 && (
              <div className="border-t border-border pt-2 text-xs text-muted-foreground">
                <p className="font-medium">Sin GPS ({clientesSinGps.length}):</p>
                <ul className="mt-1 space-y-0.5 max-h-16 overflow-y-auto">
                  {clientesSinGps.slice(0, 8).map((c) => (
                    <li key={c.id} className="truncate">• {c.nombre}</li>
                  ))}
                  {clientesSinGps.length > 8 && (
                    <li className="text-muted-foreground/60 italic">y {clientesSinGps.length - 8} más...</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Mapa */}
          <div className="relative min-h-[300px] md:min-h-0">
            <div ref={mapRef} className="absolute inset-0 rounded-lg border border-border">
              {loading && (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando Google Maps...
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

function formatMoney(n: number): string {
  return "$" + n.toLocaleString("es-CL", { maximumFractionDigits: 0 });
}
