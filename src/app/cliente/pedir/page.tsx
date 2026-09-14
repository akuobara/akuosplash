"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Droplets, LogOut, ArrowLeft, MapPin, Wallet, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency, formatNumber } from "@/lib/helpers";

interface Cliente {
  id: string;
  nombre: string;
  saldo: number;
  entregasExitosas: number;
  puedePagarEfectivo: boolean;
  zona: { id: string; nombre: string; precioPorLitro: number; litrosMinimos?: number } | null;
  direccion: string | null;
  indicacionesAcceso: string | null;
  proveedorPreferido: { id: string; nombre: string } | null;
  tiempoAceptacionPreferidoMin: number;
}

function getToken(): string | null {
  if (typeof window !== "undefined") return localStorage.getItem("aljibe-cliente-token");
  return null;
}

export default function PedirAguaPage() {
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [litros, setLitros] = useState("");
  const [metodoPago, setMetodoPago] = useState<"saldo" | "transferencia" | "efectivo">("saldo");
  const [direccion, setDireccion] = useState("");
  const [indicacionesAcceso, setIndicacionesAcceso] = useState("");
  const [nota, setNota] = useState("");
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/cliente/login");
      return;
    }
    fetch("/api/cliente/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.status === 401) {
          localStorage.removeItem("aljibe-cliente-token");
          router.replace("/cliente/login");
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (data?.cliente) {
          setCliente(data.cliente);
          setDireccion(data.cliente.direccion || "");
          setIndicacionesAcceso(data.cliente.indicacionesAcceso || "");
          // Si vino de "repetir pedido", precargar los datos del último pedido
          if (typeof window !== "undefined") {
            const repetirData = sessionStorage.getItem("aljibe-cliente-repetir");
            if (repetirData) {
              try {
                const parsed = JSON.parse(repetirData);
                if (parsed.litros) setLitros(String(parsed.litros));
                if (parsed.direccion) setDireccion(parsed.direccion);
                if (parsed.nota) setNota(parsed.nota);
                toast.info("Pedido anterior cargado — revisá los datos y confirmá");
              } catch {}
              // Limpiar para que no se vuelva a cargar al recargar
              sessionStorage.removeItem("aljibe-cliente-repetir");
            }
          }
        }
      })
      .catch(() => toast.error("Error al cargar datos"))
      .finally(() => setLoading(false));
  }, [router]);

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

  async function handlePedir(e: React.FormEvent) {
    e.preventDefault();
    const litrosNum = Number(litros);
    const minLitros = cliente?.zona?.litrosMinimos ?? 1000;
    if (!litrosNum || litrosNum < minLitros) {
      toast.error(`La cantidad mínima es ${formatNumber(minLitros, 0)} L`);
      return;
    }

    if (metodoPago === "saldo" && cliente && cliente.saldo < montoTotal) {
      toast.error(`Saldo insuficiente. Necesitás ${formatCurrency(montoTotal)} y tenés ${formatCurrency(cliente.saldo)}`);
      return;
    }

    setCreando(true);
    try {
      const token = getToken();
      const res = await fetch("/api/cliente/pedidos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          litros: litrosNum,
          metodoPago,
          direccion,
          indicacionesAcceso,
          nota,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear el pedido");

      toast.success(data.mensaje || "Pedido creado");
      router.push("/cliente");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el pedido");
    } finally {
      setCreando(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!cliente) return null;

  const precioPorLitro = cliente.zona?.precioPorLitro || 0;
  const montoBruto = Number(litros || 0) * precioPorLitro;
  const montoTotal = Math.ceil(montoBruto / 100) * 100;
  const comision = Math.round(montoTotal * 0.10);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link href="/cliente" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <div className="rounded-full bg-primary/10 p-1.5">
              <Droplets className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-sm">Pedir agua</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-1 h-4 w-4" /> Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {/* Info de zona y precio */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Tu zona</p>
                  <p className="font-medium text-sm">{cliente.zona?.nombre || "Sin zona"}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Precio por litro</p>
                <p className="font-bold text-sm">{formatCurrency(precioPorLitro)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Tu saldo</p>
                  <p className="font-bold text-sm text-emerald-600">{formatCurrency(cliente.saldo)}</p>
                </div>
              </div>
              {cliente.proveedorPreferido && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Proveedor preferido</p>
                  <p className="font-medium text-sm">{cliente.proveedorPreferido.nombre}</p>
                  <p className="text-xs text-muted-foreground">{cliente.tiempoAceptacionPreferidoMin} min para aceptar</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Formulario */}
        <form onSubmit={handlePedir} className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cantidad de agua</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Litros *</Label>
                <Input
                  type="number"
                  min={cliente?.zona?.litrosMinimos ?? 1000}
                  step="100"
                  value={litros}
                  onChange={(e) => setLitros(e.target.value)}
                  placeholder="Ej: 1500"
                />
                <p className="text-xs text-muted-foreground mt-1">Mínimo {formatNumber(cliente?.zona?.litrosMinimos ?? 1000, 0)} L</p>
              </div>

              {litros && Number(litros) > 0 && (
                <div className="rounded border p-3 space-y-1 text-sm bg-muted/30">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{formatNumber(Number(litros), 0)} L × {formatCurrency(precioPorLitro)}</span>
                    <span>{formatCurrency(montoBruto)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>Total a pagar</span>
                    <span>{formatCurrency(montoTotal)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Incluye 10% comisión app ({formatCurrency(comision)})
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Método de pago */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Método de pago</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <button
                type="button"
                onClick={() => setMetodoPago("saldo")}
                className={`w-full text-left rounded-md border p-3 ${metodoPago === "saldo" ? "border-primary bg-primary/5" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Pagar con saldo</p>
                    <p className="text-xs text-muted-foreground">
                      Saldo actual: {formatCurrency(cliente.saldo)}
                      {cliente.saldo < montoTotal && montoTotal > 0 && (
                        <span className="text-amber-600"> — insuficiente, cargá saldo primero</span>
                      )}
                    </p>
                  </div>
                  {metodoPago === "saldo" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMetodoPago("transferencia")}
                className={`w-full text-left rounded-md border p-3 ${metodoPago === "transferencia" ? "border-primary bg-primary/5" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Transferencia</p>
                    <p className="text-xs text-muted-foreground">Subir comprobante después</p>
                  </div>
                  {metodoPago === "transferencia" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => cliente.puedePagarEfectivo ? setMetodoPago("efectivo") : toast.error("Necesitás al menos 10 entregas exitosas")}
                className={`w-full text-left rounded-md border p-3 ${metodoPago === "efectivo" ? "border-primary bg-primary/5" : ""} ${!cliente.puedePagarEfectivo ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Efectivo al chofer</p>
                    <p className="text-xs text-muted-foreground">
                      {cliente.puedePagarEfectivo
                        ? "Pagás cuando llega el chofer"
                        : `Te faltan ${10 - cliente.entregasExitosas} entregas para habilitar`}
                    </p>
                  </div>
                  {metodoPago === "efectivo" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
              </button>
            </CardContent>
          </Card>

          {/* Entrega */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datos de entrega</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Dirección</Label>
                <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, número" />
              </div>
              <div>
                <Label className="text-xs">Indicaciones de acceso</Label>
                <Textarea value={indicacionesAcceso} onChange={(e) => setIndicacionesAcceso(e.target.value)} placeholder="Portón verde, estanque atrás…" rows={2} />
              </div>
              <div>
                <Label className="text-xs">Nota para el chofer (opcional)</Label>
                <Textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej: llamar antes de llegar" rows={2} />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" disabled={creando || !litros}>
            {creando ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creando pedido…</>
            ) : (
              <><Droplets className="mr-2 h-5 w-5" /> Pedir {litros ? `${formatNumber(Number(litros), 0)} L` : "agua"}</>
            )}
          </Button>
        </form>
      </main>
    </div>
  );
}
