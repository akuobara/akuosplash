"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { bolsonGet, bolsonPost, bolsonPatch, formatCLP, formatFecha, formatFechaCorta } from "./bolson-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Shield, Users, Truck, DollarSign, Star, Activity, CheckCircle, XCircle, Ban, AlertTriangle, Wrench, Settings, BarChart3 } from "lucide-react";
import { toast } from "sonner";

interface BolsonUser { id: string; nombre: string; rol: string; aprobado?: boolean; banned?: boolean; telefono?: string; email?: string; razonSocial?: string; }
interface Usuario { id: string; nombre: string; email?: string; telefono?: string; rol: string; activo: boolean; aprobado: boolean; banned: boolean; banRazon?: string; creadoEn: string; ultimoLoginEn?: string; razonSocial?: string; patenteCamion?: string; capacidadCamionKg?: number; tieneGrua?: boolean; tieneMotoneta?: boolean; areasCobertura?: string; descripcionServicios?: string; _count?: any; }
interface Metricas {
  usuarios: any; solicitudes: any; servicios: any; cotizaciones: any; pagos: any;
  conversacion: any; valoraciones: any; fotos: number; auditLogs: number; comisionCobradaTotal: number;
}
interface Comision { id?: string; porcentajeComision: number; montoFijoComision: number; montoMinimoComision: number; aplicaPorCategoria: boolean; categoriasConfig?: string; publicacionPremiumHabilitada: boolean; publicacionPremiumMonto: number; }
interface AuditLog { id: string; creadoEn: string; accion: string; entidad?: string; entidadId?: string; detalles?: string; superadmin?: { nombre: string; }; }

