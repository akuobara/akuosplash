"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CreditCard, CheckCircle2, XCircle, AlertTriangle, Crown, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { akuoGet, akuoPost, formatCLP } from "@/components/akuosplash/akuosplash-utils";

interface SubscripcionInfo {
  plan: string;
  planActivoDesde?: string | null;
  planActivoHasta?: string | null;
  transbankStatus?: string | null;
  transbankAmount?: number | null;
  transbankPlanSolicitado?: string | null;
  transbankCiclo?: string | null;
  transbankIniciadoEn?: string | null;
  transbankAutorizadoEn?: string | null;
}

interface SubscripcionTabProps {
  user: any;
  onUpdated: () => void;
}

export function SubscripcionTab({ user, onUpdated }: SubscripcionTabProps) {
  const searchParams = useSearchParams();
  const [info, setInfo] = useState<SubscripcionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);
  const [planSeleccionado, setPlanSeleccionado] = useState<"pro" | "enterprise">("pro");
  const [ciclo, setCiclo] = useState<"mensual" | "anual">("mensual");

  // Precios
  const PRECIO_PRO = 15000;
  const PRECIO_ENTERPRISE = 50000;
  const precioActual = planSeleccionado === "pro" ? PRECIO_PRO : PRECIO_ENTERPRISE;
  const precioAnual = precioActual * 10; // 2 meses gratis

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await akuoGet<{ subscripcion: SubscripcionInfo }>("/api/akuosplash/subscription/info");
      setInfo(d.subscripcion || { plan: "free" });
    } catch (e: any) {
      setInfo({ plan: "free" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Detectar resultado del redirect de Transbank
  useEffect(() => {
    const result = searchParams.get("transbank");
    if (result === "ok") {
      const plan = searchParams.get("plan");
      toast.success(`¡Subscripción activada! Plan: ${plan}`);
      cargar();
      onUpdated();
    } else if (result === "fallido") {
      const status = searchParams.get("status");
      const rc = searchParams.get("rc");
      toast.error(`Pago fallido. Estado: ${status}, código: ${rc}`);
    } else if (result === "abortado") {
      toast.info("Pago cancelado por el usuario");
    } else if (result === "error") {
      const msg = searchParams.get("msg");
      toast.error(`Error al procesar: ${msg}`);
    }
  }, [searchParams, cargar, onUpdated]);

  async function iniciarPago() {
    setCreando(true);
    try {
      const res = await akuoPost<{ token: string; url: string; buyOrder: string; amount: number }>(
        "/api/akuosplash/subscription/transbank/create",
        { plan: planSeleccionado, ciclo }
      );
      // Redirigir a la URL de Webpay con el token (POST form o GET con ?token_ws=)
      // Transbank usa POST form normalmente, pero la URL admite GET también.
      // Hacemos un POST form programático para cumplir con el estándar.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = res.url;
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "token_ws";
      input.value = res.token;
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    } catch (e: any) {
      toast.error("No se pudo iniciar el pago: " + (e?.message || ""));
    } finally {
      setCreando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const planActual = info?.plan || "free";
  const planActivoHasta = info?.planActivoHasta ? new Date(info.planActivoHasta) : null;
  const diasRestantes = planActivoHasta ? Math.ceil((planActivoHasta.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const estaActivo = planActual !== "free" && planActivoHasta && diasRestantes! > 0;

  return (
    <div className="space-y-4">
      {/* Banner de estado */}
      <Card className={estaActivo ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium flex items-center gap-1.5">
                {estaActivo ? (
                  <Crown className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Sparkles className="h-4 w-4 text-amber-600" />
                )}
                Plan actual: <strong className="uppercase">{planActual}</strong>
              </p>
              {estaActivo ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Activo hasta {planActivoHasta!.toLocaleDateString("es-CL")} ({diasRestantes} días restantes)
                </p>
              ) : planActual !== "free" ? (
                <p className="text-xs text-amber-700 mt-1">
                  Tu plan {planActual} venció. Renová para seguir con los beneficios.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Estás en el plan Free. Subí a Pro o Enterprise para más capacidad y features.
                </p>
              )}
              {info?.transbankStatus === "INITIALIZED" && (
                <p className="text-xs text-amber-600 mt-1">
                  Tenés un pago en proceso (Transbank). Si lo completaste y no se ve reflejado, esperá 1 minuto y recargá.
                </p>
              )}
            </div>
            {estaActivo && (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Activo
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Planes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Plan Pro */}
        <Card className={`relative ${planSeleccionado === "pro" ? "border-blue-500 ring-2 ring-blue-200" : ""}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-blue-600" /> Pro
              </span>
              {planActual === "pro" && estaActivo && (
                <Badge variant="default" className="text-[10px]">Tu plan</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-bold tabular-nums">{formatCLP(PRECIO_PRO)}<span className="text-xs font-normal text-muted-foreground">/mes</span></p>
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li>✓ Hasta 5 vehículos</li>
              <li>✓ Marketplace de pedidos</li>
              <li>✓ Precio dinámico</li>
              <li>✓ Facturación SII (wasabil)</li>
              <li>✓ Soporte por email</li>
            </ul>
            <Button
              variant={planSeleccionado === "pro" ? "default" : "outline"}
              size="sm"
              className="w-full"
              onClick={() => setPlanSeleccionado("pro")}
            >
              {planSeleccionado === "pro" ? "✓ Seleccionado" : "Seleccionar Pro"}
            </Button>
          </CardContent>
        </Card>

        {/* Plan Enterprise */}
        <Card className={`relative ${planSeleccionado === "enterprise" ? "border-violet-500 ring-2 ring-violet-200" : ""}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Crown className="h-4 w-4 text-violet-600" /> Enterprise
              </span>
              {planActual === "enterprise" && estaActivo && (
                <Badge variant="default" className="text-[10px]">Tu plan</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-bold tabular-nums">{formatCLP(PRECIO_ENTERPRISE)}<span className="text-xs font-normal text-muted-foreground">/mes</span></p>
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li>✓ Vehículos ilimitados</li>
              <li>✓ Todo lo de Pro</li>
              <li>✓ Multi-sucursal</li>
              <li>✓ API para integraciones</li>
              <li>✓ Soporte prioritario 24/7</li>
              <li>✓ Onboarding personalizado</li>
            </ul>
            <Button
              variant={planSeleccionado === "enterprise" ? "default" : "outline"}
              size="sm"
              className="w-full"
              onClick={() => setPlanSeleccionado("enterprise")}
            >
              {planSeleccionado === "enterprise" ? "✓ Seleccionado" : "Seleccionar Enterprise"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Ciclo de facturación */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <p className="text-sm font-medium">Ciclo de facturación</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCiclo("mensual")}
              className={`rounded-lg border p-2.5 text-left transition ${
                ciclo === "mensual" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <p className="text-sm font-medium">Mensual</p>
              <p className="text-xs text-muted-foreground">{formatCLP(precioActual)}/mes</p>
            </button>
            <button
              type="button"
              onClick={() => setCiclo("anual")}
              className={`rounded-lg border p-2.5 text-left transition ${
                ciclo === "anual" ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <p className="text-sm font-medium flex items-center gap-1">
                Anual <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">2 meses gratis</Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCLP(precioAnual)}/año (≈ {formatCLP(Math.round(precioAnual / 12))}/mes)
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Resumen + Pagar */}
      <Card className="border-2 border-blue-200 bg-blue-50/30">
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium capitalize">{planSeleccionado}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ciclo</span>
              <span className="font-medium capitalize">{ciclo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monto</span>
              <span className="font-medium tabular-nums">{formatCLP(ciclo === "anual" ? precioAnual : precioActual)}</span>
            </div>
            {ciclo === "anual" && (
              <p className="text-[10px] text-emerald-700 text-right">
                Ahorrás {formatCLP(precioActual * 2)} vs mensual
              </p>
            )}
          </div>
          <Button
            onClick={iniciarPago}
            disabled={creando}
            size="lg"
            className="w-full h-12 text-base font-semibold"
          >
            {creando ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Iniciando pago…</>
            ) : (
              <><CreditCard className="mr-2 h-5 w-5" /> Pagar con Transbank</>
            )}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            Vas a ser redirigido a Webpay (Transbank) para completar el pago con tarjeta de crédito o débito. Después de pagar, volvés automáticamente acá.
          </p>
        </CardContent>
      </Card>

      {/* Historial */}
      {info?.transbankStatus && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Última transacción</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Estado</span>
              <span className={`font-medium ${info.transbankStatus === "AUTHORIZED" ? "text-emerald-600" : "text-amber-600"}`}>
                {info.transbankStatus}
              </span>
            </div>
            {info.transbankAmount != null && (
              <div className="flex justify-between">
                <span>Monto</span>
                <span className="tabular-nums">{formatCLP(info.transbankAmount)}</span>
              </div>
            )}
            {info.transbankPlanSolicitado && (
              <div className="flex justify-between">
                <span>Plan solicitado</span>
                <span className="capitalize">{info.transbankPlanSolicitado}</span>
              </div>
            )}
            {info.transbankCiclo && (
              <div className="flex justify-between">
                <span>Ciclo</span>
                <span className="capitalize">{info.transbankCiclo}</span>
              </div>
            )}
            {info.transbankIniciadoEn && (
              <div className="flex justify-between">
                <span>Iniciado</span>
                <span>{new Date(info.transbankIniciadoEn).toLocaleString("es-CL")}</span>
              </div>
            )}
            {info.transbankAutorizadoEn && (
              <div className="flex justify-between">
                <span>Autorizado</span>
                <span>{new Date(info.transbankAutorizadoEn).toLocaleString("es-CL")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200 flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p>
          Si Transbank no está configurado, el pago fallará. Avisale al superadmin que configure las credenciales en <strong>Panel admin → Integraciones → Transbank</strong>.
        </p>
      </div>
    </div>
  );
}
