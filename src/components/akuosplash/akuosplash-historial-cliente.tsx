"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, Loader2, RotateCw, MapPin, ShieldCheck } from "lucide-react";
import { akuoGet, akuoPost } from "@/components/akuosplash/akuosplash-utils";
import { formatCLP } from "./akuosplash-utils";
import { toast } from "sonner";

interface Pedido {
  id: string; creadoEn: string; litros: number; direccion: string; comuna?: string; estado: string;
  metodoPago: string; nota?: string; precioTotal?: number;
  codigoConfirmacion?: string | null;
  codigoVerificadoEn?: string | null;
}

const ESTADO_LABELS: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "bg-amber-50 text-amber-700 border-amber-200" },
  aceptado: { label: "Aceptado", color: "bg-blue-50 text-blue-700 border-blue-200" },
  en_ruta: { label: "En ruta", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  entregado: { label: "Entregado", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelado: { label: "Cancelado", color: "bg-muted text-muted-foreground" },
};

export function AkuosplashHistorialCliente() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [historial, setHistorial] = useState<Pedido[]>([]);

  useEffect(() => {
    akuoGet<{ user: any }>("/api/akuosplash/auth/me").then(d => {
      if (!d.user) { router.replace("/akuosplash"); return; }
      setUser(d.user);
    });
  }, [router]);

  useEffect(() => {
    if (!user) return;
    akuoGet<{ historial: Pedido[] }>("/api/akuosplash/cliente/historial").then(d => {
      setHistorial(d.historial);
    }).finally(() => setLoading(false));
  }, [user]);

  function repetirPedido(p: Pedido) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("akuosplash-repetir", JSON.stringify({
        litros: p.litros, direccion: p.direccion, nota: p.nota,
      }));
    }
    router.push("/akuosplash/cliente/pedir?repetir=1");
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const entregados = historial.filter(h => h.estado === "entregado");
  const litrosTotal = entregados.reduce((s, h) => s + h.litros, 0);
  const gastadoTotal = entregados.reduce((s, h) => s + (h.precioTotal || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <Link href="/akuosplash/cliente" className="flex items-center gap-2 text-gray-600">
            <ArrowLeft className="h-4 w-4" /><span className="font-bold text-sm">Volver</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }}>
            <LogOut className="mr-1 h-4 w-4" /> Salir
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial</h1>
          <p className="text-sm text-gray-500">{historial.length} pedidos en total</p>
        </div>

        {/* Stats resumen */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="border-gray-100">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Pedidos</p>
              <p className="text-lg font-bold tabular-nums">{historial.length}</p>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Litros</p>
              <p className="text-lg font-bold tabular-nums">{litrosTotal.toLocaleString("es-CL")}</p>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Gastado</p>
              <p className="text-sm font-bold tabular-nums">{formatCLP(gastadoTotal)}</p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : historial.length === 0 ? (
          <Card><CardContent className="p-8 text-center">
            <p className="text-sm text-gray-400">Aún no tenés pedidos.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {historial.map((p) => {
              const estadoInfo = ESTADO_LABELS[p.estado] || { label: p.estado, color: "bg-muted text-muted-foreground" };
              const esEntregado = p.estado === "entregado";
              return (
                <Card key={p.id} className="border-gray-100">
                  <CardContent className="p-3.5">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-medium">{new Date(p.creadoEn).toLocaleDateString("es-CL")}</span>
                        <span className="text-[11px] text-gray-400">
                          {new Date(p.creadoEn).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${estadoInfo.color}`}>
                        {estadoInfo.label}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-base font-bold tabular-nums">{p.litros.toLocaleString("es-CL")} L</span>
                      {p.precioTotal && <span className="text-sm text-gray-500">{formatCLP(p.precioTotal)}</span>}
                    </div>
                    <p className="mt-1.5 text-[11px] text-gray-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {p.direccion}{p.comuna ? `, ${p.comuna}` : ""}
                    </p>
                    {p.nota && <p className="mt-1 text-[11px] italic text-gray-400">"{p.nota}"</p>}

                    {esEntregado && p.codigoVerificadoEn && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 p-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <p className="text-xs text-emerald-700">Entregado el {new Date(p.codigoVerificadoEn).toLocaleDateString("es-CL")}</p>
                      </div>
                    )}

                    {esEntregado && (
                      <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-[11px] text-gray-400 hover:text-blue-600" onClick={() => repetirPedido(p)}>
                        <RotateCw className="mr-1 h-3 w-3" /> Repetir
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
