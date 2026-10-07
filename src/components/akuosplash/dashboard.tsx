"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Droplets,
  DollarSign,
  Wallet,
  TrendingDown,
  TrendingUp,
  Plus,
  Fuel,
  Gauge,
  Receipt,
  ArrowRight,
  Banknote,
  Smartphone,
  Repeat,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { StatCard } from "./stat-card";
import { EntregaForm } from "./entrega-form";
import { GastoForm } from "./gasto-form";
import { VueltaWidget } from "./vuelta-widget";
import { OfflinePhotosWidget } from "./offline-photos-widget";
import { apiGet, apiPost } from "@/components/akuosplash/akuosplash-api-client";
import { toast } from "sonner";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  labelTipoGasto,
  labelEstadoPago,
  labelMetodoPago,
} from "@/components/akuosplash/akuosplash-helpers";
import type { Entrega, VueltaActual } from "./entrega-form";
import type { Gasto } from "./gasto-form";

type Period = string;

interface Resumen {
  period: string;
  totalVentas: number;
  totalEfectivoRecibido: number;
  totalTransferenciaRecibida: number;
  totalRecibido: number;
  totalPorCobrar: number;
  totalLitros: number;
  totalGastos: number;
  gastosChofer: number;
  gastosDueno: number;
  gastosPorTipo: Record<string, number>;
  utilidadBruta: number;
  cantidadEntregas: number;
  cantidadGastos: number;
  cantidadVueltas: number;
  pagoChoferCalculado: number;
  capacidadCamion: number;
  modoLiquidacion: string;
  vueltas?: {
    id: string;
    numero: number;
    iniciadaEn: string;
    cerradaEn: string | null;
    activa: boolean;
    litros: number;
    ventas: number;
    efectivo: number;
    transferencia: number;
    numEntregas: number;
  }[];
}

interface DashboardProps {
  refreshKey: number;
  onRefresh: () => void;
  clientes: {
    id: string;
    nombre: string;
    direccion: string | null;
    telefono: string | null;
    zona: string | null;
    precioEfectivoPorLitro: number;
    precioTransferenciaPorLitro: number;
    precioCamionCompleto: number;
    lat: number | null;
    lng: number | null;
    requiereIngresoPropiedad: boolean;
    entregaDesdeAfuera: boolean;
    conexionExterna: boolean;
    requiereClientePresente: boolean;
    indicacionesAcceso: string | null;
    estanquesJson: string | null;
    deudaInicial?: number;
  }[];
  config: {
    precioEfectivoPorLitro: number;
    precioTransferenciaPorLitro: number;
    precioCamionCompleto: number;
    capacidadCamion: number;
    umbralCompletacionVuelta?: number | null;
  };
  camiones: {
    id: string;
    nombre: string;
    patente: string | null;
    capacidad: number;
    activo: boolean;
  }[];
  onGoToEntregas: () => void;
  onGoToGastos: () => void;
  onGoToLiquidacion: () => void;
  pedidosPendientes?: { id: string; clienteNombre: string; clienteId: string | null; litrosSolicitados: number; metodoPagoPreferido: string }[];
  isDueno?: boolean;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "ayer", label: "Ayer" },
  { value: "semana", label: "Esta semana (Dom-Sáb)" },
  { value: "semana7", label: "Últimos 7 días" },
  { value: "mes", label: "Este mes" },
  { value: "mes_anterior", label: "Mes anterior" },
  { value: "mes3", label: "Últimos 3 meses" },
  { value: "todo", label: "Todo" },
];

