"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calculator, Save, RefreshCw, MapPin, AlertTriangle, Play, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { akuoGet, akuoPost, akuoPut, formatCLP } from "@/components/akuosplash/akuosplash-utils";
import type { ReglaPrecio, PrecioResultado, TipoMetodoPago, TipoUrgencia } from "@/lib/precio-dinamico";

interface DepotInfo {
  depotLat: number | null;
  depotLng: number | null;
  depotNombre: string | null;
}

interface ReglasResponse {
  reglas: ReglaPrecio[];
  precioDinamicoHabilitado: boolean;
  defaults: ReglaPrecio[];
}

export function PrecioDinamicoTab() {
  const [reglas, setReglas] = useState<ReglaPrecio[]>([]);
  const [defaults, setDefaults] = useState<ReglaPrecio[]>([]);
  const [habilitado, setHabilitado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [depot, setDepot] = useState<DepotInfo>({ depotLat: null, depotLng: null, depotNombre: null });
  const [depotLat, setDepotLat] = useState("");
  const [depotLng, setDepotLng] = useState("");
  const [depotNombre, setDepotNombre] = useState("");
  const [depotSaving, setDepotSaving] = useState(false);

  // Vista previa
  const [preview, setPreview] = useState<{ resultado: PrecioResultado; input: any } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLitros, setPreviewLitros] = useState("5000");
  const [previewMetodo, setPreviewMetodo] = useState<TipoMetodoPago>("efectivo");
  const [previewUrgencia, setPreviewUrgencia] = useState<TipoUrgencia>("standard");
  const [previewZonaPrecio, setPreviewZonaPrecio] = useState("250");
  const [previewDistancia, setPreviewDistancia] = useState(""); // km (para override de cálculo)
  const [previewClienteLat, setPreviewClienteLat] = useState("");
  const [previewClienteLng, setPreviewClienteLng] = useState("");
  const [expandedReglaId, setExpandedReglaId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [reglasRes, depotRes] = await Promise.all([
        akuoGet<ReglasResponse>("/api/akuosplash/precio/reglas"),
        akuoGet<DepotInfo>("/api/akuosplash/precio/depot"),
      ]);
      setReglas(reglasRes.reglas);
      setDefaults(reglasRes.defaults);
      setHabilitado(reglasRes.precioDinamicoHabilitado);
      setDepot(depotRes);
      setDepotLat(depotRes.depotLat?.toString() || "");
      setDepotLng(depotRes.depotLng?.toString() || "");
      setDepotNombre(depotRes.depotNombre || "");
    } catch (e: any) {
      toast.error("No se pudo cargar config: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardarReglas() {
    setSaving(true);
    try {
      await akuoPut("/api/akuosplash/precio/reglas", {
        reglas,
        precioDinamicoHabilitado: habilitado,
      });
      toast.success("Reglas guardadas");
    } catch (e: any) {
      toast.error("No se pudo guardar: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  async function guardarDepot() {
    setDepotSaving(true);
    try {
      const lat = parseFloat(depotLat);
      const lng = parseFloat(depotLng);
      if (isNaN(lat) || isNaN(lng)) {
        toast.error("Lat/lng inválidas");
        return;
      }
      await akuoPut("/api/akuosplash/precio/depot", {
        lat,
        lng,
        nombre: depotNombre || null,
      });
      toast.success("Depot guardado");
      setDepot({ depotLat: lat, depotLng: lng, depotNombre });
    } catch (e: any) {
      toast.error("No se pudo guardar depot: " + (e?.message || ""));
    } finally {
      setDepotSaving(false);
    }
  }

  function toggleRegla(id: string) {
    setReglas((rs) => rs.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }

  function resetDefaults() {
    setReglas(defaults);
    toast.info("Reglas reseteadas a defaults");
  }

  async function runPreview() {
    setPreviewLoading(true);
    try {
      const body: any = {
        litros: Number(previewLitros) || 5000,
        metodoPago: previewMetodo,
        urgencia: previewUrgencia,
        horario: new Date().toISOString(),
        zonaPrecioBase: Number(previewZonaPrecio) || 250,
        clienteLat: previewClienteLat ? Number(previewClienteLat) : null,
        clienteLng: previewClienteLng ? Number(previewClienteLng) : null,
        clienteDeuda: 0,
        clienteAntiguedadMeses: 0,
      };
      const res = await akuoPost<{ resultado: PrecioResultado; input: any }>("/api/akuosplash/precio/preview", body);
      setPreview(res);
    } catch (e: any) {
      toast.error("Error en preview: " + (e?.message || ""));
    } finally {
      setPreviewLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toggle master */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium flex items-center gap-1.5">
                <Calculator className="h-4 w-4 text-primary" /> Precio dinámico del marketplace
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Cuando está activado, los pedidos del marketplace se calculan con el motor de reglas dinámicas. Los clientes ven el total, los repartidores ven su ganancia. Cuando está desactivado, se usa el precio estático de la zona.
              </p>
            </div>
            <Switch
              checked={habilitado}
              onCheckedChange={setHabilitado}
            />
          </div>
        </CardContent>
      </Card>

      {/* Depot de la plataforma — opcional, solo se usa si la regla "distancia" está activa */}
      <details className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
        <summary className="cursor-pointer text-sm font-medium flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
          <MapPin className="h-4 w-4" /> Depot de la plataforma (opcional — no usado por defecto)
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Este depot solo se usa si activás la regla <strong>distancia</strong> (que está desactivada por defecto). Las principales reglas del marketplace son: precio base por zona, disponibilidad en la zona, demanda/oferta, cantidad, urgencia y horario.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="depotLat" className="text-xs">Latitud</Label>
              <Input id="depotLat" value={depotLat} onChange={(e) => setDepotLat(e.target.value)} placeholder="-33.4489" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="depotLng" className="text-xs">Longitud</Label>
              <Input id="depotLng" value={depotLng} onChange={(e) => setDepotLng(e.target.value)} placeholder="-70.6693" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="depotNombre" className="text-xs">Nombre (opcional)</Label>
              <Input id="depotNombre" value={depotNombre} onChange={(e) => setDepotNombre(e.target.value)} placeholder="Galpón Maipú" className="h-8 text-sm" />
            </div>
          </div>
          <Button onClick={guardarDepot} disabled={depotSaving} size="sm">
            {depotSaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
            Guardar depot
          </Button>
        </div>
      </details>

      {/* Reglas activas */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Calculator className="h-4 w-4 text-primary" /> Reglas activas ({reglas.filter(r => r.enabled).length}/{reglas.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={resetDefaults}>
              <RefreshCw className="h-3 w-3 mr-1" /> Reset a defaults
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {reglas.map((r) => {
            const isExpanded = expandedReglaId === r.id;
            return (
              <div key={r.id} className="rounded-md border border-border overflow-hidden">
                <div className="flex items-center justify-between p-2.5">
                  <button
                    type="button"
                    onClick={() => setExpandedReglaId(isExpanded ? null : r.id)}
                    className="flex flex-1 items-center gap-2 text-left min-w-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        {r.tipo.replace(/_/g, " ")}
                        {!r.enabled && (
                          <Badge variant="secondary" className="text-[10px]">desactivada</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Prioridad {r.prioridad} · {descripcionCorta(r)}
                      </p>
                    </div>
                  </button>
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={() => toggleRegla(r.id)}
                    onClick={(e: any) => e.stopPropagation()}
                  />
                </div>
                {isExpanded && (
                  <div className="border-t border-border bg-muted/30 p-3">
                    <ReglaEditor
                      regla={r}
                      onChange={(parametros) => {
                        setReglas((rs) => rs.map((rr) => rr.id === r.id ? { ...rr, parametros } : rr));
                      }}
                      onPrioridadChange={(prioridad) => {
                        setReglas((rs) => rs.map((rr) => rr.id === r.id ? { ...rr, prioridad } : rr));
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <Button onClick={guardarReglas} disabled={saving} className="w-full mt-2">
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Guardar reglas
          </Button>
        </CardContent>
      </Card>

      {/* Vista previa */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Play className="h-4 w-4 text-primary" /> Vista previa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Simulá un pedido hipotético para ver cómo se calcula el precio con las reglas actuales.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="previewLitros" className="text-xs">Litros</Label>
              <Input id="previewLitros" type="number" value={previewLitros} onChange={(e) => setPreviewLitros(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="previewZonaPrecio" className="text-xs">Precio base zona ($/L)</Label>
              <Input id="previewZonaPrecio" type="number" value={previewZonaPrecio} onChange={(e) => setPreviewZonaPrecio(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Método de pago</Label>
              <select
                value={previewMetodo}
                onChange={(e) => setPreviewMetodo(e.target.value as TipoMetodoPago)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="credito">Crédito</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Urgencia</Label>
              <select
                value={previewUrgencia}
                onChange={(e) => setPreviewUrgencia(e.target.value as TipoUrgencia)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="standard">Standard</option>
                <option value="express">Express (+15%)</option>
                <option value="emergency">Emergency (+30%)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="previewClienteLat" className="text-xs">Cliente lat (opcional)</Label>
              <Input id="previewClienteLat" type="number" value={previewClienteLat} onChange={(e) => setPreviewClienteLat(e.target.value)} placeholder="-33.45" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="previewClienteLng" className="text-xs">Cliente lng (opcional)</Label>
              <Input id="previewClienteLng" type="number" value={previewClienteLng} onChange={(e) => setPreviewClienteLng(e.target.value)} placeholder="-70.66" className="h-8 text-sm" />
            </div>
          </div>
          <Button onClick={runPreview} disabled={previewLoading} size="sm">
            {previewLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
            Calcular
          </Button>

          {preview && (
            <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-medium">Resultado</span>
                <Badge variant={preview.resultado.floorAplicado ? "default" : "secondary"}>
                  {preview.resultado.floorAplicado ? "Floor aplicado" : "Sin floor"}
                </Badge>
              </div>
              <div className="space-y-1 text-xs font-mono">
                {preview.resultado.breakdown.map((b, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {b.signo === "+" ? "" : "-"}{b.concepto}
                    </span>
                    <span className="tabular-nums">
                      {b.signo}{formatCLP(b.monto)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-2 space-y-1 text-sm">
                <div className="flex justify-between font-medium">
                  <span>Total (neto sin IVA)</span>
                  <span className="tabular-nums text-primary">{formatCLP(preview.resultado.total)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Precio por litro</span>
                  <span className="tabular-nums">${preview.resultado.precioPorLitroFinal.toFixed(0)}/L</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>IVA 19%</span>
                  <span className="tabular-nums">{formatCLP(preview.resultado.iva)}</span>
                </div>
                <div className="flex justify-between font-medium border-t border-border pt-1">
                  <span>Total con IVA (paga cliente)</span>
                  <span className="tabular-nums text-emerald-600">{formatCLP(preview.resultado.totalConIva)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground border-t border-border pt-1">
                  <span>Comisión plataforma</span>
                  <span className="tabular-nums">{formatCLP(preview.resultado.comision)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Ganancia repartidor</span>
                  <span className="tabular-nums text-blue-600">{formatCLP(preview.resultado.gananciaRepartidor)}</span>
                </div>
              </div>
              {preview.resultado.advertencias.length > 0 && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
                  {preview.resultado.advertencias.map((w, i) => (
                    <p key={i} className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Migración */}
      <Card>
        <CardContent className="p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Migración pendiente</p>
          Si las reglas no cargan o ves errores en el cálculo, abrí esta URL logueado como superadmin para migrar las columnas nuevas:
          <code className="block mt-1 rounded bg-muted/40 p-2 text-[10px]">POST /api/akuosplash/admin/migrate-precio-dinamico</code>
        </CardContent>
      </Card>
    </div>
  );
}

function descripcionCorta(r: ReglaPrecio): string {
  try {
    const p = r.parametros;
    switch (r.tipo) {
      case "volumen":
        const escalones = p.escalones || [];
        return escalones.map((e: any) => `≥${e.min}L -${e.descuentoPct}%`).join(", ");
      case "metodo_pago":
        return `ef:${p.efectivo}%, trans:${p.transferencia}%, cré:${p.credito}%, tarj:${p.tarjeta}%`;
      case "urgencia":
        return `std:+${p.standard}%, exp:+${p.express}%, emr:+${p.emergency}%`;
      case "horario":
        return `valle ${p.valle?.ajuste}%, peak ${p.peak?.ajuste}%, noche ${p.noche?.ajuste}%`;
      case "dia_semana":
        return `sáb +${p.sabado}%, dom +${p.domingo}%`;
      case "distancia":
        return `radio base ${p.radioBaseKm} km, +$${p.costoPorKmExtra}/km extra`;
      case "historial_pago":
        return `moroso +${p.moroso}% si deuda > $${p.umbralDeuda}`;
      case "frecuencia":
        return `premium -${Math.abs(p.ajuste)}% si antigüedad ≥ ${p.premium_meses_min} meses`;
      case "disponibilidad_zona": {
        const umbrales = p.umbrales || [];
        return umbrales.map((u: any) =>
          `${u.minRepartidores === u.maxRepartidores ? u.minRepartidores : `${u.minRepartidores}-${u.maxRepartidores}`} rep: ${u.ajustePct > 0 ? "+" : ""}${u.ajustePct}%`
        ).join(", ");
      }
      case "demanda_oferta":
        return `surge si ratio D/O > ${p.umbral_ratio} (cap +${p.max_ajuste_pct}%) — sin oferta: surge máx`;
      case "demanda":
        return `surge +${p.ajuste_pct}% si > ${p.umbral_pedidos_hora} ped/hora`;
      case "clima":
        return `+${p.ajuste_pct}% si temp > ${p.temp_threshold_c}°C`;
      case "capacidad":
        return `+${p.ajuste_pct}% si camión > ${p.umbral_pct}% lleno`;
      default:
        return JSON.stringify(p).slice(0, 80);
    }
  } catch {
    return "(sin params)";
  }
}

/* ──────────────────────────────────────────────────────────────────── */
/* Editor de parámetros por regla — totalmente editable desde la UI    */
/* ──────────────────────────────────────────────────────────────────── */

interface ReglaEditorProps {
  regla: ReglaPrecio;
  onChange: (parametros: any) => void;
  onPrioridadChange: (prioridad: number) => void;
}

function ReglaEditor({ regla, onChange, onPrioridadChange }: ReglaEditorProps) {
  const p = regla.parametros || {};

  // Helpers genéricos para editar campos
  const setField = (field: string, value: any) => {
    onChange({ ...p, [field]: value });
  };
  const setNested = (parent: string, field: string, value: any) => {
    onChange({ ...p, [parent]: { ...(p[parent] || {}), [field]: value } });
  };

  // Input numérico reutilizable (acepta negativos y decimales)
  const NumInput = ({
    label,
    value,
    onChange,
    placeholder,
    suffix,
    step = "any",
  }: {
    label: string;
    value: number | undefined;
    onChange: (v: number) => void;
    placeholder?: string;
    suffix?: string;
    step?: string;
  }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          step={step}
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || v === "-") onChange(0);
            else onChange(parseFloat(v) || 0);
          }}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
        {suffix && <span className="text-xs text-muted-foreground shrink-0">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Prioridad de aplicación — común a todas las reglas */}
      <div className="rounded-md bg-primary/5 border border-primary/20 p-2">
        <p className="text-[10px] text-muted-foreground mb-1 uppercase font-medium tracking-wide">Orden de aplicación</p>
        <p className="text-xs text-muted-foreground">
          Las reglas con prioridad menor se aplican primero. Cambiala si querés que esta regla impacte antes o después que las demás sobre el subtotal acumulado.
        </p>
        <div className="mt-2 w-32">
          <Input
            type="number"
            value={regla.prioridad}
            onChange={(e) => onPrioridadChange(parseInt(e.target.value) || 0)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Editor específico por tipo */}
      {regla.tipo === "volumen" && <VolumenEditor p={p} onChange={onChange} NumInput={NumInput} />}
      {regla.tipo === "metodo_pago" && (
        <div className="grid grid-cols-2 gap-2">
          <NumInput label="Efectivo (%)" value={p.efectivo} onChange={(v) => setField("efectivo", v)} placeholder="-2" suffix="%" />
          <NumInput label="Transferencia (%)" value={p.transferencia} onChange={(v) => setField("transferencia", v)} placeholder="0" suffix="%" />
          <NumInput label="Crédito (%)" value={p.credito} onChange={(v) => setField("credito", v)} placeholder="3" suffix="%" />
          <NumInput label="Tarjeta (%)" value={p.tarjeta} onChange={(v) => setField("tarjeta", v)} placeholder="2" suffix="%" />
        </div>
      )}
      {regla.tipo === "urgencia" && (
        <div className="grid grid-cols-3 gap-2">
          <NumInput label="Standard (%)" value={p.standard} onChange={(v) => setField("standard", v)} placeholder="0" suffix="%" />
          <NumInput label="Express (%)" value={p.express} onChange={(v) => setField("express", v)} placeholder="15" suffix="%" />
          <NumInput label="Emergency (%)" value={p.emergency} onChange={(v) => setField("emergency", v)} placeholder="30" suffix="%" />
        </div>
      )}
      {regla.tipo === "horario" && (
        <div className="space-y-2">
          {["valle", "peak", "noche"].map((slot) => (
            <div key={slot} className="rounded-md border border-border p-2 space-y-2">
              <p className="text-xs font-medium capitalize">{slot}</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Desde (HH:MM)</Label>
                  <Input
                    type="time"
                    value={p[slot]?.desde || ""}
                    onChange={(e) => setNested(slot, "desde", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hasta (HH:MM)</Label>
                  <Input
                    type="time"
                    value={p[slot]?.hasta || ""}
                    onChange={(e) => setNested(slot, "hasta", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <NumInput
                  label="Ajuste (%)"
                  value={p[slot]?.ajuste}
                  onChange={(v) => setNested(slot, "ajuste", v)}
                  placeholder="0"
                  suffix="%"
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {regla.tipo === "dia_semana" && (
        <div className="grid grid-cols-2 gap-2">
          <NumInput label="Sábado (%)" value={p.sabado} onChange={(v) => setField("sabado", v)} placeholder="5" suffix="%" />
          <NumInput label="Domingo (%)" value={p.domingo} onChange={(v) => setField("domingo", v)} placeholder="5" suffix="%" />
        </div>
      )}
      {regla.tipo === "distancia" && (
        <div className="grid grid-cols-2 gap-2">
          <NumInput label="Radio base (km)" value={p.radioBaseKm} onChange={(v) => setField("radioBaseKm", v)} placeholder="5" suffix="km" />
          <NumInput label="Costo por km extra ($)" value={p.costoPorKmExtra} onChange={(v) => setField("costoPorKmExtra", v)} placeholder="50" suffix="$" />
        </div>
      )}
      {regla.tipo === "historial_pago" && (
        <div className="grid grid-cols-2 gap-2">
          <NumInput label="Surcharge moroso (%)" value={p.moroso} onChange={(v) => setField("moroso", v)} placeholder="15" suffix="%" />
          <NumInput label="Umbral deuda ($)" value={p.umbralDeuda} onChange={(v) => setField("umbralDeuda", v)} placeholder="50000" suffix="$" />
        </div>
      )}
      {regla.tipo === "frecuencia" && (
        <div className="grid grid-cols-2 gap-2">
          <NumInput label="Antigüedad mínima (meses)" value={p.premium_meses_min} onChange={(v) => setField("premium_meses_min", v)} placeholder="24" suffix="meses" />
          <NumInput label="Descuento (%)" value={p.ajuste} onChange={(v) => setField("ajuste", v)} placeholder="-2" suffix="%" />
        </div>
      )}
      {regla.tipo === "disponibilidad_zona" && <DisponibilidadEditor p={p} onChange={onChange} NumInput={NumInput} />}
      {regla.tipo === "demanda_oferta" && (
        <div className="grid grid-cols-3 gap-2">
          <NumInput label="Umbral ratio (D/O)" value={p.umbral_ratio} onChange={(v) => setField("umbral_ratio", v)} placeholder="1.5" step="0.1" />
          <NumInput label="Ajuste base (%)" value={p.ajuste_pct_base} onChange={(v) => setField("ajuste_pct_base", v)} placeholder="10" suffix="%" />
          <NumInput label="Ajuste máx (%)" value={p.max_ajuste_pct} onChange={(v) => setField("max_ajuste_pct", v)} placeholder="25" suffix="%" />
        </div>
      )}
      {regla.tipo === "demanda" && (
        <div className="grid grid-cols-3 gap-2">
          <NumInput label="Umbral pedidos/hora" value={p.umbral_pedidos_hora} onChange={(v) => setField("umbral_pedidos_hora", v)} placeholder="10" />
          <NumInput label="Ajuste (%)" value={p.ajuste_pct} onChange={(v) => setField("ajuste_pct", v)} placeholder="15" suffix="%" />
          <NumInput label="Ajuste máx (%)" value={p.max_ajuste_pct} onChange={(v) => setField("max_ajuste_pct", v)} placeholder="20" suffix="%" />
        </div>
      )}
      {regla.tipo === "clima" && (
        <div className="grid grid-cols-3 gap-2">
          <NumInput label="Temp umbral (°C)" value={p.temp_threshold_c} onChange={(v) => setField("temp_threshold_c", v)} placeholder="30" suffix="°C" />
          <NumInput label="Días consecutivos" value={p.dias_consecutivos} onChange={(v) => setField("dias_consecutivos", v)} placeholder="3" step="1" />
          <NumInput label="Ajuste (%)" value={p.ajuste_pct} onChange={(v) => setField("ajuste_pct", v)} placeholder="5" suffix="%" />
        </div>
      )}
      {regla.tipo === "capacidad" && (
        <div className="grid grid-cols-2 gap-2">
          <NumInput label="Umbral capacidad (%)" value={p.umbral_pct} onChange={(v) => setField("umbral_pct", v)} placeholder="90" suffix="%" />
          <NumInput label="Ajuste (%)" value={p.ajuste_pct} onChange={(v) => setField("ajuste_pct", v)} placeholder="5" suffix="%" />
        </div>
      )}

      <div className="text-[10px] text-muted-foreground italic">
        Los cambios se guardan en memoria. Tocá "Guardar reglas" al final de la lista para persistirlos en el servidor.
      </div>
    </div>
  );
}

// Editor para "volumen" con escalones dinámicos
function VolumenEditor({
  p,
  onChange,
  NumInput,
}: {
  p: any;
  onChange: (parametros: any) => void;
  NumInput: any;
}) {
  const escalones = p.escalones || [];

  const addEscalon = () => {
    onChange({ ...p, escalones: [...escalones, { min: 5000, descuentoPct: 5 }] });
  };
  const removeEscalon = (idx: number) => {
    onChange({ ...p, escalones: escalones.filter((_: any, i: number) => i !== idx) });
  };
  const updateEscalon = (idx: number, field: string, value: number) => {
    const nuevos = escalones.map((e: any, i: number) => i === idx ? { ...e, [field]: value } : e);
    onChange({ ...p, escalones: nuevos });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Descuento por cantidad. Cuando los litros ≥ el mínimo de un escalón, se aplica el descuento del escalón más alto aplicable.
      </p>
      {escalones.map((e: any, idx: number) => (
        <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <NumInput
            label={idx === 0 ? "Mínimo (litros)" : ""}
            value={e.min}
            onChange={(v) => updateEscalon(idx, "min", v)}
            placeholder="5000"
            suffix="L"
          />
          <NumInput
            label={idx === 0 ? "Descuento (%)" : ""}
            value={e.descuentoPct}
            onChange={(v) => updateEscalon(idx, "descuentoPct", v)}
            placeholder="3"
            suffix="%"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeEscalon(idx)}
            className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addEscalon} className="w-full">
        <Plus className="mr-1 h-3 w-3" /> Agregar escalón
      </Button>
    </div>
  );
}

// Editor para "disponibilidad_zona" con umbrales dinámicos
function DisponibilidadEditor({
  p,
  onChange,
  NumInput,
}: {
  p: any;
  onChange: (parametros: any) => void;
  NumInput: any;
}) {
  const umbrales = p.umbrales || [];

  const addUmbral = () => {
    onChange({ ...p, umbrales: [...umbrales, { minRepartidores: 0, maxRepartidores: 0, ajustePct: 0 }] });
  };
  const removeUmbral = (idx: number) => {
    onChange({ ...p, umbrales: umbrales.filter((_: any, i: number) => i !== idx) });
  };
  const updateUmbral = (idx: number, field: string, value: number) => {
    const nuevos = umbrales.map((u: any, i: number) => i === idx ? { ...u, [field]: value } : u);
    onChange({ ...p, umbrales: nuevos });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Surge o descuento según cuántos repartidores activos hay en la zona del cliente. El primer umbral que aplique (min ≤ N ≤ max) determina el ajuste.
      </p>
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[10px] font-medium uppercase text-muted-foreground">
        <span>Min rep</span>
        <span>Max rep</span>
        <span>Ajuste</span>
        <span></span>
      </div>
      {umbrales.map((u: any, idx: number) => (
        <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
          <Input
            type="number"
            value={u.minRepartidores}
            onChange={(e) => updateUmbral(idx, "minRepartidores", parseInt(e.target.value) || 0)}
            placeholder="0"
            className="h-8 text-sm"
          />
          <Input
            type="number"
            value={u.maxRepartidores}
            onChange={(e) => updateUmbral(idx, "maxRepartidores", parseInt(e.target.value) || 0)}
            placeholder="0"
            className="h-8 text-sm"
          />
          <Input
            type="number"
            step="any"
            value={u.ajustePct}
            onChange={(e) => updateUmbral(idx, "ajustePct", parseFloat(e.target.value) || 0)}
            placeholder="20"
            className="h-8 text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeUmbral(idx)}
            className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addUmbral} className="w-full">
        <Plus className="mr-1 h-3 w-3" /> Agregar umbral
      </Button>
    </div>
  );
}
