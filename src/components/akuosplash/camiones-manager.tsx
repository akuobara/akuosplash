"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  Checkbox,
} from "@/components/ui/checkbox";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Truck,
  Droplets,
  User,
  Users,
  ExternalLink,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { apiGet, apiPost, apiPatch, apiDelete, uploadFile } from "@/components/akuosplash/akuosplash-api-client";
import { formatNumber } from "@/components/akuosplash/akuosplash-helpers";

interface Chofer {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  role: string;
  activo: boolean;
  asignadoEn?: string;
}

interface Camion {
  id: string;
  nombre: string;
  patente: string | null;
  capacidad: number;
  activo: boolean;
  creadoEn: string;
  choferes?: Chofer[];
  _count?: { vueltas: number };
  marca?: string | null;
  modelo?: string | null;
  anio?: number | null;
  color?: string | null;
  numeroMotor?: string | null;
  numeroChasis?: string | null;
  permisoCirculacionVencimiento?: string | null;
  permisoCirculacionFotoUrl?: string | null;
  revisionTecnicaVencimiento?: string | null;
  revisionTecnicaFotoUrl?: string | null;
  seguroVencimiento?: string | null;
  seguroFotoUrl?: string | null;
  seguroCompania?: string | null;
  seguroNumero?: string | null;
}

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  role: string;
  activo: boolean;
}

interface CamionesManagerProps {
  refreshKey: number;
  onRefresh: () => void;
  onCamionesChange: (camiones: Camion[]) => void;
  isDueno: boolean;
}

