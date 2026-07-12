"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  Package,
  Phone,
  MapPin,
  Navigation,
  ExternalLink,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Truck,
  Users,
  Filter,
  Droplets,
  UserCheck,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import {
  formatNumber,
  formatCurrency,
  formatDateTime,
  formatDate,
  labelEstadoPedido,
  labelMetodoPago,
  ESTADOS_PEDIDO,
  METODOS_PAGO,
  toDateTimeLocalInput,
} from "@/lib/helpers";

interface Pedido {
  id: string;
  creadoEn: string;
  clienteNombre: string;
  clienteDireccion: string | null;
  clienteTelefono: string | null;
  clienteZona: string | null;
  clienteLat: number | null;
  clienteLng: number | null;
  clienteId: string | null;
  cliente?: {
    id: string;
    nombre: string;
    direccion: string | null;
    telefono: string | null;
    zona: string | null;
    lat: number | null;
    lng: number | null;
    requiereIngresoPropiedad: boolean;
    entregaDesdeAfuera: boolean;
    conexionExterna: boolean;
    requiereClientePresente: boolean;
    indicacionesAcceso: string | null;
    choferPreferidoId: string | null;
  } | null;
  litrosSolicitados: number;
  fechaSolicitada: string | null;
  metodoPagoPreferido: string;
  indicacionesAcceso: string | null;
  nota: string | null;
  estado: string;
  entregaId: string | null;
  entrega?: { id: string; litros: number; total: number; fecha: string } | null;
  chofer?: { id: string; nombre: string } | null;
  // Asignación
  asignacionTipo: string;
  choferAsignado?: { id: string; nombre: string } | null;
  tomadoPorChofer?: { id: string; nombre: string } | null;
  prioridadChofer?: { id: string; nombre: string } | null;
  prioridadTipo: string;
  publicadoEn: string | null;
  vueltaId: string | null;
  vuelta?: { id: string; numero: number } | null;
  pedidoRecurrenteId?: string | null;
}

interface ClienteOption {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  zona: string | null;
  lat: number | null;
  lng: number | null;
  precioEfectivoPorLitro: number;
  precioTransferenciaPorLitro: number;
  requiereIngresoPropiedad: boolean;
  entregaDesdeAfuera: boolean;
  conexionExterna: boolean;
  requiereClientePresente: boolean;
  indicacionesAcceso: string | null;
  estanquesJson: string | null;
  choferPreferidoId: string | null;
}

interface PedidosTabProps {
  refreshKey: number;
  onRefresh: () => void;
  canCreate: boolean;
  isDueno: boolean;
  currentUserId: string;
  clientes: ClienteOption[];
  choferes: { id: string; nombre: string }[];
  clientePreselect?: string | null;
  onPreselectConsumed?: () => void;
  vueltaActual?: { litros: number; capacidadCamion?: number; numero: number } | null;
}

const ESTADO_COLORS: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  programado: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  en_ruta: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  entregado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  cancelado: "bg-muted text-muted-foreground",
};

