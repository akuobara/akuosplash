"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, LogOut, Loader2, Plus, Trash2, MapPin, DollarSign, Save } from "lucide-react";
import { akuoGet, akuoPost, akuoApi, formatCLP } from "@/components/akuosplash/akuosplash-utils";
import { toast } from "sonner";

interface Zona { id: string; comuna: string; precioPorLitro: number; }

export default function SuperadminPreciosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [precioDefault, setPrecioDefault] = useState("50");
  const [comision, setComision] = useState("0");
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [nuevaComuna, setNuevaComuna] = useState("");
  const [nuevoPrecio, setNuevoPrecio] = useState("");

  const cargar = useCallback(async () => {
    try {
      const d = await akuoGet<{ config: { precioPorLitroAguaDefault: number; comisionPorcentaje: number }; zonas: Zona[] }>("/api/akuosplash/superadmin/precios");
      setPrecioDefault(String(d.config.precioPorLitroAguaDefault));
      setComision(String(d.config.comisionPorcentaje));
      setZonas(d.zonas);
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    akuoGet<{ user: any }>("/api/akuosplash/auth/me").then(d => {
      if (!d.user) { router.replace("/akuosplash"); return; }
      if (d.user.rol !== "superadmin") { router.replace("/akuosplash/" + d.user.rol); return; }
      cargar();
    });
  }, [router, cargar]);

  async function guardarConfig() {
    setSaving(true);
    try {
      await akuoApi("/api/akuosplash/superadmin/precios", {
        method: "PATCH",
        body: JSON.stringify({
          precioPorLitroAguaDefault: Number(precioDefault),
          comisionPorcentaje: Number(comision),
        }),
      });
      toast.success("Configuración guardada");
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setSaving(false); }
  }

  async function agregarZona() {
    if (!nuevaComuna.trim() || !nuevoPrecio) { toast.error("Indicá comuna y precio"); return; }
    try {
      await akuoPost("/api/akuosplash/superadmin/precios", {
        comuna: nuevaComuna.trim(),
        precioPorLitro: Number(nuevoPrecio),
      });
      toast.success("Zona agregada");
      setNuevaComuna("");
      setNuevoPrecio("");
      cargar();
    } catch (e: any) { toast.error(e.message || "Error"); }
  }

  async function eliminarZona(id: string) {
    if (!confirm("¿Eliminar esta zona?")) return;
    try {
      await akuoApi(`/api/akuosplash/superadmin/precios/${id}`, { method: "DELETE" });
      toast.success("Zona eliminada");
      cargar();
    } catch (e: any) { toast.error(e.message || "Error"); }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <Link href="/akuosplash/superadmin" className="flex items-center gap-2 text-gray-600">
            <ArrowLeft className="h-4 w-4" /><span className="font-bold text-sm">Volver</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }}>
            <LogOut className="mr-1 h-4 w-4" /> Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Precios</h1>
          <p className="text-sm text-gray-500">Configurá el precio por litro de agua</p>
        </div>

        {/* Config default */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Precio default</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Precio por litro (CLP)</Label>
              <Input type="number" min="0" value={precioDefault} onChange={(e) => setPrecioDefault(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Precio por litro si no hay zona específica</p>
            </div>
            <div>
              <Label className="text-xs">Comisión de la app (%)</Label>
              <Input type="number" min="0" max="100" value={comision} onChange={(e) => setComision(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Porcentaje que se cobra encima del subtotal (0 = sin comisión)</p>
            </div>
            <Button onClick={guardarConfig} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Guardar configuración
            </Button>
          </CardContent>
        </Card>

        {/* Zonas específicas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Precios por comuna</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">
              Agregá precios específicos por comuna. Si una comuna no está en la lista, se usa el precio default.
            </p>

            {zonas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">Sin zonas configuradas. Todos los clientes pagan el precio default.</p>
            ) : (
              <div className="space-y-2">
                {zonas.map(z => (
                  <div key={z.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-2.5">
                    <div>
                      <p className="font-medium text-sm">{z.comuna}</p>
                      <p className="text-xs text-gray-500">{formatCLP(z.precioPorLitro)}/L</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => eliminarZona(z.id)} className="text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Agregar nueva zona */}
            <div className="rounded-lg border border-dashed border-gray-300 p-3 space-y-2">
              <p className="text-xs font-medium text-gray-600">Agregar nueva zona</p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Comuna (ej: Vitacura)" value={nuevaComuna} onChange={(e) => setNuevaComuna(e.target.value)} />
                <Input type="number" placeholder="Precio/L" value={nuevoPrecio} onChange={(e) => setNuevoPrecio(e.target.value)} />
              </div>
              <Button size="sm" onClick={agregarZona} className="w-full bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-1" /> Agregar zona
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
