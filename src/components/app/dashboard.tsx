"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { StatCard } from "./stat-card";
import { EntregaForm } from "./entrega-form";
import { GastoForm } from "./gasto-form";
import { VueltaWidget } from "./vuelta-widget";
import { apiGet } from "@/lib/api-client";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  labelTipoGasto,
  labelEstadoPago,
  labelMetodoPago,
} from "@/lib/helpers";
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
    lat: number | null;
    lng: number | null;
    requiereIngresoPropiedad: boolean;
    entregaDesdeAfuera: boolean;
    conexionExterna: boolean;
    requiereClientePresente: boolean;
    indicacionesAcceso: string | null;
    estanquesJson: string | null;
  }[];
  config: {
    precioEfectivoPorLitro: number;
    precioTransferenciaPorLitro: number;
    capacidadCamion: number;
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

  const [entregaFormOpen, setEntregaFormOpen] = useState(false);
  const [gastoFormOpen, setGastoFormOpen] = useState(false);

  const cargarVuelta = useCallback(async () => {
    try {
      const data = await apiGet<{ vuelta: VueltaActual | null }>("/api/vueltas/activa");
      setVueltaActual(data.vuelta);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [r, ents, gsts] = await Promise.all([
        apiGet<Resumen>(`/api/reportes/resumen?period=${period}`),
        apiGet<{ entregas: Entrega[] }>(`/api/entregas?period=${period}`),
        apiGet<{ gastos: Gasto[] }>(`/api/gastos?period=${period}`),
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
          <Button onClick={() => setEntregaFormOpen(true)} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Entrega
          </Button>
        </div>
      </div>

      {/* Vuelta actual */}
      <VueltaWidget
        vueltaActual={vueltaActual}
        camiones={camiones}
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
              hint="Recibido en ruta"
              icon={Banknote}
              tone="accent"
            />
            <StatCard
              label="Transferencia"
              value={formatCurrency(resumen.totalTransferenciaRecibida)}
              hint="Recibida en ruta"
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
            label="Pagados por dueño"
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
              {resumen.vueltas.map((v) => (
                <div key={v.id} className="flex items-center gap-3 p-3">
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
                  <div className="text-right shrink-0">
                    <p className="font-semibold tabular-nums text-sm">{formatCurrency(v.ventas)}</p>
                    <div className="flex items-center gap-2 text-xs">
                      {v.efectivo > 0 && <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">Efect: {formatCurrency(v.efectivo)}</span>}
                      {v.transferencia > 0 && <span className="text-blue-600 dark:text-blue-400 tabular-nums">Trans: {formatCurrency(v.transferencia)}</span>}
                    </div>
                  </div>
                </div>
              ))}
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
                      {formatDate(g.fecha)} · Pagó: {g.pagadoPor === "chofer" ? "Chofer" : "Dueño"}
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
      />
      <GastoForm open={gastoFormOpen} onOpenChange={setGastoFormOpen} onSaved={onRefresh} />
    </div>
  );
}
