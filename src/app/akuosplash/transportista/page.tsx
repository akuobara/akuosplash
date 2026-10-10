"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import dynamicImport from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Droplets, LayoutDashboard, ClipboardList, Truck, Receipt, Calculator,
  Users, CalendarClock, UserCog, Settings, LogOut, Package, Repeat, History, ShieldCheck,
} from "lucide-react";
import { EntregasTab } from "@/components/akuosplash/entregas-tab";
import { GastosTab } from "@/components/akuosplash/gastos-tab";
import { LiquidacionTab } from "@/components/akuosplash/liquidacion-tab";
import { ClientesTab } from "@/components/akuosplash/clientes-tab";
import { EquipoTab } from "@/components/akuosplash/equipo-tab";
import { PedidosTab } from "@/components/akuosplash/pedidos-tab";
import { PedidosRecurrentesTab } from "@/components/akuosplash/pedidos-recurrentes-tab";
import { CamionesManager } from "@/components/akuosplash/camiones-manager";
import { CuentaDialog } from "@/components/akuosplash/cuenta-dialog";
import { HistorialVueltasTab } from "@/components/akuosplash/historial-vueltas-tab";
import { PerfilTransportista } from "@/components/akuosplash/akuosplash-transportista";
import { SubscripcionTab } from "@/components/akuosplash/subscripcion-tab";
import { apiGet, apiPost } from "@/components/akuosplash/akuosplash-api-client";
import { toast } from "sonner";
import Link from "next/link";

// Error boundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("Tab error:", error); }
  render() {
    if (this.state.error) return <div className="rounded-lg border border-red-200 bg-red-50 p-4 m-4"><p className="text-red-700 font-medium">Error: {this.state.error.message}</p></div>;
    return this.props.children;
  }
}

// Dashboard con ssr:false (evita errores con createPortal, localStorage)
const Dashboard = dynamicImport(() => import("@/components/akuosplash/dashboard").then(m => ({ default: m.Dashboard })), {
  ssr: false,
  loading: () => <div className="flex justify-center py-12"><Droplets className="h-8 w-8 animate-spin text-blue-600" /></div>,
});

interface Cliente { id: string; nombre: string; rut: string | null; direccion: string | null; telefono: string | null; email: string | null; zona: string | null; precioEfectivoPorLitro: number; precioTransferenciaPorLitro: number; precioCamionCompleto: number; lat: number | null; lng: number | null; requiereIngresoPropiedad: boolean; entregaDesdeAfuera: boolean; conexionExterna: boolean; requiereClientePresente: boolean; indicacionesAcceso: string | null; usoAgua: string; deudaInicial?: number; usoAguaNota: string | null; estanquesJson: string | null; choferPreferidoId: string | null; }
interface Camion { id: string; nombre: string; patente: string | null; capacidad: number; activo: boolean; }
interface VueltaActual { id: string; numero: number; iniciadaEn: string; cantidadEntregas: number; litros: number; litrosRestantes?: number; capacidadCamion?: number; camion?: { id: string; nombre: string; patente: string | null; capacidad: number; } | null; }
type TabKey = "dashboard" | "pedidos" | "entregas" | "camiones" | "gastos" | "liquidacion" | "clientes" | "recurrentes" | "historial" | "equipo" | "subscripcion" | "perfil";

export default function TransportistaPageWrapper() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><Droplets className="h-8 w-8 animate-spin text-blue-600" /></div>}>
      <TransportistaPage />
    </Suspense>
  );
}

function TransportistaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(undefined);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [config, setConfig] = useState<any>({});
  const [camiones, setCamiones] = useState<Camion[]>([]);
  const [vueltaActual, setVueltaActual] = useState<VueltaActual | null>(null);
  const [cuentaOpen, setCuentaOpen] = useState(false);
  const [verificacion, setVerificacion] = useState<any>(null);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<{ user: any }>("/api/akuosplash/auth/me");
        setUser(data.user);
      } catch {}
      finally { setAuthLoading(false); }
    })();
  }, []);

  // Detectar query param para auto-navegar a la tab correcta
  // (cuando volvemos del redirect de Transbank con ?tab=subscripcion&transbank=ok|fallido|abortado)
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "subscripcion") {
      setTab("subscripcion");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    Promise.allSettled([
      apiGet<{ clientes: Cliente[] }>("/api/akuosplash/clientes"),
      apiGet<{ configuracion: any }>("/api/akuosplash/configuracion"),
      apiGet<{ vuelta: VueltaActual | null }>("/api/akuosplash/vueltas/activa"),
      apiGet<{ camiones: Camion[] }>("/api/akuosplash/vehiculos"),
      apiGet<any>("/api/akuosplash/transportista/verificacion"),
    ]).then(results => {
      if (results[0].status === "fulfilled") setClientes((results[0] as any).value.clientes || []);
      if (results[1].status === "fulfilled" && (results[1] as any).value.configuracion) setConfig((results[1] as any).value.configuracion);
      if (results[2].status === "fulfilled") setVueltaActual((results[2] as any).value.vuelta);
      if (results[3].status === "fulfilled") setCamiones((results[3] as any).value.camiones || []);
      if (results[4].status === "fulfilled") setVerificacion((results[4] as any).value);
    });
  }, [user, refreshKey]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground animate-pulse"><Droplets className="h-9 w-9" /></div>
      </div>
    );
  }
  if (!user) { if (typeof window !== "undefined") window.location.href = "/akuosplash"; return null; }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {user.rol === "superadmin" && (
        <div className="flex items-center justify-center gap-3 bg-violet-600 text-white text-xs py-2 px-4">
          <span>Modo monitoreo — viendo como repartidor</span>
          <Link href="/akuosplash/superadmin" className="underline font-semibold">← Panel admin</Link>
          <Link href="/akuosplash/cliente" className="underline font-semibold">→ Cliente</Link>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/akuosplash/logo.png" alt="AkuoSplash" className="h-8 w-auto" />
            <div className="hidden sm:block">
              <p className="font-bold text-blue-600">AkuoSplash</p>
              <p className="-mt-1 text-xs text-muted-foreground">
                {user.rol === "superadmin" ? "Superadmin (monitoreo)" : `Repartidor · ${user.nombre}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user.rol === "superadmin" && (
              <Link href="/akuosplash/superadmin">
                <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
                  <LayoutDashboard className="h-4 w-4 mr-1" /> Panel admin
                </Button>
              </Link>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="h-5 w-5" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTab("perfil")}><UserCog className="mr-2 h-4 w-4" /> Mi perfil</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCuentaOpen(true)}><Receipt className="mr-2 h-4 w-4" /> Cuenta</DropdownMenuItem>
                <DropdownMenuItem onClick={async () => { await apiPost("/api/akuosplash/auth/logout"); window.location.href = "/akuosplash"; }}><LogOut className="mr-2 h-4 w-4" /> Cerrar sesión</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value as TabKey)}
            className="w-full mb-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium"
          >
            <option value="dashboard">📊 Panel</option>
            <option value="pedidos">📋 Pedidos</option>
            <option value="entregas">💧 Entregas</option>
            <option value="camiones">🚛 Camiones</option>
            <option value="gastos">💵 Gastos</option>
            <option value="liquidacion">🧮 Liquidación</option>
            <option value="clientes">👥 Clientes</option>
            <option value="recurrentes">🔁 Recurrentes</option>
            <option value="historial">📜 Historial</option>
            <option value="equipo">👤 Equipo</option>
            <option value="subscripcion">💎 Subscripción</option>
            <option value="perfil">⚙️ Perfil y configuración</option>
          </select>

          {/* Estado de verificación para marketplace */}
          {verificacion && !verificacion.puedeParticiparMarketplace && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-amber-100 p-2 shrink-0">
                  <ShieldCheck className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-900">
                    {verificacion.modoProductividad ? "Modo productividad" : "Pendiente de verificación"}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">{verificacion.resumen}</p>
                  <div className="mt-2 space-y-1">
                    {verificacion.checks?.map((c: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={c.ok ? "text-emerald-600" : "text-red-500"}>
                          {c.ok ? "✓" : "✗"}
                        </span>
                        <span className="text-amber-800">{c.label}</span>
                        {c.detail && <span className="text-amber-500">— {c.detail}</span>}
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" className="mt-2 border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => setTab("perfil")}>
                    Completar requisitos
                  </Button>
                </div>
              </div>
            </div>
          )}

          {verificacion && verificacion.puedeParticiparMarketplace && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700">Estás verificado — podés recibir pedidos del marketplace.</p>
            </div>
          )}

          <TabsContent value="dashboard" className="mt-4">
            <ErrorBoundary>
              <Dashboard refreshKey={refreshKey} onRefresh={refresh} clientes={clientes} config={config} camiones={camiones}
                onGoToEntregas={() => setTab("entregas")} onGoToGastos={() => setTab("gastos")} onGoToLiquidacion={() => setTab("liquidacion")} isDueno={true} />
            </ErrorBoundary>
          </TabsContent>
          <TabsContent value="pedidos" className="mt-4"><ErrorBoundary><PedidosTab clientes={clientes} refreshKey={refreshKey} onRefresh={refresh} config={config} camiones={camiones} vueltaActual={vueltaActual} /></ErrorBoundary></TabsContent>
          <TabsContent value="entregas" className="mt-4"><ErrorBoundary><EntregasTab clientes={clientes} refreshKey={refreshKey} onRefresh={refresh} config={config} camiones={camiones} vueltaActual={vueltaActual} /></ErrorBoundary></TabsContent>
          <TabsContent value="camiones" className="mt-4"><ErrorBoundary><CamionesManager refreshKey={refreshKey} onRefresh={refresh} onCamionesChange={() => {}} isDueno={true} /></ErrorBoundary></TabsContent>
          <TabsContent value="gastos" className="mt-4"><ErrorBoundary><GastosTab refreshKey={refreshKey} onRefresh={refresh} /></ErrorBoundary></TabsContent>
          <TabsContent value="liquidacion" className="mt-4"><ErrorBoundary><LiquidacionTab clientes={clientes} config={config} refreshKey={refreshKey} onRefresh={refresh} /></ErrorBoundary></TabsContent>
          <TabsContent value="clientes" className="mt-4"><ErrorBoundary><ClientesTab clientes={clientes} refreshKey={refreshKey} onRefresh={refresh} config={config} /></ErrorBoundary></TabsContent>
          <TabsContent value="recurrentes" className="mt-4"><ErrorBoundary><PedidosRecurrentesTab clientes={clientes} choferes={[]} refreshKey={refreshKey} onRefresh={refresh} config={config} /></ErrorBoundary></TabsContent>
          <TabsContent value="historial" className="mt-4"><ErrorBoundary><HistorialVueltasTab refreshKey={refreshKey} /></ErrorBoundary></TabsContent>
          <TabsContent value="equipo" className="mt-4"><ErrorBoundary><EquipoTab refreshKey={refreshKey} onRefresh={refresh} /></ErrorBoundary></TabsContent>
          <TabsContent value="subscripcion" className="mt-4"><ErrorBoundary><SubscripcionTab user={user} onUpdated={refresh} /></ErrorBoundary></TabsContent>
          <TabsContent value="perfil" className="mt-4"><ErrorBoundary><PerfilTransportista user={user} onUpdated={refresh} /></ErrorBoundary></TabsContent>
        </Tabs>
      </div>

      {cuentaOpen && <CuentaDialog open={cuentaOpen} onOpenChange={setCuentaOpen} />}
      <SonnerToaster richColors position="top-center" />
    </div>
  );
}
