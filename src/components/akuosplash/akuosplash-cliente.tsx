"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { akuoGet, akuoPost, formatCLP } from "./akuosplash-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2, Droplets, LogOut, RotateCw, MapPin, Clock, Truck, Bell,
  KeyRound, ShieldCheck, User, MessageSquare, ChevronRight, Wallet, History,
} from "lucide-react";
import { toast } from "sonner";

interface AkuoUser { id: string; email: string | null; nombre: string; telefono: string | null; rol: string; plan: string; }
interface Pedido {
  id: string; creadoEn: string; litros: number; direccion: string; comuna?: string; estado: string;
  metodoPago: string; nota?: string; precioTotal?: number;
  codigoConfirmacion?: string | null;
  codigoVerificadoEn?: string | null;
}
interface Conversacion { id: string; clienteId: string; transportistaId: string; cliente: { id: string; nombre: string; }; transportista: { id: string; nombre: string; razonSocial?: string; }; mensajes?: Mensaje[]; ultimoMensajeEn: string; }
interface Mensaje { id: string; creadoEn: string; contenido: string; remitenteId: string; remitente: { id: string; nombre: string; }; }

const ESTADO_LABELS: Record<string, { label: string; color: string; icon?: any }> = {
  pendiente: { label: "Buscando repartidor", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  aceptado: { label: "Aceptado", color: "bg-blue-50 text-blue-700 border-blue-200", icon: User },
  en_ruta: { label: "En camino", color: "bg-cyan-50 text-cyan-700 border-cyan-200", icon: Truck },
  entregado: { label: "Entregado", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: ShieldCheck },
  cancelado: { label: "Cancelado", color: "bg-muted text-muted-foreground", icon: ShieldCheck },
};

export function AkuosplashCliente() {
  const router = useRouter();
  const [user, setUser] = useState<AkuoUser | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [historial, setHistorial] = useState<Pedido[]>([]);
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
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

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!user) return null;

  const pedidosActivos = pedidos.filter(p => ["pendiente", "aceptado", "en_ruta"].includes(p.estado));
  const ultimoPedido = historial.find(p => p.estado === "entregado");
  const litrosTotal = historial.filter(h => h.estado === "entregado").reduce((s, h) => s + h.litros, 0);
  const gastosTotal = historial.filter(h => h.estado === "entregado").reduce((s, h) => s + (h.precioTotal || 0), 0);

  function repetirPedido(p: Pedido) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("akuosplash-repetir", JSON.stringify({
        litros: p.litros,
        direccion: p.direccion,
        nota: p.nota,
      }));
    }
    router.push("/akuosplash/cliente/pedir?repetir=1");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <Link href="/akuosplash/cliente" className="flex items-center gap-2.5">
            <div className="rounded-xl bg-blue-500/10 p-2">
              <Droplets className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 leading-none">AkuoSplash</p>
              <p className="font-semibold text-sm leading-tight">{user.nombre}</p>
            </div>
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }} className="text-gray-500">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5 space-y-5">
        {/* CTA principal: Pedir agua — GRANDE y obvio */}
        <div className="space-y-3">
          <Button
            size="lg"
            className="w-full h-16 text-base font-semibold rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            onClick={() => router.push("/akuosplash/cliente/pedir")}
          >
            <Droplets className="h-6 w-6" /> Pedir agua
          </Button>

          {/* Repetir último pedido */}
          {ultimoPedido && (
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => repetirPedido(ultimoPedido)}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              Repetir último pedido ({ultimoPedido.litros.toLocaleString("es-CL")} L)
            </Button>
          )}
        </div>

        {/* Pedidos activos */}
        {pedidosActivos.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Bell className="h-3.5 w-3.5 text-amber-500" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Pedidos activos ({pedidosActivos.length})
              </h2>
            </div>
            {pedidosActivos.map((p) => <PedidoActivoCard key={p.id} p={p} />)}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="border-gray-100">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Pedidos</p>
              <p className="text-lg font-bold tabular-nums">{historial.length}</p>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Litros</p>
              <p className="text-lg font-bold tabular-nums">{litrosTotal.toLocaleString("es-CL")}</p>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Gastado</p>
              <p className="text-sm font-bold tabular-nums">{formatCLP(gastosTotal)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Accesos rápidos */}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/akuosplash/cliente/mensajes">
            <Card className="border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition cursor-pointer">
              <CardContent className="p-3 flex items-center gap-2">
                <div className="rounded-lg bg-blue-500/10 p-2"><MessageSquare className="h-4 w-4 text-blue-600" /></div>
                <div>
                  <p className="text-xs text-gray-400">Mensajes</p>
                  <p className="text-sm font-semibold">{conversaciones.length}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/akuosplash/cliente/perfil">
            <Card className="border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition cursor-pointer">
              <CardContent className="p-3 flex items-center gap-2">
                <div className="rounded-lg bg-blue-500/10 p-2"><User className="h-4 w-4 text-blue-600" /></div>
                <div>
                  <p className="text-xs text-gray-400">Perfil</p>
                  <p className="text-sm font-semibold">Datos</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Historial */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <History className="h-3.5 w-3.5 text-gray-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Historial</h2>
            </div>
            {historial.length > 5 && (
              <Link href="/akuosplash/cliente/historial" className="text-xs text-blue-600 hover:underline">Ver todo</Link>
            )}
          </div>

          {loading ? (
            <Skeleton className="h-16 rounded-xl" />
          ) : historial.length === 0 ? (
            <Card className="border-gray-100">
              <CardContent className="p-8 text-center">
                <Droplets className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aún no tenés pedidos.</p>
                <p className="text-xs text-gray-400 mt-1">Tocá "Pedir agua" para empezar.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {historial.slice(0, 5).map((p) => <PedidoHistorialCard key={p.id} p={p} onRepetir={() => repetirPedido(p)} />)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function PedidoActivoCard({ p }: { p: Pedido }) {
  const estadoInfo = ESTADO_LABELS[p.estado] || { label: p.estado, color: "bg-muted text-muted-foreground", icon: Clock };
  const Icon = estadoInfo.icon;
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="p-3.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${estadoInfo.color}`}>
            {Icon && <Icon className="h-3 w-3" />}
            {estadoInfo.label}
          </span>
          <span className="text-[11px] text-gray-400">
            {new Date(p.creadoEn).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-bold tabular-nums">{p.litros.toLocaleString("es-CL")} L</span>
          {p.precioTotal && <span className="text-sm text-gray-500">{formatCLP(p.precioTotal)}</span>}
        </div>
        <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {p.direccion}{p.comuna ? `, ${p.comuna}` : ""}
        </p>

        {/* Código de entrega */}
        {p.codigoConfirmacion && !p.codigoVerificadoEn && (
          <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-2.5 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-violet-600 flex items-center gap-1">
                <KeyRound className="h-3 w-3" /> Tu código de entrega
              </p>
              <p className="text-xl font-bold tabular-nums tracking-[0.2em] text-violet-900">{p.codigoConfirmacion}</p>
            </div>
            <p className="text-[10px] text-violet-600 text-right max-w-[8rem]">Dáselo al repartidor al finalizar</p>
          </div>
        )}

        {p.codigoVerificadoEn && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 p-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <p className="text-xs font-medium text-emerald-700">Entrega confirmada</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PedidoHistorialCard({ p, onRepetir }: { p: Pedido; onRepetir: () => void }) {
  const estadoInfo = ESTADO_LABELS[p.estado] || { label: p.estado, color: "bg-muted text-muted-foreground", icon: Clock };
  const Icon = estadoInfo.icon;
  const esEntregado = p.estado === "entregado";
  return (
    <Card className="border-gray-100">
      <CardContent className="p-3.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-medium">{new Date(p.creadoEn).toLocaleDateString("es-CL")}</span>
            <span className="text-[11px] text-gray-400">
              {new Date(p.creadoEn).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${estadoInfo.color}`}>
            {Icon && <Icon className="h-3 w-3" />}
            {estadoInfo.label}
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-base font-bold tabular-nums">{p.litros.toLocaleString("es-CL")} L</span>
          {p.precioTotal && <span className="text-sm text-gray-500">{formatCLP(p.precioTotal)}</span>}
        </div>
        <p className="mt-1.5 text-[11px] text-gray-500 flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {p.direccion}{p.comuna ? `, ${p.comuna}` : ""}
        </p>
        {p.nota && <p className="mt-1 text-[11px] italic text-gray-400">"{p.nota}"</p>}
        {esEntregado && (
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 h-7 px-2 text-[11px] text-gray-400 hover:text-blue-600"
            onClick={onRepetir}
          >
            <RotateCw className="mr-1 h-3 w-3" /> Repetir
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
