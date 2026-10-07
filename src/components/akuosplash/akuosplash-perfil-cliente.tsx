"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LogOut, Loader2, User, MapPin, Navigation, FileText } from "lucide-react";
import { akuoGet, akuoApi, akuoPost } from "@/components/akuosplash/akuosplash-utils";
import { toast } from "sonner";

export function AkuosplashPerfilCliente() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: '', telefono: '', direccion: '', comuna: '',
    lat: '', lng: '', rut: '', indicacionesAcceso: '',
  });

  useEffect(() => {
    akuoGet<{ user: any }>("/api/akuosplash/cliente/perfil").then(d => {
      if (!d.user) { router.replace("/akuosplash"); return; }
      const u = d.user;
      setPerfil(u);
      setForm({
        nombre: u.nombre || '', telefono: u.telefono || '',
        direccion: u.direccion || '', comuna: u.comuna || '',
        lat: u.lat ? String(u.lat) : '', lng: u.lng ? String(u.lng) : '',
        rut: u.rut || '', indicacionesAcceso: u.indicacionesAcceso || '',
      });
    }).finally(() => setLoading(false));
  }, [router]);

  function update(field: string, value: any) {
    setForm({ ...form, [field]: value });
  }

  function usarUbicacionActual() {
    if (!navigator.geolocation) { toast.error("Tu navegador no soporta geolocalización"); return; }
    toast.info("Obteniendo tu ubicación...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update("lat", pos.coords.latitude.toFixed(6));
        update("lng", pos.coords.longitude.toFixed(6));
        toast.success("Ubicación capturada");
      },
      (err) => toast.error("No se pudo obtener tu ubicación"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function guardar() {
    if (!form.rut.trim()) { toast.error("El RUT es obligatorio"); return; }
    setSaving(true);
    try {
      await akuoApi("/api/akuosplash/cliente/perfil", {
        method: "PATCH",
        body: JSON.stringify({
          nombre: form.nombre,
          telefono: form.telefono,
          direccion: form.direccion,
          comuna: form.comuna,
          lat: form.lat || undefined,
          lng: form.lng || undefined,
          rut: form.rut,
          indicacionesAcceso: form.indicacionesAcceso,
        }),
      });
      toast.success("Perfil actualizado");
      router.push("/akuosplash/cliente");
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
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
          </CardContent>
        </Card>

        {/* Ubicación */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Ubicación de entrega</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Dirección</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input className="pl-9" placeholder="Calle, número, depto" value={form.direccion} onChange={(e) => update("direccion", e.target.value)} />
              </div>
            </div>
            <div><Label>Comuna</Label><Input placeholder="Ej: Vitacura, Las Condes" value={form.comuna} onChange={(e) => update("comuna", e.target.value)} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Latitud (opcional)</Label><Input placeholder="-33.4" value={form.lat} onChange={(e) => update("lat", e.target.value)} /></div>
              <div><Label>Longitud (opcional)</Label><Input placeholder="-70.6" value={form.lng} onChange={(e) => update("lng", e.target.value)} /></div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={usarUbicacionActual} className="w-full">
              <Navigation className="mr-2 h-4 w-4" /> Usar mi ubicación actual
            </Button>
            <div>
              <Label>Indicaciones de acceso</Label>
              <Textarea rows={2} placeholder="Ej: tocar timbre 2, el estanque está atrás, pasar manguera por encima del portón" value={form.indicacionesAcceso} onChange={(e) => update("indicacionesAcceso", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Button onClick={guardar} disabled={saving} className="w-full h-12 text-base font-semibold rounded-xl bg-blue-600 hover:bg-blue-700">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Guardar cambios"}
        </Button>
      </main>
    </div>
  );
}
