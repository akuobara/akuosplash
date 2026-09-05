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
  Smartphone,
  LogOut,
  User as UserIcon,
  Package,
  Repeat,
  History,
} from "lucide-react";
import { Dashboard } from "@/components/app/dashboard";
import { EntregasTab } from "@/components/app/entregas-tab";
import { GastosTab } from "@/components/app/gastos-tab";
import { LiquidacionTab } from "@/components/app/liquidacion-tab";
import { ClientesTab } from "@/components/app/clientes-tab";
import { ConfiguracionTab } from "@/components/app/configuracion-tab";
import { EquipoTab } from "@/components/app/equipo-tab";
import { MiPerfilTab } from "@/components/app/mi-perfil-tab";
import { PedidosTab } from "@/components/app/pedidos-tab";
import { PedidosRecurrentesTab } from "@/components/app/pedidos-recurrentes-tab";
import { CuentaDialog } from "@/components/app/cuenta-dialog";
import { HistorialVueltasTab } from "@/components/app/historial-vueltas-tab";
import { AuthScreen, type SessionUser } from "@/components/app/auth-screen";
import { apiGet, apiDelete, clearToken } from "@/lib/api-client";
import { toast } from "sonner";

interface Cliente {
  id: string;
  nombre: string;
  rut: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  zona: string | null;
  precioEfectivoPorLitro: number;
  precioTransferenciaPorLitro: number;
  precioCamionCompleto: number;
  lat: number | null;
  lng: number | null;
  requiereIngresoPropiedad: boolean;
  entregaDesdeAfuera: boolean;
  conexionExterna: boolean;
  requiereClientePresente: boolean;
  indicacionesAcceso: string | null;
  usoAgua: string;
  deudaInicial?: number;
  usoAguaNota: string | null;
  estanquesJson: string | null;
  choferPreferidoId: string | null;
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
  precioCamionCompleto: number;
  tipoTributo: string;
  porcentajeImpuesto: number;
  aplicaImpuestoSobre: string;
  choferesPuedenEditarClientes: boolean;
  choferesPuedenCrearPedidos: boolean;
  umbralCompletacionVuelta?: number | null;
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

type TabKey = "dashboard" | "pedidos" | "entregas" | "gastos" | "liquidacion" | "clientes" | "recurrentes" | "historial" | "config" | "equipo" | "perfil";

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
  const [pedidoClientePreselect, setPedidoClientePreselect] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; email: string; role: string; activo: boolean }[]>([]);
  const [todosPedidos, setTodosPedidos] = useState<{ id: string; clienteNombre: string; clienteId: string | null; litrosSolicitados: number; metodoPagoPreferido: string; fechaSolicitada: string | null; estado: string }[]>([]);

  // Toggle de interfaz simple (para choferes con camión asignado)
  const [interfazSimple, setInterfazSimple] = useState(false);
  const [cuentaOpen, setCuentaOpen] = useState(false);

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

  // Cargar datos cuando hay sesión.
  // IMPORTANTE: usar Promise.allSettled para que si un endpoint falla
  // transientmente (cold start, replica lag, etc.), los demás se carguen igual.
  // Esto evita que un fallo puntual de /api/camiones deje sin clientes al chofer.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const results = await Promise.allSettled([
        apiGet<{ clientes: Cliente[] }>("/api/clientes"),
        apiGet<{ configuracion: Config }>("/api/configuracion"),
        apiGet<{ vuelta: VueltaActual | null }>("/api/vueltas/activa"),
        apiGet<{ camiones: Camion[] }>("/api/camiones"),
      ]);
      const [c, cfg, v, cams] = results;
      if (c.status === "fulfilled") setClientes(c.value.clientes);
      if (cfg.status === "fulfilled") setConfig(cfg.value.configuracion);
      if (v.status === "fulfilled") setVueltaActual(v.value.vuelta);
      if (cams.status === "fulfilled") setCamiones(cams.value.camiones);

      // === AUTO-REINTENTO si algún endpoint crítico falló transitoriamente ===
      // Vercel/Turso a veces tiene cold starts que devuelven [] en el primer request.
      // Reintentar a los 2s si clientes o camiones quedaron vacíos.
      const clientesCargados = c.status === "fulfilled" ? c.value.clientes.length : 0;
      const camionesCargados = cams.status === "fulfilled" ? cams.value.camiones.length : 0;
      if (c.status !== "fulfilled" || (clientesCargados === 0 && c.status === "fulfilled")) {
        setTimeout(async () => {
          try {
            const retryC = await apiGet<{ clientes: Cliente[] }>("/api/clientes");
            if (retryC.clientes.length > 0) setClientes(retryC.clientes);
          } catch {}
        }, 2000);
      }
      if (cams.status !== "fulfilled" || (camionesCargados === 0 && cams.status === "fulfilled")) {
        setTimeout(async () => {
          try {
            const retryCams = await apiGet<{ camiones: Camion[] }>("/api/camiones");
            if (retryCams.camiones.length > 0) setCamiones(retryCams.camiones);
          } catch {}
        }, 2000);
      }

      // Cargar pedidos SIEMPRE (chofer y dueño los necesitan)
      // Cargar usuarios solo si es dueño
      if (user.role === "dueno") {
        try {
          const [u, peds] = await Promise.all([
            apiGet<{ usuarios: { id: string; nombre: string; email: string; role: string; activo: boolean }[] }>("/api/usuarios"),
            apiGet<{ pedidos: { id: string; clienteNombre: string; clienteId: string | null; litrosSolicitados: number; metodoPagoPreferido: string; fechaSolicitada: string | null; estado: string }[] }>("/api/pedidos"),
          ]);
          setUsuarios(u.usuarios);
          setTodosPedidos(peds.pedidos);
        } catch {}
      } else {
        // Chofer también necesita los pedidos para el form de entrega
        try {
          const peds = await apiGet<{ pedidos: { id: string; clienteNombre: string; clienteId: string | null; litrosSolicitados: number; metodoPagoPreferido: string; fechaSolicitada: string | null; estado: string }[] }>("/api/pedidos");
          setTodosPedidos(peds.pedidos);
        } catch {}
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

  // Escuchar evento de sesión expirada (401 en api-client)
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setHasUsers(true);
      toast.error("Tu sesión ha expirado. Por favor inicia sesión nuevamente.");
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

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
              <h1 className="text-base font-bold sm:text-lg">Aljibe</h1>
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
                    {isDueno ? "Administrador" : "Chofer"}
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
                    {isDueno ? "Administrador" : "Chofer"}
                  </span>
                </p>
              </div>
              {/* Toggle interfaz simple/completa (choferes) */}
              {!isDueno && (
                <DropdownMenuItem onClick={() => setInterfazSimple(!interfazSimple)}>
                  {interfazSimple ? (
                    <><LayoutDashboard className="mr-2 h-4 w-4" /> Ver interfaz completa</>
                  ) : (
                    <><Smartphone className="mr-2 h-4 w-4" /> Ver interfaz simple</>
                  )}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setCuentaOpen(true)}>
                <UserCog className="mr-2 h-4 w-4" /> Mi cuenta
              </DropdownMenuItem>
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
          {/* En interfaz simple, los choferes solo ven: Panel, Entregas, Liquidación */}
          {/* En interfaz completa, ven todos los tabs */}
          {/* Menú desplegable en celular */}
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value as TabKey)}
            className="sm:hidden w-full h-10 rounded-md border border-input bg-background px-3 text-sm font-medium"
          >
            <option value="dashboard">📊 Panel</option>
            {(!interfazSimple || isDueno) && <option value="pedidos">📋 Pedidos</option>}
            <option value="entregas">🚚 Entregas</option>
            {(!interfazSimple || isDueno) && <option value="gastos">💵 Gastos</option>}
            <option value="liquidacion">🧮 Liquidación</option>
            {(!interfazSimple || isDueno) && <option value="clientes">👥 Clientes</option>}
            {(!interfazSimple || isDueno) && <option value="recurrentes">🔁 Recurrentes</option>}
            {(!interfazSimple || isDueno) && <option value="historial">📜 Historial</option>}
            {isDueno && <option value="equipo">👥 Equipo</option>}
            {isDueno && <option value="config">⚙️ Ajustes</option>}
            {!isDueno && <option value="perfil">👤 Mi Perfil</option>}
          </select>

          {/* Fila de tabs en desktop */}
          <TabsList className="hidden sm:flex sm:w-full sm:gap-1 sm:h-auto bg-muted/40 p-1">
            <TabsTrigger value="dashboard" className="flex-initial shrink-0">
              <LayoutDashboard className="mr-1 h-4 w-4" />
              <span className="inline">Panel</span>
            </TabsTrigger>
            {(!interfazSimple || isDueno) && (
            <TabsTrigger value="pedidos" className="flex-initial shrink-0">
              <ClipboardList className="mr-1 h-4 w-4" />
              <span className="inline">Pedidos</span>
            </TabsTrigger>
            )}
            <TabsTrigger value="entregas" className="flex-initial shrink-0">
              <Truck className="mr-1 h-4 w-4" />
              <span className="inline">Entregas</span>
            </TabsTrigger>
            {(!interfazSimple || isDueno) && (
            <TabsTrigger value="gastos" className="flex-initial shrink-0">
              <Receipt className="mr-1 h-4 w-4" />
              <span className="inline">Gastos</span>
            </TabsTrigger>
            )}
            <TabsTrigger value="liquidacion" className="flex-initial shrink-0">
              <Calculator className="mr-1 h-4 w-4" />
              <span className="inline">Liquidación</span>
            </TabsTrigger>
            {/* Clientes: visible en completa */}
            {(!interfazSimple || isDueno) && (
            <TabsTrigger value="clientes" className="flex-initial shrink-0">
              <Users className="mr-1 h-4 w-4" />
              <span className="inline">Clientes</span>
            </TabsTrigger>
            )}
            {/* Recurrentes: admin y chofer */}
            {(!interfazSimple || isDueno) && (
              <TabsTrigger value="recurrentes" className="flex-initial shrink-0">
                <CalendarClock className="mr-1 h-4 w-4" />
                <span className="inline">Recurrentes</span>
              </TabsTrigger>
            )}
            {/* Historial: visible en completa */}
            {(!interfazSimple || isDueno) && (
            <TabsTrigger value="historial" className="flex-initial shrink-0">
              <History className="mr-1 h-4 w-4" />
              <span className="inline">Historial</span>
            </TabsTrigger>
            )}
            {/* Equipo y Ajustes: solo dueño */}
            {isDueno && (
              <TabsTrigger value="equipo" className="flex-initial shrink-0">
                <UserCog className="mr-1 h-4 w-4" />
                <span className="inline">Equipo</span>
              </TabsTrigger>
            )}
            {isDueno && (
              <TabsTrigger value="config" className="flex-initial shrink-0">
                <Settings className="mr-1 h-4 w-4" />
                <span className="inline">Ajustes</span>
              </TabsTrigger>
            )}
            {!isDueno && (
              <TabsTrigger value="perfil" className="flex-initial shrink-0">
                <span className="inline">👤 Mi Perfil</span>
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
                precioCamionCompleto: config?.precioCamionCompleto ?? 0,
                capacidadCamion: config?.capacidadCamion ?? 17000,
                umbralCompletacionVuelta: config?.umbralCompletacionVuelta ?? 0.975,
              }}
              camiones={camiones}
              onGoToEntregas={() => setTab("entregas")}
              onGoToGastos={() => setTab("gastos")}
              onGoToLiquidacion={() => setTab("liquidacion")}
              isDueno={isDueno}
              pedidosPendientes={(() => {
                // Filtrar solo pendientes/programados
                const pendientes = todosPedidos.filter(p => p.estado === "pendiente" || p.estado === "programado");
                // Filtrar solo pedidos para hoy o sin fecha
                const hoy = new Date();
                const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
                const paraHoy = pendientes.filter(p => {
                  if (!p.fechaSolicitada) return true; // sin fecha → hoy
                  const fStr = p.fechaSolicitada.split("T")[0];
                  return fStr <= hoyStr; // hoy o atrasados
                });
                // Eliminar duplicados
                const vistos = new Set<string>();
                const unicos = paraHoy.filter(p => {
                  const key = `${p.clienteId || p.clienteNombre}|${p.litrosSolicitados}|${p.fechaSolicitada || ""}`;
                  if (vistos.has(key)) return false;
                  vistos.add(key);
                  return true;
                });
                return unicos.map(p => ({
                  id: p.id,
                  clienteNombre: p.clienteNombre,
                  clienteId: p.clienteId,
                  litrosSolicitados: p.litrosSolicitados,
                  metodoPagoPreferido: p.metodoPagoPreferido,
                }));
              })()}
            />
          </TabsContent>

          <TabsContent value="pedidos" className="mt-0">
            <PedidosTab
              refreshKey={refreshKey}
              onRefresh={refresh}
              canCreate={isDueno || !!config?.choferesPuedenCrearPedidos || user.duenoId === user.userId}
              isDueno={isDueno}
              currentUserId={user.userId}
              clientes={clientes}
              choferes={usuarios.filter((u) => (u.role === "chofer" || u.role === "dueno") && u.activo).map((u) => ({ id: u.id, nombre: u.nombre }))}
              clientePreselect={pedidoClientePreselect}
              onPreselectConsumed={() => setPedidoClientePreselect(null)}
              vueltaActual={vueltaActual}
              camiones={camiones}
            />
          </TabsContent>

          <TabsContent value="entregas" className="mt-0">
            <EntregasTab
              refreshKey={refreshKey}
              onRefresh={refresh}
              onVueltaIniciada={refresh}
              clientes={clientes}
              config={{
                precioEfectivoPorLitro: config?.precioEfectivoPorLitro ?? 0,
                precioTransferenciaPorLitro: config?.precioTransferenciaPorLitro ?? 0,
                precioCamionCompleto: config?.precioCamionCompleto ?? 0,
                capacidadCamion: config?.capacidadCamion ?? 17000,
              }}
              vueltaActual={vueltaActual}
              camiones={camiones}
            />
          </TabsContent>

          <TabsContent value="gastos" className="mt-0">
            <GastosTab refreshKey={refreshKey} onRefresh={refresh} />
          </TabsContent>

          <TabsContent value="liquidacion" className="mt-0">
            <LiquidacionTab refreshKey={refreshKey} onRefresh={refresh} config={config} isDueno={isDueno} />
          </TabsContent>

          <TabsContent value="clientes" className="mt-0">
            <ClientesTab
              refreshKey={refreshKey}
              onRefresh={refresh}
              readOnly={isDueno ? false : !config?.choferesPuedenEditarClientes}
              choferes={usuarios.filter((u) => (u.role === "chofer" || u.role === "dueno") && u.activo).map((u) => ({ id: u.id, nombre: u.nombre, email: u.email }))}
              currentUserId={user.userId}
              isDueno={isDueno}
              config={config ? {
                precioEfectivoPorLitro: config.precioEfectivoPorLitro ?? 0,
                precioTransferenciaPorLitro: config.precioTransferenciaPorLitro ?? 0,
                precioCamionCompleto: config.precioCamionCompleto ?? 0,
                capacidadCamion: config.capacidadCamion ?? 17000,
              } : null}
              vueltaActual={vueltaActual}
              camiones={camiones}
              onAgendarPedido={(clienteId) => {
                setPedidoClientePreselect(clienteId);
                setTab("pedidos");
              }}
            />
          </TabsContent>

          {(!interfazSimple || isDueno) && (
            <TabsContent value="recurrentes" className="mt-0">
              <PedidosRecurrentesTab
                refreshKey={refreshKey}
                onRefresh={refresh}
                clientes={clientes}
                choferes={usuarios.filter((u) => (u.role === "chofer" || u.role === "dueno") && u.activo).map((u) => ({ id: u.id, nombre: u.nombre }))}
                pedidos={todosPedidos}
              />
            </TabsContent>
          )}

          <TabsContent value="historial" className="mt-0">
            <HistorialVueltasTab refreshKey={refreshKey} onRefresh={refresh} />
          </TabsContent>

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

          {!isDueno && (
            <TabsContent value="perfil" className="mt-0">
              <MiPerfilTab onLogout={handleLogout} />
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-muted/20 py-3">
        <div className="mx-auto w-full max-w-6xl px-3 text-center text-xs text-muted-foreground sm:px-6">
          Aljibe · {isDueno ? "Administrador" : "Chofer"}: {user.nombre} · {camiones.length} camión(es)
        </div>
      </footer>

      <SonnerToaster richColors position="top-center" />

      {/* Modal: Mi cuenta */}
      <CuentaDialog
        open={cuentaOpen}
        onOpenChange={setCuentaOpen}
        userId={user.userId}
        nombreActual={user.nombre}
        emailActual={user.email}
        onUpdated={() => {
          refresh();
          // Recargar datos del usuario
          apiGet<{ user: SessionUser | null }>("/api/auth/me").then((data) => {
            if (data.user) setUser(data.user);
          });
        }}
      />
    </div>
  );
}
