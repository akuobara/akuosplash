"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Printer,
  HandCoins,
  Wallet,
  TrendingDown,
  TrendingUp,
  Receipt,
  Users,
  Repeat,
  Banknote,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPut } from "@/lib/api-client";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  labelTipoGasto,
  labelModoLiquidacion,
  MODOS_LIQUIDACION,
} from "@/lib/helpers";
import { StatCard } from "./stat-card";

type Period = "hoy" | "semana" | "mes" | "todo";

interface Config {
  id: string;
  nombreChofer: string;
  nombreDueno: string;
  capacidadCamion: number;
  modoLiquidacion: string;
  porcentajeComisionChofer: number;
  porcentajeComisionDueno: number;
  montoPorVueltaUnicoCliente: number;
  montoPorVueltaMultiple: number;
  precioEfectivoPorLitro: number;
  precioTransferenciaPorLitro: number;
  tipoTributo: string;
  porcentajeImpuesto: number;
  aplicaImpuestoSobre: string;
}

interface VueltaDetalle {
  id: string;
  numero: number;
  iniciadaEn: string;
  cerradaEn: string | null;
  cantidadEntregas: number;
  esMultiple: boolean;
  litros: number;
  litrosRestantes: number;
  capacidadCamion: number;
  camion?: { id: string; nombre: string; patente: string | null; capacidad: number } | null;
  ventas: number;
  efectivo: number;
  transferencia: number;
  montoPago: number;
  completada?: boolean;
  porcentajeCompletado?: number;
}

interface LiquidacionData {
  period: string;
  config: Config;
  resumen: {
    totalVentas: number;
    totalEfectivoRecibido: number;
    totalTransferenciaRecibida: number;
    totalRecibido: number;
    totalPorCobrar: number;
    totalGastos: number;
    gastosChofer: number;
    gastosDueno: number;
    utilidadBruta: number;
    pagoChofer: number;
    pagoDueno: number;
    baseImponible: number;
    impuesto: number;
    liquidoChoferAntesDeEfectivo: number;
    saldoChofer: number;
    cantidadVueltas: number;
    vueltasValidas?: number;
    vueltasExcluidas?: number;
    vueltasUnicoCliente: number;
    vueltasMultiple: number;
  };
  vueltas: VueltaDetalle[];
  vueltasExcluidas?: VueltaDetalle[];
  gastosPorTipo: { tipo: string; label: string; monto: number }[];
  topClientes: { nombre: string; litros: number; total: number; entregas: number }[];
  cantidadEntregas: number;
  cantidadGastos: number;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "todo", label: "Todo" },
];

interface LiquidacionTabProps {
  refreshKey: number;
  onRefresh: () => void;
  config: Config | null;
}

