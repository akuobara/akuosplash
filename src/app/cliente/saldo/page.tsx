"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Droplets, LogOut, Wallet, Upload, ArrowLeft, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency, formatDateTime } from "@/lib/helpers";

interface Movimiento {
  id: string;
  creadoEn: string;
  tipo: string;
  monto: number;
  saldoResultante: number;
  descripcion: string | null;
  metodoCarga: string | null;
  comprobanteUrl: string | null;
  confirmado: boolean;
  confirmadoEn: string | null;
  pedidoAppId: string | null;
}

function getToken(): string | null {
  if (typeof window !== "undefined") return localStorage.getItem("aljibe-cliente-token");
  return null;
}

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
  carga: { label: "Carga de saldo", color: "text-emerald-600" },
  pago_pedido: { label: "Pago de pedido", color: "text-amber-600" },
  reembolso: { label: "Reembolso", color: "text-emerald-600" },
  saldo_a_favor: { label: "Saldo a favor", color: "text-emerald-600" },
  ajuste: { label: "Ajuste", color: "text-muted-foreground" },
};

export default function ClienteSaldoPage() {
  const router = useRouter();
  const [saldoActual, setSaldoActual] = useState(0);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);

  // Form de carga
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<"transferencia" | "efectivo">("transferencia");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    const token = getToken();
    if (!token) {
      router.replace("/cliente/login");
      return;
    }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch("/api/cliente/saldo/movimientos", { headers });
      if (res.status === 401) {
        localStorage.removeItem("aljibe-cliente-token");
        router.replace("/cliente/login");
        return;
      }
      if (!res.ok) throw new Error("Error al cargar");
      const data = await res.json();
      setSaldoActual(data.saldoActual || 0);
      setMovimientos(data.movimientos || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleUploadComprobante(file: File) {
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = getToken();
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Error ${res.status}: ${txt}`);
      }
      const data = await res.json();
      setComprobanteUrl(data.url);
      toast.success("Comprobante subido");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setSubiendo(false);
    }
  }

  async function handleCargar() {
    const montoNum = Number(monto);
    if (!montoNum || montoNum <= 0) {
      toast.error("Ingresá un monto válido");
      return;
    }
    if (metodo === "transferencia" && !comprobanteUrl) {
      toast.error("Subí el comprobante de transferencia");
      return;
    }
    setCargando(true);
    try {
      const token = getToken();
      const res = await fetch("/api/cliente/saldo/carga", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ monto: montoNum, metodoCarga: metodo, comprobanteUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar");

      toast.success(metodo === "efectivo" ? "Saldo cargado" : "Carga enviada para confirmación");
      setMonto("");
      setComprobanteUrl("");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar");
    } finally {
      setCargando(false);
    }
  }

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
    if (typeof window !== "undefined") localStorage.removeItem("aljibe-cliente-token");
    router.replace("/cliente/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link href="/cliente" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <div className="rounded-full bg-primary/10 p-1.5">
              <Droplets className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-sm">Saldo</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-1 h-4 w-4" /> Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {/* Saldo actual */}
        <Card className={saldoActual > 0 ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10" : ""}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="text-xs uppercase text-muted-foreground">Saldo actual</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-600">{formatCurrency(saldoActual)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cargar saldo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cargar saldo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Monto a cargar ($)</Label>
              <Input
                type="number"
                min="1000"
                step="1000"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="Ej: 10000"
              />
            </div>

            <div>
              <Label className="text-xs">Método</Label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setMetodo("transferencia")}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm ${metodo === "transferencia" ? "border-primary bg-primary/5 font-medium" : ""}`}
                >
                  Transferencia
                </button>
                <button
                  type="button"
                  onClick={() => setMetodo("efectivo")}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm ${metodo === "efectivo" ? "border-primary bg-primary/5 font-medium" : ""}`}
                >
                  Efectivo (admin)
                </button>
              </div>
              {metodo === "efectivo" && (
                <p className="text-xs text-amber-600 mt-1">
                  Solo disponible para clientes con al menos 10 entregas exitosas. Lo confirma el administrador.
                </p>
              )}
            </div>

            {metodo === "transferencia" && (
              <div>
                <Label className="text-xs">Comprobante de transferencia *</Label>
                {comprobanteUrl ? (
                  <div className="flex items-center gap-2 mt-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <a href={comprobanteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                      Ver comprobante
                    </a>
                    <Button size="sm" variant="ghost" onClick={() => setComprobanteUrl("")}>
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 mt-1 rounded-md border border-dashed p-4 cursor-pointer hover:bg-muted">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadComprobante(f);
                      }}
                    />
                    {subiendo ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo…</>
                    ) : (
                      <><Upload className="h-4 w-4" /> Subir comprobante</>
                    )}
                  </label>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Tu carga queda pendiente hasta que un administrador verifique la transferencia.
                </p>
              </div>
            )}

            <Button onClick={handleCargar} disabled={cargando || !monto} className="w-full">
              {cargando ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Cargando…</> : "Cargar saldo"}
            </Button>
          </CardContent>
        </Card>

        {/* Movimientos */}
        <div>
          <h2 className="text-sm font-semibold mb-2">Movimientos</h2>
          {movimientos.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Sin movimientos todavía.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {movimientos.map((m) => {
                const tipoInfo = TIPO_LABELS[m.tipo] || { label: m.tipo, color: "text-muted-foreground" };
                return (
                  <Card key={m.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-medium ${tipoInfo.color}`}>
                            {m.monto >= 0 ? "+" : ""}{formatCurrency(m.monto)}
                          </p>
                          <p className="text-xs text-muted-foreground">{tipoInfo.label}</p>
                          {m.descripcion && <p className="text-xs italic text-muted-foreground mt-0.5">{m.descripcion}</p>}
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(m.creadoEn)}</p>
                        </div>
                        <div className="text-right">
                          {m.tipo === "carga" && !m.confirmado ? (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                              <Clock className="mr-1 h-3 w-3" /> Pendiente
                            </Badge>
                          ) : m.tipo === "carga" && m.confirmado ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Confirmado
                            </Badge>
                          ) : null}
                          <p className="text-xs text-muted-foreground mt-1">Saldo: {formatCurrency(m.saldoResultante)}</p>
                        </div>
                      </div>
                      {m.comprobanteUrl && (
                        <a href={m.comprobanteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-1 inline-block">
                          Ver comprobante
                        </a>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
