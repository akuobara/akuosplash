"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Droplets, User, MapPin, Truck, Phone, Mail, Lock, KeyRound, Home } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const USOS_AGUA = [
  { value: "consumo", label: "Consumo humano" },
  { value: "riego_pasto", label: "Riego pasto/jardín" },
  { value: "riego_cultivos", label: "Riego cultivos" },
  { value: "polvo_caminos", label: "Bajar polvo caminos" },
  { value: "construccion", label: "Construcción" },
  { value: "otro", label: "Otro" },
];

export default function RegistroClientePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Campos básicos
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [codigoAdmin, setCodigoAdmin] = useState("");

  // Ubicación
  const [direccion, setDireccion] = useState("");
  const [zona, setZona] = useState("");
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
    if (!nombre.trim() || !email.trim() || !password || !codigoAdmin.trim()) {
      toast.error("Nombre, email, contraseña y código de administrador son obligatorios");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/cliente/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre, rut, email, telefono, password, codigoAdmin,
          direccion, zona, lat, lng,
          requiereIngresoPropiedad, entregaDesdeAfuera, conexionExterna, requiereClientePresente,
          indicacionesAcceso,
          usoAgua, usoAguaNota,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo registrar");

      // Guardar token del cliente en localStorage
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

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link href="/cliente" className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-1.5">
              <Droplets className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold">Aljibe App · Cliente</span>
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
            Completá tus datos. Vas a poder ver tu historial de entregas.
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
                  <Label className="text-xs">RUT</Label>
                  <Input value={rut} onChange={(e) => setRut(e.target.value)} placeholder="12.345.678-9" />
                </div>
                <div>
                  <Label className="text-xs">Teléfono</Label>
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

          {/* Vinculación con admin */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> Vincular con tu proveedor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Label className="text-xs">Código de administrador *</Label>
                <Input value={codigoAdmin} onChange={(e) => setCodigoAdmin(e.target.value)} placeholder="Ej: ALJIBE-VM" className="uppercase" />
              </div>
              <p className="text-xs text-muted-foreground">
                Pedile a tu proveedor de agua su código único para vincular tu cuenta con él.
              </p>
            </CardContent>
          </Card>

          {/* Ubicación */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Ubicación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Dirección</Label>
                <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, número, depto" />
              </div>
              <div>
                <Label className="text-xs">Zona / Población</Label>
                <Input value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Ej: Villa Los Alerces" />
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
                  <p className="text-xs text-muted-foreground">Llave accesible desde afuera, no hace falta entrar</p>
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
                <Textarea value={indicacionesAcceso} onChange={(e) => setIndicacionesAcceso(e.target.value)} placeholder="Ej: Portón verde, el estanque está atrás, llave bajo la maceta..." rows={3} />
              </div>
            </CardContent>
          </Card>

          {/* Uso del agua */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Droplets className="h-4 w-4" /> Uso del agua</CardTitle>
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
                <Label className="text-xs">Detalle del uso (opcional)</Label>
                <Input value={usoAguaNota} onChange={(e) => setUsoAguaNota(e.target.value)} placeholder="Ej: 2 estanques de 5000 L" />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>

          <p className="text-xs text-center text-muted-foreground pb-4">
            Al registrarte aceptás compartir estos datos con tu proveedor de agua para que pueda gestionar tus entregas.
          </p>
        </form>
      </main>
    </div>
  );
}
