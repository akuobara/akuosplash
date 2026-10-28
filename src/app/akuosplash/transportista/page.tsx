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
  Crown, Sparkles,
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
import { PerfilGratis } from "@/components/akuosplash/perfil-gratis";
import { SubscripcionTab } from "@/components/akuosplash/subscripcion-tab";
import { BasicPanel } from "@/components/akuosplash/basic-panel";
import { LegalFooter } from "@/components/akuosplash/legal-footer";
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

  // Extraer previewPlan de los searchParams (cambia cuando el superadmin cambia de plan)
  const previewPlanParam = searchParams.get("previewPlan");

  useEffect(() => {
    setAuthLoading(true);
    (async () => {
      try {
        // Si hay previewPlan en la URL y el user es superadmin, pasar el query param al /me
        const url = previewPlanParam ? `/api/akuosplash/auth/me?previewPlan=${previewPlanParam}&_t=${Date.now()}` : `/api/akuosplash/auth/me?_t=${Date.now()}`;
        const data = await apiGet<{ user: any }>(url);
        setUser(data.user);
      } catch {}
      finally { setAuthLoading(false); }
    })();
  }, [previewPlanParam]);

  // Detectar query param para auto-navegar a la tab correcta
  // (cuando volvemos del redirect de MP con ?tab=subscripcion&mp=ok|fail|pending)
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

  // === Plan-based feature gating ===
  // user.planInfo se completa desde /api/akuosplash/auth/me (o previewPlan si es superadmin)
  const planInfo = user.planInfo;
  const features = planInfo?.plan?.features;
  const planId = planInfo?.planId || "gratis";

  // Si la tab actual no está permitida por el plan, caer a "dashboard"
  // (puede pasar si el plan venció y la tab guardada era de plan pago)
  const allowedTabs: TabKey[] = (() => {
    const base: TabKey[] = [];
    if (!features) {
      // Sin info de plan → mostrar todo (fallback, no debería pasar)
      return ["dashboard", "pedidos", "entregas", "camiones", "gastos", "liquidacion", "clientes", "recurrentes", "historial", "equipo", "subscripcion", "perfil"];
    }
    if (features.dashboard) base.push("dashboard");
    if (features.historial) base.push("historial");
    if (features.vehiculo) base.push("camiones");
    if (features.perfil) base.push("perfil");
    // Tabs del marketplace — siempre disponibles (es el núcleo de la app)
    base.push("pedidos");
    if (features.entregas) base.push("entregas");
    if (features.gastos) base.push("gastos");
    if (features.liquidacion) base.push("liquidacion");
    if (features.clientes) base.push("clientes");
    if (features.recurrentes) base.push("recurrentes");
    if (features.equipo) base.push("equipo");
    if (features.subscripcion) base.push("subscripcion");
    return base;
  })();

  // Si la tab actual no es permitida → cambiar a "dashboard"
  const effectiveTab = allowedTabs.includes(tab) ? tab : "dashboard";

  // Plan Gratis usa BasicPanel (sin funciones de productividad)
  // Plan Premium/Pro usa Dashboard completo
  const useBasicPanel = planId === "gratis" || (features && !features.entregas && !features.gastos && !features.liquidacion);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {user.rol === "superadmin" && (
        <div className="flex items-center justify-between gap-3 bg-violet-600 text-white text-xs py-2 px-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">🔧 Modo monitoreo</span>
            {planInfo?.esPreview ? (
              <>
                <span className="opacity-70">— probando plan:</span>
                <select
                  value={previewPlanParam || ""}
                  onChange={(e) => {
                    const newPlan = e.target.value;
                    if (newPlan) {
                      router.replace(`/akuosplash/transportista?previewPlan=${newPlan}`);
                    }
                  }}
                  className="bg-white text-black px-2 py-0.5 rounded text-xs font-semibold border-0 cursor-pointer"
                >
                  {!previewPlanParam && <option value="">Elegí un plan…</option>}
                  {(() => {
                    // Leer planes activos desde planInfo (cargado desde /me)
                    const allPlans = planInfo?.plan ? [
                      { id: "gratis", nombre: "Gratis", color: "amber" },
                      { id: "premium", nombre: "Premium", color: "blue" },
                      { id: "pro", nombre: "Pro", color: "violet" },
                    ] : [];
                    return allPlans.map(p => {
                      // Solo mostrar si el plan está activo o si es el plan actual
                      const planCfg = planInfo?.plan?.id === p.id ? planInfo.plan : null;
                      // Buscar en los configs si el plan está activo
                      return <option key={p.id} value={p.id}>{p.nombre}</option>;
                    });
                  })()}
                </select>
              </>
            ) : (
              <>
                <span className="opacity-70">— sin preview</span>
                <button
                  onClick={() => router.replace(`/akuosplash/transportista?previewPlan=gratis`)}
                  className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-xs font-semibold"
                >
                  ▶ Empezar a probar planes
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {planInfo?.esPreview && (
              <button
                onClick={() => router.replace(`/akuosplash/superadmin`)}
                className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-xs font-semibold"
              >
                ✕ Volver al panel admin
              </button>
            )}
            <Link href="/akuosplash/superadmin" className="underline font-semibold">← Panel admin</Link>
          </div>
        </div>
      )}

      {/* Banner de plan para el transportista */}
      {user.rol !== "superadmin" && (
        <div className={`flex items-center justify-between gap-2 text-xs py-1.5 px-4 ${
          planId === "pro" ? "bg-violet-100 text-violet-900" :
          planId === "premium" || planId === "pago" ? "bg-blue-100 text-blue-900" :
          "bg-amber-100 text-amber-900"
        }`}>
          <span className="flex items-center gap-1">
            {planId === "pro" ? <Crown className="h-3.5 w-3.5" /> :
             planId === "premium" || planId === "pago" ? <Sparkles className="h-3.5 w-3.5" /> :
             <ShieldCheck className="h-3.5 w-3.5" />}
            Plan <strong className="uppercase">{planId === "pago" ? "premium" : planId}</strong>
            {planInfo?.planActivoHasta && planId !== "gratis" && (
              <span className="opacity-70 ml-1">· vence {new Date(planInfo.planActivoHasta).toLocaleDateString("es-CL")}</span>
            )}
            {planInfo?.plan?.comisionPct !== undefined && (
              <span className="opacity-70 ml-1">· {planInfo.plan.comisionPct}% comisión</span>
            )}
          </span>
          {planId !== "pro" && (
            <button
              onClick={() => setTab("subscripcion")}
              className="font-semibold underline hover:no-underline"
            >
              Subir de plan →
            </button>
          )}
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
        <Tabs value={effectiveTab} onValueChange={(v) => { if (allowedTabs.includes(v as TabKey)) setTab(v as TabKey); }}>
          <select
            value={effectiveTab}
            onChange={(e) => {
              const v = e.target.value as TabKey;
              if (allowedTabs.includes(v)) setTab(v);
            }}
            className="w-full mb-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium"
          >
            {allowedTabs.includes("dashboard") && <option value="dashboard">📊 Panel</option>}
            {allowedTabs.includes("pedidos") && <option value="pedidos">📋 Pedidos</option>}
            {allowedTabs.includes("entregas") && <option value="entregas">💧 Entregas</option>}
            {allowedTabs.includes("camiones") && <option value="camiones">🚛 Camiones</option>}
            {allowedTabs.includes("gastos") && <option value="gastos">💵 Gastos</option>}
            {allowedTabs.includes("liquidacion") && <option value="liquidacion">🧮 Liquidación</option>}
            {allowedTabs.includes("clientes") && <option value="clientes">👥 Clientes</option>}
            {allowedTabs.includes("recurrentes") && <option value="recurrentes">🔁 Recurrentes</option>}
            {allowedTabs.includes("historial") && <option value="historial">📜 Historial</option>}
            {allowedTabs.includes("equipo") && <option value="equipo">👤 Equipo</option>}
            {allowedTabs.includes("subscripcion") && <option value="subscripcion">💎 Subscripción</option>}
            {allowedTabs.includes("perfil") && <option value="perfil">⚙️ Perfil y configuración</option>}
          </select>

          {allowedTabs.includes("dashboard") && (
            <TabsContent value="dashboard" className="mt-4">
              <ErrorBoundary>
                {useBasicPanel ? (
                  <BasicPanel
                    user={user}
                    plan={planInfo?.plan}
                    planId={planId}
                    onGoToSubscripcion={() => features?.subscripcion && setTab("subscripcion")}
                    onGoToPedidos={() => setTab("pedidos")}
                    onGoToVehiculo={() => features?.vehiculo && setTab("camiones")}
                    onGoToPerfil={() => features?.perfil && setTab("perfil")}
                  />
                ) : (
                  <Dashboard refreshKey={refreshKey} onRefresh={refresh} clientes={clientes} config={config} camiones={camiones}
                    onGoToEntregas={() => features?.entregas && setTab("entregas")} onGoToGastos={() => features?.gastos && setTab("gastos")} onGoToLiquidacion={() => features?.liquidacion && setTab("liquidacion")} isDueno={true} />
                )}
              </ErrorBoundary>
            </TabsContent>
          )}
          {allowedTabs.includes("pedidos") && (
            <TabsContent value="pedidos" className="mt-4"><ErrorBoundary><PedidosTab clientes={clientes} refreshKey={refreshKey} onRefresh={refresh} config={config} camiones={camiones} vueltaActual={vueltaActual} /></ErrorBoundary></TabsContent>
          )}
          {allowedTabs.includes("entregas") && (
            <TabsContent value="entregas" className="mt-4"><ErrorBoundary><EntregasTab clientes={clientes} refreshKey={refreshKey} onRefresh={refresh} config={config} camiones={camiones} vueltaActual={vueltaActual} /></ErrorBoundary></TabsContent>
          )}
          {allowedTabs.includes("camiones") && (
            <TabsContent value="camiones" className="mt-4"><ErrorBoundary><CamionesManager refreshKey={refreshKey} onRefresh={refresh} onCamionesChange={() => {}} isDueno={true} /></ErrorBoundary></TabsContent>
          )}
          {allowedTabs.includes("gastos") && (
            <TabsContent value="gastos" className="mt-4"><ErrorBoundary><GastosTab refreshKey={refreshKey} onRefresh={refresh} /></ErrorBoundary></TabsContent>
          )}
          {allowedTabs.includes("liquidacion") && (
            <TabsContent value="liquidacion" className="mt-4"><ErrorBoundary><LiquidacionTab clientes={clientes} config={config} refreshKey={refreshKey} onRefresh={refresh} /></ErrorBoundary></TabsContent>
          )}
          {allowedTabs.includes("clientes") && (
            <TabsContent value="clientes" className="mt-4"><ErrorBoundary><ClientesTab clientes={clientes} refreshKey={refreshKey} onRefresh={refresh} config={config} /></ErrorBoundary></TabsContent>
          )}
          {allowedTabs.includes("recurrentes") && (
            <TabsContent value="recurrentes" className="mt-4"><ErrorBoundary><PedidosRecurrentesTab clientes={clientes} choferes={[]} refreshKey={refreshKey} onRefresh={refresh} config={config} /></ErrorBoundary></TabsContent>
          )}
          {allowedTabs.includes("historial") && (
            <TabsContent value="historial" className="mt-4"><ErrorBoundary><HistorialVueltasTab refreshKey={refreshKey} /></ErrorBoundary></TabsContent>
          )}
          {allowedTabs.includes("equipo") && (
            <TabsContent value="equipo" className="mt-4"><ErrorBoundary><EquipoTab refreshKey={refreshKey} onRefresh={refresh} /></ErrorBoundary></TabsContent>
          )}
          {allowedTabs.includes("subscripcion") && (
            <TabsContent value="subscripcion" className="mt-4"><ErrorBoundary><SubscripcionTab user={user} onUpdated={refresh} /></ErrorBoundary></TabsContent>
          )}
          {allowedTabs.includes("perfil") && (
            <TabsContent value="perfil" className="mt-4">
              <ErrorBoundary>
                {useBasicPanel ? (
                  <PerfilGratis user={user} onUpdated={refresh} />
                ) : (
                  <PerfilTransportista user={user} onUpdated={refresh} />
                )}
              </ErrorBoundary>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {cuentaOpen && <CuentaDialog open={cuentaOpen} onOpenChange={setCuentaOpen} />}
      <LegalFooter />
      <SonnerToaster richColors position="top-center" />
    </div>
  );
}
