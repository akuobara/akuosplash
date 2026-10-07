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
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPut, apiPost } from "@/components/akuosplash/akuosplash-api-client";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  labelTipoGasto,
  labelModoLiquidacion,
  MODOS_LIQUIDACION,
} from "@/components/akuosplash/akuosplash-helpers";
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
    saldoArrastrado?: number;
    saldoCobrado?: boolean;
    cobroSaldoAnteriorTotal?: number;
    cobroSaldoAnteriorEfectivo?: number;
    cobroSaldoAnteriorTransferencia?: number;
    saldoAnteriorPendiente?: number;
    saldoChoferTotal?: number;
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
  isDueno?: boolean;
}

export function LiquidacionTab({ refreshKey, onRefresh, config, isDueno = false }: LiquidacionTabProps) {
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
  const [cerrandoPeriodo, setCerrandoPeriodo] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [cobrarSaldoOpen, setCobrarSaldoOpen] = useState(false);
  const [cobrandoSaldo, setCobrandoSaldo] = useState(false);
  const [cobrarMonto, setCobrarMonto] = useState("");

  const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  async function descargarResumenMensual(formato: "pdf" | "excel") {
    setDescargandoResumen(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("aljibe-token") : null;
      if (!token) throw new Error("No hay sesión activa");
      const url = `/api/akuosplash/liquidacion/resumen-mensual?year=${resumenYear}&month=${resumenMonth}&formato=${formato}&_t=${Date.now()}`;
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

  // Descargar liquidación del período actual (PDF/Excel específico de liquidación,
  // NO el resumen de ventas del Dashboard).
  async function descargarResumenPeriodo(formato: "pdf" | "excel") {
    setDescargandoResumen(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("aljibe-token") : null;
      if (!token) throw new Error("No hay sesión activa");
      // Usar el endpoint específico de liquidación con el offset del período actual
      const url = `/api/akuosplash/reportes/liquidacion-pdf?formato=${formato}&offset=${periodoOffset}&_t=${Date.now()}`;
      const res = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        // Intentar parsear JSON para mostrar el error específico
        try {
          const j = JSON.parse(txt);
          throw new Error(`Error ${res.status}: ${j.error || j.message || ""}`);
        } catch {
          throw new Error(`Error ${res.status}: ${txt.slice(0, 200)}`);
        }
      }
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("El servidor devolvió un archivo vacío");
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `liquidacion-${periodoData?.periodo?.label || "periodo"}.${formato === "pdf" ? "pdf" : "xlsx"}`;
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
      const r = await apiGet<LiquidacionData>(`/api/akuosplash/reportes/liquidacion?period=${period}`);
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
      // cache: "no-store" + timestamp para evitar que el navegador devuelva
      // una respuesta cacheada (que mostraría saldoArrastrado viejo)
      const r = await apiGet<any>(`/api/akuosplash/liquidacion/periodo?offset=${periodoOffset}&_t=${Date.now()}`);
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

          {/* Botones de descarga y cierre */}
          {periodoData && (
            <div className="mt-3 flex flex-wrap gap-2 justify-center">
              <Button
                size="sm"
                variant="outline"
                disabled={descargandoResumen}
                onClick={() => descargarResumenPeriodo("pdf")}
              >
                <FileText className="mr-1 h-3.5 w-3.5" /> Liquidación PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={descargandoResumen}
                onClick={() => descargarResumenPeriodo("excel")}
              >
                <FileText className="mr-1 h-3.5 w-3.5" /> Liquidación Excel
              </Button>
              {isDueno && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={cerrandoPeriodo}
                  onClick={() => setConfirmarCierre(true)}
                >
                  <Lock className="mr-1 h-3.5 w-3.5" /> Cerrar período
                </Button>
              )}
              {/* Botón: cobrar saldo anterior (chofer) o pagar (dueno) */}
              {/* SOLO visible si hay saldo anterior PENDIENTE (no cobrado).
                  Si ya se cobró, el botón desaparece — no hay nada que hacer. */}
              {periodoData.resumen.saldoArrastrado &&
                periodoData.resumen.saldoArrastrado > 0 &&
                !periodoData.resumen.saldoCobrado && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
                  disabled={cobrandoSaldo}
                  onClick={() => setCobrarSaldoOpen(true)}
                >
                  <Banknote className="mr-1 h-3.5 w-3.5" /> {isDueno ? "Pagar saldo anterior" : "Cobrar saldo anterior"}
                </Button>
              )}
              {/* Nota: si el saldo ya fue cobrado este período, NO mostramos ningún badge
                  ni línea sobre saldo anterior en el resumen. El usuario no quiere verlo. */}
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

                {/* Desglose por tipo de vuelta válida */}
                {periodoData.config.modoLiquidacion === "vuelta" && (
                  <div className="rounded border border-primary/30 bg-primary/5 p-2 space-y-1.5 text-sm">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Desglose de vueltas válidas</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                        <span>Cliente único</span>
                        <span className="text-xs text-muted-foreground">
                          ({formatCurrency(periodoData.config.montoPorVueltaUnicoCliente)} c/u)
                        </span>
                      </div>
                      <span className="font-medium">
                        {periodoData.resumen.vueltasUnicoCliente} × {formatCurrency(periodoData.config.montoPorVueltaUnicoCliente)} = <strong>{formatCurrency(periodoData.resumen.vueltasUnicoCliente * periodoData.config.montoPorVueltaUnicoCliente)}</strong>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
                        <span>Múltiples clientes</span>
                        <span className="text-xs text-muted-foreground">
                          ({formatCurrency(periodoData.config.montoPorVueltaMultiple)} c/u)
                        </span>
                      </div>
                      <span className="font-medium">
                        {periodoData.resumen.vueltasMultiple} × {formatCurrency(periodoData.config.montoPorVueltaMultiple)} = <strong>{formatCurrency(periodoData.resumen.vueltasMultiple * periodoData.config.montoPorVueltaMultiple)}</strong>
                      </span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-bold">
                      <span>Total pago por vueltas</span>
                      <span>{formatCurrency(periodoData.resumen.pagoChofer)}</span>
                    </div>
                  </div>
                )}
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
                  </div>
                  <div className={`flex justify-between font-bold text-base ${periodoData.resumen.saldoChofer >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                    <span>{periodoData.resumen.saldoChofer >= 0
                      ? (isDueno ? "Le debés al chofer (esta semana)" : "Te deben (esta semana)")
                      : (isDueno ? "El chofer te debe (esta semana)" : "Debés entregar (esta semana)")}
                    </span>
                    <span>{formatCurrency(Math.abs(periodoData.resumen.saldoChofer))}</span>
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
                  </div>
                  <div className={`flex justify-between font-bold text-base ${periodoData.resumen.saldoChofer >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                    <span>{periodoData.resumen.saldoChofer >= 0
                      ? (isDueno ? "Le debés al chofer (esta semana)" : "Te deben (esta semana)")
                      : (isDueno ? "El chofer te debe (esta semana)" : "Debés entregar (esta semana)")}
                    </span>
                    <span>{formatCurrency(Math.abs(periodoData.resumen.saldoChofer))}</span>
                  </div>
                </div>
              )}

              {/* Nota: NO mostramos nada sobre saldo del período anterior en el resumen de esta semana.
                  El usuario ya dejó claro que no quiere ver esa info acá.
                  Si querés ver el saldo anterior pendiente, mirá la pantalla de cierre de período. */}
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

      {/* Diálogo: Cobrar/Pagar saldo anterior */}
      <Dialog open={cobrarSaldoOpen} onOpenChange={(o) => { setCobrarSaldoOpen(o); if (!o) setCobrarMonto(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Saldo de liquidación anterior</DialogTitle>
            <DialogDescription>
              {isDueno
                ? "Registrá cómo le pagaste al chofer el saldo pendiente."
                : "Cobrá el saldo pendiente con el efectivo que tenés en mano, o informá que recibiste una transferencia."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo pendiente:</span>
                <strong className="text-emerald-600">{formatCurrency(periodoData?.resumen?.saldoArrastrado || 0)}</strong>
              </div>
            </div>
            <div>
              <Label className="text-xs">Monto *</Label>
              <Input
                type="number"
                step="100"
                value={cobrarMonto}
                onChange={(e) => setCobrarMonto(e.target.value)}
                placeholder={String(periodoData?.resumen?.saldoArrastrado || 0)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Dejá vacío para el monto completo.
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setCobrarSaldoOpen(false)}>Cancelar</Button>
            {/* Efectivo: chofer se cobra con efectivo en mano */}
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={cobrandoSaldo}
              onClick={async () => {
                const monto = cobrarMonto ? Number(cobrarMonto) : (periodoData?.resumen?.saldoArrastrado || 0);
                if (monto <= 0) { toast.error("Monto inválido"); return; }
                setCobrandoSaldo(true);
                try {
                  const res = await apiPost<{ ok: boolean; message: string; yaCobrado?: boolean }>("/api/liquidacion/pagar-saldo", { monto, metodo: "efectivo" });
                  toast.success(res.message || "Cobro con efectivo registrado");
                  setCobrarSaldoOpen(false);
                  setCobrarMonto("");
                  cargar();
                  onRefresh();
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "No se pudo registrar";
                  toast.error(msg);
                  // Si ya está cobrado, cerrar el diálogo y recargar para mostrar el badge
                  if (msg.includes("Ya cobraste")) {
                    setCobrarSaldoOpen(false);
                    cargar();
                    onRefresh();
                  }
                } finally {
                  setCobrandoSaldo(false);
                }
              }}
            >
              <Banknote className="mr-1 h-4 w-4" /> Efectivo
            </Button>
            {/* Transferencia: admin transfirió o chofer recibió transferencia */}
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={cobrandoSaldo}
              onClick={async () => {
                const monto = cobrarMonto ? Number(cobrarMonto) : (periodoData?.resumen?.saldoArrastrado || 0);
                if (monto <= 0) { toast.error("Monto inválido"); return; }
                setCobrandoSaldo(true);
                try {
                  const res = await apiPost<{ ok: boolean; message: string }>("/api/liquidacion/pagar-saldo", { monto, metodo: "transferencia" });
                  toast.success(res.message || "Transferencia registrada");
                  setCobrarSaldoOpen(false);
                  setCobrarMonto("");
                  cargar();
                  onRefresh();
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "No se pudo registrar";
                  toast.error(msg);
                  if (msg.includes("Ya cobraste")) {
                    setCobrarSaldoOpen(false);
                    cargar();
                    onRefresh();
                  }
                } finally {
                  setCobrandoSaldo(false);
                }
              }}
            >
              <Smartphone className="mr-1 h-4 w-4" /> Transferencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Confirmar cierre de período */}
      <Dialog open={confirmarCierre} onOpenChange={setConfirmarCierre}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cerrar período de liquidación</DialogTitle>
            <DialogDescription>
              Vas a cerrar el período <strong>{periodoData?.periodo?.label}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200">
            <p>Las entregas, gastos y pagos de este período ya no se podrán editar.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmarCierre(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cerrandoPeriodo}
              onClick={async () => {
                setCerrandoPeriodo(true);
                try {
                  const end = periodoData?.periodo?.end || new Date().toISOString();
                  await apiPost("/api/liquidacion/cerrar", { fechaCierre: end });
                  toast.success("Período cerrado. Las entregas y gastos de este período ya no se pueden editar.");
                  setConfirmarCierre(false);
                  cargar();
                  onRefresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "No se pudo cerrar");
                } finally {
                  setCerrandoPeriodo(false);
                }
              }}
            >
              {cerrandoPeriodo ? "Cerrando…" : "Cerrar período"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          <strong>Cómo se calcula:</strong> Por cada vuelta <strong>válida</strong> el chofer recibe{" "}
          <strong>{formatCurrency(cfg.montoPorVueltaUnicoCliente)}</strong> si fue a 1 cliente o{" "}
          <strong>{formatCurrency(cfg.montoPorVueltaMultiple)}</strong> si fue a múltiples clientes.
          {" "}Una vuelta es válida solo si se entregó al menos el <strong>97.5%</strong> de la capacidad del camión.
          {(r.vueltasExcluidas ?? 0) > 0 && (
            <> Las vueltas cerradas sin completar no se contabilizan ({r.vueltasExcluidas} en este período).</>
          )}
          {" "}Se suman los gastos que pagó el chofer (reembolsables).
          {r.impuesto > 0 && (
            <> Se descuenta el impuesto ({cfg.porcentajeImpuesto}% sobre {cfg.aplicaImpuestoSobre === "pago_chofer" ? "el pago del chofer" : cfg.aplicaImpuestoSobre === "utilidad_bruta" ? "la utilidad bruta" : "las ventas brutas"}).</>
          )}{" "}
          Se descuenta el efectivo que ya recibió el chofer en ruta. El saldo es lo que el administrador le debe al chofer (positivo) o lo que el chofer le debe al administrador (negativo).
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
      await apiPut("/api/akuosplash/configuracion", { modoLiquidacion: modo });
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
