"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LogOut, Loader2, User, MapPin, Navigation, Crosshair, Check, AlertTriangle } from "lucide-react";
import { akuoGet, akuoApi, akuoPost } from "@/components/akuosplash/akuosplash-utils";
import { toast } from "sonner";

function PerfilInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const incompleto = searchParams.get("incompleto") === "1";
  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: '', telefono: '', direccion: '', comuna: '',
    lat: '', lng: '', rut: '', indicacionesAcceso: '',
    tipoPersona: 'natural' as 'natural' | 'empresa',
    razonSocial: '', rutEmpresa: '', giro: '',
    direccionEmpresa: '', comunaEmpresa: '', telefonoEmpresa: '', emailEmpresa: '',
  });
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    // Detectar resultado del mapa picker
    const result = sessionStorage.getItem("mapPickerResult");
    if (result) {
      sessionStorage.removeItem("mapPickerResult");
      try {
        const { lat: rLat, lng: rLng } = JSON.parse(result);
        update("lat", rLat.toFixed(6));
        update("lng", rLng.toFixed(6));
        toast.success("Ubicación marcada en el mapa");
      } catch {}
    }
    akuoGet<{ user: any }>("/api/akuosplash/cliente/perfil").then(d => {
      if (!d.user) { router.replace("/akuosplash"); return; }
      const u = d.user;
      setPerfil(u);
      setForm({
        nombre: u.nombre || '', telefono: u.telefono || '',
        direccion: u.direccion || '', comuna: u.comuna || '',
        lat: u.lat ? String(u.lat) : '', lng: u.lng ? String(u.lng) : '',
        rut: u.rut || '', indicacionesAcceso: u.indicacionesAcceso || '',
        tipoPersona: u.tipoPersona === 'empresa' ? 'empresa' : 'natural',
        razonSocial: u.razonSocial || '', rutEmpresa: u.rutEmpresa || '',
        giro: u.giro || '', direccionEmpresa: u.direccionEmpresa || '',
        comunaEmpresa: u.comunaEmpresa || '', telefonoEmpresa: u.telefonoEmpresa || '',
        emailEmpresa: u.emailEmpresa || '',
      });
    }).finally(() => setLoading(false));
  }, [router]);

  function update(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function usarUbicacionActual() {
    if (!navigator.geolocation) { toast.error("Tu navegador no soporta geolocalización"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        update("lat", pos.coords.latitude.toFixed(6));
        update("lng", pos.coords.longitude.toFixed(6));
        toast.success("Ubicación capturada");
      },
      (err) => { setLocating(false); toast.error("No se pudo obtener tu ubicación"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function guardar() {
    if (!form.rut.trim()) { toast.error("El RUT es obligatorio"); return; }
    if (!form.lat || !form.lng) { toast.error("Necesitamos tu ubicación GPS. Tocá 'Usar mi ubicación'"); return; }
    if (form.tipoPersona === 'empresa' && (!form.razonSocial.trim() || !form.rutEmpresa.trim())) {
      toast.error("Para empresas, razón social y RUT de empresa son obligatorios"); return;
    }
    setSaving(true);
    try {
      await akuoApi("/api/akuosplash/cliente/perfil", {
        method: "PATCH",
        body: JSON.stringify({
          nombre: form.nombre, telefono: form.telefono,
          direccion: form.direccion, comuna: form.comuna,
          lat: form.lat || undefined, lng: form.lng || undefined,
          rut: form.rut, indicacionesAcceso: form.indicacionesAcceso,
          tipoPersona: form.tipoPersona,
          razonSocial: form.razonSocial || undefined,
          rutEmpresa: form.rutEmpresa || undefined,
          giro: form.giro || undefined,
          direccionEmpresa: form.direccionEmpresa || undefined,
          comunaEmpresa: form.comunaEmpresa || undefined,
          telefonoEmpresa: form.telefonoEmpresa || undefined,
          emailEmpresa: form.emailEmpresa || undefined,
        }),
      });
      toast.success("Perfil completado");
      router.push("/akuosplash/cliente");
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setSaving(false); }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }
  if (!perfil) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <Link href="/akuosplash/cliente" className="flex items-center gap-2 text-gray-600">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-bold text-sm">Volver</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }}>
            <LogOut className="mr-1 h-4 w-4" /> Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 space-y-4">
        {incompleto && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">¡Completa tu perfil!</p>
              <p className="text-xs mt-1">Necesitamos estos datos para que puedas pedir agua. Completá el formulario y guardá.</p>
            </div>
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
          <p className="text-sm text-gray-500">Datos personales y dirección de entrega</p>
        </div>

        {/* Datos personales */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Datos personales</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 mb-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 text-2xl font-bold">{form.nombre?.[0] || "?"}</div>
              <div>
                <p className="font-bold">{perfil.email}</p>
                <Badge variant="outline">Plan: {perfil.plan}</Badge>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Nombre</Label><Input value={form.nombre} onChange={(e) => update("nombre", e.target.value)} /></div>
              <div>
                <Label>RUT *</Label>
                <Input placeholder="12.345.678-9" value={form.rut} onChange={(e) => update("rut", e.target.value)} required />
                <p className="text-[11px] text-gray-400 mt-1">Obligatorio</p>
              </div>
              <div><Label>Teléfono</Label><Input placeholder="+56 9 1234 5678" value={form.telefono} onChange={(e) => update("telefono", e.target.value)} /></div>
            </div>

            {/* Tipo de persona */}
            <div className="space-y-1.5">
              <Label>Tipo de persona</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => update("tipoPersona", "natural")} className={`rounded-lg border py-2.5 text-sm font-medium ${form.tipoPersona === "natural" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-gray-700"}`}>Persona natural</button>
                <button type="button" onClick={() => update("tipoPersona", "empresa")} className={`rounded-lg border py-2.5 text-sm font-medium ${form.tipoPersona === "empresa" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-gray-700"}`}>Empresa</button>
              </div>
            </div>

            {/* Datos de empresa */}
            {form.tipoPersona === "empresa" && (
              <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                <p className="text-xs font-medium text-blue-900">Datos de facturación de la empresa</p>
                <div><Label className="text-xs">Razón social *</Label><Input placeholder="Mi Empresa SpA" value={form.razonSocial} onChange={(e) => update("razonSocial", e.target.value)} /></div>
                <div><Label className="text-xs">RUT de empresa *</Label><Input placeholder="77.654.321-K" value={form.rutEmpresa} onChange={(e) => update("rutEmpresa", e.target.value)} /></div>
                <div><Label className="text-xs">Giro</Label><Input placeholder="Comercio al por menor" value={form.giro} onChange={(e) => update("giro", e.target.value)} /></div>
                <div><Label className="text-xs">Dirección fiscal</Label><Input placeholder="Av. Empresa 123" value={form.direccionEmpresa} onChange={(e) => update("direccionEmpresa", e.target.value)} /></div>
                <div><Label className="text-xs">Comuna</Label><Input placeholder="Las Condes" value={form.comunaEmpresa} onChange={(e) => update("comunaEmpresa", e.target.value)} /></div>
                <div><Label className="text-xs">Teléfono empresa</Label><Input placeholder="+56 2 1234 5678" value={form.telefonoEmpresa} onChange={(e) => update("telefonoEmpresa", e.target.value)} /></div>
                <div><Label className="text-xs">Email empresa</Label><Input type="email" placeholder="pagos@empresa.cl" value={form.emailEmpresa} onChange={(e) => update("emailEmpresa", e.target.value)} /></div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ubicación */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Ubicación de entrega *</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Dirección</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input className="pl-9" placeholder="Calle, número, depto" value={form.direccion} onChange={(e) => update("direccion", e.target.value)} />
              </div>
            </div>
            <div><Label>Comuna</Label><Input placeholder="Ej: Vitacura, Las Condes" value={form.comuna} onChange={(e) => update("comuna", e.target.value)} /></div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
              <Label>Ubicación GPS *</Label>
              <p className="text-xs text-gray-500">Necesitamos tu ubicación para asignarte una zona de servicio.</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={usarUbicacionActual} disabled={locating} className="flex-1">
                  {locating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Crosshair className="mr-1 h-4 w-4" />}
                  Usar mi ubicación
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  window.location.href = "/mapa-picker?return=/akuosplash/cliente/perfil";
                }}>
                  <MapPin className="mr-1 h-4 w-4" /> Marcar en mapa
                </Button>
              </div>
              {form.lat && form.lng ? (
                <p className="text-xs text-emerald-600">✓ Ubicación: {form.lat}, {form.lng}</p>
              ) : (
                <p className="text-xs text-amber-600">Sin ubicación — no podrás pedir agua todavía</p>
              )}
            </div>
            <div>
              <Label>Indicaciones de acceso</Label>
              <Textarea rows={2} placeholder="Ej: tocar timbre 2, el estanque está atrás, pasar manguera por encima del portón" value={form.indicacionesAcceso} onChange={(e) => update("indicacionesAcceso", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Button onClick={guardar} disabled={saving} className="w-full h-12 text-base font-semibold rounded-xl bg-blue-600 hover:bg-blue-700">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : incompleto ? "Completar perfil y continuar" : "Guardar cambios"}
        </Button>
      </main>
    </div>
  );
}

export function AkuosplashPerfilCliente() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
      <PerfilInner />
    </Suspense>
  );
}
