"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calculator, Save, RefreshCw, MapPin, AlertTriangle, Play } from "lucide-react";
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

      {/* Depot de la plataforma */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" /> Depot de la plataforma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Punto de referencia (galpón central de la plataforma) usado para calcular la distancia a cada cliente con Haversine.
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
        </CardContent>
      </Card>

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
          {reglas.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.tipo.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Prioridad {r.prioridad} · {descripcionCorta(r)}
                </p>
              </div>
              <Switch checked={r.enabled} onCheckedChange={() => toggleRegla(r.id)} />
            </div>
          ))}
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
