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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, Plus, Package, MapPin, Users, Star, Trash2, Eye, Check, X, MoreVertical, ArrowRight, MessageSquare, PenLine } from "lucide-react";
import { toast } from "sonner";

interface BolsonUser { id: string; nombre: string; rol: string; aprobado?: boolean; banned?: boolean; telefono?: string; email?: string; }
interface Categoria { id: string; slug: string; nombre: string; icono?: string; }
interface Solicitud { id: string; titulo: string; descripcion: string; estado: string; creadoEn: string; volumenM3?: number; pesoKg?: number; cantidadItems: number; presupuestoMax?: number; zonaOrigen?: string; zonaDestino?: string; categoria?: Categoria; _count?: { cotizaciones: number }; }
interface Cotizacion { id: string; monto: number; mensaje?: string; estado: string; creadoEn: string; tiempoEstimadoHoras?: number; incluyePersonal: boolean; incluyeEmbalaje: boolean; incluyeGrua: boolean; incluyeMotoneta: boolean; transportista?: { id: string; nombre: string; razonSocial?: string; patenteCamion?: string; capacidadCamionKg?: number; tieneGrua?: boolean; tieneMotoneta?: boolean; descripcionServicios?: string; } }
interface Punto { id?: string; tipo: string; orden: number; direccion: string; comuna?: string; contactoNombre?: string; contactoTelefono?: string; requiereAscensor?: boolean; piso?: number; indicacionesAcceso?: string; }
interface Servicio { id: string; estado: string; creadoEn: string; firmaClienteUrl?: string; firmaClienteEn?: string; transportista?: { id: string; nombre: string; telefono?: string; patenteCamion?: string; }; fotos?: any[]; }
interface SolicitudDetalle extends Solicitud { categoria?: Categoria; cliente?: any; puntos: Punto[]; cotizaciones: Cotizacion[]; servicio: Servicio | null; mensajes: any[]; }

