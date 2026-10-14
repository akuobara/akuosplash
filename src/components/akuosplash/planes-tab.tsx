"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Save, Eye, Gift, Sparkles, Crown, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { akuoGet, akuoPut } from "@/components/akuosplash/akuosplash-utils";
import type { PlanConfig, PlanId } from "@/lib/akuosplash-plans";
import { useRouter } from "next/navigation";

interface PlanesTabProps {
  // Si se pasa, el componente se renderiza en modo "preview" (sin guardar)
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
  { key: "mpPropio", label: "MP propios", description: "MercadoPago para sus propios clientes" },
  { key: "wasabil", label: "Wasabi", description: "Facturación SII automática" },
  { key: "subscripcion", label: "Subscripción", description: "Tab para ver/mejorar plan" },
];

export function PlanesTab({ previewOnly }: PlanesTabProps) {
  const router = useRouter();
  const [planes, setPlanes] = useState<Record<PlanId, PlanConfig> | null>(null);
  const [orden, setOrden] = useState<PlanId[]>(["gratis", "pago", "pro"]);
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
      await akuoPut("/api/akuosplash/admin/planes", { planes });
      toast.success("Configuración de planes guardada");
      cargar();
    } catch (e: any) {
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

  function preview(planId: PlanId) {
    // Abrir el dashboard del transportista en modo preview
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
    pago: Sparkles,
    pro: Crown,
  };
  const planColors: Record<PlanId, string> = {
    gratis: "amber",
    pago: "blue",
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
                Ajustá comisión, días de pago diferido, precios, límites y features visibles para cada plan.
                Los transportistas ven solo las tabs habilitadas para su plan.
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
        const Icon = planIcons[planId];
        const isExpanded = expandedPlan === planId;
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
                  <Badge variant="outline" className="text-[10px]">{plan.pagoDiferadoDias}d pago</Badge>
                  <span className="ml-1 text-xs">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => preview(planId)}
                  className="text-xs"
                >
                  <Eye className="h-3 w-3 mr-1" /> Vista previa
                </Button>
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
                      <Input
                        type="number"
                        value={plan.precioMensual}
                        onChange={(e) => updatePlan(planId, { precioMensual: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-sm"
                        disabled={!!previewOnly}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Precio anual (2 meses gratis)</Label>
                      <Input
                        type="number"
                        value={plan.precioAnual}
                        onChange={(e) => updatePlan(planId, { precioAnual: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-sm"
                        disabled={!!previewOnly}
                      />
                    </div>
                  </div>
                </div>

                {/* Comisión y pago diferido */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Comisión y retención</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Comisión marketplace (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={plan.comisionPct}
                        onChange={(e) => updatePlan(planId, { comisionPct: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-sm"
                        disabled={!!previewOnly}
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">% que la plataforma retiene de cada venta del marketplace.</p>
                    </div>
                    <div>
                      <Label className="text-xs">Pago diferido MP (días)</Label>
                      <Input
                        type="number"
                        value={plan.pagoDiferadoDias}
                        onChange={(e) => updatePlan(planId, { pagoDiferadoDias: parseInt(e.target.value) || 0 })}
                        className="h-8 text-sm"
                        disabled={!!previewOnly}
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Días que MP retiene el pago antes de liberar al transportista.</p>
                    </div>
                  </div>
                </div>

                {/* Límites */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Límites</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Máx vehículos (0 = ilimitado)</Label>
                      <Input
                        type="number"
                        value={plan.maxVehiculos}
                        onChange={(e) => updatePlan(planId, { maxVehiculos: parseInt(e.target.value) || 0 })}
                        className="h-8 text-sm"
                        disabled={!!previewOnly}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Máx choferes (0 = ilimitado)</Label>
                      <Input
                        type="number"
                        value={plan.maxChoferes}
                        onChange={(e) => updatePlan(planId, { maxChoferes: parseInt(e.target.value) || 0 })}
                        className="h-8 text-sm"
                        disabled={!!previewOnly}
                      />
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Features visibles</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {ALL_FEATURES.map(({ key, label, description }) => (
                      <div
                        key={String(key)}
                        className="flex items-center justify-between rounded-md border border-border p-2"
                      >
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
