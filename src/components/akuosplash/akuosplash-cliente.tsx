"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { akuoGet, akuoPost, akuoApi, formatCLP } from "./akuosplash-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Droplets, User, History, MessageSquare, Plus, ChevronLeft, Send, Clock, MapPin, Package } from "lucide-react";
import { toast } from "sonner";

interface AkuoUser { id: string; email: string | null; nombre: string; telefono: string | null; rol: string; plan: string; }
interface Pedido { id: string; creadoEn: string; litros: number; direccion: string; comuna?: string; estado: string; metodoPago: string; nota?: string; precioTotal?: number; }
interface Conversacion { id: string; clienteId: string; transportistaId: string; cliente: { id: string; nombre: string; }; transportista: { id: string; nombre: string; razonSocial?: string; }; mensajes?: Mensaje[]; ultimoMensajeEn: string; }
interface Mensaje { id: string; creadoEn: string; contenido: string; remitenteId: string; remitente: { id: string; nombre: string; }; }

type Tab = "dashboard" | "historial" | "mensajes" | "perfil";

export function AkuosplashCliente() {
  const router = useRouter();
  const [user, setUser] = useState<AkuoUser | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("dashboard");
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

  if (user === undefined) return <div className="flex min-h-screen items-center justify-center bg-blue-50"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  if (!user) return null;

  const pedidosActivos = pedidos.filter(p => p.estado === "pendiente" || p.estado === "en_ruta" || p.estado === "aceptado");

  return (
    <div className="min-h-screen bg-blue-50">
      <header className="sticky top-0 z-40 border-b-2 border-blue-200 bg-blue-600 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button onClick={() => router.push("/akuosplash")} className="flex items-center gap-2">
            <img src="/akuosplash/logo.png" alt="AkuoSplash" className="h-8 w-auto" />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm hidden sm:inline">{user.nombre}</span>
            <Button variant="outline" size="sm" className="border-white text-white hover:bg-blue-700" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }}>Salir</Button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="sticky top-[56px] z-30 border-b border-blue-200 bg-white">
        <div className="mx-auto flex max-w-6xl overflow-x-auto">
          {([["dashboard", "Pedidos", Droplets], ["historial", "Historial", History], ["mensajes", "Mensajes", MessageSquare], ["perfil", "Perfil", User]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key as Tab)} className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${tab === key ? "border-blue-600 text-blue-600" : "border-transparent text-blue-400"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
        ) : (
          <>
            {/* === DASHBOARD === */}
            {tab === "dashboard" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold text-blue-900">Mis pedidos</h1>
                  <Button onClick={() => setShowNuevoPedido(true)} className="bg-blue-600 text-white hover:bg-blue-700">
                    <Plus className="mr-1 h-4 w-4" /> Nuevo pedido
                  </Button>
                </div>

                {pedidosActivos.length === 0 ? (
                  <Card className="border-2 border-blue-200">
                    <CardContent className="p-8 text-center">
                      <Droplets className="mx-auto mb-3 h-12 w-12 text-blue-300" />
                      <h3 className="text-lg font-bold text-blue-900">No tenés pedidos activos</h3>
                      <p className="text-blue-600 mt-1">Hacé clic en "Nuevo pedido" para pedir agua.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {pedidosActivos.map((p) => <PedidoCard key={p.id} p={p} />)}
                  </div>
                )}

                {/* Resumen */}
                <div className="grid grid-cols-3 gap-2 mt-6">
                  <div className="rounded-lg border border-blue-200 bg-white p-3 text-center">
                    <p className="text-xs text-blue-500">Pedidos activos</p>
                    <p className="text-2xl font-bold text-blue-900">{pedidosActivos.length}</p>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-white p-3 text-center">
                    <p className="text-xs text-blue-500">Total entregas</p>
                    <p className="text-2xl font-bold text-blue-900">{historial.filter(h => h.estado === "entregado").length}</p>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-white p-3 text-center">
                    <p className="text-xs text-blue-500">Litros este mes</p>
                    <p className="text-2xl font-bold text-blue-900">{historial.filter(h => h.estado === "entregado").reduce((s, h) => s + h.litros, 0)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* === HISTORIAL === */}
            {tab === "historial" && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold text-blue-900">Historial</h1>
                {historial.length === 0 ? (
                  <Card className="border-2 border-blue-200"><CardContent className="p-8 text-center"><History className="mx-auto mb-3 h-12 w-12 text-blue-300" /><p className="text-blue-600">Todavía no tenés entregas en el historial.</p></CardContent></Card>
                ) : (
                  <div className="space-y-2">
                    {historial.map((p) => <PedidoCard key={p.id} p={p} />)}
                  </div>
                )}
              </div>
            )}

            {/* === MENSAJES === */}
            {tab === "mensajes" && (
              <Mensajeria conversaciones={conversaciones} userId={user.id} onRefresh={() => setRefreshKey(k => k + 1)} />
            )}

            {/* === PERFIL === */}
            {tab === "perfil" && <Perfil user={user} onUpdated={() => setRefreshKey(k => k + 1)} />}
          </>
        )}
      </main>

      {/* Modal nuevo pedido */}
      {showNuevoPedido && <NuevoPedidoModal onClose={() => { setShowNuevoPedido(false); setRefreshKey(k => k + 1); }} />}
    </div>
  );
}

