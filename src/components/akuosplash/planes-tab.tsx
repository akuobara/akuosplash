"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Save, Eye, Gift, Sparkles, Crown, RotateCcw, Zap, Clock, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { akuoGet, akuoPut } from "@/components/akuosplash/akuosplash-utils";
import type { PlanConfig, PlanId, MpSplitMode } from "@/lib/akuosplash-plans";
import { useRouter } from "next/navigation";

interface PlanesTabProps {
  previewOnly?: boolean;
}

const ALL_FEATURES: Array<{ key: keyof PlanConfig["features"]; label: string; description: string }> = [
  { key: "dashboard", label: "Panel", description: "Resumen y métricas del día" },
  { key: "historial", label: "Historial", description: "Historial de vueltas y entregas" },
  { key: "vehiculo", label: "Vehículos", description: "Gestión de camiones (necesario para marketplace)" },
  { key: "perfil", label: "Perfil", description: "Perfil del transportista" },
  { key: "entregas", label: "Entregas", description: "Entregas y vueltas activas" },
  { key: "gastos", label: "Gastos", description: "Registro de gastos operativos" },
  { key: "liquidacion", label: "Liquidación", description: "Liquidación de pagos a transportista" },
  { key: "clientes", label: "Clientes", description: "Gestión de clientes propios" },
  { key: "recurrentes", label: "Recurrentes", description: "Pedidos recurrentes" },
  { key: "equipo", label: "Equipo", description: "Choferes y equipo de trabajo" },
  { key: "mpPropio", label: "MP propios", description: "MP para sus propios clientes (Plan Pro)" },
  { key: "wasabil", label: "Wasabil", description: "Plan Growth de wasabil.cl — facturación SII automática (incluido en plan Pro)" },
  { key: "docUpload", label: "Doc tributario", description: "Subir factura manualmente para recibir pago (Plan Gratis)" },
  { key: "subscripcion", label: "Subscripción", description: "Tab para ver/mejorar plan" },
];

const MP_SPLIT_MODES: Array<{ id: MpSplitMode; label: string; description: string; icon: any; color: string }> = [
  { id: "none", label: "Sin split", description: "La plataforma cobra y el transportista sube su factura (Plan Gratis)", icon: XCircle, color: "amber" },
  { id: "10day", label: "Split 10 días", description: "MP libera los fondos al transportista 10 días después del pago (Plan Premium)", icon: Clock, color: "blue" },
  { id: "instant", label: "Split instantáneo", description: "MP libera inmediatamente al transportista (Plan Pro)", icon: Zap, color: "violet" },
];

