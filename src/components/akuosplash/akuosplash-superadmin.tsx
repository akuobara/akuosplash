"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  akuoGet,
  akuoPost,
  akuoPatch,
  formatCLP,
  formatNumber,
  formatLitros,
  formatFecha,
  formatFechaCorta,
  labelPlan,
  colorPlan,
} from "./akuosplash-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Loader2,
  Users,
  Truck,
  Droplets,
  Shield,
  Check,
  X,
  Ban,
  Award,
  Settings,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MapPin,
  Package,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface AkuoUser {
  id: string;
  nombre: string;
  rol: string;
}

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  telefono?: string | null;
  rol: string;
  activo: boolean;
  aprobado: boolean;
  banned: boolean;
  banRazon?: string | null;
  creadoEn: string;
  ultimoLoginEn?: string | null;
  razonSocial?: string | null;
  rutEmpresa?: string | null;
  patenteVehiculo?: string | null;
  tipoVehiculo?: string | null;
  capacidadVehiculoKg?: number | null;
  areasCobertura?: string | null;
  plan?: string;
  suscripcionActiva?: boolean;
  vehiculosPermitidos?: number;
}

interface Metricas {
  usuarios: { total: number; clientes: number; transportistas: number; superadmins: number; transportistasPendientes: number; transportistasBanned: number; };
  pedidos: { total: number; pendientes: number; enRuta: number; entregados: number; cancelados: number; };
  entregas: { total: number; litros: number; ingresosPlataforma: number; };
  pagos: { total: number; confirmados: number; };
  suscripciones: { total: number; activas: number; ingresos: number; distribucionPlanes: { free: number; pro: number; enterprise: number; }; };
  vehiculos: number;
  clientesCatalogo: number;
  valoraciones: number;
  auditLogs: number;
  topTransportistas: any[];
}

interface Config {
  id: string;
  comisionPorcentaje: number;
  precioPlanPro: number;
  precioPlanEnterprise: number;
  maxVehiculosFree: number;
  maxVehiculosPro: number;
  maxVehiculosEnterprise: number;
}

export function AkuosplashSuperadmin() {
  const router = useRouter();
  const [user, setUser] = useState<AkuoUser | null | undefined>(undefined);
  const [tab, setTab] = useState("metricas");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    akuoGet<{ user: AkuoUser | null }>("/api/akuosplash/auth/me").then((d) => {
      if (d.user === null) {
        router.push("/akuosplash");
        return;
      }
      if (d.user && d.user.rol !== "superadmin") {
        router.push(d.user.rol === "cliente" ? "/akuosplash/cliente" : "/akuosplash/transportista");
        return;
      }
      setUser(d.user);
    });
  }, [router]);

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50">
      <Header user={user} onLogout={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-white sm:grid-cols-3">
            <TabsTrigger value="metricas" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs">
              <BarChart3 className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Métricas</span>
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs">
              <Users className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Usuarios</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs">
              <Settings className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Configuración</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="metricas">
            <MetricasTab refreshKey={refreshKey} />
          </TabsContent>

          <TabsContent value="usuarios">
            <UsuariosTab refreshKey={refreshKey} onRefresh={() => setRefreshKey((k) => k + 1)} />
          </TabsContent>

          <TabsContent value="config">
            <ConfigTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Header({ user, onLogout }: { user: AkuoUser; onLogout: () => void }) {
  return (
    <header className="border-b-2 border-blue-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <img src="/akuosplash/logo.jfif" alt="Logo" className="h-10 w-10 rounded-lg object-cover ring-2 ring-blue-200" />
          <div>
            <h1 className="text-lg font-black text-blue-900">AkuoSplash · Admin</h1>
            <p className="text-xs text-blue-700">Superadmin · {user.nombre}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout} className="border-blue-600 text-blue-700">
          Cerrar sesión
        </Button>
      </div>
    </header>
  );
}

