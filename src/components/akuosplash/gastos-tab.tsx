"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Fuel,
  Droplets,
  Gauge,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { GastoForm } from "./gasto-form";
import { apiGet, apiDelete } from "@/components/akuosplash/akuosplash-api-client";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  labelTipoGasto,
  labelPagadoPor,
  TIPOS_GASTO,
  PAGADO_POR,
} from "@/components/akuosplash/akuosplash-helpers";
import type { Gasto } from "./gasto-form";

type Period = "hoy" | "semana" | "mes" | "todo";

interface GastosTabProps {
  refreshKey: number;
  onRefresh: () => void;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "todo", label: "Todo" },
];

function iconoTipo(tipo: string) {
  if (tipo === "combustible_camion" || tipo === "combustible_motobomba") return Fuel;
  if (tipo === "agua_planta") return Droplets;
  if (tipo === "cloro") return Gauge;
  return Receipt;
}

export function GastosTab({ refreshKey, onRefresh }: GastosTabProps) {
  const [period, setPeriod] = useState<Period>("mes");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [pagadoPorFilter, setPagadoPorFilter] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Gasto | null>(null);
  const [vista, setVista] = useState<Gasto | null>(null);
  const [borrando, setBorrando] = useState<Gasto | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ gastos: Gasto[] }>(`/api/akuosplash/gastos?period=${period}`);
      setGastos(data.gastos);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los gastos");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  const filtrados = gastos.filter((g) => {
    if (tipoFilter !== "todos" && g.tipo !== tipoFilter) return false;
    if (pagadoPorFilter !== "todos" && g.pagadoPor !== pagadoPorFilter) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const blob = `${labelTipoGasto(g.tipo)} ${g.descripcion ?? ""}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  const total = filtrados.reduce((s, g) => s + g.monto, 0);
  const totalChofer = filtrados.filter((g) => g.pagadoPor === "chofer").reduce((s, g) => s + g.monto, 0);
  const totalDueno = filtrados.filter((g) => g.pagadoPor === "dueno").reduce((s, g) => s + g.monto, 0);

  const totalesPorTipo = TIPOS_GASTO.map((t) => ({
    ...t,
    monto: filtrados.filter((g) => g.tipo === t.value).reduce((s, g) => s + g.monto, 0),
  })).filter((t) => t.monto > 0);

  function handleEditar(g: Gasto) {
    setEditando(g);
    setFormOpen(true);
  }
  function handleNuevo() {
    setEditando(null);
    setFormOpen(true);
  }

  async function handleBorrar(g: Gasto) {
    try {
      await apiDelete(`/api/akuosplash/gastos/${g.id}`);
      toast.success("Gasto eliminado");
      setBorrando(null);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase text-muted-foreground">Período</label>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[140px]">
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
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase text-muted-foreground">Tipo</label>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {TIPOS_GASTO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase text-muted-foreground">Pagado por</label>
            <Select value={pagadoPorFilter} onValueChange={setPagadoPorFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {PAGADO_POR.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px] flex-1 space-y-1">
            <label className="text-xs font-medium uppercase text-muted-foreground">Buscar</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Tipo o descripción…"
                className="pl-9"
              />
            </div>
          </div>
        </div>
        <Button onClick={handleNuevo} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Nuevo gasto
        </Button>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs uppercase text-muted-foreground">Total gastos</p>
            <p className="text-base font-bold tabular-nums text-red-600 dark:text-red-400 sm:text-lg">
              {formatCurrency(total)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs uppercase text-muted-foreground">Pagó chofer</p>
            <p className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400 sm:text-lg">
              {formatCurrency(totalChofer)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs uppercase text-muted-foreground">Pagó administración</p>
            <p className="text-base font-bold tabular-nums sm:text-lg">{formatCurrency(totalDueno)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Totales por tipo */}
      {totalesPorTipo.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {totalesPorTipo.map((t) => {
            const Icon = iconoTipo(t.value);
            return (
              <Card key={t.value}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{t.label}</span>
                  </div>
                  <p className="mt-1 text-sm font-bold tabular-nums">{formatCurrency(t.monto)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Lista */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
              <p className="text-sm text-muted-foreground">No hay gastos que coincidan.</p>
              <Button onClick={handleNuevo} variant="outline" size="sm">
                <Plus className="mr-1 h-4 w-4" /> Registrar primer gasto
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtrados.map((g) => {
                const Icon = iconoTipo(g.tipo);
                return (
                  <li key={g.id} className="flex items-center gap-3 p-3 sm:p-4">
                    <button
                      type="button"
                      onClick={() => setVista(g)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      {g.fotoUrl ? (
                         
                        <img
                          src={g.fotoUrl}
                          alt="Comprobante"
                          className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{labelTipoGasto(g.tipo)}</span>
                          <Badge
                            variant={g.pagadoPor === "chofer" ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {labelPagadoPor(g.pagadoPor)}
                          </Badge>
                        </div>
                        {g.descripcion && (
                          <p className="truncate text-xs text-muted-foreground">{g.descripcion}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{formatDate(g.fecha)}</p>
                      </div>
                      <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
                        −{formatCurrency(g.monto)}
                      </span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setVista(g)}>
                          <Pencil className="mr-2 h-4 w-4" /> Ver detalle
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditar(g)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setBorrando(g)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Formulario */}
      <GastoForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditando(null);
        }}
        onSaved={() => {
          cargar();
          onRefresh();
        }}
        gasto={editando}
      />

      {/* Modal de detalle */}
      <Dialog open={!!vista} onOpenChange={(o) => !o && setVista(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle del gasto</DialogTitle>
            <DialogDescription>{vista && formatDateTime(vista.fecha)}</DialogDescription>
          </DialogHeader>
          {vista && (
            <div className="space-y-3 text-sm">
              {vista.fotoUrl && (
                 
                <img
                  src={vista.fotoUrl}
                  alt="Comprobante"
                  className="max-h-60 w-full rounded-lg border border-border object-contain"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Tipo</p>
                  <p className="font-medium">{labelTipoGasto(vista.tipo)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Pagado por</p>
                  <p className="font-medium">{labelPagadoPor(vista.pagadoPor)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Monto</p>
                  <p className="font-bold tabular-nums text-red-600 dark:text-red-400">
                    {formatCurrency(vista.monto)}
                  </p>
                </div>
              </div>
              {vista.descripcion && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Descripción</p>
                  <p className="mt-1 rounded-lg bg-muted/40 p-2">{vista.descripcion}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVista(null)}>
              Cerrar
            </Button>
            {vista && (
              <Button onClick={() => { handleEditar(vista); setVista(null); }}>
                <Pencil className="mr-1 h-4 w-4" /> Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <Dialog open={!!borrando} onOpenChange={(o) => !o && setBorrando(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar gasto</DialogTitle>
            <DialogDescription>
              ¿Eliminar el gasto de <strong>{borrando && labelTipoGasto(borrando.tipo)}</strong> por{" "}
              <strong>{borrando && formatCurrency(borrando.monto)}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBorrando(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => borrando && handleBorrar(borrando)}>
              <Trash2 className="mr-1 h-4 w-4" /> Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
