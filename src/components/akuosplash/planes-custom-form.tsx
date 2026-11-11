"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Plus, Trash2, Pencil, Save, X, Gift, Sparkles, Crown,
} from "lucide-react";
import { toast } from "sonner";
import { akuoGet, akuoPost, akuoApi, akuoDelete, formatCLP } from "@/components/akuosplash/akuosplash-utils";

interface CustomPlan {
  id: string;
  nombre: string;
  descripcion: string;
  orden: number;
  activa: boolean;
  activo: boolean;
  precioMensual: number;
  precioAnual: number;
  precioSemanal: number;
  precioDiario: number;
  comisionPct: number;
  vehiculosPermitidos: number;
  choferesPermitidos: number;
  mpSplitMode: string;
  ciclosDisponibles: string[];
  feeManualFijo: number;
  feeManualPct: number;
  features: Record<string, boolean>;
}

const ALL_FEATURES: Array<{ key: string; label: string; description: string }> = [
  { key: "dashboard", label: "Panel y métricas", description: "Resumen del día" },
  { key: "entregas", label: "Entregas activas", description: "Vueltas activas" },
  { key: "historial", label: "Historial de vueltas", description: "Historial completo" },
  { key: "gastos", label: "Gastos operativos", description: "Registro de gastos" },
  { key: "vehiculo", label: "Gestión de vehículos", description: "Camiones" },
  { key: "clientes", label: "Clientes propios", description: "Gestión de clientes" },
  { key: "recurrentes", label: "Pedidos recurrentes", description: "Recurrencias" },
  { key: "equipo", label: "Choferes / equipo", description: "Gestión de choferes" },
  { key: "liquidacion", label: "Liquidación", description: "Pagos a transportista" },
  { key: "docUpload", label: "Subir documentos", description: "Factura manual" },
  { key: "mpPropio", label: "MP para clientes propios", description: "MP propio" },
  { key: "wasabil", label: "Wasabil (SII)", description: "Facturación automática" },
  { key: "perfil", label: "Perfil", description: "Perfil del transportista" },
  { key: "subscripcion", label: "Tab subscripción", description: "Ver/mejorar plan" },
];

const CICLOS = [
  { id: "diario", label: "Diario" },
  { id: "semanal", label: "Semanal" },
  { id: "mensual", label: "Mensual" },
  { id: "anual", label: "Anual" },
];

const MP_MODES = [
  { id: "split", label: "Split (instantáneo)" },
  { id: "10day", label: "Split 10 días" },
  { id: "none", label: "Sin split" },
];

const EMPTY_PLAN: CustomPlan = {
  id: "",
  nombre: "",
  descripcion: "",
  orden: 99,
  activa: true,
  activo: true,
  precioMensual: 0,
  precioAnual: 0,
  precioSemanal: 0,
  precioDiario: 0,
  comisionPct: 15,
  vehiculosPermitidos: 1,
  choferesPermitidos: 1,
  mpSplitMode: "split",
  ciclosDisponibles: ["mensual"],
  feeManualFijo: 3290,
  feeManualPct: 1.7,
  features: {
    dashboard: true,
    entregas: true,
    historial: false,
    gastos: false,
    vehiculo: false,
    clientes: false,
    recurrentes: false,
    equipo: false,
    liquidacion: false,
    docUpload: false,
    mpPropio: false,
    wasabil: false,
    perfil: true,
    subscripcion: true,
  },
};

