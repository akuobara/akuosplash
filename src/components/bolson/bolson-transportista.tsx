"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { bolsonGet, bolsonPost, bolsonPatch, formatCLP, formatFecha, formatFechaCorta, labelEstadoSolicitud, colorEstadoSolicitud, labelEstadoServicio, colorEstadoServicio } from "./bolson-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Truck, Package, MapPin, DollarSign, Star, Eye, Camera, Check, X, MessageSquare, Search, Clock, Users, Wrench, Home, Ban } from "lucide-react";
import { toast } from "sonner";

interface BolsonUser { id: string; nombre: string; rol: string; aprobado?: boolean; banned?: boolean; telefono?: string; email?: string; razonSocial?: string; patenteCamion?: string; capacidadCamionKg?: number; tieneGrua?: boolean; tieneMotoneta?: boolean; }
interface Categoria { id: string; slug: string; nombre: string; icono?: string; }
interface Solicitud { id: string; titulo: string; descripcion: string; estado: string; creadoEn: string; volumenM3?: number; pesoKg?: number; cantidadItems: number; presupuestoMax?: number; zonaOrigen?: string; zonaDestino?: string; categoria?: Categoria; _count?: { cotizaciones: number }; cliente?: { id: string; nombre: string; telefono?: string; }; }
interface Cotizacion { id: string; monto: number; mensaje?: string; estado: string; creadoEn: string; tiempoEstimadoHoras?: number; solicitud?: any; transportista?: any; }
interface Servicio { id: string; estado: string; creadoEn: string; solicitud?: any; cotizacion?: any; transportista?: any; chofer?: any; fotos?: any[]; pagos?: any[]; }
interface SolicitudDetalle extends Solicitud { puntos: any[]; cotizaciones: any[]; servicio: Servicio | null; mensajes: any[]; }

