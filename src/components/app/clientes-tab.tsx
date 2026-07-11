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
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { formatCurrency, formatNumber, formatDate, USOS_AGUA, TIPOS_ESTANQUE, labelUsoAgua, labelTipoEstanque } from "@/lib/helpers";
import { MapPicker } from "./map-picker";

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
}

interface ClientesTabProps {
  refreshKey: number;
  onRefresh: () => void;
  readOnly?: boolean;
  choferes?: { id: string; nombre: string; email: string }[];
  onAgendarPedido?: (clienteId: string) => void;
}

export function ClientesTab({ refreshKey, onRefresh, readOnly = false, choferes = [], onAgendarPedido }: ClientesTabProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [borrando, setBorrando] = useState<Cliente | null>(null);

  // Estado para detalle del cliente
  const [clienteDetalle, setClienteDetalle] = useState<Cliente | null>(null);
  const [detalleTab, setDetalleTab] = useState<"info" | "entregas" | "pedidos">("info");
  const [detalleEntregas, setDetalleEntregas] = useState<any[]>([]);
  const [detallePedidos, setDetallePedidos] = useState<any[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);

  // Campos del formulario
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [zona, setZona] = useState("");
  const [precioEfectivo, setPrecioEfectivo] = useState("");
  const [precioTransferencia, setPrecioTransferencia] = useState("");
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
  const [estanques, setEstanques] = useState<{ tipo: string; capacidad: string; nombre: string; ubicacion: string }[]>([]);
  const [choferPreferidoId, setChoferPreferidoId] = useState<string>("");
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ clientes: Cliente[] }>("/api/clientes");
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
      setEstanques(c.estanquesJson ? JSON.parse(c.estanquesJson) : []);
    } catch { setEstanques([]); }
    setChoferPreferidoId(c.choferPreferidoId ?? "");
    setFormOpen(true);
  }

  // Abrir detalle del cliente con su historial
  async function abrirDetalle(c: Cliente) {
    setClienteDetalle(c);
    setDetalleTab("info");
    setDetalleLoading(true);
    try {
      const [ents, peds] = await Promise.all([
        apiGet<{ entregas: any[] }>(`/api/entregas?period=todo&clienteId=${c.id}`),
        apiGet<{ pedidos: any[] }>(`/api/pedidos?clienteId=${c.id}`),
      ]);
      setDetalleEntregas(ents.entregas || []);
      setDetallePedidos(peds.pedidos || []);
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
        await apiPatch(`/api/clientes/${editando.id}`, payload);
        toast.success("Cliente actualizado");
      } else {
        await apiPost("/api/clientes", payload);
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
      await apiDelete(`/api/clientes/${c.id}`);
      toast.success("Cliente eliminado");
      setBorrando(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
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
              ? "Catálogo de clientes del dueño (solo lectura)."
              : "Catálogo de clientes frecuentes con precios por método de pago y por zona."}
          </p>
        </div>
        {!readOnly && (
          <Button onClick={abrirNuevo} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Nuevo cliente
          </Button>
        )}
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
            <Card key={c.id} className="flex flex-col cursor-pointer hover:shadow-md transition-shadow" onClick={() => abrirDetalle(c)}>
              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.nombre}</p>
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
                {(c.precioEfectivoPorLitro > 0 || c.precioTransferenciaPorLitro > 0) && (
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
                <Input
                  id="nombreCliente"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  required
                />
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
              <div className="space-y-2">
                <Label htmlFor="direccionCliente">Dirección</Label>
                <Input
                  id="direccionCliente"
                  value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, comuna"
              />
            </div>
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
                <Select value={usoAgua} onValueChange={setUsoAgua}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USOS_AGUA.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        <div className="flex flex-col">
                          <span>{u.label}</span>
                          <span className="text-xs text-muted-foreground">{u.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  onClick={() => setEstanques([...estanques, { tipo: "estanque", capacidad: "", nombre: "", ubicacion: "" }])}
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
                        <Select value={est.tipo} onValueChange={(v) => setEstanques(estanques.map((e, j) => j === i ? { ...e, tipo: v } : e))}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIPOS_ESTANQUE.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={est.capacidad}
                          onChange={(e) => setEstanques(estanques.map((e, j) => j === i ? { ...e, capacidad: e.target.value } : e))}
                          placeholder="Capacidad (L)"
                          className="h-8 text-xs"
                        />
                      </div>
                      <Input
                        value={est.nombre}
                        onChange={(e) => setEstanques(estanques.map((e, j) => j === i ? { ...e, nombre: e.target.value } : e))}
                        placeholder="Nombre/identificador (ej. Estanque principal, Piscina)"
                        className="h-8 text-xs"
                      />
                      <Input
                        value={est.ubicacion}
                        onChange={(e) => setEstanques(estanques.map((e, j) => j === i ? { ...e, ubicacion: e.target.value } : e))}
                        placeholder="Ubicación (ej. Patio trasero, junto al quincho)"
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Total capacidad */}
              {estanques.length > 0 && (() => {
                const total = estanques.reduce((s, e) => s + (Number(e.capacidad) || 0), 0);
                return total > 0 ? (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-2 text-center text-sm">
                    <span className="text-muted-foreground">Capacidad total: </span>
                    <strong className="tabular-nums text-primary">{formatNumber(total, 0)} L</strong>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Chofer preferido */}
            {choferes.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="choferPreferido">Chofer preferido (opcional)</Label>
                <Select value={choferPreferidoId || "__ninguno"} onValueChange={setChoferPreferidoId}>
                  <SelectTrigger id="choferPreferido">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ninguno">— Sin preferido —</SelectItem>
                    {choferes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        <DialogContent className="max-h-[95vh] w-[95vw] max-w-2xl overflow-y-auto">
          {clienteDetalle && (() => {
            const totalEntregas = detalleEntregas.length;
            const totalLitros = detalleEntregas.reduce((s: number, e: any) => s + (e.litros || 0), 0);
            const totalVentas = detalleEntregas.reduce((s: number, e: any) => s + (e.total || 0), 0);
            const totalRecibido = detalleEntregas.reduce((s: number, e: any) => s + (e.montoRecibido || 0), 0);
            const totalPorCobrar = totalVentas - totalRecibido;
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

                {/* Resumen rápido */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">Entregas</p>
                    <p className="text-lg font-bold">{totalEntregas}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">Litros totales</p>
                    <p className="text-lg font-bold tabular-nums">{formatNumber(totalLitros, 0)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">Total ventas</p>
                    <p className="text-sm font-bold tabular-nums">{formatCurrency(totalVentas)}</p>
                  </div>
                  <div className={`rounded-lg p-2 text-center ${totalPorCobrar > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"}`}>
                    <p className="text-[10px] uppercase text-muted-foreground">Por cobrar</p>
                    <p className={`text-sm font-bold tabular-nums ${totalPorCobrar > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {formatCurrency(totalPorCobrar)}
                    </p>
                  </div>
                </div>

                {/* Última entrega y último pago */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase text-muted-foreground">
                      <Truck className="h-3 w-3" /> Última entrega
                    </p>
                    {ultimaEntrega ? (
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
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin entregas</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase text-muted-foreground">
                      <Banknote className="h-3 w-3" /> Último pago
                    </p>
                    {ultimaConPago ? (
                      <div className="space-y-0.5 text-sm">
                        <p className="font-medium">{ultimoPagoFecha}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Monto: <strong className="text-foreground tabular-nums">{formatCurrency(ultimoPagoMonto)}</strong></span>
                          <span className="rounded bg-muted px-1.5 py-0.5">{ultimoPagoMetodo}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin pagos registrados</p>
                    )}
                  </div>
                </div>

                {/* Promedios */}
                {totalEntregas > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-2 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">Promedio litros/entrega</p>
                      <p className="text-lg font-bold tabular-nums text-primary">{formatNumber(promedioLitros, 0)} L</p>
                    </div>
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-2 text-center">
                      <p className="text-[10px] uppercase text-muted-foreground">Promedio monto/entrega</p>
                      <p className="text-lg font-bold tabular-nums text-primary">{formatCurrency(promedioMonto)}</p>
                    </div>
                  </div>
                )}

                {/* Botones de acción */}
                <div className="flex flex-wrap gap-2">
                  {onAgendarPedido && (
                    <Button size="sm" onClick={() => { onAgendarPedido(clienteDetalle.id); setClienteDetalle(null); }}>
                      <ClipboardList className="mr-1 h-4 w-4" /> Agendar pedido
                    </Button>
                  )}
                  {!readOnly && (
                    <Button size="sm" variant="outline" onClick={() => { abrirEditar(clienteDetalle); setClienteDetalle(null); }}>
                      <Pencil className="mr-1 h-4 w-4" /> Editar ficha
                    </Button>
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

                {/* Tabs internos */}
                <div className="flex gap-1 rounded-lg bg-muted/40 p-1">
                  <Button size="sm" variant={detalleTab === "info" ? "default" : "ghost"} onClick={() => setDetalleTab("info")} className="h-7">
                    Info
                  </Button>
                  <Button size="sm" variant={detalleTab === "entregas" ? "default" : "ghost"} onClick={() => setDetalleTab("entregas")} className="h-7">
                    Entregas ({totalEntregas})
                  </Button>
                  <Button size="sm" variant={detalleTab === "pedidos" ? "default" : "ghost"} onClick={() => setDetalleTab("pedidos")} className="h-7">
                    Pedidos ({detallePedidos.length})
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

                    {/* Estanques / Piscinas */}
                    {(() => {
                      let estanquesDetalle: { tipo: string; capacidad: string; nombre: string; ubicacion: string }[] = [];
                      try {
                        estanquesDetalle = clienteDetalle.estanquesJson ? JSON.parse(clienteDetalle.estanquesJson) : [];
                      } catch {}
                      if (estanquesDetalle.length === 0) return null;
                      const totalCap = estanquesDetalle.reduce((s, e) => s + (Number(e.capacidad) || 0), 0);
                      return (
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">
                            Estanques y piscinas {totalCap > 0 && `(total: ${formatNumber(totalCap, 0)} L)`}
                          </p>
                          <div className="mt-1 space-y-1">
                            {estanquesDetalle.map((est, i) => (
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
                        </div>
                      );
                    })()}

                    {/* Nota */}
                    {clienteDetalle.nota && (
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">Nota</p>
                        <p className="mt-1 rounded-lg bg-muted/40 p-2 text-xs">{clienteDetalle.nota}</p>
                      </div>
                    )}
                  </div>
                ) : detalleTab === "entregas" ? (
                  detalleEntregas.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No hay entregas registradas para este cliente.</p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {detalleEntregas.map((e: any) => (
                        <div key={e.id} className="rounded-lg border border-border p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="font-medium">{formatDate(e.fecha)}</span>
                              {e.vuelta && <Badge variant="outline" className="ml-2 text-[10px]">Vuelta #{e.vuelta.numero}</Badge>}
                            </div>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              e.estadoPago === "pagado" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : e.estadoPago === "parcial" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                              : "bg-muted text-muted-foreground"
                            }`}>
                              {e.estadoPago}
                            </span>
                          </div>
                          <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                            <span><Droplets className="mr-0.5 inline h-3 w-3" />{formatNumber(e.litros, 0)} L</span>
                            <span>Total: <strong className="text-foreground tabular-nums">{formatCurrency(e.total)}</strong></span>
                            <span>Recibido: <strong className="text-foreground tabular-nums">{formatCurrency(e.montoRecibido)}</strong></span>
                          </div>
                          {e.total - e.montoRecibido > 0 && (
                            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                              Saldo: {formatCurrency(e.total - e.montoRecibido)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  // Tab pedidos
                  detallePedidos.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No hay pedidos registrados para este cliente.</p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {detallePedidos.map((p: any) => (
                        <div key={p.id} className="rounded-lg border border-border p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{formatDate(p.creadoEn)}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              p.estado === "entregado" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : p.estado === "pendiente" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                              : p.estado === "cancelado" ? "bg-muted text-muted-foreground"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                            }`}>
                              {p.estado}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            <span><Droplets className="mr-0.5 inline h-3 w-3" />{formatNumber(p.litrosSolicitados, 0)} L</span>
                            {p.fechaSolicitada && <span>📅 {formatDate(p.fechaSolicitada)}</span>}
                            {p.pedidoRecurrenteId && <Badge variant="outline" className="text-[10px]">Recurrente</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
