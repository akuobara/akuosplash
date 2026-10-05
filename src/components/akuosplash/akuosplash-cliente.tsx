"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { akuoGet, akuoPost, akuoApi, formatCLP } from "./akuosplash-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Droplets, User, History, MessageSquare, Plus, ChevronLeft, Send, MapPin, Banknote, Clock, Wallet, Truck, CheckCircle2, XCircle, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface AkuoUser { id: string; email: string | null; nombre: string; telefono: string | null; rol: string; plan: string; }
interface Pedido {
  id: string; creadoEn: string; litros: number; direccion: string; comuna?: string; estado: string;
  metodoPago: string; nota?: string; precioTotal?: number;
  requierePresenciaCliente?: boolean;
  codigoConfirmacion?: string | null;
  codigoVerificadoEn?: string | null;
  codigoEnviadoPorMensaje?: boolean;
  codigoEnviadoEn?: string | null;
  transportistaId?: string | null;
}
interface Conversacion { id: string; clienteId: string; transportistaId: string; cliente: { id: string; nombre: string; }; transportista: { id: string; nombre: string; razonSocial?: string; }; mensajes?: Mensaje[]; ultimoMensajeEn: string; }
interface Mensaje { id: string; creadoEn: string; contenido: string; remitenteId: string; remitente: { id: string; nombre: string; }; }

