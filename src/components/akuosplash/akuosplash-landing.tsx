"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { akuoGet, akuoPost } from "./akuosplash-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ChevronLeft, MapPin } from "lucide-react";
import { toast } from "sonner";

interface AkuoUser { id: string; email: string | null; telefono: string | null; nombre: string; rol: "cliente" | "transportista" | "superadmin"; aprobado: boolean; banned: boolean; }
type View = "login" | "register-cliente" | "register-transportista" | "forgot-password";

export function AkuosplashLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AkuoUser | null | undefined>(undefined);
  const [view, setView] = useState<View>("login");
  const oauthError = searchParams.get("oauth_error");
  // Deep-link: ?view=register-transportista o ?view=register-cliente abre directamente esa vista
  const viewParam = searchParams.get("view") as View | null;
  useEffect(() => {
    if (viewParam === "register-transportista" || viewParam === "register-cliente" || viewParam === "forgot-password") {
      setView(viewParam);
    }
  }, [viewParam]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [saving, setSaving] = useState(false);
  const [acceptedTC, setAcceptedTC] = useState(false);
  // Campos de cliente (persona natural vs empresa)
  const [tipoPersona, setTipoPersona] = useState<"natural" | "empresa">("natural");
  const [rut, setRut] = useState("");
  const [direccion, setDireccion] = useState("");
  const [comuna, setComuna] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [obteniendoGPS, setObteniendoGPS] = useState(false);
  // Campos de empresa
  const [rutEmpresa, setRutEmpresa] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [giro, setGiro] = useState("");
  const [direccionEmpresa, setDireccionEmpresa] = useState("");
  const [comunaEmpresa, setComunaEmpresa] = useState("");
  const [telefonoEmpresa, setTelefonoEmpresa] = useState("");
  const [emailEmpresa, setEmailEmpresa] = useState("");

  useEffect(() => {
    // Detectar resultado del mapa picker
    const result = sessionStorage.getItem("mapPickerResult");
    if (result) {
      sessionStorage.removeItem("mapPickerResult");
      try {
        const { lat: rLat, lng: rLng } = JSON.parse(result);
        setLat(rLat);
        setLng(rLng);
        setView("register-cliente");
        toast.success("Ubicación marcada en el mapa");
      } catch {}
    }
    akuoGet<{ user: AkuoUser | null }>("/api/akuosplash/auth/me").then((d) => {
      setUser(d.user);
      if (d.user) {
        if (d.user.rol === "transportista") router.push("/akuosplash/transportista");
        else if (d.user.rol === "superadmin") router.push("/akuosplash/superadmin");
        else router.push("/akuosplash/cliente");
      }
    }).catch(() => {
      // Si /me falla, mostrar el login de todas formas
      setUser(null);
    });
  }, [router]);

  // Mostrar error de OAuth si existe y limpiar la URL (antes de cualquier return)
  useEffect(() => {
    if (oauthError) {
      // Mensaje corto y limpio, no el error técnico completo
      const msg = oauthError.includes("token_exchange") ? "No se pudo conectar con Google. Verificá que el redirect URI esté autorizado en Google Cloud Console."
        : oauthError.includes("no such column") ? "Error de base de datos. Contactá soporte."
        : oauthError.includes("banned") ? "Tu cuenta está bloqueada."
        : "No se pudo iniciar sesión con Google. Intentá de nuevo.";
      toast.error(msg, { duration: 5000 });
      // Limpiar la URL inmediatamente
      window.history.replaceState({}, "", "/akuosplash");
    }
  }, [oauthError]);

  if (user === undefined) return <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  if (user) return null;

  function redirectByRole(u: AkuoUser) {
    if (u.rol === "transportista") router.push("/akuosplash/transportista");
    else if (u.rol === "superadmin") router.push("/akuosplash/superadmin");
    else router.push("/akuosplash/cliente");
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) { toast.error("Indicá email y contraseña"); return; }
    setSaving(true);
    try {
      const res = await akuoPost<{ ok: boolean; user?: AkuoUser; error?: string }>("/api/akuosplash/auth/login", { email: email.trim(), password });
      if (res.ok && res.user) { toast.success(`¡Bienvenido, ${res.user.nombre}!`); redirectByRole(res.user); }
      else toast.error(res.error || "Error");
    } catch (e: any) { toast.error(e.message || "Error"); } finally { setSaving(false); }
  }

  async function handleRegister(rol: "cliente" | "transportista") {
    if (!email.trim() || !password.trim() || !nombre.trim()) { toast.error("Email, contraseña y nombre son obligatorios"); return; }
    if (password.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres"); return; }
    if (!acceptedTC) { toast.error("Debés aceptar los Términos y Condiciones para registrarte"); return; }
    // Para clientes: RUT y ubicación obligatorios
    if (rol === "cliente") {
      if (!rut.trim()) { toast.error("El RUT es obligatorio"); return; }
      if (lat == null || lng == null) { toast.error("Tu ubicación es obligatoria. Tocá 'Usar mi ubicación'."); return; }
      if (tipoPersona === "empresa" && (!razonSocial.trim() || !rutEmpresa.trim())) { toast.error("Para empresas, razón social y RUT de empresa son obligatorios"); return; }
    }
    setSaving(true);
    try {
      const body: any = { email: email.trim(), password, nombre: nombre.trim(), telefono: telefono.trim() || undefined, rol, acceptedTC: true, tcVersion: "1.0", tcFechaAceptacion: new Date().toISOString() };
      if (rol === "cliente") {
        body.rut = rut.trim();
        body.direccion = direccion.trim();
        body.comuna = comuna.trim();
        body.lat = lat;
        body.lng = lng;
        body.tipoPersona = tipoPersona;
        if (tipoPersona === "empresa") {
          body.rutEmpresa = rutEmpresa.trim();
          body.razonSocial = razonSocial.trim();
          body.giro = giro.trim();
          body.direccionEmpresa = direccionEmpresa.trim();
          body.comunaEmpresa = comunaEmpresa.trim();
          body.telefonoEmpresa = telefonoEmpresa.trim();
          body.emailEmpresa = emailEmpresa.trim();
        }
      }
      const res = await akuoPost<{ ok: boolean; user?: AkuoUser; error?: string }>("/api/akuosplash/auth/register", body);
      if (res.ok && res.user) {
        toast.success(`¡Cuenta creada, ${res.user.nombre}! Ya podés usar la app.`);
        redirectByRole(res.user);
      } else toast.error(res.error || "Error");
    } catch (e: any) { toast.error(e.message || "Error"); } finally { setSaving(false); }
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) { toast.error("Tu navegador no soporta geolocalización"); return; }
    setObteniendoGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setObteniendoGPS(false);
        toast.success("Ubicación capturada");
      },
      () => { setObteniendoGPS(false); toast.error("No se pudo obtener tu ubicación"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleForgotPassword() {
    if (!email.trim()) { toast.error("Indicá tu email"); return; }
    setSaving(true);
    try {
      toast.success("Si el email existe, te enviamos instrucciones para recuperar tu contraseña.");
      setView("login");
    } catch (e: any) { toast.error(e.message || "Error"); } finally { setSaving(false); }
  }

  const titles: Record<View, { title: string; desc: string }> = {
    "login": { title: "Iniciar sesión", desc: "Ingresá a tu cuenta" },
    "register-cliente": { title: "Crear cuenta", desc: "Para pedir agua a domicilio" },
    "register-transportista": { title: "Registro de transportista", desc: "Para repartir agua y ganar dinero" },
    "forgot-password": { title: "Recuperar contraseña", desc: "Te enviamos un código a tu email" },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <img src="/akuosplash/logo.png" alt="AkuoSplash" className="max-w-[280px] w-full h-auto object-contain" />
          <p className="text-sm text-blue-600">Reparto de agua a domicilio</p>
        </div>
        <Card className="border-2 border-blue-200 shadow-xl">
          <CardHeader>
            {view !== "login" && (
              <button onClick={() => { setView("login"); setPassword(""); }} className="flex items-center text-sm text-blue-600 hover:underline mb-2">
                <ChevronLeft className="h-4 w-4" /> Volver
              </button>
            )}
            <CardTitle className="text-xl text-blue-900 text-center">{titles[view].title}</CardTitle>
            <CardDescription className="text-center text-blue-600">{titles[view].desc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {view === "login" && (
              <>
                <div><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="tu@email.cl" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label htmlFor="password">Contraseña</Label><Input id="password" type="password" placeholder="******" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button onClick={handleLogin} disabled={saving} className="w-full bg-blue-600 text-white hover:bg-blue-700">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar sesión"}
                </Button>
                <div className="text-center">
                  <button onClick={() => setView("forgot-password")} className="text-sm text-blue-600 hover:underline">¿Olvidaste tu contraseña?</button>
                </div>
                <OAuthButtons view={view} />
                <div className="space-y-2 border-t pt-4">
                  <p className="text-center text-sm text-blue-600">¿No tenés cuenta?</p>
                  <Button variant="outline" onClick={() => { setView("register-cliente"); setPassword(""); }} className="w-full border-blue-300 text-blue-700 hover:bg-blue-50">Crear cuenta</Button>
                  <div className="text-center"><button onClick={() => { setView("register-transportista"); setPassword(""); }} className="text-xs text-blue-400 hover:underline">¿Sos transportista? Registrate acá</button></div>
                </div>
              </>
            )}
            {view === "register-cliente" && (
              <>
                <RegFields email={email} setEmail={setEmail} nombre={nombre} setNombre={setNombre} telefono={telefono} setTelefono={setTelefono} password={password} setPassword={setPassword} />
                {/* RUT */}
                <div><Label htmlFor="reg-rut">RUT *</Label><Input id="reg-rut" placeholder="12.345.678-9" value={rut} onChange={(e) => setRut(e.target.value)} /></div>
                {/* Toggle persona natural / empresa */}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setTipoPersona("natural")} className={`rounded-lg border py-2.5 text-sm font-medium ${tipoPersona === "natural" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>Persona natural</button>
                  <button type="button" onClick={() => setTipoPersona("empresa")} className={`rounded-lg border py-2.5 text-sm font-medium ${tipoPersona === "empresa" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>Empresa</button>
                </div>
                {/* Campos de empresa (solo si es empresa) */}
                {tipoPersona === "empresa" && (
                  <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                    <p className="text-xs font-medium text-blue-900">Datos de facturación de la empresa</p>
                    <div><Label htmlFor="reg-razon" className="text-xs">Razón social *</Label><Input id="reg-razon" placeholder="Mi Empresa SpA" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} /></div>
                    <div><Label htmlFor="reg-rut-emp" className="text-xs">RUT de empresa *</Label><Input id="reg-rut-emp" placeholder="77.654.321-K" value={rutEmpresa} onChange={(e) => setRutEmpresa(e.target.value)} /></div>
                    <div><Label htmlFor="reg-giro" className="text-xs">Giro</Label><Input id="reg-giro" placeholder="Comercio al por menor" value={giro} onChange={(e) => setGiro(e.target.value)} /></div>
                    <div><Label htmlFor="reg-dir-emp" className="text-xs">Dirección fiscal</Label><Input id="reg-dir-emp" placeholder="Av. Empresa 123" value={direccionEmpresa} onChange={(e) => setDireccionEmpresa(e.target.value)} /></div>
                    <div><Label htmlFor="reg-com-emp" className="text-xs">Comuna</Label><Input id="reg-com-emp" placeholder="Las Condes" value={comunaEmpresa} onChange={(e) => setComunaEmpresa(e.target.value)} /></div>
                    <div><Label htmlFor="reg-tel-emp" className="text-xs">Teléfono empresa</Label><Input id="reg-tel-emp" placeholder="+56 2 1234 5678" value={telefonoEmpresa} onChange={(e) => setTelefonoEmpresa(e.target.value)} /></div>
                    <div><Label htmlFor="reg-email-emp" className="text-xs">Email empresa</Label><Input id="reg-email-emp" type="email" placeholder="pagos@empresa.cl" value={emailEmpresa} onChange={(e) => setEmailEmpresa(e.target.value)} /></div>
                  </div>
                )}
                {/* Dirección de entrega */}
                <div><Label htmlFor="reg-dir">Dirección de entrega *</Label><Input id="reg-dir" placeholder="Calle, número, depto" value={direccion} onChange={(e) => setDireccion(e.target.value)} /></div>
                <div><Label htmlFor="reg-com">Comuna</Label><Input id="reg-com" placeholder="Ej: Vitacura" value={comuna} onChange={(e) => setComuna(e.target.value)} /></div>
                {/* Ubicación GPS */}
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Ubicación GPS *</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={usarMiUbicacion} disabled={obteniendoGPS}>
                        {obteniendoGPS ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                        Mi GPS
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        window.location.href = "/mapa-picker?return=/akuosplash";
                      }}>
                        <MapPin className="mr-1 h-3 w-3" /> Marcar en mapa
                      </Button>
                    </div>
                  </div>
                  {lat != null && lng != null ? (
                    <p className="text-xs text-emerald-600">✓ Ubicación capturada: {lat.toFixed(5)}, {lng.toFixed(5)}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Necesitamos tu ubicación para asignarte una zona de servicio.</p>
                  )}
                </div>
                {/* Aceptación de T&C */}
                <label className="flex items-start gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={acceptedTC} onChange={(e) => setAcceptedTC(e.target.checked)} className="mt-0.5" />
                  <span className="text-muted-foreground">
                    Acepto los{" "}
                    <a href="/akuosplash/terminos" target="_blank" className="text-blue-600 hover:underline font-medium">Términos y Condiciones</a>{" "}
                    de AkuoSplash (operado por Akuologistic SpA)
                  </span>
                </label>
                <Button onClick={() => handleRegister("cliente")} disabled={saving || !acceptedTC} className="w-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear cuenta"}</Button>
                <OAuthButtons view={view} />
              </>
            )}
            {view === "register-transportista" && (
              <>
                <RegFields email={email} setEmail={setEmail} nombre={nombre} setNombre={setNombre} telefono={telefono} setTelefono={setTelefono} password={password} setPassword={setPassword} />
                {/* Aceptación de T&C */}
                <label className="flex items-start gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={acceptedTC} onChange={(e) => setAcceptedTC(e.target.checked)} className="mt-0.5" />
                  <span className="text-muted-foreground">
                    Acepto los{" "}
                    <a href="/akuosplash/terminos" target="_blank" className="text-blue-600 hover:underline font-medium">Términos y Condiciones</a>{" "}
                    de AkuoSplash (operado por Akuologistic SpA)
                  </span>
                </label>
                <Button onClick={() => handleRegister("transportista")} disabled={saving || !acceptedTC} className="w-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear cuenta de transportista"}</Button>
                <OAuthButtons view={view} />
              </>
            )}
            {view === "forgot-password" && (
              <>
                <div><Label htmlFor="forgotEmail">Email</Label><Input id="forgotEmail" type="email" placeholder="tu@email.cl" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <Button onClick={handleForgotPassword} disabled={saving} className="w-full bg-blue-600 text-white hover:bg-blue-700">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar código de recuperación"}</Button>
              </>
            )}
          </CardContent>
        </Card>
        <div className="text-center text-xs text-blue-400">AkuoSplash · Reparto de agua a domicilio · 🇨🇱</div>
      </div>
    </div>
  );
}

