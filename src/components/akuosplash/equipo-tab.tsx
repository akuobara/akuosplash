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
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  User,
  Mail,
  Phone,
  Users,
  Truck,
  CalendarOff,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete, uploadFile } from "@/components/akuosplash/akuosplash-api-client";
import { formatDateTime } from "@/components/akuosplash/akuosplash-helpers";

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  role: string;
  activo: boolean;
  transportistaId: string | null;
  creadoEn: string;
  licenciaClase?: string | null;
  licenciaNumero?: string | null;
  licenciaVencimiento?: string | null;
  licenciaFotoUrl?: string | null;
  _count?: {
    vueltasComoChofer: number;
    entregasComoChofer: number;
    asignaciones: number;
  };
}

interface EquipoTabProps {
  refreshKey: number;
  onRefresh: () => void;
}

export function EquipoTab({ refreshKey, onRefresh }: EquipoTabProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [borrando, setBorrando] = useState<Usuario | null>(null);
  const [soltando, setSoltando] = useState<Usuario | null>(null);
  const [soltarFechaInicio, setSoltarFechaInicio] = useState("");
  const [soltarFechaFin, setSoltarFechaFin] = useState("");
  const [soltarClientes, setSoltarClientes] = useState(false);
  const [soltarReemplazo, setSoltarReemplazo] = useState("");
  const [soltandoSaving, setSoltandoSaving] = useState(false);

  // Campos del formulario
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telefono, setTelefono] = useState("");
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  // Licencia de chofer
  const [licenciaClase, setLicenciaClase] = useState("");
  const [licenciaNumero, setLicenciaNumero] = useState("");
  const [licenciaVenc, setLicenciaVenc] = useState("");
  const [licenciaFoto, setLicenciaFoto] = useState<string | null>(null);
  const [subiendoDoc, setSubiendoDoc] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ usuarios: Usuario[] }>("/api/akuosplash/usuarios");
      setUsuarios(data.usuarios);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  function abrirNuevo() {
    setEditando(null);
    setNombre(""); setEmail(""); setPassword(""); setTelefono(""); setActivo(true);
    setLicenciaClase(""); setLicenciaNumero(""); setLicenciaVenc(""); setLicenciaFoto(null);
    setFormOpen(true);
  }

  function abrirEditar(u: Usuario) {
    setEditando(u);
    setNombre(u.nombre); setEmail(u.email); setPassword(""); setTelefono(u.telefono ?? ""); setActivo(u.activo);
    setLicenciaClase(u.licenciaClase ?? "");
    setLicenciaNumero(u.licenciaNumero ?? "");
    setLicenciaVenc(u.licenciaVencimiento ? u.licenciaVencimiento.split("T")[0] : "");
    setLicenciaFoto(u.licenciaFotoUrl ?? null);
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !email.trim()) {
      toast.error("Nombre y email son obligatorios");
      return;
    }
    // Contraseña opcional: si no se proporciona, el backend busca si el usuario ya existe
    if (!editando && password && password.length < 4) {
      toast.error("La contraseña debe tener al menos 4 caracteres");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim() || null,
        activo,
        licenciaClase: licenciaClase || null,
        licenciaNumero: licenciaNumero.trim() || null,
        licenciaVencimiento: licenciaVenc || null,
        licenciaFotoUrl: licenciaFoto,
      };
      if (password) {
        payload.password = password;
      }

      if (editando) {
        await apiPatch(`/api/akuosplash/usuarios/${editando.id}`, payload);
        toast.success("Chofer actualizado");
      } else {
        await apiPost("/api/akuosplash/usuarios", payload);
        toast.success("Chofer creado");
      }
      setFormOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleBorrar(u: Usuario) {
    try {
      await apiDelete(`/api/akuosplash/usuarios/${u.id}`);
      toast.success("Chofer eliminado");
      setBorrando(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  async function handleSoltarPedidos() {
    if (!soltando) return;
    setSoltandoSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (soltarFechaInicio) body.fechaInicio = soltarFechaInicio;
      if (soltarFechaFin) body.fechaFin = soltarFechaFin;
      if (soltarClientes) body.soltarClientes = true;
      if (soltarReemplazo && soltarReemplazo !== "__ninguno") body.reemplazoChoferId = soltarReemplazo;
      const res = await apiPost<{ ok: boolean; pedidosReasignados: number; pedidosPublicados: number; clientesSoltados: number; clientesReemplazados: number }>(`/api/akuosplash/usuarios/${soltando.id}/soltar-pedidos`, body);
      const reasignados = res.pedidosReasignados || 0;
      const publicados = res.pedidosPublicados || 0;
      if (reasignados > 0) {
        toast.success(`Pedidos reasignados al reemplazo: ${reasignados}. Clientes reasignados: ${res.clientesReemplazados || 0}.`);
      } else {
        toast.success(`Pedidos publicados al pool: ${publicados}. Clientes soltados: ${res.clientesSoltados || 0}.`);
      }
      setSoltando(null);
      setSoltarFechaInicio("");
      setSoltarFechaFin("");
      setSoltarClientes(false);
      setSoltarReemplazo("");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron soltar los pedidos");
    } finally {
      setSoltandoSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">Equipo</h2>
          <p className="text-sm text-muted-foreground">
            Gestiona los choferes que pueden usar la app. Asigna camiones desde la pestaña Ajustes → Camiones.
          </p>
        </div>
        <Button onClick={abrirNuevo} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Nuevo chofer
        </Button>
      </div>

      {/* Lista */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Usuarios ({usuarios.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : usuarios.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No hay usuarios.
            </div>
          ) : (
            <ul className="space-y-2">
              {usuarios.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{u.nombre}</span>
                      <Badge
                        variant={u.role === "dueno" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {u.role === "dueno" ? "Administrador" : "Chofer"}
                      </Badge>
                      {!u.activo && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {u.email}
                      </span>
                      {u.telefono && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {u.telefono}
                        </span>
                      )}
                    </div>
                    {u._count && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <Truck className="mr-1 inline h-3 w-3" />
                        {u._count.asignaciones} camión(es) · {u._count.entregasComoChofer} entrega(s) · {u._count.vueltasComoChofer} vuelta(s)
                      </p>
                    )}
                    {/* Licencia de conducir */}
                    {u.role === "chofer" && (u.licenciaClase || u.licenciaNumero || u.licenciaVencimiento) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {u.licenciaClase && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <span className="text-muted-foreground">Lic.</span>
                            <span className="font-medium">{u.licenciaClase}</span>
                          </Badge>
                        )}
                        {u.licenciaNumero && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            N° {u.licenciaNumero}
                          </Badge>
                        )}
                        {u.licenciaVencimiento && (() => {
                          const venc = new Date(u.licenciaVencimiento);
                          const hoy = new Date();
                          const diasParaVencer = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                          if (diasParaVencer < 0) {
                            return (
                              <Badge variant="outline" className="text-[10px] text-red-600 border-red-300 dark:border-red-800">
                                ⚠ Licencia vencida
                              </Badge>
                            );
                          }
                          if (diasParaVencer <= 30) {
                            return (
                              <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 dark:border-amber-700 dark:text-amber-300">
                                ⚠ Vence en {diasParaVencer}d
                              </Badge>
                            );
                          }
                          return (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Vence: {venc.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            </Badge>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  {u.role !== "dueno" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => abrirEditar(u)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSoltando(u)}>
                          <CalendarOff className="mr-2 h-4 w-4" /> Soltar pedidos (vacaciones)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setBorrando(u)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Formulario crear/editar chofer */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar chofer" : "Nuevo chofer"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Actualiza los datos del chofer. Deja la contraseña vacía para no cambiarla."
                : "Crea una cuenta de chofer. El chofer podrá iniciar sesión con email y contraseña."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="choferNombre">Nombre completo *</Label>
              <Input
                id="choferNombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Juan Pérez"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="choferEmail">Email *</Label>
              <Input
                id="choferEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="chofer@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="choferPassword">
                Contraseña {editando && "(dejar vacío para no cambiar)"} — dejar vacío si el chofer ya tiene cuenta
              </Label>
              <Input
                id="choferPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required={false}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="choferTelefono">Teléfono (opcional)</Label>
              <Input
                id="choferTelefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+56 9 1234 5678"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="choferActivo" className="text-sm font-medium">Cuenta activa</Label>
                <p className="text-xs text-muted-foreground">
                  Los choferes inactivos no pueden iniciar sesión.
                </p>
              </div>
              <Switch id="choferActivo" checked={activo} onCheckedChange={setActivo} />
            </div>

            {/* Licencia de conducir */}
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-3 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-xs font-medium uppercase text-amber-900 dark:text-amber-200">Licencia de conducir</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="licenciaClase" className="text-xs">Clase</Label>
                  <select id="licenciaClase" value={licenciaClase} onChange={(e) => setLicenciaClase(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">— Sin licencia —</option>
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="A3">A3</option>
                    <option value="A4">A4</option>
                    <option value="A5">A5</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                    <option value="F">F</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenciaNumero" className="text-xs">N° licencia</Label>
                  <Input id="licenciaNumero" value={licenciaNumero} onChange={(e) => setLicenciaNumero(e.target.value)} placeholder="12345678-9" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="licenciaVenc" className="text-xs">Vencimiento</Label>
                  <Input id="licenciaVenc" type="date" value={licenciaVenc} onChange={(e) => setLicenciaVenc(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Foto de la licencia</Label>
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer">
                      <span className="inline-flex items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50 w-full">
                        <Camera className="h-3.5 w-3.5" /> {licenciaFoto ? "Cambiar foto" : "Subir foto"}
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return;
                      setSubiendoDoc(true);
                      try {
                        const result = await uploadFile(f, { tipo: "licencia" });
                        setLicenciaFoto(result.url);
                        if (result.uploadedToServer) toast.success("Foto subida");
                        else toast.success("Foto guardada en el dispositivo (sin señal). Se subirá cuando tengas conexión.", { duration: 8000 });
                      } catch { toast.error("Error al subir"); } finally { setSubiendoDoc(false); }
                    }} />
                    </label>
                    {licenciaFoto && <a href={licenciaFoto} target="_blank" className="text-xs text-primary hover:underline self-center">Ver</a>}
                  </div>
                </div>
              </div>
            </div>

            {subiendoDoc && <p className="text-xs text-muted-foreground text-center">Subiendo documento…</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : editando ? "Guardar cambios" : "Crear chofer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <Dialog open={!!borrando} onOpenChange={(o) => !o && setBorrando(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar chofer</DialogTitle>
            <DialogDescription>
              ¿Eliminar a <strong>{borrando?.nombre}</strong>? Las entregas y vueltas registradas
              se conservan, pero el chofer ya no podrá iniciar sesión.
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

      {/* Soltar pedidos (vacaciones / ausencia) */}
      <Dialog open={!!soltando} onOpenChange={(o) => !o && setSoltando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Soltar pedidos de {soltando?.nombre}</DialogTitle>
            <DialogDescription>
              Libera los pedidos asignados a este chofer para que otros puedan tomarlos.
              Útil cuando el chofer está enfermo, de vacaciones, o no responde.
              No afecta entregas ya realizadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Selector de reemplazo */}
            <div className="space-y-2">
              <Label className="text-xs">Chofer de reemplazo (opcional)</Label>
              <select
                value={soltarReemplazo || "__ninguno"}
                onChange={(e) => setSoltarReemplazo(e.target.value === "__ninguno" ? "" : e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="__ninguno">— Sin reemplazo (publicar al pool) —</option>
                {usuarios.filter(u => u.id !== soltando?.id && u.activo && u.role === "chofer").map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre} ({u.email})</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Con reemplazo: los pedidos se reasignan al nuevo chofer. Sin reemplazo: van al pool visible para todos.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Desde (opcional)</Label>
                <Input
                  type="date"
                  value={soltarFechaInicio}
                  onChange={(e) => setSoltarFechaInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hasta (opcional)</Label>
                <Input
                  type="date"
                  value={soltarFechaFin}
                  onChange={(e) => setSoltarFechaFin(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Si dejas las fechas vacías, se sueltan <strong>todos</strong> los pedidos pendientes.
              Si especificas fechas, solo se sueltan los pedidos programados en ese rango.
            </p>
            <label className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              <Switch checked={soltarClientes} onCheckedChange={setSoltarClientes} />
              <div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  También soltar/reemplazar clientes preferidos
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {soltarReemplazo
                    ? "Transfiere el cliente al chofer de reemplazo como nuevo preferido."
                    : "Elimina a este chofer como preferido de todos sus clientes. Los pedidos futuros no tendrán prioridad."}
                </p>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSoltando(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSoltarPedidos}
              disabled={soltandoSaving}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {soltandoSaving ? "Soltando…" : "Soltar pedidos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