function PedidoCard({ p }: { p: Pedido }) {
  const estadoMap: Record<string, { label: string; color: string }> = {
    pendiente: { label: "Pendiente", color: "bg-amber-100 text-amber-800" },
    aceptado: { label: "Aceptado", color: "bg-blue-100 text-blue-800" },
    en_ruta: { label: "En ruta", color: "bg-purple-100 text-purple-800" },
    entregado: { label: "Entregado", color: "bg-green-100 text-green-800" },
    cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800" },
  };
  const est = estadoMap[p.estado] || { label: p.estado, color: "bg-gray-100 text-gray-800" };
  return (
    <Card className="border border-blue-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${est.color}`}>{est.label}</span>
            <p className="mt-2 font-medium text-blue-900">{p.litros} litros</p>
            <p className="text-sm text-blue-600 flex items-center gap-1"><MapPin className="h-3 w-3" />{p.direccion}{p.comuna ? `, ${p.comuna}` : ""}</p>
            <p className="text-xs text-blue-400 mt-1">{new Date(p.creadoEn).toLocaleString("es-CL")}</p>
          </div>
          <div className="text-right">
            {p.precioTotal && <p className="font-bold text-blue-900">{formatCLP(p.precioTotal)}</p>}
            <p className="text-xs text-blue-500">{p.metodoPago}</p>
          </div>
        </div>
        {p.nota && <p className="mt-2 text-xs text-blue-500 italic">"{p.nota}"</p>}
      </CardContent>
    </Card>
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

  async function guardar() {
    if (!direccion.trim()) { toast.error("Indicá tu dirección"); return; }
    setSaving(true);
    try {
      await akuoPost("/api/akuosplash/cliente/pedidos", {
        litros: Number(litros) || 1000,
        direccion: direccion.trim(),
        comuna: comuna.trim() || undefined,
        metodoPago,
        fechaDeseada: fechaDeseada || undefined,
        nota: nota.trim() || undefined,
      });
      toast.success("¡Pedido creado! Los transportistas van a verlo.");
      onClose();
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md border-2 border-blue-300 bg-white shadow-2xl">
        <CardHeader><CardTitle className="text-lg text-blue-900">Pedir agua</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Cuántos litros</Label>
            <div className="flex gap-2">
              {[500, 1000, 2000, 5000].map(l => (
                <button key={l} onClick={() => setLitros(String(l))} className={`flex-1 rounded-lg border py-2 text-sm ${litros === String(l) ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 text-blue-700"}`}>{l}L</button>
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
            <Button onClick={guardar} disabled={saving} className="flex-1 bg-blue-600 text-white hover:bg-blue-700">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pedir"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Mensajeria({ conversaciones, userId, onRefresh }: { conversaciones: Conversacion[]; userId: string; onRefresh: () => void }) {
  const [convActiva, setConvActiva] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMsg, setNuevoMsg] = useState("");
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    if (!convActiva) return;
    setLoadingMsgs(true);
    akuoGet<{ mensajes: Mensaje[] }>(`/api/akuosplash/mensajes?conversacionId=${convActiva}`).then(d => {
      setMensajes(d.mensajes);
    }).finally(() => setLoadingMsgs(false));
  }, [convActiva]);

  async function enviar() {
    if (!nuevoMsg.trim() || !convActiva) return;
    try {
      await akuoPost("/api/akuosplash/mensajes", { conversacionId: convActiva, contenido: nuevoMsg.trim() });
      setNuevoMsg("");
      // Recargar mensajes
      const d = await akuoGet<{ mensajes: Mensaje[] }>(`/api/akuosplash/mensajes?conversacionId=${convActiva}`);
      setMensajes(d.mensajes);
      onRefresh();
    } catch (e: any) { toast.error(e.message || "Error"); }
  }

  if (convActiva) {
    const conv = conversaciones.find(c => c.id === convActiva);
    const otroNombre = conv?.clienteId === userId ? conv?.transportista?.nombre : conv?.cliente?.nombre;
    return (
      <div className="space-y-3">
        <button onClick={() => setConvActiva(null)} className="flex items-center text-sm text-blue-600"><ChevronLeft className="h-4 w-4" /> Volver</button>
        <h2 className="text-lg font-bold text-blue-900">{otroNombre}</h2>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto rounded-lg border border-blue-200 bg-white p-3">
          {loadingMsgs ? <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin text-blue-400 mx-auto" /></div> :
            mensajes.length === 0 ? <p className="text-center py-4 text-sm text-blue-400">Sin mensajes. Escribí abajo.</p> :
            mensajes.map(m => (
              <div key={m.id} className={`flex ${m.remitenteId === userId ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 ${m.remitenteId === userId ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-900"}`}>
                      <p className="text-xs opacity-70">{m.remitente.nombre}</p>
                      <p className="text-sm">{m.contenido}</p>
                      <p className="text-[10px] opacity-50 mt-0.5">{new Date(m.creadoEn).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            ))
          }
        </div>
        <div className="flex gap-2">
          <Input placeholder="Escribí un mensaje..." value={nuevoMsg} onChange={(e: any) => setNuevoMsg(e.target.value)} onKeyDown={(e: any) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
          <Button onClick={enviar} className="bg-blue-600 text-white hover:bg-blue-700"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-blue-900">Mensajes</h1>
      {conversaciones.length === 0 ? (
        <Card className="border-2 border-blue-200"><CardContent className="p-8 text-center"><MessageSquare className="mx-auto mb-3 h-12 w-12 text-blue-300" /><p className="text-blue-600">Todavía no tenés mensajes. Cuando un transportista acepte tu pedido, vas a poder chatear con él.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {conversaciones.map(c => {
            const otro = c.clienteId === userId ? c.transportista : c.cliente;
            const ultimo = c.mensajes?.[0];
            return (
              <button key={c.id} onClick={() => setConvActiva(c.id)} className="w-full text-left">
                <Card className="border border-blue-200 hover:border-blue-400 transition">
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold">{otro?.nombre?.[0] || "?"}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-blue-900 truncate">{otro?.nombre}</p>
                      <p className="text-sm text-blue-500 truncate">{ultimo ? ultimo.contenido : "Sin mensajes"}</p>
                    </div>
                    <p className="text-xs text-blue-400">{new Date(c.ultimoMensajeEn).toLocaleDateString("es-CL")}</p>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Perfil({ user, onUpdated }: { user: AkuoUser; onUpdated: () => void }) {
  const [nombre, setNombre] = useState(user.nombre);
  const [telefono, setTelefono] = useState(user.telefono || "");
  const [saving, setSaving] = useState(false);

  async function guardar() {
    setSaving(true);
    try {
      await akuoApi("/api/akuosplash/cliente/perfil", { method: "PATCH", body: JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim() }) });
      toast.success("Perfil actualizado");
      onUpdated();
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-blue-900">Mi perfil</h1>
      <Card className="border-2 border-blue-200">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-2xl font-bold">{user.nombre?.[0] || "?"}</div>
            <div>
              <p className="font-bold text-blue-900">{user.nombre}</p>
              <p className="text-sm text-blue-500">{user.email}</p>
              <p className="text-xs text-blue-400">Plan: {user.plan}</p>
            </div>
          </div>
          <div><Label>Nombre</Label><Input value={nombre} onChange={(e: any) => setNombre(e.target.value)} /></div>
          <div><Label>Teléfono</Label><Input placeholder="+56 9 1234 5678" value={telefono} onChange={(e: any) => setTelefono(e.target.value)} /></div>
          <Button onClick={guardar} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar cambios"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
