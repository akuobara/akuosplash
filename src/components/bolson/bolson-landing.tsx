"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bolsonGet, bolsonPost, formatCLP } from "./bolson-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Phone, Mail, Truck, Users, Shield, ArrowRight, Package, Home, Wrench } from "lucide-react";
import { toast } from "sonner";

interface BolsonUser {
  id: string;
  email: string | null;
  telefono: string | null;
  nombre: string;
  rol: "cliente" | "transportista" | "superadmin";
  aprobado: boolean;
  banned: boolean;
}

export function BolsonLanding() {
  const router = useRouter();
  const [user, setUser] = useState<BolsonUser | null | undefined>(undefined);
  const [showLogin, setShowLogin] = useState(false);
  const [loginMode, setLoginMode] = useState<"phone" | "email">("phone");
  const [contact, setContact] = useState("");
  const [codigoInput, setCodigoInput] = useState("");
  const [codigoDev, setCodigoDev] = useState<string | null>(null);
  const [nombreRegistro, setNombreRegistro] = useState("");
  const [rolRegistro, setRolRegistro] = useState<"cliente" | "transportista">("cliente");
  const [requiereRegistro, setRequiereRegistro] = useState(false);
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    bolsonGet<{ user: BolsonUser | null }>("/api/bolson/auth/me").then((d) => setUser(d.user));
  }, []);

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-yellow-50 via-lime-50 to-green-50">
        <Loader2 className="h-8 w-8 animate-spin text-green-700" />
      </div>
    );
  }

  if (user) {
    return <PantallaLogueada user={user} onLogout={async () => {
      await bolsonPost("/api/bolson/auth/logout");
      setUser(null);
      setShowLogin(false);
    }} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-lime-50 to-green-50">
      <header className="border-b-2 border-yellow-400 bg-yellow-400/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-700 p-2 text-yellow-400 shadow-lg">
              <Truck className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-green-900">Bolsón</h1>
              <p className="text-xs text-green-700">Marketplace de transporte en Chile</p>
            </div>
          </div>
          <Button
            onClick={() => setShowLogin(true)}
            className="bg-green-700 text-yellow-400 hover:bg-green-800"
          >
            Ingresar <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="text-center">
          <h2 className="text-4xl font-black text-green-900 sm:text-5xl">
            Necesitás transportar algo?
          </h2>
          <p className="mt-3 text-lg text-green-700">
            Publicá gratis tu solicitud y recibí cotizaciones de transportistas verificados.
            <br className="hidden sm:block" />
            Fletes, mudanzas, retiro de escombros — todos los servicios de carga en un solo lugar.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" className="bg-green-700 text-yellow-400 hover:bg-green-800" onClick={() => setShowLogin(true)}>
              Publicar solicitud <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="border-green-700 text-green-700 hover:bg-green-50" onClick={() => { setRolRegistro("transportista"); setShowLogin(true); }}>
              Soy transportista
            </Button>
          </div>
        </section>

        {/* Categorías */}
        <section className="mt-12">
          <h3 className="mb-4 text-center text-2xl font-bold text-green-900">Categorías de transporte</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <CategoriaCard
              icono={<Package className="h-10 w-10" />}
              titulo="Flete"
              desc="Mercadería en general — palets, muebles, encomiendas grandes. Camión con caja cerrada o abierta según lo que se traslade."
            />
            <CategoriaCard
              icono={<Home className="h-10 w-10" />}
              titulo="Mudanza"
              desc="Casa o departamento completo. Incluye personal extra, embalaje opcional, camión grande con caja cerrada. Cargas pesadas y frágiles."
            />
            <CategoriaCard
              icono={<Wrench className="h-10 w-10" />}
              titulo="Escombros"
              desc="Retiro de material de demolición, tierra, gravilla. Camión con tolva o caja abierta. Ideal para obras y remodelaciones."
            />
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="mt-12 rounded-2xl bg-white/80 p-6 shadow-lg backdrop-blur sm:p-8">
          <h3 className="mb-6 text-center text-2xl font-bold text-green-900">Cómo funciona</h3>
          <div className="grid gap-6 sm:grid-cols-3">
            <Paso numero={1} titulo="Publicás tu solicitud" desc="Indicá categoría, volumen, peso, puntos de carga y entrega (pueden ser varios en cada lado). Gratis." />
            <Paso numero={2} titulo="Recibís cotizaciones" desc="Los transportistas verificados ven tu solicitud y te ofertan un precio. Vos elegís la mejor oferta." />
            <Paso numero={3} titulo="Seguís el servicio" desc="Una vez aceptada, el transportista hace el trabajo. Subí fotos de carga y entrega. Valorá al transportista." />
          </div>
        </section>

        {/* Beneficios */}
        <section className="mt-12 grid gap-6 sm:grid-cols-2">
          <BeneficioCard
            icono={<Users className="h-8 w-8" />}
            titulo="Para clientes"
            bullets={[
              "Publicar es 100% gratis",
              "Recibís múltiples cotizaciones en paralelo",
              "Elegís el precio y transportista que prefieras",
              "Historial completo de todos tus servicios",
              "Sistema de valoraciones bidireccional",
            ]}
          />
          <BeneficioCard
            icono={<Truck className="h-8 w-8" />}
            titulo="Para transportistas"
            bullets={[
              "Conseguí clientes sin gastar en publicidad",
              "Filtrá solicitudes por categoría y zona",
              "Ofertá tu mejor precio y ganá el trabajo",
              "Liquidación clara de cada servicio",
              "Comisiones configurables por el superadmin",
            ]}
          />
        </section>

        <footer className="mt-16 border-t border-green-200 pt-6 text-center text-sm text-green-700">
          <p>Bolsón · Marketplace de transporte · Hecho en Chile 🇨🇱</p>
          <p className="mt-1 text-xs">Fletes · Mudanzas · Escombros · Multi-punto A→B→C</p>
        </footer>
      </main>

      {/* Modal de login */}
      {showLogin && (
        <LoginModal
          onClose={() => {
            setShowLogin(false);
            setContact("");
            setCodigoInput("");
            setCodigoDev(null);
            setNombreRegistro("");
            setRequiereRegistro(false);
          }}
          loginMode={loginMode}
          setLoginMode={setLoginMode}
          contact={contact}
          setContact={setContact}
          codigoInput={codigoInput}
          setCodigoInput={setCodigoInput}
          codigoDev={codigoDev}
          setCodigoDev={setCodigoDev}
          nombreRegistro={nombreRegistro}
          setNombreRegistro={setNombreRegistro}
          rolRegistro={rolRegistro}
          setRolRegistro={setRolRegistro}
          requiereRegistro={requiereRegistro}
          setRequiereRegistro={setRequiereRegistro}
          enviandoCodigo={enviandoCodigo}
          setEnviandoCodigo={setEnviandoCodigo}
          verificando={verificando}
          setVerificando={setVerificando}
          onLoginSuccess={(u) => setUser(u)}
        />
      )}
    </div>
  );
}

