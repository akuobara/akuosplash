"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, LogOut, Loader2, Wallet, CreditCard, CheckCircle2,
  ArrowDownCircle, Plus,
} from "lucide-react";
import { akuoGet, akuoPost, formatCLP } from "@/components/akuosplash/akuosplash-utils";
import { toast } from "sonner";

export default function SaldoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
      <SaldoInner />
    </Suspense>
  );
}

function SaldoInner() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [monto, setMonto] = useState("5000");
  const [metodo, setMetodo] = useState<"tarjeta_debito" | "tarjeta_credito" | "transferencia">("tarjeta_debito");

  useEffect(() => {
    akuoGet<{ user: any }>("/api/akuosplash/cliente/perfil").then(d => {
      if (!d.user) { router.replace("/akuosplash"); return; }
      setPerfil(d.user);
    }).finally(() => setLoading(false));
  }, [router]);

  async function abonar() {
    const montoNum = Number(monto);
    if (!montoNum || montoNum < 1000) {
      toast.error("Monto mínimo: $1.000");
      return;
    }
    setProcesando(true);
    try {
      const res = await akuoPost<{ ok: boolean; error?: string; mensaje?: string; saldo?: number; estado?: string }>(
        "/api/akuosplash/cliente/saldo",
        { monto: montoNum, metodoPago: metodo }
      );
      if (res.ok) {
        toast.success(res.mensaje || "Saldo abonado");
        if (res.saldo !== undefined) setPerfil((p: any) => ({ ...p, saldo: res.saldo }));
        router.push("/akuosplash/cliente");
      } else {
        toast.error(res.error || "No se pudo abonar");
      }
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setProcesando(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!perfil) return null;

  const saldo = perfil.saldo || 0;
  const montoNum = Number(monto) || 0;

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
          <h1 className="text-2xl font-bold text-gray-900">Abonar saldo</h1>
          <p className="text-sm text-gray-500">Cargá saldo para usar en pedidos futuros</p>
        </div>

        {/* Saldo actual */}
        <Card className={saldo > 0 ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-500/10 p-2">
                <Wallet className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Saldo actual</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-600">{formatCLP(saldo)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monto a abonar */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">¿Cuánto querés abonar?</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {[5000, 10000, 20000, 50000].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonto(String(m))}
                  className={`rounded-lg border py-2.5 text-xs font-semibold ${monto === String(m) ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                >
                  ${(m / 1000).toLocaleString("es-CL")}K
                </button>
              ))}
            </div>
            <div>
              <Label className="text-xs">Otra cantidad</Label>
              <Input type="number" min="1000" step="500" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Ej: 7000" />
              <p className="text-xs text-gray-400 mt-1">Mínimo $1.000</p>
            </div>
          </CardContent>
        </Card>

        {/* Método de pago */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Método de pago</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <button
              type="button"
              onClick={() => setMetodo("tarjeta_debito")}
              className={`w-full text-left rounded-lg border p-3 transition ${metodo === "tarjeta_debito" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-600" />
                  <div>
                    <p className="font-medium text-sm">Tarjeta de débito</p>
                    <p className="text-xs text-gray-500">Se acredita al instante</p>
                  </div>
                </div>
                {metodo === "tarjeta_debito" && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMetodo("tarjeta_credito")}
              className={`w-full text-left rounded-lg border p-3 transition ${metodo === "tarjeta_credito" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-600" />
                  <div>
                    <p className="font-medium text-sm">Tarjeta de crédito</p>
                    <p className="text-xs text-gray-500">Se acredita al instante</p>
                  </div>
                </div>
                {metodo === "tarjeta_credito" && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMetodo("transferencia")}
              className={`w-full text-left rounded-lg border p-3 transition ${metodo === "transferencia" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="h-4 w-4 text-gray-600" />
                  <div>
                    <p className="font-medium text-sm">Transferencia bancaria</p>
                    <p className="text-xs text-gray-500">Pendiente hasta confirmar</p>
                  </div>
                </div>
                {metodo === "transferencia" && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
              </div>
            </button>
          </CardContent>
        </Card>

        {/* Resumen */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Monto a abonar</span>
            <span className="font-bold tabular-nums">{formatCLP(montoNum)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Saldo después</span>
            <span className="font-bold tabular-nums text-emerald-700">{formatCLP(saldo + montoNum)}</span>
          </div>
        </div>

        <Button
          size="lg"
          onClick={abonar}
          disabled={procesando || montoNum < 1000}
          className="w-full h-14 text-base font-semibold rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20"
        >
          {procesando ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando…</>
          ) : (
            <><Plus className="mr-2 h-5 w-5" /> Abonar {formatCLP(montoNum)}</>
          )}
        </Button>
      </main>
    </div>
  );
}
