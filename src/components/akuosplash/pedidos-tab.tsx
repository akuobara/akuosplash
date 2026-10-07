"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
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
  Hand,
  Banknote,
  Smartphone,
  Loader2,
  GripVertical,
  Camera,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete, uploadFile } from "@/components/akuosplash/akuosplash-api-client";
import {
  formatNumber,
  formatCurrency,
  formatDateTime,
  formatDate,
  formatDateUTC,
  labelEstadoPedido,
  labelMetodoPago,
  labelFranjaHoraria,
  ESTADOS_PEDIDO,
  METODOS_PAGO,
  toDateTimeLocalInput,
} from "@/components/akuosplash/akuosplash-helpers";

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
  franjaHoraria?: string | null;
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
  orden?: number;
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
  camiones?: { id: string; nombre: string; activo: boolean }[];
}

const ESTADO_COLORS: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  programado: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  en_ruta: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  entregado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  cancelado: "bg-muted text-muted-foreground",
};

export function PedidosTab({ refreshKey, onRefresh, canCreate, isDueno, currentUserId, clientes, choferes, clientePreselect, onPreselectConsumed, vueltaActual, camiones }: PedidosTabProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("activos");
  const [vista, setVista] = useState<"lista" | "ruta">("lista");

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Pedido | null>(null);
  const [detalle, setDetalle] = useState<Pedido | null>(null);
  const [borrando, setBorrando] = useState<Pedido | null>(null);
  const [convirtiendo, setConvirtiendo] = useState<Pedido | null>(null);
  const [soltandoPedido, setSoltandoPedido] = useState<Pedido | null>(null);
  const [soltarPedidoReemplazo, setSoltarPedidoReemplazo] = useState("");
  const [cancelandoRecurrente, setCancelandoRecurrente] = useState<Pedido | null>(null);
  const [cancelarModo, setCancelarModo] = useState<"proximo" | "periodo" | "todos">("proximo");
  const [cancelarHastaFecha, setCancelarHastaFecha] = useState("");
  const [cancelarRazon, setCancelarRazon] = useState("");
  const [cancelandoRec, setCancelandoRec] = useState(false);

  // Drag & drop para reordenar pedidos del día
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [guardandoOrden, setGuardandoOrden] = useState(false);
  const [tomandoPedidoId, setTomandoPedidoId] = useState<string | null>(null);
  const [fotoConvertirUrl, setFotoConvertirUrl] = useState<string | null>(null);
  const [subiendoFotoConvertir, setSubiendoFotoConvertir] = useState(false);

  // Campos del formulario
  const [clienteId, setClienteId] = useState<string>("__nuevo");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteZona, setClienteZona] = useState("");
  const [litrosSolicitados, setLitrosSolicitados] = useState("");
  const [fechaSolicitada, setFechaSolicitada] = useState("");
  const [franjaHoraria, setFranjaHoraria] = useState("");
  const [metodoPagoPreferido, setMetodoPagoPreferido] = useState("credito");
  const [indicacionesAcceso, setIndicacionesAcceso] = useState("");
  const [nota, setNota] = useState("");
  const [esCamionCompleto, setEsCamionCompleto] = useState(false);
  const [cantidadCamiones, setCantidadCamiones] = useState<number>(1);
  // Asignación
  const [asignacionTipo, setAsignacionTipo] = useState<string>("manual");
  const [choferAsignadoId, setChoferAsignadoId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Campos para convertir a entrega
  const [litrosReales, setLitrosReales] = useState("");
  const [precioPorLitro, setPrecioPorLitro] = useState("");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoTransferencia, setMontoTransferencia] = useState("");
  const [metodoPagoConvertir, setMetodoPagoConvertir] = useState<string>("credito");
  // Estanques para entrega por separado
  const [estanquesConvertir, setEstanquesConvertir] = useState<{ nombre: string; litros: string; precio: string; metodoPago: string; montoRecibido: string; modoIngreso?: "por_litros" | "por_precio"; precioTotalInput?: string }[]>([]);
  const [modoEstanquesConvertir, setModoEstanquesConvertir] = useState(false);
  const [modoPrecioConvertir, setModoPrecioConvertir] = useState(false);
  const [precioTotalConvertir, setPrecioTotalConvertir] = useState("");
  const [descuentoTipoConvertir, setDescuentoTipoConvertir] = useState("ninguno");
  const [descuentoMontoConvertir, setDescuentoMontoConvertir] = useState("");
  const [descuentoPorLitroConvertir, setDescuentoPorLitroConvertir] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ pedidos: Pedido[] }>("/api/akuosplash/pedidos");
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

  // Cuando llega un cliente preseleccionado desde la ficha de cliente, abrir el formulario.
  // No filtrar por canCreate: si el backend no tiene permiso, devolverá error al guardar,
  // pero el formulario debe abrirse para que el usuario vea qué pasó.
  useEffect(() => {
    if (clientePreselect) {
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
  }, [clientePreselect, clientes]);

  const filtrados = pedidos.filter((p) => {
    if (filtroEstado === "todos") return true;
    if (filtroEstado === "activos") return p.estado === "pendiente" || p.estado === "programado";
    if (p.estado !== filtroEstado) return false;
    return true;
  });

  // Agrupar y ordenar por fecha (Atrasados, Hoy, Mañana, Pasado mañana, Próximos)
  // IMPORTANTE: las fechas de los pedidos se guardan como "YYYY-MM-DDT00:00:00.000Z" (UTC).
  // Cuando el usuario selecciona "4 de septiembre" como fecha del pedido, se guarda como
  // 2026-09-04T00:00:00Z que en Chile (UTC-4) es 2026-09-03 20:00.
  // Para que el pedido se muestre en el día correcto ("Mañana" = 4 de sep), interpretamos
  // la fecha del pedido como la parte YYYY-MM-DD del ISO string (ignorando la zona horaria).
  function fechaLocal(d: Date): string {
    return d.toLocaleDateString("en-CA"); // formato YYYY-MM-DD en zona horaria local
  }
  const hoyStr = fechaLocal(new Date());
  const mananaStr = fechaLocal(new Date(Date.now() + 86400000));
  const pasadoMananaStr = fechaLocal(new Date(Date.now() + 2 * 86400000));
  const en7diasStr = fechaLocal(new Date(Date.now() + 7 * 86400000));

  function fechaGrupo(p: Pedido): { key: string; order: number } {
    if (!p.fechaSolicitada) return { key: "hoy", order: 1 };  // Sin fecha → asumir hoy
    // Extraer YYYY-MM-DD del ISO string (parte antes de la 'T')
    // Esto interpreta la fecha como "el día que el usuario quería", sin conversión de zona horaria.
    const fStr = p.fechaSolicitada.split("T")[0];
    if (fStr < hoyStr) return { key: "atrasados", order: 0 };
    if (fStr === hoyStr) return { key: "hoy", order: 1 };
    if (fStr === mananaStr) return { key: "manana", order: 2 };
    if (fStr === pasadoMananaStr) return { key: "pasado_manana", order: 3 };
    if (fStr <= en7diasStr) return { key: "esta_semana", order: 4 };
    return { key: "proximos", order: 5 };
  }

  const GRUPO_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
    atrasados: { label: "Atrasados", emoji: "⏰", color: "text-amber-600 dark:text-amber-400" },
    hoy: { label: "Hoy", emoji: "📌", color: "text-emerald-600 dark:text-emerald-400" },
    manana: { label: "Mañana", emoji: "➡️", color: "text-blue-600 dark:text-blue-400" },
    pasado_manana: { label: "Pasado mañana", emoji: "📅", color: "text-blue-600 dark:text-blue-400" },
    esta_semana: { label: "Esta semana", emoji: "🗓️", color: "text-purple-600 dark:text-purple-400" },
    proximos: { label: "Próximos", emoji: "📆", color: "text-muted-foreground" },
  };

  // Agrupar pedidos por fecha
  const grupos: { key: string; label: string; emoji: string; color: string; pedidos: Pedido[] }[] = [];
  const porGrupo: Record<string, Pedido[]> = {};
  for (const p of filtrados) {
    const { key } = fechaGrupo(p);
    if (!porGrupo[key]) porGrupo[key] = [];
    porGrupo[key].push(p);
  }
  for (const key of Object.keys(porGrupo)) {
    // Ordenar dentro del grupo:
    //   - Si el grupo es "hoy" y los pedidos tienen orden > 0, ordenar por orden
    //   - Sino, ordenar por fecha (asc) y luego por nombre
    if (key === "hoy" && porGrupo[key].some((p) => (p.orden ?? 0) > 0)) {
      porGrupo[key].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    } else {
      porGrupo[key].sort((a, b) => {
        const fa = a.fechaSolicitada ? new Date(a.fechaSolicitada).getTime() : 0;
        const fb = b.fechaSolicitada ? new Date(b.fechaSolicitada).getTime() : 0;
        if (fa !== fb) return fa - fb;
        return a.clienteNombre.localeCompare(b.clienteNombre);
      });
    }
    const meta = GRUPO_LABELS[key];
    grupos.push({ key, ...meta, pedidos: porGrupo[key] });
  }
  // Ordenar grupos por su orden lógico (vencidos, hoy, mañana, ...)
  grupos.sort((a, b) => {
    const oa = GRUPO_LABELS[a.key] ? Object.keys(GRUPO_LABELS).indexOf(a.key) : 99;
    const ob = GRUPO_LABELS[b.key] ? Object.keys(GRUPO_LABELS).indexOf(b.key) : 99;
    return oa - ob;
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
    setFranjaHoraria("");
    setMetodoPagoPreferido("credito");
    setIndicacionesAcceso("");
    setNota("");
    setAsignacionTipo("manual");
    setChoferAsignadoId("");
    setEsCamionCompleto(false);
    setCantidadCamiones(1);
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
    setMetodoPagoConvertir("credito");
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
              precio: String(Math.max(c.precioEfectivoPorLitro || 0, c.precioTransferenciaPorLitro || 0)),
              metodoPago: "credito",
              montoRecibido: "",
              modoIngreso: "por_litros" as const,
              precioTotalInput: "",
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
    let litros = Number(litrosSolicitados) || 0;
    // Si es camión completo, calcular litros = cantidad × capacidad
    if (esCamionCompleto) {
      litros = cantidadCamiones * (vueltaActual?.capacidadCamion || 17000);
    }
    // Litros NO es obligatorio — el cliente puede pedir agua sin saber la cantidad
    // Si es 0, se estimará con el promedio de entregas anteriores al convertir

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
        franjaHoraria: franjaHoraria || null,
        metodoPagoPreferido,
        indicacionesAcceso: indicacionesAcceso.trim() || null,
        nota: nota.trim() || null,
        asignacionTipo,
        choferAsignadoId: isDueno && asignacionTipo === "manual" ? (choferAsignadoId || null) : null,
      };

      if (editando) {
        await apiPatch(`/api/akuosplash/pedidos/${editando.id}`, payload);
        toast.success("Pedido actualizado");
      } else {
        await apiPost("/api/akuosplash/pedidos", payload);
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
      await apiDelete(`/api/akuosplash/pedidos/${p.id}`);
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
        await apiPost(`/api/akuosplash/pedidos/${convirtiendo.id}/convertir`, {
          litrosReales: totalLitrosEst,
          precioPorLitro: 0,
          montoEfectivo: totalEfectivoEst,
          montoTransferencia: totalTransferenciaEst,
          fotoMedidorUrl: fotoConvertirUrl,
          detalleEstanquesJson: JSON.stringify(estanquesNormalizados.map((e) => ({
            nombre: e.nombre,
            litros: e.litros,
            precioPorLitro: e.precio,
            total: e.total,
            metodoPago: e.metodoPago,
            montoRecibido: e.montoRecibido,
          }))),
        });
        toast.success(`✓ Entrega registrada: ${formatNumber(totalLitrosEst, 0)} L · ${formatCurrency(totalVentaEst)}`, {
          duration: 8000,
          description: "El pedido se convirtió en entrega correctamente. No necesitás registrar otra vez.",
        });
        setConvirtiendo(null);
        onRefresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo convertir");
      } finally {
        setSaving(false);
      }
      return;
    }

    // PRE-VERIFICACIÓN: si no hay vuelta activa en el estado del frontend,
    // verificar con el backend antes de mostrar error (el estado puede estar desactualizado)
    if (!vueltaActual) {
      // Intentar obtener la vuelta activa del backend
      try {
        const res = await apiGet<{ vuelta: any }>("/api/akuosplash/vueltas/activa");
        if (res.vuelta) {
          // Hay vuelta activa en el backend — proceder con la conversión
          // (el backend va a asignar la vuelta automáticamente)
          setSaving(true);
          try {
            await apiPost(`/api/akuosplash/pedidos/${convirtiendo.id}/convertir`, {
              litrosReales: Number(litrosReales) || convirtiendo.litrosSolicitados,
              precioPorLitro: Number(precioPorLitro) || undefined,
              montoEfectivo: Number(montoEfectivo) || 0,
              montoTransferencia: Number(montoTransferencia) || 0,
              metodoPago: metodoPagoConvertir,
              fotoMedidorUrl: fotoConvertirUrl,
              descuentoTipo: descuentoTipoConvertir,
              descuento: descuentoTipoConvertir === "total" ? (Number(descuentoMontoConvertir) || 0) : 0,
              descuentoPorLitro: descuentoTipoConvertir === "por_litro" ? (Number(descuentoPorLitroConvertir) || 0) : 0,
            });
            const litrosNum = Number(litrosReales) || convirtiendo?.litrosSolicitados || 0;
            const precioNum = Number(precioPorLitro) || 0;
            const totalEstimado = litrosNum * precioNum;
            toast.success(`✓ Entrega registrada: ${formatNumber(litrosNum, 0)} L · ${formatCurrency(totalEstimado)}`, {
              duration: 8000,
              description: "El pedido se convirtió en entrega correctamente.",
            });
            setConvirtiendo(null);
            setFotoConvertirUrl(null);
            onRefresh();
          } catch (e) {
            const msg = e instanceof Error ? e.message : "No se pudo convertir";
            if (msg.includes("PEDIDO_YA_ENTREGADO") || msg.includes("ya fue entregado") || msg.includes("ya entregado")) {
              toast.error("⚠ Este pedido ya fue entregado antes.", { duration: 10000 });
            } else {
              toast.error(`No se pudo guardar: ${msg}`, { duration: 10000 });
            }
          } finally {
            setSaving(false);
          }
          return;
        }
      } catch {
        // Si falla la verificación, continuar con el flujo anterior
      }

      // Si no hay vuelta, mostrar error pero NO bloquear con overlay
      toast.error("No hay vuelta activa. Iniciá una vuelta desde el panel principal y volvé a intentar.", { duration: 8000 });
      setSaving(false);
      return;
    }

    setSaving(true);
    try {
      await apiPost(`/api/akuosplash/pedidos/${convirtiendo.id}/convertir`, {
        litrosReales: Number(litrosReales) || convirtiendo.litrosSolicitados,
        precioPorLitro: Number(precioPorLitro) || undefined,
        montoEfectivo: Number(montoEfectivo) || 0,
        montoTransferencia: Number(montoTransferencia) || 0,
        metodoPago: metodoPagoConvertir,
        fotoMedidorUrl: fotoConvertirUrl,
        descuentoTipo: descuentoTipoConvertir,
        descuento: descuentoTipoConvertir === "total" ? (Number(descuentoMontoConvertir) || 0) : 0,
        descuentoPorLitro: descuentoTipoConvertir === "por_litro" ? (Number(descuentoPorLitroConvertir) || 0) : 0,
      });
      const litrosNum = Number(litrosReales) || convirtiendo?.litrosSolicitados || 0;
      const precioNum = Number(precioPorLitro) || 0;
      const totalEstimado = litrosNum * precioNum;
      toast.success(`✓ Entrega registrada: ${formatNumber(litrosNum, 0)} L · ${formatCurrency(totalEstimado)}`, {
        duration: 8000,
        description: "El pedido se convirtió en entrega correctamente. No necesitás registrar otra vez.",
      });
      setConvirtiendo(null);
      onRefresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo convertir";
      if (msg.includes("No hay vuelta activa") || msg.includes("vuelta")) {
        toast.error("No hay vuelta activa. Iniciá una vuelta desde el panel principal.", { duration: 8000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  // Estado para el diálogo de "falta vuelta activa" al convertir
  const [vueltaFaltante, setVueltaFaltante] = useState<Pedido | null>(null);
  const [iniciandoVueltaConvertir, setIniciandoVueltaConvertir] = useState(false);

  async function iniciarVueltaYConvertir(camionId?: string) {
    if (!vueltaFaltante) return;
    const camionesActivos = (camiones ?? []).filter(c => c.activo);
    // Si no hay camionId explícito y la lista está vacía, dejar que el backend
    // resuelva (POST /api/vueltas busca la asignación del chofer automáticamente).
    const camionIdFinal = camionId || camionesActivos[0]?.id || undefined;
    setIniciandoVueltaConvertir(true);
    try {
      // 1. Iniciar vuelta (sin camionId si la lista estaba vacía — backend resuelve)
      await apiPost("/api/akuosplash/vueltas", camionIdFinal ? { camionId: camionIdFinal } : {});
      toast.success("Vuelta iniciada");
      onRefresh();

      // 2. Reintentar la conversión automáticamente con los datos del pedido
      await apiPost(`/api/akuosplash/pedidos/${vueltaFaltante.id}/convertir`, {
        litrosReales: vueltaFaltante.litrosSolicitados,
        precioPorLitro: Number(precioPorLitro) || undefined,
        montoEfectivo: Number(montoEfectivo) || 0,
        montoTransferencia: Number(montoTransferencia) || 0,
        metodoPago: metodoPagoConvertir,
        descuentoTipo: descuentoTipoConvertir,
        descuento: descuentoTipoConvertir === "total" ? (Number(descuentoMontoConvertir) || 0) : 0,
        descuentoPorLitro: descuentoTipoConvertir === "por_litro" ? (Number(descuentoPorLitroConvertir) || 0) : 0,
      });
      const litrosNum = vueltaFaltante?.litrosSolicitados || 0;
      const precioNum = Number(precioPorLitro) || 0;
      const totalEstimado = litrosNum * precioNum;
      toast.success(`✓ Entrega registrada: ${formatNumber(litrosNum, 0)} L · ${formatCurrency(totalEstimado)}`, {
        duration: 8000,
        description: "El pedido se convirtió en entrega correctamente. No necesitás registrar otra vez.",
      });
      setVueltaFaltante(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setIniciandoVueltaConvertir(false);
    }
  }

  async function cambiarEstado(p: Pedido, nuevoEstado: string) {
    try {
      await apiPatch(`/api/akuosplash/pedidos/${p.id}`, { estado: nuevoEstado });
      toast.success(`Pedido marcado como ${labelEstadoPedido(nuevoEstado)}`);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    }
  }

  async function publicarPedido(p: Pedido) {
    try {
      await apiPost(`/api/akuosplash/pedidos/${p.id}/publicar`, {});
      toast.success("Pedido publicado para choferes");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo publicar");
    }
  }

  async function tomarPedido(p: Pedido) {
    setTomandoPedidoId(p.id);
    try {
      await apiPost(`/api/akuosplash/pedidos/${p.id}/tomar`, {});
      toast.success("Pedido tomado");
      onRefresh();
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo tomar el pedido");
    } finally {
      setTomandoPedidoId(null);
    }
  }

  async function cederPrioridad(p: Pedido, permanente: boolean = false) {
    try {
      await apiPost(`/api/akuosplash/pedidos/${p.id}/ceder`, { permanente });
      toast.success(permanente ? "Prioridad cedida permanentemente" : "Prioridad cedida para este pedido");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo ceder la prioridad");
    }
  }

  async function soltarPedido(p: Pedido, reemplazoChoferId?: string) {
    try {
      const res = await apiPost<{ ok: boolean; reemplazo: boolean; publicado: boolean }>(`/api/akuosplash/pedidos/${p.id}/soltar`, {
        reemplazoChoferId: reemplazoChoferId || null,
      });
      if (res.reemplazo) {
        toast.success("Pedido reasignado al chofer de reemplazo");
      } else {
        toast.success("Pedido soltado — publicado al pool para que cualquier chofer lo tome");
      }
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo soltar el pedido");
    }
  }

  // Verificar si el chofer actual es el preferido del cliente del pedido
  function esChoferPreferidoDelPedido(p: Pedido): boolean {
    if (!p.clienteId) return false;
    const cliente = clientes.find(c => c.id === p.clienteId);
    return cliente?.choferPreferidoId === currentUserId;
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
              variant={filtroEstado === "activos" ? "default" : "outline"}
              onClick={() => setFiltroEstado("activos")}
            >
              Activos ({pedidos.filter(p => p.estado === "pendiente" || p.estado === "programado").length})
            </Button>
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
            <div className="space-y-4">
              {grupos.map((grupo) => (
                <div key={grupo.key}>
                  {/* Header del grupo */}
                  <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 backdrop-blur px-1 py-1.5 border-b">
                    <span className="text-base">{grupo.emoji}</span>
                    <h3 className={`text-sm font-semibold ${grupo.color}`}>{grupo.label}</h3>
                    <Badge variant="secondary" className="text-[10px]">{grupo.pedidos.length}</Badge>
                  </div>
                  {/* Lista de pedidos del grupo */}
                  <Card>
                    <CardContent className="p-0">
                      <ul className="divide-y divide-border">
                        {grupo.pedidos.map((p) => (
                          <li
                            key={p.id}
                            draggable={grupo.key === "hoy"}
                            onDragStart={(e) => {
                              if (grupo.key !== "hoy") return;
                              setDraggedId(p.id);
                              e.dataTransfer.effectAllowed = "move";
                              try {
                                e.dataTransfer.setData("text/plain", p.id);
                              } catch {}
                            }}
                            onDragEnd={() => {
                              setDraggedId(null);
                              setDragOverId(null);
                            }}
                            onDragOver={(e) => {
                              if (grupo.key !== "hoy" || !draggedId || draggedId === p.id) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                              setDragOverId(p.id);
                            }}
                            onDrop={async (e) => {
                              if (grupo.key !== "hoy" || !draggedId || draggedId === p.id) return;
                              e.preventDefault();
                              // Reordenar: mover draggedId a la posición de p.id
                              const nuevosOrdenes = (() => {
                                const lista = [...grupo.pedidos];
                                const fromIdx = lista.findIndex((x) => x.id === draggedId);
                                const toIdx = lista.findIndex((x) => x.id === p.id);
                                if (fromIdx === -1 || toIdx === -1) return null;
                                const [movido] = lista.splice(fromIdx, 1);
                                lista.splice(toIdx, 0, movido);
                                return lista.map((ped, i) => ({ id: ped.id, orden: i + 1 }));
                              })();
                              setDragOverId(null);
                              setDraggedId(null);
                              if (!nuevosOrdenes) return;
                              // Optimistic: actualizar el estado local de pedidos
                              setPedidos((prev) => prev.map((ped) => {
                                const nuevo = nuevosOrdenes.find((n) => n.id === ped.id);
                                return nuevo ? { ...ped, orden: nuevo.orden } : ped;
                              }));
                              // Persistir en backend
                              setGuardandoOrden(true);
                              try {
                                await apiPost("/api/akuosplash/pedidos/reordenar", { pedidos: nuevosOrdenes });
                              } catch (err) {
                                toast.error("No se pudo guardar el orden");
                                cargar(); // revertir
                              } finally {
                                setGuardandoOrden(false);
                              }
                            }}
                            className={`flex flex-col p-3 sm:p-4 transition-colors border-l-4 ${
                              // Borde lateral de color según asignación
                              p.tomadoPorChofer
                                ? "border-l-blue-500"
                                : p.choferAsignado
                                  ? "border-l-emerald-500"
                                  : p.asignacionTipo === "publicado"
                                    ? "border-l-purple-500"
                                    : "border-l-amber-500"
                            } ${
                              grupo.key === "hoy" ? "cursor-grab active:cursor-grabbing" : ""
                            } ${
                              draggedId === p.id ? "opacity-40" : ""
                            } ${
                              dragOverId === p.id && draggedId && draggedId !== p.id
                                ? "border-t-2 border-t-primary"
                                : ""
                            }`}
                          >
                            <div className="flex items-start gap-2 w-full">
                            {grupo.key === "hoy" && (
                              <div className="shrink-0 self-start cursor-grab text-muted-foreground/30 active:cursor-grabbing mt-1" title="Arrastrá para reordenar">
                                <GripVertical className="h-4 w-4" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => setDetalle(p)}
                              className="flex min-w-0 flex-1 items-start gap-3 text-left"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
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
                                  {p.pedidoRecurrenteId && (
                                    <Badge variant="outline" className="text-[10px] gap-0.5 bg-primary/10 text-primary border-primary/30" title="Pedido generado desde una regla recurrente">
                                      <Repeat className="h-2.5 w-2.5" /> Recurrente
                                    </Badge>
                                  )}
                                </div>
                                {/* Segunda fila de badges: asignación de chofer */}
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  {p.asignacionTipo === "publicado" && !p.tomadoPorChofer && (
                                    <Badge variant="outline" className="text-[10px] gap-0.5 bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700" title="Este pedido está disponible para cualquier chofer de la flota">
                                      <Package className="h-2.5 w-2.5" /> Disponible
                                    </Badge>
                                  )}
                                  {p.tomadoPorChofer && (
                                    <Badge variant="outline" className="text-[10px] gap-0.5 bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700" title={`En ruta con ${p.tomadoPorChofer.nombre}`}>
                                      <Truck className="h-2.5 w-2.5" /> {p.tomadoPorChofer.nombre}
                                    </Badge>
                                  )}
                                  {p.choferAsignado && !p.tomadoPorChofer && (
                                    <Badge variant="outline" className="text-[10px] gap-0.5 bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700" title={`Solo ${p.choferAsignado.nombre} puede entregar este pedido`}>
                                      <UserCheck className="h-2.5 w-2.5" /> {p.choferAsignado.nombre}
                                    </Badge>
                                  )}
                                  {isDueno && p.asignacionTipo !== "publicado" && !p.choferAsignado && !p.tomadoPorChofer && (
                                    <Badge variant="outline" className="text-[10px] gap-0.5 bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700" title="Sin chofer asignado. Solo el admin ve este pedido. Publicalo para que los choferes lo puedan tomar.">
                                      <Users className="h-2.5 w-2.5" /> Sin asignar
                                    </Badge>
                                  )}
                                  {p.franjaHoraria && (
                                    <Badge variant="outline" className="text-[10px] gap-0.5 text-blue-700 dark:text-blue-300" title={`Horario: ${labelFranjaHoraria(p.franjaHoraria)}`}>
                                      <Clock className="h-2.5 w-2.5" /> {labelFranjaHoraria(p.franjaHoraria)}
                                    </Badge>
                                  )}
                                  {p.fechaSolicitada && (() => {
                                    const fecha = new Date(p.fechaSolicitada);
                                    const fHoy = new Date();
                                    fHoy.setHours(0, 0, 0, 0);
                                    if (fecha > fHoy) {
                                      return (
                                        <Badge variant="outline" className="text-[10px] gap-0.5 text-blue-700 dark:text-blue-300" title={`Programado para ${formatDateUTC(p.fechaSolicitada!)}`}>
                                          <Clock className="h-2.5 w-2.5" /> {formatDateUTC(p.fechaSolicitada!)}
                                        </Badge>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                                <p className="truncate text-xs text-muted-foreground mt-1">
                                  <Droplets className="mr-1 inline h-3 w-3" />
                                  {p.litrosSolicitados > 0 ? `${formatNumber(p.litrosSolicitados, 0)} L` : "Sin cantidad"} · {labelMetodoPago(p.metodoPagoPreferido)}
                                  {p.clienteTelefono && (
                                    <>
                                      <Phone className="ml-2 inline h-3 w-3" />
                                      {p.clienteTelefono}
                                    </>
                                  )}
                                </p>
                              </div>
                            </button>
                            </div>
                            {/* Acciones rápidas visibles — fila separada abajo para evitar overlap */}
                            <div className="flex shrink-0 items-center justify-end gap-1 mt-2 pt-2 border-t border-dashed w-full">
                              {p.clienteLat != null && p.clienteLng != null && (
                                <a
                                  href={`https://www.google.com/maps?q=${p.clienteLat},${p.clienteLng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="rounded-md p-1.5 text-primary hover:bg-primary/10"
                                  title="Ver ubicación en Google Maps"
                                >
                                  <Navigation className="h-4 w-4" />
                                </a>
                              )}
                              {!isDueno && p.asignacionTipo === "publicado" && !p.tomadoPorChofer && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-purple-600 hover:bg-purple-700 text-[11px] h-7 px-2"
                                  disabled={tomandoPedidoId === p.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    tomarPedido(p);
                                  }}
                                  title="Tomar este pedido para tu ruta"
                                >
                                  {tomandoPedidoId === p.id ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <Truck className="mr-1 h-3 w-3" />
                                  )}
                                  Tomar
                                </Button>
                              )}
                              {canCreate && !isDueno && p.estado !== "entregado" && p.estado !== "cancelado" && (
                                p.choferAsignado?.id === currentUserId ||
                                p.tomadoPorChofer?.id === currentUserId ||
                                p.chofer?.id === currentUserId
                              ) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-[11px] h-7 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    abrirConvertir(p);
                                  }}
                                  title="Registrar entrega para este pedido"
                                >
                                  <Plus className="mr-1 h-3 w-3" /> Entregar
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setDetalle(p)}>
                                    <Eye className="mr-2 h-4 w-4" /> Ver detalle
                                  </DropdownMenuItem>
                                  {canCreate && !isDueno && p.estado !== "entregado" && p.estado !== "cancelado" && (
                                    (() => {
                                      const clientePedido = p.clienteId ? clientes.find(c => c.id === p.clienteId) : null;
                                      const choferPrefId = clientePedido?.choferPreferidoId;
                                      const puedeConvertir = !choferPrefId || choferPrefId === currentUserId;
                                      if (!puedeConvertir) return null;
                                      return (
                                        <DropdownMenuItem onClick={() => abrirConvertir(p)}>
                                          <CheckCircle2 className="mr-2 h-4 w-4" /> Convertir en entrega
                                        </DropdownMenuItem>
                                      );
                                    })()
                                  )}
                                  <DropdownMenuItem onClick={() => abrirEditar(p)}>
                                    <Pencil className="mr-2 h-4 w-4" /> Editar
                                  </DropdownMenuItem>

                                  {/* Acciones de asignación */}
                                  {isDueno && p.asignacionTipo === "manual" && !p.tomadoPorChofer && (
                                    <DropdownMenuItem onClick={() => publicarPedido(p)}>
                                      <Package className="mr-2 h-4 w-4" /> Publicar para choferes
                                    </DropdownMenuItem>
                                  )}
                                  {/* "Tomar pedido" está como botón visible arriba, no en el menú */}
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
                                  {!isDueno && (
                                    p.tomadoPorChofer?.id === currentUserId ||
                                    p.choferAsignado?.id === currentUserId ||
                                    (p.prioridadChofer?.id === currentUserId)
                                  ) && (
                                    <DropdownMenuItem onClick={() => setSoltandoPedido(p)} className="text-amber-600 focus:text-amber-600">
                                      <Hand className="mr-2 h-4 w-4" /> Soltar pedido
                                    </DropdownMenuItem>
                                  )}

                                  {p.estado === "pendiente" && (
                                    <DropdownMenuItem onClick={() => cambiarEstado(p, "programado")}>
                                      <Clock className="mr-2 h-4 w-4" /> Marcar programado
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => {
                                    if (p.pedidoRecurrenteId) {
                                      setCancelandoRecurrente(p);
                                      setCancelarModo("proximo");
                                      setCancelarHastaFecha("");
                                      setCancelarRazon("");
                                    } else {
                                      cambiarEstado(p, "cancelado");
                                    }
                                  }}>
                                    <XCircle className="mr-2 h-4 w-4" /> Cancelar pedido
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setBorrando(p)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
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
                                  {p.fechaSolicitada && ` · ${formatDateUTC(p.fechaSolicitada)}`}
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
                <Label htmlFor="litrosSolicitados">Litros solicitados</Label>
                <div className="flex gap-2">
                  <Input
                    id="litrosSolicitados"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={litrosSolicitados}
                    onChange={(e) => setLitrosSolicitados(e.target.value)}
                    placeholder="Ej. 4000"
                    disabled={esCamionCompleto}
                  />
                  <Button
                    type="button"
                    variant={esCamionCompleto ? "default" : "outline"}
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      setEsCamionCompleto(!esCamionCompleto);
                      if (!esCamionCompleto) setLitrosSolicitados("");
                    }}
                    title="Camión completo"
                  >
                    <Truck className="h-4 w-4" />
                  </Button>
                </div>
                {esCamionCompleto && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Camiones:</Label>
                    <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCantidadCamiones(Math.max(0.1, Math.round((cantidadCamiones - 0.1) * 10) / 10))}>−</Button>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={cantidadCamiones}
                      onChange={(e) => setCantidadCamiones(Math.max(0.1, Number(e.target.value) || 1))}
                      className="h-7 w-16 text-center font-bold"
                    />
                    <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCantidadCamiones(Math.round((cantidadCamiones + 0.1) * 10) / 10)}>+</Button>
                    <span className="text-xs text-muted-foreground">
                      = {formatNumber(cantidadCamiones * (vueltaActual?.capacidadCamion || 17000), 0)} L
                    </span>
                  </div>
                )}
                {esCamionCompleto && (
                  <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-2 text-xs text-blue-700 dark:text-blue-300">
                    Pedido por camión completo: {cantidadCamiones} camión(es) = {formatNumber(cantidadCamiones * (vueltaActual?.capacidadCamion || 17000), 0)} L
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {esCamionCompleto ? "Camión completo. Toca 🚛 para litros específicos." : "Toca 🚛 para camión completo."}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaSolicitada">Fecha de entrega (opcional)</Label>
                <Input
                  id="fechaSolicitada"
                  type="date"
                  value={fechaSolicitada ? fechaSolicitada.split("T")[0] : ""}
                  onChange={(e) => setFechaSolicitada(e.target.value ? e.target.value + "T00:00:00.000Z" : "")}
                />
                <div className="space-y-1">
                  <Label className="text-xs">Hora aproximada (opcional)</Label>
                  <select
                    value={franjaHoraria.split(":")[0] || ""}
                    onChange={(e) => {
                      const tipo = e.target.value;
                      if (!tipo) { setFranjaHoraria(""); return; }
                      // Si es antes/después, necesita hora; usar la que ya tenía o default
                      if (tipo === "antes" || tipo === "despues") {
                        const horaActual = franjaHoraria.includes(":") ? franjaHoraria.split(":")[1] : "12";
                        setFranjaHoraria(`${tipo}:${horaActual}`);
                      } else {
                        setFranjaHoraria(tipo);
                      }
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="">Sin hora específica</option>
                    <option value="manana">Mañana (08:00 - 12:00)</option>
                    <option value="mediodia">Mediodía (11:00 - 13:00)</option>
                    <option value="tarde">Tarde (14:00 - 18:00)</option>
                    <option value="antes">Antes de cierta hora...</option>
                    <option value="despues">Después de cierta hora...</option>
                  </select>
                  {(franjaHoraria.startsWith("antes:") || franjaHoraria.startsWith("despues:")) && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {franjaHoraria.startsWith("antes:") ? "Antes de las" : "Después de las"}
                      </span>
                      <Input
                        type="time"
                        value={franjaHoraria.split(":")[1] ? `${franjaHoraria.split(":")[1].padStart(2, "0")}:00` : "12:00"}
                        onChange={(e) => {
                          const hora = e.target.value.split(":")[0];
                          const tipo = franjaHoraria.split(":")[0];
                          setFranjaHoraria(`${tipo}:${hora}`);
                        }}
                        className="h-8 w-24"
                      />
                      <span className="text-xs text-muted-foreground">hrs</span>
                    </div>
                  )}
                </div>
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
                <Field label="Litros solicitados" value={detalle.litrosSolicitados > 0 ? `${formatNumber(detalle.litrosSolicitados, 0)} L` : "Sin cantidad (se estimará al convertir)"} />
                <Field label="Método de pago" value={labelMetodoPago(detalle.metodoPagoPreferido)} />
                {detalle.fechaSolicitada && (
                  <Field label="Fecha de entrega" value={`${formatDateUTC(detalle.fechaSolicitada)}${detalle.franjaHoraria ? ` · ${labelFranjaHoraria(detalle.franjaHoraria)}` : ""}`} />
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
            {canCreate && !isDueno && detalle && detalle.estado !== "entregado" && detalle.estado !== "cancelado" && (() => {
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

      {/* Overlay de vuelta faltante eliminado — ya no bloquea al usuario */}

      {/* Modal soltar pedido */}
      <Dialog open={!!soltandoPedido} onOpenChange={(o) => {
        if (!o) {
          setSoltandoPedido(null);
          setSoltarPedidoReemplazo("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Soltar pedido de {soltandoPedido?.clienteNombre}</DialogTitle>
            <DialogDescription>
              {soltandoPedido && esChoferPreferidoDelPedido(soltandoPedido)
                ? "Eres el chofer preferido de este cliente. Puedes elegir un reemplazo o soltar el pedido al pool."
                : "No eres el chofer preferido de este cliente. Al soltar, el pedido irá al pool para que el administrador lo reasigne."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {soltandoPedido && esChoferPreferidoDelPedido(soltandoPedido) && (
              <div className="space-y-2">
                <Label className="text-xs">Chofer de reemplazo (opcional)</Label>
                <select
                  value={soltarPedidoReemplazo || "__ninguno"}
                  onChange={(e) => setSoltarPedidoReemplazo(e.target.value === "__ninguno" ? "" : e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="__ninguno">— Sin reemplazo (al pool) —</option>
                  {choferes.filter(c => c.id !== currentUserId).map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Con reemplazo: el pedido se asigna al nuevo chofer. Sin reemplazo: va al pool visible para todos.
                </p>
              </div>
            )}
            {soltandoPedido && !esChoferPreferidoDelPedido(soltandoPedido) && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/20">
                <p className="text-amber-900 dark:text-amber-200">
                  El pedido se publicará al pool. El administrador podrá reasignarlo a otro chofer o cualquier chofer de la flota podrá tomarlo.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSoltandoPedido(null); setSoltarPedidoReemplazo(""); }}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                if (soltandoPedido) {
                  soltarPedido(soltandoPedido, soltarPedidoReemplazo || undefined);
                  setSoltandoPedido(null);
                  setSoltarPedidoReemplazo("");
                }
              }}
            >
              <Hand className="mr-1 h-4 w-4" /> Soltar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal convertir a entrega */}
      <Dialog open={!!convirtiendo} onOpenChange={(o) => { if (!o) { setConvirtiendo(null); setFotoConvertirUrl(null); } }}>
        <DialogContent className="max-h-[95vh] w-[95vw] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convertir pedido en entrega</DialogTitle>
            <DialogDescription>
              {convirtiendo && `Pedido de ${convirtiendo.clienteNombre}${convirtiendo.litrosSolicitados > 0 ? ` · ${formatNumber(convirtiendo.litrosSolicitados, 0)} L` : " · Sin cantidad"}`}
            </DialogDescription>
          </DialogHeader>
          {convirtiendo && (
            <form onSubmit={handleConvertir} className="space-y-4">
              <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1">
                <p><strong>Cliente:</strong> {convirtiendo.clienteNombre}</p>
                <p><strong>Litros pedidos:</strong> {convirtiendo.litrosSolicitados > 0 ? `${formatNumber(convirtiendo.litrosSolicitados, 0)} L` : "Sin cantidad (se estimará con el promedio)"}</p>
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
                    const totalEstRaw = litrosEst * precioEst;
                    const totalEst = totalEstRaw > 0 ? Math.ceil(totalEstRaw / 100) * 100 : 0;
                    const recibidoEst = Number(est.montoRecibido) || 0;
                    return (
                      <div key={i} className="rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-background p-2 space-y-2">
                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                          {i + 1}. {est.nombre}
                        </p>
                        {/* Toggle por litros / por precio */}
                        <div className="flex gap-1 rounded bg-amber-100/50 p-0.5 dark:bg-amber-900/30">
                          <button type="button"
                            onClick={() => setEstanquesConvertir(estanquesConvertir.map((est2, j) => j === i ? { ...est2, litros: "", montoRecibido: "" } : est2))}
                            className={`flex-1 rounded px-2 py-1 text-[10px] font-medium transition ${!est.modoIngreso || est.modoIngreso === "por_litros" ? "bg-white text-amber-900 dark:bg-background dark:text-amber-200 shadow-sm" : "text-amber-700 dark:text-amber-300"}`}>
                            Por litros
                          </button>
                          <button type="button"
                            onClick={() => setEstanquesConvertir(estanquesConvertir.map((est2, j) => j === i ? { ...est2, modoIngreso: "por_precio" as const, litros: "", montoRecibido: "" } : est2))}
                            className={`flex-1 rounded px-2 py-1 text-[10px] font-medium transition ${est.modoIngreso === "por_precio" ? "bg-white text-amber-900 dark:bg-background dark:text-amber-200 shadow-sm" : "text-amber-700 dark:text-amber-300"}`}>
                            Por precio ($)
                          </button>
                        </div>
                        {/* Campos según modo */}
                        {est.modoIngreso !== "por_precio" ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground">Litros</label>
                              <Input type="number" inputMode="decimal" step="any" value={est.litros}
                                onChange={(e) => {
                                  const nuevosLitros = e.target.value;
                                  const precioCalc = Number(est.precio) || 0;
                                  const totalCalc = (Number(nuevosLitros) || 0) * precioCalc;
                                  const totalRedondeado = totalCalc > 0 ? Math.ceil(totalCalc / 100) * 100 : 0;
                                  setEstanquesConvertir(estanquesConvertir.map((est2, j) => j === i ? {
                                    ...est2, litros: nuevosLitros,
                                    montoRecibido: est2.metodoPago === "credito" ? "" : (est2.montoRecibido || (totalRedondeado > 0 ? String(totalRedondeado) : "")),
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
                        ) : (
                          <div className="space-y-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground">¿Cuántos pesos de agua?</label>
                              <Input type="number" inputMode="decimal" step="any" value={est.precioTotalInput ?? ""}
                                onChange={(e) => {
                                  const precioTotalStr = e.target.value;
                                  const precioCalc = Number(est.precio) || 0;
                                  const litrosCalc = precioCalc > 0 ? Math.round((Number(precioTotalStr) || 0) / precioCalc) : 0;
                                  const totalRedondeado = Number(precioTotalStr) > 0 ? Math.ceil(Number(precioTotalStr) / 100) * 100 : 0;
                                  setEstanquesConvertir(estanquesConvertir.map((est2, j) => j === i ? {
                                    ...est2,
                                    precioTotalInput: precioTotalStr,
                                    litros: litrosCalc > 0 ? String(litrosCalc) : "",
                                    montoRecibido: est2.metodoPago === "credito" ? "" : (totalRedondeado > 0 ? String(totalRedondeado) : ""),
                                  } : est2));
                                }}
                                placeholder="Ej. 5000" className="h-8 text-xs" />
                            </div>
                            {est.precioTotalInput && Number(est.precio) > 0 && (
                              <p className="text-[10px] text-amber-700 dark:text-amber-300">
                                → {formatNumber(Math.round((Number(est.precioTotalInput) || 0) / (Number(est.precio) || 1)), 0)} L a {formatCurrency(Number(est.precio))}/L
                              </p>
                            )}
                            <div>
                              <label className="text-[10px] text-muted-foreground">Precio/L (para cálculo)</label>
                              <Input type="number" inputMode="decimal" step="any" value={est.precio}
                                onChange={(e) => setEstanquesConvertir(estanquesConvertir.map((est2, j) => j === i ? { ...est2, precio: e.target.value } : est2))}
                                placeholder="0" className="h-8 text-xs" />
                            </div>
                          </div>
                        )}
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
                                if (nuevoMetodo === "efectivo") nuevoPrecio = String(precioEfectivo);
                                else if (nuevoMetodo === "transferencia") nuevoPrecio = String(precioTransferencia);
                                else nuevoPrecio = String(Math.max(precioEfectivo, precioTransferencia));
                                const totalEstCalc = (Number(est.litros) || 0) * (Number(nuevoPrecio) || 0);
                                const totalRedondeado = totalEstCalc > 0 ? Math.ceil(totalEstCalc / 100) * 100 : 0;
                                setEstanquesConvertir(estanquesConvertir.map((est2, j) => j === i ? {
                                  ...est2, metodoPago: nuevoMetodo, precio: nuevoPrecio,
                                  montoRecibido: nuevoMetodo === "credito" ? "" : (est2.montoRecibido || (totalRedondeado > 0 ? String(totalRedondeado) : "")),
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
                              placeholder={est.metodoPago === "credito" ? "—" : String(totalEst)} disabled={est.metodoPago === "credito"} className="h-8 text-xs" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          {est.metodoPago === "credito" ? (
                            <>
                              <span className="text-muted-foreground">Total: <strong className="text-amber-600 dark:text-amber-400">{formatCurrency(totalEst)}</strong></span>
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
                    const totalVentaRaw = estanquesConvertir.reduce((s, e) => s + (Number(e.litros) || 0) * (Number(e.precio) || 0), 0);
                    const totalVenta = totalVentaRaw > 0 ? Math.ceil(totalVentaRaw / 100) * 100 : 0;
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

                  {/* Descuento para modo estanques */}
                  <div className="rounded-lg border border-border bg-white dark:bg-background p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Descuento</Label>
                      <select
                        value={descuentoTipoConvertir}
                        onChange={(e) => { setDescuentoTipoConvertir(e.target.value); setDescuentoMontoConvertir(""); setDescuentoPorLitroConvertir(""); }}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="ninguno">Sin descuento</option>
                        <option value="total">Descuento sobre el total</option>
                        <option value="por_litro">Descuento por litro</option>
                      </select>
                    </div>
                    {descuentoTipoConvertir === "total" && (
                      <Input type="number" inputMode="decimal" step="any" value={descuentoMontoConvertir}
                        onChange={(e) => setDescuentoMontoConvertir(e.target.value)}
                        placeholder="Ej. 1200 (para redondear de 21200 a 20000)"
                        className="h-8 text-sm" />
                    )}
                    {descuentoTipoConvertir === "por_litro" && (
                      <Input type="number" inputMode="decimal" step="any" value={descuentoPorLitroConvertir}
                        onChange={(e) => setDescuentoPorLitroConvertir(e.target.value)}
                        placeholder="Ej. 1 (bajar de 8 a 7 por litro)"
                        className="h-8 text-sm" />
                    )}
                    {descuentoTipoConvertir !== "ninguno" && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        El descuento se descontará del pago en liquidación.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Toggle: Por litros / Por precio */}
                  <div className="flex gap-1 rounded-lg bg-muted/40 p-1">
                    <Button type="button" size="sm" variant={!modoPrecioConvertir ? "default" : "ghost"} onClick={() => setModoPrecioConvertir(false)} className="h-7 flex-1">
                      Por litros
                    </Button>
                    <Button type="button" size="sm" variant={modoPrecioConvertir ? "default" : "ghost"} onClick={() => setModoPrecioConvertir(true)} className="h-7 flex-1">
                      Por precio ($)
                    </Button>
                  </div>

                  {!modoPrecioConvertir ? (
                    <div className="space-y-2">
                      <Label htmlFor="litrosReales">Litros entregados (reales)</Label>
                      <Input id="litrosReales" type="number" inputMode="decimal" step="any" value={litrosReales}
                        onChange={(e) => setLitrosReales(e.target.value)} placeholder={String(convirtiendo.litrosSolicitados)} />
                      <p className="text-xs text-muted-foreground">Ajusta si entregaste una cantidad distinta a la pedida.</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20 space-y-2">
                      <Label htmlFor="precioTotalConvertir" className="text-sm font-medium text-blue-900 dark:text-blue-200">
                        ¿Cuántos pesos de agua quiere el cliente?
                      </Label>
                      <Input id="precioTotalConvertir" type="number" inputMode="decimal" step="any" value={precioTotalConvertir}
                        onChange={(e) => {
                          setPrecioTotalConvertir(e.target.value);
                          const precio = Number(precioPorLitro) || 0;
                          if (precio > 0) {
                            setLitrosReales(String(Math.round((Number(e.target.value) || 0) / precio)));
                          }
                        }}
                        placeholder="Ej. 10000" />
                      {precioTotalConvertir && (Number(precioPorLitro) || 0) > 0 && (
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Se entregarán <strong>{formatNumber(Math.round((Number(precioTotalConvertir) || 0) / (Number(precioPorLitro) || 1)), 0)} L</strong>
                          {" "}(a {formatCurrency(Number(precioPorLitro))}/L)
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="precioPorLitroConvertir">Precio por litro</Label>
                    <Input id="precioPorLitroConvertir" type="number" inputMode="decimal" step="any" value={precioPorLitro}
                      onChange={(e) => {
                        setPrecioPorLitro(e.target.value);
                        // Recalcular litros si está en modo precio
                        if (modoPrecioConvertir && precioTotalConvertir) {
                          const precio = Number(e.target.value) || 0;
                          if (precio > 0) {
                            setLitrosReales(String(Math.round(Number(precioTotalConvertir) / precio)));
                          }
                        }
                      }}
                      placeholder="Auto según método" />
                  </div>

                  {/* Cálculo automático con redondeo */}
                  {(() => {
                    const litrosCalc = Number(litrosReales) || convirtiendo.litrosSolicitados;
                    const precioCalc = Number(precioPorLitro) || 0;
                    let subtotal = litrosCalc * precioCalc;
                    if (subtotal > 0) subtotal = Math.ceil(subtotal / 100) * 100;
                    let descuento = 0;
                    if (descuentoTipoConvertir === "total") {
                      descuento = Number(descuentoMontoConvertir) || 0;
                    } else if (descuentoTipoConvertir === "por_litro") {
                      descuento = (Number(descuentoPorLitroConvertir) || 0) * litrosCalc;
                    }
                    const total = Math.max(0, subtotal - descuento);
                    return (
                      <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-1">
                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground">Litros</p>
                            <p className="font-bold tabular-nums">{formatNumber(litrosCalc, 0)} L</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground">Subtotal</p>
                            <p className="font-bold tabular-nums text-muted-foreground">{formatCurrency(subtotal)}</p>
                            {descuento > 0 && <p className="text-xs text-emerald-600">−{formatCurrency(descuento)}</p>}
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground">Total final</p>
                            <p className="font-bold tabular-nums text-primary">{formatCurrency(total)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Descuento */}
                  <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Descuento</Label>
                      <select
                        value={descuentoTipoConvertir}
                        onChange={(e) => { setDescuentoTipoConvertir(e.target.value); setDescuentoMontoConvertir(""); setDescuentoPorLitroConvertir(""); }}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="ninguno">Sin descuento</option>
                        <option value="total">Descuento sobre el total</option>
                        <option value="por_litro">Descuento por litro</option>
                      </select>
                    </div>
                    {descuentoTipoConvertir === "total" && (
                      <Input type="number" inputMode="decimal" step="any" value={descuentoMontoConvertir}
                        onChange={(e) => setDescuentoMontoConvertir(e.target.value)}
                        placeholder="Ej. 1200 (para redondear de 21200 a 20000)"
                        className="h-8 text-sm" />
                    )}
                    {descuentoTipoConvertir === "por_litro" && (
                      <div className="flex items-center gap-2">
                        <Input type="number" inputMode="decimal" step="any" value={descuentoPorLitroConvertir}
                          onChange={(e) => setDescuentoPorLitroConvertir(e.target.value)}
                          placeholder="Ej. 1 (bajar de 8 a 7 por litro)"
                          className="h-8 text-sm w-32" />
                        <span className="text-xs text-muted-foreground">
                          {(() => {
                            const litrosCalc = Number(litrosReales) || convirtiendo.litrosSolicitados;
                            const desc = (Number(descuentoPorLitroConvertir) || 0) * litrosCalc;
                            return `→ ${formatCurrency(desc)} off`;
                          })()}
                        </span>
                      </div>
                    )}
                    {descuentoTipoConvertir !== "ninguno" && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        El descuento se descontará del pago en liquidación.
                      </p>
                    )}
                  </div>

                  {/* Botones de método de pago */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Método de pago</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMetodoPagoConvertir("efectivo");
                          const c = clientes.find(cl => cl.id === convirtiendo?.clienteId);
                          const precio = c?.precioEfectivoPorLitro || 0;
                          setPrecioPorLitro(precio > 0 ? String(precio) : "");
                          setMontoTransferencia("");
                          const litrosCalc = Number(litrosReales) || convirtiendo.litrosSolicitados;
                          const totalCalc = litrosCalc * precio;
                          const totalRedondeado = totalCalc > 0 ? Math.ceil(totalCalc / 100) * 100 : 0;
                          let descuento = descuentoTipoConvertir === "total" ? (Number(descuentoMontoConvertir) || 0) : 0;
                          const totalFinal = Math.max(0, totalRedondeado - descuento);
                          setMontoEfectivo(totalFinal > 0 ? String(totalFinal) : "");
                        }}
                        className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition ${
                          metodoPagoConvertir === "efectivo"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Banknote className="h-5 w-5" />
                        <span className="text-sm font-medium">Efectivo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMetodoPagoConvertir("transferencia");
                          const c = clientes.find(cl => cl.id === convirtiendo?.clienteId);
                          const precio = c?.precioTransferenciaPorLitro || 0;
                          setPrecioPorLitro(precio > 0 ? String(precio) : "");
                          setMontoEfectivo("");
                          const litrosCalc = Number(litrosReales) || convirtiendo.litrosSolicitados;
                          const totalCalc = litrosCalc * precio;
                          const totalRedondeado = totalCalc > 0 ? Math.ceil(totalCalc / 100) * 100 : 0;
                          let descuento = descuentoTipoConvertir === "total" ? (Number(descuentoMontoConvertir) || 0) : 0;
                          const totalFinal = Math.max(0, totalRedondeado - descuento);
                          setMontoTransferencia(totalFinal > 0 ? String(totalFinal) : "");
                        }}
                        className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition ${
                          metodoPagoConvertir === "transferencia"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Smartphone className="h-5 w-5" />
                        <span className="text-sm font-medium">Transferencia</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMetodoPagoConvertir("credito");
                          const c = clientes.find(cl => cl.id === convirtiendo?.clienteId);
                          const precioMax = Math.max(c?.precioEfectivoPorLitro || 0, c?.precioTransferenciaPorLitro || 0);
                          setPrecioPorLitro(precioMax > 0 ? String(precioMax) : "");
                          setMontoEfectivo("");
                          setMontoTransferencia("");
                        }}
                        className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 transition ${
                          metodoPagoConvertir === "credito"
                            ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                            : "border-border hover:border-amber-500/50"
                        }`}
                      >
                        <Clock className="h-5 w-5" />
                        <span className="text-sm font-medium">Sin pago</span>
                        <span className="text-xs text-muted-foreground">Genera deuda</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="montoEfectivoC" className="text-xs">Efectivo recibido</Label>
                      <Input id="montoEfectivoC" type="number" inputMode="decimal" step="any" value={montoEfectivo}
                        onChange={(e) => setMontoEfectivo(e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="montoTransferenciaC" className="text-xs">Transferencia</Label>
                      <Input id="montoTransferenciaC" type="number" inputMode="decimal" step="any" value={montoTransferencia}
                        onChange={(e) => setMontoTransferencia(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                </>
              )}

              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs">
                <p className="font-medium">Se creará una entrega y se asignará a la vuelta activa (si hay).</p>
                <p className="mt-1 text-muted-foreground">El pedido se marcará como "entregado" automáticamente.</p>
              </div>

              {/* Foto del medidor */}
              <div className="space-y-2">
                <Label>Foto del medidor (respaldo)</Label>
                {fotoConvertirUrl ? (
                  <div className="relative w-fit">
                    <img src={fotoConvertirUrl} alt="Foto del medidor" className="max-h-48 rounded-lg border" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={() => setFotoConvertirUrl(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-4 text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/30">
                    {subiendoFotoConvertir ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo...</>
                    ) : (
                      <><Camera className="h-4 w-4" /> <span>Tomar foto o subir imagen</span></>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setSubiendoFotoConvertir(true);
                        try {
                          const result = await uploadFile(f, { tipo: "medidor" });
                          setFotoConvertirUrl(result.url);
                          if (result.uploadedToServer) {
                            toast.success("Foto del medidor subida");
                          } else {
                            toast.success("📷 Foto guardada en el dispositivo (sin señal). Se subirá cuando tengas conexión.", { duration: 8000 });
                          }
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Error al subir la foto");
                        } finally {
                          setSubiendoFotoConvertir(false);
                        }
                      }}
                    />
                  </label>
                )}
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

      {/* Cancelar pedido (recurrente o no) */}
      <Dialog open={!!cancelandoRecurrente} onOpenChange={(o) => !o && setCancelandoRecurrente(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar pedido</DialogTitle>
            <DialogDescription>
              Pedido de <strong>{cancelandoRecurrente?.clienteNombre}</strong>. Como viene de una recurrencia, elegí qué cancelar:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${cancelarModo === "proximo" ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50"}`}>
              <input
                type="radio"
                name="cancelar-modo"
                checked={cancelarModo === "proximo"}
                onChange={() => setCancelarModo("proximo")}
                className="mt-1"
              />
              <div className="flex-1 text-sm">
                <div className="font-medium">Solo este pedido</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Cancela el pedido ya agendado. Los pedidos siguientes se siguen generando normalmente según la frecuencia.
                </div>
              </div>
            </label>

            <label className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${cancelarModo === "periodo" ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50"}`}>
              <input
                type="radio"
                name="cancelar-modo"
                checked={cancelarModo === "periodo"}
                onChange={() => setCancelarModo("periodo")}
                className="mt-1"
              />
              <div className="flex-1 text-sm">
                <div className="font-medium">Pausar por un periodo</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Cancela todos los pedidos hasta una fecha. Útil si el cliente se va de viaje.
                </div>
                {cancelarModo === "periodo" && (
                  <div className="mt-2">
                    <Label className="text-xs">Reanudar a partir de:</Label>
                    <Input
                      type="date"
                      value={cancelarHastaFecha}
                      onChange={(e) => setCancelarHastaFecha(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Los pedidos se cancelan hasta el día anterior. Se reanuda el día seleccionado.
                    </p>
                  </div>
                )}
              </div>
            </label>

            <label className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${cancelarModo === "todos" ? "border-primary bg-primary/5" : "border-input hover:bg-muted/50"}`}>
              <input
                type="radio"
                name="cancelar-modo"
                checked={cancelarModo === "todos"}
                onChange={() => setCancelarModo("todos")}
                className="mt-1"
              />
              <div className="flex-1 text-sm">
                <div className="font-medium">Este pedido y desactivar recurrencia</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Cancela este pedido y desactiva la recurrencia. No se generarán más pedidos automáticamente en el futuro.
                </div>
              </div>
            </label>

            <div>
              <Label className="text-xs">Razón (opcional)</Label>
              <Textarea
                value={cancelarRazon}
                onChange={(e) => setCancelarRazon(e.target.value)}
                placeholder="Ej: cliente de viaje, no necesita agua, etc."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelandoRecurrente(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={cancelandoRec || (cancelarModo === "periodo" && !cancelarHastaFecha)}
              onClick={async () => {
                if (!cancelandoRecurrente?.pedidoRecurrenteId) {
                  toast.error("El pedido no tiene recurrencia asociada");
                  return;
                }
                setCancelandoRec(true);
                try {
                  const res = await apiPost<{ ok: boolean; message: string; pedidosCancelados: number }>(
                    `/api/akuosplash/pedidos-recurrentes/${cancelandoRecurrente.pedidoRecurrenteId}/cancelar`,
                    {
                      modo: cancelarModo,
                      hastaFecha: cancelarModo === "periodo" ? cancelarHastaFecha : undefined,
                      razon: cancelarRazon.trim() || undefined,
                    }
                  );
                  toast.success(res.message || `${res.pedidosCancelados} pedido(s) cancelado(s)`);
                  setCancelandoRecurrente(null);
                  setCancelarHastaFecha("");
                  setCancelarRazon("");
                  cargar();
                  onRefresh?.();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "No se pudo cancelar");
                } finally {
                  setCancelandoRec(false);
                }
              }}
            >
              {cancelandoRec ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <XCircle className="mr-1 h-4 w-4" />}
              Confirmar cancelación
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
