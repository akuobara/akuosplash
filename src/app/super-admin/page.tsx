"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users, Truck, Droplets, DollarSign, TrendingUp,
  Activity, Shield, Search, UserCheck, UserX, ArrowLeft, LogOut,
  Plus, MoreVertical, Pencil, Trash2, Eye, Mail, Phone, X, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { formatCurrency, formatNumber, formatDate, formatDateTime, labelTipoGasto, labelMetodoPago, labelEstadoPago } from "@/lib/helpers";
import { clearToken } from "@/lib/api-client";

interface Stats {
  globales: {
    administradores: number;
    choferes: number;
    clientes: number;
    camiones: number;
    entregas: number;
    vueltas: number;
    gastos: number;
    pagos: number;
    ventasTotal: number;
    efectivoTotal: number;
    transferenciaTotal: number;
    litrosTotal: number;
  };
  administradores: Array<{
    id: string;
    nombre: string;
    email: string;
    activo: boolean;
    creadoEn: string;
    _count: { choferes: number; camionesDueno: number; clientesDueno: number; vueltasComoDueno: number; entregasComoDueno: number };
    ventasTotal: number;
    litrosTotal: number;
  }>;
}

interface Usuario {
  id: string; nombre: string; email: string; role: string; activo: boolean; creadoEn: string; duenoId: string | null; telefono: string | null;
}

interface AdminDetalle {
  admin: {
    id: string; nombre: string; email: string; role: string; activo: boolean; creadoEn: string; telefono: string | null;
    licenciaClase: string | null; licenciaNumero: string | null; licenciaVencimiento: string | null;
  };
  choferes: any[];
  camiones: any[];
  clientes: any[];
  entregas: any[];
  vueltas: any[];
  gastos: any[];
  pagos: any[];
  config: any;
  totales: { ventas: number; litros: number; efectivo: number; transferencia: number; gastos: number; pagosSueltos: number };
}

