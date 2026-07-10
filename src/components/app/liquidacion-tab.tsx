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
import { Badge } from "@/components/ui/badge";
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
import {
  ArrowRight,
  Printer,
  HandCoins,
  Wallet,
  TrendingDown,
  TrendingUp,
  Receipt,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch } from "@/lib/api-client";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  labelTipoGasto,
} from "@/lib/helpers";
import { StatCard } from "./stat-card";

type Period = "hoy" | "semana" | "mes" | "todo";

interface Config {
  id: string;
  nombreChofer: string;
  nombreDueno: string;
  porcentajeComisionChofer: number;
  porcentajeComisionDueno: number;
  precioPorLitroDefault: number;
}

interface LiquidacionData {
  period: string;
  config: Config;
  resumen: {
    totalVentas: number;
    totalEfectivoRecibido: number;
    totalPorCobrar: number;
    totalGastos: number;
    utilidadBruta: number;
    parteChofer: number;
    parteDueno: number;
    saldoChofer: number;
  };
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

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">Liquidación con el dueño</h2>
          <p className="text-sm text-muted-foreground">
            Repartición de utilidades según porcentajes configurados.
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
            <Receipt className="mr-1 h-4 w-4" /> Ajustar %
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Tarjeta principal de liquidación */}
      {loading || !r || !cfg ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <Card className="overflow-hidden border-primary/20">
          <CardContent className="p-5 sm:p-6">
            {/* Encabezado de la liquidación */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Período</p>
                <p className="font-semibold">{PERIODS.find((p) => p.value === period)?.label}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase text-muted-foreground">Generado</p>
                <p className="font-semibold">{formatDate(new Date())}</p>
              </div>
            </div>

            {/* Fórmula principal */}
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
              {/* Lado izquierdo: ventas - gastos */}
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

              {/* Flecha */}
              <div className="flex items-center justify-center">
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
              </div>

              {/* Lado derecho: repartición */}
              <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Repartición
                </p>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="flex items-center justify-between">
                      <span>{cfg.nombreChofer} ({cfg.porcentajeComisionChofer}%)</span>
                      <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(r.parteChofer)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span>{cfg.nombreDueno} ({cfg.porcentajeComisionDueno}%)</span>
                      <span className="font-bold tabular-nums">
                        {formatCurrency(r.parteDueno)}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-border pt-2">
                    <Row label="Efectivo ya recibido por chofer" value={formatCurrency(r.totalEfectivoRecibido)} />
                    <div className="mt-2 rounded-md bg-amber-100/60 p-2 dark:bg-amber-900/30">
                      <Row
                        label={r.saldoChofer >= 0 ? "El dueño le debe al chofer" : "El chofer le debe al dueño"}
                        value={formatCurrency(Math.abs(r.saldoChofer))}
                        strong
                        tone={r.saldoChofer >= 0 ? "positive" : "negative"}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Nota explicativa */}
            <p className="mt-4 text-xs text-muted-foreground">
              <strong>Cómo se calcula:</strong> La utilidad bruta (ventas − gastos) se reparte en{" "}
              <strong>{cfg.porcentajeComisionChofer}%</strong> para el chofer y{" "}
              <strong>{cfg.porcentajeComisionDueno}%</strong> para el dueño. Como el chofer ya recibió
              efectivo en ruta, ese monto se descuenta de su parte. Si el saldo es positivo, el dueño
              le debe al chofer; si es negativo, el chofer le debe al dueño.
            </p>
          </CardContent>
        </Card>
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
            icon={Wallet}
            tone="accent"
          />
          <StatCard
            label="Por cobrar"
            value={formatCurrency(r.totalPorCobrar)}
            icon={HandCoins}
            tone={r.totalPorCobrar > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Gastos"
            value={formatCurrency(r.totalGastos)}
            icon={TrendingDown}
            tone="negative"
          />
        </div>
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

      {/* Modal de configuración de porcentajes */}
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
  tone?: "positive" | "negative";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`${strong ? "font-bold text-base" : "font-medium"} tabular-nums ${
          tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : tone === "negative" ? "text-red-600 dark:text-red-400" : ""
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
  const [nombreChofer, setNombreChofer] = useState("");
  const [nombreDueno, setNombreDueno] = useState("");
  const [pctChofer, setPctChofer] = useState("50");
  const [pctDueno, setPctDueno] = useState("50");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setNombreChofer(config.nombreChofer);
      setNombreDueno(config.nombreDueno);
      setPctChofer(String(config.porcentajeComisionChofer));
      setPctDueno(String(config.porcentajeComisionDueno));
    }
  }, [config, open]);

  // Sincronizar: si cambia uno, el otro se ajusta a 100
  function onChangeChofer(v: string) {
    const n = Number(v) || 0;
    setPctChofer(String(n));
    setPctDueno(String(Math.max(0, 100 - n)));
  }
  function onChangeDueno(v: string) {
    const n = Number(v) || 0;
    setPctDueno(String(n));
    setPctChofer(String(Math.max(0, 100 - n)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiPatch("/api/configuracion", {
        nombreChofer,
        nombreDueno,
        porcentajeComisionChofer: Number(pctChofer),
        porcentajeComisionDueno: Number(pctDueno),
      });
      toast.success("Configuración guardada");
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
          <DialogTitle>Configurar liquidación</DialogTitle>
          <DialogDescription>
            Define los nombres y porcentajes de reparto. La suma debe ser 100%.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombreChofer">Tu nombre (chofer)</Label>
            <Input id="nombreChofer" value={nombreChofer} onChange={(e) => setNombreChofer(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nombreDueno">Nombre del dueño</Label>
            <Input id="nombreDueno" value={nombreDueno} onChange={(e) => setNombreDueno(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pctChofer">% chofer</Label>
              <Input
                id="pctChofer"
                type="number"
                inputMode="decimal"
                value={pctChofer}
                onChange={(e) => onChangeChofer(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pctDueno">% dueño</Label>
              <Input
                id="pctDueno"
                type="number"
                inputMode="decimal"
                value={pctDueno}
                onChange={(e) => onChangeDueno(e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <p>
              <strong>{nombreChofer || "Chofer"}</strong> recibe{" "}
              <Badge variant="secondary">{pctChofer}%</Badge> de la utilidad bruta.
            </p>
            <p className="mt-1">
              <strong>{nombreDueno || "Dueño"}</strong> recibe{" "}
              <Badge variant="secondary">{pctDueno}%</Badge> de la utilidad bruta.
            </p>
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