export function LiquidacionTab({ refreshKey, onRefresh, config }: LiquidacionTabProps) {
  const [period, setPeriod] = useState<Period>("mes");
  const [data, setData] = useState<LiquidacionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);

  // === Nuevo: liquidación por período configurado (semanal/mensual) ===
  const [periodoOffset, setPeriodoOffset] = useState(0); // 0 = actual, -1 = anterior, etc.
  const [periodoData, setPeriodoData] = useState<any>(null);
  const [periodoLoading, setPeriodoLoading] = useState(false);
  const [vistaPeriodo, setVistaPeriodo] = useState(true); // true = vista por período configurado (default)

  // Estado para resumen mensual descargable
  const now = new Date();
  const [resumenYear, setResumenYear] = useState(now.getFullYear());
  const [resumenMonth, setResumenMonth] = useState(now.getMonth()); // 0-indexed
  const [descargandoResumen, setDescargandoResumen] = useState(false);

  const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  async function descargarResumenMensual(formato: "pdf" | "excel") {
    setDescargandoResumen(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("aljibe-token") : null;
      if (!token) throw new Error("No hay sesión activa");
      const url = `/api/liquidacion/resumen-mensual?year=${resumenYear}&month=${resumenMonth}&formato=${formato}&_t=${Date.now()}`;
      const res = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Error ${res.status}: ${txt}`);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `liquidacion-${MONTH_NAMES[resumenMonth]}-${resumenYear}.${formato === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo descargar");
    } finally {
      setDescargandoResumen(false);
    }
  }

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<LiquidacionData>(`/api/reportes/liquidacion?period=${period}`);
      setData(r);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar la liquidación");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  // === Cargar período configurado (semanal/mensual) ===
  const cargarPeriodo = useCallback(async () => {
    setPeriodoLoading(true);
    try {
      const r = await apiGet<any>(`/api/liquidacion/periodo?offset=${periodoOffset}`);
      setPeriodoData(r);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar el período");
    } finally {
      setPeriodoLoading(false);
    }
  }, [periodoOffset]);

  useEffect(() => {
    if (vistaPeriodo) cargarPeriodo();
  }, [vistaPeriodo, cargarPeriodo, refreshKey]);

  const r = data?.resumen;
  const cfg = data?.config;
  const esModoVuelta = cfg?.modoLiquidacion === "vuelta";

  return (
    <div className="space-y-5">
      {/* Selector de vista: período configurado vs libre */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={vistaPeriodo ? "default" : "outline"}
                onClick={() => setVistaPeriodo(true)}
              >
                Por período configurado
              </Button>
              <Button
                size="sm"
                variant={!vistaPeriodo ? "default" : "outline"}
                onClick={() => setVistaPeriodo(false)}
              >
                Vista libre
              </Button>
            </div>
            {vistaPeriodo && periodoData?.periodo && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setPeriodoOffset(o => o - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>
                <div className="text-center min-w-[180px]">
                  <p className="text-xs text-muted-foreground">
                    {periodoData.config?.periodoLiquidacion === "semanal" ? "Semana" : "Mes"}
                  </p>
                  <p className="text-sm font-semibold">{periodoData.periodo.label}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPeriodoOffset(o => Math.min(0, o + 1))}
                  disabled={periodoOffset >= 0}
                >
                  Siguiente <ChevronRight className="h-4 w-4" />
                </Button>
                {periodoOffset !== 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setPeriodoOffset(0)}>
                    Actual
                  </Button>
                )}
              </div>
            )}
          </div>
          {vistaPeriodo && (
            <p className="mt-2 text-xs text-muted-foreground">
              {periodoData?.config?.periodoLiquidacion === "semanal"
                ? "Semana de domingo a sábado. Configurá el día de cierre en Ajustes."
                : "Mes calendario (día 1 al último día del mes)."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Vista por período configurado */}
      {vistaPeriodo && periodoData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Liquidación — {periodoData.periodo.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {periodoLoading ? (
              <Skeleton className="h-40 rounded" />
            ) : (
              <>
                {/* Resumen del período */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
                  <div className="rounded border p-2">
                    <p className="text-xs text-muted-foreground">Ventas</p>
                    <p className="font-bold">{formatCurrency(periodoData.resumen.totalVentas)}</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-xs text-muted-foreground">Litros</p>
                    <p className="font-bold">{formatNumber(periodoData.resumen.totalLitros, 0)} L</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-xs text-muted-foreground">Efectivo</p>
                    <p className="font-bold">{formatCurrency(periodoData.resumen.totalEfectivo)}</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-xs text-muted-foreground">Transferencia</p>
                    <p className="font-bold">{formatCurrency(periodoData.resumen.totalTransferencia)}</p>
                  </div>
                </div>

                {/* Gastos y liquidación */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded border p-2">
                    <p className="text-xs text-muted-foreground">Gastos totales</p>
                    <p className="font-bold">{formatCurrency(periodoData.resumen.totalGastos)}</p>
                    <p className="text-xs text-muted-foreground">Chofer: {formatCurrency(periodoData.resumen.gastosChofer)}</p>
                    <p className="text-xs text-muted-foreground">Dueño: {formatCurrency(periodoData.resumen.gastosDueno)}</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-xs text-muted-foreground">Utilidad bruta</p>
                    <p className="font-bold">{formatCurrency(periodoData.resumen.utilidadBruta)}</p>
                  </div>
                </div>

                {/* Liquidación chofer */}
                <div className="rounded border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10 p-3 space-y-1 text-sm">
                  <p className="font-medium text-emerald-800 dark:text-emerald-300">
                    Liquidación del chofer ({labelModoLiquidacion(periodoData.config.modoLiquidacion)})
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Pago chofer</p>
                      <p className="font-bold">{formatCurrency(periodoData.resumen.pagoChofer)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gastos reembolsables</p>
                      <p className="font-bold">{formatCurrency(periodoData.resumen.gastosChofer)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Descuentos</p>
                      <p className="font-bold">{formatCurrency(periodoData.resumen.descuentosChofer)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Impuesto</p>
                      <p className="font-bold">{formatCurrency(periodoData.resumen.impuesto)}</p>
                    </div>
                  </div>
                  <div className="border-t border-emerald-300 pt-2 mt-2">
                    <p className="text-xs text-muted-foreground">Líquido chofer (antes de efectivo)</p>
                    <p className="text-lg font-bold">{formatCurrency(periodoData.resumen.liquidoChofer)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      − Efectivo recibido: {formatCurrency(periodoData.resumen.totalEfectivo)}
                    </p>
                    <p className={`text-base font-bold ${periodoData.resumen.saldoChofer >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                      {periodoData.resumen.saldoChofer >= 0
                        ? `Dueño debe al chofer: ${formatCurrency(Math.abs(periodoData.resumen.saldoChofer))}`
                        : `Chofer debe al dueño: ${formatCurrency(Math.abs(periodoData.resumen.saldoChofer))}`}
                    </p>
                  </div>
                </div>

                {/* Vueltas del período */}
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground mb-2">
                    Vueltas ({periodoData.vueltas?.length || 0} totales, {periodoData.resumen.vueltasCompletadas} completadas)
                  </p>
                  {periodoData.vueltas && periodoData.vueltas.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="p-2">#</th>
                            <th className="p-2">Inicio</th>
                            <th className="p-2">Cierre</th>
                            <th className="p-2">Camión</th>
                            <th className="p-2">Chofer</th>
                            <th className="p-2">Entregas</th>
                            <th className="p-2">Litros</th>
                            <th className="p-2">Ventas</th>
                            <th className="p-2">Compl.</th>
                            <th className="p-2">Pago</th>
                          </tr>
                        </thead>
                        <tbody>
                          {periodoData.vueltas.map((v: any) => (
                            <tr key={v.id} className="border-b last:border-0">
                              <td className="p-2">{v.numero}</td>
                              <td className="p-2 whitespace-nowrap">{formatDateTime(v.iniciadaEn)}</td>
                              <td className="p-2 whitespace-nowrap">{v.cerradaEn ? formatDateTime(v.cerradaEn) : "En curso"}</td>
                              <td className="p-2">{v.camion}</td>
                              <td className="p-2">{v.chofer}</td>
                              <td className="p-2">{v.cantidadEntregas}</td>
                              <td className="p-2">{formatNumber(v.litros, 0)} L</td>
                              <td className="p-2">{formatCurrency(v.ventas)}</td>
                              <td className="p-2">{v.completada ? "Sí" : "No"}</td>
                              <td className="p-2">{formatCurrency(v.pagoVuelta)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-2">Sin vueltas en este período.</p>
                  )}
                </div>

                {/* Gastos del período */}
                {periodoData.gastos && periodoData.gastos.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground mb-2">
                      Gastos del período ({periodoData.gastos.length})
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="p-2">Fecha</th>
                            <th className="p-2">Tipo</th>
                            <th className="p-2">Descripción</th>
                            <th className="p-2">Monto</th>
                            <th className="p-2">Pagado por</th>
                          </tr>
                        </thead>
                        <tbody>
                          {periodoData.gastos.map((g: any) => (
                            <tr key={g.id} className="border-b last:border-0">
                              <td className="p-2 whitespace-nowrap">{formatDateTime(g.fecha)}</td>
                              <td className="p-2">{labelTipoGasto(g.tipo)}</td>
                              <td className="p-2">{g.descripcion || "—"}</td>
                              <td className="p-2">{formatCurrency(g.monto)}</td>
                              <td className="p-2">{g.pagadoPor === "chofer" ? "Chofer" : "Dueño"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resumen mensual descargable */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Resumen mensual de liquidación</p>
              <p className="text-sm font-medium">Descargá el resumen de cualquier mes para imposiciones y pagos</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label className="text-xs">Mes</Label>
                <select
                  value={resumenMonth}
                  onChange={(e) => setResumenMonth(Number(e.target.value))}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Año</Label>
                <Input
                  type="number"
                  value={resumenYear}
                  onChange={(e) => setResumenYear(Number(e.target.value))}
                  className="w-[100px] h-9"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => descargarResumenMensual("pdf")}
                disabled={descargandoResumen}
              >
                {descargandoResumen ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />} PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => descargarResumenMensual("excel")}
                disabled={descargandoResumen}
              >
                {descargandoResumen ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />} Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">Liquidación con la administración</h2>
          <p className="text-sm text-muted-foreground">
            {cfg ? (
              <>Modo: <strong>{labelModoLiquidacion(cfg.modoLiquidacion)}</strong></>
            ) : (
              "Cargando…"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            <Receipt className="mr-1 h-4 w-4" /> Cambiar modo
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Imprimir
          </Button>
          <a href={`/api/reportes/descargar?tipo=completo&formato=pdf&period=${period}`} target="_blank">
            <Button variant="outline" size="sm">
              <FileText className="mr-1 h-4 w-4" /> PDF
            </Button>
          </a>
          <a href={`/api/reportes/descargar?tipo=completo&formato=excel&period=${period}`} target="_blank">
            <Button variant="outline" size="sm">
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
          </a>
        </div>
      </div>

      {/* Tarjeta principal de liquidación */}
      {loading || !r || !cfg ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : esModoVuelta ? (
        <LiquidacionVuelta r={r} cfg={cfg} period={period} />
      ) : (
        <LiquidacionPorcentaje r={r} cfg={cfg} period={period} />
      )}

      {/* KPIs secundarios */}
      {r && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Ventas totales"
            value={formatCurrency(r.totalVentas)}
            icon={TrendingUp}
            tone="positive"
          />
          <StatCard
            label="Efectivo en ruta"
            value={formatCurrency(r.totalEfectivoRecibido)}
            icon={Banknote}
            tone="accent"
          />
          <StatCard
            label="Transferencia"
            value={formatCurrency(r.totalTransferenciaRecibida)}
            icon={Smartphone}
          />
          <StatCard
            label="Por cobrar"
            value={formatCurrency(r.totalPorCobrar)}
            icon={HandCoins}
            tone={r.totalPorCobrar > 0 ? "warning" : "default"}
          />
        </div>
      )}

      {/* Gastos por pagador */}
      {r && r.totalGastos > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="Gastos totales"
            value={formatCurrency(r.totalGastos)}
            icon={TrendingDown}
            tone="negative"
          />
          <StatCard
            label="Pagados por chofer"
            value={formatCurrency(r.gastosChofer)}
            hint={esModoVuelta ? "Reembolsables" : undefined}
            icon={Wallet}
            tone="warning"
          />
          <StatCard
            label="Pagados por administración"
            value={formatCurrency(r.gastosDueno)}
            icon={Receipt}
          />
        </div>
      )}

      {/* Detalle de vueltas (solo en modo vuelta) */}
      {esModoVuelta && data && (
        <>
          {/* Aviso de vueltas excluidas */}
          {data.vueltasExcluidas && data.vueltasExcluidas.length > 0 && (
            <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      {data.vueltasExcluidas.length} vuelta{data.vueltasExcluidas.length !== 1 ? "s" : ""} sin completar — no cuentan para el pago
                    </p>
                    <p className="mt-0.5 text-xs text-amber-900 dark:text-amber-200">
                      Una vuelta se considera válida cuando se entrega al menos el 97.5% de la capacidad del camión.
                      {" "}Las vueltas listadas abajo se cerraron sin alcanzar ese umbral.
                    </p>
                    <ul className="mt-2 space-y-1 text-xs">
                      {data.vueltasExcluidas.map((v) => (
                        <li key={v.id} className="flex items-center justify-between gap-2 rounded bg-white/60 px-2 py-1 dark:bg-black/20">
                          <span className="text-amber-900 dark:text-amber-200">
                            <strong>#{v.numero}</strong> · {v.cantidadEntregas} entrega(s) ·{" "}
                            {formatNumber(v.litros, 0)} L de {formatNumber(v.capacidadCamion, 0)} L
                            {" ("}{v.porcentajeCompletado?.toFixed(0) ?? 0}%{")"}
                          </span>
                          <span className="text-amber-700 dark:text-amber-300 tabular-nums">
                            Excluida — {formatCurrency(v.montoPago)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {data.vueltas.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">
                    Vueltas válidas para liquidación ({data.vueltas.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {data.vueltas.map((v) => (
                    <li key={v.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg font-bold ${
                          v.esMultiple
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          #{v.numero}
                        </div>
                        <div>
                          <p className="font-medium flex items-center gap-1.5 flex-wrap">
                            Vuelta #{v.numero}
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Completada
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({v.esMultiple ? "múltiples clientes" : "cliente único"})
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(v.iniciadaEn)}
                            {v.cerradaEn ? ` → ${formatDateTime(v.cerradaEn)}` : " · En curso"}
                            {v.camion && ` · ${v.camion.nombre}`}
                            {" · "}
                            {v.cantidadEntregas} entrega(s) · {formatNumber(v.litros, 0)} L entregados
                            {v.capacidadCamion > 0 && (
                              <> de {formatNumber(v.capacidadCamion, 0)} L ({v.porcentajeCompletado?.toFixed(0) ?? 100}%)</>
                            )}
                            {" · "}
                            {formatCurrency(v.ventas)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase text-muted-foreground">Pago al chofer</p>
                        <p className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(v.montoPago)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border bg-muted/30 p-3 text-right text-sm">
                  <span className="text-muted-foreground">Total pago al chofer por vueltas válidas: </span>
                  <span className="font-bold tabular-nums">{formatCurrency(r?.pagoChofer ?? 0)}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Desglose de gastos por tipo */}
      {data && data.gastosPorTipo.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Gastos por tipo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.gastosPorTipo.map((g) => (
              <div
                key={g.tipo}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
              >
                <span className="text-sm">{g.label}</span>
                <span className="font-semibold tabular-nums">{formatCurrency(g.monto)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Top clientes */}
      {data && data.topClientes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Top clientes del período</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {data.topClientes.map((c, i) => (
                <li key={c.nombre} className="flex items-center gap-3 p-3 sm:p-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.entregas} entrega{c.entregas !== 1 ? "s" : ""} · {formatNumber(c.litros, 0)} L
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{formatCurrency(c.total)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Modal de configuración rápida */}
      <ConfigModal
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={config}
        onSaved={onRefresh}
      />
    </div>
  );
}

// ====== Componente: Liquidación Modo Porcentaje ======
function LiquidacionPorcentaje({
  r,
  cfg,
  period,
}: {
  r: NonNullable<LiquidacionData["resumen"]>;
  cfg: Config;
  period: string;
}) {
  return (
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Período</p>
            <p className="font-semibold">{PERIODS.find((p) => p.value === period)?.label}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-muted-foreground">Modo</p>
            <p className="font-semibold">Porcentaje de utilidad</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cálculo</p>
            <div className="space-y-2 text-sm">
              <Row label="Ventas totales" value={formatCurrency(r.totalVentas)} tone="positive" />
              <Row label="Gastos totales" value={`−${formatCurrency(r.totalGastos)}`} tone="negative" />
              <div className="border-t border-border pt-2">
                <Row label="Utilidad bruta" value={formatCurrency(r.utilidadBruta)} strong />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
          </div>

          <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Repartición
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>{cfg.nombreChofer} ({cfg.porcentajeComisionChofer}%)</span>
                <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(r.pagoChofer)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{cfg.nombreDueno} ({cfg.porcentajeComisionDueno}%)</span>
                <span className="font-bold tabular-nums">
                  {formatCurrency(r.pagoDueno)}
                </span>
              </div>

              {/* Impuestos */}
              {r.impuesto > 0 && (
                <div className="border-t border-border pt-2">
                  <p className="mb-1 text-xs uppercase text-muted-foreground">Impuestos</p>
                  <Row
                    label={`Base imponible (${cfg.aplicaImpuestoSobre === "pago_chofer" ? "pago chofer" : cfg.aplicaImpuestoSobre === "utilidad_bruta" ? "utilidad" : "ventas"})`}
                    value={formatCurrency(r.baseImponible)}
                  />
                  <Row
                    label={`Impuesto (${cfg.porcentajeImpuesto}% ${cfg.tipoTributo === "boleta_honorarios" ? "boleta honorarios" : cfg.tipoTributo})`}
                    value={`−${formatCurrency(r.impuesto)}`}
                    tone="negative"
                  />
                </div>
              )}

              <div className="border-t border-border pt-2">
                <Row label="Efectivo ya recibido por chofer" value={formatCurrency(r.totalEfectivoRecibido)} />
                <div className="mt-2 rounded-md bg-amber-100/60 p-2 dark:bg-amber-900/30">
                  <Row
                    label={r.saldoChofer >= 0 ? "El administrador le debe al chofer" : "El chofer le debe al administrador"}
                    value={formatCurrency(Math.abs(r.saldoChofer))}
                    strong
                    tone={r.saldoChofer >= 0 ? "positive" : "negative"}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          <strong>Cómo se calcula:</strong> La utilidad bruta (ventas − gastos) se reparte en{" "}
          <strong>{cfg.porcentajeComisionChofer}%</strong> para el chofer y{" "}
          <strong>{cfg.porcentajeComisionDueno}%</strong> para el administrador.
          {r.impuesto > 0 && (
            <> Se descuenta el impuesto ({cfg.porcentajeImpuesto}% sobre {cfg.aplicaImpuestoSobre === "pago_chofer" ? "el pago del chofer" : cfg.aplicaImpuestoSobre === "utilidad_bruta" ? "la utilidad bruta" : "las ventas brutas"}).</>
          )}{" "}
          Como el chofer ya recibió efectivo en ruta, ese monto se descuenta de su parte.
        </p>
      </CardContent>
    </Card>
  );
}

// ====== Componente: Liquidación Modo Vuelta ======
function LiquidacionVuelta({
  r,
  cfg,
  period,
}: {
  r: NonNullable<LiquidacionData["resumen"]>;
  cfg: Config;
  period: string;
}) {
  return (
    <Card className="overflow-hidden border-primary/20">
      <CardContent className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Período</p>
            <p className="font-semibold">{PERIODS.find((p) => p.value === period)?.label}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-muted-foreground">Modo</p>
            <p className="font-semibold">Pago por vuelta</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
          {/* Lado izquierdo: vueltas y gastos */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resumen de vueltas</p>
            <div className="space-y-2 text-sm">
              <Row label="Vueltas a cliente único" value={`${r.vueltasUnicoCliente} × ${formatCurrency(cfg.montoPorVueltaUnicoCliente)}`} />
              <Row label="Vueltas a múltiples clientes" value={`${r.vueltasMultiple} × ${formatCurrency(cfg.montoPorVueltaMultiple)}`} />
              <Row label="Vueltas válidas (≥ 97.5% capacidad)" value={String(r.vueltasValidas ?? (r.cantidadVueltas - (r.vueltasExcluidas ?? 0)))} tone="positive" />
              {(r.vueltasExcluidas ?? 0) > 0 && (
                <Row label="Vueltas sin completar (excluidas)" value={String(r.vueltasExcluidas)} tone="negative" />
              )}
              <Row label="Total vueltas del período" value={String(r.cantidadVueltas)} />
              <div className="border-t border-border pt-2">
                <Row label="Pago al chofer por vueltas válidas" value={formatCurrency(r.pagoChofer)} strong tone="positive" />
              </div>
            </div>

            <Separator className="my-2" />

            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gastos</p>
            <div className="space-y-2 text-sm">
              <Row label="Gastos pagados por chofer (reembolsables)" value={formatCurrency(r.gastosChofer)} tone="warning" />
              <Row label="Gastos pagados por administración" value={formatCurrency(r.gastosDueno)} />
              <div className="border-t border-border pt-2">
                <Row label="Total gastos" value={formatCurrency(r.totalGastos)} tone="negative" />
              </div>
            </div>
          </div>

          {/* Flecha */}
          <div className="flex items-center justify-center">
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
          </div>

          {/* Lado derecho: total a pagar */}
          <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Resumen del pago
            </p>
            <div className="space-y-2 text-sm">
              <Row label="Pago por vueltas" value={formatCurrency(r.pagoChofer)} tone="positive" />
              <Row label="+ Reembolso de gastos" value={formatCurrency(r.gastosChofer)} />

              {/* Impuestos */}
              {r.impuesto > 0 && (
                <div className="border-t border-border pt-2">
                  <p className="mb-1 text-xs uppercase text-muted-foreground">Impuestos</p>
                  <Row
                    label={`Base imponible (${cfg.aplicaImpuestoSobre === "pago_chofer" ? "pago chofer" : cfg.aplicaImpuestoSobre === "utilidad_bruta" ? "utilidad" : "ventas"})`}
                    value={formatCurrency(r.baseImponible)}
                  />
                  <Row
                    label={`Impuesto (${cfg.porcentajeImpuesto}% ${cfg.tipoTributo === "boleta_honorarios" ? "boleta honorarios" : cfg.tipoTributo})`}
                    value={`−${formatCurrency(r.impuesto)}`}
                    tone="negative"
                  />
                </div>
              )}

              <div className="border-t border-border pt-2">
                <Row label="Líquido a recibir (antes de efectivo en ruta)" value={formatCurrency(r.liquidoChoferAntesDeEfectivo)} strong />
              </div>
              <Row label="− Efectivo ya recibido en ruta" value={formatCurrency(r.totalEfectivoRecibido)} tone="negative" />
              <div className="mt-2 rounded-md bg-amber-100/60 p-2 dark:bg-amber-900/30">
                <Row
                  label={r.saldoChofer >= 0 ? "El administrador le debe al chofer" : "El chofer le debe al administrador"}
                  value={formatCurrency(Math.abs(r.saldoChofer))}
                  strong
                  tone={r.saldoChofer >= 0 ? "positive" : "negative"}
                />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          <strong>Cómo se calcula:</strong> Por cada vuelta <strong>válida</strong> recibes{" "}
          <strong>{formatCurrency(cfg.montoPorVueltaUnicoCliente)}</strong> si fue a 1 cliente o{" "}
          <strong>{formatCurrency(cfg.montoPorVueltaMultiple)}</strong> si fue a múltiples clientes.
          {" "}Una vuelta es válida solo si entregaste al menos el <strong>97.5%</strong> de la capacidad del camión.
          {(r.vueltasExcluidas ?? 0) > 0 && (
            <> Las vueltas cerradas sin completar no se contabilizan ({r.vueltasExcluidas} en este período).</>
          )}
          {" "}Se suman los gastos que pagaste tú (reembolsables).
          {r.impuesto > 0 && (
            <> Se descuenta el impuesto ({cfg.porcentajeImpuesto}% sobre {cfg.aplicaImpuestoSobre === "pago_chofer" ? "el pago del chofer" : cfg.aplicaImpuestoSobre === "utilidad_bruta" ? "la utilidad bruta" : "las ventas brutas"}).</>
          )}{" "}
          Se descuenta el efectivo que ya recibiste en ruta. El saldo es lo que el administrador te debe (positivo) o lo que tú le debes (negativo).
        </p>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "positive" | "negative" | "warning";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`${strong ? "font-bold text-base" : "font-medium"} tabular-nums ${
          tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : tone === "negative" ? "text-red-600 dark:text-red-400" : tone === "warning" ? "text-amber-600 dark:text-amber-400" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ConfigModal({
  open,
  onOpenChange,
  config,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  config: Config | null;
  onSaved: () => void;
}) {
  const [modo, setModo] = useState("porcentaje");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) setModo(config.modoLiquidacion);
  }, [config, open]);

  async function handleSave() {
    setSaving(true);
    try {
      await apiPut("/api/configuracion", { modoLiquidacion: modo });
      toast.success("Modo de liquidación actualizado");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar modo de liquidación</DialogTitle>
          <DialogDescription>
            Elige cómo se reparte la utilidad con la administración. Puedes configurar los
            detalles en la pestaña Ajustes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Modo</Label>
            <Select value={modo} onValueChange={setModo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODOS_LIQUIDACION.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            {modo === "porcentaje" ? (
              <p>La utilidad bruta (ventas − gastos) se reparte por porcentaje entre chofer y administrador.</p>
            ) : (
              <p>El chofer recibe un pago fijo por cada vuelta, dependiendo de si entrega a 1 o múltiples clientes.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
