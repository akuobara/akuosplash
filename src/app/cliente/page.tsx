"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Droplets,
  LogOut,
  TrendingUp,
  Wallet,
  Calendar,
  MapPin,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCw,
  Star,
  Truck,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency, formatNumber, formatDate, formatTime, formatDateTime } from "@/lib/helpers";

interface Cliente {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  tiempoAceptacionPreferidoMin: number;
  entregasExitosas: number;
  saldo: number;
  puedePagarEfectivo: boolean;
  zona: { id: string; nombre: string; precioPorLitro: number } | null;
  proveedorPreferido: { id: string; nombre: string } | null;
}

interface Pedido {
  id: string;
  creadoEn: string;
  litros: number;
  monto: number;
  estado: string;
  estadoPago: string;
  metodoPago: string;
  direccion: string;
  nota: string | null;
  tomadoEn: string | null;
  entregadoEn: string | null;
  canceladoEn: string | null;
  canceladoPor: string | null;
  motivoCancelacion: string | null;
  reembolsoMonto: number | null;
  tomadoPor: { id: string; nombre: string } | null;
  zona: { id: string; nombre: string; precioPorLitro: number };
  calificacion?: number | null;
}

interface DataResponse {
  pedidos: Pedido[];
  resumen: {
    totalPedidos: number;
    entregados: number;
    totalLitros: number;
    totalGastado: number;
    enProceso: number;
  };
}

function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("aljibe-cliente-token");
  }
  return null;
}

