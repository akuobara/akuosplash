"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { akuoGet, akuoPost, akuoApi, formatCLP } from "@/components/akuosplash/akuosplash-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2, Droplets, Truck, History, MessageSquare, User, Plus, ChevronLeft, Send,
  MapPin, Banknote, Clock, KeyRound, CheckCircle2, ShieldCheck, Phone, Navigation, Wallet,
  Building2, FileText,
} from "lucide-react";
import { toast } from "sonner";

interface AkuoUser { id: string; email: string | null; nombre: string; telefono: string | null; rol: string; plan: string; saldo?: number; }
interface PrecioInfo {
  total: number;          // neto sin IVA (lo que el repartidor referencia)
  iva: number;
  totalConIva: number;     // lo que paga el cliente
  comision: number;
  comisionPct: number;
  gananciaRepartidor: number;
  precioDinamico: boolean;
  precioPorLitroFinal: number | null;
  snapshot: any;
}
interface PedidoDisponible {
  id: string; creadoEn: string; litros: number; direccion: string; comuna?: string; estado: string;
  metodoPago: string; nota?: string; requierePresenciaCliente?: boolean;
  cliente: { id: string; nombre: string; telefono: string | null; email: string | null };
  precioTotal?: number | null;
  _precio?: PrecioInfo;
}
interface PedidoAsignado extends PedidoDisponible {
  transportistaId?: string | null;
  cliente: { id: string; nombre: string; telefono: string | null; email: string | null; direccion?: string | null; comuna?: string | null; lat?: number | null; lng?: number | null; indicacionesAcceso?: string | null };
}
interface Conversacion { id: string; clienteId: string; transportistaId: string; cliente: { id: string; nombre: string; }; transportista: { id: string; nombre: string; razonSocial?: string; }; mensajes?: Mensaje[]; ultimoMensajeEn: string; }
interface Mensaje { id: string; creadoEn: string; contenido: string; remitenteId: string; remitente: { id: string; nombre: string; }; }

