"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Droplets, LogOut, TrendingUp, Wallet, Calendar } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency, formatNumber, formatDate, formatTime, labelMetodoPago, labelEstadoPago } from "@/lib/helpers";

interface Cliente {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
  zona: string | null;
  dueno: { id: string; nombre: string };
}

interface Entrega {
  id: string;
  fecha: string;
  litros: number;
  total: number;
  montoRecibido: number;
  estadoPago: string;
  metodoPago: string;
  nota: string | null;
  vuelta: { numero: number } | null;
}

interface EntregasResponse {
  entregas: Entrega[];
  resumen: {
    totalEntregas: number;
    totalLitros: number;
    totalVentas: number;
    totalRecibido: number;
    saldoPendiente: number;
  };
}

function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("aljibe-cliente-token");
  }
  return null;
}

export default function ClienteDashboardPage() {
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [data, setData] = useState<EntregasResponse | null>(null);
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
        // token inválido
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
        {/* Resumen */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[10px] uppercase text-muted-foreground">Entregas</p>
              </div>
              <p className="text-xl font-bold">{r.totalEntregas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Droplets className="h-3.5 w-3.5 text-cyan-500" />
                <p className="text-[10px] uppercase text-muted-foreground">Litros totales</p>
              </div>
              <p className="text-xl font-bold">{formatNumber(r.totalLitros, 0)} L</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-[10px] uppercase text-muted-foreground">Total comprado</p>
              </div>
              <p className="text-base font-bold tabular-nums">{formatCurrency(r.totalVentas)}</p>
            </CardContent>
          </Card>
          <Card className={r.saldoPendiente > 0 ? "border-amber-300 bg-amber-50 dark:bg-amber-900/10" : ""}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-3.5 w-3.5 text-amber-600" />
                <p className="text-[10px] uppercase text-muted-foreground">Saldo pendiente</p>
              </div>
              <p className="text-base font-bold tabular-nums text-amber-600">{formatCurrency(r.saldoPendiente)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Datos del proveedor */}
        <Card>
          <CardContent className="p-3">
            <p className="text-xs uppercase text-muted-foreground">Tu proveedor</p>
            <p className="font-medium text-sm">{cliente.dueno.nombre}</p>
            <div className="mt-1 text-xs text-muted-foreground">
              {cliente.direccion && <p>{cliente.direccion}</p>}
              {cliente.zona && <p>{cliente.zona}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Historial */}
        <div>
          <h2 className="text-sm font-semibold mb-2">Historial de entregas</h2>
          {data.entregas.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Aún no tenés entregas registradas.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {data.entregas.map((e) => (
                <Card key={e.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{formatDate(e.fecha)}</span>
                        <span className="text-xs text-muted-foreground">{formatTime(e.fecha)}</span>
                        {e.vuelta && <Badge variant="outline" className="text-[10px]">Vuelta #{e.vuelta.numero}</Badge>}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        e.estadoPago === "pagado" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : e.estadoPago === "parcial" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-muted text-muted-foreground"
                      }`}>
                        {labelEstadoPago(e.estadoPago)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span><Droplets className="mr-0.5 inline h-3 w-3" />{formatNumber(e.litros, 0)} L</span>
                      <span>·</span>
                      <span>{labelMetodoPago(e.metodoPago)}</span>
                      <span>·</span>
                      <span>Total: <strong className="text-foreground tabular-nums">{formatCurrency(e.total)}</strong></span>
                    </div>
                    {e.total - e.montoRecibido > 0 && (
                      <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                        Saldo: {formatCurrency(e.total - e.montoRecibido)}
                      </p>
                    )}
                    {e.nota && <p className="mt-1 text-xs italic text-muted-foreground">{e.nota}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
