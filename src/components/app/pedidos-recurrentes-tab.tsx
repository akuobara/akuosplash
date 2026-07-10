"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  MoreVertical,
  Pencil,
  Trash2,
  Repeat,
  Calendar,
  Zap,
  Droplets,
  MapPin,
  Navigation,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import {
  formatNumber,
  formatDate,
  formatDateTime,
  labelMetodoPago,
  METODOS_PAGO,
} from "@/lib/helpers";

interface Recurrente {
  id: string;
  creadoEn: string;
  litrosSolicitados: number;
  metodoPagoPreferido: string;
  nota: string | null;
  frecuenciaDias: number;
  fechaInicio: string;
  fechaProximaGeneracion: string;
  activo: boolean;
  asignacionTipo: string;
  cliente: {
    id: string;
    nombre: string;
    direccion: string | null;
    telefono: string | null;
    zona: string | null;
    lat: number | null;
    lng: number | null;
    indicacionesAcceso: string | null;
  };
  choferAsignado: { id: string; nombre: string } | null;
  _count?: { pedidos: number };
}

interface PedidosRecurrentesTabProps {
  refreshKey: number;
  onRefresh: () => void;
  clientes: {
    id: string;
    nombre: string;
    zona: string | null;
    direccion: string | null;
  }[];
  choferes: { id: string; nombre: string }[];
}

