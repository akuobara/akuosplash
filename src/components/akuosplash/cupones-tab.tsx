"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, Plus, Edit2, Trash2, Tag, Ticket } from "lucide-react";
import { toast } from "sonner";
import { akuoGet, akuoApi, akuoPost, akuoPut, formatCLP } from "@/components/akuosplash/akuosplash-utils";

interface Cupon {
  id: string;
  codigo: string;
  tipo: string;
  descuentoTipo: string;
  descuentoValor: number;
  minMonto: number | null;
  planIdAplicable: string | null;
  maxUsos: number;
  usos: number;
  fechaInicio: string;
  fechaFin: string | null;
  activo: boolean;
  creadoPor: string | null;
  nota: string | null;
  descripcionPublica: string | null;
  creadoEn: string;
}

interface CuponForm {
  codigo: string;
  tipo: "venta" | "subscripcion";
  descuentoTipo: "porcentaje" | "monto_fijo" | "meses_gratis";
  descuentoValor: number | "";
  minMonto: number | "";
  planIdAplicable: string;
  maxUsos: number | "";
  fechaInicio: string;
  fechaFin: string;
  nota: string;
  descripcionPublica: string;
}

const FORM_INIT: CuponForm = {
  codigo: "",
  tipo: "subscripcion",
  descuentoTipo: "porcentaje",
  descuentoValor: "",
  minMonto: "",
  planIdAplicable: "",
  maxUsos: "",
  fechaInicio: new Date().toISOString().split("T")[0],
  fechaFin: "",
  nota: "",
  descripcionPublica: "",
};