export function PedidosTab({ refreshKey, onRefresh, canCreate, isDueno, currentUserId, clientes, choferes, clientePreselect, onPreselectConsumed, vueltaActual }: PedidosTabProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [vista, setVista] = useState<"lista" | "ruta">("lista");

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Pedido | null>(null);
  const [detalle, setDetalle] = useState<Pedido | null>(null);
  const [borrando, setBorrando] = useState<Pedido | null>(null);
  const [convirtiendo, setConvirtiendo] = useState<Pedido | null>(null);

  // Campos del formulario
  const [clienteId, setClienteId] = useState<string>("__nuevo");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteZona, setClienteZona] = useState("");
  const [litrosSolicitados, setLitrosSolicitados] = useState("");
  const [fechaSolicitada, setFechaSolicitada] = useState("");
  const [metodoPagoPreferido, setMetodoPagoPreferido] = useState("credito");
  const [indicacionesAcceso, setIndicacionesAcceso] = useState("");
  const [nota, setNota] = useState("");
  // Asignación
  const [asignacionTipo, setAsignacionTipo] = useState<string>("manual");
  const [choferAsignadoId, setChoferAsignadoId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Campos para convertir a entrega
  const [litrosReales, setLitrosReales] = useState("");
  const [precioPorLitro, setPrecioPorLitro] = useState("");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoTransferencia, setMontoTransferencia] = useState("");
  // Estanques para entrega por separado
  const [estanquesConvertir, setEstanquesConvertir] = useState<{ nombre: string; litros: string; precio: string; metodoPago: string; montoRecibido: string }[]>([]);
  const [modoEstanquesConvertir, setModoEstanquesConvertir] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ pedidos: Pedido[] }>("/api/pedidos");
      setPedidos(data.pedidos);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los pedidos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  // Cuando llega un cliente preseleccionado desde la ficha de cliente, abrir el formulario
  useEffect(() => {
    if (clientePreselect && canCreate) {
      // Buscar el cliente en el catálogo
      const c = clientes.find((cl) => cl.id === clientePreselect);
      if (c) {
        abrirNuevo();
        // Pequeño delay para que el formulario se abra antes de setear el cliente
        setTimeout(() => {
          setClienteId(c.id);
          setClienteNombre(c.nombre);
          setClienteDireccion(c.direccion ?? "");
          setClienteTelefono(c.telefono ?? "");
          setClienteZona(c.zona ?? "");
          setIndicacionesAcceso(c.indicacionesAcceso ?? "");
        }, 50);
      }
      onPreselectConsumed?.();
    }
  }, [clientePreselect, canCreate, clientes]);

  const filtrados = pedidos.filter((p) => {
    if (filtroEstado !== "todos" && p.estado !== filtroEstado) return false;
    return true;
  });

  // Para la vista de planificación de ruta
  const pendientesYProgramados = pedidos.filter(
    (p) => p.estado === "pendiente" || p.estado === "programado"
  );

  // Agrupar por zona
  const porZona: Record<string, Pedido[]> = {};
  for (const p of pendientesYProgramados) {
    const zona = p.clienteZona || "Sin zona";
    if (!porZona[zona]) porZona[zona] = [];
    porZona[zona].push(p);
  }

  // Totales
  const totalLitrosPendientes = pendientesYProgramados.reduce((s, p) => s + p.litrosSolicitados, 0);
  const totalPedidosPendientes = pendientesYProgramados.length;

  function abrirNuevo() {
    setEditando(null);
    setClienteId("__nuevo");
    setClienteNombre("");
    setClienteDireccion("");
    setClienteTelefono("");
    setClienteZona("");
    setLitrosSolicitados("");
    setFechaSolicitada("");
    setMetodoPagoPreferido("credito");
    setIndicacionesAcceso("");
    setNota("");
    setAsignacionTipo("manual");
    setChoferAsignadoId("");
    setFormOpen(true);
  }

  function abrirEditar(p: Pedido) {
    setEditando(p);
    setClienteId(p.clienteId ?? "__nuevo");
    setClienteNombre(p.clienteNombre);
    setClienteDireccion(p.clienteDireccion ?? "");
    setClienteTelefono(p.clienteTelefono ?? "");
    setClienteZona(p.clienteZona ?? "");
    setLitrosSolicitados(String(p.litrosSolicitados));
    setFechaSolicitada(p.fechaSolicitada ? toDateTimeLocalInput(p.fechaSolicitada) : "");
    setMetodoPagoPreferido(p.metodoPagoPreferido);
    setIndicacionesAcceso(p.indicacionesAcceso ?? "");
    setNota(p.nota ?? "");
    setAsignacionTipo(p.asignacionTipo || "manual");
    setChoferAsignadoId(p.choferAsignado?.id ?? "");
    setFormOpen(true);
  }

  function abrirConvertir(p: Pedido) {
    setConvirtiendo(p);
    setLitrosReales(String(p.litrosSolicitados));
    setPrecioPorLitro("");
    setMontoEfectivo("");
    setMontoTransferencia("");
    setModoEstanquesConvertir(false);
    setEstanquesConvertir([]);

    // Avisar si los litros del pedido exceden el agua disponible en el camión
    if (vueltaActual && vueltaActual.capacidadCamion && vueltaActual.capacidadCamion > 0) {
      const disponible = vueltaActual.capacidadCamion - vueltaActual.litros;
      if (p.litrosSolicitados > disponible + 300) {
        if (disponible <= 0) {
          toast.warning(
            `El camión está vacío. Este pedido necesita ${formatNumber(p.litrosSolicitados, 0)} L. ` +
            `Deberías cerrar la vuelta y empezar una nueva.`,
            { duration: 8000 }
          );
        } else {
          toast.warning(
            `Quedan ${formatNumber(disponible, 0)} L en el camión pero el pedido es de ${formatNumber(p.litrosSolicitados, 0)} L. ` +
            `Puedes entregar menos y reprogramar lo que falta, o cerrar la vuelta y empezar una nueva.`,
            { duration: 8000 }
          );
        }
      }
    }

    // Buscar el cliente en el catálogo para ver si tiene estanques
    if (p.clienteId) {
      const c = clientes.find((cl) => cl.id === p.clienteId);
      if (c && c.estanquesJson) {
        try {
          const estanques = JSON.parse(c.estanquesJson);
          const independientes = estanques.filter((e: any) => e.facturaSeparada === true);
          const lista = independientes.length > 0 ? independientes : estanques;
          if (lista.length > 0) {
            setEstanquesConvertir(lista.map((e: any) => ({
              nombre: e.nombre || e.tipo,
              litros: "",
              // Para "sin pago" (credito) usar el precio MÁS ALTO
              precio: String(Math.max(c.precioEfectivoPorLitro || 0, c.precioTransferenciaPorLitro || 0)),
              metodoPago: "credito",
              montoRecibido: "",
            })));
            // Auto-activar si hay con factura separada
            setModoEstanquesConvertir(independientes.length > 0);
          }
        } catch {}
      }
    }
  }

  function onSelectCliente(id: string) {
    setClienteId(id);
    if (id === "__nuevo") return;
    const c = clientes.find((c) => c.id === id);
    if (c) {
      setClienteNombre(c.nombre);
      setClienteDireccion(c.direccion ?? "");
      setClienteTelefono(c.telefono ?? "");
      setClienteZona(c.zona ?? "");
      setIndicacionesAcceso(c.indicacionesAcceso ?? "");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId || clienteId === "__nuevo") {
      toast.error("Selecciona un cliente del catálogo");
      return;
    }
    if (!clienteNombre.trim()) {
      toast.error("Indica el nombre del cliente");
      return;
    }
    const litros = Number(litrosSolicitados) || 0;
    if (litros <= 0) {
      toast.error("Los litros solicitados deben ser mayores a 0");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        clienteId: clienteId === "__nuevo" ? null : clienteId,
        clienteNombre: clienteNombre.trim(),
        clienteDireccion: clienteDireccion.trim() || null,
        clienteTelefono: clienteTelefono.trim() || null,
        clienteZona: clienteZona.trim() || null,
        litrosSolicitados: litros,
        fechaSolicitada: fechaSolicitada || null,
        metodoPagoPreferido,
        indicacionesAcceso: indicacionesAcceso.trim() || null,
        nota: nota.trim() || null,
        asignacionTipo,
        choferAsignadoId: isDueno && asignacionTipo === "manual" ? (choferAsignadoId || null) : null,
      };

      if (editando) {
        await apiPatch(`/api/pedidos/${editando.id}`, payload);
        toast.success("Pedido actualizado");
      } else {
        await apiPost("/api/pedidos", payload);
        toast.success("Pedido creado");
      }
      setFormOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleBorrar(p: Pedido) {
    try {
      await apiDelete(`/api/pedidos/${p.id}`);
      toast.success("Pedido eliminado");
      setBorrando(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  async function handleConvertir(e: React.FormEvent) {
    e.preventDefault();
    if (!convirtiendo) return;

    // Si está en modo estanques, calcular totales desde el desglose
    if (modoEstanquesConvertir && estanquesConvertir.length > 0) {
      const totalLitrosEst = estanquesConvertir.reduce((s, e) => s + (Number(e.litros) || 0), 0);
      if (totalLitrosEst <= 0) {
        toast.error("Ingresa al menos litros en un estanque");
        return;
      }

      // Normalizar montoRecibido por estanque: si es efectivo/transferencia y está vacío,
      // usar el total calculado (litros × precio). Si es credito, queda 0 (deuda).
      const estanquesNormalizados = estanquesConvertir.map((e) => {
        const litrosNum = Number(e.litros) || 0;
        const precioNum = Number(e.precio) || 0;
        const totalEstCalc = litrosNum * precioNum;
        let montoRecibidoNum = Number(e.montoRecibido) || 0;
        if (e.metodoPago !== "credito" && montoRecibidoNum === 0 && totalEstCalc > 0) {
          montoRecibidoNum = Math.round(totalEstCalc);
        }
        return { ...e, litros: litrosNum, precio: precioNum, montoRecibido: montoRecibidoNum, total: totalEstCalc };
      });

      const totalVentaEst = estanquesNormalizados.reduce((s, e) => s + e.total, 0);
      const totalEfectivoEst = estanquesNormalizados.filter((e) => e.metodoPago === "efectivo").reduce((s, e) => s + e.montoRecibido, 0);
      const totalTransferenciaEst = estanquesNormalizados.filter((e) => e.metodoPago === "transferencia").reduce((s, e) => s + e.montoRecibido, 0);

      setSaving(true);
      try {
        await apiPost(`/api/pedidos/${convirtiendo.id}/convertir`, {
          litrosReales: totalLitrosEst,
          precioPorLitro: 0,
          montoEfectivo: totalEfectivoEst,
          montoTransferencia: totalTransferenciaEst,
          detalleEstanquesJson: JSON.stringify(estanquesNormalizados.map((e) => ({
            nombre: e.nombre,
            litros: e.litros,
            precioPorLitro: e.precio,
            total: e.total,
            metodoPago: e.metodoPago,
            montoRecibido: e.montoRecibido,
          }))),
        });
        toast.success("Pedido convertido en entrega");
        setConvirtiendo(null);
        onRefresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo convertir");
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      await apiPost(`/api/pedidos/${convirtiendo.id}/convertir`, {
        litrosReales: Number(litrosReales) || convirtiendo.litrosSolicitados,
        precioPorLitro: Number(precioPorLitro) || undefined,
        montoEfectivo: Number(montoEfectivo) || 0,
        montoTransferencia: Number(montoTransferencia) || 0,
      });
      toast.success("Pedido convertido en entrega");
      setConvirtiendo(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo convertir");
    } finally {
      setSaving(false);
    }
  }

  async function cambiarEstado(p: Pedido, nuevoEstado: string) {
    try {
      await apiPatch(`/api/pedidos/${p.id}`, { estado: nuevoEstado });
      toast.success(`Pedido marcado como ${labelEstadoPedido(nuevoEstado)}`);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    }
  }

  async function publicarPedido(p: Pedido) {
    try {
      await apiPost(`/api/pedidos/${p.id}/publicar`, {});
      toast.success("Pedido publicado para choferes");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo publicar");
    }
  }

  async function tomarPedido(p: Pedido) {
    try {
      await apiPost(`/api/pedidos/${p.id}/tomar`, {});
      toast.success("Pedido tomado");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo tomar el pedido");
    }
  }

  async function cederPrioridad(p: Pedido, permanente: boolean = false) {
    try {
      await apiPost(`/api/pedidos/${p.id}/ceder`, { permanente });
      toast.success(permanente ? "Prioridad cedida permanentemente" : "Prioridad cedida para este pedido");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo ceder la prioridad");
    }
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">Pedidos</h2>
          <p className="text-sm text-muted-foreground">
            Registra pedidos de agua de clientes (por teléfono, etc.) y conviértelos en entregas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            <Button
              size="sm"
              variant={vista === "lista" ? "default" : "ghost"}
              onClick={() => setVista("lista")}
              className="h-7"
            >
              <Filter className="mr-1 h-3 w-3" /> Lista
            </Button>
            <Button
              size="sm"
              variant={vista === "ruta" ? "default" : "ghost"}
              onClick={() => setVista("ruta")}
              className="h-7"
            >
              <Navigation className="mr-1 h-3 w-3" /> Ruta
            </Button>
          </div>
          {canCreate && (
            <Button onClick={abrirNuevo} size="sm">
              <Plus className="mr-1 h-4 w-4" /> Nuevo pedido
            </Button>
          )}
        </div>
      </div>

      {/* Vista Lista */}
      {vista === "lista" && (
        <>
          {/* Filtros de estado */}
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={filtroEstado === "todos" ? "default" : "outline"}
              onClick={() => setFiltroEstado("todos")}
            >
              Todos ({pedidos.length})
            </Button>
            {ESTADOS_PEDIDO.map((e) => {
              const count = pedidos.filter((p) => p.estado === e.value).length;
              if (count === 0) return null;
              return (
                <Button
                  key={e.value}
                  size="sm"
                  variant={filtroEstado === e.value ? "default" : "outline"}
                  onClick={() => setFiltroEstado(e.value)}
                >
                  {e.label} ({count})
                </Button>
              );
            })}
          </div>

          {/* Lista */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
                <Package className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {pedidos.length === 0
                    ? "No hay pedidos registrados."
                    : "No hay pedidos con este filtro."}
                </p>
                {canCreate && (
                  <Button onClick={abrirNuevo} variant="outline" size="sm">
                    <Plus className="mr-1 h-4 w-4" /> Crear primer pedido
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {filtrados.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 p-3 sm:p-4">
                      <button
                        type="button"
                        onClick={() => setDetalle(p)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Package className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate font-medium">{p.clienteNombre}</span>
                            <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ESTADO_COLORS[p.estado] || ""}`}>
                              {labelEstadoPedido(p.estado)}
                            </span>
                            {p.clienteZona && (
                              <Badge variant="outline" className="text-[10px]">{p.clienteZona}</Badge>
                            )}
                            {/* Badge: pedido recurrente */}
                            {p.pedidoRecurrenteId && (
                              <Badge variant="outline" className="text-[10px] gap-0.5 bg-primary/10 text-primary border-primary/30" title="Pedido generado desde una regla recurrente">
                                <Repeat className="h-2.5 w-2.5" /> Recurrente
                              </Badge>
                            )}
                            {/* Badge: programado para fecha futura */}
                            {p.fechaSolicitada && (() => {
                              const fecha = new Date(p.fechaSolicitada);
                              const hoy = new Date();
                              hoy.setHours(0, 0, 0, 0);
                              if (fecha > hoy) {
                                return (
                                  <Badge variant="outline" className="text-[10px] gap-0.5 text-blue-700 dark:text-blue-300" title={`Programado para ${formatDate(p.fechaSolicitada!)}`}>
                                    <Clock className="h-2.5 w-2.5" /> {formatDate(p.fechaSolicitada!)}
                                  </Badge>
                                );
                              }
                              return null;
                            })()}
                            {/* Badges de asignación */}
                            {p.asignacionTipo === "publicado" && !p.tomadoPorChofer && (
                              <Badge variant="outline" className="text-[10px] gap-0.5 text-purple-700 dark:text-purple-300">
                                <Package className="h-2.5 w-2.5" /> Publicado
                              </Badge>
                            )}
                            {p.tomadoPorChofer && (
                              <Badge variant="outline" className="text-[10px] gap-0.5 text-blue-700 dark:text-blue-300">
                                <Truck className="h-2.5 w-2.5" /> {p.tomadoPorChofer.nombre}
                              </Badge>
                            )}
                            {p.choferAsignado && !p.tomadoPorChofer && (
                              <Badge variant="outline" className="text-[10px] gap-0.5 text-blue-700 dark:text-blue-300">
                                <UserCheck className="h-2.5 w-2.5" /> {p.choferAsignado.nombre}
                              </Badge>
                            )}
                            {p.prioridadChofer && p.prioridadTipo !== "ninguna" && (
                              <Badge variant="outline" className="text-[10px] gap-0.5 text-amber-700 dark:text-amber-300" title={`Prioridad ${p.prioridadTipo} para ${p.prioridadChofer.nombre}`}>
                                <UserCheck className="h-2.5 w-2.5" /> {p.prioridadChofer.nombre}
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            <Droplets className="mr-1 inline h-3 w-3" />
                            {formatNumber(p.litrosSolicitados, 0)} L · {labelMetodoPago(p.metodoPagoPreferido)}
                            {p.fechaSolicitada && (
                              <>
                                <Calendar className="ml-2 inline h-3 w-3" />
                                {formatDate(p.fechaSolicitada)}
                              </>
                            )}
                            {p.clienteTelefono && (
                              <>
                                <Phone className="ml-2 inline h-3 w-3" />
                                {p.clienteTelefono}
                              </>
                            )}
                          </p>
                        </div>
                        {p.clienteLat != null && p.clienteLng != null && (
                          <a
                            href={`https://www.google.com/maps?q=${p.clienteLat},${p.clienteLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 rounded-md p-1.5 text-primary hover:bg-primary/10"
                            title="Ver ubicación en Google Maps"
                          >
                            <Navigation className="h-4 w-4" />
                          </a>
                        )}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetalle(p)}>
                            <Eye className="mr-2 h-4 w-4" /> Ver detalle
                          </DropdownMenuItem>
                          {canCreate && p.estado !== "entregado" && p.estado !== "cancelado" && (
                            <>
                              {/* Solo mostrar "Convertir en entrega" si:
                                  - El usuario es el chofer preferido del cliente, OR
                                  - El cliente no tiene chofer preferido (cualquiera puede entregar) */}
                              {(() => {
                                const clientePedido = p.clienteId ? clientes.find(c => c.id === p.clienteId) : null;
                                const choferPrefId = clientePedido?.choferPreferidoId;
                                const puedeConvertir = !choferPrefId || choferPrefId === currentUserId;
                                if (!puedeConvertir) return null;
                                return (
                                  <DropdownMenuItem onClick={() => abrirConvertir(p)}>
                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Convertir en entrega
                                  </DropdownMenuItem>
                                );
                              })()}
                              <DropdownMenuItem onClick={() => abrirEditar(p)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>

                              {/* Acciones de asignación */}
                              {isDueno && p.asignacionTipo === "manual" && !p.tomadoPorChofer && (
                                <DropdownMenuItem onClick={() => publicarPedido(p)}>
                                  <Package className="mr-2 h-4 w-4" /> Publicar para choferes
                                </DropdownMenuItem>
                              )}
                              {!isDueno && p.asignacionTipo === "publicado" && !p.tomadoPorChofer && (
                                <DropdownMenuItem onClick={() => tomarPedido(p)}>
                                  <Truck className="mr-2 h-4 w-4" /> Tomar pedido
                                </DropdownMenuItem>
                              )}
                              {!isDueno && p.prioridadChofer && p.prioridadChofer.id === currentUserId && (
                                <DropdownMenuItem onClick={() => cederPrioridad(p, false)}>
                                  <UserCheck className="mr-2 h-4 w-4" /> Ceder prioridad (este caso)
                                </DropdownMenuItem>
                              )}
                              {!isDueno && p.prioridadChofer && p.prioridadChofer.id === currentUserId && (
                                <DropdownMenuItem onClick={() => cederPrioridad(p, true)}>
                                  <UserCheck className="mr-2 h-4 w-4" /> Ceder prioridad (permanente)
                                </DropdownMenuItem>
                              )}

                              {p.estado === "pendiente" && (
                                <DropdownMenuItem onClick={() => cambiarEstado(p, "programado")}>
                                  <Clock className="mr-2 h-4 w-4" /> Marcar programado
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => cambiarEstado(p, "cancelado")}>
                                <XCircle className="mr-2 h-4 w-4" /> Cancelar pedido
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setBorrando(p)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Vista Ruta (planificación) */}
      {vista === "ruta" && (
        <div className="space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-xs uppercase text-muted-foreground">Pedidos pendientes</p>
                <p className="text-xl font-bold">{totalPedidosPendientes}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs uppercase text-muted-foreground">Litros a entregar</p>
                <p className="text-xl font-bold tabular-nums">{formatNumber(totalLitrosPendientes, 0)} L</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs uppercase text-muted-foreground">Zonas</p>
                <p className="text-xl font-bold">{Object.keys(porZona).length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Agrupación por zona */}
          {pendientesYProgramados.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-sm text-muted-foreground">
                  No hay pedidos pendientes. ¡Todo al día!
                </p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(porZona)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([zona, pedidosZona]) => {
                const litrosZona = pedidosZona.reduce((s, p) => s + p.litrosSolicitados, 0);
                return (
                  <Card key={zona}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <CardTitle className="text-base">{zona}</CardTitle>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {pedidosZona.length} pedido(s) · {formatNumber(litrosZona, 0)} L
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ul className="divide-y divide-border">
                        {pedidosZona.map((p) => (
                          <li key={p.id} className="flex items-center gap-3 p-3">
                            <button
                              type="button"
                              onClick={() => setDetalle(p)}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
                                {formatNumber(p.litrosSolicitados, 0)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate font-medium text-sm">{p.clienteNombre}</span>
                                  <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ESTADO_COLORS[p.estado] || ""}`}>
                                    {labelEstadoPedido(p.estado)}
                                  </span>
                                </div>
                                <p className="truncate text-xs text-muted-foreground">
                                  {p.clienteDireccion || "Sin dirección"}
                                  {p.fechaSolicitada && ` · ${formatDate(p.fechaSolicitada)}`}
                                </p>
                              </div>
                            </button>
                            {p.clienteLat != null && p.clienteLng != null && (
                              <a
                                href={`https://www.google.com/maps?q=${p.clienteLat},${p.clienteLng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 rounded-md p-1.5 text-primary hover:bg-primary/10"
                                title="Ver ubicación"
                              >
                                <Navigation className="h-4 w-4" />
                              </a>
                            )}
                            {canCreate && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => abrirConvertir(p)}
                                className="shrink-0 h-7"
                              >
                                <Truck className="mr-1 h-3 w-3" /> Entregar
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })
          )}
        </div>
      )}

      {/* Formulario crear/editar pedido */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[95vh] w-[95vw] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar pedido" : "Nuevo pedido"}</DialogTitle>
            <DialogDescription>
              Registra el pedido de agua. Selecciona un cliente del catálogo. Si es nuevo, primero créalo en Clientes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {/* Selector de cliente — SOLO del catálogo */}
            <div className="space-y-2">
              <Label htmlFor="clienteSelect">Cliente *</Label>
              {clientes.length === 0 ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">No hay clientes registrados</p>
                  <p className="mt-1 text-xs">Primero debes crear la ficha del cliente en la pestaña Clientes. No se pueden crear pedidos para clientes no registrados.</p>
                </div>
              ) : (
                <Select value={clienteId} onValueChange={onSelectCliente}>
                  <SelectTrigger id="clienteSelect">
                    <SelectValue placeholder="Selecciona un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                        {c.zona ? ` · ${c.zona}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Info del cliente seleccionado (solo lectura) */}
            {clienteId && clienteId !== "__nuevo" && clienteNombre && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-sm">
                <p><strong>{clienteNombre}</strong></p>
                {clienteDireccion && <p className="text-muted-foreground">📍 {clienteDireccion}</p>}
                {clienteTelefono && <p className="text-muted-foreground">📞 {clienteTelefono}</p>}
                {clienteZona && <p className="text-muted-foreground">🗺️ {clienteZona}</p>}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="litrosSolicitados">Litros solicitados *</Label>
                <Input
                  id="litrosSolicitados"
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
                <Label htmlFor="fechaSolicitada">Fecha solicitada (opcional)</Label>
                <Input
                  id="fechaSolicitada"
                  type="datetime-local"
                  value={fechaSolicitada}
                  onChange={(e) => setFechaSolicitada(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="metodoPagoPreferido">Método de pago preferido</Label>
              <Select value={metodoPagoPreferido} onValueChange={setMetodoPagoPreferido}>
                <SelectTrigger id="metodoPagoPreferido">
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

            <div className="space-y-2">
              <Label htmlFor="indicacionesAcceso">Indicaciones de acceso</Label>
              <Textarea
                id="indicacionesAcceso"
                value={indicacionesAcceso}
                onChange={(e) => setIndicacionesAcceso(e.target.value)}
                placeholder="Ej. Portón verde, llamar al llegar. Estanque atrás."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notaPedido">Nota</Label>
              <Textarea
                id="notaPedido"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej. Cliente llama temprano, pedir confirmación antes de salir"
                rows={2}
              />
            </div>

            {/* Asignación — solo dueño */}
            {isDueno && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <UserCheck className="h-4 w-4 text-primary" /> Asignación de chofer
                </Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant={asignacionTipo === "manual" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAsignacionTipo("manual")}
                  >
                    Asignar a chofer específico
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
                    <Label htmlFor="choferAsignado" className="text-xs">Chofer</Label>
                    <Select value={choferAsignadoId || "__ninguno"} onValueChange={setChoferAsignadoId}>
                      <SelectTrigger id="choferAsignado">
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

                {asignacionTipo === "publicado" && (
                  <p className="text-xs text-muted-foreground">
                    El pedido quedará disponible para que cualquier chofer lo tome.
                    Si el cliente tiene chofer preferido, ese chofer tendrá prioridad.
                  </p>
                )}

                {!isDueno && (
                  <p className="text-xs text-muted-foreground">
                    Como chofer, si el cliente es nuevo, tendrás prioridad permanente para atenderlo.
                  </p>
                )}
              </div>
            )}

            {!isDueno && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs">
                <p className="font-medium">Asignación automática:</p>
                <p className="mt-1 text-muted-foreground">
                  {clienteId && clienteId !== "__nuevo"
                    ? "Si el cliente tiene chofer preferido, el pedido se asignará a ese chofer."
                    : "Como estás creando un cliente nuevo, tendrás prioridad permanente para atender pedidos de este cliente."}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : editando ? "Guardar cambios" : "Crear pedido"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de detalle */}
      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle del pedido</DialogTitle>
            <DialogDescription>
              {detalle && `Creado ${formatDateTime(detalle.creadoEn)}`}
            </DialogDescription>
          </DialogHeader>
          {detalle && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Cliente" value={detalle.clienteNombre} />
                <Field label="Estado" value={labelEstadoPedido(detalle.estado)} />
                <Field label="Teléfono" value={detalle.clienteTelefono || "—"} />
                <Field label="Zona" value={detalle.clienteZona || "—"} />
                <Field label="Litros solicitados" value={`${formatNumber(detalle.litrosSolicitados, 0)} L`} />
                <Field label="Método de pago" value={labelMetodoPago(detalle.metodoPagoPreferido)} />
                {detalle.fechaSolicitada && (
                  <Field label="Fecha solicitada" value={formatDateTime(detalle.fechaSolicitada)} />
                )}
                {detalle.chofer && (
                  <Field label="Tomado por" value={detalle.chofer.nombre} />
                )}
                {detalle.vuelta && (
                  <Field label="Vuelta asignada" value={`#${detalle.vuelta.numero}`} />
                )}
                {detalle.entrega && (
                  <Field label="Entrega" value={`${formatNumber(detalle.entrega.litros, 0)} L · ${formatCurrency(detalle.entrega.total)}`} />
                )}
              </div>

              {detalle.clienteDireccion && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Dirección</p>
                  <p className="font-medium">{detalle.clienteDireccion}</p>
                </div>
              )}

              {detalle.indicacionesAcceso && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Indicaciones de acceso</p>
                  <p className="mt-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-2 text-amber-900 dark:text-amber-200 whitespace-pre-wrap">
                    {detalle.indicacionesAcceso}
                  </p>
                </div>
              )}

              {detalle.nota && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Nota</p>
                  <p className="mt-1 rounded-lg bg-muted/40 p-2">{detalle.nota}</p>
                </div>
              )}

              {detalle.clienteLat != null && detalle.clienteLng != null && (
                <a
                  href={`https://www.google.com/maps?q=${detalle.clienteLat},${detalle.clienteLng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Navigation className="h-4 w-4" /> Cómo llegar (Google Maps)
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              {/* Info de acceso del cliente del catálogo */}
              {detalle.cliente && (
                <div className="rounded-lg border border-border bg-muted/20 p-2 text-xs">
                  <p className="mb-1 font-medium">Info de acceso del cliente:</p>
                  <div className="flex flex-wrap gap-1">
                    {detalle.cliente.requiereIngresoPropiedad && <Badge variant="outline" className="text-[10px]">Ingreso</Badge>}
                    {detalle.cliente.entregaDesdeAfuera && <Badge variant="outline" className="text-[10px]">Desde afuera</Badge>}
                    {detalle.cliente.conexionExterna && <Badge variant="outline" className="text-[10px] text-emerald-700">Conexión</Badge>}
                    {detalle.cliente.requiereClientePresente === false && <Badge variant="outline" className="text-[10px] text-amber-700">Sin presencia</Badge>}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetalle(null)}>
              Cerrar
            </Button>
            {canCreate && detalle && detalle.estado !== "entregado" && detalle.estado !== "cancelado" && (() => {
              const clienteDetalle = detalle.clienteId ? clientes.find(c => c.id === detalle.clienteId) : null;
              const choferPrefId = clienteDetalle?.choferPreferidoId;
              const puedeConvertir = !choferPrefId || choferPrefId === currentUserId;
              if (!puedeConvertir) {
                return (
                  <Button variant="outline" disabled className="opacity-50">
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Solo el chofer preferido puede entregar
                  </Button>
                );
              }
              return (
                <Button onClick={() => { abrirConvertir(detalle); setDetalle(null); }}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Convertir en entrega
                </Button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal convertir a entrega */}
      <Dialog open={!!convirtiendo} onOpenChange={(o) => !o && setConvirtiendo(null)}>
        <DialogContent className="max-h-[95vh] w-[95vw] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convertir pedido en entrega</DialogTitle>
            <DialogDescription>
              {convirtiendo && `Pedido de ${convirtiendo.clienteNombre} · ${formatNumber(convirtiendo.litrosSolicitados, 0)} L`}
            </DialogDescription>
          </DialogHeader>
          {convirtiendo && (
            <form onSubmit={handleConvertir} className="space-y-4">
              <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1">
                <p><strong>Cliente:</strong> {convirtiendo.clienteNombre}</p>
                <p><strong>Litros pedidos:</strong> {formatNumber(convirtiendo.litrosSolicitados, 0)} L</p>
                <p><strong>Pago:</strong> {labelMetodoPago(convirtiendo.metodoPagoPreferido)}</p>
              </div>

              {/* Si hay estanques, mostrar opción de entrega por estanque */}
              {estanquesConvertir.length > 0 && (
                <div className="space-y-3">
                  {!modoEstanquesConvertir ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setModoEstanquesConvertir(true)} className="w-full border-amber-400 text-amber-800">
                      <Droplets className="mr-1 h-4 w-4" /> Entregar por estanque ({estanquesConvertir.length} estanque(s))
                    </Button>
                  ) : (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setModoEstanquesConvertir(false)} className="text-xs">
                      ← Volver a entrega simple
                    </Button>
                  )}
                </div>
              )}

              {/* Modo estanques: desglose por estanque */}
              {modoEstanquesConvertir && estanquesConvertir.length > 0 ? (
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-3">
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                    <Droplets className="mr-1 inline h-3.5 w-3.5" /> Entrega por estanque (cobro separado)
                  </p>
                  {estanquesConvertir.map((est, i) => {
                    const litrosEst = Number(est.litros) || 0;
                    const precioEst = Number(est.precio) || 0;
                    const totalEst = litrosEst * precioEst;
                    const recibidoEst = Number(est.montoRecibido) || 0;
                    return (
                      <div key={i} className="rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-background p-2 space-y-2">
                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                          {i + 1}. {est.nombre}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground">Litros</label>
                            <Input type="number" inputMode="decimal" step="any" value={est.litros}
                              onChange={(e) => {
                                const nuevosLitros = e.target.value;
                                const precioCalc = Number(est.precio) || 0;
                                const totalCalc = (Number(nuevosLitros) || 0) * precioCalc;
                                setEstanquesConvertir(estanquesConvertir.map((est2, j) => j === i ? {
                                  ...est2, litros: nuevosLitros,
                                  montoRecibido: est2.metodoPago === "credito" ? "" : (est2.montoRecibido || (totalCalc > 0 ? String(Math.round(totalCalc)) : "")),
                                } : est2));
                              }}
                              placeholder="0" className="h-8 text-xs" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Precio/L</label>
                            <Input type="number" inputMode="decimal" step="any" value={est.precio}
                              onChange={(e) => setEstanquesConvertir(estanquesConvertir.map((est2, j) => j === i ? { ...est2, precio: e.target.value } : est2))}
                              placeholder="0" className="h-8 text-xs" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground">Método de pago</label>
                            <select value={est.metodoPago}
                              onChange={(e) => {
                                const nuevoMetodo = e.target.value;
                                const c = clientes.find(cl => cl.id === convirtiendo?.clienteId);
                                const precioEfectivo = c?.precioEfectivoPorLitro || 0;
                                const precioTransferencia = c?.precioTransferenciaPorLitro || 0;
                                let nuevoPrecio = est.precio;
                                if (nuevoMetodo === "efectivo") {
                                  nuevoPrecio = String(precioEfectivo);
                                } else if (nuevoMetodo === "transferencia") {
                                  nuevoPrecio = String(precioTransferencia);
                                } else {
                                  // Sin pago: precio MÁS ALTO para generar deuda
                                  nuevoPrecio = String(Math.max(precioEfectivo, precioTransferencia));
                                }
                                const totalEstCalc = (Number(est.litros) || 0) * (Number(nuevoPrecio) || 0);
                                setEstanquesConvertir(estanquesConvertir.map((est2, j) => j === i ? {
                                  ...est2, metodoPago: nuevoMetodo, precio: nuevoPrecio,
                                  montoRecibido: nuevoMetodo === "credito" ? "" : (est2.montoRecibido || (totalEstCalc > 0 ? String(Math.round(totalEstCalc)) : "")),
                                } : est2));
                              }}
                              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                              <option value="efectivo">Efectivo</option>
                              <option value="transferencia">Transferencia</option>
                              <option value="credito">Sin pago</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">Monto recibido</label>
                            <Input type="number" inputMode="decimal" step="any" value={est.montoRecibido}
                              onChange={(e) => setEstanquesConvertir(estanquesConvertir.map((est2, j) => j === i ? { ...est2, montoRecibido: e.target.value } : est2))}
                              placeholder={est.metodoPago === "credito" ? "—" : String(Math.round(totalEst))} disabled={est.metodoPago === "credito"} className="h-8 text-xs" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          {est.metodoPago === "credito" ? (
                            <>
                              <span className="text-muted-foreground">Total: <strong className="text-amber-600 dark:text-amber-400">Se definirá al cobrar</strong></span>
                              <span className="text-amber-600 dark:text-amber-400">Pendiente</span>
                            </>
                          ) : (
                            <>
                              <span className="text-muted-foreground">Total: <strong className="text-foreground tabular-nums">{formatCurrency(totalEst)}</strong></span>
                              {recibidoEst >= totalEst && totalEst > 0 && <span className="text-emerald-600">✓ Pagado</span>}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(() => {
                    const totalLitros = estanquesConvertir.reduce((s, e) => s + (Number(e.litros) || 0), 0);
                    const totalVenta = estanquesConvertir.reduce((s, e) => s + (Number(e.litros) || 0) * (Number(e.precio) || 0), 0);
                    const totalRecibido = estanquesConvertir.reduce((s, e) => s + (Number(e.montoRecibido) || 0), 0);
                    return (
                      <div className="rounded-lg bg-amber-100 dark:bg-amber-900/40 p-2 text-center text-sm">
                        <div className="grid grid-cols-3 gap-2">
                          <div><p className="text-[10px] uppercase text-muted-foreground">Total litros</p><p className="font-bold tabular-nums">{formatNumber(totalLitros, 0)} L</p></div>
                          <div><p className="text-[10px] uppercase text-muted-foreground">Total venta</p><p className="font-bold tabular-nums">{formatCurrency(totalVenta)}</p></div>
                          <div><p className="text-[10px] uppercase text-muted-foreground">Total recibido</p><p className="font-bold tabular-nums text-emerald-600">{formatCurrency(totalRecibido)}</p></div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <>
                  {/* Modo simple: campos normales */}
                  <div className="space-y-2">
                    <Label htmlFor="litrosReales">Litros entregados (reales)</Label>
                    <Input id="litrosReales" type="number" inputMode="decimal" step="any" value={litrosReales}
                      onChange={(e) => setLitrosReales(e.target.value)} placeholder={String(convirtiendo.litrosSolicitados)} />
                    <p className="text-xs text-muted-foreground">Ajusta si entregaste una cantidad distinta a la pedida.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="precioPorLitro">Precio por litro (opcional)</Label>
                    <Input id="precioPorLitro" type="number" inputMode="decimal" step="any" value={precioPorLitro}
                      onChange={(e) => setPrecioPorLitro(e.target.value)} placeholder="Auto según método" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="montoEfectivo" className="text-xs">Efectivo recibido</Label>
                      <Input id="montoEfectivo" type="number" inputMode="decimal" step="any" value={montoEfectivo}
                        onChange={(e) => setMontoEfectivo(e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="montoTransferencia" className="text-xs">Transferencia</Label>
                      <Input id="montoTransferencia" type="number" inputMode="decimal" step="any" value={montoTransferencia}
                        onChange={(e) => setMontoTransferencia(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                </>
              )}

              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs">
                <p className="font-medium">Se creará una entrega y se asignará a la vuelta activa (si hay).</p>
                <p className="mt-1 text-muted-foreground">El pedido se marcará como "entregado" automáticamente.</p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConvirtiendo(null)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Convirtiendo…" : "Confirmar entrega"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <Dialog open={!!borrando} onOpenChange={(o) => !o && setBorrando(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar pedido</DialogTitle>
            <DialogDescription>
              ¿Eliminar el pedido de <strong>{borrando?.clienteNombre}</strong>?
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
