"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2, LogOut, Users, Truck, MapPin, ShoppingBag, DollarSign,
  Settings, ChevronRight, Bell, Check, X, LayoutDashboard, Wallet, Calculator, CreditCard,
} from "lucide-react";
import { akuoGet, akuoPost, akuoApi, formatCLP } from "@/components/akuosplash/akuosplash-utils";
import { toast } from "sonner";
import { PrecioDinamicoTab } from "@/components/akuosplash/precio-dinamico-tab";
import { IntegracionesTab } from "@/components/akuosplash/integraciones-tab";
import { PlanesTab } from "@/components/akuosplash/planes-tab";
import { SubscriptionsTab } from "@/components/akuosplash/subscriptions-tab";
import { CuponesTab } from "@/components/akuosplash/cupones-tab";
import { RegionesComunasTab } from "@/components/akuosplash/regiones-comunas-tab";
import { LegalTab } from "@/components/akuosplash/legal-tab";

interface Stats {
  clientesCount: number;
  transportistasCount: number;
  pedidosCount: number;
  zonasCount: number;
  transportistasAprobados: number;
  transportistasPendientes: number;
  ingresosTotal: number;
  pedidosPorEstado: Record<string, number>;
  repartidoresPendientesLista: Array<{ id: string; email: string | null; nombre: string; telefono: string | null; razonSocial?: string | null; creadoEn: string }>;
  ultimosPedidos: Array<{ id: string; creadoEn: string; litros: number; estado: string; precioTotal?: number | null; cliente: { nombre: string }; transportista?: { nombre: string } | null }>;
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
  const [tab, setTab] = useState("panel");

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

  async function aprobarRepartidor(id: string, nombre: string) {
    try {
      await akuoApi(`/api/akuosplash/superadmin/usuarios?id=${id}`, {
        method: "PATCH", body: JSON.stringify({ aprobado: true }),
      });
      toast.success(`Repartidor ${nombre} aprobado`);
      setRefreshKey(k => k + 1);
    } catch (e: any) { toast.error(e.message || "Error"); }
  }

  async function rechazarRepartidor(id: string, nombre: string) {
    if (!confirm(`¿Rechazar la solicitud de ${nombre}?`)) return;
    try {
      await akuoApi(`/api/akuosplash/superadmin/usuarios?id=${id}`, {
        method: "PATCH", body: JSON.stringify({ activo: false }),
      });
      toast.success(`Solicitud de ${nombre} rechazada`);
      setRefreshKey(k => k + 1);
    } catch (e: any) { toast.error(e.message || "Error"); }
  }

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

      <main className="mx-auto max-w-md px-4 py-5">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Panel de administración</h1>
          <p className="text-sm text-gray-500">Monitoreo y gestión de la plataforma</p>
        </div>

