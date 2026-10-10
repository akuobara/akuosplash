"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, LogOut, Loader2, Plus, Trash2, MapPin, DollarSign, Save, Pencil, Navigation, Upload
} from "lucide-react";
import { akuoGet, akuoPost, akuoApi, formatCLP } from "@/components/akuosplash/akuosplash-utils";
import { toast } from "sonner";

interface Zona {
  id: string; nombre: string; descripcion?: string | null;
  centroLat: number | null; centroLng: number | null;
  precioPorLitro: number; litrosMinimos: number; radioKm: number | null;
  zonaGeoJson: string; activa: boolean;
  // Precio dinámico (floor y cap)
  precioMinimoPorLitro?: number | null;
  precioMinimoTotal?: number | null;
  precioMaximoPorLitro?: number | null;
}

export default function SuperadminZonasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  const [precioMinimoPorLitro, setPrecioMinimoPorLitro] = useState("");
  const [precioMinimoTotal, setPrecioMinimoTotal] = useState("");
  const [precioMaximoPorLitro, setPrecioMaximoPorLitro] = useState("");

  // Importar KML
  const [showKmlModal, setShowKmlModal] = useState(false);
  const [kmlFile, setKmlFile] = useState<File | null>(null);
  const [kmlNombre, setKmlNombre] = useState("");
  const [kmlPrecio, setKmlPrecio] = useState("50");
  const [kmlLitrosMin, setKmlLitrosMin] = useState("1000");
  const [importando, setImportando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, zonasRes] = await Promise.all([
        akuoGet<{ config: { comisionPorcentaje: number } }>("/api/akuosplash/superadmin/config"),
        akuoGet<{ zonas: Zona[] }>("/api/akuosplash/superadmin/zonas"),
      ]);
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
          comisionPorcentaje: Number(comision),
        }),
      });
      toast.success("Configuración guardada");
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setSaving(false); }
  }

  function abrirCrear() {
    setNombre(""); setDescripcion(""); setPrecioPorLitro(""); setCentroLat(""); setCentroLng(""); setRadioKm(""); setLitrosMinimos("1000");
    setPrecioMinimoPorLitro(""); setPrecioMinimoTotal(""); setPrecioMaximoPorLitro("");
    setEditando(null);
    setShowForm(true);
  }

  function abrirEditar(z: Zona) {
    setNombre(z.nombre); setDescripcion(z.descripcion || ""); setPrecioPorLitro(String(z.precioPorLitro));
    setCentroLat(z.centroLat ? String(z.centroLat) : "");
    setCentroLng(z.centroLng ? String(z.centroLng) : "");
    setRadioKm(z.radioKm ? String(z.radioKm) : "");
    setLitrosMinimos(String(z.litrosMinimos));
    setPrecioMinimoPorLitro(z.precioMinimoPorLitro != null ? String(z.precioMinimoPorLitro) : "");
    setPrecioMinimoTotal(z.precioMinimoTotal != null ? String(z.precioMinimoTotal) : "");
    setPrecioMaximoPorLitro(z.precioMaximoPorLitro != null ? String(z.precioMaximoPorLitro) : "");
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
      // Precio dinámico (opcional)
      precioMinimoPorLitro: precioMinimoPorLitro ? Number(precioMinimoPorLitro) : null,
      precioMinimoTotal: precioMinimoTotal ? Number(precioMinimoTotal) : null,
      precioMaximoPorLitro: precioMaximoPorLitro ? Number(precioMaximoPorLitro) : null,
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

  async function importarKml() {
    if (!kmlFile) { toast.error("Seleccioná un archivo KML"); return; }
    if (!kmlPrecio) { toast.error("Indicá el precio por litro"); return; }
    setImportando(true);
    try {
      const formData = new FormData();
      formData.append("file", kmlFile);
      formData.append("nombre", kmlNombre);
      formData.append("precioPorLitro", kmlPrecio);
      formData.append("litrosMinimos", kmlLitrosMin);
      // Hacer fetch directo porque akuoApi espera JSON
      const res = await fetch("/api/akuosplash/superadmin/zonas/importar-kml", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(data.message || "Zona importada");
        setShowKmlModal(false);
        setKmlFile(null);
        setKmlNombre("");
        setKmlPrecio("50");
        setKmlLitrosMin("1000");
        cargar();
      } else {
        toast.error(data.error || "Error al importar");
      }
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setImportando(false); }
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

        {/* Comisión */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Comisión de la app</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Comisión (%)</Label>
              <Input type="number" min="0" max="100" value={comision} onChange={(e) => setComision(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Porcentaje que se cobra encima del subtotal del pedido (0 = sin comisión)</p>
            </div>
            <Button onClick={guardarConfig} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Guardar
            </Button>
          </CardContent>
        </Card>

        {/* Zonas */}
        <Card>
          <CardHeader className="pb-3 flex-row flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Zonas de cobertura</CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setShowKmlModal(true)}>
                <Upload className="h-4 w-4 mr-1" /> KML
              </Button>
              <Button size="sm" onClick={abrirCrear} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-1" /> Nueva
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {zonas.length === 0 ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-center">
                <p className="text-sm font-medium text-amber-700">Sin zonas creadas</p>
                <p className="text-xs text-amber-600 mt-1">Si no hay zonas, los clientes no pueden registrarse (no se les puede asignar un precio). Creá al menos una zona de cobertura.</p>
              </div>
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
                {/* Precio dinámico — floor y cap */}
                <div className="rounded-md border border-blue-200 bg-blue-50/50 p-2 space-y-2">
                  <p className="text-xs font-medium text-blue-900">Precio dinámico (opcional)</p>
                  <p className="text-[10px] text-blue-700">Cuando el motor dinámico calcula un precio menor al mínimo, usa el mínimo. Cuando supera el máximo, lo frena.</p>
                  <div><Label className="text-xs">Precio mínimo por litro ($/L)</Label><Input type="number" min="0" step="0.1" value={precioMinimoPorLitro} onChange={(e) => setPrecioMinimoPorLitro(e.target.value)} placeholder="Ej: 50" /></div>
                  <div><Label className="text-xs">Precio mínimo total por viaje ($)</Label><Input type="number" min="0" value={precioMinimoTotal} onChange={(e) => setPrecioMinimoTotal(e.target.value)} placeholder="Ej: 50000" /></div>
                  <div><Label className="text-xs">Precio máximo por litro ($/L) — cap anti-surge</Label><Input type="number" min="0" step="0.1" value={precioMaximoPorLitro} onChange={(e) => setPrecioMaximoPorLitro(e.target.value)} placeholder="Ej: 350" /></div>
                </div>

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

      {/* Modal Importar KML */}
      {showKmlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md border-2 border-blue-300 shadow-2xl">
            <CardHeader className="pb-3"><CardTitle className="text-base">Importar zona desde KML</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Archivo KML *</Label>
                <input
                  type="file"
                  accept=".kml"
                  onChange={(e) => setKmlFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-blue-700"
                />
                {kmlFile && (
                  <p className="mt-1 text-xs text-emerald-600">✓ {kmlFile.name} ({(kmlFile.size / 1024).toFixed(1)} KB)</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Nombre de la zona (opcional — se usa el del KML si no se completa)</Label>
                <Input value={kmlNombre} onChange={(e) => setKmlNombre(e.target.value)} placeholder="Ej: Las Condes" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Precio por litro *</Label>
                  <Input type="number" min="0" value={kmlPrecio} onChange={(e) => setKmlPrecio(e.target.value)} placeholder="50" />
                </div>
                <div>
                  <Label className="text-xs">Litros mínimos</Label>
                  <Input type="number" min="0" value={kmlLitrosMin} onChange={(e) => setKmlLitrosMin(e.target.value)} placeholder="1000" />
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700 space-y-1">
                <p className="font-medium">Cómo exportar desde Google Earth:</p>
                <ol className="ml-4 list-decimal space-y-0.5">
                  <li>Dibujá un polígono en Google Earth (botón "Agregar polígono")</li>
                  <li>Clic derecho sobre el polígono → "Guardar lugar como..."</li>
                  <li>Tipo: Archivo KML (*.kml)</li>
                  <li>Subí el archivo acá</li>
                </ol>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => { setShowKmlModal(false); setKmlFile(null); }} className="flex-1">Cancelar</Button>
                <Button onClick={importarKml} disabled={importando || !kmlFile} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                  Importar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