export default function SuperAdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [tab, setTab] = useState<"dashboard" | "administradores" | "usuarios">("dashboard");

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<AdminDetalle | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);

  const [crearAdminOpen, setCrearAdminOpen] = useState(false);
  const [editarAdminOpen, setEditarAdminOpen] = useState(false);
  const [editarTarget, setEditarTarget] = useState<Usuario | null>(null);

  const [eliminandoAdmin, setEliminandoAdmin] = useState<Usuario | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        apiGet<Stats>("/api/super-admin/stats"),
        apiGet<{ usuarios: Usuario[] }>("/api/super-admin/usuarios"),
      ]);
      setStats(s);
      setUsuarios(u.usuarios);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function abrirDetalle(id: string) {
    setDetalleId(id);
    setDetalleOpen(true);
    setDetalleLoading(true);
    setDetalle(null);
    try {
      const d = await apiGet<AdminDetalle>(`/api/super-admin/administradores/${id}`);
      setDetalle(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar el detalle");
      setDetalleOpen(false);
    } finally {
      setDetalleLoading(false);
    }
  }

  async function toggleUsuario(u: Usuario) {
    try {
      await apiPatch(`/api/super-admin/usuarios`, { userId: u.id, activo: !u.activo });
      toast.success(u.activo ? "Usuario desactivado" : "Usuario activado");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  }

  async function cambiarRol(u: Usuario, nuevoRol: string) {
    try {
      await apiPatch(`/api/super-admin/usuarios`, { userId: u.id, role: nuevoRol });
      toast.success(`Rol cambiado a ${nuevoRol}`);
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el rol");
    }
  }

  async function eliminarUsuario(u: Usuario) {
    if (!confirm(`¿Eliminar a ${u.nombre}? Esta acción no se puede deshacer.`)) return;
    try {
      await apiDelete(`/api/super-admin/usuarios?userId=${u.id}`);
      toast.success("Usuario eliminado");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  async function eliminarAdmin(a: Usuario) {
    if (!confirm(`¿Eliminar a ${a.nombre} y TODOS sus datos (clientes, choferes, camiones, entregas, vueltas, gastos, pagos, configuración)? Esta acción no se puede deshacer.`)) return;
    try {
      await apiDelete(`/api/super-admin/administradores/${a.id}`);
      toast.success("Administrador eliminado");
      setEliminandoAdmin(null);
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  function handleLogout() {
    clearToken();
    window.location.href = "/";
  }

  const usuariosFiltrados = usuarios.filter((u) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto max-w-5xl space-y-4">
          <Skeleton className="h-12 rounded-lg" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-base font-bold sm:text-lg">Panel Súper Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-1 inline h-3 w-3" /> App
            </a>
            <Button onClick={handleLogout} variant="ghost" size="sm">
              <LogOut className="mr-1 h-4 w-4" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2">
          <Button size="sm" variant={tab === "dashboard" ? "default" : "outline"} onClick={() => setTab("dashboard")}>
            <Activity className="mr-1 h-4 w-4" /> Resumen
          </Button>
          <Button size="sm" variant={tab === "administradores" ? "default" : "outline"} onClick={() => setTab("administradores")}>
            <Users className="mr-1 h-4 w-4" /> Administradores
          </Button>
          <Button size="sm" variant={tab === "usuarios" ? "default" : "outline"} onClick={() => setTab("usuarios")}>
            <UserCheck className="mr-1 h-4 w-4" /> Usuarios
          </Button>
        </div>

        {/* Dashboard */}
        {tab === "dashboard" && stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={<Users className="h-4 w-4 text-blue-500" />} label="Administradores" value={String(stats.globales.administradores)} />
              <StatCard icon={<UserCheck className="h-4 w-4 text-emerald-500" />} label="Choferes" value={String(stats.globales.choferes)} />
              <StatCard icon={<Users className="h-4 w-4 text-amber-500" />} label="Clientes" value={String(stats.globales.clientes)} />
              <StatCard icon={<Truck className="h-4 w-4 text-purple-500" />} label="Camiones" value={String(stats.globales.camiones)} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={<DollarSign className="h-4 w-4 text-primary" />} label="Ventas totales" value={formatCurrency(stats.globales.ventasTotal)} highlight />
              <StatCard icon={<TrendingUp className="h-4 w-4 text-emerald-600" />} label="Efectivo" value={formatCurrency(stats.globales.efectivoTotal)} />
              <StatCard icon={<TrendingUp className="h-4 w-4 text-blue-600" />} label="Transferencia" value={formatCurrency(stats.globales.transferenciaTotal)} />
              <StatCard icon={<Droplets className="h-4 w-4 text-cyan-500" />} label="Litros" value={`${formatNumber(stats.globales.litrosTotal, 0)} L`} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Entregas" value={String(stats.globales.entregas)} />
              <StatCard label="Vueltas" value={String(stats.globales.vueltas)} />
              <StatCard label="Gastos" value={String(stats.globales.gastos)} />
              <StatCard label="Pagos" value={String(stats.globales.pagos)} />
            </div>
          </div>
        )}

        {/* Administradores */}
        {tab === "administradores" && stats && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setCrearAdminOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Nuevo administrador
              </Button>
            </div>
            {stats.administradores.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No hay administradores registrados.</CardContent></Card>
            ) : (
              stats.administradores.map((a) => (
                <Card key={a.id} className={!a.activo ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{a.nombre}</span>
                          {!a.activo && <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactivo</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{a.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Registrado: {formatDate(a.creadoEn)}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          <div><span className="text-muted-foreground">Choferes:</span> <strong>{a._count.choferes}</strong></div>
                          <div><span className="text-muted-foreground">Camiones:</span> <strong>{a._count.camionesDueno}</strong></div>
                          <div><span className="text-muted-foreground">Clientes:</span> <strong>{a._count.clientesDueno}</strong></div>
                          <div><span className="text-muted-foreground">Entregas:</span> <strong>{a._count.entregasComoDueno}</strong></div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs">
                          <span className="text-primary font-medium">{formatCurrency(a.ventasTotal)} en ventas</span>
                          <span className="text-muted-foreground">{formatNumber(a.litrosTotal, 0)} L entregados</span>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => abrirDetalle(a.id)}>
                            <Eye className="mr-2 h-4 w-4" /> Ver detalle
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setEditarTarget({ id: a.id, nombre: a.nombre, email: a.email, role: "dueno", activo: a.activo, creadoEn: a.creadoEn, duenoId: null, telefono: null });
                            setEditarAdminOpen(true);
                          }}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleUsuario({ id: a.id, nombre: a.nombre, email: a.email, role: "dueno", activo: a.activo, creadoEn: a.creadoEn, duenoId: null, telefono: null })}>
                            {a.activo ? <><UserX className="mr-2 h-4 w-4" /> Desactivar</> : <><UserCheck className="mr-2 h-4 w-4" /> Activar</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setEliminandoAdmin({ id: a.id, nombre: a.nombre, email: a.email, role: "dueno", activo: a.activo, creadoEn: a.creadoEn, duenoId: null, telefono: null })}>
                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Todos los usuarios */}
        {tab === "usuarios" && (
          <div className="space-y-3">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, email, rol..." className="pl-8 h-9" />
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="p-3">Nombre</th>
                        <th className="p-3 hidden sm:table-cell">Email</th>
                        <th className="p-3">Rol</th>
                        <th className="p-3">Estado</th>
                        <th className="p-3 hidden sm:table-cell">Registro</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuariosFiltrados.map((u) => (
                        <tr key={u.id} className="border-b border-border last:border-0">
                          <td className="p-3 font-medium">{u.nombre}</td>
                          <td className="p-3 hidden sm:table-cell text-muted-foreground">{u.email}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-[10px]">
                              {u.role === "dueno" ? "Administrador" : u.role === "chofer" ? "Chofer" : u.role === "super_admin" ? "Súper Admin" : u.role}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {u.activo ? <Badge variant="secondary" className="text-[10px] text-emerald-700">Activo</Badge> : <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactivo</Badge>}
                          </td>
                          <td className="p-3 hidden sm:table-cell text-xs text-muted-foreground">{formatDate(u.creadoEn)}</td>
                          <td className="p-3">
                            {u.role !== "super_admin" && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => toggleUsuario(u)}>
                                    {u.activo ? "Desactivar" : "Activar"}
                                  </DropdownMenuItem>
                                  {u.role === "chofer" && <DropdownMenuItem onClick={() => cambiarRol(u, "dueno")}>Hacer administrador</DropdownMenuItem>}
                                  {u.role === "dueno" && <DropdownMenuItem onClick={() => cambiarRol(u, "chofer")}>Hacer chofer</DropdownMenuItem>}
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => eliminarUsuario(u)}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Modal: Detalle admin */}
      <Dialog open={detalleOpen} onOpenChange={(o) => { setDetalleOpen(o); if (!o) { setDetalle(null); setDetalleId(null); } }}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del administrador</DialogTitle>
            <DialogDescription>
              {detalle ? `${detalle.admin.nombre} · ${detalle.admin.email}` : "Cargando..."}
            </DialogDescription>
          </DialogHeader>
          {detalleLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 rounded" />
              <Skeleton className="h-12 rounded" />
              <Skeleton className="h-12 rounded" />
            </div>
          ) : detalle ? (
            <AdminDetalleView detalle={detalle} />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Modal: Crear admin */}
      <CrearAdminDialog
        open={crearAdminOpen}
        onOpenChange={setCrearAdminOpen}
        onCreated={() => { setCrearAdminOpen(false); cargar(); }}
      />

      {/* Modal: Editar admin */}
      <EditarAdminDialog
        open={editarAdminOpen}
        onOpenChange={(o) => { setEditarAdminOpen(o); if (!o) setEditarTarget(null); }}
        target={editarTarget}
        onSaved={() => { setEditarAdminOpen(false); cargar(); }}
      />

      {/* Confirmar eliminación admin */}
      <Dialog open={!!eliminandoAdmin} onOpenChange={(o) => !o && setEliminandoAdmin(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar administrador</DialogTitle>
            <DialogDescription>
              ¿Seguro que querés eliminar a <strong>{eliminandoAdmin?.nombre}</strong>?
              Se borrarán TODOS sus datos: clientes, choferes, camiones, entregas, vueltas, gastos, pagos y configuración.
              Esta acción NO se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEliminandoAdmin(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => eliminandoAdmin && eliminarAdmin(eliminandoAdmin)}>
              <Trash2 className="mr-1 h-4 w-4" /> Eliminar todo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon, label, value, highlight }: { icon?: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/20 bg-primary/5" : ""}>
      <CardContent className="p-3">
        {icon}
        <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
        <p className="text-lg font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

// === Vista de detalle con tabs internas ===
function AdminDetalleView({ detalle }: { detalle: AdminDetalle }) {
  const [subtab, setSubtab] = useState<"info" | "choferes" | "camiones" | "clientes" | "entregas" | "vueltas" | "gastos" | "pagos" | "config">("info");

  const tabs: { key: typeof subtab; label: string; count?: number }[] = [
    { key: "info", label: "Info" },
    { key: "choferes", label: "Choferes", count: detalle.choferes.length },
    { key: "camiones", label: "Camiones", count: detalle.camiones.length },
    { key: "clientes", label: "Clientes", count: detalle.clientes.length },
    { key: "entregas", label: "Entregas", count: detalle.entregas.length },
    { key: "vueltas", label: "Vueltas", count: detalle.vueltas.length },
    { key: "gastos", label: "Gastos", count: detalle.gastos.length },
    { key: "pagos", label: "Pagos", count: detalle.pagos.length },
    { key: "config", label: "Config" },
  ];

  return (
    <div className="space-y-3">
      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded border p-2"><p className="text-muted-foreground">Ventas</p><p className="font-bold">{formatCurrency(detalle.totales.ventas)}</p></div>
        <div className="rounded border p-2"><p className="text-muted-foreground">Litros</p><p className="font-bold">{formatNumber(detalle.totales.litros, 0)} L</p></div>
        <div className="rounded border p-2"><p className="text-muted-foreground">Gastos</p><p className="font-bold">{formatCurrency(detalle.totales.gastos)}</p></div>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1 border-b pb-2">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubtab(t.key)}
            className={`rounded px-2 py-1 text-xs ${subtab === t.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {t.label}{t.count != null ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      {/* Info */}
      {subtab === "info" && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Field label="Nombre" value={detalle.admin.nombre} />
          <Field label="Email" value={detalle.admin.email} />
          <Field label="Teléfono" value={detalle.admin.telefono || "—"} />
          <Field label="Estado" value={detalle.admin.activo ? "Activo" : "Inactivo"} />
          <Field label="Registro" value={formatDate(detalle.admin.creadoEn)} />
        </div>
      )}

      {/* Choferes */}
      {subtab === "choferes" && (
        <ListaSimple
          items={detalle.choferes}
          emptyText="Sin choferes"
          columns={[
            { key: "nombre", label: "Nombre" },
            { key: "email", label: "Email" },
            { key: "telefono", label: "Teléfono" },
            { key: "activo", label: "Estado", render: (v: boolean) => v ? "Activo" : "Inactivo" },
          ]}
        />
      )}

      {/* Camiones */}
      {subtab === "camiones" && (
        <ListaSimple
          items={detalle.camiones}
          emptyText="Sin camiones"
          columns={[
            { key: "nombre", label: "Nombre" },
            { key: "patente", label: "Patente" },
            { key: "capacidad", label: "Capacidad", render: (v: number) => `${formatNumber(v, 0)} L` },
            { key: "marca", label: "Marca" },
            { key: "modelo", label: "Modelo" },
            { key: "activo", label: "Estado", render: (v: boolean) => v ? "Activo" : "Inactivo" },
          ]}
        />
      )}

      {/* Clientes */}
      {subtab === "clientes" && (
        <ListaSimple
          items={detalle.clientes}
          emptyText="Sin clientes"
          columns={[
            { key: "nombre", label: "Nombre" },
            { key: "telefono", label: "Teléfono" },
            { key: "zona", label: "Zona" },
            { key: "direccion", label: "Dirección" },
            { key: "_count.entregas", label: "Entregas" },
          ]}
        />
      )}

      {/* Entregas */}
      {subtab === "entregas" && (
        <ListaSimple
          items={detalle.entregas}
          emptyText="Sin entregas"
          columns={[
            { key: "fecha", label: "Fecha", render: (v: string) => formatDateTime(v) },
            { key: "clienteNombre", label: "Cliente" },
            { key: "litros", label: "Litros", render: (v: number) => `${formatNumber(v, 0)} L` },
            { key: "total", label: "Total", render: (v: number) => formatCurrency(v) },
            { key: "estadoPago", label: "Estado", render: (v: string) => labelEstadoPago(v) },
          ]}
        />
      )}

      {/* Vueltas */}
      {subtab === "vueltas" && (
        <ListaSimple
          items={detalle.vueltas}
          emptyText="Sin vueltas"
          columns={[
            { key: "numero", label: "#" },
            { key: "iniciadaEn", label: "Inicio", render: (v: string) => formatDateTime(v) },
            { key: "cerradaEn", label: "Cierre", render: (v: string | null) => v ? formatDateTime(v) : "En curso" },
            { key: "camion.nombre", label: "Camión" },
            { key: "chofer.nombre", label: "Chofer" },
            { key: "_count.entregas", label: "Entregas" },
          ]}
        />
      )}

      {/* Gastos */}
      {subtab === "gastos" && (
        <ListaSimple
          items={detalle.gastos}
          emptyText="Sin gastos"
          columns={[
            { key: "fecha", label: "Fecha", render: (v: string) => formatDateTime(v) },
            { key: "tipo", label: "Tipo", render: (v: string) => labelTipoGasto(v) },
            { key: "descripcion", label: "Descripción" },
            { key: "monto", label: "Monto", render: (v: number) => formatCurrency(v) },
            { key: "pagadoPor", label: "Pagado por" },
          ]}
        />
      )}

      {/* Pagos */}
      {subtab === "pagos" && (
        <ListaSimple
          items={detalle.pagos}
          emptyText="Sin pagos sueltos"
          columns={[
            { key: "fecha", label: "Fecha", render: (v: string) => formatDateTime(v) },
            { key: "cliente.nombre", label: "Cliente" },
            { key: "metodoPago", label: "Método" },
            { key: "monto", label: "Monto", render: (v: number) => formatCurrency(v) },
            { key: "nota", label: "Nota" },
          ]}
        />
      )}

      {/* Config */}
      {subtab === "config" && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {detalle.config ? (
            <>
              <Field label="Nombre dueño" value={detalle.config.nombreDueno || "—"} />
              <Field label="Nombre chofer" value={detalle.config.nombreChofer || "—"} />
              <Field label="Empresa" value={detalle.config.empresaRazonSocial || "—"} />
              <Field label="RUT empresa" value={detalle.config.empresaRut || "—"} />
              <Field label="Precio efectivo/L" value={formatCurrency(detalle.config.precioEfectivoPorLitro || 0)} />
              <Field label="Precio transferencia/L" value={formatCurrency(detalle.config.precioTransferenciaPorLitro || 0)} />
              <Field label="Capacidad camión" value={`${formatNumber(detalle.config.capacidadCamion || 0, 0)} L`} />
              <Field label="Modo liquidación" value={detalle.config.modoLiquidacion || "—"} />
              <Field label="% comisión chofer" value={`${detalle.config.porcentajeComisionChofer || 0}%`} />
              <Field label="% comisión dueño" value={`${detalle.config.porcentajeComisionDueno || 0}%`} />
            </>
          ) : (
            <p className="col-span-2 text-sm text-muted-foreground">Sin configuración</p>
          )}
        </div>
      )}
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

function ListaSimple<T extends Record<string, any>>({
  items, emptyText, columns,
}: {
  items: T[];
  emptyText: string;
  columns: { key: string; label: string; render?: (v: any) => string }[];
}) {
  if (items.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }
  function getValue(obj: any, path: string) {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {columns.map(c => <th key={c.key} className="p-2">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b last:border-0">
              {columns.map(c => {
                const v = getValue(item, c.key);
                return <td key={c.key} className="p-2">{c.render ? c.render(v) : (v == null ? "—" : String(v))}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// === Dialog: Crear admin ===
function CrearAdminDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!nombre.trim() || !email.trim() || !password) {
      toast.error("Nombre, email y password son obligatorios");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/super-admin/usuarios", { nombre, email, telefono, password });
      toast.success("Administrador creado");
      setNombre(""); setEmail(""); setTelefono(""); setPassword("");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo administrador</DialogTitle>
          <DialogDescription>Crea una cuenta de administrador (dueño) nueva.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Teléfono</Label>
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Password *</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// === Dialog: Editar admin ===
function EditarAdminDialog({ open, onOpenChange, target, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; target: Usuario | null; onSaved: () => void }) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setNombre(target.nombre);
      setEmail(target.email);
      setTelefono(target.telefono || "");
      setPassword("");
    }
  }, [target]);

  async function handleSave() {
    if (!target) return;
    if (!nombre.trim() || !email.trim()) {
      toast.error("Nombre y email son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const data: Record<string, unknown> = { nombre, email, telefono };
      if (password) data.password = password;
      await apiPatch(`/api/super-admin/administradores/${target.id}`, data);
      toast.success("Administrador actualizado");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setSaving(false);
    }
  }

  if (!target) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar administrador</DialogTitle>
          <DialogDescription>Editá los datos de {target.nombre}. Dejá el password vacío para no cambiarlo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Teléfono</Label>
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Password nuevo (vacío = no cambiar)</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