        {/* Cambiar de interfaz */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Link href="/akuosplash/cliente">
            <Card className="border-gray-100 hover:border-blue-300 hover:bg-blue-50/50 transition cursor-pointer">
              <CardContent className="p-3 flex flex-col items-center gap-1.5">
                <div className="rounded-lg bg-blue-500/10 p-2"><Users className="h-5 w-5 text-blue-600" /></div>
                <p className="font-medium text-sm">Cliente</p>
                <p className="text-[10px] text-gray-500 text-center">Pedir agua, ver historial</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/akuosplash/transportista">
            <Card className="border-gray-100 hover:border-blue-300 hover:bg-blue-50/50 transition cursor-pointer">
              <CardContent className="p-3 flex flex-col items-center gap-1.5">
                <div className="rounded-lg bg-emerald-500/10 p-2"><Truck className="h-5 w-5 text-emerald-600" /></div>
                <p className="font-medium text-sm">Repartidor</p>
                <p className="text-[10px] text-gray-500 text-center">Ver pedidos disponibles</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            className="w-full mb-4 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium"
          >
            <option value="panel">📊 Panel</option>
            <option value="zonas">📍 Zonas (Google Earth)</option>
            <option value="regiones">🗺️ Regiones y Comunas</option>
            <option value="repartidores">🚛 Repartidores</option>
            <option value="clientes">👥 Clientes</option>
            <option value="pedidos">🛒 Pedidos</option>
            <option value="precio">🧮 Precio dinámico</option>
            <option value="planes">💎 Planes</option>
            <option value="subs">💳 Subscripciones</option>
            <option value="cupones">🎟️ Cupones</option>
            <option value="integraciones">🔌 Integraciones</option>
            <option value="legal">📄 Páginas Legales</option>
          </select>

          {/* === PANEL === */}
          <TabsContent value="panel" className="space-y-4 mt-4">
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

            {/* Repartidores pendientes */}
            {stats && stats.repartidoresPendientesLista && stats.repartidoresPendientesLista.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Bell className="h-3.5 w-3.5 text-amber-500" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Repartidores esperando aprobación</h2>
                </div>
                {stats.repartidoresPendientesLista.map(u => (
                  <Card key={u.id} className="border-amber-200 bg-amber-50/50">
                    <CardContent className="p-3.5 space-y-2">
                    <div>
                      <p className="font-medium text-sm">{u.nombre}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                      {u.telefono && <p className="text-xs text-gray-500">Tel: {u.telefono}</p>}
                      {u.razonSocial && <p className="text-xs text-gray-500">Empresa: {u.razonSocial}</p>}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-amber-200">
                      <Button size="sm" onClick={() => aprobarRepartidor(u.id, u.nombre)} className="bg-emerald-600 hover:bg-emerald-700 flex-1">
                        <Check className="h-4 w-4 mr-1" /> Aprobar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => rechazarRepartidor(u.id, u.nombre)} className="text-red-600 border-red-300 hover:bg-red-50">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Últimos pedidos */}
            {stats && stats.ultimosPedidos && stats.ultimosPedidos.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Últimos pedidos</h2>
                  <button onClick={() => setTab("pedidos")} className="text-xs text-blue-600 hover:underline">Ver todos</button>
                </div>
                {stats.ultimosPedidos.map(p => (
                  <Card key={p.id} className="border-gray-100">
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold tabular-nums text-sm">{p.litros.toLocaleString("es-CL")} L</span>
                          {p.precioTotal && <span className="text-xs text-gray-500">{formatCLP(p.precioTotal)}</span>}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {p.cliente?.nombre} {p.transportista && `→ ${p.transportista.nombre}`}
                        </p>
                      </div>
                      <Badge variant="outline" className={ESTADO_LABELS[p.estado]?.color || "text-gray-500"}>{ESTADO_LABELS[p.estado]?.label || p.estado}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
          </TabsContent>

          {/* === ZONAS (Google Earth) === */}
          <TabsContent value="zonas" className="mt-4">
            <Link href="/akuosplash/superadmin/zonas">
              <Card className="border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition cursor-pointer">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2"><MapPin className="h-5 w-5 text-blue-600" /></div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Gestionar zonas (Google Earth / GeoJSON)</p>
                    <p className="text-xs text-gray-500">{stats?.zonasCount ?? 0} zonas activas</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </CardContent>
              </Card>
            </Link>
          </TabsContent>

          {/* === REGIONES Y COMUNAS === */}
          <TabsContent value="regiones" className="mt-4">
            <RegionesComunasTab />
          </TabsContent>

          {/* === REPARTIDORES === */}
          <TabsContent value="repartidores" className="mt-4">
            <Link href="/akuosplash/superadmin/transportistas">
              <Card className="border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition cursor-pointer">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2"><Truck className="h-5 w-5 text-blue-600" /></div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Gestionar repartidores</p>
                    <p className="text-xs text-gray-500">{stats?.transportistasAprobados ?? 0} aprobados · {stats?.transportistasPendientes ?? 0} pendientes</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </CardContent>
              </Card>
            </Link>
          </TabsContent>

          {/* === CLIENTES === */}
          <TabsContent value="clientes" className="mt-4">
            <Link href="/akuosplash/superadmin/clientes">
              <Card className="border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition cursor-pointer">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2"><Users className="h-5 w-5 text-blue-600" /></div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Gestionar clientes</p>
                    <p className="text-xs text-gray-500">{stats?.clientesCount ?? 0} registrados</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </CardContent>
              </Card>
            </Link>
          </TabsContent>

          {/* === PEDIDOS === */}
          <TabsContent value="pedidos" className="mt-4">
            <Link href="/akuosplash/superadmin/pedidos">
              <Card className="border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition cursor-pointer">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2"><ShoppingBag className="h-5 w-5 text-blue-600" /></div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Ver todos los pedidos</p>
                    <p className="text-xs text-gray-500">{stats?.pedidosCount ?? 0} en total</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </CardContent>
              </Card>
            </Link>
          </TabsContent>

          {/* === PRECIO DINÁMICO === */}
          <TabsContent value="precio" className="mt-4">
            <PrecioDinamicoTab />
          </TabsContent>

          {/* === PLANES === */}
          <TabsContent value="planes" className="mt-4">
            <PlanesTab />
          </TabsContent>

          {/* === SUBSCRIPCIONES === */}
          <TabsContent value="subs" className="mt-4">
            <SubscriptionsTab />
          </TabsContent>

          {/* === CUPONES === */}
          <TabsContent value="cupones" className="mt-4">
            <CuponesTab />
          </TabsContent>

          {/* === INTEGRACIONES === */}
          <TabsContent value="integraciones" className="mt-4">
            <IntegracionesTab />
          </TabsContent>

          {/* === PÁGINAS LEGALES === */}
          <TabsContent value="legal" className="mt-4">
            <LegalTab />
          </TabsContent>
        </Tabs>

        <Button variant="outline" onClick={() => setRefreshKey(k => k + 1)} className="w-full mt-4">Actualizar</Button>
      </main>
    </div>
  );
}
