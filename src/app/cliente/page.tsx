"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Droplets, LogOut, TrendingUp, Wallet, Calendar, MapPin, User, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
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

const ESTADO_LABELS: Record<string, { label: string; color: string }> = {
  en_pool: { label: "En pool", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  preferido_notificado: { label: "Notificado a tu proveedor", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  asignado: { label: "Asignado", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  en_camino: { label: "En camino", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
  entregado: { label: "Entregado", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  cancelado: { label: "Cancelado", color: "bg-muted text-muted-foreground" },
  expirado: { label: "Expirado", color: "bg-muted text-muted-foreground" },
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

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!cliente || !data) return null;

  const r = data.resumen;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link href="/cliente" className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-1.5">
              <Droplets className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground leading-none">Aljibe App · Cliente</p>
              <p className="font-bold text-sm leading-tight">{cliente.nombre}</p>
            </div>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-1 h-4 w-4" /> Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {/* Saldo */}
        <Card className={cliente.saldo > 0 ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10" : ""}>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Saldo a favor</p>
                <p className="text-lg font-bold tabular-nums text-emerald-600">{formatCurrency(cliente.saldo)}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => router.push("/cliente/saldo")}>
              Cargar saldo
            </Button>
          </CardContent>
        </Card>

        {/* Resumen */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[10px] uppercase text-muted-foreground">Pedidos</p>
              </div>
              <p className="text-xl font-bold">{r.totalPedidos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Droplets className="h-3.5 w-3.5 text-cyan-500" />
                <p className="text-[10px] uppercase text-muted-foreground">Litros recibidos</p>
              </div>
              <p className="text-xl font-bold">{formatNumber(r.totalLitros, 0)} L</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-[10px] uppercase text-muted-foreground">Total gastado</p>
              </div>
              <p className="text-base font-bold tabular-nums">{formatCurrency(r.totalGastado)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <p className="text-[10px] uppercase text-muted-foreground">En proceso</p>
              </div>
              <p className="text-xl font-bold">{r.enProceso}</p>
            </CardContent>
          </Card>
        </div>

        {/* Datos de la cuenta */}
        <Card>
          <CardContent className="p-3 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Zona</p>
                <p className="font-medium">{cliente.zona?.nombre || "—"}</p>
                {cliente.zona && (
                  <p className="text-xs text-muted-foreground">{formatCurrency(cliente.zona.precioPorLitro)}/L</p>
                )}
              </div>
            </div>
            {cliente.direccion && (
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Dirección</p>
                  <p className="font-medium">{cliente.direccion}</p>
                </div>
              </div>
            )}
            {cliente.proveedorPreferido && (
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Proveedor preferido</p>
                  <p className="font-medium">{cliente.proveedorPreferido.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    Tiene {cliente.tiempoAceptacionPreferidoMin} min para aceptar tus pedidos
                  </p>
                </div>
              </div>
            )}
            {cliente.puedePagarEfectivo ? (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Pago efectivo habilitado
              </Badge>
            ) : (
              <p className="text-xs text-muted-foreground">
                Te faltan {10 - cliente.entregasExitosas} entregas exitosas para habilitar pago en efectivo
              </p>
            )}
          </CardContent>
        </Card>

        {/* Botón pedir agua (próximamente) */}
        <Button size="lg" className="w-full" onClick={() => toast.info("Próximamente: pedir agua")}>
          <Droplets className="mr-2 h-5 w-5" /> Pedir agua
        </Button>

        {/* Historial */}
        <div>
          <h2 className="text-sm font-semibold mb-2">Historial de pedidos</h2>
          {data.pedidos.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Aún no tenés pedidos registrados.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {data.pedidos.map((p) => {
                const estadoInfo = ESTADO_LABELS[p.estado] || { label: p.estado, color: "bg-muted text-muted-foreground" };
                return (
                  <Card key={p.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{formatDate(p.creadoEn)}</span>
                          <span className="text-xs text-muted-foreground">{formatTime(p.creadoEn)}</span>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${estadoInfo.color}`}>
                          {estadoInfo.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span><Droplets className="mr-0.5 inline h-3 w-3" />{formatNumber(p.litros, 0)} L</span>
                        <span>·</span>
                        <span>Total: <strong className="text-foreground tabular-nums">{formatCurrency(p.monto)}</strong></span>
                        <span>·</span>
                        <span>{p.zona.nombre}</span>
                      </div>
                      {p.tomadoPor && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Tomado por: <strong>{p.tomadoPor.nombre}</strong>
                          {p.tomadoEn && ` · ${formatDateTime(p.tomadoEn)}`}
                        </p>
                      )}
                      {p.entregadoEn && (
                        <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="mr-1 inline h-3 w-3" />
                          Entregado: {formatDateTime(p.entregadoEn)}
                        </p>
                      )}
                      {p.canceladoEn && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          <XCircle className="mr-1 inline h-3 w-3" />
                          Cancelado{p.canceladoPor ? ` por ${p.canceladoPor}` : ""}
                          {p.motivoCancelacion ? `: ${p.motivoCancelacion}` : ""}
                          {p.reembolsoMonto ? ` · Reembolso: ${formatCurrency(p.reembolsoMonto)}` : ""}
                        </p>
                      )}
                      {p.nota && <p className="mt-1 text-xs italic text-muted-foreground">{p.nota}</p>}
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
