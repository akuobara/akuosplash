"use client";

import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Droplets,
  LayoutDashboard,
  ClipboardList,
  Truck,
  Receipt,
  Calculator,
  Users,
  CalendarClock,
  UserCog,
  Settings,
  LogOut,
  User as UserIcon,
  Package,
  Repeat,
} from "lucide-react";
import { Dashboard } from "@/components/app/dashboard";
import { EntregasTab } from "@/components/app/entregas-tab";
import { GastosTab } from "@/components/app/gastos-tab";
import { LiquidacionTab } from "@/components/app/liquidacion-tab";
import { ClientesTab } from "@/components/app/clientes-tab";
import { ConfiguracionTab } from "@/components/app/configuracion-tab";
import { EquipoTab } from "@/components/app/equipo-tab";
import { PedidosTab } from "@/components/app/pedidos-tab";
import { PedidosRecurrentesTab } from "@/components/app/pedidos-recurrentes-tab";
import { AuthScreen, type SessionUser } from "@/components/app/auth-screen";
import { apiGet, apiDelete, clearToken } from "@/lib/api-client";
import { toast } from "sonner";

interface Cliente {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  zona: string | null;
  precioEfectivoPorLitro: number;
  precioTransferenciaPorLitro: number;
  lat: number | null;
  lng: number | null;
  requiereIngresoPropiedad: boolean;
  entregaDesdeAfuera: boolean;
  conexionExterna: boolean;
  requiereClientePresente: boolean;
  indicacionesAcceso: string | null;
}

interface Config {
  id: string;
  nombreChofer: string;
  nombreDueno: string;
  capacidadCamion: number;
  modoLiquidacion: string;
  porcentajeComisionChofer: number;
  porcentajeComisionDueno: number;
  montoPorVueltaUnicoCliente: number;
  montoPorVueltaMultiple: number;
  precioEfectivoPorLitro: number;
  precioTransferenciaPorLitro: number;
  tipoTributo: string;
  porcentajeImpuesto: number;
  aplicaImpuestoSobre: string;
  choferesPuedenEditarClientes: boolean;
  choferesPuedenCrearPedidos: boolean;
}

interface Camion {
  id: string;
  nombre: string;
  patente: string | null;
  capacidad: number;
  activo: boolean;
}

interface VueltaActual {
  id: string;
  numero: number;
  iniciadaEn: string;
  cantidadEntregas: number;
  litros: number;
  litrosRestantes?: number;
  capacidadCamion?: number;
  camion?: {
    id: string;
    nombre: string;
    patente: string | null;
    capacidad: number;
  } | null;
}

type TabKey = "dashboard" | "pedidos" | "entregas" | "gastos" | "liquidacion" | "clientes" | "recurrentes" | "config" | "equipo";