const ESTADO_LABELS: Record<string, { label: string; color: string; icon?: React.ReactNode }> = {
  en_pool: { label: "Buscando proveedor", color: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: <Clock className="h-3 w-3" /> },
  preferido_notificado: { label: "Proveedor notificado", color: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: <Bell className="h-3 w-3" /> },
  asignado: { label: "Asignado", color: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: <User className="h-3 w-3" /> },
  en_camino: { label: "En camino", color: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300", icon: <Truck className="h-3 w-3" /> },
  entregado: { label: "Entregado", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: <CheckCircle2 className="h-3 w-3" /> },
  cancelado: { label: "Cancelado", color: "bg-muted text-muted-foreground", icon: <XCircle className="h-3 w-3" /> },
  expirado: { label: "Expirado", color: "bg-muted text-muted-foreground", icon: <XCircle className="h-3 w-3" /> },
};

export default function ClienteDashboardPage() {
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [data, setData] = useState<DataResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace("/cliente/login");
      return;
    }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [meRes, entRes] = await Promise.all([
        fetch("/api/cliente/auth/me", { headers }),
        fetch("/api/cliente/entregas", { headers }),
      ]);

      if (meRes.status === 401 || entRes.status === 401) {
        localStorage.removeItem("aljibe-cliente-token");
        router.replace("/cliente/login");
        return;
      }

      if (!meRes.ok || !entRes.ok) throw new Error("Error al cargar");

      const meData = await meRes.json();
      const entData = await entRes.json();
      setCliente(meData.cliente);
      setData(entData);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleLogout() {
    const token = getToken();
    if (token) {
      try {
        await fetch("/api/cliente/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("aljibe-cliente-token");
    }
    router.replace("/cliente/login");
  }

  // Repetir pedido: guarda los datos en sessionStorage y redirige a /cliente/pedir
  function repetirPedido(p: Pedido) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("aljibe-cliente-repetir", JSON.stringify({
        litros: p.litros,
        direccion: p.direccion,
        nota: p.nota,
      }));
    }
    router.push("/cliente/pedir?repetir=1");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
        <div className="mx-auto max-w-md space-y-4">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!cliente || !data) return null;

  const r = data.resumen;
  const pedidosActivos = data.pedidos.filter(p =>
    ["en_pool", "preferido_notificado", "asignado", "en_camino"].includes(p.estado)
  );
  const ultimoPedido = data.pedidos.find(p => p.estado === "entregado");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <Link href="/cliente" className="flex items-center gap-2.5">
            <div className="rounded-xl bg-blue-500/10 p-2">
              <Droplets className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 leading-none">Aljibe</p>
              <p className="font-semibold text-sm leading-tight">{cliente.nombre}</p>
            </div>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5 space-y-5">
        {/* Saldo + CTA Pedir agua */}
        <div className="space-y-3">
          {/* Saldo a favor */}
          {cliente.saldo > 0 && (
            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-900 dark:border-emerald-900/50">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-emerald-500/10 p-2">
                    <Wallet className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Saldo a favor</p>
                    <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(cliente.saldo)}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => router.push("/cliente/saldo")} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/20">
                  Cargar
                </Button>
              </CardContent>
            </Card>
          )}

          {/* CTA principal: Pedir agua */}
          <Button
            size="lg"
            className="w-full h-14 text-base font-semibold rounded-2xl bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20"
            onClick={() => router.push("/cliente/pedir")}
          >
            <Droplets className="mr-2 h-5 w-5" /> Pedir agua
          </Button>

          {/* Repetir último pedido */}
          {ultimoPedido && (
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={() => repetirPedido(ultimoPedido)}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              Repetir último pedido ({formatNumber(ultimoPedido.litros, 0)} L)
            </Button>
          )}
        </div>

        {/* Pedidos activos (notificaciones) */}
        {pedidosActivos.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-amber-500" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Pedidos activos ({pedidosActivos.length})
              </h2>
            </div>
            {pedidosActivos.map((p) => {
              const estadoInfo = ESTADO_LABELS[p.estado] || { label: p.estado, color: "bg-muted text-muted-foreground" };
              return (
                <Card key={p.id} className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-900/30">
                  <CardContent className="p-3.5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${estadoInfo.color}`}>
                        {estadoInfo.icon}
                        {estadoInfo.label}
                      </span>
                      <span className="text-[11px] text-gray-400">{formatTime(p.creadoEn)}</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-lg font-bold tabular-nums">{formatNumber(p.litros, 0)} L</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{formatCurrency(p.monto)}</span>
                    </div>
                    {p.tomadoPor && (
                      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Truck className="h-3 w-3" /> {p.tomadoPor.nombre}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Resumen stats */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="border-gray-100 dark:border-gray-800">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Pedidos</p>
              <p className="text-lg font-bold tabular-nums">{r.totalPedidos}</p>
            </CardContent>
          </Card>
          <Card className="border-gray-100 dark:border-gray-800">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Litros</p>
              <p className="text-lg font-bold tabular-nums">{formatNumber(r.totalLitros, 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-gray-100 dark:border-gray-800">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Gastado</p>
              <p className="text-sm font-bold tabular-nums">{formatCurrency(r.totalGastado)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Información de cuenta */}
        <Card className="border-gray-100 dark:border-gray-800">
          <CardContent className="p-4 space-y-3">
            {/* Zona + precio */}
            {cliente.zona && (
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-400">Zona</p>
                    <p className="text-sm font-medium">{cliente.zona.nombre}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Precio/L</p>
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatCurrency(cliente.zona.precioPorLitro)}</p>
                </div>
              </div>
            )}
            {/* Dirección */}
            {cliente.direccion && (
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-400">Dirección</p>
                  <p className="text-sm font-medium">{cliente.direccion}</p>
                </div>
              </div>
            )}
            {/* Proveedor preferido */}
            {cliente.proveedorPreferido && (
              <div className="flex items-start gap-2">
                <Truck className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-400">Proveedor preferido</p>
                  <p className="text-sm font-medium">{cliente.proveedorPreferido.nombre}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Tiene {cliente.tiempoAceptacionPreferidoMin} min para aceptar tus pedidos
                  </p>
                </div>
              </div>
            )}
            {/* Estado pago efectivo */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              {cliente.puedePagarEfectivo ? (
                <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Pago en efectivo habilitado
                </Badge>
              ) : (
                <p className="text-[11px] text-gray-400">
                  Te faltan {10 - cliente.entregasExitosas} entregas para habilitar pago en efectivo
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Historial */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-1">
            Historial
          </h2>
          {data.pedidos.length === 0 ? (
            <Card className="border-gray-100 dark:border-gray-800">
              <CardContent className="p-8 text-center">
                <Droplets className="h-8 w-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aún no tenés pedidos.</p>
                <p className="text-xs text-gray-400 mt-1">Tocá "Pedir agua" para empezar.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {data.pedidos.slice(0, 20).map((p) => {
                const estadoInfo = ESTADO_LABELS[p.estado] || { label: p.estado, color: "bg-muted text-muted-foreground" };
                const esEntregado = p.estado === "entregado";
                const esCancelado = p.estado === "cancelado" || p.estado === "expirado";
                return (
                  <Card key={p.id} className="border-gray-100 dark:border-gray-800">
                    <CardContent className="p-3.5">
                      {/* Header: fecha + estado */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-medium">{formatDate(p.creadoEn)}</span>
                          <span className="text-[11px] text-gray-400">{formatTime(p.creadoEn)}</span>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${estadoInfo.color}`}>
                          {estadoInfo.icon}
                          {estadoInfo.label}
                        </span>
                      </div>
                      {/* Cantidad + monto */}
                      <div className="flex items-baseline gap-3">
                        <span className="text-base font-bold tabular-nums">{formatNumber(p.litros, 0)} L</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">{formatCurrency(p.monto)}</span>
                        <span className="text-[11px] text-gray-400">· {p.zona.nombre}</span>
                      </div>
                      {/* Detalles extras */}
                      {p.tomadoPor && (
                        <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Truck className="h-3 w-3" /> {p.tomadoPor.nombre}
                          {p.tomadoEn && ` · ${formatDateTime(p.tomadoEn)}`}
                        </p>
                      )}
                      {esEntregado && p.entregadoEn && (
                        <div className="mt-1.5 flex items-center justify-between">
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {formatDateTime(p.entregadoEn)}
                          </p>
                          {/* Calificación */}
                          {p.calificacion ? (
                            <div className="flex items-center gap-0.5">
                              {[1,2,3,4,5].map(i => (
                                <Star
                                  key={i}
                                  className={`h-3 w-3 ${i <= p.calificacion! ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-700"}`}
                                />
                              ))}
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px] text-gray-400 hover:text-amber-500"
                              onClick={() => toast.info("Próximamente: calificar entrega")}
                            >
                              <Star className="mr-1 h-3 w-3" /> Calificar
                            </Button>
                          )}
                        </div>
                      )}
                      {esCancelado && (
                        <p className="mt-1.5 text-[11px] text-red-500 dark:text-red-400 flex items-center gap-1">
                          <XCircle className="h-3 w-3" />
                          Cancelado{p.canceladoPor ? ` por ${p.canceladoPor}` : ""}
                          {p.motivoCancelacion ? `: ${p.motivoCancelacion}` : ""}
                          {p.reembolsoMonto ? ` · Reembolso: ${formatCurrency(p.reembolsoMonto)}` : ""}
                        </p>
                      )}
                      {p.nota && <p className="mt-1.5 text-[11px] italic text-gray-400">{p.nota}</p>}
                      {/* Repetir pedido (solo si fue entregado o cancelado) */}
                      {(esEntregado || esCancelado) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 h-7 px-2 text-[11px] text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          onClick={() => repetirPedido(p)}
                        >
                          <RotateCw className="mr-1 h-3 w-3" /> Repetir
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