export function Dashboard({
  refreshKey,
  onRefresh,
  clientes,
  config,
  camiones,
  onGoToEntregas,
  onGoToGastos,
  onGoToLiquidacion,
  pedidosPendientes = [],
  isDueno = false,
}: DashboardProps) {
  const [period, setPeriod] = useState<Period>("hoy");
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [recientes, setRecientes] = useState<Entrega[]>([]);
  const [gastosRecientes, setGastosRecientes] = useState<Gasto[]>([]);
  const [vueltaActual, setVueltaActual] = useState<VueltaActual | null>(null);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [vueltaExpandida, setVueltaExpandida] = useState<string | null>(null);
  const [entregasVuelta, setEntregasVuelta] = useState<Record<string, any[]>>({});
  const [cargandoEntregasVuelta, setCargandoEntregasVuelta] = useState<Set<string>>(new Set());

  const [entregaFormOpen, setEntregaFormOpen] = useState(false);
  const [gastoFormOpen, setGastoFormOpen] = useState(false);
  const [pagoFormOpen, setPagoFormOpen] = useState(false);

  const cargarVuelta = useCallback(async () => {
    try {
      const data = await apiGet<{ vuelta: VueltaActual | null }>("/api/akuosplash/vueltas/activa?_t=" + Date.now());
      setVueltaActual(data.vuelta);
    } catch (e) {
      console.error(e);
    }
  }, []);

  async function toggleVueltaDetalle(vueltaId: string) {
    if (vueltaExpandida === vueltaId) {
      setVueltaExpandida(null);
      return;
    }
    setVueltaExpandida(vueltaId);
    if (!entregasVuelta[vueltaId]) {
      setCargandoEntregasVuelta((prev) => new Set(prev).add(vueltaId));
      try {
        const data = await apiGet<{ entregas: any[] }>(`/api/akuosplash/entregas?period=todo`);
        const deVuelta = data.entregas.filter((e: any) => e.vueltaId === vueltaId);
        setEntregasVuelta((prev) => ({ ...prev, [vueltaId]: deVuelta }));
      } catch (e) {
        console.error(e);
      } finally {
        setCargandoEntregasVuelta((prev) => {
          const next = new Set(prev);
          next.delete(vueltaId);
          return next;
        });
      }
    }
  }

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [r, ents, gsts] = await Promise.all([
        apiGet<Resumen>(`/api/akuosplash/reportes/resumen?period=${period}`),
        apiGet<{ entregas: Entrega[] }>(`/api/akuosplash/entregas?period=${period}`),
        apiGet<{ gastos: Gasto[] }>(`/api/akuosplash/gastos?period=${period}`),
      ]);
      setResumen(r);
      setRecientes(ents.entregas.slice(0, 5));
      setGastosRecientes(gsts.gastos.slice(0, 5));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  useEffect(() => {
    cargarVuelta();
  }, [cargarVuelta, refreshKey]);

  return (
    <div className="space-y-5">
      {/* Encabezado con selector de período + acciones rápidas */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">Resumen</h2>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={period === "custom" || period.startsWith("custom:") ? "custom" : period}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "custom") {
                setShowCustom(true);
                // No cambiar period hasta que se seleccionen fechas
              } else {
                setShowCustom(false);
                setPeriod(v);
              }
            }}
            className="h-9 w-[200px] rounded-md border border-input bg-background px-3 text-sm"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
            <option value="custom">📅 Por fecha...</option>
          </select>
          {showCustom && (
            <div className="flex items-center gap-1">
              <Input type="date" value={customStart} onChange={(e) => {
                setCustomStart(e.target.value);
                if (e.target.value && customEnd) {
                  setPeriod(`custom:${e.target.value}:${customEnd}`);
                }
              }} className="w-[140px] h-8" />
              <span className="text-xs text-muted-foreground">→</span>
              <Input type="date" value={customEnd} onChange={(e) => {
                setCustomEnd(e.target.value);
                if (customStart && e.target.value) {
                  setPeriod(`custom:${customStart}:${e.target.value}`);
                }
              }} className="w-[140px] h-8" />
            </div>
          )}
          <Button onClick={() => setGastoFormOpen(true)} variant="outline" size="sm">
            <Receipt className="mr-1 h-4 w-4" /> Gasto
          </Button>
          <Button onClick={() => setPagoFormOpen(true)} variant="outline" size="sm" className="bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300">
            <Banknote className="mr-1 h-4 w-4" /> Recibir pago
          </Button>
          {/* Solo el chofer puede registrar entregas, no el admin */}
          {!isDueno && (
            <Button onClick={() => setEntregaFormOpen(true)} size="sm">
              <Plus className="mr-1 h-4 w-4" /> Entrega
            </Button>
          )}
          {/* Botones de descarga: un solo resumen diario en PDF o Excel */}
          <DownloadButton
            label="Resumen PDF"
            icon={<FileText className="mr-1 h-3.5 w-3.5" />}
            url={`/api/akuosplash/reportes/descargar?formato=pdf&period=${period}`}
            filename={`resumen-${period}.pdf`}
          />
          <DownloadButton
            label="Resumen Excel"
            icon={<FileSpreadsheet className="mr-1 h-3.5 w-3.5" />}
            url={`/api/akuosplash/reportes/descargar?formato=excel&period=${period}`}
            filename={`resumen-${period}.xlsx`}
          />
        </div>
      </div>

      {/* Aviso para chofer sin camiones asignados */}
      {/* Solo mostrar si NO hay vuelta activa con camión — si la hay, el chofer puede seguir trabajando */}
      {!isDueno && camiones.filter((c) => c.activo).length === 0 && !(vueltaActual?.camion) && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              No tienes camiones asignados
            </p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
              Para registrar entregas necesitas un camión asignado. Pídele al administrador de la flota que te asigne uno desde <strong>Ajustes → Camiones → Asignar choferes</strong>. Una vez asignado, podrás iniciar vueltas y registrar entregas.
            </p>
          </div>
        </div>
      )}

      {/* Widget de fotos pendientes offline (solo visible si hay fotos sin subir) */}
      <OfflinePhotosWidget />

      {/* Vuelta actual */}
      <VueltaWidget
        vueltaActual={vueltaActual}
        camiones={camiones}
        isDueno={isDueno}
        umbralCompletacionVuelta={config?.umbralCompletacionVuelta ?? 0.975}
        onVueltaChange={() => {
          cargarVuelta();
          onRefresh();
        }}
        onRegistrarEntrega={() => setEntregaFormOpen(true)}
      />

      {/* Resumen de efectivo de la vuelta actual */}
      {vueltaActual && vueltaActual.cantidadEntregas > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10">
            <CardContent className="p-3">
              <p className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                <Banknote className="h-3 w-3" /> Efectivo vuelta
              </p>
              <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(vueltaActual.efectivoRecibido || 0)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10">
            <CardContent className="p-3">
              <p className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                <Smartphone className="h-3 w-3" /> Transferencia vuelta
              </p>
              <p className="text-lg font-bold tabular-nums text-blue-600 dark:text-blue-400">
                {formatCurrency(vueltaActual.transferenciaRecibida ?? 0)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-3">
              <p className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                <DollarSign className="h-3 w-3" /> Total ventas vuelta
              </p>
              <p className="text-lg font-bold tabular-nums text-primary">
                {formatCurrency(vueltaActual.ventas || 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading || !resumen ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <StatCard
              label="Ventas"
              value={formatCurrency(resumen.totalVentas)}
              hint={`${resumen.cantidadEntregas} entregas`}
              icon={DollarSign}
              tone="positive"
            />
            <StatCard
              label="Efectivo"
              value={formatCurrency(resumen.totalEfectivoRecibido)}
              hint="Total recibido"
              icon={Banknote}
              tone="accent"
            />
            <StatCard
              label="Transferencia"
              value={formatCurrency(resumen.totalTransferenciaRecibida)}
              hint="Total recibido"
              icon={Smartphone}
            />
            <StatCard
              label="Por cobrar"
              value={formatCurrency(resumen.totalPorCobrar)}
              hint="Saldo pendiente"
              icon={Wallet}
              tone={resumen.totalPorCobrar > 0 ? "warning" : "default"}
            />
          </>
        )}
      </div>

      {/* Litros + Vueltas + Utilidad */}
      <div className="grid gap-3 lg:grid-cols-3">
        {loading || !resumen ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <StatCard
              label="Litros entregados"
              value={`${formatNumber(resumen.totalLitros, 0)} L`}
              hint={resumen.capacidadCamion > 0 ? `Camión: ${formatNumber(resumen.capacidadCamion, 0)} L` : "Acumulado"}
              icon={Droplets}
            />
            <StatCard
              label="Vueltas del período"
              value={String(resumen.cantidadVueltas)}
              hint={resumen.modoLiquidacion === "vuelta" ? `Pago: ${formatCurrency(resumen.pagoChoferCalculado)}` : "Modo porcentaje"}
              icon={Repeat}
            />
            <StatCard
              label="Utilidad bruta"
              value={formatCurrency(resumen.utilidadBruta)}
              hint="Ventas − gastos"
              icon={TrendingUp}
              tone={resumen.utilidadBruta >= 0 ? "positive" : "negative"}
            />
          </>
        )}
      </div>

      {/* Gastos separados por pagador */}
      {resumen && !loading && resumen.totalGastos > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="Gastos totales"
            value={formatCurrency(resumen.totalGastos)}
            hint={`${resumen.cantidadGastos} gastos`}
            icon={TrendingDown}
            tone="negative"
          />
          <StatCard
            label="Pagados por chofer"
            value={formatCurrency(resumen.gastosChofer)}
            hint="Reembolsables"
            icon={Wallet}
            tone="warning"
          />
          <StatCard
            label="Pagados por administración"
            value={formatCurrency(resumen.gastosDueno)}
            hint="No reembolsables"
            icon={Receipt}
          />
        </div>
      )}

      {/* Gastos por tipo */}
      {resumen && !loading && Object.keys(resumen.gastosPorTipo).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Gastos por tipo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(resumen.gastosPorTipo).map(([tipo, monto]) => (
              <div
                key={tipo}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
              >
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                    {tipo === "combustible_camion" || tipo === "combustible_motobamba" ? (
                      <Fuel className="h-4 w-4" />
                    ) : tipo === "agua_planta" ? (
                      <Droplets className="h-4 w-4" />
                    ) : tipo === "cloro" ? (
                      <Gauge className="h-4 w-4" />
                    ) : (
                      <Receipt className="h-4 w-4" />
                    )}
                  </div>
                  <span className="text-sm">{labelTipoGasto(tipo)}</span>
                </div>
                <span className="font-semibold tabular-nums">{formatCurrency(monto)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Vueltas del período */}
      {resumen && !loading && resumen.vueltas && resumen.vueltas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Vueltas del período ({resumen.vueltas.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {resumen.vueltas.map((v) => {
                const expandida = vueltaExpandida === v.id;
                const entregas = entregasVuelta[v.id] || [];
                const cargando = cargandoEntregasVuelta.has(v.id);
                return (
                  <div key={v.id}>
                    <button
                      type="button"
                      onClick={() => toggleVueltaDetalle(v.id)}
                      className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/30"
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold ${
                        v.activa
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}>
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
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(v.iniciadaEn)}
                          {v.cerradaEn ? ` → ${formatDate(v.cerradaEn)}` : " · en curso"}
                          {" · "}{v.numEntregas} entrega(s)
                          {" · "}{formatNumber(v.litros, 0)} L
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums text-sm">{formatCurrency(v.ventas)}</p>
                        <div className="flex items-center gap-2 text-xs">
                          {v.efectivo > 0 && <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">Efect: {formatCurrency(v.efectivo)}</span>}
                          {v.transferencia > 0 && <span className="text-blue-600 dark:text-blue-400 tabular-nums">Trans: {formatCurrency(v.transferencia)}</span>}
                        </div>
                      </div>
                      {expandida ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    </button>

                    {/* Detalle de entregas de la vuelta */}
                    {expandida && (
                      <div className="border-t border-border bg-muted/10 p-3 space-y-2">
                        {cargando ? (
                          <div className="flex items-center justify-center py-4">
                            <Skeleton className="h-16 w-full rounded-lg" />
                          </div>
                        ) : entregas.length === 0 ? (
                          <p className="py-4 text-center text-sm text-muted-foreground">No hay entregas en esta vuelta.</p>
                        ) : (
                          <>
                            {entregas.map((e: any, idx: number) => (
                              <div key={e.id} className="rounded-lg border border-border bg-background p-2.5 text-sm">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                                      <span className="font-medium truncate">{e.clienteNombre}</span>
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-0.5">
                                        <Droplets className="h-3 w-3" /> {formatNumber(e.litros, 0)} L
                                      </span>
                                      <span>·</span>
                                      <span>{labelMetodoPago(e.metodoPago)}</span>
                                      <span>·</span>
                                      <span className="tabular-nums">{formatCurrency(e.total)}</span>
                                      <span>·</span>
                                      <span className="flex items-center gap-0.5">
                                        <Clock className="h-3 w-3" /> {formatDate(e.fecha)}
                                      </span>
                                    </div>
                                    {e.descuento > 0 && (
                                      <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                                        Descuento: {formatCurrency(e.descuento)} ({e.descuentoPor === "chofer" ? "asumido por chofer" : "asumido por administración"})
                                      </p>
                                    )}
                                    {e.fotoMedidorUrl && (
                                      <a href={e.fotoMedidorUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block">
                                        <img src={e.fotoMedidorUrl} alt="Medidor" className="h-14 rounded border border-border" />
                                      </a>
                                    )}
                                  </div>
                                  <div className="shrink-0 text-right">
                                    {e.montoEfectivo > 0 && <p className="text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">Efect: {formatCurrency(e.montoEfectivo)}</p>}
                                    {e.montoTransferencia > 0 && <p className="text-xs text-blue-600 dark:text-blue-400 tabular-nums">Trans: {formatCurrency(e.montoTransferencia)}</p>}
                                    {e.total - e.montoRecibido > 0 && <p className="text-xs text-amber-600 dark:text-amber-400 tabular-nums">Saldo: {formatCurrency(e.total - e.montoRecibido)}</p>}
                                    <span className={`ml-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                      e.estadoPago === "pagado" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                                      : e.estadoPago === "parcial" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                      : "bg-muted text-muted-foreground"
                                    }`}>
                                      {e.estadoPago}
                                    </span>
                                  </div>
                                </div>
                                {/* Detalle de estanques */}
                                {e.detalleEstanquesJson && (() => {
                                  let estanques: any[] = [];
                                  try { estanques = JSON.parse(e.detalleEstanquesJson); } catch { return null; }
                                  if (estanques.length === 0) return null;
                                  return (
                                    <div className="mt-1.5 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-1.5 space-y-0.5">
                                      {estanques.map((est, i) => (
                                        <div key={i} className="flex items-center justify-between text-[11px]">
                                          <span className="text-amber-900 dark:text-amber-200">
                                            {est.nombre}: {formatNumber(est.litros, 0)} L · {est.metodoPago}
                                          </span>
                                          <span className="tabular-nums text-amber-900 dark:text-amber-200">{formatCurrency(est.total)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                            {/* Totales de la vuelta */}
                            <div className="rounded-lg bg-muted/40 p-2 text-center text-xs">
                              <div className="grid grid-cols-4 gap-2">
                                <div>
                                  <p className="text-[10px] uppercase text-muted-foreground">Entregas</p>
                                  <p className="font-bold">{entregas.length}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase text-muted-foreground">Litros</p>
                                  <p className="font-bold tabular-nums">{formatNumber(entregas.reduce((s: number, e: any) => s + e.litros, 0), 0)} L</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase text-muted-foreground">Ventas</p>
                                  <p className="font-bold tabular-nums">{formatCurrency(entregas.reduce((s: number, e: any) => s + e.total, 0))}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase text-muted-foreground">Efectivo</p>
                                  <p className="font-bold tabular-nums text-emerald-600">{formatCurrency(entregas.reduce((s: number, e: any) => s + (e.montoEfectivo || 0), 0))}</p>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entregas recientes + Gastos recientes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Entregas recientes</CardTitle>
              <Button variant="ghost" size="sm" onClick={onGoToEntregas}>
                Ver todas <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
            ) : recientes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No hay entregas en este período.
              </div>
            ) : (
              recientes.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-medium">{e.clienteNombre}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {labelEstadoPago(e.estadoPago)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {labelMetodoPago(e.metodoPago)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.fecha)} · {formatNumber(e.litros, 0)} L
                      {e.vuelta && ` · Vuelta #${e.vuelta.numero}`}
                    </p>
                    {e.fotoMedidorUrl && (
                      <a href={e.fotoMedidorUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block">
                        <img src={e.fotoMedidorUrl} alt="Medidor" className="h-16 rounded border border-border" />
                      </a>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatCurrency(e.total)}</p>
                    {e.montoRecibido < e.total && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Saldo {formatCurrency(e.total - e.montoRecibido)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Gastos recientes</CardTitle>
              <Button variant="ghost" size="sm" onClick={onGoToGastos}>
                Ver todos <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
            ) : gastosRecientes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No hay gastos en este período.
              </div>
            ) : (
              gastosRecientes.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{labelTipoGasto(g.tipo)}</span>
                    {g.descripcion && (
                      <p className="truncate text-xs text-muted-foreground">{g.descripcion}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDate(g.fecha)} · Pagó: {g.pagadoPor === "chofer" ? "Chofer" : "Administrador"}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                    −{formatCurrency(g.monto)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Formularios modales */}
      <EntregaForm
        open={entregaFormOpen}
        onOpenChange={setEntregaFormOpen}
        onSaved={() => {
          onRefresh();
          cargarVuelta();
        }}
        onVueltaIniciada={() => {
          cargarVuelta();
          onRefresh();
        }}
        clientes={clientes}
        config={config}
        vueltaActual={vueltaActual}
        pedidosPendientes={pedidosPendientes}
        camiones={camiones}
        isDueno={isDueno}
      />
      {/* Diálogo: Recibir pago */}
      <Dialog open={pagoFormOpen} onOpenChange={setPagoFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recibir pago</DialogTitle>
            <DialogDescription>
              Registrá un pago recibido. Podés elegir un cliente o registrar un pago sin cliente.
            </DialogDescription>
          </DialogHeader>
          <PagoDirectoForm
            clientes={clientes}
            onSaved={() => {
              setPagoFormOpen(false);
              onRefresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <GastoForm open={gastoFormOpen} onOpenChange={setGastoFormOpen} onSaved={onRefresh} />
    </div>
  );
}

// Botón de descarga que usa fetch con token de autenticación (no depende de cookies)
function DownloadButton({ label, icon, url, filename }: { label: string; icon: React.ReactNode; url: string; filename: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      // Obtener token del localStorage (mismo mecanismo que api-client)
      const token = typeof window !== "undefined" ? localStorage.getItem("aljibe-token") : null;
      if (!token) {
        throw new Error("No hay sesión activa. Cerrá sesión y volvé a entrar.");
      }
      // Asegurar que la URL tenga el parámetro cache-buster correctamente
      const separator = url.includes("?") ? "&" : "?";
      const finalUrl = `${url}${separator}_t=${Date.now()}`;
      const res = await fetch(finalUrl, {
        credentials: "include",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        let msg = `Error ${res.status}`;
        try {
          const j = JSON.parse(txt);
          msg += `: ${j.error || j.message || ""}`;
        } catch {
          if (txt) msg += `: ${txt.slice(0, 200)}`;
        }
        if (res.status === 401) {
          msg += "\n\nTu sesión expiró. Cerrá sesión y volvé a entrar.";
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      if (blob.size === 0) {
        throw new Error("El servidor devolvió un archivo vacío");
      }
      // Crear URL temporal y disparar descarga
      // Usar el filename que viene del backend (Content-Disposition) si está disponible
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const finalFilename = filenameMatch ? filenameMatch[1] : filename;
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Limpiar URL temporal después de un momento
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e) {
      console.error("[DownloadButton] error:", e);
      alert(e instanceof Error ? e.message : "No se pudo descargar el archivo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
    >
      {loading ? (
        <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Descargando…</>
      ) : (
        <>{icon} {label}</>
      )}
    </button>
  );
}

// === Formulario de pago directo (con o sin cliente) ===
function PagoDirectoForm({ clientes, onSaved }: { clientes: any[]; onSaved: () => void }) {
  const [tipo, setTipo] = useState<"cliente" | "general">("cliente");
  const [clienteId, setClienteId] = useState("");
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [descripcion, setDescripcion] = useState("");
  const [nota, setNota] = useState("");
  const [fecha, setFecha] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const montoNum = Number(monto);
    if (!montoNum || montoNum <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    if (tipo === "cliente" && !clienteId) {
      toast.error("Elegí un cliente o cambiá a 'Pago sin cliente'");
      return;
    }
    if (tipo === "general" && !descripcion.trim()) {
      toast.error("La descripción es obligatoria para pagos sin cliente");
      return;
    }

    setSaving(true);
    try {
      await apiPost("/api/akuosplash/pagos", {
        clienteId: tipo === "cliente" ? clienteId : null,
        monto: montoNum,
        metodoPago: metodo,
        descripcion: tipo === "general" ? descripcion.trim() : undefined,
        nota: nota.trim() || null,
        ...(fecha ? { fecha } : {}),
      });
      toast.success("Pago registrado");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Tipo de pago */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTipo("cliente")}
          className={`flex-1 rounded-md border p-2 text-sm ${tipo === "cliente" ? "border-primary bg-primary/5 font-medium" : ""}`}
        >
          Pago de cliente
        </button>
        <button
          type="button"
          onClick={() => setTipo("general")}
          className={`flex-1 rounded-md border p-2 text-sm ${tipo === "general" ? "border-primary bg-primary/5 font-medium" : ""}`}
        >
          Pago sin cliente
        </button>
      </div>

      {/* Cliente o descripción */}
      {tipo === "cliente" ? (
        <div>
          <Label className="text-xs">Cliente *</Label>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Elegir cliente…</option>
            {clientes.map((c: any) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <Label className="text-xs">Descripción *</Label>
          <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Pago de alquiler, reembolso, etc." />
        </div>
      )}

      {/* Monto */}
      <div>
        <Label className="text-xs">Monto *</Label>
        <Input type="number" min="1" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Ej: 25000" />
      </div>

      {/* Método */}
      <div>
        <Label className="text-xs">Método de pago</Label>
        <select
          value={metodo}
          onChange={(e) => setMetodo(e.target.value)}
          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="mixto">Mixto</option>
        </select>
      </div>

      {/* Nota */}
      <div>
        <Label className="text-xs">Nota (opcional)</Label>
        <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: Pago de agosto" />
      </div>

      {/* Fecha */}
      <div>
        <Label className="text-xs">Fecha del pago (opcional)</Label>
        <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <p className="text-[10px] text-muted-foreground mt-0.5">Dejar vacío para hoy.</p>
      </div>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Guardando…</> : "Registrar pago"}
      </Button>
    </form>
  );
}