export function BolsonTransportista() {
  const router = useRouter();
  const [user, setUser] = useState<BolsonUser | null | undefined>(undefined);
  const [tab, setTab] = useState("explorar");
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [misCotizaciones, setMisCotizaciones] = useState<Cotizacion[]>([]);
  const [misServicios, setMisServicios] = useState<Servicio[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [servicioDetalleId, setServicioDetalleId] = useState<string | null>(null);
  const [filterCategoria, setFilterCategoria] = useState<string>("");
  const [filterZona, setFilterZona] = useState<string>("");

  useEffect(() => {
    bolsonGet<{ user: BolsonUser | null }>("/api/bolson/auth/me").then((d) => {
      if (d.user === null) { router.push("/bolson"); return; }
      if (d.user && d.user.rol !== "transportista" && d.user.rol !== "superadmin") {
        router.push("/bolson/cliente"); return;
      }
      setUser(d.user);
    });
  }, [router]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [sols, cats] = await Promise.all([
        bolsonGet<{ solicitudes: Solicitud[] }>("/api/bolson/solicitudes?transporteDisponible=1"),
        bolsonGet<{ categorias: Categoria[] }>("/api/bolson/categorias"),
      ]);
      setSolicitudes(sols.solicitudes);
      setCategorias(cats.categorias);
      const [cots, servs] = await Promise.all([
        bolsonGet<{ cotizaciones: Cotizacion[] }>("/api/bolson/cotizaciones?mias=1"),
        bolsonGet<{ servicios: Servicio[] }>("/api/bolson/servicios?mias=1"),
      ]);
      setMisCotizaciones(cots.cotizaciones);
      setMisServicios(servs.servicios);
    } catch (e: any) {
      toast.error(e.message || "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, [user, refreshKey]);

  useEffect(() => { if (user) refresh(); }, [user, refreshKey]);

  if (user === undefined) {
    return (<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-yellow-50 via-lime-50 to-green-50"><Loader2 className="h-8 w-8 animate-spin text-green-700" /></div>);
  }
  if (!user) return null;

  if (!user.aprobado && user.rol === "transportista") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-lime-50 to-green-50">
        <Header user={user} onLogout={async () => { await bolsonPost("/api/bolson/auth/logout"); router.push("/bolson"); }} />
        <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <Card className="border-2 border-amber-400 bg-white shadow-lg">
            <CardContent className="p-8 text-center">
              <Clock className="mx-auto mb-3 h-12 w-12 text-amber-500" />
              <h3 className="text-xl font-bold text-amber-900">Tu cuenta está pendiente de aprobación</h3>
              <p className="mt-2 text-amber-700">El superadmin debe aprobar tu cuenta de transportista antes de que puedas ofertar en solicitudes. Volvé a iniciar sesión más tarde.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const solicitudesFiltradas = solicitudes.filter((s) => {
    if (filterCategoria && s.categoria?.id !== filterCategoria) return false;
    if (filterZona) {
      const z = filterZona.toLowerCase();
      if (!s.zonaOrigen?.toLowerCase().includes(z) && !s.zonaDestino?.toLowerCase().includes(z)) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-lime-50 to-green-50">
      <Header user={user} onLogout={async () => { await bolsonPost("/api/bolson/auth/logout"); router.push("/bolson"); }} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-white">
            <TabsTrigger value="explorar" className="data-[state=active]:bg-green-700 data-[state=active]:text-yellow-400">
              <Search className="mr-1 h-4 w-4" /> Explorar
            </TabsTrigger>
            <TabsTrigger value="cotizaciones" className="data-[state=active]:bg-green-700 data-[state=active]:text-yellow-400">
              <DollarSign className="mr-1 h-4 w-4" /> Mis cotizaciones ({misCotizaciones.length})
            </TabsTrigger>
            <TabsTrigger value="servicios" className="data-[state=active]:bg-green-700 data-[state=active]:text-yellow-400">
              <Truck className="mr-1 h-4 w-4" /> Mis servicios ({misServicios.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="explorar">
            {/* Filtros */}
            <div className="mb-4 flex flex-wrap gap-2">
              <Select value={filterCategoria || "todas"} onValueChange={(v) => setFilterCategoria(v === "todas" ? "" : v)}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Todas las categorías" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las categorías</SelectItem>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.icono} {c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Filtrar por zona..." value={filterZona} onChange={(e) => setFilterZona(e.target.value)} className="w-48" />
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-green-700" /></div>
            ) : solicitudesFiltradas.length === 0 ? (
              <Card className="border-2 border-green-300 bg-white">
                <CardContent className="p-8 text-center">
                  <Package className="mx-auto mb-3 h-12 w-12 text-green-400" />
                  <h3 className="text-lg font-bold text-green-900">No hay solicitudes abiertas</h3>
                  <p className="text-green-700">Cuando los clientes publiquen solicitudes, las vas a ver acá para ofertar.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {solicitudesFiltradas.map((s) => (
                  <SolicitudExplorarCard key={s.id} sol={s} onOpen={() => setDetalleId(s.id)} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="cotizaciones">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-green-700" /></div>
            ) : misCotizaciones.length === 0 ? (
              <Card className="border-2 border-green-300 bg-white">
                <CardContent className="p-8 text-center">
                  <DollarSign className="mx-auto mb-3 h-12 w-12 text-green-400" />
                  <h3 className="text-lg font-bold text-green-900">Todavía no enviaste cotizaciones</h3>
                  <p className="mb-4 text-green-700">Explorá las solicitudes abiertas y ofertá tu mejor precio.</p>
                  <Button onClick={() => setTab("explorar")} className="bg-green-700 text-yellow-400 hover:bg-green-800">Explorar solicitudes</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {misCotizaciones.map((c) => (
                  <Card key={c.id} className="border-2 border-green-300 bg-white">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant={c.estado === "aceptada" ? "default" : c.estado === "pendiente" ? "secondary" : "outline"}>
                              {c.estado}
                            </Badge>
                            <span className="text-xs text-green-700">{c.solicitud?.categoria?.icono} {c.solicitud?.categoria?.nombre}</span>
                          </div>
                          <h3 className="mt-1 font-bold text-green-900">{c.solicitud?.titulo}</h3>
                          <p className="text-lg font-black text-green-700">{formatCLP(c.monto)}</p>
                          {c.mensaje && <p className="mt-1 text-sm text-green-700 italic">"{c.mensaje.slice(0, 80)}"</p>}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setDetalleId(c.solicitud?.id)} className="border-green-700 text-green-700">
                          Ver
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="servicios">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-green-700" /></div>
            ) : misServicios.length === 0 ? (
              <Card className="border-2 border-green-300 bg-white">
                <CardContent className="p-8 text-center">
                  <Truck className="mx-auto mb-3 h-12 w-12 text-green-400" />
                  <h3 className="text-lg font-bold text-green-900">No tenés servicios asignados</h3>
                  <p className="mb-4 text-green-700">Cuando un cliente acepte tu cotización, el servicio va a aparecer acá.</p>
                  <Button onClick={() => setTab("explorar")} className="bg-green-700 text-yellow-400 hover:bg-green-800">Ver solicitudes</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {misServicios.map((s) => (
                  <ServicioCard key={s.id} serv={s} onOpen={() => setServicioDetalleId(s.id)} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {detalleId && (
        <DetalleSolicitudTransportista id={detalleId} onClose={() => setDetalleId(null)} onUpdated={() => { setDetalleId(null); setRefreshKey(k => k + 1); }} />
      )}
      {servicioDetalleId && (
        <DetalleServicioDialog id={servicioDetalleId} onClose={() => setServicioDetalleId(null)} onUpdated={() => { setServicioDetalleId(null); setRefreshKey(k => k + 1); }} />
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
            <Truck className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-black text-green-900">Bolsón</p>
            <p className="-mt-1 text-xs text-green-700">Transportista · {user.nombre}</p>
          </div>
        </button>
        <Button variant="outline" size="sm" onClick={onLogout} className="border-green-700 text-green-700">Salir</Button>
      </div>
    </header>
  );
}

function SolicitudExplorarCard({ sol, onOpen }: { sol: Solicitud; onOpen: () => void }) {
  return (
    <Card className="border-2 border-green-300 bg-white shadow-sm transition hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="text-2xl">{sol.categoria?.icono || "📦"}</span>
          <span className="text-xs text-green-700">{formatFechaCorta(sol.creadoEn)}</span>
        </div>
        <h3 className="font-bold text-green-900">{sol.titulo}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-green-700">{sol.descripcion}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {sol.zonaOrigen && <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-green-800"><MapPin className="h-3 w-3" />{sol.zonaOrigen}</span>}
          <ArrowRightSmall /><span className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-2 py-0.5 text-green-800"><MapPin className="h-3 w-3" />{sol.zonaDestino}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {sol.volumenM3 && <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-green-700">{sol.volumenM3} m³</span>}
          {sol.pesoKg && <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-green-700">{sol.pesoKg} kg</span>}
          {sol.presupuestoMax && <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">Máx: {formatCLP(sol.presupuestoMax)}</span>}
        </div>
        <Button size="sm" onClick={onOpen} className="mt-3 w-full bg-green-700 text-yellow-400 hover:bg-green-800">
          <DollarSign className="mr-1 h-3 w-3" /> Ver y cotizar
        </Button>
      </CardContent>
    </Card>
  );
}

function ArrowRightSmall() { return <span className="text-green-500">→</span>; }

function ServicioCard({ serv, onOpen }: { serv: Servicio; onOpen: () => void }) {
  return (
    <Card className="border-2 border-green-700 bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Badge variant="outline" className={colorEstadoServicio(serv.estado)}>{labelEstadoServicio(serv.estado)}</Badge>
            <h3 className="mt-1 font-bold text-green-900">{serv.solicitud?.titulo}</h3>
            <p className="text-sm text-green-700">Cliente: {serv.solicitud?.cliente?.nombre}</p>
            <p className="text-sm font-semibold text-green-700">Monto: {formatCLP(serv.cotizacion?.monto)}</p>
          </div>
          <Button size="sm" onClick={onOpen} className="bg-green-700 text-yellow-400 hover:bg-green-800">
            Gestionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DetalleSolicitudTransportista({ id, onClose, onUpdated }: { id: string; onClose: () => void; onUpdated: () => void }) {
  const [detalle, setDetalle] = useState<SolicitudDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionando, setAccionando] = useState<string | null>(null);
  const [showCotizar, setShowCotizar] = useState(false);
  const [monto, setMonto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tiempoEstimadoHoras, setTiempoEstimadoHoras] = useState("");
  const [incluyePersonal, setIncluyePersonal] = useState(false);
  const [incluyeEmbalaje, setIncluyeEmbalaje] = useState(false);
  const [incluyeGrua, setIncluyeGrua] = useState(false);
  const [incluyeMotoneta, setIncluyeMotoneta] = useState(false);

  useEffect(() => {
    bolsonGet<{ solicitud: SolicitudDetalle }>(`/api/bolson/solicitudes/${id}`).then((d) => {
      setDetalle(d.solicitud);
      setLoading(false);
    }).catch((e) => { toast.error(e.message); onClose(); });
  }, [id]);

  async function enviarCotizacion() {
    if (!detalle) return;
    const m = Number(monto);
    if (!m || m <= 0) return toast.error("Indicá un monto válido");
    setAccionando("cotizar");
    try {
      await bolsonPost("/api/bolson/cotizaciones", {
        solicitudId: detalle.id, monto: m, mensaje: mensaje.trim() || undefined,
        tiempoEstimadoHoras: tiempoEstimadoHoras ? Number(tiempoEstimadoHoras) : null,
        incluyePersonal, incluyeEmbalaje, incluyeGrua, incluyeMotoneta,
      });
      toast.success("¡Cotización enviada!");
      onUpdated();
    } catch (e: any) { toast.error(e.message); } finally { setAccionando(null); }
  }

  async function retirar() {
    if (!detalle) return;
    const miCot = detalle.cotizaciones.find(c => c.transportista?.id === detalle.cliente?.id);
    if (!miCot) {
      // buscar mi cotización
    }
    setAccionando("retirar");
    try {
      // obtener mi cotización primero
      const { cotizaciones } = await bolsonGet(`/api/bolson/cotizaciones?mias=1&solicitudId=${detalle.id}`);
      if (cotizaciones.length === 0) {
        toast.error("No tenés cotización para retirar");
        return;
      }
      await bolsonPost(`/api/bolson/cotizaciones/${cotizaciones[0].id}/retirar`);
      toast.success("Cotización retirada");
      onUpdated();
    } catch (e: any) { toast.error(e.message); } finally { setAccionando(null); }
  }

  if (loading || !detalle) {
    return (<Dialog open={true} onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-2xl"><div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-green-700" /></div></DialogContent></Dialog>);
  }

  const miCot = detalle.cotizaciones.find((c: any) => c.transportista?.id); // simplificado

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-2 border-green-700">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="text-xl text-green-900">{detalle.titulo}</DialogTitle>
              <p className="text-sm text-green-700">{detalle.categoria?.nombre} · Cliente: {detalle.cliente?.nombre}</p>
            </div>
            <Badge variant="outline" className={colorEstadoSolicitud(detalle.estado)}>{labelEstadoSolicitud(detalle.estado)}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="font-bold text-green-900">Descripción</h4>
            <p className="text-sm text-green-800">{detalle.descripcion}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {detalle.volumenM3 && <span className="rounded-full bg-yellow-100 px-2 py-0.5">Volumen: {detalle.volumenM3} m³</span>}
              {detalle.pesoKg && <span className="rounded-full bg-yellow-100 px-2 py-0.5">Peso: {detalle.pesoKg} kg</span>}
              <span className="rounded-full bg-yellow-100 px-2 py-0.5">Items: {detalle.cantidadItems}</span>
              {detalle.presupuestoMax && <span className="rounded-full bg-green-100 px-2 py-0.5">Presupuesto máx: {formatCLP(detalle.presupuestoMax)}</span>}
            </div>
          </div>

          <div>
            <h4 className="mb-2 font-bold text-green-900">📍 Ruta</h4>
            <div className="space-y-2">
              {detalle.puntos.filter(p => p.tipo === "carga").map((p, i) => (
                <div key={`c-${i}`} className="rounded-lg border-l-4 border-yellow-500 bg-yellow-50 p-2 text-sm">
                  <span className="rounded-full bg-yellow-500 px-2 text-xs font-bold text-white">CARGA #{p.orden}</span> {p.direccion}{p.comuna ? `, ${p.comuna}` : ""}
                </div>
              ))}
              {detalle.puntos.filter(p => p.tipo === "entrega").map((p, i) => (
                <div key={`e-${i}`} className="rounded-lg border-l-4 border-lime-500 bg-lime-50 p-2 text-sm">
                  <span className="rounded-full bg-lime-500 px-2 text-xs font-bold text-white">ENTREGA #{p.orden}</span> {p.direccion}{p.comuna ? `, ${p.comuna}` : ""}
                </div>
              ))}
            </div>
          </div>

          {/* Form cotizar */}
          {detalle.estado === "abierta" && !showCotizar && (
            <Button onClick={() => setShowCotizar(true)} className="bg-green-700 text-yellow-400 hover:bg-green-800">
              <DollarSign className="mr-1 h-4 w-4" /> Enviar cotización
            </Button>
          )}

          {showCotizar && (
            <Card className="border-2 border-green-700 bg-white">
              <CardContent className="p-4 space-y-3">
                <h4 className="font-bold text-green-900">Tu cotización</h4>
                <div>
                  <Label>Monto a cobrar (CLP)</Label>
                  <Input type="number" placeholder="Ej: 50000" value={monto} onChange={(e) => setMonto(e.target.value)} />
                </div>
                <div>
                  <Label>Mensaje al cliente (opcional)</Label>
                  <Textarea rows={2} placeholder="Ej: Incluye personal para cargar y descargar. Horario propuesto: mañana." value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
                </div>
                <div>
                  <Label>Tiempo estimado (horas)</Label>
                  <Input type="number" placeholder="Ej: 3" value={tiempoEstimadoHoras} onChange={(e) => setTiempoEstimadoHoras(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-3">
                  {[
                    { l: "Incluye personal", v: incluyePersonal, s: setIncluyePersonal },
                    { l: "Incluye embalaje", v: incluyeEmbalaje, s: setIncluyeEmbalaje },
                    { l: "Incluye grúa", v: incluyeGrua, s: setIncluyeGrua },
                    { l: "Incluye motoneta", v: incluyeMotoneta, s: setIncluyeMotoneta },
                  ].map((opt) => (
                    <label key={opt.l} className="flex items-center gap-1 text-sm text-green-900">
                      <input type="checkbox" checked={opt.v} onChange={(e) => opt.s(e.target.checked)} />
                      {opt.l}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setShowCotizar(false)} variant="outline" className="border-green-700 text-green-700">Cancelar</Button>
                  <Button onClick={enviarCotizar} disabled={accionando === "cotizar"} className="bg-green-700 text-yellow-400 hover:bg-green-800">
                    {accionando === "cotizar" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                    Enviar cotización
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  async function enviarCotizar() {
    return enviarCotizacion();
  }
}

function DetalleServicioDialog({ id, onClose, onUpdated }: { id: string; onClose: () => void; onUpdated: () => void }) {
  const [serv, setServ] = useState<Servicio | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionando, setAccionando] = useState<string | null>(null);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [fotoTipo, setFotoTipo] = useState<"carga" | "entrega" | "evidencia" | "problema">("carga");
  const [fotoDesc, setFotoDesc] = useState("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  useEffect(() => {
    bolsonGet<{ servicios: Servicio[] }>(`/api/bolson/servicios?mias=1`).then((d) => {
      const found = d.servicios.find((s) => s.id === id);
      setServ(found || null);
      setLoading(false);
    }).catch(() => { onClose(); });
  }, [id]);

  async function cambiarEstado(nuevoEstado: string) {
    setAccionando(nuevoEstado);
    try {
      await bolsonPost(`/api/bolson/servicios/${id}/cambiar-estado`, { estado: nuevoEstado });
      toast.success(`Estado cambiado a: ${labelEstadoServicio(nuevoEstado)}`);
      // refrescar
      const d = await bolsonGet<{ servicios: Servicio[] }>(`/api/bolson/servicios?mias=1`);
      const found = d.servicios.find((s) => s.id === id);
      setServ(found || null);
    } catch (e: any) { toast.error(e.message); } finally { setAccionando(null); }
  }

  async function subirFoto() {
    if (!fotoFile || !serv) return;
    setAccionando("foto");
    try {
      // Convertir a base64
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        try {
          await bolsonPost(`/api/bolson/servicios/${serv.id}/fotos`, {
            tipo: fotoTipo, url: dataUrl, descripcion: fotoDesc || undefined,
          });
          toast.success("Foto subida");
          setFotoFile(null);
          setFotoDesc("");
          // refrescar
          const d = await bolsonGet<{ servicios: Servicio[] }>(`/api/bolson/servicios?mias=1`);
          const found = d.servicios.find((s) => s.id === id);
          setServ(found || null);
        } catch (e: any) { toast.error(e.message); }
        finally { setAccionando(null); }
      };
      reader.readAsDataURL(fotoFile);
    } catch (e: any) { toast.error(e.message); setAccionando(null); }
  }

  async function enviarMensaje() {
    if (!nuevoMensaje.trim() || !serv) return;
    try {
      await bolsonPost(`/api/bolson/mensajes`, {
        solicitudId: serv.solicitud?.id, contenido: nuevoMensaje.trim(),
      });
      setNuevoMensaje("");
      toast.success("Mensaje enviado");
    } catch (e: any) { toast.error(e.message); }
  }

  if (loading || !serv) {
    return (<Dialog open={true} onOpenChange={(o) => !o && onClose()}><DialogContent><div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-green-700" /></div></DialogContent></Dialog>);
  }

  const transiciones: Record<string, string> = {
    asignado: "en_camino_carga",
    en_camino_carga: "cargado",
    cargado: "en_camino_entrega",
    en_camino_entrega: "entregado",
  };
  const proximoEstado = transiciones[serv.estado];

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-2 border-green-700">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="text-xl text-green-900">{serv.solicitud?.titulo}</DialogTitle>
              <p className="text-sm text-green-700">Cliente: {serv.solicitud?.cliente?.nombre}</p>
            </div>
            <Badge variant="outline" className={colorEstadoServicio(serv.estado)}>{labelEstadoServicio(serv.estado)}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ruta */}
          <div>
            <h4 className="mb-2 font-bold text-green-900">📍 Ruta</h4>
            <div className="space-y-2">
              {serv.solicitud?.puntos?.filter((p: any) => p.tipo === "carga").map((p: any, i: number) => (
                <div key={`c-${i}`} className="rounded-lg border-l-4 border-yellow-500 bg-yellow-50 p-2 text-sm">
                  <span className="rounded-full bg-yellow-500 px-2 text-xs font-bold text-white">CARGA #{p.orden}</span> {p.direccion}{p.comuna ? `, ${p.comuna}` : ""}
                </div>
              ))}
              {serv.solicitud?.puntos?.filter((p: any) => p.tipo === "entrega").map((p: any, i: number) => (
                <div key={`e-${i}`} className="rounded-lg border-l-4 border-lime-500 bg-lime-50 p-2 text-sm">
                  <span className="rounded-full bg-lime-500 px-2 text-xs font-bold text-white">ENTREGA #{p.orden}</span> {p.direccion}{p.comuna ? `, ${p.comuna}` : ""}
                </div>
              ))}
            </div>
          </div>

          {/* Próximo estado */}
          {proximoEstado && (
            <Button onClick={() => cambiarEstado(proximoEstado)} disabled={accionando === proximoEstado} className="bg-green-700 text-yellow-400 hover:bg-green-800">
              {accionando === proximoEstado ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              Marcar como: {labelEstadoServicio(proximoEstado)}
            </Button>
          )}

          {/* Subir foto */}
          {serv.estado !== "completado" && serv.estado !== "cancelado" && (
            <Card className="border-2 border-green-300 bg-white">
              <CardContent className="p-3 space-y-2">
                <h4 className="font-bold text-green-900"><Camera className="mr-1 inline h-4 w-4" /> Subir foto</h4>
                <div className="flex flex-wrap gap-2">
                  <Select value={fotoTipo} onValueChange={(v: any) => setFotoTipo(v)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="carga">Foto de carga</SelectItem>
                      <SelectItem value="entrega">Foto de entrega</SelectItem>
                      <SelectItem value="evidencia">Evidencia</SelectItem>
                      <SelectItem value="problema">Problema</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="file" accept="image/*" onChange={(e) => setFotoFile(e.target.files?.[0] || null)} className="w-40" />
                </div>
                <Input placeholder="Descripción (opcional)" value={fotoDesc} onChange={(e) => setFotoDesc(e.target.value)} />
                <Button onClick={subirFoto} disabled={!fotoFile || accionando === "foto"} size="sm" className="bg-green-700 text-yellow-400 hover:bg-green-800">
                  {accionando === "foto" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="mr-1 h-4 w-4" />}
                  Subir
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Fotos existentes */}
          {serv.fotos && serv.fotos.length > 0 && (
            <div>
              <h4 className="mb-2 font-bold text-green-900">Fotos ({serv.fotos.length})</h4>
              <div className="grid grid-cols-3 gap-2">
                {serv.fotos.map((f) => (
                  <div key={f.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url.startsWith("data:") ? f.url : f.url} alt={f.tipo} className="aspect-square w-full rounded-lg object-cover" />
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">{f.tipo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pago info */}
          <div>
            <h4 className="font-bold text-green-900">💰 Monto a cobrar</h4>
            <p className="text-lg font-black text-green-700">{formatCLP(serv.cotizacion?.monto)}</p>
          </div>

          {/* Chat */}
          <div>
            <h4 className="mb-2 font-bold text-green-900">💬 Mensaje al cliente</h4>
            <div className="flex gap-2">
              <Input placeholder="Escribí un mensaje..." value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), enviarMensaje())} />
              <Button onClick={enviarMensaje} className="bg-green-700 text-yellow-400 hover:bg-green-800">
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
