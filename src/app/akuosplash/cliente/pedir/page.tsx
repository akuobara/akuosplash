"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Droplets, ArrowLeft, LogOut, MapPin, Loader2, CreditCard, Calendar, CheckCircle2 } from "lucide-react";
import { akuoGet, akuoPost } from "@/components/akuosplash/akuosplash-utils";
import { toast } from "sonner";

export default function PedirAguaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
      <PedirAguaInner />
    </Suspense>
  );
}

function PedirAguaInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);

  const [litros, setLitros] = useState("1000");
  const [direccion, setDireccion] = useState("");
  const [comuna, setComuna] = useState("");
  const [fechaDeseada, setFechaDeseada] = useState("");
  const [tipoTarjeta, setTipoTarjeta] = useState<"debito" | "credito">("debito");
  const [nota, setNota] = useState("");

  useEffect(() => {
    akuoGet<{ user: any }>("/api/akuosplash/cliente/perfil").then(d => {
      if (!d.user) {
        router.replace("/akuosplash");
        return;
      }
      setPerfil(d.user);
      setDireccion(d.user.direccion || "");
      setComuna(d.user.comuna || "");

      // Si vino de "repetir pedido", precargar los datos del último pedido
      if (params.get("repetir") === "1" && typeof window !== "undefined") {
        const repetirData = sessionStorage.getItem("akuosplash-repetir");
        if (repetirData) {
          try {
            const parsed = JSON.parse(repetirData);
            if (parsed.litros) setLitros(String(parsed.litros));
            if (parsed.direccion) setDireccion(parsed.direccion);
            if (parsed.nota) setNota(parsed.nota);
            toast.info("Pedido anterior cargado — revisá los datos y confirmá");
          } catch {}
          sessionStorage.removeItem("akuosplash-repetir");
        }
      }
    }).finally(() => setLoading(false));
  }, [router, params]);

  async function handlePedir(e: React.FormEvent) {
    e.preventDefault();
    if (creando) return;

    if (!direccion.trim()) { toast.error("Indicá tu dirección"); return; }
    if (!litros || Number(litros) < 100) { toast.error("Indicá al menos 100 litros"); return; }

    setCreando(true);
    try {
      await akuoPost("/api/akuosplash/cliente/pedidos", {
        litros: Number(litros),
        direccion: direccion.trim(),
        comuna: comuna.trim() || undefined,
        metodoPago: `tarjeta_${tipoTarjeta}`,
        fechaDeseada: fechaDeseada || undefined,
        nota: nota.trim() || undefined,
      });
      toast.success("¡Pedido creado! Mirá tu código de entrega abajo");
      router.push("/akuosplash/cliente");
    } catch (e: any) { toast.error(e.message || "No se pudo crear el pedido"); }
    finally { setCreando(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!perfil) return null;

  const litrosNum = Number(litros) || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <Link href="/akuosplash/cliente" className="flex items-center gap-2 text-gray-600">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-bold text-sm">Volver</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }}>
            <LogOut className="mr-1 h-4 w-4" /> Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 space-y-4">
        {/* Título destacado */}
        <div className="text-center mb-2">
          <div className="inline-flex rounded-2xl bg-blue-500/10 p-3 mb-2">
            <Droplets className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pedir agua</h1>
          <p className="text-sm text-gray-500 mt-1">Elegí la cantidad, indicá tu dirección y confirmá.</p>
        </div>

        <form onSubmit={handlePedir} className="space-y-4">
          {/* Cantidad */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cantidad de agua</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[500, 1000, 2000, 5000].map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLitros(String(l))}
                    className={`rounded-lg border py-2.5 text-sm font-semibold ${litros === String(l) ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  >
                    {l >= 1000 ? `${l / 1000}K` : l}L
                  </button>
                ))}
              </div>
              <div>
                <Label className="text-xs">Otra cantidad (litros)</Label>
                <Input
                  type="number"
                  min="100"
                  step="100"
                  value={litros}
                  onChange={(e) => setLitros(e.target.value)}
                  placeholder="Ej: 1500"
                />
                <p className="text-xs text-gray-400 mt-1">Mínimo 100 L</p>
              </div>
            </CardContent>
          </Card>

          {/* Datos de entrega */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos de entrega</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Dirección *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    className="pl-9"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Calle, número, depto"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Comuna</Label>
                <Input value={comuna} onChange={(e) => setComuna(e.target.value)} placeholder="Ej: Vitacura" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Fecha deseada (opcional)</Label>
                <Input type="date" value={fechaDeseada} onChange={(e) => setFechaDeseada(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Nota para el repartidor (opcional)</Label>
                <Textarea
                  rows={2}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ej: tocar timbre 2, dejar en portería, el estanque está atrás…"
                />
              </div>
            </CardContent>
          </Card>

          {/* Método de pago — solo tarjeta */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pago con tarjeta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <button
                type="button"
                onClick={() => setTipoTarjeta("debito")}
                className={`w-full text-left rounded-lg border p-3 transition ${tipoTarjeta === "debito" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-gray-600" />
                    <div>
                      <p className="font-medium text-sm">Tarjeta de débito</p>
                      <p className="text-xs text-gray-500">Pagás al confirmar el pedido</p>
                    </div>
                  </div>
                  {tipoTarjeta === "debito" && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setTipoTarjeta("credito")}
                className={`w-full text-left rounded-lg border p-3 transition ${tipoTarjeta === "credito" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-gray-600" />
                    <div>
                      <p className="font-medium text-sm">Tarjeta de crédito</p>
                      <p className="text-xs text-gray-500">Pagás al confirmar el pedido</p>
                    </div>
                  </div>
                  {tipoTarjeta === "credito" && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                </div>
              </button>
            </CardContent>
          </Card>

          {/* Resumen + submit */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Cantidad</span>
              <span className="font-semibold tabular-nums">{litrosNum.toLocaleString("es-CL")} L</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pago</span>
              <span className="font-medium">Tarjeta {tipoTarjeta}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Dirección</span>
              <span className="font-medium text-right max-w-[60%] truncate">{direccion || "—"}</span>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-base font-semibold rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
            disabled={creando || !direccion.trim() || !litros}
          >
            {creando ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando…</>
            ) : (
              <><CreditCard className="mr-2 h-5 w-5" /> Pagar con tarjeta y pedir {litrosNum.toLocaleString("es-CL")} L</>
            )}
          </Button>

          <p className="text-center text-[11px] text-gray-400">
            Al confirmar se generará tu código de entrega de 4 dígitos.
          </p>
        </form>
      </main>
    </div>
  );
}