function PantallaLogueada({ user, onLogout }: { user: BolsonUser; onLogout: () => void }) {
  const router = useRouter();
  const ir = () => {
    if (user.rol === "cliente") router.push("/bolson/cliente");
    else if (user.rol === "transportista") router.push("/bolson/transportista");
    else if (user.rol === "superadmin") router.push("/bolson/superadmin");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-lime-50 to-green-50">
      <header className="border-b-2 border-yellow-400 bg-yellow-400/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-700 p-2 text-yellow-400 shadow-lg">
              <Truck className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-green-900">Bolsón</h1>
              <p className="text-xs text-green-700">
                {user.rol === "cliente" ? "Cliente" : user.rol === "transportista" ? "Transportista" : "Superadmin"} · {user.nombre}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={onLogout} className="border-green-700 text-green-700">
            Cerrar sesión
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <Card className="border-2 border-green-700 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-green-900">¡Hola, {user.nombre}!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-green-700">
              Tu cuenta está lista como <strong>{user.rol}</strong>.
              {!user.aprobado && user.rol === "transportista" && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
                  Pendiente de aprobación del superadmin
                </span>
              )}
            </p>
            <Button size="lg" onClick={ir} className="bg-green-700 text-yellow-400 hover:bg-green-800">
              Ir a mi panel <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function LoginModal(props: any) {
  const {
    onClose, loginMode, setLoginMode, contact, setContact, codigoInput, setCodigoInput,
    codigoDev, setCodigoDev, nombreRegistro, setNombreRegistro, rolRegistro,
    setRolRegistro, requiereRegistro, setRequiereRegistro,
    enviandoCodigo, setEnviandoCodigo, verificando, setVerificando, onLoginSuccess,
  } = props;

  async function solicitarCodigo() {
    if (!contact.trim()) {
      toast.error("Indicá tu teléfono o email");
      return;
    }
    setEnviandoCodigo(true);
    try {
      const body = loginMode === "phone" ? { telefono: contact.trim() } : { email: contact.trim() };
      const res = await bolsonPost<{ ok: boolean; _codigoDev?: string; _mensajeDev?: string; error?: string }>(
        "/api/bolson/auth/solicitar-codigo",
        body
      );
      if (res._codigoDev) {
        setCodigoDev(res._codigoDev);
        toast.success(`Código generado: ${res._codigoDev}`);
      } else {
        toast.success("Te enviamos un código. Revisá tu teléfono o email.");
      }
      setRequiereRegistro(false);
    } catch (e: any) {
      toast.error(e.message || "No se pudo generar el código");
    } finally {
      setEnviandoCodigo(false);
    }
  }

  async function verificarCodigo() {
    if (!contact.trim() || !codigoInput.trim()) {
      toast.error("Indicá contacto y código");
      return;
    }
    setVerificando(true);
    try {
      const body = loginMode === "phone"
        ? { telefono: contact.trim(), codigo: codigoInput.trim(), nombre: nombreRegistro.trim() || undefined, rol: rolRegistro }
        : { email: contact.trim(), codigo: codigoInput.trim(), nombre: nombreRegistro.trim() || undefined, rol: rolRegistro };
      const res = await bolsonPost<{ ok: boolean; user?: BolsonUser; error?: string; requiereRegistro?: boolean }>(
        "/api/bolson/auth/verificar-codigo",
        body
      );
      if (res.ok && res.user) {
        toast.success(`¡Bienvenido, ${res.user.nombre}!`);
        onLoginSuccess(res.user);
        return;
      }
      if (res.requiereRegistro) {
        setRequiereRegistro(true);
        toast.info("No existe una cuenta con ese dato. Indicá tu nombre para registrarte.");
        return;
      }
      toast.error(res.error || "No se pudo verificar");
    } catch (e: any) {
      // El API devuelve 404 con requiereRegistro:true si la cuenta no existe.
      // bolsonPost lanza error para non-2xx, pero el campo data tiene la info útil.
      if (e.data?.requiereRegistro) {
        setRequiereRegistro(true);
        toast.info("No existe una cuenta con ese dato. Indicá tu nombre para registrarte.");
        return;
      }
      toast.error(e.message || "No se pudo verificar");
    } finally {
      setVerificando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur">
      <Card className="w-full max-w-md border-2 border-green-700 bg-white shadow-2xl">
        <CardHeader>
          <CardTitle className="text-xl text-green-900">Ingresar a Bolsón</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle phone/email */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={loginMode === "phone" ? "default" : "outline"}
              onClick={() => { setLoginMode("phone"); setContact(""); setCodigoDev(null); }}
              className={loginMode === "phone" ? "bg-green-700 text-yellow-400" : "border-green-700 text-green-700"}
            >
              <Phone className="mr-2 h-4 w-4" /> Teléfono
            </Button>
            <Button
              variant={loginMode === "email" ? "default" : "outline"}
              onClick={() => { setLoginMode("email"); setContact(""); setCodigoDev(null); }}
              className={loginMode === "email" ? "bg-green-700 text-yellow-400" : "border-green-700 text-green-700"}
            >
              <Mail className="mr-2 h-4 w-4" /> Email
            </Button>
          </div>

          <div>
            <Label htmlFor="contact">{loginMode === "phone" ? "Teléfono" : "Email"}</Label>
            <Input
              id="contact"
              type={loginMode === "phone" ? "tel" : "email"}
              placeholder={loginMode === "phone" ? "+56 9 1234 5678" : "vos@email.com"}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>

          {requiereRegistro && (
            <>
              <div>
                <Label htmlFor="nombre">Tu nombre</Label>
                <Input
                  id="nombre"
                  placeholder="Nombre completo"
                  value={nombreRegistro}
                  onChange={(e) => setNombreRegistro(e.target.value)}
                />
              </div>
              <div>
                <Label>Tipo de cuenta</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={rolRegistro === "cliente" ? "default" : "outline"}
                    onClick={() => setRolRegistro("cliente")}
                    className={rolRegistro === "cliente" ? "bg-green-700 text-yellow-400" : "border-green-700 text-green-700"}
                    size="sm"
                  >
                    <Users className="mr-1 h-4 w-4" /> Cliente
                  </Button>
                  <Button
                    variant={rolRegistro === "transportista" ? "default" : "outline"}
                    onClick={() => setRolRegistro("transportista")}
                    className={rolRegistro === "transportista" ? "bg-green-700 text-yellow-400" : "border-green-700 text-green-700"}
                    size="sm"
                  >
                    <Truck className="mr-1 h-4 w-4" /> Transportista
                  </Button>
                </div>
              </div>
            </>
          )}

          {codigoDev && (
            <div className="rounded-lg bg-amber-100 border-2 border-amber-300 px-3 py-2 text-sm text-amber-900">
              <strong>Código dev:</strong> {codigoDev} (en producción se enviaría por SMS/email)
            </div>
          )}

          <div>
            <Label htmlFor="codigo">Código (6 dígitos)</Label>
            <Input
              id="codigo"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={codigoInput}
              onChange={(e) => setCodigoInput(e.target.value.replace(/\D/g, ""))}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={solicitarCodigo} disabled={enviandoCodigo} variant="outline" className="flex-1 border-green-700 text-green-700">
              {enviandoCodigo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Solicitar código"}
            </Button>
            <Button onClick={verificarCodigo} disabled={verificando} className="flex-1 bg-green-700 text-yellow-400 hover:bg-green-800">
              {verificando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
            </Button>
          </div>

          <Button onClick={onClose} variant="ghost" className="w-full">Cancelar</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function CategoriaCard({ icono, titulo, desc }: { icono: React.ReactNode; titulo: string; desc: string }) {
  return (
    <Card className="border-2 border-green-700 bg-white shadow-lg transition hover:shadow-xl hover:-translate-y-1">
      <CardContent className="p-6 text-center">
        <div className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-400 text-green-800">
          {icono}
        </div>
        <h4 className="text-xl font-bold text-green-900">{titulo}</h4>
        <p className="mt-2 text-sm text-green-700">{desc}</p>
      </CardContent>
    </Card>
  );
}

function Paso({ numero, titulo, desc }: { numero: number; titulo: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-700 text-yellow-400 text-2xl font-black">
        {numero}
      </div>
      <h4 className="font-bold text-green-900">{titulo}</h4>
      <p className="mt-1 text-sm text-green-700">{desc}</p>
    </div>
  );
}

function BeneficioCard({ icono, titulo, bullets }: { icono: React.ReactNode; titulo: string; bullets: string[] }) {
  return (
    <Card className="border-2 border-green-700 bg-white/80 shadow-lg backdrop-blur">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-green-700 text-yellow-400">
            {icono}
          </div>
          <h4 className="text-xl font-bold text-green-900">{titulo}</h4>
        </div>
        <ul className="space-y-2">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-green-800">
              <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
