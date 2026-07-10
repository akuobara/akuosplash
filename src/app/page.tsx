"use client";

import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Droplets, LayoutDashboard, Truck, Receipt, HandCoins, Users, Settings } from "lucide-react";
import { Dashboard } from "@/components/app/dashboard";
import { EntregasTab } from "@/components/app/entregas-tab";
import { GastosTab } from "@/components/app/gastos-tab";
import { LiquidacionTab } from "@/components/app/liquidacion-tab";
import { ClientesTab } from "@/components/app/clientes-tab";
import { ConfiguracionTab } from "@/components/app/configuracion-tab";
import { apiGet } from "@/lib/api-client";

interface Cliente {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  zona: string | null;
  precioEfectivoPorLitro: number;
  precioTransferenciaPorLitro: number;
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

type TabKey = "dashboard" | "entregas" | "gastos" | "liquidacion" | "clientes" | "config";

export default function Home() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [vueltaActual, setVueltaActual] = useState<VueltaActual | null>(null);
  const [camiones, setCamiones] = useState<Camion[]>([]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Cargar clientes, configuración, vuelta activa y camiones
  useEffect(() => {
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
      } catch (e) {
        console.error(e);
      }
    })();
  }, [refreshKey]);

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
          {config && (
            <div className="hidden text-right text-xs text-muted-foreground sm:block">
              <p>
                <span className="font-medium text-foreground">{config.nombreChofer}</span> · chofer
              </p>
              <p>
                {camiones.length > 0
                  ? `${camiones.length} camión(es) · ${config.nombreDueno}`
                  : `${config.nombreDueno}`}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Main con tabs */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="space-y-4">
          {/* Tabs list */}
          <TabsList className="flex w-full flex-wrap justify-start gap-1 h-auto bg-muted/40 p-1">
            <TabsTrigger value="dashboard" className="flex-1 sm:flex-initial">
              <LayoutDashboard className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Panel</span>
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
              <HandCoins className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Liquidación</span>
            </TabsTrigger>
            <TabsTrigger value="clientes" className="flex-1 sm:flex-initial">
              <Users className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Clientes</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex-1 sm:flex-initial">
              <Settings className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">Ajustes</span>
            </TabsTrigger>
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
            <ClientesTab refreshKey={refreshKey} onRefresh={refresh} />
          </TabsContent>

          <TabsContent value="config" className="mt-0">
            <ConfiguracionTab
              config={config}
              onConfigChange={(c) => setConfig(c)}
              refreshKey={refreshKey}
              onRefresh={refresh}
              onCamionesChange={setCamiones}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-muted/20 py-3">
        <div className="mx-auto w-full max-w-6xl px-3 text-center text-xs text-muted-foreground sm:px-6">
          Aljibe App · Registro de entregas de agua · Datos almacenados localmente en el dispositivo
        </div>
      </footer>

      <SonnerToaster richColors position="top-center" />
    </div>
  );
}