export function BolsonSuperadmin() {
  const router = useRouter();
  const [user, setUser] = useState<BolsonUser | null | undefined>(undefined);
  const [tab, setTab] = useState("metricas");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [comision, setComision] = useState<Comision | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filterRol, setFilterRol] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [detalleUsuarioId, setDetalleUsuarioId] = useState<string | null>(null);

  useEffect(() => {
    bolsonGet<{ user: BolsonUser | null }>("/api/bolson/auth/me").then((d) => {
      if (d.user === null) { router.push("/bolson"); return; }
      if (d.user && d.user.rol !== "superadmin") {
        router.push(d.user.rol === "cliente" ? "/bolson/cliente" : "/bolson/transportista");
        return;
      }
      setUser(d.user);
    });
  }, [router]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [m, c, l] = await Promise.all([
        bolsonGet<Metricas>("/api/bolson/superadmin/metricas").catch(() => null),
        bolsonGet<{ comision: Comision | null }>("/api/bolson/superadmin/comision").then((d) => d.comision).catch(() => null),
        bolsonGet<{ logs: AuditLog[] }>("/api/bolson/superadmin/audit").then((d) => d.logs).catch(() => []),
      ]);
      setMetricas(m);
      setComision(c);
      setLogs(l);
      // Usuarios (con filtros actuales)
      const params = new URLSearchParams();
      if (filterRol) params.set("rol", filterRol);
      if (filterEstado) params.set("estado", filterEstado);
      const us = await bolsonGet<{ usuarios: Usuario[] }>(`/api/bolson/superadmin/usuarios${params.toString() ? `?${params}` : ""}`);
      setUsuarios(us.usuarios);
    } catch (e: any) {
      toast.error(e.message || "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, [user, refreshKey, filterRol, filterEstado]);

  useEffect(() => { if (user) refresh(); }, [user, refreshKey, filterRol, filterEstado]);

  if (user === undefined) {
    return (<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-yellow-50 via-lime-50 to-green-50"><Loader2 className="h-8 w-8 animate-spin text-green-700" /></div>);
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-lime-50 to-green-50">
      <Header user={user} onLogout={async () => { await bolsonPost("/api/bolson/auth/logout"); router.push("/bolson"); }} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 bg-white sm:grid-cols-4">
            <TabsTrigger value="metricas" className="data-[state=active]:bg-green-700 data-[state=active]:text-yellow-400 text-xs">
              <BarChart3 className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Métricas</span>
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="data-[state=active]:bg-green-700 data-[state=active]:text-yellow-400 text-xs">
              <Users className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Usuarios</span>
            </TabsTrigger>
            <TabsTrigger value="comision" className="data-[state=active]:bg-green-700 data-[state=active]:text-yellow-400 text-xs">
              <DollarSign className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Comisión</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-green-700 data-[state=active]:text-yellow-400 text-xs">
              <Activity className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Auditoría</span>
            </TabsTrigger>
          </TabsList>

          {/* === MÉTRICAS === */}
          <TabsContent value="metricas">
            {loading || !metricas ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-green-700" /></div>
            ) : (
              <div className="space-y-6">
                {/* KPIs principales */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCard titulo="Total usuarios" valor={metricas.usuarios.total} icon={<Users className="h-5 w-5" />} color="bg-blue-100 text-blue-800" sub={`${metricas.usuarios.clientes} clientes · ${metricas.usuarios.transportistas} transportistas`} />
                  <KpiCard titulo="Solicitudes publicadas" valor={metricas.solicitudes.total} icon={<Activity className="h-5 w-5" />} color="bg-yellow-100 text-yellow-800" sub={`${metricas.solicitudes.abiertas} abiertas · ${metricas.solicitudes.entregadas} entregadas`} />
                  <KpiCard titulo="Servicios totales" valor={metricas.servicios.total} icon={<Truck className="h-5 w-5" />} color="bg-lime-100 text-lime-800" sub={`${metricas.servicios.activos} activos · ${metricas.servicios.completados} completados`} />
                  <KpiCard titulo="Comisión cobrada" valor={formatCLP(metricas.comisionCobradaTotal)} icon={<DollarSign className="h-5 w-5" />} color="bg-green-700 text-yellow-400" sub={`${metricas.pagos.confirmados} pagos confirmados`} />
                </div>

                {/* Solicitudes por estado */}
                <Card className="border-2 border-green-300 bg-white">
                  <CardHeader><CardTitle className="text-green-900">Solicitudes por estado</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <StatBox label="Abiertas" valor={metricas.solicitudes.abiertas} color="bg-amber-100 text-amber-800" />
                      <StatBox label="En progreso" valor={metricas.solicitudes.adjudicadas} color="bg-blue-100 text-blue-800" />
                      <StatBox label="Entregadas" valor={metricas.solicitudes.entregadas} color="bg-gray-100 text-gray-800" />
                      <StatBox label="Canceladas" valor={metricas.solicitudes.canceladas} color="bg-red-100 text-red-800" />
                      <StatBox label="Total" valor={metricas.solicitudes.total} color="bg-green-700 text-yellow-400" />
                    </div>
                  </CardContent>
                </Card>

                {/* Cotizaciones y pagos */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Card className="border-2 border-green-300 bg-white">
                    <CardHeader><CardTitle className="text-green-900">Cotizaciones</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div className="flex justify-between"><span>Pendientes:</span><strong>{metricas.cotizaciones.pendientes}</strong></div>
                      <div className="flex justify-between"><span>Aceptadas:</span><strong>{metricas.cotizaciones.aceptadas}</strong></div>
                      <div className="flex justify-between"><span>Rechazadas:</span><strong>{metricas.cotizaciones.rechazadas}</strong></div>
                      <div className="flex justify-between border-t border-green-200 pt-2"><span>Monto total aceptadas:</span><strong className="text-green-700">{formatCLP(metricas.cotizaciones.montoTotalAceptadas)}</strong></div>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-green-300 bg-white">
                    <CardHeader><CardTitle className="text-green-900">Pagos</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div className="flex justify-between"><span>Total transacciones:</span><strong>{metricas.pagos.total}</strong></div>
                      <div className="flex justify-between"><span>Confirmados:</span><strong>{metricas.pagos.confirmados}</strong></div>
                      <div className="flex justify-between border-t border-green-200 pt-2"><span>Monto confirmado:</span><strong className="text-green-700">{formatCLP(metricas.pagos.montoTotal)}</strong></div>
                    </CardContent>
                  </Card>
                </div>

                {/* Otros */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <KpiCard titulo="Valoraciones" valor={metricas.valoraciones.total} icon={<Star className="h-5 w-5" />} color="bg-yellow-100 text-yellow-800" sub={`Promedio: ${metricas.valoraciones.promedioRating.toFixed(1)} / 5`} />
                  <KpiCard titulo="Mensajes" valor={metricas.conversacion.mensajes} icon={<Activity className="h-5 w-5" />} color="bg-blue-100 text-blue-800" sub={`${metricas.conversacion.notificaciones} notificaciones`} />
                  <KpiCard titulo="Fotos subidas" valor={metricas.fotos} icon={<DollarSign className="h-5 w-5" />} color="bg-lime-100 text-lime-800" sub="En servicios" />
                </div>
              </div>
            )}
          </TabsContent>

          {/* === USUARIOS === */}
          <TabsContent value="usuarios">
            <div className="mb-4 flex flex-wrap gap-2">
              <Select value={filterRol || "todos"} onValueChange={(v) => setFilterRol(v === "todos" ? "" : v)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Todos los roles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los roles</SelectItem>
                  <SelectItem value="cliente">Clientes</SelectItem>
                  <SelectItem value="transportista">Transportistas</SelectItem>
                  <SelectItem value="superadmin">Superadmins</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterEstado || "todos"} onValueChange={(v) => setFilterEstado(v === "todos" ? "" : v)}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Todos los estados" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="inactivo">Inactivos</SelectItem>
                  <SelectItem value="banned">Bloqueados</SelectItem>
                  <SelectItem value="pendiente">Pendientes aprobación</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-green-700" /></div>
            ) : usuarios.length === 0 ? (
              <Card className="border-2 border-green-300 bg-white">
                <CardContent className="p-8 text-center">
                  <Users className="mx-auto mb-3 h-12 w-12 text-green-400" />
                  <h3 className="text-lg font-bold text-green-900">No hay usuarios con esos filtros</h3>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2">
                {usuarios.map((u) => (
                  <UsuarioRow key={u.id} u={u} onOpen={() => setDetalleUsuarioId(u.id)} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* === COMISIÓN === */}
          <TabsContent value="comision">
            <ComisionPanel comision={comision} onSaved={() => setRefreshKey((k) => k + 1)} loading={loading} />
          </TabsContent>

          {/* === AUDITORÍA === */}
          <TabsContent value="audit">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-green-700" /></div>
            ) : logs.length === 0 ? (
              <Card className="border-2 border-green-300 bg-white">
                <CardContent className="p-8 text-center">
                  <Activity className="mx-auto mb-3 h-12 w-12 text-green-400" />
                  <h3 className="text-lg font-bold text-green-900">Sin acciones registradas</h3>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-2 border-green-300 bg-white">
                <CardContent className="p-4">
                  <div className="space-y-2 text-sm">
                    {logs.map((l) => (
                      <div key={l.id} className="flex items-start gap-2 border-b border-green-100 pb-2">
                        <div className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">{l.accion}</div>
                        <div className="flex-1">
                          <p className="text-green-900">
                            {l.superadmin?.nombre || "—"} · {l.entidad} {l.entidadId ? `(${l.entidadId.slice(0, 8)})` : ""}
                          </p>
                          {l.detalles && <p className="text-xs text-green-600 font-mono">{l.detalles.slice(0, 200)}</p>}
                          <p className="text-xs text-green-500">{formatFecha(l.creadoEn)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {detalleUsuarioId && (
        <DetalleUsuarioDialog id={detalleUsuarioId} onClose={() => setDetalleUsuarioId(null)} onUpdated={() => { setDetalleUsuarioId(null); setRefreshKey((k) => k + 1); }} />
      )}
    </div>
  );
}

function Header({ user, onLogout }: { user: BolsonUser; onLogout: () => void }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-40 border-b-2 border-yellow-400 bg-yellow-400/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <button onClick={() => router.push("/bolson")} className="flex items-center gap-2">
          <div className="rounded-lg bg-green-700 p-1.5 text-yellow-400">
            <Shield className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-black text-green-900">Bolsón</p>
            <p className="-mt-1 text-xs text-green-700">Superadmin · {user.nombre}</p>
          </div>
        </button>
        <Button variant="outline" size="sm" onClick={onLogout} className="border-green-700 text-green-700">Salir</Button>
      </div>
    </header>
  );
}

function KpiCard({ titulo, valor, icon, color, sub }: { titulo: string; valor: any; icon: React.ReactNode; color: string; sub?: string; }) {
  return (
    <Card className="border-2 border-green-300 bg-white">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-green-700">{titulo}</p>
          <div className={`rounded-lg p-1.5 ${color}`}>{icon}</div>
        </div>
        <p className="mt-1 text-2xl font-black text-green-900">{valor}</p>
        {sub && <p className="text-xs text-green-600">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function StatBox({ label, valor, color }: { label: string; valor: any; color: string; }) {
  return (
    <div className={`rounded-lg p-3 text-center ${color}`}>
      <p className="text-xs opacity-80">{label}</p>
      <p className="text-xl font-black">{valor}</p>
    </div>
  );
}

function UsuarioRow({ u, onOpen }: { u: Usuario; onOpen: () => void }) {
  const badge = u.banned
    ? { txt: "BLOQUEADO", cls: "bg-red-100 text-red-800 border-red-300" }
    : u.rol === "transportista" && !u.aprobado
    ? { txt: "PENDIENTE", cls: "bg-amber-100 text-amber-800 border-amber-300" }
    : !u.activo
    ? { txt: "INACTIVO", cls: "bg-gray-100 text-gray-800 border-gray-300" }
    : { txt: "ACTIVO", cls: "bg-green-100 text-green-800 border-green-300" };

  return (
    <Card className="border border-green-200 bg-white hover:border-green-400">
      <CardContent className="flex items-center justify-between p-3">
        <div>
          <div className="flex items-center gap-2">
            <strong className="text-green-900">{u.nombre}</strong>
            <Badge variant="outline" className={badge.cls}>{badge.txt}</Badge>
            <Badge variant="secondary">{u.rol}</Badge>
          </div>
          <p className="text-xs text-green-700">{u.email || u.telefono || "—"} · {u.razonSocial ? `${u.razonSocial} · ` : ""}creado {formatFechaCorta(u.creadoEn)}</p>
          {u.banRazon && <p className="text-xs text-red-600">Motivo: {u.banRazon}</p>}
        </div>
        <Button size="sm" variant="outline" onClick={onOpen} className="border-green-700 text-green-700">Gestionar</Button>
      </CardContent>
    </Card>
  );
}

function DetalleUsuarioDialog({ id, onClose, onUpdated }: { id: string; onClose: () => void; onUpdated: () => void }) {
  // Buscar usuario del listado (que ya está cargado en el padre), pero para simplificar hacemos fetch aquí
  // (en realidad no hay un endpoint GET usuario/[id], entonces usamos la lista cacheada)
  // Mejor: usamos el state inicial vacío y cargamos desde el listado con refresh
  // Para simplificar el MVP, mostramos acciones directas sin cargar detalle completo.
  // En el futuro se puede agregar endpoint GET /api/bolson/superadmin/usuarios/[id].

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md border-2 border-green-700">
        <DialogHeader>
          <DialogTitle className="text-green-900">Gestionar usuario</DialogTitle>
          <DialogDescription>Acciones rápidas sobre este usuario.</DialogDescription>
        </DialogHeader>
        <AccionesUsuario userId={id} onUpdated={onUpdated} />
      </DialogContent>
    </Dialog>
  );
}

function AccionesUsuario({ userId, onUpdated }: { userId: string; onUpdated: () => void }) {
  const [accionando, setAccionando] = useState<string | null>(null);
  const [banRazon, setBanRazon] = useState("");

  async function act(action: string, body: any) {
    setAccionando(action);
    try {
      await bolsonPatch(`/api/bolson/superadmin/usuarios/${userId}`, body);
      toast.success("Acción realizada");
      onUpdated();
    } catch (e: any) { toast.error(e.message); } finally { setAccionando(null); }
  }

  return (
    <div className="space-y-3">
      <Button onClick={() => act("aprobar", { aprobado: true })} disabled={accionando === "aprobar"} className="w-full bg-green-700 text-yellow-400 hover:bg-green-800">
        {accionando === "aprobar" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
        Aprobar transportista
      </Button>
      <Button onClick={() => act("desactivar", { activo: false })} disabled={accionando === "desactivar"} variant="outline" className="w-full border-amber-500 text-amber-700">
        <XCircle className="mr-1 h-4 w-4" /> Desactivar cuenta
      </Button>
      <Button onClick={() => act("reactivar", { activo: true, banned: false })} disabled={accionando === "reactivar"} variant="outline" className="w-full border-green-700 text-green-700">
        Reactivar cuenta
      </Button>
      <div>
        <Label>Motivo del bloqueo (opcional)</Label>
        <Input value={banRazon} onChange={(e) => setBanRazon(e.target.value)} placeholder="Ej: comportamiento abusivo, fraude, etc." />
      </div>
      <Button onClick={() => act("ban", { banned: true, banRazon: banRazon.trim() || undefined })} disabled={accionando === "ban"} variant="destructive" className="w-full">
        {accionando === "ban" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Ban className="mr-1 h-4 w-4" />}
        Bloquear cuenta
      </Button>
      <p className="text-xs text-green-600">Un usuario bloqueado no puede iniciar sesión ni ver datos. Sus solicitudes/cotizaciones existentes no se eliminan.</p>
    </div>
  );
}

function ComisionPanel({ comision, onSaved, loading }: { comision: Comision | null; onSaved: () => void; loading: boolean }) {
  const [porcentaje, setPorcentaje] = useState(comision?.porcentajeComision?.toString() || "0");
  const [montoFijo, setMontoFijo] = useState(comision?.montoFijoComision?.toString() || "0");
  const [montoMinimo, setMontoMinimo] = useState(comision?.montoMinimoComision?.toString() || "0");
  const [publicacionPremium, setPublicacionPremium] = useState(comision?.publicacionPremiumHabilitada || false);
  const [publicacionPremiumMonto, setPublicacionPremiumMonto] = useState(comision?.publicacionPremiumMonto?.toString() || "0");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (comision) {
      setPorcentaje(comision.porcentajeComision?.toString() || "0");
      setMontoFijo(comision.montoFijoComision?.toString() || "0");
      setMontoMinimo(comision.montoMinimoComision?.toString() || "0");
      setPublicacionPremium(comision.publicacionPremiumHabilitada || false);
      setPublicacionPremiumMonto(comision.publicacionPremiumMonto?.toString() || "0");
    }
  }, [comision]);

  async function guardar() {
    setGuardando(true);
    try {
      await bolsonPost("/api/bolson/superadmin/comision", {
        porcentajeComision: Number(porcentaje) || 0,
        montoFijoComision: Number(montoFijo) || 0,
        montoMinimoComision: Number(montoMinimo) || 0,
        publicacionPremiumHabilitada: publicacionPremium,
        publicacionPremiumMonto: Number(publicacionPremiumMonto) || 0,
      });
      toast.success("Configuración guardada");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setGuardando(false); }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-green-700" /></div>;

  return (
    <Card className="border-2 border-green-700 bg-white">
      <CardHeader><CardTitle className="text-green-900">Configuración de comisiones</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Porcentaje de comisión (%)</Label>
          <Input type="number" step="0.1" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} />
          <p className="mt-1 text-xs text-green-600">Ej: 5 = 5% del monto de cada servicio completado. 0 = sin comisión.</p>
        </div>
        <div>
          <Label>Monto fijo por servicio (CLP)</Label>
          <Input type="number" value={montoFijo} onChange={(e) => setMontoFijo(e.target.value)} />
          <p className="mt-1 text-xs text-green-600">Monto fijo adicional opcional. Ej: 500 = $500 por cada servicio.</p>
        </div>
        <div>
          <Label>Monto mínimo de comisión (CLP)</Label>
          <Input type="number" value={montoMinimo} onChange={(e) => setMontoMinimo(e.target.value)} />
          <p className="mt-1 text-xs text-green-600">Si la comisión calculada es menor que esto, se cobra este monto. 0 = sin mínimo.</p>
        </div>
        <div className="rounded-lg bg-yellow-50 p-3">
          <p className="text-sm font-semibold text-green-900">Vista previa de comisión</p>
          <p className="text-sm text-green-700">
            Para un servicio de $50.000: <strong>{formatCLP(Math.max(Number(montoMinimo) || 0, (Number(porcentaje) || 0) * 50000 / 100 + (Number(montoFijo) || 0)))}</strong>
          </p>
        </div>
        <div className="border-t border-green-200 pt-4">
          <h4 className="font-bold text-green-900">Publicación premium (opcional)</h4>
          <p className="text-xs text-green-600">Las publicaciones básicas son gratis. Podés habilitar publicaciones premium destacadas por un monto.</p>
          <label className="mt-2 flex items-center gap-2 text-sm text-green-900">
            <input type="checkbox" checked={publicacionPremium} onChange={(e) => setPublicacionPremium(e.target.checked)} />
            Habilitar publicaciones premium
          </label>
          {publicacionPremium && (
            <div className="mt-2">
              <Label>Monto por publicación premium (CLP)</Label>
              <Input type="number" value={publicacionPremiumMonto} onChange={(e) => setPublicacionPremiumMonto(e.target.value)} />
            </div>
          )}
        </div>
        <Button onClick={guardar} disabled={guardando} className="bg-green-700 text-yellow-400 hover:bg-green-800">
          {guardando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
          Guardar configuración
        </Button>
      </CardContent>
    </Card>
  );
}