export function PlanesCustomForm() {
  const [planes, setPlanes] = useState<CustomPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CustomPlan | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  async function cargar() {
    setLoading(true);
    try {
      const d = await akuoGet<{ planes: CustomPlan[] }>("/api/akuosplash/admin/planes-custom");
      setPlanes(d.planes || []);
    } catch (e: any) {
      toast.error("No se pudieron cargar los planes: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }

  // Cargar al montar
  useEffect(() => {
    cargar();
  }, []);

  function toggleCiclo(ciclo: string) {
    if (!editing) return;
    const ciclos = editing.ciclosDisponibles || [];
    const nuevos = ciclos.includes(ciclo)
      ? ciclos.filter(c => c !== ciclo)
      : [...ciclos, ciclo];
    if (nuevos.length === 0) {
      toast.info("Debe haber al menos un ciclo seleccionado");
      return;
    }
    setEditing({ ...editing, ciclosDisponibles: nuevos });
  }

  function toggleFeature(key: string) {
    if (!editing) return;
    setEditing({
      ...editing,
      features: { ...editing.features, [key]: !editing.features[key] },
    });
  }

  async function guardar() {
    if (!editing) return;
    if (!editing.id?.trim() || !editing.nombre?.trim()) {
      toast.error("ID y nombre son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const body = {
        id: editing.id,
        nombre: editing.nombre,
        descripcion: editing.descripcion,
        orden: editing.orden,
        activo: editing.activa,
        precioMensual: editing.precioMensual,
        precioAnual: editing.precioAnual,
        precioSemanal: editing.precioSemanal,
        precioDiario: editing.precioDiario,
        comisionPct: editing.comisionPct,
        vehiculosPermitidos: editing.vehiculosPermitidos,
        choferesPermitidos: editing.choferesPermitidos,
        mpSplitMode: editing.mpSplitMode,
        ciclosDisponibles: editing.ciclosDisponibles,
        features: editing.features,
      };
      if (isNew) {
        await akuoPost("/api/akuosplash/admin/planes-custom", body);
        toast.success(`Plan "${editing.nombre}" creado`);
      } else {
        await akuoApi(`/api/akuosplash/admin/planes-custom?id=${encodeURIComponent(editing.id)}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toast.success(`Plan "${editing.nombre}" actualizado`);
      }
      setEditing(null);
      setIsNew(false);
      cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(id: string, nombre: string) {
    if (!confirm(`¿Eliminar el plan "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await akuoDelete(`/api/akuosplash/admin/planes-custom?id=${encodeURIComponent(id)}`);
      toast.success("Plan eliminado");
      cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar");
    }
  }

  function nuevoPlan() {
    setEditing({ ...EMPTY_PLAN, ciclosDisponibles: ["mensual"], features: { ...EMPTY_PLAN.features } });
    setIsNew(true);
  }

  function editarPlan(p: CustomPlan) {
    setEditing({ ...p, features: { ...p.features }, ciclosDisponibles: [...p.ciclosDisponibles] });
    setIsNew(false);
  }

  function cancelar() {
    setEditing(null);
    setIsNew(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-primary" /> Planes personalizados
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Creá planes custom con precios por día, semana, mes o año. Los planes que crees acá
                aparecen automáticamente en la pestaña de subscripción del transportista.
              </p>
            </div>
            {!editing && (
              <Button size="sm" onClick={nuevoPlan}>
                <Plus className="h-3 w-3 mr-1" /> Crear plan
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Formulario de creación/edición */}
      {editing && (
        <Card className="border-blue-300">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                {isNew ? "Crear nuevo plan" : `Editando: ${editing.nombre}`}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={cancelar}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ID + Nombre */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">ID del plan (único, sin espacios)</Label>
                <Input
                  type="text"
                  value={editing.id}
                  onChange={(e) => setEditing({ ...editing, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                  placeholder="ej: test, pro_plus, diario_500"
                  disabled={!isNew || saving}
                  className="h-8 text-sm"
                />
                {!isNew && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">El ID no se puede cambiar después de crear.</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Nombre visible</Label>
                <Input
                  type="text"
                  value={editing.nombre}
                  onChange={(e) => setEditing({ ...editing, nombre: e.target.value })}
                  placeholder="ej: Plan Test, Plan Diario $500"
                  disabled={saving}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Descripción */}
            <div>
              <Label className="text-xs">Descripción</Label>
              <Input
                type="text"
                value={editing.descripcion}
                onChange={(e) => setEditing({ ...editing, descripcion: e.target.value })}
                placeholder="Descripción corta del plan"
                disabled={saving}
                className="h-8 text-sm"
              />
            </div>

            {/* Precios por ciclo */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Precios por ciclo (CLP)</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Precio diario</Label>
                  <Input
                    type="number"
                    value={editing.precioDiario}
                    onChange={(e) => setEditing({ ...editing, precioDiario: parseFloat(e.target.value) || 0 })}
                    disabled={saving}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Precio semanal</Label>
                  <Input
                    type="number"
                    value={editing.precioSemanal}
                    onChange={(e) => setEditing({ ...editing, precioSemanal: parseFloat(e.target.value) || 0 })}
                    disabled={saving}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Precio mensual</Label>
                  <Input
                    type="number"
                    value={editing.precioMensual}
                    onChange={(e) => setEditing({ ...editing, precioMensual: parseFloat(e.target.value) || 0 })}
                    disabled={saving}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Precio anual</Label>
                  <Input
                    type="number"
                    value={editing.precioAnual}
                    onChange={(e) => setEditing({ ...editing, precioAnual: parseFloat(e.target.value) || 0 })}
                    disabled={saving}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Períodos de cobro disponibles */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Períodos de cobro disponibles
              </p>
              <p className="text-[10px] text-muted-foreground mb-2">
                Seleccioná qué ciclos puede elegir el transportista al subscribirse. Solo se ofrecen los ciclos cuyo precio es &gt; 0.
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {CICLOS.map(c => {
                  const isChecked = editing.ciclosDisponibles.includes(c.id);
                  const precio = c.id === "diario" ? editing.precioDiario :
                                 c.id === "semanal" ? editing.precioSemanal :
                                 c.id === "anual" ? editing.precioAnual : editing.precioMensual;
                  const precioValido = precio > 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCiclo(c.id)}
                      disabled={saving || (!precioValido && !isChecked)}
                      className={`rounded-md border p-2 text-center transition ${
                        isChecked ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                      } ${(!precioValido && !isChecked) ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      <p className="text-xs font-medium">{c.label}</p>
                      {precioValido && (
                        <p className="text-[10px] text-muted-foreground">{formatCLP(precio)}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vehículos / Choferes / Comisión */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Límites y comisión</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Vehículos permitidos</Label>
                  <Input
                    type="number"
                    value={editing.vehiculosPermitidos}
                    onChange={(e) => setEditing({ ...editing, vehiculosPermitidos: parseInt(e.target.value) || 0 })}
                    disabled={saving}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Choferes permitidos</Label>
                  <Input
                    type="number"
                    value={editing.choferesPermitidos}
                    onChange={(e) => setEditing({ ...editing, choferesPermitidos: parseInt(e.target.value) || 0 })}
                    disabled={saving}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Comisión (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editing.comisionPct}
                    onChange={(e) => setEditing({ ...editing, comisionPct: parseFloat(e.target.value) || 0 })}
                    disabled={saving}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Modo MP</Label>
                  <select
                    value={editing.mpSplitMode}
                    onChange={(e) => setEditing({ ...editing, mpSplitMode: e.target.value })}
                    disabled={saving}
                    className="h-8 w-full text-sm rounded-md border border-input px-2"
                  >
                    {MP_MODES.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ¿Qué incluye el plan? */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                ¿Qué incluye el plan?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {ALL_FEATURES.map(({ key, label, description }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-md border border-border p-2 cursor-pointer hover:bg-muted/30"
                    onClick={() => toggleFeature(key)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{description}</p>
                    </div>
                    <Switch checked={!!editing.features[key]} disabled={saving} />
                  </div>
                ))}
              </div>
            </div>

            {/* Activo toggle */}
            <div className="flex items-center justify-between rounded-md border border-border p-2">
              <div>
                <p className="text-sm font-medium">Plan activo</p>
                <p className="text-[10px] text-muted-foreground">Si está inactivo, no aparece en la pestaña de subscripción.</p>
              </div>
              <Switch
                checked={editing.activa}
                onCheckedChange={(v) => setEditing({ ...editing, activa: v, activo: v })}
                disabled={saving}
              />
            </div>

            {/* Botones */}
            <div className="flex gap-2 pt-2">
              <Button onClick={guardar} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                {isNew ? "Crear plan" : "Guardar cambios"}
              </Button>
              <Button variant="outline" onClick={cancelar} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de planes existentes */}
      {!editing && planes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Planes existentes</p>
          {planes.map(p => {
            const preciosTexto = [
              p.precioDiario > 0 && `${formatCLP(p.precioDiario)}/día`,
              p.precioSemanal > 0 && `${formatCLP(p.precioSemanal)}/sem`,
              p.precioMensual > 0 && `${formatCLP(p.precioMensual)}/mes`,
              p.precioAnual > 0 && `${formatCLP(p.precioAnual)}/año`,
            ].filter(Boolean).join(" · ");
            const isBase = ["gratis", "premium", "pro"].includes(p.id);
            return (
              <Card key={p.id} className={!p.activa ? "opacity-60" : ""}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{p.nombre}</p>
                        <Badge variant="outline" className="text-[10px]">{p.id}</Badge>
                        <Badge variant="outline" className="text-[10px]">{p.comisionPct}% comisión</Badge>
                        {p.ciclosDisponibles.map(c => (
                          <Badge key={c} variant="secondary" className="text-[10px] capitalize">{c}</Badge>
                        ))}
                        {!p.activa && <Badge variant="destructive" className="text-[10px]">Inactivo</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {preciosTexto || "Sin precios configurados"}
                        {" · "}
                        {p.vehiculosPermitidos} vehículo(s) · {p.choferesPermitidos} chofer(es)
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => editarPlan(p)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {!isBase && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => eliminar(p.id, p.nombre)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!editing && planes.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <Plus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Todavía no hay planes personalizados. Hacé clic en "Crear plan" para definir el primero.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