function StatCard({ label, value, hint, icon: Icon, tone = "default" }: { label: string; value: string; hint?: string; icon?: any; tone?: "default" | "positive" | "warning" }) {
  const toneCls = tone === "positive" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : "text-foreground";
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${toneCls}`}>{value}</p>
            {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
          </div>
          {Icon && <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></div>}
        </div>
      </CardContent>
    </Card>
  );
}

function labelEstado(estado: string) {
  const m: Record<string, string> = { pendiente: "Pendiente", aceptado: "Aceptado", en_ruta: "En ruta", entregado: "Entregado", cancelado: "Cancelado" };
  return m[estado] || estado;
}
function colorEstado(estado: string) {
  const m: Record<string, string> = { pendiente: "bg-amber-100 text-amber-800 border-amber-300", aceptado: "bg-blue-100 text-blue-800 border-blue-300", en_ruta: "bg-purple-100 text-purple-800 border-purple-300", entregado: "bg-emerald-100 text-emerald-800 border-emerald-300", cancelado: "bg-red-100 text-red-800 border-red-300" };
  return m[estado] || "bg-gray-100 text-gray-800 border-gray-300";
}

export function AkuosplashCliente() {
  const router = useRouter();
  const [user, setUser] = useState<AkuoUser | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [historial, setHistorial] = useState<Pedido[]>([]);
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [showNuevoPedido, setShowNuevoPedido] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    akuoGet<{ user: AkuoUser | null }>("/api/akuosplash/auth/me").then((d) => {
      if (!d.user) { router.push("/akuosplash"); return; }
      if (d.user.rol !== "cliente" && d.user.rol !== "superadmin") { router.push("/akuosplash/" + d.user.rol); return; }
      setUser(d.user);
    });
  }, [router]);

  const cargar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [peds, hist, convs] = await Promise.all([
        akuoGet<{ pedidos: Pedido[] }>("/api/akuosplash/cliente/pedidos"),
        akuoGet<{ historial: Pedido[] }>("/api/akuosplash/cliente/historial"),
        akuoGet<{ conversaciones: Conversacion[] }>("/api/akuosplash/mensajes"),
      ]);
      setPedidos(peds.pedidos);
      setHistorial(hist.historial);
      setConversaciones(convs.conversaciones);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user, refreshKey]);

  useEffect(() => { if (user) cargar(); }, [user, refreshKey]);

  if (user === undefined) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  const pedidosActivos = pedidos.filter(p => p.estado === "pendiente" || p.estado === "aceptado" || p.estado === "en_ruta");
  const entregados = historial.filter(h => h.estado === "entregado");
  const litrosTotal = entregados.reduce((s, h) => s + h.litros, 0);
  const gastosTotal = entregados.reduce((s, h) => s + (h.precioTotal || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header — mismo estilo que Aljibe */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <button onClick={() => router.push("/akuosplash")} className="flex items-center gap-2">
            <img src="/akuosplash/logo.png" alt="AkuoSplash" className="h-8 w-auto" />
            <div className="text-left hidden sm:block">
              <p className="font-bold text-primary">AkuoSplash</p>
              <p className="-mt-1 text-xs text-muted-foreground">Cliente · {user.nombre}</p>
            </div>
          </button>
          <Button variant="outline" size="sm" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }}>
            Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        {/* Botón nuevo pedido */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Hola, {user.nombre}</h1>
            <p className="text-sm text-muted-foreground">Gestioná tus pedidos de agua</p>
          </div>
          <Button onClick={() => setShowNuevoPedido(true)} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Nuevo pedido
          </Button>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="dashboard" className="flex-1"><Droplets className="mr-1 h-4 w-4" /> Pedidos</TabsTrigger>
            <TabsTrigger value="historial" className="flex-1"><History className="mr-1 h-4 w-4" /> Historial</TabsTrigger>
            <TabsTrigger value="mensajes" className="flex-1"><MessageSquare className="mr-1 h-4 w-4" /> Mensajes</TabsTrigger>
            <TabsTrigger value="perfil" className="flex-1"><User className="mr-1 h-4 w-4" /> Perfil</TabsTrigger>
          </TabsList>

          {/* === DASHBOARD === */}
          <TabsContent value="dashboard" className="space-y-4 mt-4">
            {/* Pedidos activos */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pedidos activos ({pedidosActivos.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : pedidosActivos.length === 0 ? (
                  <div className="py-8 text-center">
                    <Droplets className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No tenés pedidos activos. Hacé clic en "Nuevo pedido".</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pedidosActivos.map((p) => <PedidoRow key={p.id} p={p} onRefresh={() => setRefreshKey(k => k + 1)} />)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === HISTORIAL === */}
          <TabsContent value="historial" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Último pedido</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : historial.length === 0 ? (
                  <div className="py-8 text-center">
                    <History className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Todavía no tenés entregas.</p>
                  </div>
                ) : (
                  <>
                    <PedidoRow p={historial[0]} />
                    {historial.length > 1 && (
                      <p className="mt-3 text-center text-sm text-muted-foreground">
                        Y {historial.length - 1} pedido(s) más en tu historial
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === MENSAJES === */}
          <TabsContent value="mensajes" className="mt-4">
            <Mensajeria conversaciones={conversaciones} userId={user.id} loading={loading} onRefresh={() => setRefreshKey(k => k + 1)} />
          </TabsContent>

          {/* === PERFIL === */}
          <TabsContent value="perfil" className="mt-4">
            <Perfil user={user} onUpdated={() => setRefreshKey(k => k + 1)} />
          </TabsContent>
        </Tabs>
      </main>

      {showNuevoPedido && <NuevoPedidoModal onClose={() => { setShowNuevoPedido(false); setRefreshKey(k => k + 1); }} />}
    </div>
  );
}

function PedidoRow({ p }: { p: Pedido; onRefresh?: () => void }) {
  const yaEntregado = !!p.codigoVerificadoEn || p.estado === "entregado";

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={colorEstado(p.estado)}>{labelEstado(p.estado)}</Badge>
            <span className="font-medium">{p.litros.toLocaleString("es-CL")} L</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {p.direccion}{p.comuna ? `, ${p.comuna}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {new Date(p.creadoEn).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </p>
          {p.nota && <p className="mt-1 text-xs italic text-muted-foreground">"{p.nota}"</p>}
        </div>
        <div className="text-right shrink-0">
          {p.precioTotal && <p className="font-bold tabular-nums">{formatCLP(p.precioTotal)}</p>}
          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
            <Banknote className="h-3 w-3" /> {p.metodoPago}
          </p>
        </div>
      </div>

      {/* Código de confirmación de entrega */}
      {!yaEntregado && p.codigoConfirmacion && (
        <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="h-4 w-4 text-violet-700" />
            <p className="text-xs font-medium text-violet-700">Tu código de entrega</p>
          </div>
          <p className="text-3xl font-bold tabular-nums tracking-[0.3em] text-violet-900">{p.codigoConfirmacion}</p>
          <p className="text-[11px] text-violet-600 mt-1">Dáselo al repartidor al finalizar la entrega.</p>
        </div>
      )}

      {yaEntregado && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          <p className="text-xs font-medium text-emerald-700">Entrega confirmada</p>
        </div>
      )}
    </div>
  );
}

