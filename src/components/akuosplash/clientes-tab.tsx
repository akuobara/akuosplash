"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Phone,
  MapPin,
  Droplets,
  Users,
  User,
  Banknote,
  Smartphone,
  Truck,
  Navigation,
  Loader2,
  ExternalLink,
  DoorOpen,
  Fence,
  KeyRound,
  UserCheck,
  Search,
  Mail,
  ClipboardList,
  X,
  UserX,
  Map as MapIcon,
  Store,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/components/akuosplash/akuosplash-api-client";
import { formatCurrency, formatNumber, formatDate, formatTime, labelMetodoPago, labelEstadoPago, USOS_AGUA, TIPOS_ESTANQUE, labelUsoAgua, labelTipoEstanque } from "@/components/akuosplash/akuosplash-helpers";
import { MapPicker } from "./map-picker";
import { ClientesMapa } from "./clientes-mapa";
import { AddressAutocomplete } from "./address-autocomplete";
import { PlacePicker } from "./place-picker";

interface Cliente {
  id: string;
  nombre: string;
  rut: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  zona: string | null;
  precioEfectivoPorLitro: number;
  precioTransferenciaPorLitro: number;
  precioCamionCompleto: number;
  nota: string | null;
  // GPS
  lat: number | null;
  lng: number | null;
  // Acceso
  requiereIngresoPropiedad: boolean;
  entregaDesdeAfuera: boolean;
  conexionExterna: boolean;
  requiereClientePresente: boolean;
  indicacionesAcceso: string | null;
  // Uso del agua
  usoAgua: string;
  usoAguaNota: string | null;
  estanquesJson: string | null;
  // Chofer preferido
  choferPreferidoId: string | null;
  choferPreferido?: { id: string; nombre: string } | null;
  _count?: { entregas: number };
  deuda?: number;
  deudaInicial?: number;
}

interface ClientesTabProps {
  refreshKey: number;
  onRefresh: () => void;
  readOnly?: boolean;
  choferes?: { id: string; nombre: string; email: string }[];
  onAgendarPedido?: (clienteId: string) => void;
  currentUserId?: string;
  isDueno?: boolean;
  config?: any;
  vueltaActual?: any;
  camiones?: any;
}

