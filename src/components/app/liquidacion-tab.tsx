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

  const r = data?.resumen;
  const cfg = data?.config;
  const esModoVuelta = cfg?.modoLiquidacion === "vuelta";

  return (
    <div className="space-y-5">
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
