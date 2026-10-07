"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useState, useCallback, Component } from "react";
import dynamicImport from "next/dynamic";
import { useRouter } from "next/navigation";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Droplets, LogOut } from "lucide-react";
import { apiGet, apiPost } from "@/components/akuosplash/akuosplash-api-client";
import { toast } from "sonner";
import Link from "next/link";

// Error boundary que muestra el error en pantalla
class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error("Dashboard error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 m-4">
          <p className="font-bold text-red-700">Error en Dashboard: {this.state.error.message}</p>
          <pre className="text-xs text-red-600 mt-2 overflow-auto max-h-48">{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const Dashboard = dynamicImport(() => import("@/components/akuosplash/dashboard").then(m => ({ default: m.Dashboard })), {
  ssr: false,
  loading: () => <div className="flex justify-center py-12"><Droplets className="h-8 w-8 animate-spin text-blue-600" /></div>,
});

interface Cliente { id: string; nombre: string; rut: string | null; direccion: string | null; telefono: string | null; email: string | null; zona: string | null; precioEfectivoPorLitro: number; precioTransferenciaPorLitro: number; precioCamionCompleto: number; lat: number | null; lng: number | null; requiereIngresoPropiedad: boolean; entregaDesdeAfuera: boolean; conexionExterna: boolean; requiereClientePresente: boolean; indicacionesAcceso: string | null; usoAgua: string; deudaInicial?: number; usoAguaNota: string | null; estanquesJson: string | null; choferPreferidoId: string | null; }
interface Camion { id: string; nombre: string; patente: string | null; capacidad: number; activo: boolean; }

export default function TransportistaPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(undefined);
  const [authLoading, setAuthLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [config, setConfig] = useState<any>({});
  const [camiones, setCamiones] = useState<Camion[]>([]);
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

  useEffect(() => {
    if (!user) return;
    Promise.allSettled([
      apiGet<{ clientes: Cliente[] }>("/api/akuosplash/clientes"),
      apiGet<{ configuracion: any }>("/api/akuosplash/configuracion"),
      apiGet<{ camiones: Camion[] }>("/api/akuosplash/vehiculos"),
    ]).then(results => {
      if (results[0].status === "fulfilled") setClientes((results[0] as any).value.clientes || []);
      if (results[1].status === "fulfilled" && (results[1] as any).value.configuracion) setConfig((results[1] as any).value.configuracion);
      if (results[2].status === "fulfilled") setCamiones((results[2] as any).value.camiones || []);
    });
  }, [user, refreshKey]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground animate-pulse">
          <Droplets className="h-9 w-9" />
        </div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/akuosplash";
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {user.rol === "superadmin" && (
        <Link href="/akuosplash/superadmin" className="block bg-violet-600 text-white text-xs py-1.5 text-center font-medium hover:bg-violet-700">
          Estás viendo como repartidor (modo superadmin) — Volver al panel
        </Link>
      )}

      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/akuosplash/logo.png" alt="AkuoSplash" className="h-8 w-auto" />
            <div className="hidden sm:block">
              <p className="font-bold text-blue-600">AkuoSplash</p>
              <p className="-mt-1 text-xs text-muted-foreground">Repartidor · {user.nombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user.rol === "superadmin" && (
              <Link href="/akuosplash/superadmin" className="text-xs text-violet-600 hover:underline">Volver a admin</Link>
            )}
            <Button variant="outline" size="sm" onClick={async () => { await apiPost("/api/akuosplash/auth/logout"); window.location.href = "/akuosplash"; }}>
              <LogOut className="h-4 w-4" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6">
        <ErrorBoundary>
          <Dashboard
            refreshKey={refreshKey}
            onRefresh={refresh}
            clientes={clientes}
            config={config}
            camiones={camiones}
            onGoToEntregas={() => {}}
            onGoToGastos={() => {}}
            onGoToLiquidacion={() => {}}
            isDueno={true}
          />
        </ErrorBoundary>
      </div>

      <SonnerToaster richColors position="top-center" />
    </div>
  );
}