function RegFields({ email, setEmail, nombre, setNombre, telefono, setTelefono, password, setPassword }: any) {
  return (
    <>
      <div><Label htmlFor="reg-email">Email</Label><Input id="reg-email" type="email" placeholder="tu@email.cl" value={email} onChange={(e: any) => setEmail(e.target.value)} /></div>
      <div><Label htmlFor="reg-nombre">Nombre completo</Label><Input id="reg-nombre" placeholder="Tu nombre" value={nombre} onChange={(e: any) => setNombre(e.target.value)} /></div>
      <div><Label htmlFor="reg-telefono">Teléfono</Label><Input id="reg-telefono" placeholder="+56 9 1234 5678" value={telefono} onChange={(e: any) => setTelefono(e.target.value)} /></div>
      <div><Label htmlFor="reg-password">Contraseña (mín 6 caracteres)</Label><Input id="reg-password" type="password" placeholder="******" value={password} onChange={(e: any) => setPassword(e.target.value)} /></div>
    </>
  );
}

function OAuthButtons({ view }: { view?: string }) {
  // Si está en register-transportista, pasar rol=transportista a Google
  // Si está en register-cliente, pasar rol=cliente
  // Si está en login, no pasar rol (usar el que ya tiene la cuenta)
  const googleUrl = view === "register-transportista" ? "/api/akuosplash/auth/google?rol=transportista"
    : view === "register-cliente" ? "/api/akuosplash/auth/google?rol=cliente"
    : "/api/akuosplash/auth/google";
  return (
    <div className="space-y-2">
      <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-blue-100" /></div><div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-blue-400">o continuá con</span></div></div>
      <div className="grid grid-cols-1 gap-2">
        <Button variant="outline" onClick={() => window.location.href = googleUrl} className="border-gray-300 text-gray-700 hover:bg-gray-50">
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>Continuar con Google
        </Button>
      </div>
    </div>
  );
}