export function BolsonCliente() {
  const router = useRouter();
  const [user, setUser] = useState<BolsonUser | null | undefined>(undefined);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  useEffect(() => {
    bolsonGet<{ user: BolsonUser | null }>("/api/bolson/auth/me").then((d) => {
      if (d.user === null) {
        router.push("/bolson");
        return;
      }
      if (d.user && d.user.rol !== "cliente" && d.user.rol !== "superadmin") {
        router.push("/bolson/transportista");
        return;
      }
      setUser(d.user);
    });
  }, [router]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [sols, cats] = await Promise.all([
        bolsonGet<{ solicitudes: Solicitud[] }>("/api/bolson/solicitudes?mias=1"),
        bolsonGet<{ categorias: Categoria[] }>("/api/bolson/categorias"),
      ]);
      setSolicitudes(sols.solicitudes);
      setCategorias(cats.categorias);
    } catch (e: any) {
      toast.error(e.message || "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, [user, refreshKey]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refreshKey]);

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-yellow-50 via-lime-50 to-green-50">
        <Loader2 className="h-8 w-8 animate-spin text-green-700" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-lime-50 to-green-50">
      <Header user={user} onLogout={async () => { await bolsonPost("/api/bolson/auth/logout"); router.push("/bolson"); }} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-green-900">Mis solicitudes</h1>
          <Button onClick={() => setNuevaOpen(true)} className="bg-green-700 text-yellow-400 hover:bg-green-800">
            <Plus className="mr-1 h-4 w-4" /> Nueva solicitud
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-green-700" /></div>
        ) : solicitudes.length === 0 ? (
          <Card className="border-2 border-green-300 bg-white">
            <CardContent className="p-8 text-center">
              <Package className="mx-auto mb-3 h-12 w-12 text-green-400" />
              <h3 className="text-lg font-bold text-green-900">Todavía no publicaste ninguna solicitud</h3>
              <p className="mb-4 text-green-700">Publicá tu primera solicitud y recibí cotizaciones en minutos.</p>
              <Button onClick={() => setNuevaOpen(true)} className="bg-green-700 text-yellow-400 hover:bg-green-800">
                <Plus className="mr-1 h-4 w-4" /> Publicar solicitud
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {solicitudes.map((s) => (
              <SolicitudCard key={s.id} sol={s} onOpen={() => setDetalleId(s.id)} />
            ))}
          </div>
        )}
      </main>

      {nuevaOpen && (
        <NuevaSolicitudModal
          categorias={categorias}
          onClose={() => setNuevaOpen(false)}
          onCreated={() => { setNuevaOpen(false); setRefreshKey((k) => k + 1); }}
        />
      )}

      {detalleId && (
        <DetalleSolicitudDialog
          id={detalleId}
          onClose={() => setDetalleId(null)}
          onUpdated={() => { setDetalleId(null); setRefreshKey((k) => k + 1); }}
        />
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
            <Package className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-black text-green-900">Bolsón</p>
            <p className="-mt-1 text-xs text-green-700">Cliente · {user.nombre}</p>
          </div>
        </button>
        <Button variant="outline" size="sm" onClick={onLogout} className="border-green-700 text-green-700">Salir</Button>
      </div>
    </header>
  );
}

function SolicitudCard({ sol, onOpen }: { sol: Solicitud; onOpen: () => void }) {
  return (
    <Card className="border-2 border-green-300 bg-white shadow-sm transition hover:shadow-md hover:-translate-y-0.5">
      <CardContent className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{sol.categoria?.icono || "📦"}</span>
            <Badge variant="outline" className={colorEstadoSolicitud(sol.estado)}>
              {labelEstadoSolicitud(sol.estado)}
            </Badge>
          </div>
          <span className="text-xs text-green-700">{formatFechaCorta(sol.creadoEn)}</span>
        </div>
        <h3 className="font-bold text-green-900">{sol.titulo}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-green-700">{sol.descripcion}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-green-800">
          {sol.zonaOrigen && (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5">
              <MapPin className="h-3 w-3" /> {sol.zonaOrigen}
            </span>
          )}
          {sol.zonaDestino && (
            <span className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-2 py-0.5">
              <MapPin className="h-3 w-3" /> {sol.zonaDestino}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-green-700">
            {sol._count?.cotizaciones || 0} cotización(es)
          </span>
          <Button size="sm" variant="outline" onClick={onOpen} className="border-green-700 text-green-700">
            <Eye className="mr-1 h-3 w-3" /> Ver detalle
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NuevaSolicitudModal({ categorias, onClose, onCreated }: { categorias: Categoria[]; onClose: () => void; onCreated: () => void }) {
  const [paso, setPaso] = useState(1);
  const [categoriaId, setCategoriaId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [volumenM3, setVolumenM3] = useState("");
  const [pesoKg, setPesoKg] = useState("");
  const [cantidadItems, setCantidadItems] = useState("1");
  const [requiereEmbalaje, setRequiereEmbalaje] = useState(false);
  const [requierePersonalExtra, setRequierePersonalExtra] = useState(false);
  const [requiereGrua, setRequiereGrua] = useState(false);
  const [requiereMotoneta, setRequiereMotoneta] = useState(false);
  const [fechaFlexible, setFechaFlexible] = useState(true);
  const [fechaMin, setFechaMin] = useState("");
  const [fechaMax, setFechaMax] = useState("");
  const [franjaHoraria, setFranjaHoraria] = useState("");
  const [presupuestoMax, setPresupuestoMax] = useState("");
  const [metodoPagoPreferido, setMetodoPagoPreferido] = useState("");
  const [puntos, setPuntos] = useState<Punto[]>([
    { tipo: "carga", orden: 1, direccion: "" },
    { tipo: "entrega", orden: 1, direccion: "" },
  ]);
  const [guardando, setGuardando] = useState(false);

  function addPunto(tipo: string) {
    setPuntos([...puntos, { tipo, orden: puntos.filter(p => p.tipo === tipo).length + 1, direccion: "" }]);
  }
  function removePunto(idx: number) {
    setPuntos(puntos.filter((_, i) => i !== idx));
  }
  function updatePunto(idx: number, field: keyof Punto, value: any) {
    const nuevos = [...puntos];
    (nuevos[idx] as any)[field] = value;
    setPuntos(nuevos);
  }

  async function guardar() {
    if (!categoriaId) return toast.error("Elegí una categoría");
    if (!titulo.trim()) return toast.error("Indicá un título");
    if (!descripcion.trim()) return toast.error("Indicá una descripción");
    if (puntos.filter(p => p.tipo === "carga").some(p => !p.direccion.trim())) {
      return toast.error("Indicá la dirección de cada punto de carga");
    }
    if (puntos.filter(p => p.tipo === "entrega").some(p => !p.direccion.trim())) {
      return toast.error("Indicá la dirección de cada punto de entrega");
    }
    setGuardando(true);
    try {
      // Reasignar órdenes
      const cargas = puntos.filter(p => p.tipo === "carga").map((p, i) => ({ ...p, orden: i + 1 }));
      const entregas = puntos.filter(p => p.tipo === "entrega").map((p, i) => ({ ...p, orden: i + 1 }));
      const puntosFinal = [...cargas, ...entregas];
      await bolsonPost("/api/bolson/solicitudes", {
        categoriaId, titulo: titulo.trim(), descripcion: descripcion.trim(),
        volumenM3: volumenM3 ? Number(volumenM3) : null,
        pesoKg: pesoKg ? Number(pesoKg) : null,
        cantidadItems: Number(cantidadItems) || 1,
        requiereEmbalaje, requierePersonalExtra, requiereGrua, requiereMotoneta,
        fechaFlexible,
        fechaMin: fechaMin ? new Date(fechaMin).toISOString() : null,
        fechaMax: fechaMax ? new Date(fechaMax).toISOString() : null,
        franjaHoraria: franjaHoraria || null,
        presupuestoMax: presupuestoMax ? Number(presupuestoMax) : null,
        metodoPagoPreferido: metodoPagoPreferido || null,
        puntos: puntosFinal,
      });
      toast.success("¡Solicitud publicada! Recibirás cotizaciones pronto.");
      onCreated();
    } catch (e: any) {
      toast.error(e.message || "No se pudo publicar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-2 border-green-700">
        <DialogHeader>
          <DialogTitle className="text-green-900">Nueva solicitud de transporte</DialogTitle>
          <DialogDescription>Publicá gratis y recibí cotizaciones en minutos.</DialogDescription>
        </DialogHeader>

        {/* Pasos: 1=Categoría, 2=Detalle, 3=Puntos, 4=Fechas/Presupuesto */}
        <div className="mb-4 flex gap-1">
          {["Categoría", "Detalle", "Puntos", "Fechas"].map((t, i) => (
            <div key={i} className={`flex-1 rounded-md px-2 py-1 text-center text-xs ${paso === i + 1 ? "bg-green-700 text-yellow-400" : "bg-green-100 text-green-700"}`}>
              {i + 1}. {t}
            </div>
          ))}
        </div>

        {paso === 1 && (
          <div className="space-y-3">
            <Label>Categoría</Label>
            <div className="grid grid-cols-3 gap-2">
              {categorias.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategoriaId(c.id)} className={`rounded-xl border-2 p-3 text-center transition ${categoriaId === c.id ? "border-green-700 bg-green-50" : "border-green-300 bg-white hover:border-green-500"}`}>
                  <div className="text-2xl">{c.icono}</div>
                  <div className="mt-1 text-xs font-semibold text-green-900">{c.nombre}</div>
                </button>
              ))}
            </div>
            {categoriaId && <p className="text-sm text-green-700">{categorias.find(c => c.id === categoriaId)?.descripcion}</p>}
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Mudanza de depto 2 dormitorios" />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Detallá qué hay que transportar, condiciones especiales, etc." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Volumen (m³)</Label>
                <Input type="number" value={volumenM3} onChange={(e) => setVolumenM3(e.target.value)} placeholder="Ej: 8" />
              </div>
              <div>
                <Label>Peso (kg)</Label>
                <Input type="number" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} placeholder="Ej: 500" />
              </div>
              <div>
                <Label>Cantidad de items</Label>
                <Input type="number" value={cantidadItems} onChange={(e) => setCantidadItems(e.target.value)} placeholder="1" />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { l: "Requiere embalaje", v: requiereEmbalaje, s: setRequiereEmbalaje },
                { l: "Personal extra", v: requierePersonalExtra, s: setRequierePersonalExtra },
                { l: "Requiere grúa", v: requiereGrua, s: setRequiereGrua },
                { l: "Requiere motoneta", v: requiereMotoneta, s: setRequiereMotoneta },
              ].map((opt) => (
                <label key={opt.l} className="flex items-center gap-1 text-sm text-green-900">
                  <input type="checkbox" checked={opt.v} onChange={(e) => opt.s(e.target.checked)} />
                  {opt.l}
                </label>
              ))}
            </div>
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-yellow-700">📍 Puntos de carga (origen)</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => addPunto("carga")} className="border-yellow-600 text-yellow-700">
                  <Plus className="mr-1 h-3 w-3" /> Agregar punto de carga
                </Button>
              </div>
              <div className="space-y-2">
                {puntos.filter(p => p.tipo === "carga").map((p, idx) => {
                  const realIdx = puntos.indexOf(p);
                  return (
                    <Card key={`c-${idx}`} className="border-yellow-400 bg-yellow-50">
                      <CardContent className="p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-yellow-800">Carga #{idx + 1}</span>
                          {puntos.filter(p => p.tipo === "carga").length > 1 && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => removePunto(realIdx)} className="text-red-600">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <Input placeholder="Dirección completa" value={p.direccion} onChange={(e) => updatePunto(realIdx, "direccion", e.target.value)} />
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <Input placeholder="Comuna" value={p.comuna || ""} onChange={(e) => updatePunto(realIdx, "comuna", e.target.value)} />
                          <Input placeholder="Contacto (nombre)" value={p.contactoNombre || ""} onChange={(e) => updatePunto(realIdx, "contactoNombre", e.target.value)} />
                          <Input placeholder="Teléfono contacto" value={p.contactoTelefono || ""} onChange={(e) => updatePunto(realIdx, "contactoTelefono", e.target.value)} />
                          <Input placeholder="Indicaciones de acceso" value={p.indicacionesAcceso || ""} onChange={(e) => updatePunto(realIdx, "indicacionesAcceso", e.target.value)} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-lime-700">📍 Puntos de entrega (destino)</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => addPunto("entrega")} className="border-lime-600 text-lime-700">
                  <Plus className="mr-1 h-3 w-3" /> Agregar punto de entrega
                </Button>
              </div>
              <div className="space-y-2">
                {puntos.filter(p => p.tipo === "entrega").map((p, idx) => {
                  const realIdx = puntos.indexOf(p);
                  return (
                    <Card key={`e-${idx}`} className="border-lime-400 bg-lime-50">
                      <CardContent className="p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-lime-800">Entrega #{idx + 1}</span>
                          {puntos.filter(p => p.tipo === "entrega").length > 1 && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => removePunto(realIdx)} className="text-red-600">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <Input placeholder="Dirección completa" value={p.direccion} onChange={(e) => updatePunto(realIdx, "direccion", e.target.value)} />
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <Input placeholder="Comuna" value={p.comuna || ""} onChange={(e) => updatePunto(realIdx, "comuna", e.target.value)} />
                          <Input placeholder="Contacto (nombre)" value={p.contactoNombre || ""} onChange={(e) => updatePunto(realIdx, "contactoNombre", e.target.value)} />
                          <Input placeholder="Teléfono contacto" value={p.contactoTelefono || ""} onChange={(e) => updatePunto(realIdx, "contactoTelefono", e.target.value)} />
                          <Input placeholder="Indicaciones de acceso" value={p.indicacionesAcceso || ""} onChange={(e) => updatePunto(realIdx, "indicacionesAcceso", e.target.value)} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <p className="rounded-lg bg-green-50 p-3 text-xs text-green-800">
              💡 Podés indicar múltiples puntos de carga y entrega. Ej: cargar en A y B, entregar en C, D y E. El orden de los puntos define la ruta.
            </p>
          </div>
        )}

        {paso === 4 && (
          <div className="space-y-3">
            <div>
              <label className="flex items-center gap-2 text-sm text-green-900">
                <input type="checkbox" checked={fechaFlexible} onChange={(e) => setFechaFlexible(e.target.checked)} />
                Fechas flexibles (el transportista propone)
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha mínima</Label>
                <Input type="date" value={fechaMin} onChange={(e) => setFechaMin(e.target.value)} disabled={fechaFlexible} />
              </div>
              <div>
                <Label>Fecha máxima</Label>
                <Input type="date" value={fechaMax} onChange={(e) => setFechaMax(e.target.value)} disabled={fechaFlexible} />
              </div>
            </div>
            <div>
              <Label>Franja horaria preferida</Label>
              <Select value={franjaHoraria} onValueChange={setFranjaHoraria}>
                <SelectTrigger><SelectValue placeholder="Cualquiera" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mañana">Mañana (08-12)</SelectItem>
                  <SelectItem value="tarde">Tarde (12-18)</SelectItem>
                  <SelectItem value="noche">Noche (18-22)</SelectItem>
                  <SelectItem value="cualquiera">Cualquiera</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Presupuesto máximo (opcional)</Label>
                <Input type="number" value={presupuestoMax} onChange={(e) => setPresupuestoMax(e.target.value)} placeholder="Ej: 50000" />
              </div>
              <div>
                <Label>Método de pago preferido</Label>
                <Select value={metodoPagoPreferido} onValueChange={setMetodoPagoPreferido}>
                  <SelectTrigger><SelectValue placeholder="Sin preferencia" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {paso > 1 && (
            <Button variant="outline" onClick={() => setPaso(paso - 1)} className="border-green-700 text-green-700">
              Anterior
            </Button>
          )}
          {paso < 4 ? (
            <Button onClick={() => setPaso(paso + 1)} className="bg-green-700 text-yellow-400 hover:bg-green-800">
              Siguiente <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={guardar} disabled={guardando} className="bg-green-700 text-yellow-400 hover:bg-green-800">
              {guardando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              Publicar solicitud
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetalleSolicitudDialog({ id, onClose, onUpdated }: { id: string; onClose: () => void; onUpdated: () => void }) {
  const [detalle, setDetalle] = useState<SolicitudDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionando, setAccionando] = useState<string | null>(null);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [rating, setRating] = useState(5);
  const [comentario, setComentario] = useState("");
  const [firmaPad, setFirmaPad] = useState(false);

  useEffect(() => {
    bolsonGet<{ solicitud: SolicitudDetalle }>(`/api/bolson/solicitudes/${id}`).then((d) => {
      setDetalle(d.solicitud);
      setLoading(false);
    }).catch((e) => {
      toast.error(e.message || "No se pudo cargar");
      onClose();
    });
  }, [id]);

  async function aceptar(cotId: string) {
    setAccionando(cotId);
    try {
      await bolsonPost(`/api/bolson/cotizaciones/${cotId}/aceptar`);
      toast.success("¡Cotización aceptada! El servicio fue creado.");
      onUpdated();
    } catch (e: any) {
      toast.error(e.message || "No se pudo aceptar");
    } finally {
      setAccionando(null);
    }
  }

  async function cancelar() {
    if (!detalle) return;
    if (!confirm("¿Cancelar esta solicitud? Las cotizaciones pendientes serán rechazadas.")) return;
    setAccionando("cancelar");
    try {
      await bolsonPost(`/api/bolson/solicitudes/${id}/cancelar`, { razon: "Cancelada por el cliente" });
      toast.success("Solicitud cancelada");
      onUpdated();
    } catch (e: any) {
      toast.error(e.message || "No se pudo cancelar");
    } finally {
      setAccionando(null);
    }
  }

  async function enviarMensaje() {
    if (!nuevoMensaje.trim() || !detalle) return;
    try {
      const res = await bolsonPost<{ mensaje: any }>(`/api/bolson/mensajes`, {
        solicitudId: detalle.id, contenido: nuevoMensaje.trim(),
      });
      setDetalle({ ...detalle, mensajes: [...detalle.mensajes, res.mensaje] });
      setNuevoMensaje("");
    } catch (e: any) {
      toast.error(e.message || "No se pudo enviar");
    }
  }

  async function firmarEntrega() {
    if (!detalle?.servicio) return;
    setAccionando("firmar");
    try {
      // Generar una firma simple (en prod sería un canvas de dibujo del cliente)
      // Por ahora, un placeholder data URL que diga "Firmado digitalmente"
      const firmaUrl = "data:text/plain;base64," + Buffer.from(`Firma digital — ${new Date().toISOString()}`).toString("base64");
      await bolsonPost(`/api/bolson/servicios/${detalle.servicio.id}/firma`, { firmaUrl });
      toast.success("¡Entrega firmada y servicio completado!");
      onUpdated();
    } catch (e: any) {
      toast.error(e.message || "No se pudo firmar");
    } finally {
      setAccionando(null);
    }
  }

  async function valorar() {
    if (!detalle?.servicio) return;
    setAccionando("valorar");
    try {
      await bolsonPost(`/api/bolson/valoraciones`, {
        servicioId: detalle.servicio.id, rating, comentario: comentario.trim() || undefined,
      });
      toast.success("¡Valoración enviada!");
      onUpdated();
    } catch (e: any) {
      toast.error(e.message || "No se pudo valorar");
    } finally {
      setAccionando(null);
    }
  }

  if (loading || !detalle) {
    return (
      <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl"><div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-green-700" /></div></DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-2 border-green-700">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="text-xl text-green-900">{detalle.titulo}</DialogTitle>
              <p className="text-sm text-green-700">{detalle.categoria?.nombre} · Publicada {formatFecha(detalle.creadoEn)}</p>
            </div>
            <Badge variant="outline" className={colorEstadoSolicitud(detalle.estado)}>
              {labelEstadoSolicitud(detalle.estado)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Descripción */}
          <div>
            <h4 className="font-bold text-green-900">Descripción</h4>
            <p className="text-sm text-green-800">{detalle.descripcion}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              {detalle.volumenM3 && <span className="rounded-full bg-yellow-100 px-2 py-0.5">Volumen: {detalle.volumenM3} m³</span>}
              {detalle.pesoKg && <span className="rounded-full bg-yellow-100 px-2 py-0.5">Peso: {detalle.pesoKg} kg</span>}
              <span className="rounded-full bg-yellow-100 px-2 py-0.5">Items: {detalle.cantidadItems}</span>
              {detalle.presupuestoMax && <span className="rounded-full bg-green-100 px-2 py-0.5">Presupuesto máx: {formatCLP(detalle.presupuestoMax)}</span>}
            </div>
          </div>

          {/* Puntos */}
          <div>
            <h4 className="mb-2 font-bold text-green-900">📍 Ruta</h4>
            <div className="space-y-2">
              {detalle.puntos.filter(p => p.tipo === "carga").map((p, i) => (
                <div key={`c-${i}`} className="rounded-lg border-l-4 border-yellow-500 bg-yellow-50 p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-yellow-500 px-2 text-xs font-bold text-white">CARGA #{p.orden}</span>
                    <span className="text-green-900">{p.direccion}{p.comuna ? `, ${p.comuna}` : ""}</span>
                  </div>
                  {p.contactoNombre && <p className="mt-1 text-xs text-green-700">Contacto: {p.contactoNombre} {p.contactoTelefono}</p>}
                </div>
              ))}
              {detalle.puntos.filter(p => p.tipo === "entrega").map((p, i) => (
                <div key={`e-${i}`} className="rounded-lg border-l-4 border-lime-500 bg-lime-50 p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-lime-500 px-2 text-xs font-bold text-white">ENTREGA #{p.orden}</span>
                    <span className="text-green-900">{p.direccion}{p.comuna ? `, ${p.comuna}` : ""}</span>
                  </div>
                  {p.contactoNombre && <p className="mt-1 text-xs text-green-700">Contacto: {p.contactoNombre} {p.contactoTelefono}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Cotizaciones */}
          {detalle.cotizaciones.length > 0 && (
            <div>
              <h4 className="mb-2 font-bold text-green-900">💬 Cotizaciones recibidas ({detalle.cotizaciones.length})</h4>
              <div className="space-y-2">
                {detalle.cotizaciones.map((c) => (
                  <Card key={c.id} className={`border-2 ${c.estado === "aceptada" ? "border-green-700 bg-green-50" : c.estado === "pendiente" ? "border-green-300" : "border-gray-200 opacity-60"}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-lg font-black text-green-900">{formatCLP(c.monto)}</p>
                          <p className="text-sm text-green-700">{c.transportista?.nombre}</p>
                          {c.transportista?.razonSocial && <p className="text-xs text-green-600">{c.transportista.razonSocial}</p>}
                          {c.transportista?.patenteCamion && <p className="text-xs text-green-600">Patente: {c.transportista.patenteCamion} · Cap: {c.transportista.capacidadCamionKg}kg</p>}
                        </div>
                        <Badge variant="outline">{c.estado}</Badge>
                      </div>
                      {c.mensaje && <p className="mt-2 text-sm text-green-800">{c.mensaje}</p>}
                      {c.tiempoEstimadoHoras && <p className="mt-1 text-xs text-green-600">⏱ {c.tiempoEstimadoHoras}h estimadas</p>}
                      <div className="mt-2 flex flex-wrap gap-1 text-xs">
                        {c.incluyePersonal && <span className="rounded-full bg-blue-100 px-2 py-0.5">Personal</span>}
                        {c.incluyeEmbalaje && <span className="rounded-full bg-blue-100 px-2 py-0.5">Embalaje</span>}
                        {c.incluyeGrua && <span className="rounded-full bg-blue-100 px-2 py-0.5">Grúa</span>}
                        {c.incluyeMotoneta && <span className="rounded-full bg-blue-100 px-2 py-0.5">Motoneta</span>}
                      </div>
                      {detalle.estado === "abierta" && c.estado === "pendiente" && (
                        <Button size="sm" onClick={() => aceptar(c.id)} disabled={accionando === c.id} className="mt-3 bg-green-700 text-yellow-400 hover:bg-green-800">
                          {accionando === c.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                          Aceptar cotización
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Servicio en progreso */}
          {detalle.servicio && (
            <div>
              <h4 className="mb-2 font-bold text-green-900">🚚 Estado del servicio</h4>
              <Card className="border-2 border-green-700 bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Badge variant="outline" className={colorEstadoServicio(detalle.servicio.estado)}>
                        {labelEstadoServicio(detalle.servicio.estado)}
                      </Badge>
                      <p className="mt-2 text-sm text-green-700">Transportista: {detalle.servicio.transportista?.nombre} ({detalle.servicio.transportista?.telefono})</p>
                      <p className="text-xs text-green-600">Patente: {detalle.servicio.transportista?.patenteCamion || "—"}</p>
                    </div>
                    <span className="text-xs text-green-600">{formatFecha(detalle.servicio.creadoEn)}</span>
                  </div>

                  {/* Acción: firmar entrega cuando está entregado */}
                  {detalle.servicio.estado === "entregado" && !detalle.servicio.firmaClienteUrl && (
                    <Button onClick={firmarEntrega} disabled={accionando === "firmar"} className="mt-3 bg-green-700 text-yellow-400 hover:bg-green-800">
                      {accionando === "firmar" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <PenLine className="mr-1 h-3 w-3" />}
                      Firmar y confirmar entrega
                    </Button>
                  )}

                  {/* Valoración */}
                  {detalle.servicio.estado === "completado" && (
                    <div className="mt-3 rounded-lg bg-yellow-50 p-3">
                      <p className="mb-2 text-sm font-semibold text-green-900">¿Cómo estuvo el servicio? Valorá al transportista:</p>
                      <div className="mb-2 flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} onClick={() => setRating(n)} type="button">
                            <Star className={`h-6 w-6 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                          </button>
                        ))}
                      </div>
                      <Textarea rows={2} placeholder="Comentario (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
                      <Button onClick={valorar} disabled={accionando === "valorar"} className="mt-2 bg-green-700 text-yellow-400 hover:bg-green-800" size="sm">
                        Enviar valoración
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Chat */}
          {detalle.cotizaciones.length > 0 && (
            <div>
              <h4 className="mb-2 font-bold text-green-900">💬 Mensajes</h4>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-green-200 p-3 bg-green-50">
                {detalle.mensajes.length === 0 ? (
                  <p className="py-4 text-center text-sm text-green-600">Todavía no hay mensajes. Escribí abajo para empezar.</p>
                ) : (
                  detalle.mensajes.map((m) => (
                    <div key={m.id} className={`flex ${m.remitente.id === user?.id ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 ${m.remitente.id === user?.id ? "bg-green-700 text-yellow-400" : "bg-white text-green-900"}`}>
                        <p className="text-xs opacity-70">{m.remitente.nombre} · {formatFecha(m.creadoEn)}</p>
                        <p className="text-sm">{m.contenido}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <Input placeholder="Escribí un mensaje..." value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), enviarMensaje())} />
                <Button onClick={enviarMensaje} className="bg-green-700 text-yellow-400 hover:bg-green-800">
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Cancelar */}
          {(detalle.estado === "abierta" || detalle.estado === "en_progreso") && (
            <Button onClick={cancelar} disabled={accionando === "cancelar"} variant="outline" className="border-red-500 text-red-600">
              {accionando === "cancelar" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <X className="mr-1 h-3 w-3" />}
              Cancelar solicitud
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