export function PlanesTab({ previewOnly }: PlanesTabProps) {
  const router = useRouter();
  const [planes, setPlanes] = useState<Record<PlanId, PlanConfig> | null>(null);
  const [orden, setOrden] = useState<PlanId[]>(["gratis", "premium", "pro"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<PlanId | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await akuoGet<{ planes: Record<PlanId, PlanConfig>; orden: PlanId[] }>("/api/akuosplash/admin/planes");
      setPlanes(d.planes);
      setOrden(d.orden);
    } catch (e: any) {
      toast.error("No se pudo cargar: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardar() {
    if (!planes) return;
    setSaving(true);
    try {
      // Usar fetch directo para evitar cualquier issue con akuoPut
      const res = await fetch("/api/akuosplash/admin/planes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planes }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      // Usar la respuesta verificada del servidor
      if (data.planes) {
        setPlanes(data.planes);
      }
      toast.success("Configuración de planes guardada");
    } catch (e: any) {
      console.error("[planes guardar]", e);
      toast.error("No se pudo guardar: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  function updatePlan(planId: PlanId, patch: Partial<PlanConfig>) {
    if (!planes) return;
    setPlanes({
      ...planes,
      [planId]: { ...planes[planId], ...patch },
    });
  }

  function updateFeature(planId: PlanId, feature: keyof PlanConfig["features"], value: boolean) {
    if (!planes) return;
    setPlanes({
      ...planes,
      [planId]: {
        ...planes[planId],
        features: { ...planes[planId].features, [feature]: value },
      },
    });
  }

  function toggleActiva(planId: PlanId) {
    if (!planes) return;
    const plan = planes[planId];
    // No se puede desactivar el plan gratis
    if (planId === "gratis") {
      toast.info("El plan Gratis no se puede desactivar");
      return;
    }
    setPlanes({
      ...planes,
      [planId]: { ...plan, activa: !plan.activa },
    });
  }

  function preview(planId: PlanId) {
    router.push(`/akuosplash/transportista?previewPlan=${planId}`);
  }

  function reset() {
    if (!confirm("¿Restablecer a valores por defecto? Se perderán las customizaciones.")) return;
    cargar();
    toast.info("Recargado desde la DB");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!planes) return null;

  const planIcons: Record<PlanId, any> = {
    gratis: Gift,
    pago: Sparkles, // alias
    premium: Sparkles,
    pro: Crown,
  };
  const planColors: Record<PlanId, string> = {
    gratis: "amber",
    pago: "blue",
    premium: "blue",
    pro: "violet",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" /> Configuración de planes
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Ajustá comisión, modo de MP split, precios, límites y features visibles para cada plan.
                El modo MP split determina qué cuenta de MercadoPago se usa al cobrar al cliente del marketplace.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset} disabled={saving}>
                <RotateCcw className="h-3 w-3 mr-1" /> Recargar
              </Button>
              {!previewOnly && (
                <Button size="sm" onClick={guardar} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                  Guardar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de planes */}
      {orden.map(planId => {
        const plan = planes[planId];
        if (!plan) return null;
        const Icon = planIcons[planId];
        const isExpanded = expandedPlan === planId;
        const mpMode = MP_SPLIT_MODES.find(m => m.id === plan.mpSplitMode);
        return (
          <Card key={planId} className={`border-${planColors[planId]}-200`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle
                  className="text-sm cursor-pointer flex items-center gap-1.5"
                  onClick={() => setExpandedPlan(isExpanded ? null : planId)}
                >
                  <Icon className={`h-4 w-4 text-${planColors[planId]}-600`} /> {plan.nombre}
                  <Badge variant="outline" className="ml-1 text-[10px]">{plan.comisionPct}% comisión</Badge>
                  {mpMode && (
                    <Badge variant="outline" className={`text-[10px] text-${mpMode.color}-700 border-${mpMode.color}-300`}>
                      {mpMode.icon && <mpMode.icon className="h-2.5 w-2.5 mr-0.5" />}
                      {mpMode.label}
                    </Badge>
                  )}
                  <span className="ml-1 text-xs">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                </CardTitle>
                <div className="flex items-center gap-3">
                  {planId !== "gratis" && (
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] text-muted-foreground">Disponible</Label>
                      <Switch
                        checked={plan.activa}
                        onCheckedChange={() => toggleActiva(planId)}
                        disabled={!!previewOnly}
                      />
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={() => preview(planId)} className="text-xs">
                    <Eye className="h-3 w-3 mr-1" /> Vista previa
                  </Button>
                </div>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="space-y-4">
                {/* Precios */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Precios (CLP)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Precio mensual</Label>
                      <Input type="number" value={plan.precioMensual}
                        onChange={(e) => updatePlan(planId, { precioMensual: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-sm" disabled={!!previewOnly} />
                    </div>
                    <div>
                      <Label className="text-xs">Precio anual (0 = sin opción anual)</Label>
                      <Input type="number" value={plan.precioAnual}
                        onChange={(e) => updatePlan(planId, { precioAnual: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-sm" disabled={!!previewOnly} />
                    </div>
                  </div>
                </div>

                {/* Comisión + MP Split Mode */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Comisión y MercadoPago</p>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Comisión marketplace (%)</Label>
                      <Input type="number" step="0.1" value={plan.comisionPct}
                        onChange={(e) => updatePlan(planId, { comisionPct: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-sm" disabled={!!previewOnly} />
                      <p className="text-[10px] text-muted-foreground mt-0.5">% que la plataforma retiene de cada venta del marketplace.</p>
                    </div>
                    <div>
                      <Label className="text-xs">Modo de MercadoPago (split)</Label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {MP_SPLIT_MODES.map(m => {
                          const isSelected = plan.mpSplitMode === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => updatePlan(planId, {
                                mpSplitMode: m.id,
                                pagoDiferadoDias: m.id === "10day" ? 10 : 0,
                              })}
                              disabled={!!previewOnly}
                              className={`rounded-md border p-2 text-left transition ${
                                isSelected ? `border-${m.color}-500 bg-${m.color}-50` : "border-gray-200 hover:bg-gray-50"
                              }`}
                            >
                              <p className="text-xs font-medium flex items-center gap-1">
                                <m.icon className={`h-3 w-3 text-${m.color}-600`} />
                                {m.label}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                      {mpMode && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{mpMode.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Límites */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Límites</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Máx vehículos (0 = ilimitado)</Label>
                      <Input type="number" value={plan.maxVehiculos}
                        onChange={(e) => updatePlan(planId, { maxVehiculos: parseInt(e.target.value) || 0 })}
                        className="h-8 text-sm" disabled={!!previewOnly} />
                    </div>
                    <div>
                      <Label className="text-xs">Máx choferes (0 = ilimitado)</Label>
                      <Input type="number" value={plan.maxChoferes}
                        onChange={(e) => updatePlan(planId, { maxChoferes: parseInt(e.target.value) || 0 })}
                        className="h-8 text-sm" disabled={!!previewOnly} />
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Features visibles</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {ALL_FEATURES.map(({ key, label, description }) => (
                      <div key={String(key)} className="flex items-center justify-between rounded-md border border-border p-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{description}</p>
                        </div>
                        <Switch
                          checked={plan.features[key]}
                          onCheckedChange={(v) => updateFeature(planId, key, v)}
                          disabled={!!previewOnly}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
