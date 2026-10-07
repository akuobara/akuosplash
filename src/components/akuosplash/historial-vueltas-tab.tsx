"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Repeat,
  Droplets,
  Banknote,
  Smartphone,
  Truck,
  ChevronDown,
  ChevronRight,
  Clock,
  MapPin,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/components/akuosplash/akuosplash-api-client";
import {
  formatNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
  labelMetodoPago,
  labelEstadoPago,
  esVueltaCompletada,
  UMBRAL_COMPLETACION_VUELTA,
} from "@/components/akuosplash/akuosplash-helpers";

interface EntregaVuelta {
  id: string;
  fecha: string;
  clienteNombre: string;
  clienteZona: string | null;
  litros: number;
  metodoPago: string;
  total: number;
  montoEfectivo: number;
  montoTransferencia: number;
  montoRecibido: number;
  estadoPago: string;
  detalleEstanquesJson: string | null;
  fotoMedidorUrl: string | null;
}

interface Vuelta {
  id: string;
  numero: number;
  iniciadaEn: string;
  cerradaEn: string | null;
  activa: boolean;
  nota: string | null;
  camion: { id: string; nombre: string; patente: string | null; capacidad: number } | null;
  chofer: { id: string; nombre: string } | null;
  cantidadEntregas: number;
  litros: number;
  litrosRestantes: number;
  capacidadCamion: number;
  ventas: number;
  efectivoRecibido: number;
  esMultiple: boolean;
}

type Period = "hoy" | "ayer" | "semana" | "mes" | "todo";

const PERIODS: { value: Period; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "ayer", label: "Ayer" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "todo", label: "Todo" },
];