export function CamionesManager({ refreshKey, onRefresh, onCamionesChange, isDueno }: CamionesManagerProps) {
  const router = useRouter();
  const [camiones, setCamiones] = useState<Camion[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Camion | null>(null);
  const [borrando, setBorrando] = useState<Camion | null>(null);
  const [asignando, setAsignando] = useState<Camion | null>(null);

  // Campos del formulario
  const [nombre, setNombre] = useState("");
  const [patente, setPatente] = useState("");
  const [capacidad, setCapacidad] = useState("17000");
  const [activo, setActivo] = useState(true);
  const [autoAsignarDueno, setAutoAsignarDueno] = useState(true);
  const [saving, setSaving] = useState(false);

  // Datos del vehículo
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [anio, setAnio] = useState("");
  const [color, setColor] = useState("");
  const [numeroMotor, setNumeroMotor] = useState("");
  const [numeroChasis, setNumeroChasis] = useState("");

  // Documentos
  const [permisoCircVenc, setPermisoCircVenc] = useState("");
  const [revisionTecVenc, setRevisionTecVenc] = useState("");
  const [seguroVenc, setSeguroVenc] = useState("");
  const [seguroCompania, setSeguroCompania] = useState("");
  const [seguroNumero, setSeguroNumero] = useState("");
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [permisoCircFoto, setPermisoCircFoto] = useState<string | null>(null);
  const [revisionTecFoto, setRevisionTecFoto] = useState<string | null>(null);
  const [seguroFoto, setSeguroFoto] = useState<string | null>(null);

  // Choferes seleccionados para asignar
  const [choferesSeleccionados, setChoferesSeleccionados] = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ camiones: Camion[] }>("/api/akuosplash/vehiculos");
      setCamiones(data.camiones);
      onCamionesChange(data.camiones);
      if (isDueno) {
        const userData = await apiGet<{ usuarios: Usuario[] }>("/api/akuosplash/usuarios");
        setUsuarios(userData.usuarios);
      }
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los camiones");
    } finally {
      setLoading(false);
    }
  }, [onCamionesChange, isDueno]);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  function abrirNuevo() {
    setEditando(null);
    setNombre(""); setPatente(""); setCapacidad("17000"); setActivo(true); setAutoAsignarDueno(true);
    setMarca(""); setModelo(""); setAnio(""); setColor(""); setNumeroMotor(""); setNumeroChasis("");
    setPermisoCircVenc(""); setRevisionTecVenc(""); setSeguroVenc(""); setSeguroCompania(""); setSeguroNumero("");
    setPermisoCircFoto(null); setRevisionTecFoto(null); setSeguroFoto(null);
    setFormOpen(true);
  }

  function abrirEditar(c: Camion) {
    setEditando(c);
    setNombre(c.nombre); setPatente(c.patente ?? ""); setCapacidad(String(c.capacidad)); setActivo(c.activo);
    setMarca(c.marca ?? ""); setModelo(c.modelo ?? ""); setAnio(c.anio ? String(c.anio) : ""); setColor(c.color ?? "");
    setNumeroMotor(c.numeroMotor ?? ""); setNumeroChasis(c.numeroChasis ?? "");
    setPermisoCircVenc(c.permisoCirculacionVencimiento ? c.permisoCirculacionVencimiento.split("T")[0] : "");
    setRevisionTecVenc(c.revisionTecnicaVencimiento ? c.revisionTecnicaVencimiento.split("T")[0] : "");
    setSeguroVenc(c.seguroVencimiento ? c.seguroVencimiento.split("T")[0] : "");
    setSeguroCompania(c.seguroCompania ?? ""); setSeguroNumero(c.seguroNumero ?? "");
    setPermisoCircFoto(c.permisoCirculacionFotoUrl ?? null);
    setRevisionTecFoto(c.revisionTecnicaFotoUrl ?? null);
    setSeguroFoto(c.seguroFotoUrl ?? null);
    setFormOpen(true);
  }

  function abrirAsignar(c: Camion) {
    setAsignando(c);
    setChoferesSeleccionados(new Set((c.choferes ?? []).map((ch) => ch.id)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    const capacidadNum = Number(capacidad) || 0;
    if (capacidadNum <= 0) {
      toast.error("La capacidad debe ser mayor a 0");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        nombre: nombre.trim(),
        patente: patente.trim() || null,
        capacidad: capacidadNum,
        activo,
        autoAsignarDueno: !editando && autoAsignarDueno,
        marca: marca.trim() || null,
        modelo: modelo.trim() || null,
        anio: anio ? Number(anio) : null,
        color: color.trim() || null,
        numeroMotor: numeroMotor.trim() || null,
        numeroChasis: numeroChasis.trim() || null,
        permisoCirculacionVencimiento: permisoCircVenc || null,
        permisoCirculacionFotoUrl: permisoCircFoto,
        revisionTecnicaVencimiento: revisionTecVenc || null,
        revisionTecnicaFotoUrl: revisionTecFoto,
        seguroVencimiento: seguroVenc || null,
        seguroFotoUrl: seguroFoto,
        seguroCompania: seguroCompania.trim() || null,
        seguroNumero: seguroNumero.trim() || null,
      };
      if (editando) {
        await apiPatch(`/api/akuosplash/vehiculos/${editando.id}`, payload);
        toast.success("Camión actualizado");
      } else {
        await apiPost("/api/akuosplash/vehiculos", payload);
        toast.success("Camión creado");
      }
      setFormOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleBorrar(c: Camion) {
    try {
      await apiDelete(`/api/akuosplash/vehiculos/${c.id}`);
      toast.success("Camión eliminado");
      setBorrando(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  async function guardarAsignacion() {
    if (!asignando) return;

    const actuales = new Set((asignando.choferes ?? []).map((ch) => ch.id));
    const agregar = [...choferesSeleccionados].filter((id) => !actuales.has(id));
    const quitar = [...actuales].filter((id) => !choferesSeleccionados.has(id));

    try {
      await Promise.all([
        ...agregar.map((choferId) =>
          apiPost(`/api/akuosplash/vehiculos/${asignando.id}/choferes`, { choferId })
        ),
        ...quitar.map((choferId) =>
          apiDelete(`/api/akuosplash/vehiculos/${asignando.id}/choferes?choferId=${choferId}`)
        ),
      ]);
      toast.success("Choferes asignados");
      setAsignando(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo asignar");
    }
  }

  function toggleChofer(id: string) {
    setChoferesSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Camiones ({camiones.length})</CardTitle>
          </div>
          {isDueno && (
            <Button onClick={abrirNuevo} size="sm" variant="outline">
              <Plus className="mr-1 h-4 w-4" /> Agregar
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Cada camión tiene su propia capacidad y choferes asignados.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : camiones.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No hay camiones. {isDueno && "Agrega el primero."}
          </div>
        ) : (
          <ul className="space-y-2">
            {camiones.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="font-medium text-left hover:text-primary hover:underline"
                        onClick={() => router.push(`/camiones/${c.id}`)}
                      >
                        {c.nombre}
                      </button>
                      {c.patente && (
                        <Badge variant="outline" className="text-[10px]">{c.patente}</Badge>
                      )}
                      {c.activo ? (
                        <Badge variant="secondary" className="text-[10px] text-emerald-700 dark:text-emerald-300">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <Droplets className="mr-1 inline h-3 w-3" />
                      Capacidad: <strong>{formatNumber(c.capacidad, 0)} L</strong>
                      {c._count && c._count.vueltas > 0 && ` · ${c._count.vueltas} vuelta(s)`}
                      {c.marca && ` · ${c.marca}${c.modelo ? ` ${c.modelo}` : ""}${c.anio ? ` ${c.anio}` : ""}`}
                    </p>
                    {/* Badges de documentos */}
                    {(() => {
                      const hoy = new Date();
                      const vencidos: string[] = [];
                      const porVencer: string[] = [];
                      const checkDoc = (label: string, fecha?: string | null) => {
                        if (!fecha) return;
                        const venc = new Date(fecha);
                        const dias = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                        if (dias < 0) vencidos.push(label);
                        else if (dias <= 30) porVencer.push(`${label} (${dias}d)`);
                      };
                      checkDoc("Perm. circ.", c.permisoCirculacionVencimiento);
                      checkDoc("Rev. técnica", c.revisionTecnicaVencimiento);
                      checkDoc("Seguro", c.seguroVencimiento);
                      if (vencidos.length === 0 && porVencer.length === 0) return null;
                      return (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {vencidos.length > 0 && (
                            <Badge variant="outline" className="text-[10px] text-red-600 border-red-300 dark:border-red-800">
                              ⚠ {vencidos.join(", ")} vencido(s)
                            </Badge>
                          )}
                          {porVencer.length > 0 && (
                            <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 dark:border-amber-700 dark:text-amber-300">
                              ⚠ {porVencer.join(", ")} por vencer
                            </Badge>
                          )}
                        </div>
                      );
                    })()}
                    {/* Choferes asignados */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {(c.choferes ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin choferes asignados</span>
                      ) : (
                        (c.choferes ?? []).map((ch) => (
                          <Badge key={ch.id} variant="outline" className="text-[10px] gap-1">
                            <User className="h-2.5 w-2.5" />
                            {ch.nombre}
                            {ch.role === "dueno" && " (dueño)"}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => router.push(`/camiones/${c.id}`)}
                    >
                      <ExternalLink className="mr-1 h-3 w-3" /> Ficha
                    </Button>
                    {isDueno && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/camiones/${c.id}`)}>
                          <ExternalLink className="mr-2 h-4 w-4" /> Ver ficha
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => abrirAsignar(c)}>
                          <Users className="mr-2 h-4 w-4" /> Asignar choferes
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {/* Formulario crear/editar camión */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[95vh] w-[95vw] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar camión" : "Nuevo camión"}</DialogTitle>
            <DialogDescription>
              Datos del vehículo y documentos. Los documentos vencidos mostrarán una advertencia.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {/* Datos básicos */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Datos básicos</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="camionNombre" className="text-xs">Nombre / alias *</Label>
                  <Input id="camionNombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Camión grande" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="camionPatente" className="text-xs">Patente</Label>
                  <Input id="camionPatente" value={patente} onChange={(e) => setPatente(e.target.value.toUpperCase())} placeholder="ABCD12" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="camionCapacidad" className="text-xs">Capacidad (litros) *</Label>
                  <Input id="camionCapacidad" type="number" value={capacidad} onChange={(e) => setCapacidad(e.target.value)} placeholder="17000" required />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-2">
                  <Label htmlFor="camionActivo" className="text-xs">Activo</Label>
                  <Switch id="camionActivo" checked={activo} onCheckedChange={setActivo} />
                </div>
              </div>
            </div>

            {/* Datos del vehículo */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Datos del vehículo</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="camionMarca" className="text-xs">Marca</Label>
                  <Input id="camionMarca" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ford" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="camionModelo" className="text-xs">Modelo</Label>
                  <Input id="camionModelo" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="F-1000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="camionAnio" className="text-xs">Año</Label>
                  <Input id="camionAnio" type="number" value={anio} onChange={(e) => setAnio(e.target.value)} placeholder="2015" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="camionColor" className="text-xs">Color</Label>
                  <Input id="camionColor" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Azul" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="camionMotor" className="text-xs">N° Motor</Label>
                  <Input id="camionMotor" value={numeroMotor} onChange={(e) => setNumeroMotor(e.target.value)} placeholder="Motor123" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="camionChasis" className="text-xs">N° Chasis/VIN</Label>
                  <Input id="camionChasis" value={numeroChasis} onChange={(e) => setNumeroChasis(e.target.value)} placeholder="VIN123" />
                </div>
              </div>
            </div>

            {/* Documentos */}
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-3 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-xs font-medium uppercase text-amber-900 dark:text-amber-200">Documentos del vehículo</p>

              {/* Permiso de circulación */}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="permisoCircVenc" className="text-xs">Permiso circulación — vencimiento</Label>
                  <Input id="permisoCircVenc" type="date" value={permisoCircVenc} onChange={(e) => setPermisoCircVenc(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Foto del permiso</Label>
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer">
                      <span className="inline-flex items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50 w-full">
                        <Camera className="h-3.5 w-3.5" /> {permisoCircFoto ? "Cambiar foto" : "Subir foto"}
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      setSubiendoDoc(true);
                      try {
                        const result = await uploadFile(f, { tipo: "permiso_circ" });
                        setPermisoCircFoto(result.url);
                        if (result.uploadedToServer) toast.success("Foto subida");
                        else toast.success("Foto guardada en el dispositivo (sin señal). Se subirá cuando tengas conexión.", { duration: 8000 });
                      } catch { toast.error("Error al subir"); } finally { setSubiendoDoc(false); }
                    }} />
                    </label>
                    {permisoCircFoto && <a href={permisoCircFoto} target="_blank" className="text-xs text-primary hover:underline">Ver</a>}
                  </div>
                </div>
              </div>

              {/* Revisión técnica */}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="revisionTecVenc" className="text-xs">Revisión técnica — vencimiento</Label>
                  <Input id="revisionTecVenc" type="date" value={revisionTecVenc} onChange={(e) => setRevisionTecVenc(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Foto de la revisión</Label>
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer">
                      <span className="inline-flex items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50 w-full">
                        <Camera className="h-3.5 w-3.5" /> {revisionTecFoto ? "Cambiar foto" : "Subir foto"}
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      setSubiendoDoc(true);
                      try {
                        const result = await uploadFile(f, { tipo: "revision_tec" });
                        setRevisionTecFoto(result.url);
                        if (result.uploadedToServer) toast.success("Foto subida");
                        else toast.success("Foto guardada en el dispositivo (sin señal). Se subirá cuando tengas conexión.", { duration: 8000 });
                      } catch { toast.error("Error al subir"); } finally { setSubiendoDoc(false); }
                    }} />
                    </label>
                    {revisionTecFoto && <a href={revisionTecFoto} target="_blank" className="text-xs text-primary hover:underline">Ver</a>}
                  </div>
                </div>
              </div>

              {/* Seguro */}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="seguroVenc" className="text-xs">Seguro — vencimiento</Label>
                  <Input id="seguroVenc" type="date" value={seguroVenc} onChange={(e) => setSeguroVenc(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Foto de la póliza</Label>
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer">
                      <span className="inline-flex items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50 w-full">
                        <Camera className="h-3.5 w-3.5" /> {seguroFoto ? "Cambiar foto" : "Subir foto"}
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      setSubiendoDoc(true);
                      try {
                        const result = await uploadFile(f, { tipo: "seguro" });
                        setSeguroFoto(result.url);
                        if (result.uploadedToServer) toast.success("Foto subida");
                        else toast.success("Foto guardada en el dispositivo (sin señal). Se subirá cuando tengas conexión.", { duration: 8000 });
                      } catch { toast.error("Error al subir"); } finally { setSubiendoDoc(false); }
                    }} />
                    </label>
                    {seguroFoto && <a href={seguroFoto} target="_blank" className="text-xs text-primary hover:underline">Ver</a>}
                  </div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="seguroCompania" className="text-xs">Compañía aseguradora</Label>
                  <Input id="seguroCompania" value={seguroCompania} onChange={(e) => setSeguroCompania(e.target.value)} placeholder="Mutual de Seguridad" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="seguroNumero" className="text-xs">N° de póliza</Label>
                  <Input id="seguroNumero" value={seguroNumero} onChange={(e) => setSeguroNumero(e.target.value)} placeholder="POL-12345" />
                </div>
              </div>
            </div>

            {subiendoDoc && <p className="text-xs text-muted-foreground text-center">Subiendo documento…</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving || subiendoDoc}>
                {saving ? "Guardando…" : editando ? "Guardar cambios" : "Crear camión"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo asignar choferes */}
      <Dialog open={!!asignando} onOpenChange={(o) => !o && setAsignando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar choferes a {asignando?.nombre}</DialogTitle>
            <DialogDescription>
              Selecciona quiénes pueden conducir este camión. Un camión puede tener varios choferes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {usuarios.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center p-4">
                No hay usuarios. Crea choferes en la pestaña Equipo.
              </p>
            ) : (
              usuarios.filter((u) => u.activo || choferesSeleccionados.has(u.id)).map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30"
                >
                  <Checkbox
                    checked={choferesSeleccionados.has(u.id)}
                    onCheckedChange={() => toggleChofer(u.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.nombre}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {u.role === "dueno" ? "Dueño" : "Chofer"}
                      </Badge>
                      {!u.activo && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAsignando(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarAsignacion}>
              Guardar asignación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <Dialog open={!!borrando} onOpenChange={(o) => !o && setBorrando(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar camión</DialogTitle>
            <DialogDescription>
              ¿Eliminar el camión <strong>{borrando?.nombre}</strong>? Las vueltas ya registradas
              se conservan pero quedarán sin camión asociado.
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
    </Card>
  );
}
