"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CreditCard, CheckCircle2, XCircle, AlertTriangle, Crown, Sparkles, Gem, Gift,
} from "lucide-react";
import { toast } from "sonner";
import { akuoGet, akuoPost, formatCLP } from "@/components/akuosplash/akuosplash-utils";
import type { PlanConfig, PlanId } from "@/lib/akuosplash-plans";

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
  mpSubPreapprovalId?: string | null;
  mpSubPlanSolicitado?: string | null;
  mpSubCiclo?: string | null;
  mpSubStatus?: string | null;
  mpSubIniciadoEn?: string | null;
  mpSubAutorizadoEn?: string | null;
  mpSubAmount?: number | null;
}

interface SubscripcionTabProps {
  user: any;
  onUpdated: () => void;
}

export function SubscripcionTab({ user, onUpdated }: SubscripcionTabProps) {
  const searchParams = useSearchParams();
  const [info, setInfo] = useState<SubscripcionInfo | null>(null);
  const [planes, setPlanes] = useState<Record<PlanId, PlanConfig> | null>(null);
  const [orden, setOrden] = useState<PlanId[]>(["gratis", "pago", "pro"]);
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);
  const [planSeleccionado, setPlanSeleccionado] = useState<PlanId>("pago");
  const [ciclo, setCiclo] = useState<"mensual" | "anual">("mensual");
  const [syncing, setSyncing] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await akuoGet<{ subscripcion: SubscripcionInfo; planes: Record<PlanId, PlanConfig>; orden: PlanId[] }>(
        "/api/akuosplash/subscription/info"
      );
      setInfo(d.subscripcion || { plan: "gratis" });
      if (d.planes) {
        setPlanes(d.planes);
        // Default al plan siguiente al actual
        const planActual = d.subscripcion?.plan || "gratis";
        if (planActual === "gratis" && d.orden.includes("pago")) setPlanSeleccionado("pago");
        else if (planActual === "pago" && d.orden.includes("pro")) setPlanSeleccionado("pro");
      }
      if (d.orden) setOrden(d.orden);
    } catch (e: any) {
      setInfo({ plan: "gratis" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Detectar resultado del redirect de MP (init_point redirige a MP, vuelve a ?tab=subscripcion&mp=ok|fail)
  useEffect(() => {
    const result = searchParams.get("mp");
    if (result === "ok") {
      toast.success("¡Subscripción procesada! Sincronizando estado…");
      // Disparar sync automáticamente
      (async () => {
        try {
          await akuoGet("/api/akuosplash/subscription/mercadopago/sync");
        } catch {}
        cargar();
        onUpdated();
      })();
    } else if (result === "fail") {
      toast.error("El pago no se completó");
    } else if (result === "pending") {
      toast.info("Pago pendiente — te avisaremos cuando se confirme");
      cargar();
    }
  }, [searchParams, cargar, onUpdated]);

  async function syncManual() {
    setSyncing(true);
    try {
      const r = await akuoGet<{ ok: boolean; status?: string; reason?: string }>("/api/akuosplash/subscription/mercadopago/sync");
      if (r.ok && r.status === "authorized") {
        toast.success("Subscripción confirmada");
        cargar();
        onUpdated();
      } else if (r.reason === "no_preapproval") {
        toast.info("No hay subscripción en curso");
      } else if (r.status) {
        toast.info(`Estado MP: ${r.status}`);
        cargar();
      } else {
        toast.error("No se pudo sincronizar");
      }
    } catch (e: any) {
      toast.error("Error: " + (e?.message || ""));
    } finally {
      setSyncing(false);
    }
  }

  async function iniciarPago() {
    if (planSeleccionado === "gratis") {
      toast.info("Estás en el plan Gratis. Elegí un plan de pago para subscribirte.");
      return;
    }
    setCreando(true);
    try {
      const res = await akuoPost<{ initPoint: string; preapprovalId: string; amount: number }>(
        "/api/akuosplash/subscription/mercadopago/create",
        { plan: planSeleccionado, ciclo }
      );
      // Redirigir al init_point de MP (Checkout de subscripción)
      window.location.href = res.initPoint;
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

  const planActual = (info?.plan as PlanId) || "gratis";
  const planActivoHasta = info?.planActivoHasta ? new Date(info.planActivoHasta) : null;
  const diasRestantes = planActivoHasta ? Math.ceil((planActivoHasta.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const estaActivo = planActual !== "gratis" && planActivoHasta && diasRestantes! > 0;

  // Helper para renderizar cada plan card
  function PlanCard({ planId, plan }: { planId: PlanId; plan: PlanConfig }) {
    const isSelected = planSeleccionado === planId;
    const isCurrent = planActual === planId;
    const isUpgrade = orden.indexOf(planId) > orden.indexOf(planActual);
    const isDowngrade = orden.indexOf(planId) < orden.indexOf(planActual);
    const precioMostrar = ciclo === "anual" ? plan.precioAnual : plan.precioMensual;
    const precioMesAnual = ciclo === "anual" && plan.precioAnual > 0 ? Math.round(plan.precioAnual / 12) : 0;

    // Features que mostramos (lista legible)
    const featureLabels: Array<[keyof PlanConfig["features"], string]> = [
      ["dashboard", "Panel y métricas"],
      ["historial", "Historial de vueltas"],
      ["vehiculo", "Gestión de vehículos"],
      ["entregas", "Entregas y vueltas activas"],
      ["gastos", "Gastos operativos"],
      ["liquidacion", "Liquidación"],
      ["clientes", "Clientes propios"],
      ["recurrentes", "Pedidos recurrentes"],
      ["equipo", "Equipo y choferes"],
      ["mpPropio", "MP para tus propios clientes"],
      ["wasabil", "Facturación SII (Wasabi)"],
      ["perfil", "Perfil"],
    ];
    const activeFeatures = featureLabels.filter(([k]) => plan.features[k]);
    const inactiveFeatures = featureLabels.filter(([k]) => !plan.features[k]);

    return (
      <Card className={`relative ${isSelected ? "border-blue-500 ring-2 ring-blue-200" : ""}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-1.5">
              {planId === "gratis" ? <Gift className="h-4 w-4 text-amber-600" />
                : planId === "pago" ? <Sparkles className="h-4 w-4 text-blue-600" />
                : <Crown className="h-4 w-4 text-violet-600" />}
              {plan.nombre}
              {isCurrent && estaActivo && (
                <Badge variant="default" className="text-[10px] ml-1 bg-emerald-100 text-emerald-800">Tu plan</Badge>
              )}
            </CardTitle>
            {plan.comisionPct !== undefined && (
              <Badge variant="outline" className="text-[10px]">
                {plan.comisionPct}% comisión
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{plan.descripcion}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            {plan.precioMensual === 0 ? (
              <p className="text-2xl font-bold tabular-nums">Gratis<span className="text-xs font-normal text-muted-foreground">/mes</span></p>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums">{formatCLP(precioMostrar)}<span className="text-xs font-normal text-muted-foreground">/{ciclo === "anual" ? "año" : "mes"}</span></p>
                {ciclo === "anual" && (
                  <p className="text-[10px] text-emerald-700">≈ {formatCLP(precioMesAnual)}/mes (2 meses gratis)</p>
                )}
              </>
            )}
          </div>

          <ul className="text-xs space-y-1 text-emerald-700 dark:text-emerald-300">
            {activeFeatures.map(([k, label]) => (
              <li key={k} className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 shrink-0" /> {label}
              </li>
            ))}
          </ul>
          {inactiveFeatures.length > 0 && (
            <ul className="text-xs space-y-1 text-muted-foreground/70">
              {inactiveFeatures.map(([k, label]) => (
                <li key={k} className="flex items-center gap-1 line-through">
                  <XCircle className="h-3 w-3 shrink-0 opacity-50" /> {label}
                </li>
              ))}
            </ul>
          )}

          <div className="text-[10px] text-muted-foreground space-y-0.5">
            <p>💰 Pago diferido: <strong>{plan.pagoDiferadoDias} días</strong> (MercadoPago)</p>
            <p>🚛 Vehículos: {plan.maxVehiculos === 0 ? "ilimitados" : plan.maxVehiculos} · 👥 Choferes: {plan.maxChoferes === 0 ? "ilimitados" : plan.maxChoferes}</p>
          </div>

          {planId !== "gratis" && !isCurrent && (
            <Button
              variant={isSelected ? "default" : "outline"}
              size="sm"
              className="w-full"
              onClick={() => setPlanSeleccionado(planId)}
            >
              {isSelected ? "✓ Seleccionado" : isUpgrade ? "Subir a " + plan.nombre : "Bajar a " + plan.nombre}
            </Button>
          )}
          {isCurrent && (
            <Badge variant="outline" className="w-full justify-center py-1 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
              {estaActivo ? "Activo" : "Vencido"}
            </Badge>
          )}
          {planId === "gratis" && planActual !== "gratis" && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-red-600 border-red-300 hover:bg-red-50"
              onClick={() => toast.info("Para cancelar, hacelo desde tu cuenta MercadoPago o escribínos a soporte.")}
            >
              Cancelar subscripción
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

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
                  <Gift className="h-4 w-4 text-amber-600" />
                )}
                Plan actual: <strong className="uppercase">{planActual}</strong>
              </p>
              {estaActivo ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Activo hasta {planActivoHasta!.toLocaleDateString("es-CL")} ({diasRestantes} días restantes)
                </p>
              ) : planActual !== "gratis" ? (
                <p className="text-xs text-amber-700 mt-1">
                  Tu plan {planActual} venció. Renová para seguir con los beneficios.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Estás en el plan Gratis. Subí de plan para más capacidad, menor comisión y pago más rápido.
                </p>
              )}
              {info?.mpSubStatus === "pending" && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Tenés una subscripción en proceso en MercadoPago. Si ya pagaste, tocá "Sincronizar".
                </p>
              )}
            </div>
            {info?.mpSubPreapprovalId && (
              <Button size="sm" variant="outline" onClick={syncManual} disabled={syncing}>
                {syncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Sincronizar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Planes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {orden.map(pid => planes?.[pid] && (
          <PlanCard key={pid} planId={pid} plan={planes[pid]} />
        ))}
      </div>

      {/* Ciclo de facturación (solo relevante para planes pagos) */}
      {planSeleccionado !== "gratis" && planes?.[planSeleccionado] && planes[planSeleccionado].precioMensual > 0 && (
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
                <p className="text-xs text-muted-foreground">{formatCLP(planes[planSeleccionado].precioMensual)}/mes</p>
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
                  {formatCLP(planes[planSeleccionado].precioAnual)}/año (≈ {formatCLP(Math.round(planes[planSeleccionado].precioAnual / 12))}/mes)
                </p>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen + Pagar */}
      {planSeleccionado !== "gratis" && planes?.[planSeleccionado] && planes[planSeleccionado].precioMensual > 0 && (
        <Card className="border-2 border-blue-200 bg-blue-50/30">
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{planes[planSeleccionado].nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ciclo</span>
                <span className="font-medium capitalize">{ciclo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monto</span>
                <span className="font-medium tabular-nums">
                  {formatCLP(ciclo === "anual" ? planes[planSeleccionado].precioAnual : planes[planSeleccionado].precioMensual)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Comisión marketplace</span>
                <span>{planes[planSeleccionado].comisionPct}%</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Pago diferido MP</span>
                <span>{planes[planSeleccionado].pagoDiferadoDias} días</span>
              </div>
              {ciclo === "anual" && (
                <p className="text-[10px] text-emerald-700 text-right">
                  Ahorrás {formatCLP(planes[planSeleccionado].precioMensual * 2)} vs mensual
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
                <><CreditCard className="mr-2 h-5 w-5" /> Pagar con MercadoPago</>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Vas a ser redirigido a MercadoPago para autorizar la subscripción recurrente. Después de aprobar, volvés automáticamente acá.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Última transacción MP */}
      {info?.mpSubPreapprovalId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Última subscripción (MercadoPago)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Estado</span>
              <span className={`font-medium ${
                info.mpSubStatus === "authorized" ? "text-emerald-600" :
                info.mpSubStatus === "pending" ? "text-amber-600" :
                info.mpSubStatus === "cancelled" ? "text-red-600" : ""
              }`}>
                {info.mpSubStatus}
              </span>
            </div>
            {info.mpSubAmount != null && (
              <div className="flex justify-between">
                <span>Monto</span>
                <span className="tabular-nums">{formatCLP(info.mpSubAmount)}</span>
              </div>
            )}
            {info.mpSubPlanSolicitado && (
              <div className="flex justify-between">
                <span>Plan solicitado</span>
                <span className="capitalize">{info.mpSubPlanSolicitado}</span>
              </div>
            )}
            {info.mpSubCiclo && (
              <div className="flex justify-between">
                <span>Ciclo</span>
                <span className="capitalize">{info.mpSubCiclo}</span>
              </div>
            )}
            {info.mpSubIniciadoEn && (
              <div className="flex justify-between">
                <span>Iniciado</span>
                <span>{new Date(info.mpSubIniciadoEn).toLocaleString("es-CL")}</span>
              </div>
            )}
            {info.mpSubAutorizadoEn && (
              <div className="flex justify-between">
                <span>Autorizado</span>
                <span>{new Date(info.mpSubAutorizadoEn).toLocaleString("es-CL")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200 flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p>
          Si MercadoPago no está configurado, el pago fallará. Avisale al superadmin que configure las credenciales en <strong>Panel admin → Integraciones → MercadoPago</strong>.
        </p>
      </div>
    </div>
  );
}
