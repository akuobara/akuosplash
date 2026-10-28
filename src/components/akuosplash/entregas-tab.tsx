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
  Eye,
  ImageIcon,
  Droplets,
} from "lucide-react";
import { toast } from "sonner";
import { EntregaForm } from "./entrega-form";
import { apiGet, apiDelete } from "@/components/akuosplash/akuosplash-api-client";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
  labelEstadoPago,
  labelMetodoPago,
} from "@/components/akuosplash/akuosplash-helpers";
import type { Entrega, VueltaActual } from "./entrega-form";

type Period = "hoy" | "semana" | "mes" | "todo";
type EstadoFilter = "todos" | "pendiente" | "parcial" | "pagado";

interface EntregasTabProps {
  refreshKey: number;
  onRefresh: () => void;
  onVueltaIniciada?: () => void;
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
  }[];
  config: {
    precioEfectivoPorLitro: number;
    precioTransferenciaPorLitro: number;
    precioCamionCompleto: number;
    capacidadCamion: number;
  };
  vueltaActual: VueltaActual | null;
  camiones?: { id: string; nombre: string; activo: boolean }[];
}

const PERIODS: { value: Period; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "todo", label: "Todo" },
];

const ESTADOS: { value: EstadoFilter; label: string }[] = [
  { value: "todos", label: "Todos los estados" },
  { value: "pendiente", label: "Pendientes" },
  { value: "parcial", label: "Parciales" },
  { value: "pagado", label: "Pagados" },
];

