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
  Activity, Shield, Search, UserCheck, UserX, ArrowLeft, LogOut, Clock,
  Plus, MoreVertical, Pencil, Trash2, Eye, Mail, Phone, X, Loader2, CheckCircle2, MapPin, Package, Receipt, Upload, Ticket,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
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
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [tab, setTab] = useState<"dashboard" | "administradores" | "usuarios" | "buscar" | "entregas" | "pendientes" | "cargas" | "zonas" | "planes" | "facturas" | "audit" | "cupones">("dashboard");

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
    setError(null);
    try {
      const [s, u] = await Promise.all([
        apiGet<Stats>("/api/super-admin/stats"),
        apiGet<{ usuarios: Usuario[] }>("/api/super-admin/usuarios"),
      ]);
      setStats(s);
      setUsuarios(u.usuarios);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudieron cargar los datos";
      setError(msg);
      toast.error(msg);
      // Si es "No autorizado" o "Sesión expirada", redirigir al login después de 1.5s
      if (msg.toLowerCase().includes("autorizado") || msg.toLowerCase().includes("sesión expirada") || msg.toLowerCase().includes("sesion expirada")) {
        clearToken();
        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      }
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

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
            <p className="text-sm text-destructive font-medium">No se pudieron cargar los datos</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button onClick={cargar} size="sm" variant="outline">
              Reintentar
            </Button>
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
        {/* Tabs - menú desplegable en celular, fila en desktop */}
        <div className="flex gap-2">
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value as any)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium sm:hidden"
          >
            <option value="dashboard">📊 Resumen</option>
            <option value="administradores">👥 Administradores</option>
            <option value="usuarios">👤 Usuarios</option>
            <option value="buscar">🔍 Buscar</option>
            <option value="entregas">💧 Entregas global</option>
            <option value="pendientes">💰 Pagos pendientes</option>
            <option value="cargas">⏳ Cargas de saldo</option>
            <option value="zonas">📍 Zonas</option>
            <option value="planes">📦 Planes</option>
            <option value="cupones">🎟️ Cupones</option>
            <option value="facturas">🧾 Facturas</option>
            <option value="audit">📋 Auditoría</option>
          </select>

          <div className="hidden sm:flex sm:flex-wrap sm:gap-2">
            <Button size="sm" variant={tab === "dashboard" ? "default" : "outline"} onClick={() => setTab("dashboard")}>
              <Activity className="mr-1 h-4 w-4" /> Resumen
            </Button>
            <Button size="sm" variant={tab === "administradores" ? "default" : "outline"} onClick={() => setTab("administradores")}>
              <Users className="mr-1 h-4 w-4" /> Administradores
            </Button>
            <Button size="sm" variant={tab === "usuarios" ? "default" : "outline"} onClick={() => setTab("usuarios")}>
              <UserCheck className="mr-1 h-4 w-4" /> Usuarios
            </Button>
            <Button size="sm" variant={tab === "buscar" ? "default" : "outline"} onClick={() => setTab("buscar")}>
              <Search className="mr-1 h-4 w-4" /> Buscar
            </Button>
            <Button size="sm" variant={tab === "entregas" ? "default" : "outline"} onClick={() => setTab("entregas")}>
              <Droplets className="mr-1 h-4 w-4" /> Entregas global
            </Button>
            <Button size="sm" variant={tab === "pendientes" ? "default" : "outline"} onClick={() => setTab("pendientes")}>
              <DollarSign className="mr-1 h-4 w-4" /> Pagos pendientes
            </Button>
            <Button size="sm" variant={tab === "cargas" ? "default" : "outline"} onClick={() => setTab("cargas")}>
              <Clock className="mr-1 h-4 w-4" /> Cargas de saldo
            </Button>
            <Button size="sm" variant={tab === "zonas" ? "default" : "outline"} onClick={() => setTab("zonas")}>
              <MapPin className="mr-1 h-4 w-4" /> Zonas
            </Button>
            <Button size="sm" variant={tab === "planes" ? "default" : "outline"} onClick={() => setTab("planes")}>
              <Package className="mr-1 h-4 w-4" /> Planes
            </Button>
            <Button size="sm" variant={tab === "cupones" ? "default" : "outline"} onClick={() => setTab("cupones")}>
              <Ticket className="mr-1 h-4 w-4" /> Cupones
            </Button>
            <Button size="sm" variant={tab === "facturas" ? "default" : "outline"} onClick={() => setTab("facturas")}>
              <Receipt className="mr-1 h-4 w-4" /> Facturas
            </Button>
            <Button size="sm" variant={tab === "audit" ? "default" : "outline"} onClick={() => setTab("audit")}>
              <Shield className="mr-1 h-4 w-4" /> Auditoría
            </Button>
          </div>
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

        {/* Buscar global */}
        {tab === "buscar" && (
          <BuscarGlobal onAbrirAdmin={(id) => abrirDetalle(id)} />
        )}

        {/* Todas las entregas */}
        {tab === "entregas" && (
          <EntregasGlobal />
        )}

        {/* Pagos pendientes global */}
        {tab === "pendientes" && (
          <PendientesGlobal />
        )}

        {/* Cargas de saldo pendientes */}
        {tab === "cargas" && (
          <CargasPendientesGlobal />
        )}

        {/* Zonas */}
        {tab === "zonas" && (
          <ZonasAdmin />
        )}

        {/* Planes */}
        {tab === "planes" && (
          <PlanesAdmin />
        )}

        {/* Cupones */}
        {tab === "cupones" && (
          <CuponesAdmin />
        )}

        {/* Facturas */}
        {tab === "facturas" && (
          <FacturasAdmin />
        )}

        {/* Auditoría */}
        {tab === "audit" && (
          <AuditView />
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
            <AdminDetalleView detalle={detalle} onRecargar={() => detalleId && abrirDetalle(detalleId)} />
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
function AdminDetalleView({ detalle, onRecargar }: { detalle: AdminDetalle; onRecargar: () => void }) {
  const [subtab, setSubtab] = useState<"info" | "choferes" | "camiones" | "clientes" | "entregas" | "vueltas" | "gastos" | "pagos" | "config">("info");
  const [editando, setEditando] = useState<{ tipo: string; item: any } | null>(null);
  const [creando, setCreando] = useState<string | null>(null);
  const [editandoConfig, setEditandoConfig] = useState(false);

  async function eliminarRecurso(tipo: string, itemId: string, label: string) {
    if (!confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
    try {
      await apiDelete(`/api/super-admin/administradores/${detalle.admin.id}/recurso?tipo=${tipo}&itemId=${itemId}`);
      toast.success("Eliminado");
      onRecargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

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
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setCreando("chofer")}><Plus className="mr-1 h-3 w-3" /> Nuevo chofer</Button>
          </div>
          <ListaConAcciones
            items={detalle.choferes}
            emptyText="Sin choferes"
            columns={[
              { key: "nombre", label: "Nombre" },
              { key: "email", label: "Email" },
              { key: "telefono", label: "Teléfono" },
              { key: "activo", label: "Estado", render: (v: boolean) => v ? "Activo" : "Inactivo" },
            ]}
            onEditar={(item) => setEditando({ tipo: "chofer", item })}
            onEliminar={(item) => eliminarRecurso("chofer", item.id, item.nombre)}
          />
        </div>
      )}

      {/* Camiones */}
      {subtab === "camiones" && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setCreando("camion")}><Plus className="mr-1 h-3 w-3" /> Nuevo camión</Button>
          </div>
          <ListaConAcciones
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
            onEditar={(item) => setEditando({ tipo: "camion", item })}
            onEliminar={(item) => eliminarRecurso("camion", item.id, item.nombre)}
          />
        </div>
      )}

      {/* Clientes */}
      {subtab === "clientes" && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setCreando("cliente")}><Plus className="mr-1 h-3 w-3" /> Nuevo cliente</Button>
          </div>
          <ListaConAcciones
            items={detalle.clientes}
            emptyText="Sin clientes"
            columns={[
              { key: "nombre", label: "Nombre" },
              { key: "telefono", label: "Teléfono" },
              { key: "zona", label: "Zona" },
              { key: "direccion", label: "Dirección" },
              { key: "_count.entregas", label: "Entregas" },
            ]}
            onEditar={(item) => setEditando({ tipo: "cliente", item })}
            onEliminar={(item) => eliminarRecurso("cliente", item.id, item.nombre)}
          />
        </div>
      )}

      {/* Entregas */}
      {subtab === "entregas" && (
        <ListaConAcciones
          items={detalle.entregas}
          emptyText="Sin entregas"
          columns={[
            { key: "fecha", label: "Fecha", render: (v: string) => formatDateTime(v) },
            { key: "clienteNombre", label: "Cliente" },
            { key: "litros", label: "Litros", render: (v: number) => `${formatNumber(v, 0)} L` },
            { key: "total", label: "Total", render: (v: number) => formatCurrency(v) },
            { key: "estadoPago", label: "Estado", render: (v: string) => labelEstadoPago(v) },
          ]}
          onEditar={(item) => setEditando({ tipo: "entrega", item })}
          onEliminar={(item) => eliminarRecurso("entrega", item.id, `entrega de ${item.clienteNombre}`)}
        />
      )}

      {/* Vueltas */}
      {subtab === "vueltas" && (
        <ListaConAcciones
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
          onEliminar={(item) => eliminarRecurso("vuelta", item.id, `vuelta #${item.numero}`)}
        />
      )}

      {/* Gastos */}
      {subtab === "gastos" && (
        <ListaConAcciones
          items={detalle.gastos}
          emptyText="Sin gastos"
          columns={[
            { key: "fecha", label: "Fecha", render: (v: string) => formatDateTime(v) },
            { key: "tipo", label: "Tipo", render: (v: string) => labelTipoGasto(v) },
            { key: "descripcion", label: "Descripción" },
            { key: "monto", label: "Monto", render: (v: number) => formatCurrency(v) },
            { key: "pagadoPor", label: "Pagado por" },
          ]}
          onEditar={(item) => setEditando({ tipo: "gasto", item })}
          onEliminar={(item) => eliminarRecurso("gasto", item.id, "gasto")}
        />
      )}

      {/* Pagos */}
      {subtab === "pagos" && (
        <ListaConAcciones
          items={detalle.pagos}
          emptyText="Sin pagos sueltos"
          columns={[
            { key: "fecha", label: "Fecha", render: (v: string) => formatDateTime(v) },
            { key: "cliente.nombre", label: "Cliente" },
            { key: "metodoPago", label: "Método" },
            { key: "monto", label: "Monto", render: (v: number) => formatCurrency(v) },
            { key: "nota", label: "Nota" },
          ]}
          onEditar={(item) => setEditando({ tipo: "pago", item })}
          onEliminar={(item) => eliminarRecurso("pago", item.id, "pago")}
        />
      )}

      {/* Config */}
      {subtab === "config" && (
        <div className="space-y-3 text-sm">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setEditandoConfig(true)}>
              <Pencil className="mr-1 h-3 w-3" /> Editar configuración
            </Button>
          </div>
          {detalle.config ? (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Datos</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Nombre dueño" value={detalle.config.nombreDueno || "—"} />
                  <Field label="Nombre chofer" value={detalle.config.nombreChofer || "—"} />
                  <Field label="Empresa" value={detalle.config.empresaRazonSocial || "—"} />
                  <Field label="RUT empresa" value={detalle.config.empresaRut || "—"} />
                  <Field label="Capacidad camión" value={`${formatNumber(detalle.config.capacidadCamion || 0, 0)} L`} />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Precios</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Precio efectivo/L" value={formatCurrency(detalle.config.precioEfectivoPorLitro || 0)} />
                  <Field label="Precio transferencia/L" value={formatCurrency(detalle.config.precioTransferenciaPorLitro || 0)} />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Pago al chofer</p>
                <div className="rounded border p-2 space-y-1">
                  {detalle.config.modoLiquidacion === "vuelta" ? (
                    <>
                      <p className="font-medium">Modo: Pago por vuelta completada</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Monto por vuelta (1 cliente)" value={formatCurrency(detalle.config.montoPorVueltaUnicoCliente || 0)} />
                        <Field label="Monto por vuelta (varios clientes)" value={formatCurrency(detalle.config.montoPorVueltaMultiple || 0)} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">El chofer cobra un monto fijo por cada vuelta completada, según si entregó a 1 o varios clientes.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Modo: Porcentaje de utilidad</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="% comisión chofer" value={`${detalle.config.porcentajeComisionChofer || 0}%`} />
                        <Field label="% comisión dueño" value={`${detalle.config.porcentajeComisionDueno || 0}%`} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">El chofer cobra un porcentaje de la utilidad bruta (ventas - gastos).</p>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sin configuración</p>
          )}
        </div>
      )}

      {/* Modal: Editar recurso */}
      {editando && (
        <EditarRecursoDialog
          tipo={editando.tipo}
          item={editando.item}
          adminId={detalle.admin.id}
          onOpenChange={(o) => !o && setEditando(null)}
          onSaved={() => { setEditando(null); onRecargar(); }}
        />
      )}

      {/* Modal: Crear recurso */}
      {creando && (
        <CrearRecursoDialog
          tipo={creando}
          adminId={detalle.admin.id}
          onOpenChange={(o) => !o && setCreando(null)}
          onSaved={() => { setCreando(null); onRecargar(); }}
        />
      )}

      {/* Modal: Editar config */}
      {editandoConfig && (
        <EditarConfigDialog
          config={detalle.config}
          adminId={detalle.admin.id}
          onOpenChange={(o) => !o && setEditandoConfig(false)}
          onSaved={() => { setEditandoConfig(false); onRecargar(); }}
        />
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

// === Lista con botones de editar/eliminar ===
function ListaConAcciones<T extends Record<string, any>>({
  items, emptyText, columns, onEditar, onEliminar,
}: {
  items: T[];
  emptyText: string;
  columns: { key: string; label: string; render?: (v: any) => string }[];
  onEditar?: (item: T) => void;
  onEliminar?: (item: T) => void;
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
            {(onEditar || onEliminar) && <th className="p-2"></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b last:border-0">
              {columns.map(c => {
                const v = getValue(item, c.key);
                return <td key={c.key} className="p-2">{c.render ? c.render(v) : (v == null ? "—" : String(v))}</td>;
              })}
              {(onEditar || onEliminar) && (
                <td className="p-2 whitespace-nowrap">
                  <div className="flex gap-1">
                    {onEditar && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEditar(item)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    {onEliminar && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => onEliminar(item)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// === Buscar global ===
function BuscarGlobal({ onAbrirAdmin }: { onAbrirAdmin: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function buscar() {
    if (q.trim().length < 2) {
      setResultados(null);
      return;
    }
    setLoading(true);
    try {
      const r = await apiGet<{ resultados: any }>(`/api/super-admin/global/buscar?q=${encodeURIComponent(q.trim())}`);
      setResultados(r.resultados);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al buscar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
          placeholder="Buscar cliente, chofer, camión, admin..."
          className="pl-8 h-9"
        />
      </div>
      <Button size="sm" onClick={buscar} disabled={loading || q.trim().length < 2}>
        {loading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Buscar
      </Button>

      {resultados && (
        <div className="space-y-4">
          {resultados.admins?.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground mb-1">Administradores ({resultados.admins.length})</p>
              <div className="space-y-1">
                {resultados.admins.map((a: any) => (
                  <button key={a.id} type="button" onClick={() => onAbrirAdmin(a.id)}
                    className="block w-full text-left rounded border p-2 text-sm hover:bg-muted">
                    <strong>{a.nombre}</strong> · {a.email} {a.telefono ? `· ${a.telefono}` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          {resultados.clientes?.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground mb-1">Clientes ({resultados.clientes.length})</p>
              <div className="space-y-1">
                {resultados.clientes.map((c: any) => (
                  <button key={c.id} type="button" onClick={() => onAbrirAdmin(c.dueno.id)}
                    className="block w-full text-left rounded border p-2 text-sm hover:bg-muted">
                    <strong>{c.nombre}</strong> · {c.telefono || "—"} · {c.zona || "—"}
                    <span className="block text-xs text-muted-foreground">Admin: {c.dueno.nombre}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {resultados.choferes?.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground mb-1">Choferes ({resultados.choferes.length})</p>
              <div className="space-y-1">
                {resultados.choferes.map((c: any) => (
                  <button key={c.id} type="button" onClick={() => c.dueno?.id && onAbrirAdmin(c.dueno.id)}
                    className="block w-full text-left rounded border p-2 text-sm hover:bg-muted">
                    <strong>{c.nombre}</strong> · {c.email} {c.telefono ? `· ${c.telefono}` : ""}
                    {c.dueno && <span className="block text-xs text-muted-foreground">Admin: {c.dueno.nombre}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {resultados.camiones?.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground mb-1">Camiones ({resultados.camiones.length})</p>
              <div className="space-y-1">
                {resultados.camiones.map((c: any) => (
                  <button key={c.id} type="button" onClick={() => onAbrirAdmin(c.dueno.id)}
                    className="block w-full text-left rounded border p-2 text-sm hover:bg-muted">
                    <strong>{c.nombre}</strong> · {c.patente || "—"} · {c.capacidad} L
                    <span className="block text-xs text-muted-foreground">Admin: {c.dueno.nombre}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {resultados.admins?.length === 0 && resultados.clientes?.length === 0 && resultados.choferes?.length === 0 && resultados.camiones?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sin resultados para "{q}"</p>
          )}
        </div>
      )}
    </div>
  );
}

// === Todas las entregas (global) ===
function EntregasGlobal() {
  const [entregas, setEntregas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ entregas: any[] }>("/api/super-admin/global/entregas?limit=200")
      .then((r) => setEntregas(r.entregas))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-40 rounded" />;

  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalEfectivo = entregas.reduce((s, e) => s + e.montoEfectivo, 0);
  const totalTransferencia = entregas.reduce((s, e) => s + e.montoTransferencia, 0);
  const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
        <Card><CardContent className="p-2"><p className="text-muted-foreground">Entregas</p><p className="font-bold">{entregas.length}</p></CardContent></Card>
        <Card><CardContent className="p-2"><p className="text-muted-foreground">Litros</p><p className="font-bold">{formatNumber(totalLitros, 0)} L</p></CardContent></Card>
        <Card><CardContent className="p-2"><p className="text-muted-foreground">Ventas</p><p className="font-bold">{formatCurrency(totalVentas)}</p></CardContent></Card>
        <Card><CardContent className="p-2"><p className="text-muted-foreground">Efectivo</p><p className="font-bold">{formatCurrency(totalEfectivo)}</p></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Cliente</th>
                  <th className="p-2">Admin</th>
                  <th className="p-2">Chofer</th>
                  <th className="p-2">Litros</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {entregas.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="p-2 whitespace-nowrap">{formatDateTime(e.fecha)}</td>
                    <td className="p-2">{e.clienteNombre}</td>
                    <td className="p-2">{e.dueno?.nombre || "—"}</td>
                    <td className="p-2">{e.chofer?.nombre || "—"}</td>
                    <td className="p-2">{formatNumber(e.litros, 0)} L</td>
                    <td className="p-2">{formatCurrency(e.total)}</td>
                    <td className="p-2">{labelEstadoPago(e.estadoPago)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// === Pagos pendientes global ===
function PendientesGlobal() {
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [totalPendiente, setTotalPendiente] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ pendientes: any[]; totalPendiente: number }>("/api/super-admin/global/pendientes")
      .then((r) => { setPendientes(r.pendientes); setTotalPendiente(r.totalPendiente); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-40 rounded" />;

  return (
    <div className="space-y-3">
      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/10">
        <CardContent className="p-3">
          <p className="text-xs uppercase text-muted-foreground">Total pendiente de cobro</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(totalPendiente)}</p>
          <p className="text-xs text-muted-foreground mt-1">{pendientes.length} clientes con saldo</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Cliente</th>
                  <th className="p-2">Teléfono</th>
                  <th className="p-2">Zona</th>
                  <th className="p-2">Admin</th>
                  <th className="p-2">Ventas</th>
                  <th className="p-2">Recibido</th>
                  <th className="p-2">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="p-2 font-medium">{c.nombre}</td>
                    <td className="p-2">{c.telefono || "—"}</td>
                    <td className="p-2">{c.zona || "—"}</td>
                    <td className="p-2">{c.admin?.nombre || "—"}</td>
                    <td className="p-2">{formatCurrency(c.totalVentas)}</td>
                    <td className="p-2">{formatCurrency(c.totalRecibido)}</td>
                    <td className="p-2 font-bold text-amber-600">{formatCurrency(c.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// === Editar recurso (cliente, chofer, camion, entrega, gasto, pago) ===
function EditarRecursoDialog({ tipo, item, adminId, onOpenChange, onSaved }: {
  tipo: string; item: any; adminId: string;
  onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const [data, setData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Inicializar con los valores del item
    if (tipo === "cliente") setData({ nombre: item.nombre || "", rut: item.rut || "", direccion: item.direccion || "", telefono: item.telefono || "", email: item.email || "", zona: item.zona || "", precioEfectivoPorLitro: item.precioEfectivoPorLitro || 0, precioTransferenciaPorLitro: item.precioTransferenciaPorLitro || 0 });
    else if (tipo === "chofer") setData({ nombre: item.nombre || "", email: item.email || "", telefono: item.telefono || "", activo: item.activo, password: "" });
    else if (tipo === "camion") setData({ nombre: item.nombre || "", patente: item.patente || "", capacidad: item.capacidad || 17000, activo: item.activo, marca: item.marca || "", modelo: item.modelo || "", anio: item.anio || "", color: item.color || "" });
    else if (tipo === "entrega") setData({ litros: item.litros || 0, total: item.total || 0, montoEfectivo: item.montoEfectivo || 0, montoTransferencia: item.montoTransferencia || 0, estadoPago: item.estadoPago || "pendiente", nota: item.nota || "" });
    else if (tipo === "gasto") setData({ tipo: item.tipo || "", descripcion: item.descripcion || "", monto: item.monto || 0, pagadoPor: item.pagadoPor || "chofer" });
    else if (tipo === "pago") setData({ monto: item.monto || 0, metodoPago: item.metodoPago || "efectivo", nota: item.nota || "" });
  }, [item, tipo]);

  async function handleSave() {
    setSaving(true);
    try {
      await apiPatch(`/api/super-admin/administradores/${adminId}/recurso?tipo=${tipo}&itemId=${item.id}`, data);
      toast.success("Actualizado");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setSaving(false);
    }
  }

  const titles: Record<string, string> = {
    cliente: "Editar cliente", chofer: "Editar chofer", camion: "Editar camión",
    entrega: "Editar entrega", gasto: "Editar gasto", pago: "Editar pago",
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titles[tipo] || "Editar"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {tipo === "cliente" && (
            <>
              <FormField label="Nombre" value={data.nombre} onChange={(v) => setData({ ...data, nombre: v })} />
              <FormField label="RUT" value={data.rut} onChange={(v) => setData({ ...data, rut: v })} />
              <FormField label="Teléfono" value={data.telefono} onChange={(v) => setData({ ...data, telefono: v })} />
              <FormField label="Email" value={data.email} onChange={(v) => setData({ ...data, email: v })} />
              <FormField label="Zona" value={data.zona} onChange={(v) => setData({ ...data, zona: v })} />
              <FormField label="Dirección" value={data.direccion} onChange={(v) => setData({ ...data, direccion: v })} />
              <FormField label="Precio efectivo/L" value={String(data.precioEfectivoPorLitro)} onChange={(v) => setData({ ...data, precioEfectivoPorLitro: Number(v) || 0 })} type="number" />
              <FormField label="Precio transferencia/L" value={String(data.precioTransferenciaPorLitro)} onChange={(v) => setData({ ...data, precioTransferenciaPorLitro: Number(v) || 0 })} type="number" />
            </>
          )}
          {tipo === "chofer" && (
            <>
              <FormField label="Nombre" value={data.nombre} onChange={(v) => setData({ ...data, nombre: v })} />
              <FormField label="Email" value={data.email} onChange={(v) => setData({ ...data, email: v })} />
              <FormField label="Teléfono" value={data.telefono} onChange={(v) => setData({ ...data, telefono: v })} />
              <FormField label="Password nuevo (vacío = no cambiar)" value={data.password} onChange={(v) => setData({ ...data, password: v })} type="password" />
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={!!data.activo} onChange={(e) => setData({ ...data, activo: e.target.checked })} /> Activo
              </label>
            </>
          )}
          {tipo === "camion" && (
            <>
              <FormField label="Nombre" value={data.nombre} onChange={(v) => setData({ ...data, nombre: v })} />
              <FormField label="Patente" value={data.patente} onChange={(v) => setData({ ...data, patente: v })} />
              <FormField label="Capacidad (L)" value={String(data.capacidad)} onChange={(v) => setData({ ...data, capacidad: Number(v) || 17000 })} type="number" />
              <FormField label="Marca" value={data.marca} onChange={(v) => setData({ ...data, marca: v })} />
              <FormField label="Modelo" value={data.modelo} onChange={(v) => setData({ ...data, modelo: v })} />
              <FormField label="Año" value={String(data.anio)} onChange={(v) => setData({ ...data, anio: Number(v) || null })} type="number" />
              <FormField label="Color" value={data.color} onChange={(v) => setData({ ...data, color: v })} />
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={!!data.activo} onChange={(e) => setData({ ...data, activo: e.target.checked })} /> Activo
              </label>
            </>
          )}
          {tipo === "entrega" && (
            <>
              <FormField label="Litros" value={String(data.litros)} onChange={(v) => setData({ ...data, litros: Number(v) || 0 })} type="number" />
              <FormField label="Total" value={String(data.total)} onChange={(v) => setData({ ...data, total: Number(v) || 0 })} type="number" />
              <FormField label="Efectivo" value={String(data.montoEfectivo)} onChange={(v) => setData({ ...data, montoEfectivo: Number(v) || 0 })} type="number" />
              <FormField label="Transferencia" value={String(data.montoTransferencia)} onChange={(v) => setData({ ...data, montoTransferencia: Number(v) || 0 })} type="number" />
              <div>
                <Label className="text-xs">Estado de pago</Label>
                <select className="w-full h-9 rounded border bg-background px-2 text-sm" value={data.estadoPago} onChange={(e) => setData({ ...data, estadoPago: e.target.value })}>
                  <option value="pendiente">Pendiente</option>
                  <option value="parcial">Parcial</option>
                  <option value="pagado">Pagado</option>
                </select>
              </div>
              <FormField label="Nota" value={data.nota} onChange={(v) => setData({ ...data, nota: v })} />
            </>
          )}
          {tipo === "gasto" && (
            <>
              <div>
                <Label className="text-xs">Tipo</Label>
                <select className="w-full h-9 rounded border bg-background px-2 text-sm" value={data.tipo} onChange={(e) => setData({ ...data, tipo: e.target.value })}>
                  <option value="combustible">Combustible</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="peaje">Peaje</option>
                  <option value="comida">Comida</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <FormField label="Descripción" value={data.descripcion} onChange={(v) => setData({ ...data, descripcion: v })} />
              <FormField label="Monto" value={String(data.monto)} onChange={(v) => setData({ ...data, monto: Number(v) || 0 })} type="number" />
              <div>
                <Label className="text-xs">Pagado por</Label>
                <select className="w-full h-9 rounded border bg-background px-2 text-sm" value={data.pagadoPor} onChange={(e) => setData({ ...data, pagadoPor: e.target.value })}>
                  <option value="chofer">Chofer</option>
                  <option value="dueno">Dueño</option>
                </select>
              </div>
            </>
          )}
          {tipo === "pago" && (
            <>
              <FormField label="Monto" value={String(data.monto)} onChange={(v) => setData({ ...data, monto: Number(v) || 0 })} type="number" />
              <div>
                <Label className="text-xs">Método de pago</Label>
                <select className="w-full h-9 rounded border bg-background px-2 text-sm" value={data.metodoPago} onChange={(e) => setData({ ...data, metodoPago: e.target.value })}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="mixto">Mixto</option>
                </select>
              </div>
              <FormField label="Nota" value={data.nota} onChange={(v) => setData({ ...data, nota: v })} />
            </>
          )}
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

// === Crear recurso (cliente, chofer, camion) ===
function CrearRecursoDialog({ tipo, adminId, onOpenChange, onSaved }: {
  tipo: string; adminId: string;
  onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const [data, setData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tipo === "cliente") setData({ nombre: "", rut: "", telefono: "", direccion: "", zona: "", email: "", precioEfectivoPorLitro: 0, precioTransferenciaPorLitro: 0 });
    else if (tipo === "chofer") setData({ nombre: "", email: "", telefono: "", password: "", activo: true });
    else if (tipo === "camion") setData({ nombre: "", patente: "", capacidad: 17000, activo: true, marca: "", modelo: "", anio: "", color: "" });
  }, [tipo]);

  async function handleSave() {
    setSaving(true);
    try {
      await apiPost(`/api/super-admin/administradores/${adminId}/recurso?tipo=${tipo}`, data);
      toast.success("Creado");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear");
    } finally {
      setSaving(false);
    }
  }

  const titles: Record<string, string> = { cliente: "Nuevo cliente", chofer: "Nuevo chofer", camion: "Nuevo camión" };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titles[tipo] || "Nuevo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {tipo === "cliente" && (
            <>
              <FormField label="Nombre *" value={data.nombre} onChange={(v) => setData({ ...data, nombre: v })} />
              <FormField label="RUT" value={data.rut} onChange={(v) => setData({ ...data, rut: v })} />
              <FormField label="Teléfono" value={data.telefono} onChange={(v) => setData({ ...data, telefono: v })} />
              <FormField label="Email" value={data.email} onChange={(v) => setData({ ...data, email: v })} />
              <FormField label="Zona" value={data.zona} onChange={(v) => setData({ ...data, zona: v })} />
              <FormField label="Dirección" value={data.direccion} onChange={(v) => setData({ ...data, direccion: v })} />
              <FormField label="Precio efectivo/L" value={String(data.precioEfectivoPorLitro)} onChange={(v) => setData({ ...data, precioEfectivoPorLitro: Number(v) || 0 })} type="number" />
              <FormField label="Precio transferencia/L" value={String(data.precioTransferenciaPorLitro)} onChange={(v) => setData({ ...data, precioTransferenciaPorLitro: Number(v) || 0 })} type="number" />
            </>
          )}
          {tipo === "chofer" && (
            <>
              <FormField label="Nombre *" value={data.nombre} onChange={(v) => setData({ ...data, nombre: v })} />
              <FormField label="Email *" value={data.email} onChange={(v) => setData({ ...data, email: v })} />
              <FormField label="Teléfono" value={data.telefono} onChange={(v) => setData({ ...data, telefono: v })} />
              <FormField label="Password *" value={data.password} onChange={(v) => setData({ ...data, password: v })} type="password" />
            </>
          )}
          {tipo === "camion" && (
            <>
              <FormField label="Nombre *" value={data.nombre} onChange={(v) => setData({ ...data, nombre: v })} />
              <FormField label="Patente" value={data.patente} onChange={(v) => setData({ ...data, patente: v })} />
              <FormField label="Capacidad (L) *" value={String(data.capacidad)} onChange={(v) => setData({ ...data, capacidad: Number(v) || 17000 })} type="number" />
              <FormField label="Marca" value={data.marca} onChange={(v) => setData({ ...data, marca: v })} />
              <FormField label="Modelo" value={data.modelo} onChange={(v) => setData({ ...data, modelo: v })} />
              <FormField label="Color" value={data.color} onChange={(v) => setData({ ...data, color: v })} />
            </>
          )}
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

// === Editar configuración del admin ===
function EditarConfigDialog({ config, adminId, onOpenChange, onSaved }: {
  config: any; adminId: string;
  onOpenChange: (o: boolean) => void; onSaved: () => void;
}) {
  const [data, setData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setData({
        nombreDueno: config.nombreDueno || "",
        nombreChofer: config.nombreChofer || "",
        empresaRazonSocial: config.empresaRazonSocial || "",
        empresaRut: config.empresaRut || "",
        capacidadCamion: config.capacidadCamion || 17000,
        modoLiquidacion: config.modoLiquidacion || "porcentaje",
        porcentajeComisionChofer: config.porcentajeComisionChofer || 0,
        porcentajeComisionDueno: config.porcentajeComisionDueno || 0,
        montoPorVueltaUnicoCliente: config.montoPorVueltaUnicoCliente || 0,
        montoPorVueltaMultiple: config.montoPorVueltaMultiple || 0,
        precioEfectivoPorLitro: config.precioEfectivoPorLitro || 0,
        precioTransferenciaPorLitro: config.precioTransferenciaPorLitro || 0,
      });
    }
  }, [config]);

  async function handleSave() {
    setSaving(true);
    try {
      await apiPatch(`/api/super-admin/administradores/${adminId}/config`, data);
      toast.success("Configuración guardada");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar configuración</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Datos</p>
          <FormField label="Nombre dueño" value={data.nombreDueno} onChange={(v) => setData({ ...data, nombreDueno: v })} />
          <FormField label="Nombre chofer" value={data.nombreChofer} onChange={(v) => setData({ ...data, nombreChofer: v })} />
          <FormField label="Empresa" value={data.empresaRazonSocial} onChange={(v) => setData({ ...data, empresaRazonSocial: v })} />
          <FormField label="RUT empresa" value={data.empresaRut} onChange={(v) => setData({ ...data, empresaRut: v })} />
          <FormField label="Capacidad camión (L)" value={String(data.capacidadCamion)} onChange={(v) => setData({ ...data, capacidadCamion: Number(v) || 17000 })} type="number" />

          <p className="text-xs font-medium uppercase text-muted-foreground pt-2">Precios</p>
          <FormField label="Precio efectivo/L" value={String(data.precioEfectivoPorLitro)} onChange={(v) => setData({ ...data, precioEfectivoPorLitro: Number(v) || 0 })} type="number" />
          <FormField label="Precio transferencia/L" value={String(data.precioTransferenciaPorLitro)} onChange={(v) => setData({ ...data, precioTransferenciaPorLitro: Number(v) || 0 })} type="number" />

          <p className="text-xs font-medium uppercase text-muted-foreground pt-2">Pago al chofer</p>
          <div>
            <Label className="text-xs">Modo de liquidación</Label>
            <select className="w-full h-9 rounded border bg-background px-2 text-sm" value={data.modoLiquidacion} onChange={(e) => setData({ ...data, modoLiquidacion: e.target.value })}>
              <option value="porcentaje">Porcentaje de utilidad</option>
              <option value="vuelta">Pago por vuelta completada</option>
            </select>
          </div>
          {data.modoLiquidacion === "vuelta" ? (
            <>
              <FormField label="Monto por vuelta (1 cliente)" value={String(data.montoPorVueltaUnicoCliente)} onChange={(v) => setData({ ...data, montoPorVueltaUnicoCliente: Number(v) || 0 })} type="number" />
              <FormField label="Monto por vuelta (varios clientes)" value={String(data.montoPorVueltaMultiple)} onChange={(v) => setData({ ...data, montoPorVueltaMultiple: Number(v) || 0 })} type="number" />
            </>
          ) : (
            <>
              <FormField label="% comisión chofer" value={String(data.porcentajeComisionChofer)} onChange={(v) => setData({ ...data, porcentajeComisionChofer: Number(v) || 0 })} type="number" />
              <FormField label="% comisión dueño" value={String(data.porcentajeComisionDueno)} onChange={(v) => setData({ ...data, porcentajeComisionDueno: Number(v) || 0 })} type="number" />
            </>
          )}
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

// === Helper: campo de formulario ===
function FormField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// === Cargas de saldo pendientes ===
function CargasPendientesGlobal() {
  const [cargas, setCargas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPendiente, setTotalPendiente] = useState(0);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ pendientes: any[]; totalPendiente: number }>("/api/super-admin/saldo/pendientes");
      setCargas(r.pendientes || []);
      setTotalPendiente(r.totalPendiente || 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function confirmar(id: string) {
    try {
      await apiPost(`/api/super-admin/saldo/${id}/confirmar`, {});
      toast.success("Carga confirmada — saldo acreditado al cliente");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo confirmar");
    }
  }

  async function rechazar(id: string) {
    const motivo = prompt("Motivo de rechazo (opcional):") || "";
    try {
      await apiPost(`/api/super-admin/saldo/${id}/rechazar`, { motivo });
      toast.success("Carga rechazada");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo rechazar");
    }
  }

  if (loading) return <Skeleton className="h-40 rounded" />;

  return (
    <div className="space-y-3">
      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/10">
        <CardContent className="p-3">
          <p className="text-xs uppercase text-muted-foreground">Total pendiente de confirmar</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(totalPendiente)}</p>
          <p className="text-xs text-muted-foreground mt-1">{cargas.length} cargas por confirmar</p>
        </CardContent>
      </Card>

      {cargas.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No hay cargas de saldo pendientes. Todo al día.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {cargas.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{formatCurrency(c.monto)}</span>
                      <Badge variant="outline" className="text-[10px]">{c.metodoCarga}</Badge>
                    </div>
                    <p className="text-sm font-medium mt-1">{c.cliente?.nombre}</p>
                    <p className="text-xs text-muted-foreground">{c.cliente?.email}</p>
                    {c.cliente?.telefono && <p className="text-xs text-muted-foreground">{c.cliente.telefono}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Saldo actual del cliente: <strong>{formatCurrency(c.cliente?.saldo || 0)}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Solicitada: {new Date(c.creadoEn).toLocaleString("es-CL", { timeZone: "America/Santiago" })}
                    </p>
                    {c.comprobanteUrl && (
                      <a href={c.comprobanteUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-xs text-primary underline">
                        Ver comprobante
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="sm" onClick={() => confirmar(c.id)}>
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Confirmar
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => rechazar(c.id)}>
                      <X className="mr-1 h-3 w-3" /> Rechazar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// === Zonas Admin ===
function ZonasAdmin() {
  const [zonas, setZonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);

  // Form
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precioPorLitro, setPrecioPorLitro] = useState("");
  const [centroLat, setCentroLat] = useState("");
  const [centroLng, setCentroLng] = useState("");
  const [radioKm, setRadioKm] = useState("");
  const [activa, setActiva] = useState(true);
  const [importarKmlOpen, setImportarKmlOpen] = useState(false);
  const [kmlFile, setKmlFile] = useState<File | null>(null);
  const [kmlPrecio, setKmlPrecio] = useState("9");
  const [kmlNombre, setKmlNombre] = useState("");
  const [importando, setImportando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ zonas: any[] }>("/api/super-admin/zonas");
      setZonas(r.zonas || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function abrirCrear() {
    setNombre(""); setDescripcion(""); setPrecioPorLitro(""); setCentroLat(""); setCentroLng(""); setRadioKm(""); setActiva(true);
    setCreando(true);
  }

  function abrirEditar(z: any) {
    setNombre(z.nombre); setDescripcion(z.descripcion || ""); setPrecioPorLitro(String(z.precioPorLitro));
    setCentroLat(z.centroLat ? String(z.centroLat) : ""); setCentroLng(z.centroLng ? String(z.centroLng) : "");
    setRadioKm(z.radioKm ? String(z.radioKm) : ""); setActiva(z.activa);
    setEditando(z);
  }

  async function guardar() {
    if (!nombre.trim() || !precioPorLitro) {
      toast.error("Nombre y precio son obligatorios");
      return;
    }
    const data = {
      nombre, descripcion, precioPorLitro: Number(precioPorLitro),
      centroLat: centroLat ? Number(centroLat) : null,
      centroLng: centroLng ? Number(centroLng) : null,
      radioKm: radioKm ? Number(radioKm) : null, activa,
    };
    try {
      if (editando) {
        await apiPatch(`/api/super-admin/zonas/${editando.id}`, data);
        toast.success("Zona actualizada");
        setEditando(null);
      } else {
        await apiPost("/api/super-admin/zonas", data);
        toast.success("Zona creada");
        setCreando(false);
      }
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    }
  }

  async function eliminar(z: any) {
    if (!confirm(`¿Eliminar zona ${z.nombre}?`)) return;
    try {
      await apiDelete(`/api/super-admin/zonas/${z.id}`);
      toast.success("Zona eliminada");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  if (loading) return <Skeleton className="h-40 rounded" />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setImportarKmlOpen(true)}>
          <Upload className="mr-1 h-4 w-4" /> Importar KML
        </Button>
        <Button size="sm" onClick={abrirCrear}><Plus className="mr-1 h-4 w-4" /> Nueva zona</Button>
      </div>

      {zonas.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No hay zonas creadas.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {zonas.map(z => (
            <Card key={z.id} className={!z.activa ? "opacity-60" : ""}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{z.nombre}</span>
                      {!z.activa && <Badge variant="outline" className="text-[10px]">Inactiva</Badge>}
                    </div>
                    {z.descripcion && <p className="text-xs text-muted-foreground mt-0.5">{z.descripcion}</p>}
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Precio: <strong>{formatCurrency(z.precioPorLitro)}/L</strong></span>
                      {z.centroLat && z.centroLng && <span>Centro: {z.centroLat}, {z.centroLng}</span>}
                      {z.radioKm && <span>Radio: {z.radioKm} km</span>}
                      <span>Clientes: {z._count?.clientesApp || 0}</span>
                      <span>Pedidos: {z._count?.pedidosApp || 0}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => abrirEditar(z)}><Pencil className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => eliminar(z)}><Trash2 className="mr-2 h-4 w-4" /> Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={creando || !!editando} onOpenChange={(o) => { if (!o) { setCreando(false); setEditando(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar zona" : "Nueva zona"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nombre *</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Las Condes" /></div>
            <div><Label className="text-xs">Descripción</Label><Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
            <div><Label className="text-xs">Precio por litro (incluye 10% comisión) *</Label><Input type="number" step="0.1" value={precioPorLitro} onChange={(e) => setPrecioPorLitro(e.target.value)} placeholder="Ej: 8.7" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Latitud centro</Label><Input value={centroLat} onChange={(e) => setCentroLat(e.target.value)} placeholder="-33.45" /></div>
              <div><Label className="text-xs">Longitud centro</Label><Input value={centroLng} onChange={(e) => setCentroLng(e.target.value)} placeholder="-70.66" /></div>
            </div>
            <div><Label className="text-xs">Radio de cobertura (km)</Label><Input type="number" step="0.5" value={radioKm} onChange={(e) => setRadioKm(e.target.value)} placeholder="Ej: 10" /></div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={activa} onCheckedChange={setActiva} /> Activa</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreando(false); setEditando(null); }}>Cancelar</Button>
            <Button onClick={guardar}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog importar KML */}
      <Dialog open={importarKmlOpen} onOpenChange={(o) => { setImportarKmlOpen(o); if (!o) { setKmlFile(null); setKmlNombre(""); setKmlPrecio("9"); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar zona desde KML</DialogTitle>
            <DialogDescription>
              Subí un archivo KML exportado desde Google Earth. El polígono se convertirá automáticamente en una zona de cobertura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Archivo KML *</Label>
              <input
                type="file"
                accept=".kml"
                onChange={(e) => setKmlFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground hover:file:bg-primary/90"
              />
              {kmlFile && (
                <p className="mt-1 text-xs text-emerald-600">✓ {kmlFile.name} ({(kmlFile.size / 1024).toFixed(1)} KB)</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Nombre de la zona (opcional — se usa el del KML si no se completa)</Label>
              <Input value={kmlNombre} onChange={(e) => setKmlNombre(e.target.value)} placeholder="Ej: Zona Cruz de Caña" />
            </div>
            <div>
              <Label className="text-xs">Precio por litro *</Label>
              <Input type="number" step="0.1" value={kmlPrecio} onChange={(e) => setKmlPrecio(e.target.value)} placeholder="9" />
            </div>
            <div className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
              <p><strong>Cómo exportar desde Google Earth:</strong></p>
              <ol className="ml-4 list-decimal space-y-0.5 mt-1">
                <li>Dibujá un polígono en Google Earth</li>
                <li>Clic derecho → Guardar lugar como...</li>
                <li>Tipo: KML (*.kml)</li>
                <li>Subí el archivo acá</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportarKmlOpen(false)}>Cancelar</Button>
            <Button
              disabled={!kmlFile || importando}
              onClick={async () => {
                if (!kmlFile) return;
                setImportando(true);
                try {
                  const formData = new FormData();
                  formData.append("file", kmlFile);
                  if (kmlNombre.trim()) formData.append("nombre", kmlNombre.trim());
                  formData.append("precioPorLitro", kmlPrecio);
                  const res = await fetch("/api/super-admin/zonas/importar-kml", {
                    method: "POST",
                    body: formData,
                    headers: { Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("aljibe-token") : ""}` },
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Error al importar");
                  toast.success(data.message || "Zona importada");
                  setImportarKmlOpen(false);
                  setKmlFile(null);
                  setKmlNombre("");
                  cargar();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "No se pudo importar");
                } finally {
                  setImportando(false);
                }
              }}
            >
              {importando ? "Importando…" : "Importar zona"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === Planes Admin ===
function PlanesAdmin() {
  const [planes, setPlanes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<any[]>([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        apiGet<{ planes: any[] }>("/api/super-admin/planes"),
        apiGet<any>("/api/super-admin/stats"),
      ]);
      setPlanes(p.planes || []);
      setAdmins(s.administradores || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function cambiarPlan(duenoId: string, planId: string) {
    try {
      await apiPatch(`/api/super-admin/administradores/${duenoId}/config`, { planId });
      toast.success("Plan actualizado");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar");
    }
  }

  if (loading) return <Skeleton className="h-40 rounded" />;

  return (
    <div className="space-y-4">
      {/* Lista de planes */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Planes disponibles</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {planes.map(p => (
            <Card key={p.id} className={p.id === "pro" ? "border-primary" : ""}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base">{p.nombre}</span>
                  {p.id === "pro" && <Badge className="text-[10px]">Recomendado</Badge>}
                </div>
                <p className="text-2xl font-bold tabular-nums">{formatCurrency(p.precioMensual)}<span className="text-xs text-muted-foreground">/mes</span></p>
                <div className="space-y-1 text-xs">
                  <p>Camiones: {p.maxCamiones === -1 ? "Ilimitados" : p.maxCamiones}</p>
                  <p>Choferes: {p.maxChoferes === -1 ? "Ilimitados" : p.maxChoferes}</p>
                  <p>Pool de pedidos: {p.accesoPool ? "✓" : "✗"}</p>
                  {p.costoExtraCamion && <p>Extra camión: {formatCurrency(p.costoExtraCamion)}</p>}
                  {p.costoExtraChofer && <p>Extra chofer: {formatCurrency(p.costoExtraChofer)}</p>}
                </div>
                <p className="text-xs text-muted-foreground">{p._count?.configuraciones || 0} admin(s) con este plan</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Asignar plan a admins */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Asignar plan a administradores</h3>
        <div className="space-y-2">
          {admins.map(a => (
            <Card key={a.id}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{a.nombre}</p>
                  <p className="text-xs text-muted-foreground">{a.email}</p>
                </div>
                <select
                  defaultValue=""
                  onChange={(e) => e.target.value && cambiarPlan(a.id, e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="">Cambiar plan…</option>
                  {planes.map(p => <option key={p.id} value={p.id}>{p.nombre} ({formatCurrency(p.precioMensual)}/mes)</option>)}
                </select>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// === Facturas Admin ===
function FacturasAdmin() {
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ facturas: any[] }>("/api/super-admin/facturas");
      setFacturas(r.facturas || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return <Skeleton className="h-40 rounded" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Facturas de administradores</h3>
        <p className="text-xs text-muted-foreground">{facturas.length} factura(s)</p>
      </div>

      {facturas.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No hay facturas generadas todavía.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {facturas.map(f => (
            <Card key={f.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{f.dueno?.nombre || "—"}</span>
                      <Badge variant="outline" className="text-[10px]">{f.estado}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Período: {formatDate(f.periodoStart)} a {formatDate(f.periodoEnd)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs">
                      <span>Total vendido: <strong>{formatCurrency(f.totalVentas)}</strong></span>
                      <span>Comisión app: <strong>{formatCurrency(f.comisionApp)}</strong></span>
                      <span>Monto facturado: <strong>{formatCurrency(f.montoFacturado)}</strong></span>
                      <span>Pagado: <strong>{formatCurrency(f.montoPagado)}</strong></span>
                      <span className="text-amber-600">Pendiente: <strong>{formatCurrency(f.saldoPendiente)}</strong></span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ====== Componente: Auditoría ======
function AuditView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [filtros, setFiltros] = useState({
    entidad: "",
    accion: "",
    q: "",
    desde: "",
    hasta: "",
  });
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (filtros.entidad) params.set("entidad", filtros.entidad);
      if (filtros.accion) params.set("accion", filtros.accion);
      if (filtros.q) params.set("q", filtros.q);
      if (filtros.desde) params.set("desde", filtros.desde);
      if (filtros.hasta) params.set("hasta", filtros.hasta);
      const data = await apiGet<{ logs: any[]; total: number; stats: any }>(`/api/super-admin/audit?${params.toString()}`);
      setLogs(data.logs);
      setTotal(data.total);
      setStats(data.stats);
    } catch (e) {
      toast.error("No se pudo cargar la auditoría");
    } finally {
      setLoading(false);
    }
  }, [filtros, offset]);

  useEffect(() => { cargar(); }, [cargar]);

  function aplicarFiltros() {
    setOffset(0);
    cargar();
  }

  function limpiarFiltros() {
    setFiltros({ entidad: "", accion: "", q: "", desde: "", hasta: "" });
    setOffset(0);
  }

  const ACCIONES = ["crear", "actualizar", "eliminar", "activar", "desactivar", "cerrar_periodo", "login", "logout"];
  const ENTIDADES = ["administrador", "usuario", "chofer", "camion", "cliente", "entrega", "vuelta", "gasto", "pago", "configuracion", "zona", "plan", "factura"];

  // Color según acción
  const colorAccion: Record<string, string> = {
    crear: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    actualizar: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    eliminar: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    activar: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    desactivar: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    cerrar_periodo: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    login: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
    logout: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Entidad</Label>
              <select
                value={filtros.entidad}
                onChange={(e) => setFiltros({ ...filtros, entidad: e.target.value })}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Todas</option>
                {ENTIDADES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Acción</Label>
              <select
                value={filtros.accion}
                onChange={(e) => setFiltros({ ...filtros, accion: e.target.value })}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Todas</option>
                {ACCIONES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Desde</Label>
              <Input type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Hasta</Label>
              <Input type="date" value={filtros.hasta} onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Buscar en descripción..."
              value={filtros.q}
              onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && aplicarFiltros()}
            />
            <Button size="sm" onClick={aplicarFiltros}>
              <Search className="mr-1 h-4 w-4" /> Filtrar
            </Button>
            <Button size="sm" variant="outline" onClick={limpiarFiltros}>
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats rápidas */}
      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Card>
            <CardContent className="p-2.5">
              <p className="text-[10px] uppercase text-muted-foreground">Total registros</p>
              <p className="text-lg font-bold">{total}</p>
            </CardContent>
          </Card>
          {stats.acciones?.slice(0, 3).map((a: any) => (
            <Card key={a.accion}>
              <CardContent className="p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground">{a.accion}</p>
                <p className="text-lg font-bold">{a.count}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Lista de logs */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded" />)}
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No hay registros de auditoría con estos filtros.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colorAccion[log.accion] || "bg-muted text-muted-foreground"}`}>
                        {log.accion}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{log.entidad}</Badge>
                      {log.entidadNombre && (
                        <span className="text-xs font-medium truncate">{log.entidadNombre}</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm">{log.descripcion}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                      <span>👤 {log.actorNombre} ({log.actorRole})</span>
                      {log.actorEmail && <span>✉️ {log.actorEmail}</span>}
                      <span>🕐 {formatDateTime(log.creadoEn)}</span>
                      {log.ip && <span>🌐 {log.ip}</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Paginación */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Mostrando {offset + 1}–{Math.min(offset + limit, total)} de {total}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                ← Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
              >
                Siguiente →
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === Cupones de Descuento ===
interface Cupon {
  id: string;
  codigo: string;
  descripcion: string | null;
  tipo: string;
  valor: number;
  montoMinimo: number | null;
  usosMaximos: number | null;
  usosActuales: number;
  activo: boolean;
  validoDesde: string | null;
  validoHasta: string | null;
  creadoEn: string;
  zonaId: string | null;
  zona?: { id: string; nombre: string } | null;
}

function CuponesAdmin() {
  const [cupones, setCupones] = useState<Cupon[]>([]);
  const [zonas, setZonas] = useState<Array<{ id: string; nombre: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [inactivos, setInactivos] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<Cupon | null>(null);
  const [eliminando, setEliminando] = useState<Cupon | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [c, z] = await Promise.all([
        apiGet<{ cupones: Cupon[] }>(`/api/super-admin/cupones${inactivos ? "?inactivos=1" : ""}`),
        apiGet<{ zonas: Array<{ id: string; nombre: string }> }>("/api/super-admin/zonas"),
      ]);
      setCupones(c.cupones || []);
      setZonas(z.zonas || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [inactivos]);

  useEffect(() => { cargar(); }, [cargar]);

  async function toggleActivo(c: Cupon) {
    try {
      await apiPatch(`/api/super-admin/cupones/${c.id}`, { activo: !c.activo });
      toast.success(c.activo ? "Cupón desactivado" : "Cupón activado");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar");
    }
  }

  async function eliminar(c: Cupon) {
    try {
      await apiDelete(`/api/super-admin/cupones/${c.id}`);
      toast.success("Cupón eliminado");
      setEliminando(null);
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  if (loading) return <Skeleton className="h-40 rounded" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold">Cupones de descuento</h3>
          <p className="text-xs text-muted-foreground">{cupones.length} cupón(es) · aplicables a pedidos de la app cliente</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <Switch checked={inactivos} onCheckedChange={setInactivos} />
            Mostrar inactivos
          </label>
          <Button size="sm" onClick={() => setCreando(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nuevo cupón
          </Button>
        </div>
      </div>

      {cupones.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <Ticket className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No hay cupones creados todavía.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {cupones.map((c) => {
            const hoy = new Date();
            const expirado = c.validoHasta ? new Date(c.validoHasta) < hoy : false;
            const futuro = c.validoDesde ? new Date(c.validoDesde) > hoy : false;
            const usosLlenos = c.usosMaximos != null && c.usosActuales >= c.usosMaximos;
            return (
              <Card key={c.id} className={!c.activo ? "opacity-60" : ""}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-sm uppercase">{c.codigo}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {c.tipo === "porcentaje" ? `${c.valor}%` : formatCurrency(c.valor)}
                        </Badge>
                        {c.tipo === "porcentaje" ? "Porcentaje" : "Monto fijo"}
                        {!c.activo && <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactivo</Badge>}
                        {expirado && <Badge variant="outline" className="text-[10px] text-amber-700">Expirado</Badge>}
                        {futuro && <Badge variant="outline" className="text-[10px] text-blue-700">Programado</Badge>}
                        {usosLlenos && <Badge variant="outline" className="text-[10px] text-amber-700">Sin usos disponibles</Badge>}
                      </div>
                      {c.descripcion && (
                        <p className="text-xs text-muted-foreground mt-1">{c.descripcion}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {c.montoMinimo != null && <span>Mínimo: <strong>{formatCurrency(c.montoMinimo)}</strong></span>}
                        <span>Usos: <strong>{c.usosActuales}{c.usosMaximos != null ? ` / ${c.usosMaximos}` : " (∞)"}</strong></span>
                        {c.validoDesde && <span>Desde: <strong>{formatDate(c.validoDesde)}</strong></span>}
                        {c.validoHasta && <span>Hasta: <strong>{formatDate(c.validoHasta)}</strong></span>}
                        {c.zona && <span>Zona: <strong>{c.zona.nombre}</strong></span>}
                        {c.zonaId && !c.zona && <span className="text-amber-600">Zona eliminada</span>}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toggleActivo(c)}>
                          {c.activo ? <><UserX className="mr-2 h-4 w-4" /> Desactivar</> : <><UserCheck className="mr-2 h-4 w-4" /> Activar</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditando(c)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setEliminando(c)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(creando || editando) && (
        <CuponDialog
          cupon={editando}
          zonas={zonas}
          onClose={() => { setCreando(false); setEditando(null); }}
          onGuardado={() => { setCreando(false); setEditando(null); cargar(); }}
        />
      )}

      {eliminando && (
        <Dialog open onOpenChange={(o) => !o && setEliminando(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Eliminar cupón</DialogTitle>
              <DialogDescription>
                Vas a eliminar el cupón <strong className="font-mono">{eliminando.codigo}</strong>.
                Esta acción no se puede deshacer. Los pedidos que ya lo usaron conservan el descuento aplicado.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEliminando(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => eliminar(eliminando)}>
                <Trash2 className="mr-1 h-4 w-4" /> Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CuponDialog({ cupon, zonas, onClose, onGuardado }: {
  cupon: Cupon | null;
  zonas: Array<{ id: string; nombre: string }>;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [codigo, setCodigo] = useState(cupon?.codigo || "");
  const [descripcion, setDescripcion] = useState(cupon?.descripcion || "");
  const [tipo, setTipo] = useState<"porcentaje" | "monto_fijo">(cupon?.tipo === "monto_fijo" ? "monto_fijo" : "porcentaje");
  const [valor, setValor] = useState(String(cupon?.valor ?? ""));
  const [montoMinimo, setMontoMinimo] = useState(String(cupon?.montoMinimo ?? ""));
  const [usosMaximos, setUsosMaximos] = useState(String(cupon?.usosMaximos ?? ""));
  const [validoDesde, setValidoDesde] = useState(cupon?.validoDesde ? cupon.validoDesde.slice(0, 10) : "");
  const [validoHasta, setValidoHasta] = useState(cupon?.validoHasta ? cupon.validoHasta.slice(0, 10) : "");
  const [zonaId, setZonaId] = useState(cupon?.zonaId || "");
  const [activo, setActivo] = useState(cupon?.activo !== false);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const codigoTrim = codigo.trim();
    if (codigoTrim.length < 3) {
      toast.error("El código debe tener al menos 3 caracteres");
      return;
    }
    const valorNum = Number(valor);
    if (!valorNum || valorNum <= 0) {
      toast.error("El valor debe ser un número positivo");
      return;
    }
    if (tipo === "porcentaje" && valorNum > 100) {
      toast.error("El porcentaje no puede ser mayor a 100");
      return;
    }
    setGuardando(true);
    try {
      const body = {
        codigo: codigoTrim,
        descripcion: descripcion.trim() || null,
        tipo,
        valor: valorNum,
        montoMinimo: montoMinimo === "" ? null : Number(montoMinimo),
        usosMaximos: usosMaximos === "" ? null : Number(usosMaximos),
        validoDesde: validoDesde ? new Date(validoDesde + "T00:00:00").toISOString() : null,
        validoHasta: validoHasta ? new Date(validoHasta + "T23:59:59").toISOString() : null,
        zonaId: zonaId || null,
        activo,
      };
      if (cupon) {
        await apiPatch(`/api/super-admin/cupones/${cupon.id}`, body);
        toast.success("Cupón actualizado");
      } else {
        await apiPost(`/api/super-admin/cupones`, body);
        toast.success("Cupón creado");
      }
      onGuardado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cupon ? "Editar cupón" : "Nuevo cupón"}</DialogTitle>
          <DialogDescription>
            Configurá el cupón de descuento. El código se guarda en mayúsculas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar} className="space-y-3">
          <div>
            <Label className="text-xs">Código *</Label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ej: VERANO2026"
              className="font-mono uppercase"
              maxLength={40}
            />
            <p className="text-xs text-muted-foreground mt-1">Solo letras, números, guiones y guiones bajos.</p>
          </div>
          <div>
            <Label className="text-xs">Descripción (opcional)</Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Descuento de lanzamiento" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo de descuento</Label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as "porcentaje" | "monto_fijo")}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="monto_fijo">Monto fijo ($)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">{tipo === "porcentaje" ? "Porcentaje *" : "Monto fijo (CLP) *"}</Label>
              <Input
                type="number"
                min={0}
                step={tipo === "porcentaje" ? "1" : "100"}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={tipo === "porcentaje" ? "Ej: 10" : "Ej: 5000"}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Monto mínimo del pedido</Label>
              <Input
                type="number"
                min={0}
                step="100"
                value={montoMinimo}
                onChange={(e) => setMontoMinimo(e.target.value)}
                placeholder="Sin mínimo"
              />
            </div>
            <div>
              <Label className="text-xs">Usos máximos</Label>
              <Input
                type="number"
                min={0}
                step="1"
                value={usosMaximos}
                onChange={(e) => setUsosMaximos(e.target.value)}
                placeholder="Ilimitado"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Válido desde</Label>
              <Input type="date" value={validoDesde} onChange={(e) => setValidoDesde(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Válido hasta</Label>
              <Input type="date" value={validoHasta} onChange={(e) => setValidoHasta(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Zona (opcional)</Label>
            <select
              value={zonaId}
              onChange={(e) => setZonaId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todas las zonas</option>
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>{z.nombre}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Si elegís una zona, solo aplica a clientes de esa zona.</p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={activo} onCheckedChange={setActivo} />
            <span>Cupón activo</span>
          </label>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>
              {guardando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {cupon ? "Guardar cambios" : "Crear cupón"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
