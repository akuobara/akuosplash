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
} from "lucide-react";
import { apiGet } from "@/lib/api-client";
import {
  formatNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
  labelMetodoPago,
  labelEstadoPago,
} from "@/lib/helpers";

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

export function HistorialVueltasTab({ refreshKey }: { refreshKey: number; onRefresh: () => void }) {
  const [vueltas, setVueltas] = useState<Vuelta[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("semana");
  const [vueltasAbiertas, setVueltasAbiertas] = useState<Set<string>>(new Set());
  const [entregasPorVuelta, setEntregasPorVuelta] = useState<Record<string, EntregaVuelta[]>>({});
  const [cargandoEntregas, setCargandoEntregas] = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ vueltas: Vuelta[] }>(`/api/vueltas?period=${period}`);
      setVueltas(data.vueltas);
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
        const data = await apiGet<{ entregas: EntregaVuelta[] }>(`/api/entregas?period=todo`);
        const deVuelta = data.entregas.filter((e: any) => e.vueltaId === vueltaId);
        setEntregasPorVuelta({ ...entregasPorVuelta, [vueltaId]: deVuelta });
      } catch (e) {
        console.error(e);
      } finally {
        const nuevasCargando2 = new Set(cargandoEntregas);
        nuevasCargando2.delete(vueltaId);
        setCargandoEntregas(nuevasCargando2);
      }
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

                  return (
                    <Card key={v.id} className="overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleVuelta(v.id)}
                        className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/30"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
                          #{v.numero}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-sm">Vuelta #{v.numero}</span>
                            {v.activa && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Activa
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
                              <span className="text-muted-foreground/70">· {formatNumber(v.litrosRestantes, 0)} L restantes</span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {v.ventas > 0 && <p className="font-semibold tabular-nums text-sm">{formatCurrency(v.ventas)}</p>}
                          {v.efectivoRecibido > 0 && <p className="text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">Efect: {formatCurrency(v.efectivoRecibido)}</p>}
                        </div>
                        {abierta ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      </button>

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
                                              <div key={i} className="flex items-center justify-between">
                                                <span className="text-amber-900 dark:text-amber-200">{est.nombre}: {formatNumber(est.litros, 0)} L</span>
                                                <span className="tabular-nums">{formatCurrency(est.total)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })()}
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
    </div>
  );
}
