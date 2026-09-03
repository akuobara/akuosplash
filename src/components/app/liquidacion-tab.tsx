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
      {/* Selector de período */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="outline" onClick={() => setPeriodoOffset(o => o - 1)}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <div className="text-center min-w-[180px]">
              <p className="text-xs text-muted-foreground">
                {periodoData?.config?.periodoLiquidacion === "semanal" ? "Semana" : "Mes"}
              </p>
              <p className="text-sm font-semibold">
                {periodoData?.periodo?.label || "Cargando..."}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPeriodoOffset(o => Math.min(0, o + 1))}
              disabled={periodoOffset >= 0}
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {periodoOffset !== 0 && (
            <div className="mt-2 text-center">
              <Button size="sm" variant="ghost" onClick={() => setPeriodoOffset(0)}>
                Volver al período actual
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {periodoLoading || !periodoData ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <>
          {/* Resumen de vueltas y pago al chofer */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Liquidación del chofer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Vueltas válidas */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Vueltas del período</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded border p-2">
                    <p className="text-xs text-muted-foreground">Vueltas válidas</p>
                    <p className="text-lg font-bold text-emerald-600">{periodoData.resumen.vueltasCompletadas}</p>
                  </div>
                  <div className="rounded border p-2">
                    <p className="text-xs text-muted-foreground">Total vueltas</p>
                    <p className="text-lg font-bold">{periodoData.resumen.vueltasTotal}</p>
                  </div>
                </div>
              </div>

              {/* Pago al chofer según modo */}
              {periodoData.config.modoLiquidacion === "vuelta" ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Pago por vueltas válidas</p>
                  <div className="rounded border p-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Pago al chofer ({periodoData.resumen.vueltasCompletadas} vueltas)</span>
                      <strong>{formatCurrency(periodoData.resumen.pagoChofer)}</strong>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>+ Gastos reembolsables (chofer)</span>
                      <span>{formatCurrency(periodoData.resumen.gastosChofer)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>- Descuentos chofer</span>
                      <span>{formatCurrency(periodoData.resumen.descuentosChofer)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>- Impuesto</span>
                      <span>{formatCurrency(periodoData.resumen.impuesto)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-medium">
                      <span>Líquido chofer</span>
                      <span>{formatCurrency(periodoData.resumen.liquidoChofer)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>- Efectivo de entregas</span>
                      <span>{formatCurrency(periodoData.resumen.totalEfectivo)}</span>
                    </div>
                    {periodoData.resumen.totalPagosSueltos > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>- Efectivo de pagos recibidos</span>
                        <span>{formatCurrency(periodoData.resumen.pagosSueltosEfectivo)}</span>
                      </div>
                    )}
                    {periodoData.resumen.totalPagosSueltos > 0 && (
                      <div className="flex justify-between text-muted-foreground border-t pt-1">
                        <span>Total efectivo recibido</span>
                        <span>{formatCurrency(periodoData.resumen.efectivoTotal)}</span>
                      </div>
                    )}
                    <div className={`flex justify-between font-bold text-base ${periodoData.resumen.saldoChofer >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                      <span>{periodoData.resumen.saldoChofer >= 0 ? "Te deben" : "Debés"}</span>
                      <span>{formatCurrency(Math.abs(periodoData.resumen.saldoChofer))}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Pago por porcentaje</p>
                  <div className="rounded border p-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Ventas</span>
                      <span>{formatCurrency(periodoData.resumen.totalVentas)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>- Gastos</span>
                      <span>{formatCurrency(periodoData.resumen.totalGastos)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Utilidad bruta</span>
                      <span>{formatCurrency(periodoData.resumen.utilidadBruta)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pago chofer ({periodoData.config.porcentajeComisionChofer}%)</span>
                      <strong>{formatCurrency(periodoData.resumen.pagoChofer)}</strong>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>+ Gastos reembolsables</span>
                      <span>{formatCurrency(periodoData.resumen.gastosChofer)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>- Impuesto</span>
                      <span>{formatCurrency(periodoData.resumen.impuesto)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-medium">
                      <span>Líquido chofer</span>
                      <span>{formatCurrency(periodoData.resumen.liquidoChofer)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>- Efectivo de entregas</span>
                      <span>{formatCurrency(periodoData.resumen.totalEfectivo)}</span>
                    </div>
                    {periodoData.resumen.totalPagosSueltos > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>- Efectivo de pagos recibidos</span>
                        <span>{formatCurrency(periodoData.resumen.pagosSueltosEfectivo)}</span>
                      </div>
                    )}
                    {periodoData.resumen.totalPagosSueltos > 0 && (
                      <div className="flex justify-between text-muted-foreground border-t pt-1">
                        <span>Total efectivo recibido</span>
                        <span>{formatCurrency(periodoData.resumen.efectivoTotal)}</span>
                      </div>
                    )}
                    <div className={`flex justify-between font-bold text-base ${periodoData.resumen.saldoChofer >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                      <span>{periodoData.resumen.saldoChofer >= 0 ? "Te deben" : "Debés"}</span>
                      <span>{formatCurrency(Math.abs(periodoData.resumen.saldoChofer))}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumen financiero */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumen financiero del período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
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
            </CardContent>
          </Card>

          {/* Vueltas del período */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Vueltas ({periodoData.vueltas?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {periodoData.vueltas && periodoData.vueltas.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-2">#</th>
                        <th className="p-2">Inicio</th>
                        <th className="p-2">Cierre</th>
                        <th className="p-2">Camión</th>
                        <th className="p-2">Tipo</th>
                        <th className="p-2">Entregas</th>
                        <th className="p-2">Litros</th>
                        <th className="p-2">Ventas</th>
                        <th className="p-2">¿Válida?</th>
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
                          <td className="p-2">
                            {v.cantidadEntregas <= 1
                              ? <span className="text-blue-600 dark:text-blue-400">Cliente único</span>
                              : <span className="text-purple-600 dark:text-purple-400">Múltiples clientes</span>}
                          </td>
                          <td className="p-2">{v.cantidadEntregas}</td>
                          <td className="p-2">{formatNumber(v.litros, 0)} L</td>
                          <td className="p-2">{formatCurrency(v.ventas)}</td>
                          <td className="p-2">
                            {v.completada
                              ? <span className="text-emerald-600 font-medium">Sí</span>
                              : <span className="text-amber-600">No</span>}
                          </td>
                          <td className="p-2 font-medium">{formatCurrency(v.pagoVuelta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">Sin vueltas en este período.</p>
              )}
            </CardContent>
          </Card>

          {/* Gastos del período */}
          {periodoData.gastos && periodoData.gastos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Gastos del período ({periodoData.gastos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}

          {/* Pagos recibidos del período */}
          {periodoData.pagosSueltos && periodoData.pagosSueltos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Pagos recibidos ({periodoData.pagosSueltos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-2">Fecha</th>
                        <th className="p-2">Cliente</th>
                        <th className="p-2">Método</th>
                        <th className="p-2">Monto</th>
                        <th className="p-2">Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodoData.pagosSueltos.map((p: any) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="p-2 whitespace-nowrap">{formatDateTime(p.fecha)}</td>
                          <td className="p-2">{p.cliente}</td>
                          <td className="p-2">{p.metodoPago}</td>
                          <td className="p-2 font-medium">{formatCurrency(p.monto)}</td>
                          <td className="p-2">{p.nota || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-bold">
                        <td className="p-2" colSpan={3}>Total pagos recibidos</td>
                        <td className="p-2">{formatCurrency(periodoData.resumen.totalPagosSueltos)}</td>
                        <td className="p-2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
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