export function HistorialVueltasTab({ refreshKey, onRefresh }: { refreshKey: number; onRefresh: () => void }) {
  const [vueltas, setVueltas] = useState<Vuelta[]>([]);
  const [loading, setLoading] = useState(true);
  const [umbralCompletacion, setUmbralCompletacion] = useState<number>(0.975);
  const [period, setPeriod] = useState<Period>("semana");
  const [vueltasAbiertas, setVueltasAbiertas] = useState<Set<string>>(new Set());
  const [entregasPorVuelta, setEntregasPorVuelta] = useState<Record<string, EntregaVuelta[]>>({});
  const [cargandoEntregas, setCargandoEntregas] = useState<Set<string>>(new Set());
  const [reabrirConfirm, setReabrirConfirm] = useState<Vuelta | null>(null);
  const [reabriendo, setReabriendo] = useState(false);
  // Cache de todas las entregas para no hacer N+1 requests
  const [cacheEntregas, setCacheEntregas] = useState<EntregaVuelta[] | null>(null);

  // Cargar umbral de completación desde la configuración
  useEffect(() => {
    apiGet<{ configuracion: { umbralCompletacionVuelta?: number | null } }>("/api/akuosplash/configuracion")
      .then(data => {
        const u = data.configuracion?.umbralCompletacionVuelta;
        if (typeof u === "number" && u > 0) setUmbralCompletacion(u);
      })
      .catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ vueltas: Vuelta[] }>(`/api/akuosplash/vueltas?period=${period}`);
      setVueltas(data.vueltas);
      // Invalidar cache de entregas y entregasPorVuelta al refrescar
      setCacheEntregas(null);
      setEntregasPorVuelta({});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  // Agrupar por día
  const vueltasPorDia: Record<string, Vuelta[]> = {};
  for (const v of vueltas) {
    const fecha = v.iniciadaEn.split("T")[0];
    if (!vueltasPorDia[fecha]) vueltasPorDia[fecha] = [];
    vueltasPorDia[fecha].push(v);
  }
  const dias = Object.entries(vueltasPorDia).sort(([a], [b]) => b.localeCompare(a));

  async function toggleVuelta(vueltaId: string) {
    const nuevasAbiertas = new Set(vueltasAbiertas);
    if (nuevasAbiertas.has(vueltaId)) {
      nuevasAbiertas.delete(vueltaId);
      setVueltasAbiertas(nuevasAbiertas);
      return;
    }
    nuevasAbiertas.add(vueltaId);
    setVueltasAbiertas(nuevasAbiertas);

    if (!entregasPorVuelta[vueltaId]) {
      const nuevasCargando = new Set(cargandoEntregas);
      nuevasCargando.add(vueltaId);
      setCargandoEntregas(nuevasCargando);
      try {
        // Usar cache si ya se cargaron todas las entregas antes
        let todas: EntregaVuelta[] = cacheEntregas ?? [];
        if (!cacheEntregas) {
          const data = await apiGet<{ entregas: EntregaVuelta[] }>(`/api/akuosplash/entregas?period=todo`);
          todas = data.entregas;
          setCacheEntregas(todas);
        }
        const deVuelta = todas.filter((e: any) => e.vueltaId === vueltaId);
        // Usar functional updater para evitar stale closure
        setEntregasPorVuelta((prev) => ({ ...prev, [vueltaId]: deVuelta }));
      } catch (e) {
        console.error(e);
      } finally {
        // Usar functional updater también aquí
        setCargandoEntregas((prev) => {
          const next = new Set(prev);
          next.delete(vueltaId);
          return next;
        });
      }
    }
  }

  async function reabrirVuelta() {
    if (!reabrirConfirm) return;
    setReabriendo(true);
    try {
      await apiPost(`/api/akuosplash/vueltas/${reabrirConfirm.id}/reabrir`, {});
      toast.success(`Vuelta #${reabrirConfirm.numero} reabierta — ahora es la vuelta activa`);
      setReabrirConfirm(null);
      onRefresh();
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reabrir la vuelta");
    } finally {
      setReabriendo(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">Historial de vueltas</h2>
          <p className="text-sm text-muted-foreground">
            Detalle de cada vuelta: clientes, litros, cobros y camión usado.
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resumen del período */}
      {vueltas.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs uppercase text-muted-foreground">Vueltas</p>
              <p className="text-xl font-bold">{vueltas.length}</p>
              {(() => {
                const validas = vueltas.filter((v) => esVueltaCompletada(v.litros, v.capacidadCamion, v.cantidadEntregas)).length;
                const invalidas = vueltas.length - validas;
                if (invalidas > 0) {
                  return (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      {validas} válidas · {invalidas} sin completar
                    </p>
                  );
                }
                return null;
              })()}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs uppercase text-muted-foreground">Litros</p>
              <p className="text-xl font-bold tabular-nums">{formatNumber(vueltas.reduce((s, v) => s + v.litros, 0), 0)} L</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs uppercase text-muted-foreground">Ventas</p>
              <p className="text-xl font-bold tabular-nums">{formatCurrency(vueltas.reduce((s, v) => s + v.ventas, 0))}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs uppercase text-muted-foreground">Efectivo</p>
              <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(vueltas.reduce((s, v) => s + v.efectivoRecibido, 0))}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista por día */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : vueltas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Repeat className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No hay vueltas en este período.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {dias.map(([fechaKey, vueltasDia]) => {
            const f = new Date(fechaKey + "T12:00:00");
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const ayer = new Date(hoy);
            ayer.setDate(ayer.getDate() - 1);
            const esHoy = f.toDateString() === hoy.toDateString();
            const esAyer = f.toDateString() === ayer.toDateString();
            const etiqueta = esHoy ? "Hoy" : esAyer ? "Ayer" : formatDate(f);

            const litrosDia = vueltasDia.reduce((s, v) => s + v.litros, 0);
            const ventasDia = vueltasDia.reduce((s, v) => s + v.ventas, 0);
            const efectivoDia = vueltasDia.reduce((s, v) => s + v.efectivoRecibido, 0);

            return (
              <div key={fechaKey} className="space-y-2">
                {/* Encabezado del día */}
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                  <div>
                    <span className="text-sm font-semibold">{etiqueta}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{vueltasDia.length} vuelta(s)</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="tabular-nums">{formatNumber(litrosDia, 0)} L</span>
                    <span className="tabular-nums font-semibold">{formatCurrency(ventasDia)}</span>
                    <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(efectivoDia)}</span>
                  </div>
                </div>

                {/* Vueltas del día */}
                {vueltasDia.map((v) => {
                  const abierta = vueltasAbiertas.has(v.id);
                  const entregas = entregasPorVuelta[v.id] || [];
                  const cargando = cargandoEntregas.has(v.id);
                  const completada = esVueltaCompletada(v.litros, v.capacidadCamion, v.cantidadEntregas, umbralCompletacion);
                  const porcentaje = v.capacidadCamion > 0 ? (v.litros / v.capacidadCamion) * 100 : 0;
                  const umbralLitros = v.capacidadCamion > 0 ? Math.ceil(v.capacidadCamion * umbralCompletacion) : 0;
                  const puedeReabrir = !v.activa && !completada;

                  return (
                    <Card key={v.id} className={`overflow-hidden ${!completada && !v.activa ? "border-amber-300 dark:border-amber-800" : ""}`}>
                      <button
                        type="button"
                        onClick={() => toggleVuelta(v.id)}
                        className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/30"
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold ${
                          v.activa
                            ? "bg-primary text-primary-foreground"
                            : completada
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}>
                          #{v.numero}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-sm">Vuelta #{v.numero}</span>
                            {v.activa ? (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Activa
                              </span>
                            ) : completada ? (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Completada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                <AlertTriangle className="h-2.5 w-2.5" /> Sin completar
                              </span>
                            )}
                            {v.esMultiple && (
                              <Badge variant="outline" className="text-[10px]">Múltiples</Badge>
                            )}
                            {v.camion && (
                              <Badge variant="outline" className="text-[10px] gap-0.5">
                                <Truck className="h-2.5 w-2.5" /> {v.camion.nombre}
                              </Badge>
                            )}
                            {v.chofer && (
                              <Badge variant="outline" className="text-[10px]">{v.chofer.nombre}</Badge>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" /> {formatTime(v.iniciadaEn)}
                              {v.cerradaEn ? ` → ${formatTime(v.cerradaEn)}` : " · en curso"}
                            </span>
                            <span>·</span>
                            <span><Droplets className="mr-0.5 inline h-3 w-3" />{formatNumber(v.litros, 0)} L</span>
                            {v.cantidadEntregas > 0 && <><span>·</span><span>{v.cantidadEntregas} entrega(s)</span></>}
                            {v.capacidadCamion > 0 && (
                              <span className={completada ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                                · {porcentaje.toFixed(0)}% de {formatNumber(v.capacidadCamion, 0)} L
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {v.ventas > 0 && <p className="font-semibold tabular-nums text-sm">{formatCurrency(v.ventas)}</p>}
                          {v.efectivoRecibido > 0 && <p className="text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">Efect: {formatCurrency(v.efectivoRecibido)}</p>}
                        </div>
                        {abierta ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      </button>

                      {/* Banner de vuelta no completada con botones */}
                      {puedeReabrir && (
                        <div className="border-t border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/20">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-amber-900 dark:text-amber-200">
                              <AlertTriangle className="mr-1 inline h-3 w-3" />
                              Vuelta cerrada sin completar ({porcentaje.toFixed(0)}% de {formatNumber(v.capacidadCamion, 0)} L).
                              {" "}Faltaron {formatNumber(Math.max(0, umbralLitros - v.litros), 0)} L para ser válida.
                              {" "}No cuenta para la liquidación.
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-emerald-400 bg-white text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetch(`/api/akuosplash/vueltas/${v.id}/validar`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json", ...((typeof window !== "undefined" && localStorage.getItem("aljibe-token")) ? { Authorization: `Bearer ${localStorage.getItem("aljibe-token")}` } : {}) },
                                    body: JSON.stringify({ validada: true }),
                                    credentials: "include",
                                  }).then(() => { toast.success(`Vuelta #${v.numero} validada manualmente`); cargar(); });
                                }}
                              >
                                ✓ Validar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-amber-400 bg-white text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReabrirConfirm(v);
                                }}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" /> Retomar
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Botón invalidar si está validada manualmente o completada automáticamente */}
                      {!v.activa && completada && (
                        <div className="border-t border-border px-3 py-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              fetch(`/api/akuosplash/vueltas/${v.id}/validar`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", ...((typeof window !== "undefined" && localStorage.getItem("aljibe-token")) ? { Authorization: `Bearer ${localStorage.getItem("aljibe-token")}` } : {}) },
                                body: JSON.stringify({ validada: false }),
                                credentials: "include",
                              }).then(() => { toast.success(`Vuelta #${v.numero} invalidada`); cargar(); });
                            }}
                          >
                            ✗ Invalidar vuelta
                          </Button>
                        </div>
                      )}

                      {/* Detalle de entregas de la vuelta */}
                      {abierta && (
                        <div className="border-t border-border bg-muted/10 p-3 space-y-2">
                          {cargando ? (
                            <div className="flex items-center justify-center py-4">
                              <Skeleton className="h-16 w-full rounded-lg" />
                            </div>
                          ) : entregas.length === 0 ? (
                            <p className="py-4 text-center text-sm text-muted-foreground">Esta vuelta no tiene entregas registradas.</p>
                          ) : (
                            <>
                              {entregas.map((e) => (
                                <div key={e.id} className="rounded-lg border border-border bg-background p-3 text-sm">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-medium">{e.clienteNombre}</span>
                                        {e.clienteZona && <Badge variant="outline" className="text-[10px]">{e.clienteZona}</Badge>}
                                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                          e.estadoPago === "pagado" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                                          : e.estadoPago === "parcial" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                          : "bg-muted text-muted-foreground"
                                        }`}>
                                          {labelEstadoPago(e.estadoPago)}
                                        </span>
                                      </div>
                                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <span><Droplets className="mr-0.5 inline h-3 w-3" />{formatNumber(e.litros, 0)} L</span>
                                        <span>·</span>
                                        <span>{labelMetodoPago(e.metodoPago)}</span>
                                        <span>·</span>
                                        <span className="tabular-nums">{formatCurrency(e.total)}</span>
                                        {e.montoEfectivo > 0 && <><span>·</span><span className="text-emerald-600 dark:text-emerald-400">Efect: {formatCurrency(e.montoEfectivo)}</span></>}
                                        {e.montoTransferencia > 0 && <><span>·</span><span className="text-blue-600 dark:text-blue-400">Trans: {formatCurrency(e.montoTransferencia)}</span></>}
                                        {e.total - e.montoRecibido > 0 && <><span>·</span><span className="text-amber-600 dark:text-amber-400">Saldo: {formatCurrency(e.total - e.montoRecibido)}</span></>}
                                      </div>

                                      {/* Detalle de estanques si existe */}
                                      {e.detalleEstanquesJson && (() => {
                                        let estanques: any[] = [];
                                        try { estanques = JSON.parse(e.detalleEstanquesJson); } catch { return null; }
                                        if (estanques.length === 0) return null;
                                        return (
                                          <div className="mt-1 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-1.5 text-[11px]">
                                            {estanques.map((est, i) => (
                                              <div key={i} className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                  <span className="text-amber-900 dark:text-amber-200">{est.nombre}: {formatNumber(est.litros, 0)} L</span>
                                                  <span className="tabular-nums">{formatCurrency(est.total)}</span>
                                                </div>
                                                {est.fotoUrl && (
                                                  <a href={est.fotoUrl} target="_blank" rel="noopener noreferrer">
                                                    <img src={est.fotoUrl} alt="Medidor" className="h-14 rounded border border-amber-200" />
                                                  </a>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })()}

                                      {/* Foto del medidor */}
                                      {e.fotoMedidorUrl && (
                                        <a href={e.fotoMedidorUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block">
                                          <img src={e.fotoMedidorUrl} alt="Medidor" className="h-16 rounded border border-border" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {/* Totales de la vuelta */}
                              <div className="rounded-lg bg-muted/40 p-2 text-center text-sm">
                                <div className="grid grid-cols-4 gap-2">
                                  <div>
                                    <p className="text-[10px] uppercase text-muted-foreground">Entregas</p>
                                    <p className="font-bold">{entregas.length}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase text-muted-foreground">Litros</p>
                                    <p className="font-bold tabular-nums">{formatNumber(entregas.reduce((s, e) => s + e.litros, 0), 0)} L</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase text-muted-foreground">Ventas</p>
                                    <p className="font-bold tabular-nums">{formatCurrency(entregas.reduce((s, e) => s + e.total, 0))}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase text-muted-foreground">Efectivo</p>
                                    <p className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(entregas.reduce((s, e) => s + e.montoEfectivo, 0))}</p>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Diálogo de confirmación para reabrir vuelta */}
      <Dialog open={!!reabrirConfirm} onOpenChange={(o) => !o && setReabrirConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Retomar Vuelta #{reabrirConfirm?.numero}</DialogTitle>
            <DialogDescription>
              Esta vuelta fue cerrada sin completar (solo {reabrirConfirm ? (reabrirConfirm.capacidadCamion > 0 ? ((reabrirConfirm.litros / reabrirConfirm.capacidadCamion) * 100).toFixed(0) : "0") : "0"}% de {formatNumber(reabrirConfirm?.capacidadCamion ?? 0, 0)} L).
              {" "}Al retomarla volverá a ser la vuelta activa y podrás seguir registrando entregas.
            </DialogDescription>
          </DialogHeader>
          {reabrirConfirm && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-900/20">
              <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p>Si hay otra vuelta activa actualmente, se cerrará automáticamente.</p>
                  <p className="mt-1">Para que esta vuelta cuente en la liquidación, debes entregar al menos{" "}
                    <strong>{formatNumber(reabrirConfirm.capacidadCamion > 0 ? Math.ceil(reabrirConfirm.capacidadCamion * umbralCompletacion) : 0, 0)} L</strong> en total ({(umbralCompletacion * 100).toFixed(1)}% de la capacidad del camión).
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setReabrirConfirm(null)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={reabrirVuelta} disabled={reabriendo} className="w-full sm:w-auto">
              <RotateCcw className="mr-2 h-4 w-4" /> {reabriendo ? "Reabriendo…" : "Retomar vuelta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