// ============================================================
// TAB: MÉTRICAS
// ============================================================
function MetricasTab({ refreshKey }: { refreshKey: number }) {
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await akuoGet<Metricas>("/api/akuosplash/superadmin/metricas");
      setMetricas(m);
    } catch (e: any) {
      toast.error(e.message || "No se pudieron cargar las métricas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading || !metricas) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      {/* KPIs principales */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard titulo="Total usuarios" valor={metricas.usuarios.total} icon={<Users className="h-5 w-5" />} color="bg-blue-100 text-blue-800" sub={`${metricas.usuarios.clientes} clientes · ${metricas.usuarios.transportistas} transportistas`} />
        <KpiCard titulo="Pedidos" valor={metricas.pedidos.total} icon={<Activity className="h-5 w-5" />} color="bg-amber-100 text-amber-800" sub={`${metricas.pedidos.pendientes} pendientes · ${metricas.pedidos.entregados} entregados`} />
        <KpiCard titulo="Entregas" valor={metricas.entregas.total} icon={<Truck className="h-5 w-5" />} color="bg-cyan-100 text-cyan-800" sub={`${formatNumber(metricas.entregas.litros)} L entregados`} />
        <KpiCard titulo="Ingresos plataforma" valor={formatCLP(metricas.entregas.ingresosPlataforma)} icon={<Droplets className="h-5 w-5" />} color="bg-blue-600 text-white" sub={`${metricas.pagos.confirmados} pagos confirmados`} />
      </div>

      {/* Estado de la plataforma */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard titulo="Suscripciones activas" valor={metricas.suscripciones.activas} icon={<Award className="h-5 w-5" />} color="bg-emerald-100 text-emerald-800" sub={`Ingresos: ${formatCLP(metricas.suscripciones.ingresos)}`} />
        <KpiCard titulo="Vehículos registrados" valor={metricas.vehiculos} icon={<Truck className="h-5 w-5" />} color="bg-blue-100 text-blue-800" />
        <KpiCard titulo="Clientes (catálogo)" valor={metricas.clientesCatalogo} icon={<Users className="h-5 w-5" />} color="bg-blue-100 text-blue-800" />
        <KpiCard titulo="Valoraciones" valor={metricas.valoraciones} icon={<Award className="h-5 w-5" />} color="bg-amber-100 text-amber-800" />
      </div>

      {/* Alertas de transportistas pendientes/banned */}
      {(metricas.usuarios.transportistasPendientes > 0 || metricas.usuarios.transportistasBanned > 0) && (
        <Card className="border-2 border-amber-400 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
              <div>
                <h3 className="font-bold text-amber-900">Acciones pendientes</h3>
                {metricas.usuarios.transportistasPendientes > 0 && (
                  <p className="text-sm text-amber-800">
                    <strong>{metricas.usuarios.transportistasPendientes}</strong> transportistas esperando aprobación.
                  </p>
                )}
                {metricas.usuarios.transportistasBanned > 0 && (
                  <p className="text-sm text-amber-800">
                    <strong>{metricas.usuarios.transportistasBanned}</strong> transportistas baneados.
                  </p>
                )}
                <p className="mt-1 text-xs text-amber-700">Ir a la pestaña "Usuarios" para gestionarlos.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribución de planes */}
      <Card className="border-2 border-blue-300 bg-white">
        <CardHeader><CardTitle className="text-blue-900">Distribución de planes (transportistas)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <PlanBox plan="free" count={metricas.suscripciones.distribucionPlanes.free} />
            <PlanBox plan="pro" count={metricas.suscripciones.distribucionPlanes.pro} />
            <PlanBox plan="enterprise" count={metricas.suscripciones.distribucionPlanes.enterprise} />
          </div>
        </CardContent>
      </Card>

      {/* Pedidos por estado */}
      <Card className="border-2 border-blue-300 bg-white">
        <CardHeader><CardTitle className="text-blue-900">Pedidos por estado</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-5">
            <EstadoBox label="Pendientes" count={metricas.pedidos.pendientes} color="text-amber-700" />
            <EstadoBox label="En ruta" count={metricas.pedidos.enRuta} color="text-cyan-700" />
            <EstadoBox label="Entregados" count={metricas.pedidos.entregados} color="text-emerald-700" />
            <EstadoBox label="Cancelados" count={metricas.pedidos.cancelados} color="text-red-700" />
            <EstadoBox label="Total" count={metricas.pedidos.total} color="text-blue-900" />
          </div>
        </CardContent>
      </Card>

      {/* Top transportistas (últimos 30 días) */}
      <Card className="border-2 border-blue-300 bg-white">
        <CardHeader><CardTitle className="text-blue-900">Top transportistas (últimos 30 días)</CardTitle></CardHeader>
        <CardContent>
          {metricas.topTransportistas.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay datos de actividad.</p>
          ) : (
            <div className="space-y-2">
              {metricas.topTransportistas.map((t, i) => (
                <div key={t.transportistaId} className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white font-black">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-bold text-blue-900">{t.usuario?.nombre || "—"}</p>
                      <p className="text-xs text-slate-500">{t.usuario?.email}</p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-bold text-blue-900">{t._count.id} entregas</p>
                    <p className="text-xs text-blue-700">
                      {formatLitros(t._sum.litros)} · {formatCLP(t._sum.total)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ titulo, valor, icon, color, sub }: { titulo: string; valor: string | number; icon: React.ReactNode; color: string; sub?: string; }) {
  return (
    <Card className="border-2 border-blue-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-slate-500">{titulo}</p>
          <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
            {icon}
          </div>
        </div>
        <p className="mt-2 text-2xl font-black text-blue-900">{valor}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function PlanBox({ plan, count }: { plan: string; count: number }) {
  return (
    <div className={`rounded-lg border-2 p-3 text-center ${colorPlan(plan)}`}>
      <p className="text-xs uppercase">{labelPlan(plan)}</p>
      <p className="mt-1 text-2xl font-black">{count}</p>
    </div>
  );
}

function EstadoBox({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 p-3 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color}`}>{count}</p>
    </div>
  );
}

// ============================================================
// TAB: USUARIOS
// ============================================================
function UsuariosTab({ refreshKey, onRefresh }: { refreshKey: number; onRefresh: () => void }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterRol, setFilterRol] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [detalleUsuario, setDetalleUsuario] = useState<Usuario | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterRol) params.set("rol", filterRol);
      if (filterEstado) params.set("estado", filterEstado);
      const d = await akuoGet<{ usuarios: Usuario[]; stats: any }>(
        `/api/akuosplash/superadmin/usuarios${params.toString() ? `?${params}` : ""}`
      );
      setUsuarios(d.usuarios);
      setStats(d.stats);
    } catch (e: any) {
      toast.error(e.message || "No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  }, [filterRol, filterEstado]);

  useEffect(() => { load(); }, [load, refreshKey]);

  async function aprobar(u: Usuario) {
    try {
      await akuoPatch(`/api/akuosplash/superadmin/usuarios/${u.id}`, { aprobado: true });
      toast.success(`${u.nombre} aprobado`);
      load();
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "No se pudo aprobar");
    }
  }

  async function banear(u: Usuario) {
    const razon = prompt(`Motivo del ban para ${u.nombre}:`);
    if (razon === null) return;
    try {
      await akuoPatch(`/api/akuosplash/superadmin/usuarios/${u.id}`, { banned: true, banRazon: razon });
      toast.success("Usuario baneado");
      load();
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "No se pudo banear");
    }
  }

  async function desbanear(u: Usuario) {
    try {
      await akuoPatch(`/api/akuosplash/superadmin/usuarios/${u.id}`, { banned: false, banRazon: null });
      toast.success("Usuario desbaneado");
      load();
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "No se pudo desbanear");
    }
  }

  async function cambiarPlan(u: Usuario, plan: string) {
    try {
      await akuoPatch(`/api/akuosplash/superadmin/usuarios/${u.id}`, { plan });
      toast.success(`Plan cambiado a ${labelPlan(plan)}`);
      load();
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || "No se pudo cambiar el plan");
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-4">
      {/* Stats globales */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard titulo="Total" valor={stats.total} icon={<Users className="h-5 w-5" />} color="bg-blue-100 text-blue-800" />
          <KpiCard titulo="Clientes" valor={stats.clientes} icon={<Users className="h-5 w-5" />} color="bg-blue-100 text-blue-800" />
          <KpiCard titulo="Transportistas" valor={stats.transportistas} icon={<Truck className="h-5 w-5" />} color="bg-blue-100 text-blue-800" />
          <KpiCard titulo="Pendientes" valor={stats.pendientes} icon={<Clock className="h-5 w-5" />} color="bg-amber-100 text-amber-800" />
          <KpiCard titulo="Baneados" valor={stats.banned} icon={<Ban className="h-5 w-5" />} color="bg-red-100 text-red-800" />
          <KpiCard titulo="Superadmins" valor={stats.superadmins} icon={<Shield className="h-5 w-5" />} color="bg-blue-600 text-white" />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterRol || "todos"} onValueChange={(v) => setFilterRol(v === "todos" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todos los roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los roles</SelectItem>
            <SelectItem value="cliente">Clientes</SelectItem>
            <SelectItem value="transportista">Transportistas</SelectItem>
            <SelectItem value="superadmin">Superadmins</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEstado || "todos"} onValueChange={(v) => setFilterEstado(v === "todos" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todos los estados" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendientes">Pendientes de aprobación</SelectItem>
            <SelectItem value="banned">Baneados</SelectItem>
            <SelectItem value="activos">Activos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de usuarios */}
      {usuarios.length === 0 ? (
        <Card className="border-2 border-blue-300 bg-white">
          <CardContent className="p-8 text-center">
            <Users className="mx-auto mb-3 h-12 w-12 text-blue-400" />
            <h3 className="text-lg font-bold text-blue-900">No hay usuarios que coincidan</h3>
            <p className="text-blue-700">Probá con otros filtros.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {usuarios.map((u) => (
            <Card key={u.id} className={`border-2 ${u.banned ? "border-red-300" : !u.aprobado && u.rol === "transportista" ? "border-amber-300" : "border-blue-200"} bg-white shadow-sm`}>
              <CardContent className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-blue-900">{u.nombre}</h4>
                      <Badge variant="outline" className={
                        u.rol === "cliente" ? "bg-blue-100 text-blue-800 border-blue-300"
                        : u.rol === "transportista" ? "bg-cyan-100 text-cyan-800 border-cyan-300"
                        : "bg-blue-600 text-white border-blue-700"
                      }>{u.rol}</Badge>
                      {u.plan && u.rol === "transportista" && (
                        <Badge variant="outline" className={colorPlan(u.plan)}>{labelPlan(u.plan)}</Badge>
                      )}
                      {u.banned && <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Baneado</Badge>}
                      {!u.aprobado && u.rol === "transportista" && !u.banned && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Pendiente</Badge>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-blue-700 space-y-0.5">
                      <p>📧 {u.email}</p>
                      {u.telefono && <p>📞 {u.telefono}</p>}
                      {u.razonSocial && <p className="text-xs text-slate-500">Empresa: {u.razonSocial} {u.rutEmpresa ? `(${u.rutEmpresa})` : ""}</p>}
                      {u.patenteVehiculo && <p className="text-xs text-slate-500">Patente: {u.patenteVehiculo}</p>}
                      {u.areasCobertura && <p className="text-xs text-slate-500">Cobertura: {u.areasCobertura}</p>}
                      <p className="text-xs text-slate-500">Creado: {formatFechaCorta(u.creadoEn)} · Último login: {u.ultimoLoginEn ? formatFechaCorta(u.ultimoLoginEn) : "—"}</p>
                      {u.banRazon && <p className="text-xs text-red-700">Motivo ban: {u.banRazon}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {u.rol === "transportista" && !u.aprobado && !u.banned && (
                      <Button size="sm" onClick={() => aprobar(u)} className="bg-emerald-600 text-white hover:bg-emerald-700">
                        <Check className="mr-1 h-3.5 w-3.5" /> Aprobar
                      </Button>
                    )}
                    {u.rol === "transportista" && !u.banned && (
                      <Button size="sm" variant="outline" onClick={() => banear(u)} className="border-red-300 text-red-700">
                        <Ban className="mr-1 h-3.5 w-3.5" /> Banear
                      </Button>
                    )}
                    {u.banned && (
                      <Button size="sm" variant="outline" onClick={() => desbanear(u)} className="border-emerald-300 text-emerald-700">
                        <Check className="mr-1 h-3.5 w-3.5" /> Desbanear
                      </Button>
                    )}
                    {u.rol === "transportista" && (
                      <Select
                        value={u.plan || "free"}
                        onValueChange={(v) => cambiarPlan(u, v)}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
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

// ============================================================
// TAB: CONFIGURACIÓN
// ============================================================
function ConfigTab() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    akuoGet<{ config: Config }>("/api/akuosplash/superadmin/config")
      .then((d) => {
        setConfig(d.config);
        setForm({
          comisionPorcentaje: d.config.comisionPorcentaje,
          precioPlanPro: d.config.precioPlanPro,
          precioPlanEnterprise: d.config.precioPlanEnterprise,
          maxVehiculosFree: d.config.maxVehiculosFree,
          maxVehiculosPro: d.config.maxVehiculosPro,
          maxVehiculosEnterprise: d.config.maxVehiculosEnterprise,
        });
      })
      .catch((e) => toast.error(e.message || "No se pudo cargar la configuración"))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await akuoPatch<{ ok: boolean; config: Config }>("/api/akuosplash/superadmin/config", form);
      setConfig(res.config);
      toast.success("Configuración guardada");
    } catch (e: any) {
      toast.error(e.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <Card className="border-2 border-blue-600 bg-white shadow-lg">
        <CardHeader><CardTitle className="text-blue-900">Comisión de la plataforma</CardTitle></CardHeader>
        <CardContent>
          <Label>Comisión sobre cada entrega (%)</Label>
          <Input type="number" step="0.1" min="0" max="100" value={form.comisionPorcentaje} onChange={(e) => setForm({ ...form, comisionPorcentaje: e.target.value })} />
          <p className="mt-1 text-xs text-slate-500">Porcentaje que AkuoSplash cobra al transportista por cada entrega.</p>
        </CardContent>
      </Card>

      <Card className="border-2 border-blue-600 bg-white shadow-lg">
        <CardHeader><CardTitle className="text-blue-900">Precios de planes de suscripción</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Plan Pro ($/mes)</Label>
            <Input type="number" value={form.precioPlanPro} onChange={(e) => setForm({ ...form, precioPlanPro: e.target.value })} />
          </div>
          <div>
            <Label>Plan Enterprise ($/mes)</Label>
            <Input type="number" value={form.precioPlanEnterprise} onChange={(e) => setForm({ ...form, precioPlanEnterprise: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-blue-600 bg-white shadow-lg">
        <CardHeader><CardTitle className="text-blue-900">Límites de vehículos por plan</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Free</Label>
            <Input type="number" value={form.maxVehiculosFree} onChange={(e) => setForm({ ...form, maxVehiculosFree: e.target.value })} />
          </div>
          <div>
            <Label>Pro</Label>
            <Input type="number" value={form.maxVehiculosPro} onChange={(e) => setForm({ ...form, maxVehiculosPro: e.target.value })} />
          </div>
          <div>
            <Label>Enterprise</Label>
            <Input type="number" value={form.maxVehiculosEnterprise} onChange={(e) => setForm({ ...form, maxVehiculosEnterprise: e.target.value })} />
            <p className="text-xs text-slate-500">Usá 999+ para ilimitado.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Guardar configuración
        </Button>
      </div>
    </div>
  );
}
