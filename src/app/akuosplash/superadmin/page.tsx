"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, LogOut, Users, Truck, MapPin, ShoppingBag, DollarSign,
  Settings, ChevronRight, Bell,
} from "lucide-react";
import { akuoGet, akuoPost, formatCLP } from "@/components/akuosplash/akuosplash-utils";
import { toast } from "sonner";

interface Stats {
  clientesCount: number;
  transportistasCount: number;
  pedidosCount: number;
  zonasCount: number;
  transportistasAprobados: number;
  transportistasPendientes: number;
  ingresosTotal: number;
  pedidosPorEstado: Record<string, number>;
}

const ESTADO_LABELS: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendientes", color: "text-amber-600" },
  aceptado: { label: "Aceptados", color: "text-blue-600" },
  en_ruta: { label: "En ruta", color: "text-cyan-600" },
  entregado: { label: "Entregados", color: "text-emerald-600" },
  cancelado: { label: "Cancelados", color: "text-red-600" },
};

export default function SuperadminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(undefined);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    akuoGet<{ user: any }>("/api/akuosplash/auth/me").then(d => {
      if (!d.user) { router.push("/akuosplash"); return; }
      if (d.user.rol !== "superadmin") { router.push("/akuosplash/" + d.user.rol); return; }
      setUser(d.user);
    });
  }, [router]);

  const cargar = useCallback(async () => {
    if (!user) return;
    try {
      const d = await akuoGet<Stats>("/api/akuosplash/superadmin/stats");
      setStats(d);
    } catch (e: any) { console.error(e); }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <Link href="/akuosplash/superadmin" className="flex items-center gap-2.5">
            <div className="rounded-xl bg-blue-500/10 p-2">
              <Settings className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 leading-none">AkuoSplash</p>
              <p className="font-semibold text-sm leading-tight">Superadmin</p>
            </div>
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }} className="text-gray-500">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hola, {user.nombre}</h1>
          <p className="text-sm text-gray-500">Panel de administración</p>
        </div>

        {/* Stats principales */}
        <div className="grid grid-cols-2 gap-2">
          <Card className="border-gray-100">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="rounded-lg bg-blue-500/10 p-2"><Users className="h-4 w-4 text-blue-600" /></div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400">Clientes</p>
                <p className="text-lg font-bold tabular-nums">{stats?.clientesCount ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="rounded-lg bg-emerald-500/10 p-2"><Truck className="h-4 w-4 text-emerald-600" /></div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400">Repartidores</p>
                <p className="text-lg font-bold tabular-nums">{stats?.transportistasCount ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="rounded-lg bg-amber-500/10 p-2"><ShoppingBag className="h-4 w-4 text-amber-600" /></div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400">Pedidos</p>
                <p className="text-lg font-bold tabular-nums">{stats?.pedidosCount ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="rounded-lg bg-purple-500/10 p-2"><DollarSign className="h-4 w-4 text-purple-600" /></div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400">Ingresos</p>
                <p className="text-sm font-bold tabular-nums">{stats ? formatCLP(stats.ingresosTotal) : "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pedidos pendientes de aprobación */}
        {stats && stats.transportistasPendientes > 0 && (
          <Link href="/akuosplash/superadmin/transportistas">
            <Card className="border-amber-200 bg-amber-50 cursor-pointer hover:bg-amber-100/50 transition">
              <CardContent className="p-3 flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">{stats.transportistasPendientes} repartidor{stats.transportistasPendientes > 1 ? "es" : ""} esperando aprobación</p>
                  <p className="text-xs text-amber-700">Tocá para revisar</p>
                </div>
                <ChevronRight className="h-4 w-4 text-amber-600" />
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Pedidos por estado */}
        {stats && (
          <Card className="border-gray-100">
            <CardContent className="p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pedidos por estado</p>
              <div className="space-y-1.5">
                {Object.entries(ESTADO_LABELS).map(([estado, info]) => {
                  const count = stats.pedidosPorEstado?.[estado] || 0;
                  return (
                    <div key={estado} className="flex items-center justify-between">
                      <span className={`text-sm ${info.color}`}>{info.label}</span>
                      <span className="font-bold tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Accesos rápidos */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 px-1">Gestión</p>
          <Link href="/akuosplash/superadmin/zonas">
            <Card className="border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition cursor-pointer">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2"><MapPin className="h-5 w-5 text-blue-600" /></div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Zonas de cobertura</p>
                  <p className="text-xs text-gray-500">{stats?.zonasCount ?? 0} zonas activas</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/akuosplash/superadmin/transportistas">
            <Card className="border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition cursor-pointer">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2"><Truck className="h-5 w-5 text-blue-600" /></div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Repartidores</p>
                  <p className="text-xs text-gray-500">{stats?.transportistasAprobados ?? 0} aprobados · {stats?.transportistasPendientes ?? 0} pendientes</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/akuosplash/superadmin/clientes">
            <Card className="border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition cursor-pointer">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2"><Users className="h-5 w-5 text-blue-600" /></div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Clientes</p>
                  <p className="text-xs text-gray-500">{stats?.clientesCount ?? 0} registrados</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/akuosplash/superadmin/pedidos">
            <Card className="border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition cursor-pointer">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2"><ShoppingBag className="h-5 w-5 text-blue-600" /></div>
                <div className="flex-1">
                  <p className="font-medium text-sm">Pedidos</p>
                  <p className="text-xs text-gray-500">{stats?.pedidosCount ?? 0} en total</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Botón refresh */}
        <Button variant="outline" onClick={() => setRefreshKey(k => k + 1)} className="w-full">
          Actualizar
        </Button>
      </main>
    </div>
  );
}
