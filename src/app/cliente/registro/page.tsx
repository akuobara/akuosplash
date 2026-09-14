"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Droplets, User, MapPin, Phone, Home, Wallet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/helpers";

const USOS_AGUA = [
  { value: "consumo", label: "Consumo humano" },
  { value: "riego_pasto", label: "Riego pasto/jardín" },
  { value: "riego_cultivos", label: "Riego cultivos" },
  { value: "polvo_caminos", label: "Bajar polvo caminos" },
  { value: "construccion", label: "Construcción" },
  { value: "otro", label: "Otro" },
];

interface Zona {
  id: string;
  nombre: string;
  descripcion: string | null;
  precioPorLitro: number;
}

export default function RegistroClientePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [cargandoZonas, setCargandoZonas] = useState(true);

  // Campos básicos
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [zonaId, setZonaId] = useState("");

  // Ubicación
  const [direccion, setDireccion] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  // Acceso
  const [requiereIngresoPropiedad, setRequiereIngresoPropiedad] = useState(false);
  const [entregaDesdeAfuera, setEntregaDesdeAfuera] = useState(false);
  const [conexionExterna, setConexionExterna] = useState(false);
  const [requiereClientePresente, setRequiereClientePresente] = useState(true);
  const [indicacionesAcceso, setIndicacionesAcceso] = useState("");

  // Uso del agua
  const [usoAgua, setUsoAgua] = useState("consumo");
  const [usoAguaNota, setUsoAguaNota] = useState("");

  // Preferencia
  const [tiempoAceptacionPreferidoMin, setTiempoAceptacionPreferidoMin] = useState("15");

  useEffect(() => {
    fetch("/api/cliente/zonas")
      .then(r => r.json())
      .then(data => setZonas(data.zonas || []))
      .catch(() => toast.error("No se pudieron cargar las zonas"))
      .finally(() => setCargandoZonas(false));
  }, []);

  async function obtenerUbicacion() {
    if (!navigator.geolocation) {
      toast.error("Tu navegador no soporta geolocalización");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        toast.success("Ubicación obtenida");
      },
      (err) => toast.error("No se pudo obtener la ubicación: " + err.message)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !email.trim() || !password || !rut.trim() || !telefono.trim()) {
      toast.error("Todos los campos marcados con * son obligatorios");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/cliente/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre, rut, email, telefono, password,
          direccion, lat, lng,
          requiereIngresoPropiedad, entregaDesdeAfuera, conexionExterna, requiereClientePresente,
          indicacionesAcceso,
          usoAgua, usoAguaNota,
          tiempoAceptacionPreferidoMin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo registrar");

      if (data.token && typeof window !== "undefined") {
        localStorage.setItem("aljibe-cliente-token", data.token);
      }
      toast.success("¡Cuenta creada!");
      router.push("/cliente");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar");
    } finally {
      setLoading(false);
    }
  }

  const zonaSeleccionada = zonas.find(z => z.id === zonaId);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link href="/cliente" className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-1.5">
              <Droplets className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold">Aljibe · Cliente</span>
          </Link>
          <Link href="/cliente/login" className="text-xs text-muted-foreground hover:text-foreground">
            Ya tengo cuenta
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Crear cuenta de cliente</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Completá tus datos para pedir agua y ver tu historial.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Datos básicos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Datos básicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Nombre completo *</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">RUT *</Label>
                  <Input value={rut} onChange={(e) => setRut(e.target.value)} placeholder="12.345.678-9" />
                </div>
                <div>
                  <Label className="text-xs">Teléfono *</Label>
                  <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+56 9 1234 5678" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Email *</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
              </div>
              <div>
                <Label className="text-xs">Contraseña *</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
            </CardContent>
          </Card>

          {/* Ubicación */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Ubicación de los estanques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Label className="text-xs">Dirección</Label>
                <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, número, depto" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Latitud</Label>
                  <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-33.45" />
                </div>
                <div>
                  <Label className="text-xs">Longitud</Label>
                  <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-70.66" />
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={obtenerUbicacion}>
                <MapPin className="mr-1 h-3 w-3" /> Usar mi ubicación actual
              </Button>
              <p className="text-xs text-muted-foreground">
                Tu zona se asigna automáticamente según tu ubicación.
              </p>
            </CardContent>
          </Card>

          {/* Acceso a la propiedad */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Home className="h-4 w-4" /> Acceso a la propiedad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-start gap-3 text-sm">
                <Switch checked={requiereIngresoPropiedad} onCheckedChange={setRequiereIngresoPropiedad} />
                <div>
                  <p className="font-medium">Hay que entrar a la propiedad</p>
                  <p className="text-xs text-muted-foreground">El chofer necesita entrar para llegar al estanque</p>
                </div>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Switch checked={entregaDesdeAfuera} onCheckedChange={setEntregaDesdeAfuera} />
                <div>
                  <p className="font-medium">Se puede entregar desde afuera</p>
                  <p className="text-xs text-muted-foreground">Pasar manguera por encima del portón, etc.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Switch checked={conexionExterna} onCheckedChange={setConexionExterna} />
                <div>
                  <p className="font-medium">Hay conexión/llave de paso externa</p>
                  <p className="text-xs text-muted-foreground">Llave accesible desde afuera</p>
                </div>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <Switch checked={requiereClientePresente} onCheckedChange={setRequiereClientePresente} />
                <div>
                  <p className="font-medium">Tengo que estar presente</p>
                  <p className="text-xs text-muted-foreground">Si está apagado, el chofer puede entregar sin que esté</p>
                </div>
              </label>
              <div>
                <Label className="text-xs">Indicaciones de acceso</Label>
                <Textarea value={indicacionesAcceso} onChange={(e) => setIndicacionesAcceso(e.target.value)} placeholder="Ej: Portón verde, el estanque está atrás…" rows={3} />
              </div>
            </CardContent>
          </Card>

          {/* Uso del agua (opcional) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Droplets className="h-4 w-4" /> Uso del agua (opcional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Para qué usás el agua</Label>
                <select
                  value={usoAgua}
                  onChange={(e) => setUsoAgua(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {USOS_AGUA.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Detalle (opcional)</Label>
                <Input value={usoAguaNota} onChange={(e) => setUsoAguaNota(e.target.value)} placeholder="Ej: 2 estanques de 5000 L" />
              </div>
            </CardContent>
          </Card>

          {/* Aviso sobre tiempos */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-900/20">
            <p className="text-xs text-blue-800 dark:text-blue-300">
              ℹ️ Tu pedido puede demorar en ser aceptado por un proveedor. Una vez aceptado, recibirás una notificación con el tiempo estimado de llegada.
            </p>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>

          <p className="text-xs text-center text-muted-foreground pb-4">
            Al registrarte aceptás los términos de uso del servicio.
          </p>
        </form>
      </main>
    </div>
  );
}