export function PedidosRecurrentesTab({ refreshKey, onRefresh, clientes, choferes }: PedidosRecurrentesTabProps) {
  const [recurrentes, setRecurrentes] = useState<Recurrente[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Recurrente | null>(null);
  const [borrando, setBorrando] = useState<Recurrente | null>(null);

  // Campos del formulario
  const [clienteId, setClienteId] = useState("");
  const [litrosSolicitados, setLitrosSolicitados] = useState("");
  const [metodoPagoPreferido, setMetodoPagoPreferido] = useState("efectivo");
  const [nota, setNota] = useState("");
  const [frecuenciaDias, setFrecuenciaDias] = useState("7");
  const [fechaInicio, setFechaInicio] = useState("");
  const [activo, setActivo] = useState(true);
  const [asignacionTipo, setAsignacionTipo] = useState("manual");
  const [choferAsignadoId, setChoferAsignadoId] = useState("");
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ recurrentes: Recurrente[] }>("/api/pedidos-recurrentes");
      setRecurrentes(data.recurrentes);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los pedidos recurrentes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  function abrirNuevo() {
    setEditando(null);
    setClienteId("");
    setLitrosSolicitados("");
    setMetodoPagoPreferido("efectivo");
    setNota("");
    setFrecuenciaDias("7");
    setFechaInicio(new Date().toISOString().slice(0, 10));
    setActivo(true);
    setAsignacionTipo("manual");
    setChoferAsignadoId("");
    setFormOpen(true);
  }

  function abrirEditar(r: Recurrente) {
    setEditando(r);
    setClienteId(r.cliente.id);
    setLitrosSolicitados(String(r.litrosSolicitados));
    setMetodoPagoPreferido(r.metodoPagoPreferido);
    setNota(r.nota ?? "");
    setFrecuenciaDias(String(r.frecuenciaDias));
    setFechaInicio(new Date(r.fechaInicio).toISOString().slice(0, 10));
    setActivo(r.activo);
    setAsignacionTipo(r.asignacionTipo);
    setChoferAsignadoId(r.choferAsignado?.id ?? "");
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) {
      toast.error("Selecciona un cliente");
      return;
    }
    const litros = Number(litrosSolicitados) || 0;
    if (litros <= 0) {
      toast.error("Los litros deben ser mayores a 0");
      return;
    }
    const frec = Number(frecuenciaDias) || 0;
    if (frec <= 0) {
      toast.error("La frecuencia debe ser mayor a 0 días");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        clienteId,
        litrosSolicitados: litros,
        metodoPagoPreferido,
        nota: nota.trim() || null,
        frecuenciaDias: frec,
        fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
        activo,
        asignacionTipo,
        choferAsignadoId: asignacionTipo === "manual" ? (choferAsignadoId || null) : null,
      };

      if (editando) {
        await apiPatch(`/api/pedidos-recurrentes/${editando.id}`, payload);
        toast.success("Pedido recurrente actualizado");
      } else {
        await apiPost("/api/pedidos-recurrentes", payload);
        toast.success("Pedido recurrente creado");
      }
      setFormOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleBorrar(r: Recurrente) {
    try {
      await apiDelete(`/api/pedidos-recurrentes/${r.id}`);
      toast.success("Pedido recurrente eliminado");
      setBorrando(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  async function generarAhora(r: Recurrente) {
    try {
      await apiPost(`/api/pedidos-recurrentes/${r.id}/generar`, {});
      toast.success(`Pedido generado para ${r.cliente.nombre}`);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el pedido");
    }
  }

  async function toggleActivo(r: Recurrente) {
    try {
      await apiPatch(`/api/pedidos-recurrentes/${r.id}`, { activo: !r.activo });
      toast.success(r.activo ? "Pausado" : "Activado");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar");
    }
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">Pedidos recurrentes</h2>
          <p className="text-sm text-muted-foreground">
            Genera pedidos automáticamente para clientes que necesitan agua cada cierto tiempo (ej. semanal).
          </p>
        </div>
        <Button onClick={abrirNuevo} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Nuevo recurrente
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : recurrentes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Repeat className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No hay pedidos recurrentes. Crea el primero para clientes que reciben agua periódicamente.
            </p>
            <Button onClick={abrirNuevo} variant="outline" size="sm">
              <Plus className="mr-1 h-4 w-4" /> Crear recurrente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {recurrentes.map((r) => (
            <Card key={r.id} className={r.activo ? "" : "opacity-60"}>
              <CardContent className="flex items-center gap-3 p-3 sm:p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Repeat className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-medium">{r.cliente.nombre}</span>
                    <Badge variant="outline" className="text-[10px] gap-0.5">
                      <Calendar className="h-2.5 w-2.5" /> Cada {r.frecuenciaDias} día{r.frecuenciaDias !== 1 ? "s" : ""}
                    </Badge>
                    {r.cliente.zona && (
                      <Badge variant="outline" className="text-[10px]">{r.cliente.zona}</Badge>
                    )}
                    {!r.activo && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Pausado</Badge>
                    )}
                    {r.choferAsignado && (
                      <Badge variant="outline" className="text-[10px] gap-0.5 text-blue-700 dark:text-blue-300">
                        <UserCheck className="h-2.5 w-2.5" /> {r.choferAsignado.nombre}
                      </Badge>
                    )}
                    {r.asignacionTipo === "publicado" && (
                      <Badge variant="outline" className="text-[10px] text-purple-700 dark:text-purple-300">
                        Publicado
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    <Droplets className="mr-1 inline h-3 w-3" />
                    {formatNumber(r.litrosSolicitados, 0)} L · {labelMetodoPago(r.metodoPagoPreferido)}
                    {" · "}
                    Próxima: <strong>{formatDate(r.fechaProximaGeneracion)}</strong>
                    {r._count && r._count.pedidos > 0 && ` · ${r._count.pedidos} pedidos generados`}
                  </p>
                </div>
                {r.cliente.lat != null && r.cliente.lng != null && (
                  <a
                    href={`https://www.google.com/maps?q=${r.cliente.lat},${r.cliente.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-md p-1.5 text-primary hover:bg-primary/10"
                    title="Ver ubicación"
                  >
                    <Navigation className="h-4 w-4" />
                  </a>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generarAhora(r)}
                  className="shrink-0"
                  title="Generar pedido ahora"
                >
                  <Zap className="mr-1 h-3 w-3" /> Generar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toggleActivo(r)}>
                      {r.activo ? "Pausar" : "Activar"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => abrirEditar(r)}>
                      <Pencil className="mr-2 h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setBorrando(r)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Formulario */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[95vh] w-[95vw] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar pedido recurrente" : "Nuevo pedido recurrente"}</DialogTitle>
            <DialogDescription>
              Genera pedidos automáticamente para clientes que necesitan agua periódicamente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clienteRecurrente">Cliente *</Label>
              <Select value={clienteId || "__ninguno"} onValueChange={setClienteId}>
                <SelectTrigger id="clienteRecurrente">
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ninguno" disabled>— Selecciona —</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                      {c.zona ? ` · ${c.zona}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                El cliente debe estar en el catálogo. Si no lo ves, créalo primero en Clientes.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="litrosRecurrente">Litros por pedido *</Label>
                <Input
                  id="litrosRecurrente"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={litrosSolicitados}
                  onChange={(e) => setLitrosSolicitados(e.target.value)}
                  placeholder="5000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frecuenciaRecurrente">Frecuencia (días) *</Label>
                <Input
                  id="frecuenciaRecurrente"
                  type="number"
                  inputMode="numeric"
                  value={frecuenciaDias}
                  onChange={(e) => setFrecuenciaDias(e.target.value)}
                  placeholder="7"
                  required
                />
                <p className="text-xs text-muted-foreground">Ej: 7 = semanal, 14 = quincenal, 30 = mensual</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fechaInicioRecurrente">Fecha de inicio</Label>
                <Input
                  id="fechaInicioRecurrente"
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metodoPagoRecurrente">Método de pago</Label>
                <Select value={metodoPagoPreferido} onValueChange={setMetodoPagoPreferido}>
                  <SelectTrigger id="metodoPagoRecurrente">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METODOS_PAGO.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Asignación */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <UserCheck className="h-4 w-4 text-primary" /> Asignación
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant={asignacionTipo === "manual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAsignacionTipo("manual")}
                >
                  Asignar a chofer
                </Button>
                <Button
                  type="button"
                  variant={asignacionTipo === "publicado" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAsignacionTipo("publicado")}
                >
                  Publicar para choferes
                </Button>
              </div>
              {asignacionTipo === "manual" && (
                <div className="space-y-1">
                  <Label htmlFor="choferRecurrente" className="text-xs">Chofer</Label>
                  <Select value={choferAsignadoId || "__ninguno"} onValueChange={setChoferAsignadoId}>
                    <SelectTrigger id="choferRecurrente">
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ninguno">— Sin asignar —</SelectItem>
                      {choferes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notaRecurrente">Nota</Label>
              <Textarea
                id="notaRecurrente"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej. Rellenar estanque antes de que quede vacío"
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="activoRecurrente" className="text-sm font-medium">Activo</Label>
                <p className="text-xs text-muted-foreground">
                  Si está pausado, no se generarán pedidos automáticamente.
                </p>
              </div>
              <Switch id="activoRecurrente" checked={activo} onCheckedChange={setActivo} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : editando ? "Guardar cambios" : "Crear recurrente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <Dialog open={!!borrando} onOpenChange={(o) => !o && setBorrando(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar pedido recurrente</DialogTitle>
            <DialogDescription>
              ¿Eliminar el pedido recurrente de <strong>{borrando?.cliente.nombre}</strong>?
              Los pedidos ya generados se conservan.
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
