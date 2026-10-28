"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Droplets, ArrowLeft, LogOut, MapPin, Loader2, CreditCard, Calendar, CheckCircle2, Ticket, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { akuoGet, akuoPost, formatCLP } from "@/components/akuosplash/akuosplash-utils";
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
  const [config, setConfig] = useState<{ precioPorLitro: number | null; comisionPct: number; zona?: { nombre: string } | null; hayServicio?: boolean; litrosMinimos?: number | null; precioDinamicoHabilitado?: boolean }>({ precioPorLitro: null, comisionPct: 0 });

  const [litros, setLitros] = useState("1000");
  const [direccion, setDireccion] = useState("");
  const [comuna, setComuna] = useState("");
  const [fechaDeseada, setFechaDeseada] = useState("");
  const [tipoTarjeta, setTipoTarjeta] = useState<"debito" | "credito">("debito");
  const [nota, setNota] = useState("");
  // Campos de tarjeta
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardRut, setCardRut] = useState("");
  const [cardInstallments, setCardInstallments] = useState(1);

  useEffect(() => {
    akuoGet<{ user: any }>("/api/akuosplash/cliente/perfil").then(d => {
      if (!d.user) {
        router.replace("/akuosplash");
        return;
      }
      setPerfil(d.user);
      setDireccion(d.user.direccion || "");
      setComuna(d.user.comuna || "");

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

  // Cargar precio según la zona del cliente
  useEffect(() => {
    if (!perfil) return;
    akuoGet<{ precioPorLitro: number | null; comisionPct: number; zona: { nombre: string } | null; hayServicio: boolean; litrosMinimos: number | null; precioDinamicoHabilitado?: boolean }>(`/api/akuosplash/cliente/precio`)
      .then(setConfig)
      .catch(() => setConfig({ precioPorLitro: null, comisionPct: 0, hayServicio: false }));
  }, [perfil]);

  // Estado para precio dinámico (total calculado por el motor)
  const [precioDinamico, setPrecioDinamico] = useState<{ total: number; validoHasta: string } | null>(null);
  const [precioDinamicoLoading, setPrecioDinamicoLoading] = useState(false);

  // Estado para cupón de descuento (aplicable a la venta del marketplace)
  const [couponCode, setCouponCode] = useState("");
  const [couponAplicado, setCouponAplicado] = useState<any>(null);
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Precio base (con precio dinámico si está habilitado, sino precio lineal)
  const precioBase = precioDinamico?.total ?? 0;

  // Total final con cupón aplicado
  const totalFinal = couponAplicado
    ? (couponAplicado.descuento > 0 ? Math.max(0, precioBase - couponAplicado.descuento) : precioBase)
    : precioBase;

  // Validar cupón
  async function validarCupon() {
    if (!couponCode.trim()) return;
    if (precioBase <= 0) {
      toast.info("Elegí los litros primero");
      return;
    }
    setCouponValidating(true);
    setCouponError(null);
    setCouponAplicado(null);
    try {
      const res = await akuoPost<{ valido: boolean; cupon?: any; descuento: number; montoFinal: number; razon?: string }>(
        "/api/akuosplash/cupones/validar",
        { codigo: couponCode, tipo: "venta", monto: precioBase }
      );
      if (res.valido && res.cupon) {
        setCouponAplicado({ ...res.cupon, descuento: res.descuento, montoFinal: res.montoFinal });
        toast.success(`Cupón aplicado: ${formatCLP(res.descuento)} off`);
      } else {
        setCouponError(res.razon || "Cupón no válido");
        toast.error(res.razon || "Cupón no válido");
      }
    } catch (e: any) {
      setCouponError(e?.message || "No se pudo validar");
      toast.error(e?.message || "No se pudo validar el cupón");
    } finally {
      setCouponValidating(false);
    }
  }

  function quitarCupon() {
    setCouponCode("");
    setCouponAplicado(null);
    setCouponError(null);
  }

  // Reset cupón cuando cambia el precio base
  useEffect(() => {
    if (couponAplicado) {
      setCouponAplicado(null);
      setCouponError(null);
    }
  }, [precioBase]);

  // Recalcular precio dinámico cuando cambia el input del cliente
  useEffect(() => {
    if (!perfil || !config?.precioDinamicoHabilitado) {
      setPrecioDinamico(null);
      return;
    }
    const litrosNum = Number(litros);
    if (!litrosNum || litrosNum < 100) {
      setPrecioDinamico(null);
      return;
    }
    let cancelled = false;
    setPrecioDinamicoLoading(true);
    // Debounce 500ms para no llamar al motor con cada tecla
    const t = setTimeout(() => {
      akuoPost<{ resultado: { total: number }; validoHasta: string }>("/api/akuosplash/precio/calcular", {
        litros: litrosNum,
        metodoPago: tipoTarjeta === "credito" ? "credito" : "tarjeta",
        urgencia: "standard",
        horario: fechaDeseada ? new Date(fechaDeseada).toISOString() : new Date().toISOString(),
      })
        .then((res) => {
          if (cancelled) return;
          setPrecioDinamico({ total: res.resultado.total, validoHasta: res.validoHasta });
        })
        .catch(() => {
          if (cancelled) return;
          setPrecioDinamico(null);
        })
        .finally(() => {
          if (!cancelled) setPrecioDinamicoLoading(false);
        });
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [perfil, config?.precioDinamicoHabilitado, litros, tipoTarjeta, fechaDeseada]);

  async function handlePedir(e: React.FormEvent) {
    e.preventDefault();
    if (creando) return;

    if (!direccion.trim()) { toast.error("Indicá tu dirección"); return; }
    if (!litros || Number(litros) < 100) { toast.error("Indicá al menos 100 litros"); return; }
    // Validaciones de tarjeta
    if (cardNumber.replace(/\D/g, "").length < 13) { toast.error("Número de tarjeta inválido"); return; }
    if (!/^\d{2}\/\d{2}$/.test(cardExp)) { toast.error("Vencimiento inválido (MM/AA)"); return; }
    if (cardCvv.length < 3) { toast.error("CVV inválido"); return; }
    if (!cardName.trim()) { toast.error("Indicá el nombre del titular"); return; }
    if (!cardRut.trim()) { toast.error("Indicá el RUT del titular"); return; }

    setCreando(true);
    try {
      // 1) Tokenizar la tarjeta con la Public Key de MP
      const publicKey = process.env.NEXT_PUBLIC_AKUO_MP_PUBLIC_KEY;
      // En el frontend no tenemos process.env — usamos variable inline que inyectaremos
      const MP_PUBLIC_KEY = (window as any).AKUO_MP_PUBLIC_KEY || "APP_USR-01c8fba9-52cb-4fc9-92f3-0ee8cbf73c0b";
      const [expMonth, expYear] = cardExp.split("/");
      const expYearFull = "20" + expYear;
      const rutClean = cardRut.replace(/[.\-]/g, "");
      const rutNum = rutClean.replace(/\D/g, "");
      const rutDv = rutClean.slice(-1).toUpperCase();

      const tokenRes = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${MP_PUBLIC_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_number: cardNumber.replace(/\D/g, ""),
          expiration_month: Number(expMonth),
          expiration_year: Number(expYearFull),
          security_code: cardCvv,
          cardholder: {
            name: cardName,
            identification: {
              type: "rut",
              number: rutNum,
            },
          },
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.id) {
        toast.error(tokenData.message || "No se pudo tokenizar la tarjeta");
        setCreando(false);
        return;
      }
      const cardToken = tokenData.id;

      // 2) Crear el pedido + procesar pago en el backend
      const res = await akuoPost<{ ok: boolean; status?: string; redirectUrl?: string; error?: string }>("/api/akuosplash/cliente/pedidos", {
        litros: Number(litros),
        direccion: direccion.trim(),
        comuna: comuna.trim() || undefined,
        metodoPago: `tarjeta_${tipoTarjeta}`,
        fechaDeseada: fechaDeseada || undefined,
        nota: nota.trim() || undefined,
        cardToken,
        installments: tipoTarjeta === "credito" ? cardInstallments : 1,
        cardFirstSix: cardNumber.replace(/\D/g, "").slice(0, 6),
        // Cupón de descuento (si está aplicado)
        couponCode: couponAplicado ? couponAplicado.codigo : undefined,
      });
      if (res.ok) {
        // Si MP requiere 3DS, redirigir
        if (res.redirectUrl) {
          toast.info("Tu banco requiere verificación 3D Secure. Vas a ser redirigido.");
          setTimeout(() => { window.location.href = res.redirectUrl!; }, 1000);
          return;
        }
        if (res.status === "approved") {
          toast.success("¡Pago aprobado! Pedido confirmado.");
        } else if (res.status === "in_process") {
          toast.info("Pago en proceso. Te avisaremos cuando se confirme.");
        } else if (res.status === "rejected") {
          toast.error("El pago fue rechazado. Probá con otra tarjeta.");
          return;
        }
        router.push("/akuosplash/cliente");
      } else {
        toast.error(res.error || "No se pudo procesar el pago");
      }
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

          {/* Datos de tarjeta — pago directo via API */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Datos de la tarjeta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoTarjeta("debito")}
                  className={`rounded-lg border py-2 text-sm font-medium ${tipoTarjeta === "debito" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                >
                  Débito
                </button>
                <button
                  type="button"
                  onClick={() => setTipoTarjeta("credito")}
                  className={`rounded-lg border py-2 text-sm font-medium ${tipoTarjeta === "credito" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                >
                  Crédito
                </button>
              </div>
              <div>
                <Label className="text-xs">Número de tarjeta</Label>
                <Input
                  inputMode="numeric"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
                  placeholder="4509 9535 6623 3704"
                  className="font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Vencimiento (MM/AA)</Label>
                  <Input
                    value={cardExp}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
                      setCardExp(v);
                    }}
                    placeholder="11/25"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs">CVV</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="123"
                    className="font-mono"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Nombre del titular</Label>
                <Input
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="Como figura en la tarjeta"
                />
              </div>
              <div>
                <Label className="text-xs">RUT del titular</Label>
                <Input
                  value={cardRut}
                  onChange={(e) => setCardRut(e.target.value)}
                  placeholder="12.345.678-9"
                />
              </div>
              {tipoTarjeta === "credito" && (
                <div>
                  <Label className="text-xs">Cuotas</Label>
                  <select
                    value={cardInstallments}
                    onChange={(e) => setCardInstallments(Number(e.target.value))}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value={1}>1 (Pago único)</option>
                    <option value={3}>3 cuotas</option>
                    <option value={6}>6 cuotas</option>
                    <option value={12}>12 cuotas</option>
                  </select>
                </div>
              )}
              <p className="text-[11px] text-gray-400">
                Tus datos de tarjeta se procesan directamente en MercadoPago. No los guardamos.
              </p>
            </CardContent>
          </Card>

          {/* Resumen + submit */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Cantidad</span>
              <span className="font-semibold tabular-nums">{litrosNum.toLocaleString("es-CL")} L</span>
            </div>
            {config.hayServicio && (config.precioPorLitro || config.precioDinamicoHabilitado) ? (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-600">Zona</span>
                  <span className="font-medium">{config.zona?.nombre || "—"}</span>
                </div>
                {config.precioDinamicoHabilitado ? (
                  // Modo dinámico: solo mostrar el total
                  <>
                    <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                      <span>Precio dinámico (calculado por motor)</span>
                      {precioDinamicoLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                    </div>
                    {precioDinamico ? (
                      <>
                        <div className="flex justify-between border-t border-blue-200 pt-1 mt-1">
                          <span className="font-semibold text-gray-900">Total a pagar</span>
                          <span className="font-bold tabular-nums text-blue-700 text-base">
                            {formatCLP(precioDinamico.total)}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400">
                          Válido hasta {new Date(precioDinamico.validoHasta).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </>
                    ) : !precioDinamicoLoading ? (
                      <p className="text-[11px] text-gray-500">Calculando precio…</p>
                    ) : null}
                  </>
                ) : (
                  // Modo estático (legacy)
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Precio por litro</span>
                      <span className="font-medium tabular-nums">{formatCLP(config.precioPorLitro)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium tabular-nums">{formatCLP(litrosNum * config.precioPorLitro!)}</span>
                    </div>
                    {config.comisionPct > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Comisión app ({config.comisionPct}%)</span>
                        <span className="font-medium tabular-nums">{formatCLP(Math.round(litrosNum * config.precioPorLitro! * config.comisionPct / 100))}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-blue-200 pt-1 mt-1">
                      <span className="font-semibold text-gray-900">Total a pagar</span>
                      <span className="font-bold tabular-nums text-blue-700 text-base">
                        {formatCLP(litrosNum * config.precioPorLitro! + (config.comisionPct > 0 ? Math.round(litrosNum * config.precioPorLitro! * config.comisionPct / 100) : 0))}
                      </span>
                    </div>
                  </>
                )}
                {config.litrosMinimos && config.litrosMinimos > 0 && litrosNum < config.litrosMinimos && (
                  <p className="text-[11px] text-amber-600 mt-1">Mínimo para tu zona: {config.litrosMinimos} L</p>
                )}

                {/* === Cupón de descuento === */}
                {precioBase > 0 && (
                  <div className="border-t border-blue-200 pt-2 mt-2 space-y-1.5">
                    <p className="text-xs font-medium text-gray-700 flex items-center gap-1">
                      <Ticket className="h-3 w-3" /> ¿Tenés un cupón de descuento?
                    </p>
                    {couponAplicado ? (
                      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-md p-2">
                        <Badge className="bg-emerald-100 text-emerald-800 uppercase font-mono">
                          {couponAplicado.codigo} ✓
                        </Badge>
                        <p className="text-xs text-emerald-700 flex-1">
                          {formatCLP(couponAplicado.descuento)} off
                        </p>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={quitarCupon}>Quitar</Button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => {
                            setCouponCode(e.target.value.toUpperCase());
                            setCouponError(null);
                          }}
                          placeholder="EJ: AGUA10"
                          className="flex-1 h-8 rounded-md border border-gray-300 px-2 text-xs font-mono uppercase"
                          onKeyDown={(e) => { if (e.key === "Enter" && !couponValidating) validarCupon(); }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={validarCupon}
                          disabled={couponValidating || !couponCode.trim()}
                        >
                          {couponValidating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Validar"}
                        </Button>
                      </div>
                    )}
                    {couponError && (
                      <p className="text-[11px] text-red-700 flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> {couponError}
                      </p>
                    )}
                    {couponAplicado && (
                      <div className="flex justify-between text-emerald-700 text-xs">
                        <span>Descuento aplicado</span>
                        <span className="tabular-nums">-{formatCLP(couponAplicado.descuento)}</span>
                      </div>
                    )}
                    {couponAplicado && (
                      <div className="flex justify-between border-t border-emerald-200 pt-1">
                        <span className="font-semibold text-gray-900">Total con descuento</span>
                        <span className="font-bold tabular-nums text-emerald-700 text-base">
                          {formatCLP(totalFinal)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : config.hayServicio === false ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                <p className="font-medium text-red-700">Sin servicio en tu zona</p>
                <p className="text-xs text-red-600 mt-1">Tu ubicación no tiene zona de cobertura asignada. Contactanos para verificar.</p>
              </div>
            ) : (
              <div className="flex justify-between text-gray-500">
                <span>Consultando precio para tu zona…</span>
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            <div className="flex justify-between text-[11px] text-gray-500 mt-1">
              <span>Método de pago</span>
              <span className="capitalize">Tarjeta {tipoTarjeta}</span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-500">
              <span>Dirección</span>
              <span className="text-right max-w-[60%] truncate">{direccion || "—"}</span>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-base font-semibold rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
            disabled={creando || !direccion.trim() || !litros || !config.hayServicio || (!config.precioPorLitro && !config.precioDinamicoHabilitado) || !cardNumber || !cardExp || !cardCvv || !cardName}
          >
            {creando ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando pago…</>
            ) : !config.hayServicio ? (
              <>Sin servicio en tu zona</>
            ) : (config.precioPorLitro == null && !config.precioDinamicoHabilitado) ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Consultando precio…</>
            ) : config.precioDinamicoHabilitado && !precioDinamico ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculando precio…</>
            ) : (
              <><CreditCard className="mr-2 h-5 w-5" /> Pagar {formatCLP(totalFinal > 0 ? totalFinal : (config.precioDinamicoHabilitado && precioDinamico ? precioDinamico.total : (litrosNum * config.precioPorLitro! + (config.comisionPct > 0 ? Math.round(litrosNum * config.precioPorLitro! * config.comisionPct / 100) : 0))))} y pedir</>
            )}
          </Button>

          <p className="text-center text-[11px] text-gray-400">
            Al confirmar, MercadoPago procesará el pago directo con tu tarjeta. Si tu banco requiere 3D Secure, vas a ser redirigido.
          </p>
        </form>
      </main>
    </div>
  );
}