export default function Home() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hasUsers, setHasUsers] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  const [tab, setTab] = useState<TabKey>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [vueltaActual, setVueltaActual] = useState<VueltaActual | null>(null);
  const [camiones, setCamiones] = useState<Camion[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; email: string; role: string }[]>([]);
  const [todosPedidos, setTodosPedidos] = useState<{ id: string; clienteNombre: string; litrosSolicitados: number; fechaSolicitada: string | null; estado: string }[]>([]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Verificar sesión al cargar
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<{ user: SessionUser | null; hasUsers: boolean }>("/api/auth/me");
        setUser(data.user);
        setHasUsers(data.hasUsers);
      } catch {
        setHasUsers(true);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  // Cargar datos cuando hay sesión
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [c, cfg, v, cams] = await Promise.all([
          apiGet<{ clientes: Cliente[] }>("/api/clientes"),
          apiGet<{ configuracion: Config }>("/api/configuracion"),
          apiGet<{ vuelta: VueltaActual | null }>("/api/vueltas/activa"),
          apiGet<{ camiones: Camion[] }>("/api/camiones"),
        ]);
        setClientes(c.clientes);
        setConfig(cfg.configuracion);
        setVueltaActual(v.vuelta);
        setCamiones(cams.camiones);
        // Cargar usuarios (choferes) y pedidos solo si es dueño
        if (user.role === "dueno") {
          try {
            const [u, peds] = await Promise.all([
              apiGet<{ usuarios: { id: string; nombre: string; email: string; role: string }[] }>("/api/usuarios"),
              apiGet<{ pedidos: { id: string; clienteNombre: string; litrosSolicitados: number; fechaSolicitada: string | null; estado: string }[] }>("/api/pedidos"),
            ]);
            setUsuarios(u.usuarios);
            setTodosPedidos(peds.pedidos);
          } catch {}
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [user, refreshKey]);

  async function handleLogout() {
    try {
      await apiDelete("/api/auth/logout");
    } catch {}
    clearToken();
    setUser(null);
    setHasUsers(true);
    toast.success("Sesión cerrada");
  }

  // Pantalla de carga inicial
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground animate-pulse">
          <Droplets className="h-9 w-9" />
        </div>
      </div>
    );
  }

  // No autenticado: mostrar pantalla de login/registro
  if (!user) {
    return (
      <>
        <AuthScreen
          hasUsers={hasUsers}
          onAuthSuccess={(u) => {
            setUser(u);
            setRefreshKey((k) => k + 1);
          }}
        />
        <SonnerToaster richColors position="top-center" />
      </>
    );
  }

  const isDueno = user.role === "dueno";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Droplets className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-bold sm:text-lg">Aljibe App</h1>
              <p className="text-[10px] text-muted-foreground sm:text-xs">
                Registro de entregas de agua
              </p>
            </div>
          </div>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div className="hidden text-right text-xs sm:block">
                  <p className="font-medium leading-tight">{user.nombre}</p>
                  <p className="text-muted-foreground leading-tight">
                    {isDueno ? "Dueño" : "Chofer"}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-xs">
                <p className="font-medium">{user.nombre}</p>
                <p className="text-muted-foreground">{user.email}</p>
                <p className="mt-1">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                    {isDueno ? "Dueño" : "Chofer"}
                  </span>
                </p>
              </div>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main con tabs */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-4">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 h-auto bg-muted/40 p-1">
            <TabsTrigger value="dashboard" className="flex-1 sm:flex-initial">
              <LayoutDashboard className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Panel</span>
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="flex-1 sm:flex-initial">
              <ClipboardList className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Pedidos</span>
            </TabsTrigger>
            <TabsTrigger value="entregas" className="flex-1 sm:flex-initial">
              <Truck className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Entregas</span>
            </TabsTrigger>
            <TabsTrigger value="gastos" className="flex-1 sm:flex-initial">
              <Receipt className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Gastos</span>
            </TabsTrigger>
            <TabsTrigger value="liquidacion" className="flex-1 sm:flex-initial">
              <Calculator className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Liquidación</span>
            </TabsTrigger>
            {/* Clientes: dueño ve todo, chofer solo lectura */}
            <TabsTrigger value="clientes" className="flex-1 sm:flex-initial">
              <Users className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Clientes</span>
            </TabsTrigger>
            {/* Recurrentes: solo dueño */}
            {isDueno && (
              <TabsTrigger value="recurrentes" className="flex-1 sm:flex-initial">
                <CalendarClock className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Recurrentes</span>
              </TabsTrigger>
            )}
            {/* Equipo y Ajustes: solo dueño */}
            {isDueno && (
              <TabsTrigger value="equipo" className="flex-1 sm:flex-initial">
                <UserCog className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Equipo</span>
              </TabsTrigger>
            )}
            {isDueno && (
              <TabsTrigger value="config" className="flex-1 sm:flex-initial">
                <Settings className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Ajustes</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dashboard" className="mt-0">
            <Dashboard
              refreshKey={refreshKey}
              onRefresh={refresh}
              clientes={clientes}
              config={{
                precioEfectivoPorLitro: config?.precioEfectivoPorLitro ?? 0,
                precioTransferenciaPorLitro: config?.precioTransferenciaPorLitro ?? 0,
                capacidadCamion: config?.capacidadCamion ?? 17000,
              }}
              camiones={camiones}
              onGoToEntregas={() => setTab("entregas")}
              onGoToGastos={() => setTab("gastos")}
              onGoToLiquidacion={() => setTab("liquidacion")}
            />
          </TabsContent>

          <TabsContent value="pedidos" className="mt-0">
            <PedidosTab
              refreshKey={refreshKey}
              onRefresh={refresh}
              canCreate={isDueno || !!config?.choferesPuedenCrearPedidos}
              isDueno={isDueno}
              currentUserId={user.userId}
              clientes={clientes}
              choferes={usuarios.filter((u) => u.role === "chofer" || u.role === "dueno").map((u) => ({ id: u.id, nombre: u.nombre }))}
            />
          </TabsContent>

          <TabsContent value="entregas" className="mt-0">
            <EntregasTab
              refreshKey={refreshKey}
              onRefresh={refresh}
              clientes={clientes}
              config={{
                precioEfectivoPorLitro: config?.precioEfectivoPorLitro ?? 0,
                precioTransferenciaPorLitro: config?.precioTransferenciaPorLitro ?? 0,
                capacidadCamion: config?.capacidadCamion ?? 17000,
              }}
              vueltaActual={vueltaActual}
            />
          </TabsContent>

          <TabsContent value="gastos" className="mt-0">
            <GastosTab refreshKey={refreshKey} onRefresh={refresh} />
          </TabsContent>

          <TabsContent value="liquidacion" className="mt-0">
            <LiquidacionTab refreshKey={refreshKey} onRefresh={refresh} config={config} />
          </TabsContent>

          <TabsContent value="clientes" className="mt-0">
            <ClientesTab
              refreshKey={refreshKey}
              onRefresh={refresh}
              readOnly={isDueno ? false : !config?.choferesPuedenEditarClientes}
              choferes={usuarios.filter((u) => u.role === "chofer" || u.role === "dueno").map((u) => ({ id: u.id, nombre: u.nombre, email: u.email }))}
            />
          </TabsContent>

          {isDueno && (
            <TabsContent value="recurrentes" className="mt-0">
              <PedidosRecurrentesTab
                refreshKey={refreshKey}
                onRefresh={refresh}
                clientes={clientes}
                choferes={usuarios.filter((u) => u.role === "chofer" || u.role === "dueno").map((u) => ({ id: u.id, nombre: u.nombre }))}
                pedidos={todosPedidos}
              />
            </TabsContent>
          )}

          {isDueno && (
            <TabsContent value="equipo" className="mt-0">
              <EquipoTab refreshKey={refreshKey} onRefresh={refresh} />
            </TabsContent>
          )}

          {isDueno && (
            <TabsContent value="config" className="mt-0">
              <ConfiguracionTab
                config={config}
                onConfigChange={(c) => setConfig(c)}
                refreshKey={refreshKey}
                onRefresh={refresh}
                onCamionesChange={setCamiones}
              />
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-muted/20 py-3">
        <div className="mx-auto w-full max-w-6xl px-3 text-center text-xs text-muted-foreground sm:px-6">
          Aljibe App · {isDueno ? "Dueño" : "Chofer"}: {user.nombre} · {camiones.length} camión(es)
        </div>
      </footer>

      <SonnerToaster richColors position="top-center" />
    </div>
  );
}