export function CuponesTab() {
  const [cupones, setCupones] = useState<Cupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CuponForm>(FORM_INIT);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterTipo !== "all" ? `?tipo=${filterTipo}` : "";
      const d = await akuoGet<{ cupones: Cupon[] }>(`/api/akuosplash/admin/cupones${params}`);
      setCupones(d.cupones || []);
    } catch (e: any) {
      toast.error("No se pudo cargar: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }, [filterTipo]);

  useEffect(() => { cargar(); }, [cargar]);

  function update<K extends keyof CuponForm>(k: K, v: CuponForm[K]) {
    setForm({ ...form, [k]: v });
  }

  async function guardar() {
    if (!form.codigo.trim()) { toast.error("Código obligatorio"); return; }
    if (form.descuentoValor === "" || (typeof form.descuentoValor === "number" && form.descuentoValor < 0)) {
      toast.error("Valor de descuento inválido"); return;
    }
    if (!form.fechaInicio) { toast.error("Fecha de inicio obligatoria"); return; }
    setSaving(true);
    try {
      const body: any = {
        codigo: form.codigo,
        tipo: form.tipo,
        descuentoTipo: form.descuentoTipo,
        descuentoValor: Number(form.descuentoValor),
        minMonto: form.minMonto === "" ? null : Number(form.minMonto),
        planIdAplicable: form.planIdAplicable || null,
        maxUsos: form.maxUsos === "" ? 0 : Number(form.maxUsos),
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin || null,
        nota: form.nota || null,
        descripcionPublica: form.descripcionPublica || null,
      };
      if (editingId) {
        await akuoPut(`/api/akuosplash/admin/cupones/${editingId}`, body);
        toast.success("Cupón actualizado");
      } else {
        await akuoPost(`/api/akuosplash/admin/cupones`, body);
        toast.success("Cupón creado");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(FORM_INIT);
      cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  function editar(c: Cupon) {
    setEditingId(c.id);
    setForm({
      codigo: c.codigo,
      tipo: c.tipo as any,
      descuentoTipo: c.descuentoTipo as any,
      descuentoValor: c.descuentoValor,
      minMonto: c.minMonto ?? "",
      planIdAplicable: c.planIdAplicable ?? "",
      maxUsos: c.maxUsos,
      fechaInicio: c.fechaInicio.split("T")[0],
      fechaFin: c.fechaFin ? c.fechaFin.split("T")[0] : "",
      nota: c.nota ?? "",
      descripcionPublica: c.descripcionPublica ?? "",
    });
    setShowForm(true);
  }

  async function toggleActivo(c: Cupon) {
    try {
      await akuoApi(`/api/akuosplash/admin/cupones/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !c.activo }),
      });
      toast.success(`Cupón ${!c.activo ? "activado" : "desactivado"}`);
      cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar");
    }
  }

  async function eliminar(c: Cupon) {
    if (!confirm(`¿Eliminar el cupón ${c.codigo}? (soft delete — marca como inactivo. Para borrar permanente, agregá ?hard=true)`)) return;
    try {
      await akuoApi(`/api/akuosplash/admin/cupones/${c.id}`, { method: "DELETE" });
      toast.success("Cupón eliminado");
      cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar");
    }
  }

  function descuentoLabel(c: Cupon): string {
    if (c.descuentoTipo === "porcentaje") return `${c.descuentoValor}% off`;
    if (c.descuentoTipo === "monto_fijo") return `${formatCLP(c.descuentoValor)} off`;
    if (c.descuentoTipo === "meses_gratis") return `${c.descuentoValor} mes(es) gratis`;
    return "?";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Cupones</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={cargar} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button size="sm" onClick={() => { setForm(FORM_INIT); setEditingId(null); setShowForm(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Nuevo cupón
          </Button>
        </div>
      </div>

      {/* Filtro por tipo */}
      <div>
        <Label className="text-xs">Tipo</Label>
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="h-8 rounded-md border bg-background px-2 text-sm">
          <option value="all">Todos</option>
          <option value="subscripcion">Subscripción</option>
          <option value="venta">Venta (marketplace)</option>
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-2 border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{editingId ? "Editar cupón" : "Crear cupón"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Código *</Label>
                <Input value={form.codigo} onChange={(e) => update("codigo", e.target.value.toUpperCase())} placeholder="Ej: BIENVENIDA50" className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Tipo *</Label>
                <select value={form.tipo} onChange={(e) => update("tipo", e.target.value as any)} className="w-full h-8 rounded-md border bg-background px-2 text-sm">
                  <option value="subscripcion">Subscripción (planes)</option>
                  <option value="venta">Venta (marketplace — pedidos de agua)</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Tipo de descuento *</Label>
                <select value={form.descuentoTipo} onChange={(e) => update("descuentoTipo", e.target.value as any)} className="w-full h-8 rounded-md border bg-background px-2 text-sm">
                  <option value="porcentaje">Porcentaje (%)</option>
                  <option value="monto_fijo">Monto fijo (CLP)</option>
                  <option value="meses_gratis">Meses gratis (solo subscripción)</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Valor *</Label>
                <Input type="number" value={form.descuentoValor} onChange={(e) => update("descuentoValor", e.target.value === "" ? "" : Number(e.target.value))} className="h-8" placeholder="50 (para 50%)" />
              </div>
              <div>
                <Label className="text-xs">Monto mínimo (CLP)</Label>
                <Input type="number" value={form.minMonto} onChange={(e) => update("minMonto", e.target.value === "" ? "" : Number(e.target.value))} className="h-8" placeholder="0 (sin mínimo)" />
              </div>
              <div>
                <Label className="text-xs">Plan aplicable (solo subscripción)</Label>
                <select value={form.planIdAplicable} onChange={(e) => update("planIdAplicable", e.target.value)} className="w-full h-8 rounded-md border bg-background px-2 text-sm">
                  <option value="">Todos los planes</option>
                  <option value="premium">Solo Premium</option>
                  <option value="pro">Solo Pro</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Máximo de usos (0 = ilimitado)</Label>
                <Input type="number" value={form.maxUsos} onChange={(e) => update("maxUsos", e.target.value === "" ? "" : Number(e.target.value))} className="h-8" placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Fecha de inicio *</Label>
                <Input type="date" value={form.fechaInicio} onChange={(e) => update("fechaInicio", e.target.value)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Fecha de fin (vacío = sin vencimiento)</Label>
                <Input type="date" value={form.fechaFin} onChange={(e) => update("fechaFin", e.target.value)} className="h-8" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Descripción pública (visible al usuario)</Label>
                <Input value={form.descripcionPublica} onChange={(e) => update("descripcionPublica", e.target.value)} placeholder="Ej: 50% off por lanzamiento" className="h-8" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Nota interna (solo superadmin)</Label>
                <Input value={form.nota} onChange={(e) => update("nota", e.target.value)} placeholder="Ej: para influencer @juan" className="h-8" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</Button>
              <Button size="sm" onClick={guardar} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                {editingId ? "Guardar cambios" : "Crear cupón"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : cupones.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No hay cupones. Creá el primero con el botón "Nuevo cupón".</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {cupones.map(c => {
            const vigente = (!c.fechaFin || new Date(c.fechaFin) > new Date()) && new Date(c.fechaInicio) <= new Date();
            return (
              <Card key={c.id} className={!c.activo ? "opacity-50" : ""}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-[200px] flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {c.tipo === "subscripcion" ? <Ticket className="h-4 w-4 text-violet-600" /> : <Tag className="h-4 w-4 text-blue-600" />}
                        <p className="font-mono font-bold text-sm uppercase">{c.codigo}</p>
                        <Badge variant="outline" className="text-[10px]">{c.tipo}</Badge>
                        <Badge className={c.activo ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-700"}>
                          {c.activo ? (vigente ? "ACTIVO" : "VENCIDO") : "INACTIVO"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <strong>{descuentoLabel(c)}</strong>
                        {c.minMonto && ` · mínimo ${formatCLP(c.minMonto)}`}
                        {c.planIdAplicable && ` · plan ${c.planIdAplicable}`}
                        {` · ${c.usos}/${c.maxUsos === 0 ? "∞" : c.maxUsos} usos`}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Vigencia: {new Date(c.fechaInicio).toLocaleDateString("es-CL")} → {c.fechaFin ? new Date(c.fechaFin).toLocaleDateString("es-CL") : "sin fin"}
                      </p>
                      {c.descripcionPublica && <p className="text-[11px] mt-0.5">📝 {c.descripcionPublica}</p>}
                      {c.nota && <p className="text-[10px] text-muted-foreground/70 mt-0.5">📝 internal: {c.nota}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => editar(c)}><Edit2 className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleActivo(c)}>
                        {c.activo ? "Desactivar" : "Activar"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => eliminar(c)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
