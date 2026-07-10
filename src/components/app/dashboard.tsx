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
} from "lucide-react";
import { StatCard } from "./stat-card";
import { EntregaForm } from "./entrega-form";
import { GastoForm } from "./gasto-form";
import { apiGet } from "@/lib/api-client";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  labelTipoGasto,
  labelEstadoPago,
} from "@/lib/helpers";
import type { Entrega } from "./entrega-form";
import type { Gasto } from "./gasto-form";

type Period = "hoy" | "semana" | "mes" | "todo";

interface Resumen {
  period: string;
  totalVentas: number;
  totalEfectivoRecibido: number;
  totalPorCobrar: number;
  totalLitros: number;
  totalGastos: number;
  gastosPorTipo: Record<string, number>;
  utilidadBruta: number;
  cantidadEntregas: number;
  cantidadGastos: number;
}

interface DashboardProps {
  refreshKey: number;
  onRefresh: () => void;
  clientes: { id: string; nombre: string; direccion: string | null; telefono: string | null; precioPorLitro: number }[];
  precioPorLitroDefault: number;
  onGoToEntregas: () => void;
  onGoToGastos: () => void;
  onGoToLiquidacion: () => void;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "todo", label: "Todo" },
];

export function Dashboard({
  refreshKey,
  onRefresh,
  clientes,
  precioPorLitroDefault,
  onGoToEntregas,
  onGoToGastos,
  onGoToLiquidacion,
}: DashboardProps) {
  const [period, setPeriod] = useState<Period>("hoy");
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [recientes, setRecientes] = useState<Entrega[]>([]);
  const [gastosRecientes, setGastosRecientes] = useState<Gasto[]>([]);

  const [entregaFormOpen, setEntregaFormOpen] = useState(false);
  const [gastoFormOpen, setGastoFormOpen] = useState(false);

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
          <Button onClick={() => setGastoFormOpen(true)} variant="outline" size="sm">
            <Receipt className="mr-1 h-4 w-4" /> Gasto
          </Button>
          <Button onClick={() => setEntregaFormOpen(true)} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Entrega
          </Button>
        </div>
      </div>

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
              label="Efectivo recibido"
              value={formatCurrency(resumen.totalEfectivoRecibido)}
              hint="En ruta"
              icon={Wallet}
              tone="accent"
            />
            <StatCard
              label="Por cobrar"
              value={formatCurrency(resumen.totalPorCobrar)}
              hint="Saldo pendiente"
              icon={DollarSign}
              tone={resumen.totalPorCobrar > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Litros entregados"
              value={`${formatNumber(resumen.totalLitros, 0)} L`}
              hint="Acumulado"
              icon={Droplets}
            />
          </>
        )}
      </div>

      {/* Utilidad */}
      <div className="grid gap-3 lg:grid-cols-3">
        {loading || !resumen ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <StatCard
              label="Gastos del período"
              value={formatCurrency(resumen.totalGastos)}
              hint={`${resumen.cantidadGastos} gastos`}
              icon={TrendingDown}
              tone="negative"
            />
            <StatCard
              label="Utilidad bruta"
              value={formatCurrency(resumen.utilidadBruta)}
              hint="Ventas − gastos"
              icon={TrendingUp}
              tone={resumen.utilidadBruta >= 0 ? "positive" : "negative"}
            />
            <Card className="overflow-hidden">
              <CardContent className="p-4 sm:p-5">
                <div className="flex h-full flex-col justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Liquidación con dueño
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Calcula la repartición según el porcentaje configurado.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={onGoToLiquidacion} className="w-fit">
                    Ver liquidación <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

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
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{e.clienteNombre}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {labelEstadoPago(e.estadoPago)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.fecha)} · {formatNumber(e.litros, 0)} L
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
                    <p className="text-xs text-muted-foreground">{formatDate(g.fecha)}</p>
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
        onSaved={onRefresh}
        clientes={clientes}
        precioPorLitroDefault={precioPorLitroDefault}
      />
      <GastoForm open={gastoFormOpen} onOpenChange={setGastoFormOpen} onSaved={onRefresh} />
    </div>
  );
}
