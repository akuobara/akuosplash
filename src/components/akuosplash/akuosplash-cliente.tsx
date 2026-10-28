"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { akuoGet, akuoPost, formatCLP } from "./akuosplash-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2, Droplets, LogOut, RotateCw, MapPin, Clock, Truck, Bell,
  KeyRound, ShieldCheck, User, MessageSquare, Wallet, History, Plus, LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";
import { LegalFooter } from "./legal-footer";

interface AkuoUser { id: string; email: string | null; nombre: string; telefono: string | null; rol: string; plan: string; }
interface Pedido {
  id: string; creadoEn: string; litros: number; direccion: string; comuna?: string; estado: string;
  metodoPago: string; nota?: string; precioTotal?: number;
  codigoConfirmacion?: string | null;
  codigoVerificadoEn?: string | null;
  mpPreferenceId?: string | null;
}
interface Conversacion { id: string; clienteId: string; transportistaId: string; cliente: { id: string; nombre: string; }; transportista: { id: string; nombre: string; razonSocial?: string; }; mensajes?: Mensaje[]; ultimoMensajeEn: string; }
interface Mensaje { id: string; creadoEn: string; contenido: string; remitenteId: string; remitente: { id: string; nombre: string; }; }

const ESTADO_LABELS: Record<string, { label: string; color: string; icon?: any }> = {
  esperando_pago: { label: "Pendiente de pago", color: "bg-orange-50 text-orange-700 border-orange-200", icon: Clock },
  pendiente: { label: "Buscando repartidor", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  aceptado: { label: "Aceptado", color: "bg-blue-50 text-blue-700 border-blue-200", icon: User },
  en_ruta: { label: "En camino", color: "bg-cyan-50 text-cyan-700 border-cyan-200", icon: Truck },
  entregado: { label: "Entregado", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: ShieldCheck },
  cancelado: { label: "Cancelado", color: "bg-muted text-muted-foreground", icon: ShieldCheck },
};

export function AkuosplashCliente() {
  const router = useRouter();
  const [user, setUser] = useState<AkuoUser | null | undefined>(undefined);
  const [saldo] = useState(0); // saldo deshabilitado — solo se acepta MercadoPago (pago instantáneo)
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [historial, setHistorial] = useState<Pedido[]>([]);
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Cargar todo en un solo efecto con cleanup para evitar loops
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meRes = await akuoGet<{ user: AkuoUser | null }>("/api/akuosplash/auth/me");
        if (cancelled) return;
        if (!meRes.user) { router.push("/akuosplash"); return; }
        if (meRes.user.rol !== "cliente" && meRes.user.rol !== "superadmin") {
          router.push("/akuosplash/" + meRes.user.rol);
          return;
        }
        setUser(meRes.user);
        setLoading(true);
        const [peds, hist, convs, prof] = await Promise.all([
          akuoGet<{ pedidos: Pedido[] }>("/api/akuosplash/cliente/pedidos"),
          akuoGet<{ historial: Pedido[] }>("/api/akuosplash/cliente/historial"),
          akuoGet<{ conversaciones: Conversacion[] }>("/api/akuosplash/mensajes"),
          akuoGet<{ user: any }>("/api/akuosplash/cliente/perfil"),
        ]);
        if (cancelled) return;
        setPedidos(peds.pedidos);
        setHistorial(hist.historial);
        setConversaciones(convs.conversaciones);
        // saldo deshabilitado — solo se acepta MercadoPago (pago instantáneo en totalidad)
      } catch (e) { console.error(e); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!user) return null;

  const pedidosActivos = pedidos.filter(p => ["esperando_pago", "pendiente", "aceptado", "en_ruta"].includes(p.estado));
  const ultimoPedido = historial.find(p => p.estado === "entregado");

  function repetirPedido(p: Pedido) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("akuosplash-repetir", JSON.stringify({
        litros: p.litros, direccion: p.direccion, nota: p.nota,
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
              <p className="font-semibold text-sm leading-tight">
                {user.rol === "superadmin" ? "Superadmin (monitoreo)" : user.nombre}
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {user.rol === "superadmin" && (
              <Link href="/akuosplash/superadmin">
                <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
                  <LayoutDashboard className="h-4 w-4 mr-1" /> Panel
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }} className="text-gray-500">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Banner superadmin: switcher entre interfaces */}
      {user.rol === "superadmin" && (
        <div className="flex items-center justify-center gap-3 bg-violet-600 text-white text-xs py-2 px-4">
          <span>Modo monitoreo — viendo como cliente</span>
          <Link href="/akuosplash/superadmin" className="underline font-semibold">← Panel admin</Link>
          <Link href="/akuosplash/transportista" className="underline font-semibold">→ Repartidor</Link>
        </div>
      )}

      <main className="mx-auto max-w-md px-4 py-5 space-y-5">
        {/* CTA principal: Pedir agua */}
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

        {/* Saldo disponible + Abonar — DESHABILITADO temporalmente por temas contables
            (se vuelve a habilitar cuando se confirme el tratamiento contable)
        {saldo >= 0 && (
          <Card className={saldo > 0 ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white" : ""}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-500/10 p-2">
                  <Wallet className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Saldo disponible</p>
                  <p className="text-2xl font-bold tabular-nums text-emerald-600">{formatCLP(saldo)}</p>
                </div>
              </div>
              <Button size="sm" onClick={() => router.push("/akuosplash/cliente/saldo")} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="mr-1 h-4 w-4" /> Abonar saldo
              </Button>
            </CardContent>
          </Card>
        )}
        */}

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

        {/* Historial (resumen) */}
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
      <LegalFooter />
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

        {/* Reanudar pago cuando está en esperando_pago */}
        {p.estado === "esperando_pago" && (
          <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-2.5 space-y-2">
            <p className="text-[11px] text-orange-800">
              Este pedido está pendiente de pago. Necesitás completar el pago en MercadoPago para que salga a buscar repartidor.
            </p>
            {p.mpPreferenceId && (
              <a
                href={`https://www.mercadopago.cl/checkout/v1/redirect/preference/${p.mpPreferenceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium py-2 rounded-lg"
              >
                Completar pago en MercadoPago →
              </a>
            )}
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