function StatCard({ label, value, hint, icon: Icon, tone = "default" }: { label: string; value: string; hint?: string; icon?: any; tone?: "default" | "positive" | "warning" }) {
  const toneCls = tone === "positive" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : "text-foreground";
  return (
    <Card>
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

export function AkuosplashTransportista() {
  const router = useRouter();
  const [user, setUser] = useState<AkuoUser | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [disponibles, setDisponibles] = useState<PedidoDisponible[]>([]);
  const [asignados, setAsignados] = useState<PedidoAsignado[]>([]);
  const [historial, setHistorial] = useState<PedidoAsignado[]>([]);
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    akuoGet<{ user: AkuoUser | null }>("/api/akuosplash/auth/me").then((d) => {
      if (!d.user) { router.push("/akuosplash"); return; }
      if (d.user.rol !== "transportista" && d.user.rol !== "superadmin") { router.push("/akuosplash/" + d.user.rol); return; }
      setUser(d.user);
    });
  }, [router]);

  const cargar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [disp, asig, hist, convs] = await Promise.all([
        akuoGet<{ disponibles: PedidoDisponible[]; asignados: PedidoAsignado[] }>("/api/akuosplash/transportista/pedidos"),
        Promise.resolve(null),
        Promise.resolve(null),
        akuoGet<{ conversaciones: Conversacion[] }>("/api/akuosplash/mensajes"),
      ]);
      setDisponibles(disp.disponibles);
      setAsignados(disp.asignados);
      // Para historial, llamar endpoint separado si existe, sino usar vacío
      setHistorial([]);
      setConversaciones(convs.conversaciones);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user, refreshKey]);

  useEffect(() => { if (user) cargar(); }, [user, refreshKey]);

  if (user === undefined) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  const pedidosEnRuta = asignados.filter(p => p.estado === "en_ruta");
  const pedidosAceptados = asignados.filter(p => p.estado === "aceptado");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <button onClick={() => router.push("/akuosplash")} className="flex items-center gap-2">
            <img src="/akuosplash/logo.png" alt="AkuoSplash" className="h-8 w-auto" />
            <div className="text-left hidden sm:block">
              <p className="font-bold text-primary">AkuoSplash</p>
              <p className="-mt-1 text-xs text-muted-foreground">Transportista · {user.nombre}</p>
            </div>
          </button>
          <Button variant="outline" size="sm" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }}>
            Salir
          </Button>
        </div>
      </header>

      {/* Banner superadmin: atajo para volver al panel admin */}
      {user.rol === "superadmin" && (
        <Link href="/akuosplash/superadmin" className="block bg-violet-600 text-white text-xs py-1.5 text-center font-medium hover:bg-violet-700 transition">
          Estás viendo como repartidor (modo superadmin) — Tocá para volver al panel de administración
        </Link>
      )}

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hola, {user.nombre}</h1>
          <p className="text-sm text-muted-foreground">Gestioná pedidos y entregas</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Disponibles" value={String(disponibles.length)} hint="Por aceptar" icon={Droplets} />
          <StatCard label="Aceptados" value={String(pedidosAceptados.length)} hint="Listos para entregar" icon={Truck} tone="warning" />
          <StatCard label="En ruta" value={String(pedidosEnRuta.length)} hint="Yendo a entregar" icon={Navigation} />
          <StatCard label="Entregados" value={String(historial.length)} hint="Total histórico" icon={CheckCircle2} tone="positive" />
        </div>

        <Tabs defaultValue="disponibles">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="disponibles" className="flex-1"><Droplets className="mr-1 h-4 w-4" /> Disponibles ({disponibles.length})</TabsTrigger>
            <TabsTrigger value="asignados" className="flex-1"><Truck className="mr-1 h-4 w-4" /> Mis pedidos ({asignados.length})</TabsTrigger>
            <TabsTrigger value="mensajes" className="flex-1"><MessageSquare className="mr-1 h-4 w-4" /> Mensajes</TabsTrigger>
            <TabsTrigger value="perfil" className="flex-1"><User className="mr-1 h-4 w-4" /> Perfil</TabsTrigger>
          </TabsList>

          {/* === DISPONIBLES === */}
          <TabsContent value="disponibles" className="space-y-3 mt-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Pedidos disponibles</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : disponibles.length === 0 ? (
                  <div className="py-8 text-center">
                    <Droplets className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No hay pedidos disponibles en este momento.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {disponibles.map((p) => <PedidoDisponibleRow key={p.id} p={p} onRefresh={() => setRefreshKey(k => k + 1)} />)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === ASIGNADOS === */}
          <TabsContent value="asignados" className="space-y-3 mt-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Pedidos asignados a mí</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : asignados.length === 0 ? (
                  <div className="py-8 text-center">
                    <Truck className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No tenés pedidos asignados. Aceptá uno de la lista de disponibles.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {asignados.map((p) => <PedidoAsignadoRow key={p.id} p={p} userId={user.id} onRefresh={() => setRefreshKey(k => k + 1)} />)}
                  </div>
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
            <PerfilTransportista user={user} onUpdated={() => setRefreshKey(k => k + 1)} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function PedidoDisponibleRow({ p, onRefresh }: { p: PedidoDisponible; onRefresh: () => void }) {
  const [aceptando, setAceptando] = useState(false);

  async function aceptar() {
    setAceptando(true);
    try {
      const res = await akuoPost<{ ok: boolean; error?: string }>(`/api/akuosplash/transportista/pedidos/${p.id}/aceptar`);
      if (res.ok) {
        toast.success("Pedido aceptado");
        onRefresh();
      } else {
        toast.error(res.error || "No se pudo aceptar");
      }
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setAceptando(false); }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{p.litros.toLocaleString("es-CL")} L</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {p.direccion}{p.comuna ? `, ${p.comuna}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {new Date(p.creadoEn).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Cliente: {p.cliente.nombre}</p>
          {p.nota && <p className="mt-1 text-xs italic text-muted-foreground">"{p.nota}"</p>}
          {/* Desglose financiero — solo visible para el repartidor */}
          {p._precio && <PrecioDesglose precio={p._precio} />}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
            <Banknote className="h-3 w-3" /> {p.metodoPago}
          </p>
          <Button size="sm" onClick={aceptar} disabled={aceptando} className="mt-2">
            {aceptando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceptar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PrecioDesglose({ precio }: { precio: PrecioInfo }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/50 p-2 text-xs dark:border-emerald-900 dark:bg-emerald-950/30">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center justify-between font-medium text-emerald-800 dark:text-emerald-300"
      >
        <span className="flex items-center gap-1">
          <Wallet className="h-3 w-3" /> Tu ganancia: {formatCLP(precio.gananciaRepartidor)}
        </span>
        <span className="text-[10px] text-muted-foreground">{abierto ? "Ocultar" : "Ver detalle"}</span>
      </button>
      {abierto && (
        <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
          <div className="flex justify-between">
            <span>Precio bruto (paga cliente con IVA)</span>
            <span className="tabular-nums font-medium text-foreground">{formatCLP(precio.totalConIva)}</span>
          </div>
          <div className="flex justify-between">
            <span>Subtotal neto (sin IVA)</span>
            <span className="tabular-nums">{formatCLP(precio.total)}</span>
          </div>
          <div className="flex justify-between">
            <span>IVA 19%</span>
            <span className="tabular-nums">{formatCLP(precio.iva)}</span>
          </div>
          <div className="flex justify-between border-t border-emerald-200 dark:border-emerald-900 pt-0.5 mt-0.5">
            <span>Comisión plataforma ({precio.comisionPct}%)</span>
            <span className="tabular-nums text-red-600 dark:text-red-400">-{formatCLP(precio.comision)}</span>
          </div>
          <div className="flex justify-between font-medium text-emerald-700 dark:text-emerald-300">
            <span>Tu ganancia</span>
            <span className="tabular-nums">{formatCLP(precio.gananciaRepartidor)}</span>
          </div>
          {precio.precioPorLitroFinal != null && (
            <p className="mt-1 text-[10px] text-muted-foreground/70">
              Precio por litro: ${precio.precioPorLitroFinal.toFixed(0)}/L
              {precio.precioDinamico && " (calculado dinámicamente)"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PedidoAsignadoRow({ p, userId, onRefresh }: { p: PedidoAsignado; userId: string; onRefresh: () => void }) {
  const [codigoInput, setCodigoInput] = useState("");
  const [verificando, setVerificando] = useState(false);
  const yaEntregado = p.estado === "entregado";

  async function verificarEntrega() {
    if (!codigoInput.trim()) {
      toast.error("Ingresá el código de confirmación");
      return;
    }
    setVerificando(true);
    try {
      const res = await akuoPost<{ ok: boolean; error?: string; mensaje?: string }>(`/api/akuosplash/transportista/pedidos/${p.id}/verificar-entrega`, { codigo: codigoInput.trim() });
      if (res.ok) {
        toast.success("Entrega confirmada");
        setCodigoInput("");
        onRefresh();
      } else {
        toast.error(res.error || "No se pudo verificar");
      }
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setVerificando(false); }
  }

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
          {p.cliente?.telefono && (
            <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              <a href={`tel:${p.cliente.telefono}`} className="hover:underline">{p.cliente.telefono}</a>
            </p>
          )}
          {p.cliente?.indicacionesAcceso && (
            <p className="mt-1 text-xs italic text-muted-foreground">Acceso: {p.cliente.indicacionesAcceso}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">Cliente: {p.cliente.nombre}</p>
          {p.nota && <p className="mt-1 text-xs italic text-muted-foreground">"{p.nota}"</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
            <Banknote className="h-3 w-3" /> {p.metodoPago}
          </p>
        </div>
      </div>

      {/* Sección de verificación de entrega */}
      {!yaEntregado && (
        <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
          <p className="text-xs font-medium text-violet-700 mb-1 flex items-center gap-1">
            <KeyRound className="h-3.5 w-3.5" /> Ingresá el código al finalizar la entrega
          </p>
          <p className="text-[11px] text-violet-600 mb-2">
            Pedíselo al cliente (en persona o por el medio que acuerden).
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="1234"
              value={codigoInput}
              onChange={(e: any) => setCodigoInput(e.target.value.replace(/[^0-9]/g, ""))}
              className="flex-1 font-mono tracking-[0.3em] text-center text-lg"
              maxLength={4}
              inputMode="numeric"
            />
            <Button onClick={verificarEntrega} disabled={verificando} className="bg-violet-600 hover:bg-violet-700">
              {verificando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            </Button>
          </div>
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
    const otroNombre = conv?.transportistaId === userId ? conv?.cliente?.nombre : conv?.transportista?.nombre;
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
                  <p className="text-sm whitespace-pre-wrap">{m.contenido}</p>
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
            <p className="text-muted-foreground">Todavía no tenés mensajes. Cuando un cliente te envíe el código de confirmación, vas a verlo acá.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversaciones.map(c => {
              const otro = c.transportistaId === userId ? c.cliente : c.transportista;
              const ultimo = c.mensajes?.[0];
              return (
                <button key={c.id} onClick={() => setConvActiva(c.id)} className="w-full text-left">
                  <div className="flex items-center gap-3 rounded-lg border border-border p-3 transition hover:border-primary/40 hover:bg-muted/30">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">{otro?.nombre?.[0] || "?"}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{otro?.nombre}</p>
                      <p className="text-sm text-muted-foreground truncate whitespace-pre-wrap">{ultimo ? ultimo.contenido : "Sin mensajes"}</p>
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


export function PerfilTransportista({ user, onUpdated }: { user: AkuoUser; onUpdated: () => void }) {
  const [perfil, setPerfil] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    nombre: '', telefono: '', rut: '',
    razonSocial: '', rutEmpresa: '', giro: '', inicioActividades: '',
    direccionEmpresa: '', comunaEmpresa: '', ciudadEmpresa: '', telefonoEmpresa: '', emailEmpresa: '',
    bancoNombre: '', bancoTipoCuenta: '', bancoNumeroCuenta: '', bancoTitular: '', bancoRutTitular: '', bancoEmail: '',
    facturacionPlataforma: '', facturacionApiKey: '',
    areasCobertura: '', descripcion: '',
    precioEfectivoPorLitro: '', precioTransferenciaPorLitro: '',
  });

  useEffect(() => {
    akuoGet<{ user: any }>("/api/akuosplash/cliente/perfil").then(d => {
      if (!d.user) return;
      const u = d.user;
      setPerfil(d);
      setForm({
        nombre: u.nombre || '', telefono: u.telefono || '', rut: u.rut || '',
        razonSocial: u.razonSocial || '', rutEmpresa: u.rutEmpresa || '', giro: u.giro || '',
        inicioActividades: u.inicioActividades ? new Date(u.inicioActividades).toISOString().split('T')[0] : '',
        direccionEmpresa: u.direccionEmpresa || '', comunaEmpresa: u.comunaEmpresa || '',
        ciudadEmpresa: u.ciudadEmpresa || '', telefonoEmpresa: u.telefonoEmpresa || '', emailEmpresa: u.emailEmpresa || '',
        bancoNombre: u.bancoNombre || '', bancoTipoCuenta: u.bancoTipoCuenta || '',
        bancoNumeroCuenta: u.bancoNumeroCuenta || '', bancoTitular: u.bancoTitular || '',
        bancoRutTitular: u.bancoRutTitular || '', bancoEmail: u.bancoEmail || '',
        facturacionPlataforma: u.facturacionPlataforma || '', facturacionApiKey: u.facturacionApiKey || '',
        patenteVehiculo: u.patenteVehiculo || '', tipoVehiculo: u.tipoVehiculo || 'aljibe',
        capacidadVehiculoKg: u.capacidadVehiculoKg ? String(u.capacidadVehiculoKg) : '',
        areasCobertura: u.areasCobertura || '', descripcion: u.descripcion || '',
        precioEfectivoPorLitro: u.precioEfectivoPorLitro ? String(u.precioEfectivoPorLitro) : '',
        precioTransferenciaPorLitro: u.precioTransferenciaPorLitro ? String(u.precioTransferenciaPorLitro) : '',
      });
    }).catch(() => {});
  }, []);

  function update(field: string, value: any) { setForm({ ...form, [field]: value }); }

  async function guardar() {
    if (!form.rut.trim()) { toast.error("El RUT personal es obligatorio"); return; }
    setSaving(true);
    try {
      await akuoApi("/api/akuosplash/cliente/perfil", {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          precioEfectivoPorLitro: form.precioEfectivoPorLitro ? Number(form.precioEfectivoPorLitro) : undefined,
          precioTransferenciaPorLitro: form.precioTransferenciaPorLitro ? Number(form.precioTransferenciaPorLitro) : undefined,
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
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Datos personales</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 mb-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-bold">{form.nombre?.[0] || "?"}</div>
            <div><p className="font-bold">{user.email}</p><Badge variant="outline">Plan: {user.plan}</Badge></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Nombre *</Label><Input value={form.nombre} onChange={(e) => update("nombre", e.target.value)} /></div>
            <div><Label>RUT personal *</Label><Input placeholder="12.345.678-9" value={form.rut} onChange={(e) => update("rut", e.target.value)} /></div>
            <div><Label>Teléfono</Label><Input placeholder="+56 9 1234 5678" value={form.telefono} onChange={(e) => update("telefono", e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Datos de la empresa */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Datos de la empresa</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Datos legales necesarios para facturación ante el SII.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Razón social</Label><Input placeholder="Agua San Pedro Ltda." value={form.razonSocial} onChange={(e) => update("razonSocial", e.target.value)} /></div>
            <div><Label>RUT empresa</Label><Input placeholder="76.123.456-7" value={form.rutEmpresa} onChange={(e) => update("rutEmpresa", e.target.value)} /></div>
            <div><Label>Giro</Label><Input placeholder="Distribución de agua potable" value={form.giro} onChange={(e) => update("giro", e.target.value)} /></div>
            <div><Label>Inicio de actividades</Label><Input type="date" value={form.inicioActividades} onChange={(e) => update("inicioActividades", e.target.value)} /></div>
            <div><Label>Dirección fiscal</Label><Input placeholder="Av. Las Condes 123" value={form.direccionEmpresa} onChange={(e) => update("direccionEmpresa", e.target.value)} /></div>
            <div><Label>Comuna</Label><Input placeholder="Las Condes" value={form.comunaEmpresa} onChange={(e) => update("comunaEmpresa", e.target.value)} /></div>
            <div><Label>Ciudad</Label><Input placeholder="Santiago" value={form.ciudadEmpresa} onChange={(e) => update("ciudadEmpresa", e.target.value)} /></div>
            <div><Label>Teléfono empresa</Label><Input placeholder="+56 2 2345 6789" value={form.telefonoEmpresa} onChange={(e) => update("telefonoEmpresa", e.target.value)} /></div>
            <div><Label>Email empresa</Label><Input placeholder="contacto@empresa.cl" value={form.emailEmpresa} onChange={(e) => update("emailEmpresa", e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Datos bancarios */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Datos bancarios</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Para recibir pagos por transferencia bancaria de los clientes.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Banco</Label><Input placeholder="Banco de Chile" value={form.bancoNombre} onChange={(e) => update("bancoNombre", e.target.value)} /></div>
            <div><Label>Tipo de cuenta</Label>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.bancoTipoCuenta} onChange={(e) => update("bancoTipoCuenta", e.target.value)}>
                <option value="">Seleccionar...</option>
                <option value="cuenta_corriente">Cuenta corriente</option>
                <option value="cuenta_vista">Cuenta vista</option>
                <option value="cuenta_ahorro">Cuenta de ahorro</option>
              </select>
            </div>
            <div><Label>Número de cuenta</Label><Input placeholder="000-12345678-90" value={form.bancoNumeroCuenta} onChange={(e) => update("bancoNumeroCuenta", e.target.value)} /></div>
            <div><Label>Titular de la cuenta</Label><Input placeholder="Nombre del titular" value={form.bancoTitular} onChange={(e) => update("bancoTitular", e.target.value)} /></div>
            <div><Label>RUT del titular</Label><Input placeholder="12.345.678-9" value={form.bancoRutTitular} onChange={(e) => update("bancoRutTitular", e.target.value)} /></div>
            <div><Label>Email para comprobante</Label><Input placeholder="pagos@empresa.cl" value={form.bancoEmail} onChange={(e) => update("bancoEmail", e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Facturación electrónica SII */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Facturación electrónica (SII)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Integración con plataforma externa de facturación electrónica ante el SII.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Plataforma de facturación</Label>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.facturacionPlataforma} onChange={(e) => update("facturacionPlataforma", e.target.value)}>
                <option value="">Sin plataforma</option>
                <option value="wasabil">wasabil.com</option>
                <option value="otro">Otra</option>
              </select>
            </div>
            <div><Label>API Key</Label><Input type="password" placeholder="Clave de API de la plataforma" value={form.facturacionApiKey} onChange={(e) => update("facturacionApiKey", e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* MercadoPago */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> MercadoPago (split payment)</CardTitle></CardHeader>
        <CardContent>
          {perfil?.user?.mpConnected ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
              <p className="font-medium">✓ MercadoPago conectado</p>
              <p className="text-xs mt-1">Los pagos se dividen automáticamente: el cliente paga, MP envía tu parte y retiene la comisión de la plataforma.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Conectá tu cuenta MercadoPago para recibir pagos automáticamente con división (split payment).</p>
              <Button onClick={() => { window.location.href = "/api/akuosplash/auth/mp/oauth"; }} className="w-full bg-blue-600 hover:bg-blue-700">
                <Wallet className="h-4 w-4 mr-1" /> Conectar MercadoPago
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Precios por litro */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Droplets className="h-4 w-4 text-primary" /> Precios por litro</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Precio efectivo ($/litro)</Label><Input type="number" step="any" value={form.precioEfectivoPorLitro || ""} onChange={(e) => update("precioEfectivoPorLitro", e.target.value)} placeholder="50" /></div>
            <div><Label>Precio transferencia ($/litro)</Label><Input type="number" step="any" value={form.precioTransferenciaPorLitro || ""} onChange={(e) => update("precioTransferenciaPorLitro", e.target.value)} placeholder="50" /></div>
          </div>
          <p className="text-xs text-muted-foreground">Al registrar una entrega, el precio se autocompleta según el método de pago elegido.</p>
        </CardContent>
      </Card>

      <Button onClick={guardar} disabled={saving} className="w-full h-12">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar todos los cambios"}
      </Button>
    </div>
  );
}
