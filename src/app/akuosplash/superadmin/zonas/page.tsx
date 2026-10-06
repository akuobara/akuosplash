"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, LogOut, Loader2, Plus, Trash2, MapPin, DollarSign, Save, Pencil, Navigation
} from "lucide-react";
import { akuoGet, akuoPost, akuoApi, formatCLP } from "@/components/akuosplash/akuosplash-utils";
import { toast } from "sonner";

interface Zona {
  id: string; nombre: string; descripcion?: string | null;
  centroLat: number | null; centroLng: number | null;
  precioPorLitro: number; litrosMinimos: number; radioKm: number | null;
  zonaGeoJson: string; activa: boolean;
}

export default function SuperadminZonasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [precioDefault, setPrecioDefault] = useState("50");
  const [comision, setComision] = useState("0");
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [editando, setEditando] = useState<Zona | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precioPorLitro, setPrecioPorLitro] = useState("");
  const [centroLat, setCentroLat] = useState("");
  const [centroLng, setCentroLng] = useState("");
  const [radioKm, setRadioKm] = useState("");
  const [litrosMinimos, setLitrosMinimos] = useState("1000");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, zonasRes] = await Promise.all([
        akuoGet<{ config: { precioPorLitroAguaDefault: number; comisionPorcentaje: number } }>("/api/akuosplash/superadmin/config"),
        akuoGet<{ zonas: Zona[] }>("/api/akuosplash/superadmin/zonas"),
      ]);
      setPrecioDefault(String(cfgRes.config.precioPorLitroAguaDefault));
      setComision(String(cfgRes.config.comisionPorcentaje));
      setZonas(zonasRes.zonas);
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
      await akuoApi("/api/akuosplash/superadmin/config", {
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

  function abrirCrear() {
    setNombre(""); setDescripcion(""); setPrecioPorLitro(""); setCentroLat(""); setCentroLng(""); setRadioKm(""); setLitrosMinimos("1000");
    setEditando(null);
    setShowForm(true);
  }

  function abrirEditar(z: Zona) {
    setNombre(z.nombre); setDescripcion(z.descripcion || ""); setPrecioPorLitro(String(z.precioPorLitro));
    setCentroLat(z.centroLat ? String(z.centroLat) : "");
    setCentroLng(z.centroLng ? String(z.centroLng) : "");
    setRadioKm(z.radioKm ? String(z.radioKm) : "");
    setLitrosMinimos(String(z.litrosMinimos));
    setEditando(z);
    setShowForm(true);
  }

  function usarUbicacionActual() {
    if (!navigator.geolocation) { toast.error("Tu navegador no soporta geolocalización"); return; }
    toast.info("Obteniendo tu ubicación...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCentroLat(pos.coords.latitude.toFixed(6));
        setCentroLng(pos.coords.longitude.toFixed(6));
        toast.success("Ubicación capturada");
      },
      () => toast.error("No se pudo obtener tu ubicación"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function guardarZona() {
    if (!nombre.trim() || !precioPorLitro) { toast.error("Nombre y precio son obligatorios"); return; }
    const data = {
      nombre, descripcion,
      precioPorLitro: Number(precioPorLitro),
      centroLat: centroLat ? Number(centroLat) : null,
      centroLng: centroLng ? Number(centroLng) : null,
      radioKm: radioKm ? Number(radioKm) : null,
      litrosMinimos: Number(litrosMinimos) || 1000,
      activa: true,
    };
    setSaving(true);
    try {
      if (editando) {
        await akuoApi(`/api/akuosplash/superadmin/zonas/${editando.id}`, {
          method: "PATCH", body: JSON.stringify(data),
        });
        toast.success("Zona actualizada");
      } else {
        await akuoPost("/api/akuosplash/superadmin/zonas", data);
        toast.success("Zona creada");
      }
      setShowForm(false);
      setEditando(null);
      cargar();
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setSaving(false); }
  }

  async function eliminarZona(z: Zona) {
    if (!confirm(`¿Eliminar zona ${z.nombre}?`)) return;
    try {
      await akuoApi(`/api/akuosplash/superadmin/zonas/${z.id}`, { method: "DELETE" });
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
          <h1 className="text-2xl font-bold text-gray-900">Zonas y precios</h1>
          <p className="text-sm text-gray-500">Definí zonas geográficas con su precio por litro</p>
        </div>

        {/* Precio default + comisión */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Precio default</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Precio por litro default (CLP)</Label>
              <Input type="number" min="0" value={precioDefault} onChange={(e) => setPrecioDefault(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Se aplica cuando el cliente no cae en ninguna zona específica</p>
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

        {/* Zonas */}
        <Card>
          <CardHeader className="pb-3 flex-row flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Zonas</CardTitle>
            <Button size="sm" onClick={abrirCrear} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-1" /> Nueva zona
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {zonas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Sin zonas. Los clientes pagan el precio default.<br/>
                Creá zonas para definir precios por ubicación.
              </p>
            ) : (
              <div className="space-y-2">
                {zonas.map(z => (
                  <div key={z.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{z.nombre}</p>
                        {z.descripcion && <p className="text-xs text-gray-500 mt-0.5">{z.descripcion}</p>}
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                          <span>Precio: <strong>{formatCLP(z.precioPorLitro)}/L</strong></span>
                          {z.litrosMinimos > 0 && <span>Mín: {z.litrosMinimos} L</span>}
                          {z.centroLat && z.centroLng && <span>Centro: {z.centroLat}, {z.centroLng}</span>}
                          {z.radioKm && <span>Radio: {z.radioKm} km</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => abrirEditar(z)} className="text-gray-500">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => eliminarZona(z)} className="text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showForm && (
              <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-3 space-y-3">
                <p className="text-sm font-medium text-blue-900">{editando ? "Editar zona" : "Nueva zona"}</p>
                <div><Label className="text-xs">Nombre *</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Las Condes" /></div>
                <div><Label className="text-xs">Descripción</Label><Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Sector norte" /></div>
                <div><Label className="text-xs">Precio por litro (CLP) *</Label><Input type="number" min="0" value={precioPorLitro} onChange={(e) => setPrecioPorLitro(e.target.value)} placeholder="Ej: 60" /></div>
                <div><Label className="text-xs">Litros mínimos</Label><Input type="number" min="0" value={litrosMinimos} onChange={(e) => setLitrosMinimos(e.target.value)} placeholder="1000" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Latitud centro</Label><Input value={centroLat} onChange={(e) => setCentroLat(e.target.value)} placeholder="-33.45" /></div>
                  <div><Label className="text-xs">Longitud centro</Label><Input value={centroLng} onChange={(e) => setCentroLng(e.target.value)} placeholder="-70.66" /></div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={usarUbicacionActual} className="w-full">
                  <Navigation className="mr-2 h-4 w-4" /> Usar mi ubicación actual
                </Button>
                <div><Label className="text-xs">Radio de cobertura (km)</Label><Input type="number" step="0.5" value={radioKm} onChange={(e) => setRadioKm(e.target.value)} placeholder="Ej: 10" /></div>
                <p className="text-xs text-gray-500">Si no cargás un polígono GeoJSON, la zona se define por radio desde el centro.</p>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setShowForm(false); setEditando(null); }} className="flex-1">Cancelar</Button>
                  <Button onClick={guardarZona} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    {editando ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
