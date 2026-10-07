"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LogOut, Loader2, MapPin, ShoppingBag, KeyRound, ShieldCheck } from "lucide-react";
import { akuoGet, akuoPost, formatCLP } from "@/components/akuosplash/akuosplash-utils";
import { toast } from "sonner";

interface Pedido {
  id: string; creadoEn: string; litros: number; direccion: string; comuna?: string | null;
  estado: string; metodoPago: string; precioTotal?: number | null; estadoPago?: string;
  codigoConfirmacion?: string | null; codigoVerificadoEn?: string | null;
  clienteId: string; transportistaId?: string | null;
  cliente: { id: string; nombre: string; email: string | null };
  transportista?: { id: string; nombre: string } | null;
}

const ESTADO_LABELS: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "bg-amber-50 text-amber-700 border-amber-200" },
  aceptado: { label: "Aceptado", color: "bg-blue-50 text-blue-700 border-blue-200" },
  en_ruta: { label: "En ruta", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  entregado: { label: "Entregado", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelado: { label: "Cancelado", color: "bg-red-50 text-red-700 border-red-200" },
};

export function AkuosplashAdminPedidos() {
  const router = useRouter();
  const [user, setUser] = useState<any>(undefined);
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
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
    setLoading(true);
    try {
      const d = await akuoGet<{ pedidos: Pedido[] }>("/api/akuosplash/superadmin/pedidos");
      setPedidos(d.pedidos);
    } catch (e: any) { toast.error(e.message || "Error"); }
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
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <Link href="/akuosplash/superadmin" className="flex items-center gap-2 text-gray-600">
            <ArrowLeft className="h-4 w-4" /><span className="font-bold text-sm">Volver</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }}>
            <LogOut className="mr-1 h-4 w-4" /> Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-sm text-gray-500">{pedidos.length} en total</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : pedidos.length === 0 ? (
          <Card><CardContent className="p-8 text-center">
            <ShoppingBag className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No hay pedidos todavía.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {pedidos.map(p => {
              const estado = ESTADO_LABELS[p.estado] || { label: p.estado, color: "bg-muted text-muted-foreground" };
              return (
                <Card key={p.id} className="border-gray-100">
                  <CardContent className="p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className={estado.color}>{estado.label}</Badge>
                      <span className="text-[10px] text-gray-400">
                        {new Date(p.creadoEn).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold tabular-nums">{p.litros.toLocaleString("es-CL")} L</span>
                      {p.precioTotal && <span className="text-sm text-gray-500">{formatCLP(p.precioTotal)}</span>}
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {p.direccion}{p.comuna ? `, ${p.comuna}` : ""}
                    </p>
                    <p className="text-xs text-gray-500">Cliente: {p.cliente?.nombre}</p>
                    {p.transportista && <p className="text-xs text-gray-500">Repartidor: {p.transportista.nombre}</p>}
                    <p className="text-xs text-gray-500">Pago: <span className="capitalize">{p.metodoPago}</span> · {p.estadoPago || "pendiente"}</p>
                    {p.codigoConfirmacion && (
                      <div className="mt-1.5 rounded border border-violet-200 bg-violet-50 px-2 py-1 inline-flex items-center gap-1.5">
                        <KeyRound className="h-3 w-3 text-violet-700" />
                        <span className="text-xs font-mono font-bold text-violet-900">{p.codigoConfirmacion}</span>
                      </div>
                    )}
                    {p.codigoVerificadoEn && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                        <ShieldCheck className="h-3 w-3" /> Entregado {new Date(p.codigoVerificadoEn).toLocaleDateString("es-CL")}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Button variant="outline" onClick={() => setRefreshKey(k => k + 1)} className="w-full">Actualizar</Button>
      </main>
    </div>
  );
}
