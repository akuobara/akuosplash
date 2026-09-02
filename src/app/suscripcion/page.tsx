"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Droplets, LogOut, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/helpers";
import { apiGet, apiPost } from "@/lib/api-client";

interface Plan {
  id: string;
  nombre: string;
  descripcion: string | null;
  precioMensual: number;
  maxCamiones: number;
  maxChoferes: number;
  accesoPool: boolean;
  costoExtraCamion: number | null;
  costoExtraChofer: number | null;
}

interface Config {
  planId: string | null;
  nombreDueno: string;
}

export default function SuscripcionPage() {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagando, setPagando] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<{ planes: Plan[] }>("/api/super-admin/planes"),
      apiGet<{ configuracion: Config }>("/api/configuracion"),
    ])
      .then(([p, c]) => {
        setPlanes(p.planes || []);
        setConfig(c.configuracion || null);
      })
      .catch(() => toast.error("Error al cargar"))
      .finally(() => setLoading(false));
  }, []);

  async function pagar(planId: string) {
    setPagando(planId);
    try {
      const res = await apiPost<{ initPoint: string; sandboxInitPoint: string }>("/api/admin/suscripcion/pagar", { planId });
      // Redirigir a MercadoPago
      window.location.href = res.initPoint || res.sandboxInitPoint;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el pago");
    } finally {
      setPagando(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  const planActual = config?.planId || "free";

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <div className="rounded-full bg-primary/10 p-1.5">
              <Droplets className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-sm">Suscripción</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Plan de suscripción</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {config?.nombreDueno ? `${config.nombreDueno} · ` : ""}Plan actual: <strong>{planActual}</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {planes.map(p => {
            const esActual = p.id === planActual;
            return (
              <Card key={p.id} className={esActual ? "border-primary" : p.id === "pro" ? "border-primary/40" : ""}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base">{p.nombre}</span>
                    {esActual && <Badge className="text-[10px]">Actual</Badge>}
                  </div>
                  <p className="text-2xl font-bold tabular-nums">
                    {p.precioMensual === 0 ? "Gratis" : formatCurrency(p.precioMensual)}
                    {p.precioMensual > 0 && <span className="text-xs text-muted-foreground">/mes</span>}
                  </p>
                  <div className="space-y-1 text-xs">
                    <p>Camiones: {p.maxCamiones === -1 ? "Ilimitados" : p.maxCamiones}</p>
                    <p>Choferes: {p.maxChoferes === -1 ? "Ilimitados" : p.maxChoferes}</p>
                    <p>Pool de pedidos: {p.accesoPool ? "✓" : "✗"}</p>
                    {p.costoExtraCamion && <p>Extra camión: {formatCurrency(p.costoExtraCamion)}</p>}
                    {p.costoExtraChofer && <p>Extra chofer: {formatCurrency(p.costoExtraChofer)}</p>}
                  </div>
                  {esActual ? (
                    <Button className="w-full" variant="outline" disabled>
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Plan actual
                    </Button>
                  ) : p.precioMensual === 0 ? (
                    <Button className="w-full" variant="outline" disabled>
                      Gratis
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => pagar(p.id)}
                      disabled={pagando === p.id}
                    >
                      {pagando === p.id ? (
                        <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Procesando…</>
                      ) : (
                        <>Pagar con MercadoPago</>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          El pago se procesa por MercadoPago. Tu plan se activa automáticamente al confirmarse el pago.
        </p>
      </main>
    </div>
  );
}
