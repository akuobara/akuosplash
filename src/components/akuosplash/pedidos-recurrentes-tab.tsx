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
import { apiGet, apiPost, apiPatch, apiDelete } from "@/components/akuosplash/akuosplash-api-client";
import {
  formatNumber,
  formatDate,
  formatDateTime,
  labelMetodoPago,
  METODOS_PAGO,
} from "@/components/akuosplash/akuosplash-helpers";
import { CalendarView } from "./calendar-view";
import { useMemo } from "react";

interface Recurrente {
  id: string;
  creadoEn: string;
  litrosSolicitados: number;
  metodoPagoPreferido: string;
  nota: string | null;
  frecuenciaDias: number;
  diaSemanaPreferido: number | null;
  fechaInicio: string;
  fechaProximaGeneracion: string;
  activo: boolean;
  asignacionTipo: string;
  clienteId: string;
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
  pedidos?: {  // pedidos programados para mostrar en el calendario
    id: string;
    clienteNombre: string;
    clienteId: string | null;
    litrosSolicitados: number;
    fechaSolicitada: string | null;
    estado: string;
  }[];
}

export function PedidosRecurrentesTab({ refreshKey, onRefresh, clientes, choferes, pedidos = [] }: PedidosRecurrentesTabProps) {
  const [recurrentes, setRecurrentes] = useState<Recurrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<"lista" | "calendario">("lista");

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Recurrente | null>(null);
  const [borrando, setBorrando] = useState<Recurrente | null>(null);

  // Campos del formulario
  const [clienteId, setClienteId] = useState("");
  const [litrosSolicitados, setLitrosSolicitados] = useState("");
  const [metodoPagoPreferido, setMetodoPagoPreferido] = useState("credito");
  const [nota, setNota] = useState("");
  const [frecuenciaDias, setFrecuenciaDias] = useState("7");
  const [diaSemanaPreferido, setDiaSemanaPreferido] = useState<string>(""); // "" = sin preferencia, "0"-"6" = día
  const [fechaInicio, setFechaInicio] = useState("");
  const [activo, setActivo] = useState(true);
  const [asignacionTipo, setAsignacionTipo] = useState("manual");
  const [choferAsignadoId, setChoferAsignadoId] = useState("");
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ recurrentes: Recurrente[] }>("/api/akuosplash/pedidos-recurrentes");
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

  // Generar próximas fechas de pedidos recurrentes Y pedidos programados para el calendario
  const eventosCalendario = useMemo(() => {
    const eventos: { fecha: Date; litros: number; pedidos: { nombre: string; litros: number; tipo: "recurrente" | "programado" }[] }[] = [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // 1. Pedidos recurrentes — generar las próximas 6 ocurrencias
    // Pero solo si NO existe ya un pedido generado para esa fecha+cliente
    for (const r of recurrentes) {
      if (!r.activo) continue;
      // Parsear fechaInicio sin zona horaria (YYYY-MM-DD → local)
      const inicioParts = r.fechaInicio.split("T")[0].split("-");
      let fecha = new Date(parseInt(inicioParts[0]), parseInt(inicioParts[1]) - 1, parseInt(inicioParts[2]));
      fecha.setHours(0, 0, 0, 0);

      // Si la fecha de inicio ya pasó, avanzar hasta la próxima fecha futura
      if (fecha < hoy) {
        while (fecha < hoy) {
          fecha.setDate(fecha.getDate() + r.frecuenciaDias);
        }
      }

      for (let i = 0; i < 6; i++) {
        const fechaStr = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
        // Verificar si ya existe un pedido generado para esta fecha+cliente
        const yaExiste = pedidos.some(p =>
          p.clienteId === r.clienteId &&
          p.fechaSolicitada &&
          p.fechaSolicitada.split("T")[0] === fechaStr &&
          p.estado !== "entregado" &&
          p.estado !== "cancelado"
        );
        if (!yaExiste) {
          eventos.push({
            fecha: new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()),
            litros: r.litrosSolicitados,
            pedidos: [{
              nombre: r.cliente.nombre,
              litros: r.litrosSolicitados,
              tipo: "recurrente" as const,
            }],
          });
        }
        fecha.setDate(fecha.getDate() + r.frecuenciaDias);
      }
    }

    // 2. Pedidos programados (con fechaSolicitada futura, no entregados ni cancelados)
    for (const p of pedidos) {
      if (!p.fechaSolicitada) continue;
      if (p.estado === "entregado" || p.estado === "cancelado") continue;
      const parts = p.fechaSolicitada.split("T")[0].split("-");
      const fecha = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      fecha.setHours(0, 0, 0, 0);
      if (fecha < hoy) continue;
      eventos.push({
        fecha,
        litros: p.litrosSolicitados,
        pedidos: [{
          nombre: p.clienteNombre,
          litros: p.litrosSolicitados,
          tipo: "programado" as const,
        }],
      });
    }

    return eventos;
  }, [recurrentes, pedidos]);

  function abrirNuevo() {
    setEditando(null);
    setClienteId("");
    setLitrosSolicitados("");
    setMetodoPagoPreferido("credito");
    setNota("");
    setFrecuenciaDias("7");
    setDiaSemanaPreferido("");
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
    setDiaSemanaPreferido(r.diaSemanaPreferido !== null && r.diaSemanaPreferido !== undefined ? String(r.diaSemanaPreferido) : "");
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
        // Solo incluir diaSemanaPreferido si la frecuencia es 7 (semanal)
        diaSemanaPreferido: frec === 7 ? (diaSemanaPreferido === "" ? null : Number(diaSemanaPreferido)) : null,
        fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
        activo,
        asignacionTipo,
        choferAsignadoId: asignacionTipo === "manual" ? (choferAsignadoId || null) : null,
      };

      if (editando) {
        await apiPatch(`/api/akuosplash/pedidos-recurrentes/${editando.id}`, payload);
        toast.success("Pedido recurrente actualizado");
      } else {
        await apiPost("/api/akuosplash/pedidos-recurrentes", payload);
        toast.success(
          `Pedido recurrente creado. Se generará automáticamente cada ${frec} días. ` +
          `La próxima entrega es ${fechaInicio ? formatDate(fechaInicio) : "hoy"}. ` +
          `Míralo en el calendario de esta misma pestaña.`
        );
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
      await apiDelete(`/api/akuosplash/pedidos-recurrentes/${r.id}`);
      toast.success("Pedido recurrente eliminado");
      setBorrando(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  async function generarAhora(r: Recurrente) {
    try {
      await apiPost(`/api/akuosplash/pedidos-recurrentes/${r.id}/generar`, {});
      toast.success(`Pedido generado para ${r.cliente.nombre}`);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el pedido");
    }
  }

  async function toggleActivo(r: Recurrente) {
    try {
      await apiPatch(`/api/akuosplash/pedidos-recurrentes/${r.id}`, { activo: !r.activo });
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
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            <Button
              size="sm"
              variant={vista === "calendario" ? "default" : "ghost"}
              onClick={() => setVista("calendario")}
              className="h-7"
            >
              <Calendar className="mr-1 h-3 w-3" /> Calendario
            </Button>
            <Button
              size="sm"
              variant={vista === "lista" ? "default" : "ghost"}
              onClick={() => setVista("lista")}
              className="h-7"
            >
              <Repeat className="mr-1 h-3 w-3" /> Lista
            </Button>
          </div>
          <Button onClick={abrirNuevo} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Nuevo
          </Button>
        </div>
      </div>

      {/* Vista Calendario */}
      {vista === "calendario" && !loading && (
        <>
          {/* Resumen de próximos pedidos */}
          {(() => {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const manana = new Date(hoy);
            manana.setDate(manana.getDate() + 1);
            const en7dias = new Date(hoy);
            en7dias.setDate(en7dias.getDate() + 7);

            const deHoy = eventosCalendario.filter(e => {
              const f = new Date(e.fecha);
              f.setHours(0,0,0,0);
              return f.getTime() === hoy.getTime();
            });
            const deManana = eventosCalendario.filter(e => {
              const f = new Date(e.fecha);
              f.setHours(0,0,0,0);
              return f.getTime() === manana.getTime();
            });
            const de7dias = eventosCalendario.filter(e => {
              const f = new Date(e.fecha);
              f.setHours(0,0,0,0);
              return f > hoy && f <= en7dias;
            });

            const litrosHoy = deHoy.reduce((s,e) => s+e.litros, 0);
            const litrosManana = deManana.reduce((s,e) => s+e.litros, 0);
            const litros7dias = de7dias.reduce((s,e) => s+e.litros, 0);

            return (
              <div className="grid grid-cols-3 gap-3">
                <Card className={litrosHoy > 0 ? "border-primary/40 bg-primary/5" : ""}>
                  <CardContent className="p-3">
                    <p className="text-xs uppercase text-muted-foreground">Hoy</p>
                    <p className="text-lg font-bold tabular-nums">{formatNumber(litrosHoy, 0)} L</p>
                    <p className="text-[10px] text-muted-foreground">{deHoy.length} pedido(s)</p>
                  </CardContent>
                </Card>
                <Card className={litrosManana > 0 ? "border-blue-400/40 bg-blue-50 dark:bg-blue-900/10" : ""}>
                  <CardContent className="p-3">
                    <p className="text-xs uppercase text-muted-foreground">Mañana</p>
                    <p className="text-lg font-bold tabular-nums">{formatNumber(litrosManana, 0)} L</p>
                    <p className="text-[10px] text-muted-foreground">{deManana.length} pedido(s)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs uppercase text-muted-foreground">Próximos 7 días</p>
                    <p className="text-lg font-bold tabular-nums">{formatNumber(litros7dias, 0)} L</p>
                    <p className="text-[10px] text-muted-foreground">{de7dias.length} pedido(s)</p>
                  </CardContent>
                </Card>
              </div>
            );
          })()}
          <CalendarView eventos={eventosCalendario} />
        </>
      )}

      {/* Vista Lista */}
      {vista === "lista" && (
        loading ? (
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
                    {r.diaSemanaPreferido !== null && r.diaSemanaPreferido !== undefined && (
                      <Badge variant="outline" className="text-[10px] gap-0.5 text-blue-700 border-blue-300">
                        <Calendar className="h-2.5 w-2.5" /> {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][r.diaSemanaPreferido]}
                      </Badge>
                    )}
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
      )
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
              {/* Selector de día de la semana preferido — solo visible cuando frecuencia = 7 (semanal) */}
              {Number(frecuenciaDias) === 7 && (
                <div className="space-y-2">
                  <Label htmlFor="diaSemanaPreferido">Día de la semana preferido</Label>
                  <Select value={diaSemanaPreferido || "__auto"} onValueChange={(v) => setDiaSemanaPreferido(v === "__auto" ? "" : v)}>
                    <SelectTrigger id="diaSemanaPreferido">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__auto">Cualquier día (clásico, +7 días)</SelectItem>
                      <SelectItem value="0">Domingo</SelectItem>
                      <SelectItem value="1">Lunes</SelectItem>
                      <SelectItem value="2">Martes</SelectItem>
                      <SelectItem value="3">Miércoles</SelectItem>
                      <SelectItem value="4">Jueves</SelectItem>
                      <SelectItem value="5">Viernes</SelectItem>
                      <SelectItem value="6">Sábado</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Si elegís un día, la próxima entrega SIEMPRE cae ese día, aunque el chofer entregue agua otro día.
                    Ej: cliente que quiere el agua los viernes → elegí "Viernes" y la programación se mantiene los viernes.
                  </p>
                </div>
              )}
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