function NuevoPedidoModal({ onClose }: { onClose: () => void }) {
  const [litros, setLitros] = useState("1000");
  const [direccion, setDireccion] = useState("");
  const [comuna, setComuna] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [fechaDeseada, setFechaDeseada] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);

  // Pre-llenar dirección del perfil
  useEffect(() => {
    akuoGet<{ user: any }>("/api/akuosplash/cliente/perfil").then(d => {
      if (d.user?.direccion) setDireccion(d.user.direccion);
      if (d.user?.comuna) setComuna(d.user.comuna);
    });
  }, []);

  async function guardar() {
    if (!direccion.trim()) { toast.error("Indicá tu dirección"); return; }
    setSaving(true);
    try {
      await akuoPost("/api/akuosplash/cliente/pedidos", {
        litros: Number(litros) || 1000, direccion: direccion.trim(), comuna: comuna.trim() || undefined,
        metodoPago, fechaDeseada: fechaDeseada || undefined, nota: nota.trim() || undefined,
      });
      toast.success("¡Pedido creado!");
      onClose();
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md border-2 border-primary/30 shadow-2xl">
        <CardHeader><CardTitle className="text-lg">Pedir agua</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Cuántos litros</Label>
            <div className="flex gap-2">
              {[500, 1000, 2000, 5000].map(l => (
                <button key={l} type="button" onClick={() => setLitros(String(l))} className={`flex-1 rounded-lg border py-2 text-sm font-medium ${litros === String(l) ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted"}`}>{l}L</button>
              ))}
            </div>
          </div>
          <div><Label>Dirección</Label><Input placeholder="Calle, número, depto" value={direccion} onChange={(e: any) => setDireccion(e.target.value)} /></div>
          <div><Label>Comuna</Label><Input placeholder="Ej: Vitacura" value={comuna} onChange={(e: any) => setComuna(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Fecha deseada</Label><Input type="date" value={fechaDeseada} onChange={(e: any) => setFechaDeseada(e.target.value)} /></div>
            <div><Label>Pago</Label><select className="w-full rounded-md border px-3 py-2 text-sm" value={metodoPago} onChange={(e: any) => setMetodoPago(e.target.value)}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option></select></div>
          </div>
          <div><Label>Nota (opcional)</Label><Textarea rows={2} placeholder="Ej: tocar timbre, dejar en portería" value={nota} onChange={(e: any) => setNota(e.target.value)} /></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button onClick={guardar} disabled={saving} className="flex-1">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pedir"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

}

function Mensajeria({ conversaciones, userId, loading, onRefresh }: { conversaciones: Conversacion[]; userId: string; loading: boolean; onRefresh: () => void }) {
  const [convActiva, setConvActiva] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMsg, setNuevoMsg] = useState("");
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    if (!convActiva) return;
    setLoadingMsgs(true);
    akuoGet<{ mensajes: Mensaje[] }>(`/api/akuosplash/mensajes?conversacionId=${convActiva}`).then(d => setMensajes(d.mensajes)).finally(() => setLoadingMsgs(false));
  }, [convActiva]);

  async function enviar() {
    if (!nuevoMsg.trim() || !convActiva) return;
    try {
      await akuoPost("/api/akuosplash/mensajes", { conversacionId: convActiva, contenido: nuevoMsg.trim() });
      setNuevoMsg("");
      const d = await akuoGet<{ mensajes: Mensaje[] }>(`/api/akuosplash/mensajes?conversacionId=${convActiva}`);
      setMensajes(d.mensajes);
      onRefresh();
    } catch (e: any) { toast.error(e.message || "Error"); }
  }

  if (convActiva) {
    const conv = conversaciones.find(c => c.id === convActiva);
    const otroNombre = conv?.clienteId === userId ? conv?.transportista?.nombre : conv?.cliente?.nombre;
    return (
      <Card>
        <CardHeader className="pb-3">
          <button onClick={() => setConvActiva(null)} className="flex items-center text-sm text-primary mb-2"><ChevronLeft className="h-4 w-4" /> Volver</button>
          <CardTitle className="text-base">{otroNombre}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-h-[60vh] space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
            {loadingMsgs ? <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></div> :
            mensajes.length === 0 ? <p className="text-center py-4 text-sm text-muted-foreground">Sin mensajes. Escribí abajo.</p> :
            mensajes.map(m => (
              <div key={m.id} className={`flex ${m.remitenteId === userId ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 ${m.remitenteId === userId ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
                  <p className="text-xs opacity-70">{m.remitente.nombre}</p>
                  <p className="text-sm">{m.contenido}</p>
                  <p className="text-[10px] opacity-50 mt-0.5">{new Date(m.creadoEn).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Escribí un mensaje..." value={nuevoMsg} onChange={(e: any) => setNuevoMsg(e.target.value)} onKeyDown={(e: any) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
            <Button onClick={enviar}><Send className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Mensajes ({conversaciones.length})</CardTitle></CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> :
        conversaciones.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Todavía no tenés mensajes. Cuando un transportista acepte tu pedido, vas a poder chatear con él.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversaciones.map(c => {
              const otro = c.clienteId === userId ? c.transportista : c.cliente;
              const ultimo = c.mensajes?.[0];
              return (
                <button key={c.id} onClick={() => setConvActiva(c.id)} className="w-full text-left">
                  <div className="flex items-center gap-3 rounded-lg border border-border p-3 transition hover:border-primary/40 hover:bg-muted/30">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">{otro?.nombre?.[0] || "?"}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{otro?.nombre}</p>
                      <p className="text-sm text-muted-foreground truncate">{ultimo ? ultimo.contenido : "Sin mensajes"}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(c.ultimoMensajeEn).toLocaleDateString("es-CL")}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Perfil({ user, onUpdated }: { user: AkuoUser; onUpdated: () => void }) {
  const [form, setForm] = useState({
    nombre: user.nombre || '',
    telefono: user.telefono || '',
    direccion: '',
    comuna: '',
    lat: '',
    lng: '',
    rut: '',
    indicacionesAcceso: '',
    requiereClientePresente: true,
    usoAgua: 'consumo',
  });
  const [saving, setSaving] = useState(false);

  // Cargar datos completos del perfil
  useEffect(() => {
    akuoGet<{ user: any }>("/api/akuosplash/cliente/perfil").then(d => {
      if (d.user) {
        setForm({
          nombre: d.user.nombre || '', telefono: d.user.telefono || '',
          direccion: d.user.direccion || '', comuna: d.user.comuna || '',
          lat: d.user.lat ? String(d.user.lat) : '', lng: d.user.lng ? String(d.user.lng) : '',
          rut: d.user.rut || '', indicacionesAcceso: d.user.indicacionesAcceso || '',
          requiereClientePresente: d.user.requiereClientePresente ?? true,
          usoAgua: d.user.usoAgua || 'consumo',
        });
      }
    });
  }, []);

  function update(field: string, value: any) {
    setForm({ ...form, [field]: value });
  }

  async function guardar() {
    setSaving(true);
    try {
      await akuoApi("/api/akuosplash/cliente/perfil", {
        method: "PATCH",
        body: JSON.stringify({
          nombre: form.nombre, telefono: form.telefono,
          direccion: form.direccion, comuna: form.comuna,
          lat: form.lat || undefined, lng: form.lng || undefined,
          rut: form.rut, indicacionesAcceso: form.indicacionesAcceso,
          requiereClientePresente: form.requiereClientePresente,
          usoAgua: form.usoAgua,
        }),
      });
      toast.success("Perfil actualizado");
      onUpdated();
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      {/* Datos personales */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Datos personales</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 mb-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-bold">{form.nombre?.[0] || "?"}</div>
            <div><p className="font-bold">{user.email}</p><Badge variant="outline">Plan: {user.plan}</Badge></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Nombre</Label><Input value={form.nombre} onChange={(e: any) => update("nombre", e.target.value)} /></div>
            <div><Label>RUT (opcional)</Label><Input placeholder="12.345.678-9" value={form.rut} onChange={(e: any) => update("rut", e.target.value)} /></div>
            <div><Label>Teléfono</Label><Input placeholder="+56 9 1234 5678" value={form.telefono} onChange={(e: any) => update("telefono", e.target.value)} /></div>
            <div><Label>Uso del agua</Label>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.usoAgua} onChange={(e: any) => update("usoAgua", e.target.value)}>
                <option value="consumo">Consumo humano</option>
                <option value="riego_pasto">Riego pasto</option>
                <option value="riego_cultivos">Riego cultivos</option>
                <option value="polvo_caminos">Polvo caminos</option>
                <option value="construccion">Construcción</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ubicación */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Ubicación de entrega</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Dirección</Label><Input placeholder="Calle, número, depto" value={form.direccion} onChange={(e: any) => update("direccion", e.target.value)} /></div>
          <div><Label>Comuna</Label><Input placeholder="Ej: Vitacura, Las Condes" value={form.comuna} onChange={(e: any) => update("comuna", e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Latitud (opcional)</Label><Input placeholder="-33.4" value={form.lat} onChange={(e: any) => update("lat", e.target.value)} /></div>
            <div><Label>Longitud (opcional)</Label><Input placeholder="-70.6" value={form.lng} onChange={(e: any) => update("lng", e.target.value)} /></div>
          </div>
          <div>
            <Label>Indicaciones de acceso</Label>
            <Textarea rows={2} placeholder="Ej: tocar timbre 2, el estanque está atrás, pasar manguera por encima del portón" value={form.indicacionesAcceso} onChange={(e: any) => update("indicacionesAcceso", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.requiereClientePresente} onChange={(e: any) => update("requiereClientePresente", e.target.checked)} />
            Requiere que el cliente esté presente para recibir el agua
          </label>
        </CardContent>
      </Card>

      <Button onClick={guardar} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar todos los cambios"}
      </Button>
    </div>
  );
}