export function EntregasTab({
  refreshKey,
  onRefresh,
  onVueltaIniciada,
  clientes,
  config,
  vueltaActual,
  camiones,
}: EntregasTabProps) {
  const [period, setPeriod] = useState<Period>("mes");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Entrega | null>(null);
  const [vista, setVista] = useState<Entrega | null>(null);
  const [borrando, setBorrando] = useState<Entrega | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ entregas: Entrega[] }>(`/api/akuosplash/entregas?period=${period}`);
      setEntregas(data.entregas);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar las entregas");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  const filtradas = entregas.filter((e) => {
    if (estadoFilter !== "todos" && e.estadoPago !== estadoFilter) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const blob = `${e.clienteNombre} ${e.clienteDireccion ?? ""} ${e.clienteTelefono ?? ""} ${e.clienteZona ?? ""} ${e.nota ?? ""}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  const totalVentas = filtradas.reduce((s, e) => s + e.total, 0);
  const totalLitros = filtradas.reduce((s, e) => s + e.litros, 0);
  const totalPorCobrar = filtradas.reduce((s, e) => s + Math.max(0, e.total - e.montoRecibido), 0);

  function handleEditar(e: Entrega) {
    setEditando(e);
    setFormOpen(true);
  }

  function handleNueva() {
    setEditando(null);
    setFormOpen(true);
  }

  async function handleBorrar(e: Entrega) {
    try {
      await apiDelete(`/api/akuosplash/entregas/${e.id}`);
      toast.success("Entrega eliminada");
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
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase text-muted-foreground">Estado</label>
            <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v as EstadoFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
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
                placeholder="Cliente, dirección, zona, nota…"
                className="pl-9"
              />
            </div>
          </div>
        </div>
        <Button onClick={handleNueva} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Nueva entrega
        </Button>
      </div>

      {/* Totales del filtro */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs uppercase text-muted-foreground">Ventas</p>
            <p className="text-base font-bold tabular-nums sm:text-lg">{formatCurrency(totalVentas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs uppercase text-muted-foreground">Litros</p>
            <p className="text-base font-bold tabular-nums sm:text-lg">{formatNumber(totalLitros, 0)} L</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs uppercase text-muted-foreground">Por cobrar</p>
            <p className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400 sm:text-lg">
              {formatCurrency(totalPorCobrar)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : filtradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
              <p className="text-sm text-muted-foreground">No hay entregas que coincidan.</p>
              <Button onClick={handleNueva} variant="outline" size="sm">
                <Plus className="mr-1 h-4 w-4" /> Registrar primera entrega
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtradas.map((e) => (
                <li key={e.id} className="flex items-center gap-3 p-3 sm:p-4">
                  <button
                    type="button"
                    onClick={() => setVista(e)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    {e.fotoMedidorUrl ? (
                       
                      <img
                        src={e.fotoMedidorUrl}
                        alt="Medidor"
                        className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-medium">{e.clienteNombre}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {labelEstadoPago(e.estadoPago)}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {labelMetodoPago(e.metodoPago)}
                        </Badge>
                        {e.vuelta && (
                          <Badge variant="outline" className="text-[10px] text-primary">
                            Vuelta #{e.vuelta.numero}
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(e.fecha)} · {formatNumber(e.litros, 0)} L · {e.clienteDireccion || "Sin dirección"}
                        {e.clienteZona ? ` · ${e.clienteZona}` : ""}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="font-semibold tabular-nums">{formatCurrency(e.total)}</p>
                      {e.montoRecibido < e.total && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Saldo {formatCurrency(e.total - e.montoRecibido)}
                        </p>
                      )}
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setVista(e)}>
                        <Eye className="mr-2 h-4 w-4" /> Ver detalle
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditar(e)}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setBorrando(e)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Formulario */}
      <EntregaForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditando(null);
        }}
        onSaved={() => {
          cargar();
          onRefresh();
        }}
        onVueltaIniciada={() => {
          onVueltaIniciada?.();
          onRefresh();
        }}
        entrega={editando}
        clientes={clientes}
        config={config}
        vueltaActual={vueltaActual}
        camiones={camiones}
      />

      {/* Modal de detalle */}
      <Dialog open={!!vista} onOpenChange={(o) => !o && setVista(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de entrega</DialogTitle>
            <DialogDescription>
              {vista && formatDateTime(vista.fecha)}
            </DialogDescription>
          </DialogHeader>
          {vista && (
            <div className="space-y-3 text-sm">
              {vista.fotoMedidorUrl && (
                 
                <img
                  src={vista.fotoMedidorUrl}
                  alt="Medidor"
                  className="max-h-60 w-full rounded-lg border border-border object-contain"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Cliente" value={vista.clienteNombre} />
                <Field label="Estado" value={labelEstadoPago(vista.estadoPago)} />
                <Field label="Método de pago" value={labelMetodoPago(vista.metodoPago)} />
                {vista.vuelta && <Field label="Vuelta" value={`#${vista.vuelta.numero}`} />}
                <Field label="Teléfono" value={vista.clienteTelefono || "—"} />
                <Field label="Dirección" value={vista.clienteDireccion || "—"} />
                <Field label="Zona" value={vista.clienteZona || "—"} />
                <Field label="Lectura anterior" value={vista.lecturaAnterior != null ? formatNumber(vista.lecturaAnterior, 0) : "—"} />
                <Field label="Lectura actual" value={vista.lecturaActual != null ? formatNumber(vista.lecturaActual, 0) : "—"} />
                <Field label="Litros" value={`${formatNumber(vista.litros, 0)} L`} />
                <Field label="Precio por litro" value={formatCurrency(vista.precioPorLitro)} />
                <Field label="Total" value={formatCurrency(vista.total)} strong />
                {vista.montoEfectivo > 0 && (
                  <Field label="Efectivo recibido" value={formatCurrency(vista.montoEfectivo)} />
                )}
                {vista.montoTransferencia > 0 && (
                  <Field label="Transferencia recibida" value={formatCurrency(vista.montoTransferencia)} />
                )}
                <Field
                  label="Saldo"
                  value={formatCurrency(Math.max(0, vista.total - vista.montoRecibido))}
                  strong
                  tone={vista.total - vista.montoRecibido > 0 ? "warning" : "positive"}
                />
              </div>

              {/* Detalle de estanques */}
              {vista.detalleEstanquesJson && (() => {
                let estanques: { nombre: string; litros: number; precioPorLitro: number; total: number; metodoPago: string; montoRecibido: number }[] = [];
                try { estanques = JSON.parse(vista.detalleEstanquesJson); } catch { return null; }
                if (estanques.length === 0) return null;
                return (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
                    <p className="flex items-center gap-1 text-xs font-medium text-amber-900 dark:text-amber-200">
                      <Droplets className="h-3.5 w-3.5" /> Detalle por estanque
                    </p>
                    {estanques.map((est, i) => (
                      <div key={i} className="rounded border border-amber-200 dark:border-amber-800 bg-white dark:bg-background p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-amber-900 dark:text-amber-200">{i + 1}. {est.nombre}</span>
                          <span className="font-bold tabular-nums">{formatCurrency(est.total)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-3 text-muted-foreground">
                          <span>{formatNumber(est.litros, 0)} L</span>
                          <span>{formatCurrency(est.precioPorLitro)}/L</span>
                          <span className="rounded bg-muted px-1">{est.metodoPago === "efectivo" ? "Efectivo" : est.metodoPago === "transferencia" ? "Transferencia" : est.metodoPago === "credito" ? "Sin pago" : est.metodoPago}</span>
                          {est.montoRecibido > 0 && <span className="text-emerald-600">Recibido: {formatCurrency(est.montoRecibido)}</span>}
                          {est.total - est.montoRecibido > 0 && <span className="text-amber-600">Saldo: {formatCurrency(est.total - est.montoRecibido)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {vista.nota && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Nota</p>
                  <p className="mt-1 rounded-lg bg-muted/40 p-2">{vista.nota}</p>
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
            <DialogTitle>Eliminar entrega</DialogTitle>
            <DialogDescription>
              ¿Seguro que quieres eliminar la entrega de <strong>{borrando?.clienteNombre}</strong>?
              Esta acción no se puede deshacer.
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

function Field({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "warning" | "positive";
}) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p
        className={`${strong ? "font-bold" : "font-medium"} ${
          tone === "warning" ? "text-amber-600 dark:text-amber-400" : tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : ""
        } tabular-nums`}
      >
        {value}
      </p>
    </div>
  );
}