export function ClientesTab({ refreshKey, onRefresh, readOnly = false, choferes = [], onAgendarPedido, currentUserId, isDueno }: ClientesTabProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [borrando, setBorrando] = useState<Cliente | null>(null);

  // Estado para detalle del cliente
  const [clienteDetalle, setClienteDetalle] = useState<Cliente | null>(null);
  const [detalleTab, setDetalleTab] = useState<"info" | "entregas" | "pedidos" | "pagos">("info");
  const [detalleEntregas, setDetalleEntregas] = useState<any[]>([]);
  const [detallePedidos, setDetallePedidos] = useState<any[]>([]);
  const [detallePagos, setDetallePagos] = useState<any[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);

  // Estado para formulario de pago
  const [pagoOpen, setPagoOpen] = useState(false);
  const [pagoEditando, setPagoEditando] = useState<any | null>(null);
  const [pagoMonto, setPagoMonto] = useState("");
  const [deudaInicialOpen, setDeudaInicialOpen] = useState(false);
  const [deudaInicialMonto, setDeudaInicialMonto] = useState("");
  const [pagoMetodo, setPagoMetodo] = useState("efectivo");
  const [pagoNota, setPagoNota] = useState("");
  const [pagoFecha, setPagoFecha] = useState("");
  const [pagoPrecioEfectivo, setPagoPrecioEfectivo] = useState(false);
  const [pagoSaving, setPagoSaving] = useState(false);
  const [eliminarDeudaOpen, setEliminarDeudaOpen] = useState(false);
  const [eliminarDeudaMetodo, setEliminarDeudaMetodo] = useState<"efectivo" | "transferencia">("efectivo");

  // Campos del formulario
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [zona, setZona] = useState("");
  const [precioEfectivo, setPrecioEfectivo] = useState("");
  const [precioTransferencia, setPrecioTransferencia] = useState("");
  const [precioCamionCompleto, setPrecioCamionCompleto] = useState("");
  const [nota, setNota] = useState("");
  // GPS
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [obteniendoGPS, setObteniendoGPS] = useState(false);
  // Acceso
  const [requiereIngresoPropiedad, setRequiereIngresoPropiedad] = useState(false);
  const [entregaDesdeAfuera, setEntregaDesdeAfuera] = useState(false);
  const [conexionExterna, setConexionExterna] = useState(false);
  const [requiereClientePresente, setRequiereClientePresente] = useState(true);
  const [indicacionesAcceso, setIndicacionesAcceso] = useState("");
  const [usoAgua, setUsoAgua] = useState("consumo");
  const [usoAguaNota, setUsoAguaNota] = useState("");
  const [estanques, setEstanques] = useState<{ tipo: string; capacidad: string; nombre: string; ubicacion: string; facturaSeparada: boolean }[]>([]);
  const [choferPreferidoId, setChoferPreferidoId] = useState<string>("");
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [clientesMapaOpen, setClientesMapaOpen] = useState(false);
  const [placePickerOpen, setPlacePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ clientes: Cliente[] }>("/api/akuosplash/clientes");
      setClientes(data.clientes);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  const filtrados = clientes.filter((c) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(q) ||
      (c.direccion ?? "").toLowerCase().includes(q) ||
      (c.telefono ?? "").toLowerCase().includes(q) ||
      (c.zona ?? "").toLowerCase().includes(q)
    );
  });

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setRut("");
    setDireccion("");
    setTelefono("");
    setEmail("");
    setZona("");
    setPrecioEfectivo("");
    setPrecioTransferencia("");
    setPrecioCamionCompleto("");
    setNota("");
    setLat("");
    setLng("");
    setRequiereIngresoPropiedad(false);
    setEntregaDesdeAfuera(false);
    setConexionExterna(false);
    setRequiereClientePresente(true);
    setIndicacionesAcceso("");
    setUsoAgua("consumo");
    setUsoAguaNota("");
    setEstanques([]);
    setChoferPreferidoId("");
    setFormOpen(true);
  }

  function abrirEditar(c: Cliente) {
    setEditando(c);
    setNombre(c.nombre);
    setRut(c.rut ?? "");
    setDireccion(c.direccion ?? "");
    setTelefono(c.telefono ?? "");
    setEmail(c.email ?? "");
    setZona(c.zona ?? "");
    setPrecioEfectivo(c.precioEfectivoPorLitro ? String(c.precioEfectivoPorLitro) : "");
    setPrecioTransferencia(c.precioTransferenciaPorLitro ? String(c.precioTransferenciaPorLitro) : "");
    setPrecioCamionCompleto(c.precioCamionCompleto ? String(c.precioCamionCompleto) : "");
    setNota(c.nota ?? "");
    setLat(c.lat != null ? String(c.lat) : "");
    setLng(c.lng != null ? String(c.lng) : "");
    setRequiereIngresoPropiedad(c.requiereIngresoPropiedad ?? false);
    setEntregaDesdeAfuera(c.entregaDesdeAfuera ?? false);
    setConexionExterna(c.conexionExterna ?? false);
    setRequiereClientePresente(c.requiereClientePresente ?? true);
    setIndicacionesAcceso(c.indicacionesAcceso ?? "");
    setUsoAgua(c.usoAgua || "consumo");
    setUsoAguaNota(c.usoAguaNota ?? "");
    try {
      const parsed = c.estanquesJson ? JSON.parse(c.estanquesJson) : [];
      // Solo setear si el parseo fue exitoso Y es un array. Si falla, mantener
      // los estanques vacíos pero NO sobreescribir null al guardar.
      if (Array.isArray(parsed)) {
        setEstanques(parsed);
      } else {
        setEstanques([]);
      }
    } catch {
      // Si el JSON está corrupto, NO setear array vacío — esto causaría
      // que al guardar se sobreescriba con null y se pierdan los estanques.
      // En lugar de eso, cargar un estanque placeholder para preservar el dato.
      setEstanques([{ tipo: "estanque", capacidad: "", nombre: "", ubicacion: "", facturaSeparada: false }]);
    }
    setChoferPreferidoId(c.choferPreferidoId ?? "");
    setFormOpen(true);
  }

  // Abrir detalle del cliente con su historial
  // Soltar cliente: el chofer preferido se elimina a sí mismo (con o sin reemplazo)
  const [soltandoCliente, setSoltandoCliente] = useState(false);
  const [reemplazoChoferId, setReemplazoChoferId] = useState<string>("");

  async function soltarCliente(clienteId: string, clienteNombre: string) {
    const reemplazo = reemplazoChoferId && reemplazoChoferId !== "__ninguno" ? reemplazoChoferId : null;
    const msg = reemplazo
      ? `¿Soltar a ${clienteNombre} y asignar a ${choferes.find(c => c.id === reemplazo)?.nombre ?? "otro chofer"} como reemplazo?`
      : `¿Soltar a ${clienteNombre}? Sin reemplazo, los pedidos pendientes irán al pool visible para todos los choferes.`;
    if (!confirm(msg)) return;
    setSoltandoCliente(true);
    try {
      await apiPost(`/api/akuosplash/clientes/${clienteId}/soltar-chofer`, { reemplazoChoferId: reemplazo });
      toast.success(reemplazo ? `Cliente reasignado a ${choferes.find(c => c.id === reemplazo)?.nombre}` : `Cliente soltado — pedidos publicados al pool`);
      setReemplazoChoferId("");
      onRefresh();
      setClienteDetalle(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo soltar el cliente");
    } finally {
      setSoltandoCliente(false);
    }
  }

  // Dueño: cambiar chofer preferido
  async function cambiarChoferPreferido(clienteId: string, nuevoChoferId: string | null) {
    try {
      await apiPatch(`/api/akuosplash/clientes/${clienteId}`, {
        choferPreferidoId: nuevoChoferId && nuevoChoferId !== "__ninguno" ? nuevoChoferId : null,
      });
      toast.success(nuevoChoferId ? "Chofer preferido actualizado" : "Chofer preferido elimininado");
      onRefresh();
      // Actualizar el detalle si está abierto
      if (clienteDetalle?.id === clienteId) {
        setClienteDetalle({ ...clienteDetalle, choferPreferidoId: nuevoChoferId && nuevoChoferId !== "__ninguno" ? nuevoChoferId : null, choferPreferido: nuevoChoferId && nuevoChoferId !== "__ninguno" ? { id: nuevoChoferId, nombre: choferes.find(c => c.id === nuevoChoferId)?.nombre ?? "?" } : null });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el chofer preferido");
    }
  }

  async function abrirDetalle(c: Cliente) {
    setClienteDetalle(c);
    setDetalleTab("info");
    setDetalleLoading(true);
    try {
      const [ents, peds, pays] = await Promise.all([
        apiGet<{ entregas: any[] }>(`/api/akuosplash/entregas?period=todo&clienteId=${c.id}`),
        apiGet<{ pedidos: any[] }>(`/api/akuosplash/pedidos?clienteId=${c.id}`),
        apiGet<{ pagos: any[] }>(`/api/akuosplash/pagos?clienteId=${c.id}`),
      ]);
      setDetalleEntregas(ents.entregas || []);
      setDetallePedidos(peds.pedidos || []);
      setDetallePagos(pays.pagos || []);
    } catch (e) {
      console.error(e);
    } finally {
      setDetalleLoading(false);
    }
  }

  // Capturar ubicación GPS actual del dispositivo
  function obtenerMiUbicacion() {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }
    setObteniendoGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setObteniendoGPS(false);
        toast.success("Ubicación capturada");
      },
      (err) => {
        setObteniendoGPS(false);
        toast.error(err.message || "No se pudo obtener tu ubicación");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        rut: rut.trim() || null,
        direccion: direccion.trim() || null,
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        zona: zona.trim() || null,
        precioEfectivoPorLitro: Number(precioEfectivo) || 0,
        precioTransferenciaPorLitro: Number(precioTransferencia) || 0,
        precioCamionCompleto: Number(precioCamionCompleto) || 0,
        nota: nota.trim() || null,
        lat: lat.trim() === "" ? null : Number(lat),
        lng: lng.trim() === "" ? null : Number(lng),
        requiereIngresoPropiedad,
        entregaDesdeAfuera,
        conexionExterna,
        requiereClientePresente,
        indicacionesAcceso: indicacionesAcceso.trim() || null,
        usoAgua,
        usoAguaNota: usoAguaNota.trim() || null,
        estanquesJson: estanques.length > 0 ? JSON.stringify(estanques) : null,
        choferPreferidoId: choferPreferidoId || null,
      };
      if (editando) {
        await apiPatch(`/api/akuosplash/clientes/${editando.id}`, payload);
        toast.success("Cliente actualizado");
      } else {
        await apiPost("/api/akuosplash/clientes", payload);
        toast.success("Cliente creado");
      }
      setFormOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleBorrar(c: Cliente) {
    try {
      await apiDelete(`/api/akuosplash/clientes/${c.id}`);
      toast.success("Cliente eliminado");
      setBorrando(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  async function handlePago(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteDetalle) return;
    const monto = Number(pagoMonto) || 0;
    if (monto <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    setPagoSaving(true);
    try {
      await apiPost("/api/akuosplash/pagos", {
        clienteId: clienteDetalle.id,
        monto,
        metodoPago: pagoMetodo,
        nota: pagoNota.trim() || null,
        precioEfectivo: pagoPrecioEfectivo,
        ...(pagoFecha ? { fecha: pagoFecha } : {}),
      });
      toast.success("Pago registrado");
      setPagoOpen(false);
      setPagoMonto("");
      setPagoFecha("");
      setPagoNota("");
      setPagoPrecioEfectivo(false);
      abrirDetalle(clienteDetalle);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar el pago");
    } finally {
      setPagoSaving(false);
    }
  }

  async function handleDeudaInicial(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteDetalle) return;
    const monto = Number(deudaInicialMonto) || 0;
    // Permitir positivos (deuda) y negativos (saldo a favor)
    setPagoSaving(true);
    try {
      await apiPatch(`/api/akuosplash/clientes/${clienteDetalle.id}`, { deudaInicial: monto });
      if (monto > 0) {
        toast.success("Deuda registrada");
      } else if (monto < 0) {
        toast.success("Saldo a favor registrado");
      } else {
        toast.success("Deuda/saldo eliminado");
      }
      setDeudaInicialOpen(false);
      setDeudaInicialMonto("");
      setClienteDetalle({ ...clienteDetalle, deudaInicial: monto } as any);
      abrirDetalle(clienteDetalle);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar");
    } finally {
      setPagoSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">Clientes</h2>
          <p className="text-sm text-muted-foreground">
            {readOnly
              ? "Catálogo de clientes del administrador (solo lectura)."
              : "Catálogo de clientes frecuentes con precios por método de pago y por zona."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setClientesMapaOpen(true)}
            disabled={clientes.length === 0}
            title="Ver todos los clientes en el mapa"
          >
            <MapIcon className="mr-1 h-4 w-4" /> Mapa
          </Button>
          {!readOnly && (
            <Button onClick={abrirNuevo} size="sm">
              <Plus className="mr-1 h-4 w-4" /> Nuevo cliente
            </Button>
          )}
        </div>
      </div>

      <Input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, dirección, zona o teléfono…"
        className="max-w-md"
      />

      {/* Lista */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {clientes.length === 0
                ? "Aún no hay clientes registrados."
                : "No se encontraron clientes."}
            </p>
            <Button onClick={abrirNuevo} variant="outline" size="sm">
              <Plus className="mr-1 h-4 w-4" /> Agregar cliente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((c) => (
            <Card key={c.id} data-cliente-card className="flex flex-col cursor-pointer hover:shadow-md transition-shadow" onClick={() => abrirDetalle(c)}>
              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-semibold">{c.nombre}</p>
                      {/* Ícono de deuda pendiente */}
                      {(c.deuda ?? 0) > 0.5 && (
                        <span
                          title={`Deuda pendiente: ${formatCurrency(c.deuda ?? 0)}`}
                          className="inline-flex items-center justify-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300 shrink-0"
                        >
                          <Banknote className="mr-0.5 h-2.5 w-2.5" />
                          {formatCurrency(c.deuda ?? 0)}
                        </span>
                      )}
                    </div>
                    {c._count && (
                      <p className="text-xs text-muted-foreground">
                        {c._count.entregas} entrega{c._count.entregas !== 1 ? "s" : ""} registradas
                      </p>
                    )}
                  </div>
                  {!readOnly && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => abrirDetalle(c)}>
                          <Eye className="mr-2 h-4 w-4" /> Ver detalle
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => abrirEditar(c)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setBorrando(c)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {c.zona && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <Badge variant="outline" className="text-[10px]">{c.zona}</Badge>
                    </div>
                  )}
                  {c.direccion && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.direccion}</span>
                    </div>
                  )}
                  {c.telefono && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <a href={`tel:${c.telefono}`} className="hover:underline">
                        {c.telefono}
                      </a>
                    </div>
                  )}
                </div>
                {/* Precios por método */}
                {(c.precioEfectivoPorLitro > 0 || c.precioTransferenciaPorLitro > 0 || c.precioCamionCompleto > 0) && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {c.precioEfectivoPorLitro > 0 && (
                      <Badge variant="secondary" className="text-[11px]">
                        <Banknote className="mr-1 h-3 w-3" />
                        {formatCurrency(c.precioEfectivoPorLitro)}/L
                      </Badge>
                    )}
                    {c.precioTransferenciaPorLitro > 0 && (
                      <Badge variant="secondary" className="text-[11px]">
                        <Smartphone className="mr-1 h-3 w-3" />
                        {formatCurrency(c.precioTransferenciaPorLitro)}/L
                      </Badge>
                    )}
                    {c.precioCamionCompleto > 0 && (
                      <Badge variant="secondary" className="text-[11px]">
                        <Truck className="mr-1 h-3 w-3" />
                        {formatCurrency(c.precioCamionCompleto)} / camión
                      </Badge>
                    )}
                  </div>
                )}

                {/* Indicadores de acceso */}
                {(c.requiereIngresoPropiedad || c.entregaDesdeAfuera || c.conexionExterna || c.requiereClientePresente === false) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.requiereIngresoPropiedad && (
                      <Badge variant="outline" className="text-[10px] gap-0.5" title="Hay que ingresar a la propiedad">
                        <DoorOpen className="h-2.5 w-2.5" /> Ingreso
                      </Badge>
                    )}
                    {c.entregaDesdeAfuera && (
                      <Badge variant="outline" className="text-[10px] gap-0.5" title="Se puede entregar desde afuera">
                        <Fence className="h-2.5 w-2.5" /> Desde afuera
                      </Badge>
                    )}
                    {c.conexionExterna && (
                      <Badge variant="outline" className="text-[10px] gap-0.5 text-emerald-700 dark:text-emerald-300" title="Conexión/llave externa">
                        <KeyRound className="h-2.5 w-2.5" /> Conexión
                      </Badge>
                    )}
                    {c.requiereClientePresente === false && (
                      <Badge variant="outline" className="text-[10px] gap-0.5 text-amber-700 dark:text-amber-300" title="No requiere cliente presente">
                        <UserCheck className="h-2.5 w-2.5" /> Sin presencia
                      </Badge>
                    )}
                  </div>
                )}

                {/* GPS */}
                {c.lat != null && c.lng != null && (
                  <a
                    href={`https://www.google.com/maps?q=${c.lat},${c.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Navigation className="h-3 w-3" /> Ver ubicación GPS
                  </a>
                )}

                {/* Indicaciones de acceso */}
                {c.indicacionesAcceso && (
                  <p className="mt-1 line-clamp-3 rounded bg-amber-50 dark:bg-amber-900/20 p-2 text-xs text-amber-900 dark:text-amber-200">
                    <DoorOpen className="mr-1 inline h-3 w-3" />
                    {c.indicacionesAcceso}
                  </p>
                )}

                {c.nota && (
                  <p className="mt-1 line-clamp-2 rounded bg-muted/40 p-2 text-xs text-muted-foreground">
                    {c.nota}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Índice alfabético lateral + botón volver arriba */}
      {filtrados.length > 10 && (
        <>
          {/* Índice A-Z fijo a la derecha */}
          <div className="fixed right-1 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-0.5 bg-background/80 backdrop-blur rounded-lg p-1 shadow-md max-h-[70vh] overflow-y-auto">
            {(() => {
              // Calcular letras disponibles
              const letras = new Set<string>();
              for (const c of filtrados) {
                const primera = c.nombre.trim()[0]?.toUpperCase() || "?";
                letras.add(primera);
              }
              return Array.from(letras).sort().map(letra => (
                <button
                  key={letra}
                  onClick={() => {
                    // Buscar el primer cliente con esa letra y hacer scroll
                    const idx = filtrados.findIndex(c => c.nombre.trim()[0]?.toUpperCase() === letra);
                    if (idx >= 0) {
                      const cards = document.querySelectorAll('[data-cliente-card]');
                      cards[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                  }}
                  className="text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 rounded px-1 py-0.5 transition"
                  title={`Ir a clientes con ${letra}`}
                >
                  {letra}
                </button>
              ));
            })()}
          </div>

          {/* Botón volver arriba */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-4 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition text-xl font-bold"
            title="Volver arriba"
          >
            ↑
          </button>
        </>
      )}

      {/* Formulario */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[95vh] w-[95vw] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
            <DialogDescription>
              Los datos del cliente se guardan para autocompletar nuevas entregas.
              Los precios por método sobreescriben los globales.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nombreCliente">Nombre *</Label>
                <div className="flex gap-2">
                  <Input
                    id="nombreCliente"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Juan Pérez"
                    required
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPlacePickerOpen(true)}
                    title="Buscar un negocio por nombre (Google Places)"
                  >
                    <Store className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rutCliente">RUT</Label>
                <Input
                  id="rutCliente"
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  placeholder="12.345.678-9"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telefonoCliente">Teléfono</Label>
                <Input
                  id="telefonoCliente"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+56 9 1234 5678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailCliente">Email</Label>
                <Input
                  id="emailCliente"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cliente@email.com"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <AddressAutocomplete
                id="direccionCliente"
                value={direccion}
                onChange={setDireccion}
                onSelect={(place) => {
                  if (place.lat != null && place.lng != null) {
                    setLat(String(place.lat));
                    setLng(String(place.lng));
                  }
                  if (!zona && (place.locality || place.sublocality || place.administrativeAreaLevel2)) {
                    setZona(place.locality || place.sublocality || place.administrativeAreaLevel2 || "");
                  }
                  if (place.formattedAddress && (!direccion || direccion.length < place.formattedAddress.length)) {
                    setDireccion(place.formattedAddress);
                  }
                  toast.success("Dirección autocompletada desde Google Maps");
                }}
                placeholder="Ej: Av Las Hualtatas 123, Las Condes"
                label="Dirección"
              />
              <div className="space-y-2">
                <Label htmlFor="zonaCliente">Zona</Label>
                <Input
                  id="zonaCliente"
                  value={zona}
                  onChange={(e) => setZona(e.target.value)}
                  placeholder="Ej. Rural 5km"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Droplets className="h-4 w-4 text-primary" /> Precios específicos (opcional)
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                Si dejas estos campos en 0, se usarán los precios globales. Define precios distintos
                según la ubicación del cliente o su método de pago preferido.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="precioEfectivoCliente" className="text-xs">
                    <Banknote className="mr-1 inline h-3 w-3" /> Efectivo $/L
                  </Label>
                  <Input
                    id="precioEfectivoCliente"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={precioEfectivo}
                    onChange={(e) => setPrecioEfectivo(e.target.value)}
                    placeholder="0 = global"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precioTransferenciaCliente" className="text-xs">
                    <Smartphone className="mr-1 inline h-3 w-3" /> Transferencia $/L
                  </Label>
                  <Input
                    id="precioTransferenciaCliente"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={precioTransferencia}
                    onChange={(e) => setPrecioTransferencia(e.target.value)}
                    placeholder="0 = global"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="precioCamionCompletoCliente" className="text-xs">
                    <Truck className="mr-1 inline h-3 w-3" /> Precio camión completo ($ fijo)
                  </Label>
                  <Input
                    id="precioCamionCompletoCliente"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={precioCamionCompleto}
                    onChange={(e) => setPrecioCamionCompleto(e.target.value)}
                    placeholder="0 = global. Precio fijo por camión completo (ej: 17000L)"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notaCliente">Nota</Label>
              <Textarea
                id="notaCliente"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej. Llamar 15 min antes, estanque en el patio trasero"
                rows={2}
              />
            </div>

            {/* Ubicación GPS */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Navigation className="h-4 w-4 text-primary" /> Ubicación GPS
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMapPickerOpen(true)}
                  >
                    <Search className="mr-1 h-3 w-3" />
                    Buscar en mapa
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={obtenerMiUbicacion}
                    disabled={obteniendoGPS}
                  >
                    {obteniendoGPS ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <MapPin className="mr-1 h-3 w-3" />
                    )}
                    Mi ubicación
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="latCliente" className="text-xs">Latitud</Label>
                  <Input
                    id="latCliente"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="-33.4489"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lngCliente" className="text-xs">Longitud</Label>
                  <Input
                    id="lngCliente"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="-70.6693"
                  />
                </div>
              </div>
              {lat && lng && (
                <a
                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Ver en Google Maps
                </a>
              )}
              <p className="text-xs text-muted-foreground">
                Usa "Buscar en mapa" para encontrar la dirección del cliente sin estar ahí.
              </p>
            </div>

            {/* Acceso a la propiedad */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <DoorOpen className="h-4 w-4 text-primary" /> Acceso a la propiedad
              </Label>
              <p className="text-xs text-muted-foreground">
                Indica cómo se entrega el agua en este cliente. Esto ayuda al chofer a saber qué esperar.
              </p>

              <div className="space-y-2">
                <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-2.5 cursor-pointer hover:bg-muted/30">
                  <Switch
                    checked={requiereIngresoPropiedad}
                    onCheckedChange={setRequiereIngresoPropiedad}
                  />
                  <div className="flex-1 -mt-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <DoorOpen className="h-3.5 w-3.5" /> Hay que ingresar a la propiedad
                    </span>
                    <p className="text-xs text-muted-foreground">
                      El chofer debe entrar al terreno (abrir portón, pasar a patio, etc.)
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-2.5 cursor-pointer hover:bg-muted/30">
                  <Switch
                    checked={entregaDesdeAfuera}
                    onCheckedChange={setEntregaDesdeAfuera}
                  />
                  <div className="flex-1 -mt-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Fence className="h-3.5 w-3.5" /> Se puede entregar desde afuera
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Pasar manguera por sobre el portón/muro, sin entrar a la propiedad
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-2.5 cursor-pointer hover:bg-muted/30">
                  <Switch
                    checked={conexionExterna}
                    onCheckedChange={setConexionExterna}
                  />
                  <div className="flex-1 -mt-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <KeyRound className="h-3.5 w-3.5" /> Hay conexión/llave externa
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Existe una llave de paso o conexión accesible desde afuera — se puede entregar sin el cliente
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-2.5 cursor-pointer hover:bg-muted/30">
                  <Switch
                    checked={requiereClientePresente}
                    onCheckedChange={setRequiereClientePresente}
                  />
                  <div className="flex-1 -mt-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <UserCheck className="h-3.5 w-3.5" /> Cliente debe estar presente
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Si está apagado, se puede entregar aunque el cliente no esté (con autorización/conexión externa)
                    </p>
                  </div>
                </label>
              </div>

              <div className="space-y-1">
                <Label htmlFor="indicacionesAcceso" className="text-xs">Indicaciones de acceso (descripción libre)</Label>
                <Textarea
                  id="indicacionesAcceso"
                  value={indicacionesAcceso}
                  onChange={(e) => setIndicacionesAcceso(e.target.value)}
                  placeholder="Ej. Portón verde, llamar al llegar. Estanque atrás cerca del quincho. Llave de paso bajo la tapa de cemento."
                  rows={3}
                />
              </div>
            </div>

            {/* Uso del agua */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Droplets className="h-4 w-4 text-primary" /> Uso del agua
              </Label>
              <p className="text-xs text-muted-foreground">¿Para qué pide agua este cliente?</p>
              <div className="space-y-1">
                <select
                  value={usoAgua}
                  onChange={(e) => setUsoAgua(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {USOS_AGUA.map((u) => (
                    <option key={u.value} value={u.value}>{u.label} — {u.description}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="usoAguaNota" className="text-xs">Detalle del uso (opcional)</Label>
                <Input
                  id="usoAguaNota"
                  value={usoAguaNota}
                  onChange={(e) => setUsoAguaNota(e.target.value)}
                  placeholder="Ej. Regar 2 hectáreas de pasto, humedecer 500m de camino"
                />
              </div>
            </div>

            {/* Estanques / Piscinas */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Droplets className="h-4 w-4 text-primary" /> Estanques y piscinas
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEstanques([...estanques, { tipo: "estanque", capacidad: "", nombre: "", ubicacion: "", facturaSeparada: false }])}
                >
                  <Plus className="mr-1 h-3 w-3" /> Agregar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Registra los estanques/piscinas del cliente para saber cuánta agua puede recibir de una vez.
              </p>

              {estanques.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                  Sin estanques registrados. Clic en "Agregar" para añadir uno.
                </p>
              ) : (
                <div className="space-y-2">
                  {estanques.map((est, i) => (
                    <div key={i} className="rounded-lg border border-border bg-background p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Estanque #{i + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setEstanques(estanques.filter((_, j) => j !== i))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={est.tipo}
                          onChange={(e) => setEstanques(estanques.map((est2, j) => j === i ? { ...est2, tipo: e.target.value } : est2))}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          {TIPOS_ESTANQUE.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={est.capacidad}
                          onChange={(e) => setEstanques(estanques.map((est2, j) => j === i ? { ...est2, capacidad: e.target.value } : est2))}
                          placeholder="Capacidad (L)"
                          className="h-8 text-xs"
                        />
                      </div>
                      <Input
                        value={est.nombre}
                        onChange={(e) => setEstanques(estanques.map((est2, j) => j === i ? { ...est2, nombre: e.target.value } : est2))}
                        placeholder="Nombre/identificador (ej. Estanque principal, Piscina)"
                        className="h-8 text-xs"
                      />
                      <Input
                        value={est.ubicacion}
                        onChange={(e) => setEstanques(estanques.map((est2, j) => j === i ? { ...est2, ubicacion: e.target.value } : est2))}
                        placeholder="Ubicación (ej. Patio trasero, junto al quincho)"
                        className="h-8 text-xs"
                      />
                      {/* Checkbox facturación independiente */}
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={est.facturaSeparada}
                          onChange={(e) => setEstanques(estanques.map((est2, j) => j === i ? { ...est2, facturaSeparada: e.target.checked } : est2))}
                          className="h-3.5 w-3.5"
                        />
                        <span>Facturar este estanque por separado (casa/cabaña independiente)</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {/* Total capacidad */}
              {estanques.length > 0 && (() => {
                const total = estanques.reduce((s, e) => s + (Number(e.capacidad) || 0), 0);
                const independientes = estanques.filter((e) => e.facturaSeparada).length;
                return (
                  <>
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-2 text-center text-sm">
                      <span className="text-muted-foreground">Capacidad total: </span>
                      <strong className="tabular-nums text-primary">{formatNumber(total, 0)} L</strong>
                    </div>
                    {independientes > 0 && (
                      <p className="text-center text-[11px] text-amber-600 dark:text-amber-400">
                        {independientes} estanque(s) con facturación independiente — al registrar una entrega se desglosará por estanque
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Chofer preferido */}
            {choferes.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="choferPreferido">Chofer preferido (opcional)</Label>
                <select
                  id="choferPreferido"
                  value={choferPreferidoId || "__ninguno"}
                  onChange={(e) => setChoferPreferidoId(e.target.value === "__ninguno" ? "" : e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="__ninguno">— Sin preferido —</option>
                  {choferes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Este chofer tendrá prioridad para atender pedidos de este cliente. Si el cliente fue agregado por un chofer, ese chofer es el preferido por defecto.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : editando ? "Guardar cambios" : "Crear cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Map Picker */}
      <MapPicker
        open={mapPickerOpen}
        onOpenChange={setMapPickerOpen}
        onSelect={(latVal, lngVal) => {
          setLat(String(latVal));
          setLng(String(lngVal));
          toast.success("Ubicación seleccionada");
        }}
        initialLat={lat ? parseFloat(lat) : null}
        initialLng={lng ? parseFloat(lng) : null}
      />

      {/* Mapa de todos los clientes */}
      <ClientesMapa
        open={clientesMapaOpen}
        onOpenChange={setClientesMapaOpen}
        clientes={clientes}
        onSelectCliente={(id) => {
          const c = clientes.find((x) => x.id === id);
          if (c) abrirEditar(c);
        }}
      />

      {/* Place Picker: buscar negocio por nombre y autocompletar */}
      <PlacePicker
        open={placePickerOpen}
        onOpenChange={setPlacePickerOpen}
        initialQuery={nombre}
        onSelect={(place) => {
          if (place.name) setNombre(place.name);
          if (place.formattedAddress) setDireccion(place.formattedAddress);
          if (place.phone) setTelefono(place.phone);
          if (place.lat != null && place.lng != null) {
            setLat(String(place.lat));
            setLng(String(place.lng));
          }
          if (!zona) {
            setZona(place.locality || place.sublocality || place.administrativeAreaLevel2 || "");
          }
          toast.success(`Datos autocompletados desde Google: ${place.name || place.formattedAddress}`);
        }}
      />

      {/* Diálogo registrar pago */}
      <Dialog open={pagoOpen} onOpenChange={setPagoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pago de {clienteDetalle?.nombre}</DialogTitle>
            <DialogDescription>
              Registra un pago sin entrega. Se descontará de la deuda pendiente del cliente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePago} className="space-y-4">
            {/* Info de precios del cliente */}
            {clienteDetalle && (clienteDetalle.precioEfectivoPorLitro > 0 || clienteDetalle.precioTransferenciaPorLitro > 0) && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-900 dark:bg-blue-900/20">
                <p className="font-medium text-blue-900 dark:text-blue-200 mb-1">Precios del cliente:</p>
                <div className="flex gap-4 text-blue-800 dark:text-blue-300">
                  <span><Banknote className="mr-1 inline h-3 w-3" />Efectivo: <strong>{formatCurrency(clienteDetalle.precioEfectivoPorLitro)}/L</strong></span>
                  <span><Smartphone className="mr-1 inline h-3 w-3" />Transferencia: <strong>{formatCurrency(clienteDetalle.precioTransferenciaPorLitro)}/L</strong></span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="pagoMonto">Monto recibido *</Label>
              <Input
                id="pagoMonto"
                type="number"
                inputMode="decimal"
                step="any"
                value={pagoMonto}
                onChange={(e) => setPagoMonto(e.target.value)}
                placeholder="0"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Método de pago</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={pagoMetodo === "efectivo" ? "default" : "outline"}
                  onClick={() => setPagoMetodo("efectivo")}
                  className="flex-1"
                >
                  <Banknote className="mr-1 h-4 w-4" /> Efectivo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pagoMetodo === "transferencia" ? "default" : "outline"}
                  onClick={() => setPagoMetodo("transferencia")}
                  className="flex-1"
                >
                  <Smartphone className="mr-1 h-4 w-4" /> Transferencia
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pagoFecha">Fecha del pago (opcional)</Label>
              <Input
                id="pagoFecha"
                type="date"
                value={pagoFecha}
                onChange={(e) => setPagoFecha(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Dejar vacío para usar la fecha de hoy.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pagoNota">Nota (opcional)</Label>
              <Input
                id="pagoNota"
                value={pagoNota}
                onChange={(e) => setPagoNota(e.target.value)}
                placeholder="Ej. Pago de deuda anterior"
              />
            </div>
            {clienteDetalle && (() => {
              // Mostrar el toggle si el cliente tiene precios propios O si hereda del global (ambos 0)
              const tienePreciosPropios = clienteDetalle.precioEfectivoPorLitro > 0 || clienteDetalle.precioTransferenciaPorLitro > 0;
              const efectivo = clienteDetalle.precioEfectivoPorLitro;
              const transferencia = clienteDetalle.precioTransferenciaPorLitro || 0;
              const mostrarToggle = (tienePreciosPropios && efectivo > 0 && efectivo < transferencia)
                || (!tienePreciosPropios);
              if (!mostrarToggle) return null;
              const precioEfectivoDisplay = efectivo > 0 ? formatCurrency(efectivo) : "precio efectivo global";
              return (
                <label className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                  <Switch checked={pagoPrecioEfectivo} onCheckedChange={setPagoPrecioEfectivo} />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                      Recalcular deuda a precio efectivo
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Las entregas impagas se recalcularán al precio efectivo ({precioEfectivoDisplay}/L).
                      Útil si el cliente va a pagar en efectivo y la deuda se generó al precio transferencia (más alto).
                    </p>
                  </div>
                </label>
              );
            })()}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setPagoOpen(false); setPagoFecha(""); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pagoSaving}>
                {pagoSaving ? "Guardando…" : "Registrar pago"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Eliminar deuda */}
      <Dialog open={eliminarDeudaOpen} onOpenChange={setEliminarDeudaOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar deuda de {clienteDetalle?.nombre}</DialogTitle>
            <DialogDescription>
              Registra la deuda como cobrada (pago que cancela toda la deuda pendiente).
              Se registrará como un pago con el método seleccionado.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!clienteDetalle) return;
              setPagoSaving(true);
              try {
                const res = await apiPost<{ ok: boolean; monto: number; message?: string }>(
                  `/api/akuosplash/clientes/${clienteDetalle.id}/eliminar-deuda`,
                  { metodoPago: eliminarDeudaMetodo }
                );
                if (res.monto === 0) {
                  toast.info("No hay deuda pendiente");
                } else {
                  toast.success(`Deuda eliminada: ${formatCurrency(res.monto)} (${eliminarDeudaMetodo})`);
                }
                setEliminarDeudaOpen(false);
                abrirDetalle(clienteDetalle);
                onRefresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "No se pudo eliminar la deuda");
              } finally {
                setPagoSaving(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Método de pago</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={eliminarDeudaMetodo === "efectivo" ? "default" : "outline"}
                  onClick={() => setEliminarDeudaMetodo("efectivo")}
                  className="flex-1"
                >
                  <Banknote className="mr-1 h-4 w-4" /> Efectivo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={eliminarDeudaMetodo === "transferencia" ? "default" : "outline"}
                  onClick={() => setEliminarDeudaMetodo("transferencia")}
                  className="flex-1"
                >
                  <Smartphone className="mr-1 h-4 w-4" /> Transferencia
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Si elegís efectivo, las entregas impagas se recalcularán al precio efectivo del cliente.
                Si elegís transferencia, se mantendrán al precio transferencia.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEliminarDeudaOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pagoSaving} className="bg-red-600 hover:bg-red-700">
                {pagoSaving ? "Guardando…" : "Eliminar deuda"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Registrar deuda */}
      <Dialog open={deudaInicialOpen} onOpenChange={setDeudaInicialOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deuda / Saldo a favor</DialogTitle>
            <DialogDescription>
              Registra lo que te debe el cliente (deuda) o lo que el cliente tiene a favor (saldo).
              Los pagos que recibas van a descontar de la deuda.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDeudaInicial} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="deudaInicialMonto">Monto ($)</Label>
              <Input
                id="deudaInicialMonto"
                type="number"
                step="100"
                value={deudaInicialMonto}
                onChange={(e) => setDeudaInicialMonto(e.target.value)}
                placeholder="Ej: 50000 (deuda) o -50000 (saldo a favor)"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDeudaInicialMonto(String(Math.abs(Number(deudaInicialMonto) || 0)))}
                >
                  💰 Deuda (+)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDeudaInicialMonto(String(-Math.abs(Number(deudaInicialMonto) || 0)))}
                >
                  ✅ Saldo a favor (-)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Positivo = el cliente te debe. Negativo = el cliente tiene saldo a favor.
                Poné 0 para eliminar.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeudaInicialOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pagoSaving}>
                {pagoSaving ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Editar pago */}
      <Dialog open={!!pagoEditando} onOpenChange={(o) => !o && setPagoEditando(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar pago</DialogTitle>
            <DialogDescription>
              Podés corregir el monto, método de pago, o quién lo recibió.
            </DialogDescription>
          </DialogHeader>
          {pagoEditando && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const data: Record<string, unknown> = {};
                const monto = Number((document.getElementById("editPagoMonto") as HTMLInputElement)?.value);
                const metodo = (document.getElementById("editPagoMetodo") as HTMLSelectElement)?.value;
                const nota = (document.getElementById("editPagoNota") as HTMLInputElement)?.value;
                const choferSelect = (document.getElementById("editPagoChofer") as HTMLSelectElement)?.value;
                if (monto > 0 && monto !== pagoEditando.monto) data.monto = monto;
                if (metodo && metodo !== pagoEditando.metodoPago) data.metodoPago = metodo;
                if (nota !== undefined && nota !== (pagoEditando.nota || "")) data.nota = nota;
                if (choferSelect !== undefined) {
                  // "" = admin (null), "choferId" = ese chofer
                  const newChoferId = choferSelect === "" ? null : choferSelect;
                  if (newChoferId !== pagoEditando.choferId) data.choferId = choferSelect === "" ? null : choferSelect;
                }
                if (Object.keys(data).length === 0) {
                  toast.info("No hay cambios para guardar");
                  return;
                }
                try {
                  await apiPatch(`/api/akuosplash/pagos/${pagoEditando.id}`, data);
                  toast.success("Pago actualizado");
                  setPagoEditando(null);
                  if (clienteDetalle) abrirDetalle(clienteDetalle);
                  onRefresh();
                } catch (err) {
                  toast.error("No se pudo actualizar el pago");
                }
              }}
              className="space-y-3"
            >
              <div className="space-y-2">
                <Label htmlFor="editPagoMonto">Monto ($)</Label>
                <Input
                  id="editPagoMonto"
                  type="number"
                  step="100"
                  defaultValue={pagoEditando.monto}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPagoMetodo">Método de pago</Label>
                <select
                  id="editPagoMetodo"
                  defaultValue={pagoEditando.metodoPago}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="mixto">Mixto</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPagoChofer">¿Quién lo recibió?</Label>
                <select
                  id="editPagoChofer"
                  defaultValue={pagoEditando.choferId || ""}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">Admin (no lo recibió el chofer)</option>
                  {choferes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Si lo recibió el admin, no aparece en la liquidación del chofer.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPagoNota">Nota</Label>
                <Input
                  id="editPagoNota"
                  defaultValue={pagoEditando.nota || ""}
                  placeholder="Ej. Pago de deuda anterior"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPagoEditando(null)}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar cambios</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <Dialog open={!!borrando} onOpenChange={(o) => !o && setBorrando(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar cliente</DialogTitle>
            <DialogDescription>
              ¿Eliminar a <strong>{borrando?.nombre}</strong>? El historial de entregas no se borra,
              pero ya no estará asociado a este cliente.
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

      {/* Dialog de detalle del cliente */}
      <Dialog open={!!clienteDetalle} onOpenChange={(o) => !o && setClienteDetalle(null)}>
        <DialogContent className="max-h-[95vh] w-[95vw] max-w-2xl overflow-y-auto overflow-x-hidden">
          {clienteDetalle && (() => {
            const totalEntregas = detalleEntregas.length;
            const totalLitros = detalleEntregas.reduce((s: number, e: any) => s + (e.litros || 0), 0);
            const totalVentas = detalleEntregas.reduce((s: number, e: any) => s + (e.total || 0), 0);
            const totalRecibido = detalleEntregas.reduce((s: number, e: any) => s + (e.montoRecibido || 0), 0);
            const totalPagosSueltos = detallePagos.reduce((s: number, p: any) => s + (p.monto || 0), 0);
            const deudaInicial = (clienteDetalle as any).deudaInicial || 0;
            const totalPorCobrar = deudaInicial + totalVentas - totalRecibido - totalPagosSueltos;
            const tieneDeuda = totalPorCobrar > 0.5; // tolerance
            // Solo mostrar saldo a favor si realmente hay ventas (totalVentas > 0)
            // Si totalVentas = 0 y hay pagos sueltos, esos pagos son un error, no saldo a favor
            const tieneSaldoFavor = totalPorCobrar < -0.5 && totalVentas > 0;
            const pedidosPendientes = detallePedidos.filter((p: any) => p.estado === "pendiente" || p.estado === "programado").length;

            // Última entrega (con pago)
            const entregasConFecha = [...detalleEntregas].sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
            const ultimaEntrega = entregasConFecha[0];
            const ultimaConPago = entregasConFecha.find((e: any) => e.montoRecibido > 0);
            const promedioLitros = totalEntregas > 0 ? totalLitros / totalEntregas : 0;
            const promedioMonto = totalEntregas > 0 ? totalVentas / totalEntregas : 0;
            const ultimaEntregaFecha = ultimaEntrega ? formatDate(ultimaEntrega.fecha) : "—";
            const ultimoPagoMonto = ultimaConPago ? ultimaConPago.montoRecibido : 0;
            const ultimoPagoFecha = ultimaConPago ? formatDate(ultimaConPago.fecha) : "—";
            const ultimoPagoMetodo = ultimaConPago
              ? (ultimaConPago.metodoPago === "efectivo" ? "Efectivo"
                : ultimaConPago.metodoPago === "transferencia" ? "Transferencia"
                : ultimaConPago.metodoPago === "mixto" ? "Mixto"
                : "Crédito")
              : "—";

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    {clienteDetalle.nombre}
                  </DialogTitle>
                  <DialogDescription>
                    {clienteDetalle.rut && `RUT: ${clienteDetalle.rut} · `}
                    {totalEntregas} entrega(s) · {pedidosPendientes} pedido(s) pendiente(s)
                  </DialogDescription>
                </DialogHeader>

                {/* Botón Deuda / Saldo — visible arriba, antes de las tabs */}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      setDeudaInicialMonto(String((clienteDetalle as any).deudaInicial || 0));
                      setDeudaInicialOpen(true);
                    }}
                  >
                    <Banknote className="mr-1 h-3 w-3" /> + Deuda / Saldo a favor
                  </Button>
                </div>

                {/* Deuda destacada (si existe) */}
                {tieneDeuda && (
                  <div className="flex items-center justify-between rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <div>
                        <p className="text-sm font-semibold text-red-900 dark:text-red-200">Deuda pendiente</p>
                        <p className="text-xs text-red-700 dark:text-red-300">
                          {deudaInicial > 0 ? `${formatCurrency(deudaInicial)} deuda anterior · ` : ""}
                          {totalVentas > 0 ? `${formatCurrency(totalVentas)} en ventas · ` : ""}
                          {totalRecibido > 0 ? `${formatCurrency(totalRecibido)} recibido · ` : ""}
                          {totalPagosSueltos > 0 ? `${formatCurrency(totalPagosSueltos)} en pagos recibidos` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
                        {formatCurrency(totalPorCobrar)}
                      </p>
                      <div className="mt-1 flex gap-1 justify-end">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => {
                            setPagoOpen(true);
                            setPagoMonto(String(Math.round(totalPorCobrar)));
                          }}
                        >
                          <Banknote className="mr-1 h-3 w-3" /> Cobrar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                          onClick={() => {
                            if (clienteDetalle) {
                              setEliminarDeudaOpen(true);
                            }
                          }}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {tieneSaldoFavor && (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                    <Banknote className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Saldo a favor del cliente</p>
                      <p className="text-lg font-bold tabular-nums text-blue-600 dark:text-blue-400">
                        {formatCurrency(Math.abs(totalPorCobrar))}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tabs internos */}
                <div className="flex items-center gap-1 overflow-x-auto rounded-lg bg-primary/10 p-1">
                  <Button size="sm" variant={detalleTab === "info" ? "default" : "ghost"} onClick={() => setDetalleTab("info")} className="h-9 shrink-0 font-semibold">
                    Info
                  </Button>
                  <Button size="sm" variant={detalleTab === "entregas" ? "default" : "ghost"} onClick={() => setDetalleTab("entregas")} className="h-9 shrink-0 font-semibold">
                    Entregas ({totalEntregas})
                  </Button>
                  <Button size="sm" variant={detalleTab === "pedidos" ? "default" : "ghost"} onClick={() => setDetalleTab("pedidos")} className="h-9 shrink-0 font-semibold">
                    Pedidos ({detallePedidos.length})
                  </Button>
                  <Button size="sm" variant={detalleTab === "pagos" ? "default" : "ghost"} onClick={() => setDetalleTab("pagos")} className="h-9 shrink-0 font-semibold">
                    Pagos ({detallePagos.length})
                  </Button>
                </div>

                {/* Contenido según tab */}
                {detalleLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : detalleTab === "info" ? (
                  <div className="space-y-3 text-sm">
                    {/* Datos de contacto */}
                    <div className="grid grid-cols-2 gap-2">
                      {clienteDetalle.telefono && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <a href={`tel:${clienteDetalle.telefono}`} className="hover:underline">{clienteDetalle.telefono}</a>
                        </div>
                      )}
                      {clienteDetalle.email && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{clienteDetalle.email}</span>
                        </div>
                      )}
                      {clienteDetalle.direccion && (
                        <div className="flex items-start gap-1.5 col-span-2">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                          <span>{clienteDetalle.direccion}</span>
                        </div>
                      )}
                      {clienteDetalle.zona && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <Badge variant="outline" className="text-[10px]">{clienteDetalle.zona}</Badge>
                        </div>
                      )}
                    </div>

                    {/* Precios */}
                    {(clienteDetalle.precioEfectivoPorLitro > 0 || clienteDetalle.precioTransferenciaPorLitro > 0) && (
                      <div className="flex flex-wrap gap-2">
                        {clienteDetalle.precioEfectivoPorLitro > 0 && (
                          <Badge variant="secondary" className="text-[11px]">
                            <Banknote className="mr-1 h-3 w-3" /> {formatCurrency(clienteDetalle.precioEfectivoPorLitro)}/L
                          </Badge>
                        )}
                        {clienteDetalle.precioTransferenciaPorLitro > 0 && (
                          <Badge variant="secondary" className="text-[11px]">
                            <Smartphone className="mr-1 h-3 w-3" /> {formatCurrency(clienteDetalle.precioTransferenciaPorLitro)}/L
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Acceso */}
                    {(clienteDetalle.requiereIngresoPropiedad || clienteDetalle.entregaDesdeAfuera || clienteDetalle.conexionExterna || clienteDetalle.requiereClientePresente === false) && (
                      <div className="flex flex-wrap gap-1">
                        {clienteDetalle.requiereIngresoPropiedad && <Badge variant="outline" className="text-[10px]"><DoorOpen className="mr-0.5 h-2.5 w-2.5" /> Ingreso</Badge>}
                        {clienteDetalle.entregaDesdeAfuera && <Badge variant="outline" className="text-[10px]"><Fence className="mr-0.5 h-2.5 w-2.5" /> Desde afuera</Badge>}
                        {clienteDetalle.conexionExterna && <Badge variant="outline" className="text-[10px] text-emerald-700"><KeyRound className="mr-0.5 h-2.5 w-2.5" /> Conexión</Badge>}
                        {clienteDetalle.requiereClientePresente === false && <Badge variant="outline" className="text-[10px] text-amber-700"><UserCheck className="mr-0.5 h-2.5 w-2.5" /> Sin presencia</Badge>}
                      </div>
                    )}

                    {/* Indicaciones de acceso */}
                    {clienteDetalle.indicacionesAcceso && (
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Indicaciones de acceso</p>
                        <p className="mt-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-2 text-xs text-amber-900 dark:text-amber-200 whitespace-pre-wrap">
                          {clienteDetalle.indicacionesAcceso}
                        </p>
                      </div>
                    )}

                    {/* Uso del agua */}
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Uso del agua</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-[11px]">
                          <Droplets className="mr-1 h-3 w-3" /> {labelUsoAgua(clienteDetalle.usoAgua || "consumo")}
                        </Badge>
                        {clienteDetalle.usoAguaNota && (
                          <span className="text-xs text-muted-foreground">{clienteDetalle.usoAguaNota}</span>
                        )}
                      </div>
                    </div>

                    {/* Estanques / Piscinas — colapsable, solo si hay info útil */}
                    {(() => {
                      let estanquesDetalle: { tipo: string; capacidad: string; nombre: string; ubicacion: string }[] = [];
                      try {
                        estanquesDetalle = clienteDetalle.estanquesJson ? JSON.parse(clienteDetalle.estanquesJson) : [];
                      } catch {}
                      if (estanquesDetalle.length === 0) return null;

                      const totalCap = estanquesDetalle.reduce((s, e) => s + (Number(e.capacidad) || 0), 0);
                      // Filtrar solo los que tienen info útil (capacidad, nombre o ubicación)
                      const estanquesUtiles = estanquesDetalle.filter(e => (e.capacidad && Number(e.capacidad) > 0) || e.nombre?.trim() || e.ubicacion?.trim());

                      // Si ninguno tiene info útil, mostrar resumen compacto de una línea
                      if (estanquesUtiles.length === 0) {
                        return (
                          <div className="rounded-lg bg-muted/30 p-2 text-xs">
                            <span className="text-muted-foreground">Estanques: </span>
                            <span>{estanquesDetalle.length} × {labelTipoEstanque(estanquesDetalle[0].tipo)}</span>
                            {estanquesDetalle.some(e => e.tipo !== estanquesDetalle[0].tipo) && " (varios tipos)"}
                          </div>
                        );
                      }

                      // Si hay info útil, mostrar lista pero colapsable
                      return (
                        <details className="rounded-lg border border-border p-2">
                          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                            Estanques y piscinas ({estanquesDetalle.length})
                            {totalCap > 0 && ` · total: ${formatNumber(totalCap, 0)} L`}
                          </summary>
                          <div className="mt-2 space-y-1">
                            {estanquesUtiles.map((est, i) => (
                              <div key={i} className="rounded-lg border border-border p-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{est.nombre || labelTipoEstanque(est.tipo)}</span>
                                  {est.capacidad && <Badge variant="outline" className="text-[10px]">{formatNumber(Number(est.capacidad), 0)} L</Badge>}
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-muted-foreground">
                                  <span>{labelTipoEstanque(est.tipo)}</span>
                                  {est.ubicacion && <span>· {est.ubicacion}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      );
                    })()}

                    {/* Nota */}
                    {clienteDetalle.nota && (
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Nota</p>
                        <p className="mt-1 rounded-lg bg-muted/40 p-2 text-xs">{clienteDetalle.nota}</p>
                      </div>
                    )}

                    {/* Resumen de actividad */}
                    {totalEntregas > 0 && (
                      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                        <div className="rounded-lg bg-muted/30 p-2 text-center">
                          <p className="text-[10px] uppercase text-muted-foreground">Litros totales</p>
                          <p className="text-lg font-bold tabular-nums">{formatNumber(totalLitros, 0)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-2 text-center">
                          <p className="text-[10px] uppercase text-muted-foreground">Total ventas</p>
                          <p className="text-sm font-bold tabular-nums">{formatCurrency(totalVentas)}</p>
                        </div>
                        <div className="rounded-lg bg-primary/5 border border-primary/20 p-2 text-center">
                          <p className="text-[10px] uppercase text-muted-foreground">Promedio L/entrega</p>
                          <p className="text-lg font-bold tabular-nums text-primary">{formatNumber(promedioLitros, 0)} L</p>
                        </div>
                        <div className="rounded-lg bg-primary/5 border border-primary/20 p-2 text-center">
                          <p className="text-[10px] uppercase text-muted-foreground">Promedio $/entrega</p>
                          <p className="text-sm font-bold tabular-nums text-primary">{formatCurrency(promedioMonto)}</p>
                        </div>
                      </div>
                    )}

                    {/* Última entrega */}
                    {ultimaEntrega && (
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase text-muted-foreground">
                          <Truck className="h-3 w-3" /> Última entrega
                        </p>
                        <div className="space-y-0.5 text-sm">
                          <p className="font-medium">{ultimaEntregaFecha}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span><Droplets className="mr-0.5 inline h-3 w-3" />{formatNumber(ultimaEntrega.litros, 0)} L</span>
                            <span>Total: <strong className="text-foreground tabular-nums">{formatCurrency(ultimaEntrega.total)}</strong></span>
                          </div>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            ultimaEntrega.estadoPago === "pagado" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : ultimaEntrega.estadoPago === "parcial" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-muted text-muted-foreground"
                          }`}>
                            {ultimaEntrega.estadoPago}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Botones de acción */}
                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                      {onAgendarPedido && (
                        <Button size="sm" onClick={() => { onAgendarPedido(clienteDetalle.id); setClienteDetalle(null); }}>
                          <ClipboardList className="mr-1 h-4 w-4" /> Agendar pedido
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPagoOpen(true);
                          if (!tieneDeuda) setPagoMonto("");
                        }}
                      >
                        <Banknote className="mr-1 h-4 w-4" /> Registrar pago
                      </Button>
                      {!readOnly && (
                        <Button size="sm" variant="outline" onClick={() => { abrirEditar(clienteDetalle); setClienteDetalle(null); }}>
                          <Pencil className="mr-1 h-4 w-4" /> Editar ficha
                        </Button>
                      )}
                      {/* Chofer preferido puede soltar al cliente (con o sin reemplazo) */}
                      {!isDueno && clienteDetalle.choferPreferidoId === currentUserId && (
                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                          <div className="flex items-center gap-2">
                            <select
                              value={reemplazoChoferId || "__ninguno"}
                              onChange={(e) => setReemplazoChoferId(e.target.value === "__ninguno" ? "" : e.target.value)}
                              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            >
                              <option value="__ninguno">Sin reemplazo (al pool)</option>
                              {choferes.filter(c => c.id !== currentUserId).map((c) => (
                                <option key={c.id} value={c.id}>Reemplazo: {c.nombre}</option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:text-amber-300"
                              disabled={soltandoCliente}
                              onClick={() => soltarCliente(clienteDetalle.id, clienteDetalle.nombre)}
                            >
                              <UserX className="mr-1 h-4 w-4" /> {soltandoCliente ? "Soltando…" : "Soltar cliente"}
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Sin reemplazo, los pedidos van al pool visible para todos. Con reemplazo, el nuevo chofer tiene prioridad.
                          </p>
                        </div>
                      )}
                      {/* Dueño puede cambiar chofer preferido */}
                      {isDueno && choferes.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">Chofer pref.:</Label>
                          <select
                            value={clienteDetalle.choferPreferidoId || "__ninguno"}
                            onChange={(e) => cambiarChoferPreferido(clienteDetalle.id, e.target.value === "__ninguno" ? null : e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          >
                            <option value="__ninguno">— Sin preferido —</option>
                            {choferes.map((c) => (
                              <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {clienteDetalle.lat != null && clienteDetalle.lng != null && (
                        <a
                          href={`https://www.google.com/maps?q=${clienteDetalle.lat},${clienteDetalle.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="outline">
                            <Navigation className="mr-1 h-4 w-4" /> Cómo llegar
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                ) : detalleTab === "entregas" ? (
                  detalleEntregas.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No hay entregas registradas para este cliente.</p>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {detalleEntregas.map((e: any) => (
                        <div key={e.id} className="rounded-lg border border-border p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{formatDate(e.fecha)}</span>
                              <span className="text-xs text-muted-foreground">{formatTime(e.fecha)}</span>
                              {e.vuelta && <Badge variant="outline" className="text-[10px]">Vuelta #{e.vuelta.numero}</Badge>}
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              e.estadoPago === "pagado" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : e.estadoPago === "parcial" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                              : "bg-muted text-muted-foreground"
                            }`}>
                              {labelEstadoPago(e.estadoPago)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span><Droplets className="mr-0.5 inline h-3 w-3" />{formatNumber(e.litros, 0)} L</span>
                            <span>·</span>
                            <span>{labelMetodoPago(e.metodoPago)}</span>
                            <span>·</span>
                            <span>Total: <strong className="text-foreground tabular-nums">{formatCurrency(e.total)}</strong></span>
                            {e.montoRecibido > 0 && (
                              <>
                                <span>·</span>
                                <span>Recibido: <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(e.montoRecibido)}</strong></span>
                              </>
                            )}
                          </div>
                          {e.total - e.montoRecibido > 0 && (
                            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                              Saldo pendiente: {formatCurrency(e.total - e.montoRecibido)}
                            </p>
                          )}

                          {/* Detalle de estanques */}
                          {e.detalleEstanquesJson && (() => {
                            let estanques: any[] = [];
                            try { estanques = JSON.parse(e.detalleEstanquesJson); } catch { return null; }
                            if (estanques.length === 0) return null;
                            return (
                              <div className="mt-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-2 space-y-1">
                                <p className="text-[10px] font-medium text-amber-900 dark:text-amber-200">Detalle por estanque:</p>
                                {estanques.map((est, i) => (
                                  <div key={i} className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-amber-900 dark:text-amber-200">
                                        {est.nombre}: {formatNumber(est.litros, 0)} L · {labelMetodoPago(est.metodoPago)}
                                      </span>
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <span className="tabular-nums">{formatCurrency(est.total)}</span>
                                        {est.montoRecibido > 0 && <span className="text-emerald-600">✓{formatCurrency(est.montoRecibido)}</span>}
                                        {est.total - est.montoRecibido > 0 && <span className="text-amber-600">saldo {formatCurrency(est.total - est.montoRecibido)}</span>}
                                      </div>
                                    </div>
                                    {/* Foto del medidor por estanque */}
                                    {est.fotoUrl && (
                                      <a href={est.fotoUrl} target="_blank" rel="noopener noreferrer">
                                        <img src={est.fotoUrl} alt="Medidor" className="h-16 rounded border border-amber-200" />
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}

                          {/* Foto del medidor */}
                          {e.fotoMedidorUrl && (
                            <div className="mt-2">
                              <a href={e.fotoMedidorUrl} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={e.fotoMedidorUrl}
                                  alt="Foto del medidor"
                                  className="max-h-32 rounded-lg border border-border hover:opacity-80 transition-opacity"
                                />
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : detalleTab === "pedidos" ? (
                  // Tab pedidos
                  detallePedidos.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No hay pedidos registrados para este cliente.</p>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {detallePedidos.map((p: any) => (
                        <div key={p.id} className="rounded-lg border border-border p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{formatDate(p.creadoEn)}</span>
                              <span className="text-xs text-muted-foreground">{formatTime(p.creadoEn)}</span>
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              p.estado === "entregado" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : p.estado === "pendiente" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                              : p.estado === "cancelado" ? "bg-muted text-muted-foreground"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                            }`}>
                              {p.estado}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span><Droplets className="mr-0.5 inline h-3 w-3" />{formatNumber(p.litrosSolicitados, 0)} L</span>
                            <span>·</span>
                            <span>{labelMetodoPago(p.metodoPagoPreferido)}</span>
                            {p.fechaSolicitada && (
                              <>
                                <span>·</span>
                                <span>Entrega: {formatDate(p.fechaSolicitada)}</span>
                              </>
                            )}
                            {p.pedidoRecurrenteId && <Badge variant="outline" className="text-[10px]">Recurrente</Badge>}
                          </div>
                          {p.entrega && (
                            <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                              ✓ Entregado: {formatNumber(p.entrega.litros, 0)} L · {formatCurrency(p.entrega.total)}
                              {p.entrega.vuelta && <span> · Vuelta #{p.entrega.vuelta.numero}</span>}
                            </div>
                          )}
                          {p.nota && (
                            <p className="mt-1 text-xs text-muted-foreground italic">"{p.nota}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : detalleTab === "pagos" ? (
                  // Tab pagos
                  detallePagos.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No hay pagos sin entrega registrados.</p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {detallePagos.map((p: any) => (
                        <div key={p.id} className="rounded-lg border border-border p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{formatDate(p.fecha)}</span>
                            <div className="flex items-center gap-1">
                              <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                +{formatCurrency(p.monto)}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => setPagoEditando(p)}
                                title="Editar pago"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-red-600 hover:text-red-700"
                                onClick={async () => {
                                  if (!confirm("¿Eliminar este pago?")) return;
                                  try {
                                    await apiDelete(`/api/akuosplash/pagos/${p.id}`);
                                    toast.success("Pago eliminado");
                                    if (clienteDetalle) abrirDetalle(clienteDetalle);
                                    onRefresh();
                                  } catch (e) {
                                    toast.error("No se pudo eliminar");
                                  }
                                }}
                                title="Eliminar pago"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-[10px]">
                              {p.metodoPago === "efectivo" ? "Efectivo" : p.metodoPago === "transferencia" ? "Transferencia" : "Mixto"}
                            </Badge>
                            {p.chofer && (
                              <Badge variant="outline" className="text-[10px] gap-0.5">
                                <User className="h-2 w-2" /> {p.chofer.nombre}
                              </Badge>
                            )}
                            {!p.chofer && (
                              <Badge variant="outline" className="text-[10px] gap-0.5 text-amber-700 dark:text-amber-300">
                                <User className="h-2 w-2" /> Admin
                              </Badge>
                            )}
                            {p.nota && <span className="truncate">{p.nota}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : null}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
