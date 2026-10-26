"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Droplets,
  Truck,
  Wallet,
  ClipboardList,
  Users,
  Repeat,
  ShieldCheck,
  CalendarClock,
  Receipt,
  MapPin,
  Smartphone,
  TrendingUp,
  Crown,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";

type PlanId = "gratis" | "premium" | "pro";

interface PlanInfo {
  id: PlanId;
  nombre: string;
  precioMensual: number;
  comisionPct: number;
  pagoDiferadoDias: number;
  maxVehiculos: number; // 0 = ilimitado
  maxChoferes: number; // 0 = ilimitado
  mpSplitMode: "none" | "10day" | "instant";
  wasabil: boolean;
  mpPropio: boolean;
  activa: boolean;
  color: string;
  bg: string;
  badge: string;
  highlight: boolean;
}

const DEFAULT_PLANES: PlanInfo[] = [
  {
    id: "gratis",
    nombre: "Gratis",
    precioMensual: 0,
    comisionPct: 20,
    pagoDiferidoDias: 0,
    maxVehiculos: 1,
    maxChoferes: 1,
    mpSplitMode: "none",
    wasabil: false,
    mpPropio: false,
    activa: true,
    color: "amber",
    bg: "from-amber-50 to-orange-50",
    badge: "Empezá sin costo",
    highlight: false,
  },
  {
    id: "premium",
    nombre: "Premium",
    precioMensual: 15000,
    comisionPct: 15,
    pagoDiferidoDias: 10,
    maxVehiculos: 5,
    maxChoferes: 3,
    mpSplitMode: "10day",
    wasabil: false,
    mpPropio: false,
    activa: true,
    color: "blue",
    bg: "from-blue-50 to-sky-50",
    badge: "Más elegido",
    highlight: true,
  },
  {
    id: "pro",
    nombre: "Pro",
    precioMensual: 50000,
    comisionPct: 10,
    pagoDiferidoDias: 0,
    maxVehiculos: 0,
    maxChoferes: 0,
    mpSplitMode: "instant",
    wasabil: true,
    mpPropio: true,
    activa: false,
    color: "violet",
    bg: "from-violet-50 to-purple-50",
    badge: "Próximamente",
    highlight: false,
  },
];

const BENEFICIOS = [
  {
    icon: Droplets,
    titulo: "Accedé al marketplace de pedidos",
    desc: "AkuoSplash conecta a clientes que piden agua a domicilio con transportistas como vos. Cuando te registrás, ves los pedidos disponibles en tu zona y elegís cuáles tomar. No necesitás buscar clientes: ellos ya están acá pidiendo agua todos los días.",
    color: "text-blue-600 bg-blue-100",
  },
  {
    icon: Wallet,
    titulo: "Generá ingresos por cada entrega",
    desc: "Cobrás un porcentaje del valor de cada pedido que entregás. En el plan Gratis cobrás el 80% (comisión 20%). Con Premium, el 85%. Con Pro, el 90%. La liquidación se calcula automáticamente y ves tus ganancias en tiempo real desde el panel.",
    color: "text-emerald-600 bg-emerald-100",
  },
  {
    icon: ClipboardList,
    titulo: "Panel de control para tu negocio",
    desc: "Gestioná tus pedidos, entregas, vueltas y clientes desde un solo lugar. Marcá entregas como completadas, registrá litros repartidos, llevá el historial completo de tu actividad y descargá reportes para tu contabilidad.",
    color: "text-violet-600 bg-violet-100",
  },
  {
    icon: Truck,
    titulo: "Gestión de camiones y equipo",
    desc: "Registrá tus vehículos con patente y capacidad. Si tenés varios choferes, gestioná su equipo, asigná vueltas y hacé seguimiento de cada uno. Plan Gratis: 1 vehículo y 1 chofer. Premium: 5 vehículos y 3 choferes. Pro: ilimitado.",
    color: "text-orange-600 bg-orange-100",
  },
  {
    icon: Repeat,
    titulo: "Pedidos recurrentes automáticos",
    desc: "Configurá entregas que se repiten semanal o mensualmente para clientes fijos. El sistema genera los pedidos automáticamente según el calendario que definas. Ahorrás tiempo y asegurás ingresos estables mes a mes.",
    color: "text-cyan-600 bg-cyan-100",
  },
  {
    icon: CalendarClock,
    titulo: "Historial completo de vueltas",
    desc: "Cada vuelta (salida con el camión) queda registrada con fecha, litros entregados, cliente y monto. Podés revisar tu historial completo, filtrar por fecha o cliente, y usarlo para tus declaraciones o rendiciones de cuentas.",
    color: "text-indigo-600 bg-indigo-100",
  },
  {
    icon: Receipt,
    titulo: "Liquidación y gastos operativos",
    desc: "Registrá gastos de combustible, mantenimiento, peajes, sueldos. La liquidación final te muestra cuánto cobraste, cuánto gastaste y cuánto te quedó neto. Todo organizado por período para que tengas claridad total de tu rentabilidad.",
    color: "text-rose-600 bg-rose-100",
  },
  {
    icon: Users,
    titulo: "Tus propios clientes, sin moverte de la app",
    desc: "Cargá tus clientes fijos con sus precios, ubicación y datos de contacto. Ellos te aparecen en el panel cuando hacen pedidos. En el plan Pro, incluso podés usar tu propia cuenta de MercadoPago para cobrarles directo sin pasar por el marketplace.",
    color: "text-teal-600 bg-teal-100",
  },
];

const PASOS = [
  {
    n: 1,
    titulo: "Registrate gratis",
    desc: "Creá tu cuenta de transportista con email, nombre y teléfono. Aceptás los Términos y Condiciones y ya podés entrar al panel.",
  },
  {
    n: 2,
    titulo: "Cargá tu camión",
    desc: "Agregá tu vehículo con patente y capacidad en litros. Esto le dice al sistema cuánta agua podés llevar por vuelta.",
  },
  {
    n: 3,
    titulo: "Tomá pedidos del marketplace",
    desc: "En la pestaña Pedidos ves los pedidos disponibles en tu zona. Elegís cuáles querés entregar, los asignás a tu vuelta y salís a repartir.",
  },
  {
    n: 4,
    titulo: "Cobrá por cada entrega",
    desc: "Al marcar una entrega como completada, el sistema calcula tu porcentaje. En Premium, MercadoPago te paga a 10 días. En Pro, el pago es inmediato.",
  },
];

const FAQS = [
  {
    q: "¿Tengo que pagar para registrarme?",
    a: "No. El plan Gratis es $0 por mes. Solo cobramos una comisión del 20% sobre cada pedido que entregás. Si querés menos comisión y más herramientas, podés subirte a Premium ($15.000/mes) o Pro ($50.000/mes, próximamente).",
  },
  {
    q: "¿Cuándo cobro por mis entregas?",
    a: "Depende del plan. En el plan Gratis subís tus documentos tributarios y te pagamos por fuera de la app. En Premium, MercadoPago hace el split automático y te paga a 10 días. En Pro, el pago es inmediato después de cada entrega.",
  },
  {
    q: "¿Necesito vehículo propio?",
    a: "Sí, necesitás al menos un camión o vehículo con capacidad para llevar agua. Lo registrás en la app con patente y capacidad en litros. Si tenés varios, el plan Gratis permite 1, Premium hasta 5, Pro ilimitado.",
  },
  {
    q: "¿Puedo tener choferes que trabajen para mí?",
    a: "Sí. Si sos dueño y tenés choferes, los registrás en la pestaña Equipo. Gratis: 1 chofer. Premium: hasta 3. Pro: ilimitados. Cada chofer tiene su propia sesión y reporta a tu cuenta.",
  },
  {
    q: "¿Cómo funciona la comisión del marketplace?",
    a: "Por cada pedido que tomás del marketplace de AkuoSplash, retenemos un porcentaje: 20% en Gratis, 15% en Premium, 10% en Pro. Esa comisión cubre el desarrollo de la plataforma, soporte y adquisición de clientes. Vos recibís el resto automáticamente.",
  },
  {
    q: "¿Puedo dar de alta mis propios clientes?",
    a: "Sí. En la pestaña Clientes cargás tus clientes fijos con sus precios y dirección. Cuando ellos hacen pedidos, te aparecen directamente en tu panel. En el plan Pro incluso podés usar tu propia cuenta de MercadoPago para cobrarles sin pasar por el marketplace.",
  },
  {
    q: "¿Necesito factura electrónica?",
    a: "En el plan Gratis y Premium vos emitís tus propios documentos tributarios al SII y los subís a la app para recibir pago. En Pro incluimos el plan Growth de Wasabil, que automatiza la facturación SII por vos.",
  },
  {
    q: "¿En qué zonas funciona?",
    a: "AkuoSplash funciona en comunas donde ya hay clientes registrados pidiendo agua. Al registrarte ves los pedidos disponibles en tu zona. Si tu zona todavía no tiene pedidos, podés sumar tus propios clientes fijos para empezar.",
  },
];

function formatCLP(n: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

export function TransportistaLanding() {
  const [planes, setPlanes] = useState<PlanInfo[]>(DEFAULT_PLANES);
  const [loadingPlanes, setLoadingPlanes] = useState(true);

  // Cargar planes reales desde la API (si falla, usar defaults)
  useEffect(() => {
    fetch("/api/akuosplash/planes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.planes && Array.isArray(d.planes)) {
          // Mapear lo que viene de la API al formato del componente
          const mapped: PlanInfo[] = d.planes.map((p: any) => {
            const defaults = DEFAULT_PLANES.find((dp) => dp.id === p.id) || DEFAULT_PLANES[0];
            return {
              id: p.id,
              nombre: p.nombre || defaults.nombre,
              precioMensual: p.precioMensual ?? defaults.precioMensual,
              comisionPct: p.comisionPct ?? defaults.comisionPct,
              pagoDiferidoDias: p.pagoDiferidoDias ?? defaults.pagoDiferidoDias,
              maxVehiculos: p.maxVehiculos ?? defaults.maxVehiculos,
              maxChoferes: p.maxChoferes ?? defaults.maxChoferes,
              mpSplitMode: p.mpSplitMode || defaults.mpSplitMode,
              wasabil: p.features?.wasabil ?? defaults.wasabil,
              mpPropio: p.features?.mpPropio ?? defaults.mpPropio,
              activa: p.activa ?? defaults.activa,
              color: defaults.color,
              bg: defaults.bg,
              badge: defaults.badge,
              highlight: defaults.highlight,
            };
          });
          // Ordenar: gratis, premium, pro
          const order: PlanId[] = ["gratis", "premium", "pro"];
          mapped.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
          setPlanes(mapped);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPlanes(false));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* NAV */}
      <nav className="sticky top-0 z-40 border-b border-blue-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/akuosplash/logo.png" alt="AkuoSplash" className="h-9 w-auto" />
            <span className="hidden font-bold text-blue-900 sm:inline">AkuoSplash</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/akuosplash">
              <Button variant="ghost" size="sm" className="text-blue-700 hover:bg-blue-50">
                Iniciar sesión
              </Button>
            </Link>
            <Link href="/akuosplash?view=register-transportista">
              <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700">
                Crear cuenta
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                <Truck className="h-3.5 w-3.5" />
                Para transportistas de agua
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-blue-950 sm:text-5xl">
                Repartí agua a domicilio y generá ingresos
              </h1>
              <p className="mt-4 text-lg text-blue-800/80">
                Sumate al marketplace de AkuoSplash. Te conectamos con clientes que piden agua en tu zona, vos elegís los pedidos, los entregás y cobrás. Sin costo de entrada, sin buscar clientes, sin papeles complicados.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/akuosplash?view=register-transportista">
                  <Button size="lg" className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto">
                    Crear cuenta de transportista
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#beneficios">
                  <Button size="lg" variant="outline" className="w-full border-blue-300 text-blue-700 hover:bg-blue-50 sm:w-auto">
                    Ver qué conseguís
                  </Button>
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-blue-700/80">
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Registro 100% online</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Sin costo inicial</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Cobrá por cada entrega</span>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-cyan-200/60 blur-2xl" />
              <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-blue-200/60 blur-2xl" />
              <Card className="relative border-2 border-blue-200 bg-white/90 shadow-2xl backdrop-blur">
                <CardHeader className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-blue-900">Tu panel de transportista</CardTitle>
                    <Droplets className="h-5 w-5 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-700">Hoy, vueltas activas</p>
                    <p className="text-2xl font-bold text-emerald-900">3 vueltas</p>
                    <p className="text-xs text-emerald-700/80">142 litros · $48.200 generados</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-2.5">
                      <ClipboardList className="h-4 w-4 text-blue-600" />
                      <p className="mt-1 text-xs font-medium text-blue-900">8 pedidos</p>
                      <p className="text-[10px] text-blue-700/70">disponibles</p>
                    </div>
                    <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-2.5">
                      <Users className="h-4 w-4 text-violet-600" />
                      <p className="mt-1 text-xs font-medium text-violet-900">24 clientes</p>
                      <p className="text-[10px] text-violet-700/70">activos</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-amber-700">Próximo pago</span>
                      <span className="text-xs font-bold text-amber-900">$87.500</span>
                    </div>
                    <p className="text-[10px] text-amber-700/70">Lunes 10 por MercadoPago</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-b border-blue-100 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-8 sm:grid-cols-4 sm:px-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-900">0%</p>
            <p className="text-xs text-blue-700/70">costo de registro</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-900">10d</p>
            <p className="text-xs text-blue-700/70">pago MP en Premium</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-900">24/7</p>
            <p className="text-xs text-blue-700/70">marketplace activo</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-900">+50</p>
            <p className="text-xs text-blue-700/70">comunas en Chile</p>
          </div>
        </div>
      </section>

      {/* BENEFICIOS */}
      <section id="beneficios" className="bg-gradient-to-b from-white to-blue-50/40 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">¿Qué conseguís al registrarte?</p>
            <h2 className="mt-2 text-3xl font-extrabold text-blue-950 sm:text-4xl">
              Todo lo que necesitás para tu negocio de reparto
            </h2>
            <p className="mt-3 text-blue-700/80">
              AkuoSplash no es solo un marketplace. Es un panel completo para gestionar tu operación de reparto de agua: clientes, camiones, vueltas, liquidación y cobros. Todo en un mismo lugar.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFICIOS.map((b) => {
              const Icon = b.icon;
              return (
                <Card key={b.titulo} className="border border-blue-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${b.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="mt-2 text-base text-blue-950">{b.titulo}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-blue-700/80">{b.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="bg-blue-950 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-300">¿Cómo funciona?</p>
            <h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Empezá a repartir en 4 pasos</h2>
            <p className="mt-3 text-blue-200/80">
              Desde que te registrás hasta que cobrás tu primera entrega, el proceso te toma menos de 24 horas.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PASOS.map((p) => (
              <div key={p.n} className="relative rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <div className="absolute -top-3 left-6 flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
                  {p.n}
                </div>
                <h3 className="mt-3 text-lg font-bold">{p.titulo}</h3>
                <p className="mt-2 text-sm text-blue-200/80">{p.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/akuosplash?view=register-transportista">
              <Button size="lg" className="bg-blue-500 text-white hover:bg-blue-400">
                Empezar ahora
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* PLANES */}
      <section id="planes" className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Planes</p>
            <h2 className="mt-2 text-3xl font-extrabold text-blue-950 sm:text-4xl">Elegí el plan que se ajuste a tu negocio</h2>
            <p className="mt-3 text-blue-700/80">
              Empezá gratis y subí de plan cuando tu operación crezca. Todos los planes incluyen acceso al marketplace de AkuoSplash.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {planes.map((p) => (
              <Card
                key={p.id}
                className={`relative overflow-hidden border-2 ${
                  p.highlight ? "border-blue-500 shadow-xl" : "border-blue-100"
                } bg-gradient-to-b ${p.bg}`}
              >
                {p.highlight && (
                  <div className="absolute right-0 top-0 rounded-bl-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                    {p.badge}
                  </div>
                )}
                {!p.highlight && (
                  <div className="absolute right-0 top-0 rounded-bl-lg bg-white/80 px-3 py-1 text-xs font-medium text-blue-700">
                    {p.badge}
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    {p.id === "pro" ? <Crown className="h-5 w-5 text-violet-600" /> :
                     p.id === "premium" ? <Sparkles className="h-5 w-5 text-blue-600" /> :
                     <ShieldCheck className="h-5 w-5 text-amber-600" />}
                    <CardTitle className="text-xl text-blue-950">{p.nombre}</CardTitle>
                  </div>
                  <p className="mt-2 text-3xl font-extrabold text-blue-950">
                    {formatCLP(p.precioMensual)}
                    <span className="text-base font-normal text-blue-700/70">/mes</span>
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg bg-white/70 p-3">
                    <p className="text-xs font-medium text-blue-700">Comisión del marketplace</p>
                    <p className="text-2xl font-bold text-blue-950">{100 - p.comisionPct}% cobrás</p>
                    <p className="text-xs text-blue-700/70">({p.comisionPct}% comisión)</p>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                      <span className="text-blue-900">
                        {p.mpSplitMode === "none" && "Subís tus documentos tributarios para cobrar"}
                        {p.mpSplitMode === "10day" && `Pago MP a ${p.pagoDiferidoDias} días (split automático)`}
                        {p.mpSplitMode === "instant" && "Pago MP inmediato después de cada entrega"}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                      <span className="text-blue-900">
                        {p.maxVehiculos === 0 ? "Vehículos ilimitados" : `Hasta ${p.maxVehiculos} vehículo${p.maxVehiculos > 1 ? "s" : ""}`}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                      <span className="text-blue-900">
                        {p.maxChoferes === 0 ? "Choferes ilimitados" : `Hasta ${p.maxChoferes} chofer${p.maxChoferes > 1 ? "es" : ""}`}
                      </span>
                    </li>
                    {p.id !== "gratis" && (
                      <>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                          <span className="text-blue-900">Entregas, gastos y liquidación</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                          <span className="text-blue-900">Clientes propios y pedidos recurrentes</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                          <span className="text-blue-900">Historial completo de vueltas</span>
                        </li>
                      </>
                    )}
                    {p.id === "gratis" && (
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                        <span className="text-blue-900">Panel básico + perfil + vehículo</span>
                      </li>
                    )}
                    {p.mpPropio && (
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                        <span className="text-blue-900">Tu propia cuenta MP para tus clientes</span>
                      </li>
                    )}
                    {p.wasabil && (
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                        <span className="text-blue-900">Wasabil Growth (facturación SII automática)</span>
                      </li>
                    )}
                  </ul>
                  <div className="pt-2">
                    {p.activa ? (
                      <Link href={`/akuosplash?view=register-transportista`}>
                        <Button
                          className={`w-full ${
                            p.highlight
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : p.id === "pro"
                              ? "bg-violet-600 text-white hover:bg-violet-700"
                              : "bg-amber-500 text-white hover:bg-amber-600"
                          }`}
                        >
                          {p.precioMensual === 0 ? "Empezar gratis" : "Elegir " + p.nombre}
                        </Button>
                      </Link>
                    ) : (
                      <Button disabled className="w-full bg-gray-100 text-gray-400">
                        Próximamente
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-blue-700/60">
            Los precios pueden ser ajustados por el administrador. Los planes se cobran por mes y podés cancelar cuando quieras.
          </p>
        </div>
      </section>

      {/* FEATURES DESTACADAS */}
      <section className="bg-gradient-to-br from-blue-50 to-cyan-50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Por qué AkuoSplash</p>
              <h2 className="mt-2 text-3xl font-extrabold text-blue-950">
                Hecho para transportistas que quieren crecer
              </h2>
              <p className="mt-3 text-blue-700/80">
                AkuoSplash fue diseñado por y para repartidores de agua. Cada función resuelve un problema real del día a día: saber cuánto cobraste, no olvidar entregas, liquidar bien a fin de mes, tener tus clientes organizados.
              </p>
              <Link href="/akuosplash?view=register-transportista">
                <Button className="mt-6 bg-blue-600 text-white hover:bg-blue-700">
                  Crear cuenta
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid gap-4 lg:col-span-2 sm:grid-cols-2">
              <Card className="border-blue-100 bg-white">
                <CardContent className="p-5">
                  <Smartphone className="h-7 w-7 text-blue-600" />
                  <h3 className="mt-2 font-bold text-blue-950">Funciona en el celular</h3>
                  <p className="mt-1 text-sm text-blue-700/80">Marcá entregas, registrá gastos y revisá pedidos desde tu móvil mientras estás en ruta.</p>
                </CardContent>
              </Card>
              <Card className="border-blue-100 bg-white">
                <CardContent className="p-5">
                  <MapPin className="h-7 w-7 text-emerald-600" />
                  <h3 className="mt-2 font-bold text-blue-950">Tus clientes en el mapa</h3>
                  <p className="mt-1 text-sm text-blue-700/80">Visualizá tus clientes fijos y los pedidos del marketplace en un mapa interactivo por zona.</p>
                </CardContent>
              </Card>
              <Card className="border-blue-100 bg-white">
                <CardContent className="p-5">
                  <TrendingUp className="h-7 w-7 text-violet-600" />
                  <h3 className="mt-2 font-bold text-blue-950">Métricas en tiempo real</h3>
                  <p className="mt-1 text-sm text-blue-700/80">Ves litros entregados, ingresos generados y gastos del día al instante. Sin planillas de Excel.</p>
                </CardContent>
              </Card>
              <Card className="border-blue-100 bg-white">
                <CardContent className="p-5">
                  <Receipt className="h-7 w-7 text-amber-600" />
                  <h3 className="mt-2 font-bold text-blue-950">Liquidación clara</h3>
                  <p className="mt-1 text-sm text-blue-700/80">Cobraste X, gastaste Y, te quedó Z. Sin sorpresas. Con historial descargable por período.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Preguntas frecuentes</p>
            <h2 className="mt-2 text-3xl font-extrabold text-blue-950 sm:text-4xl">Lo que más nos preguntan</h2>
          </div>
          <div className="mt-10">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-b border-blue-100">
                  <AccordionTrigger className="text-left text-base font-medium text-blue-950 hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-blue-700/80">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-gradient-to-r from-blue-600 to-cyan-600 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Droplets className="mx-auto h-12 w-12 text-cyan-200" />
          <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">Empezá a repartir agua hoy</h2>
          <p className="mt-3 text-blue-100">
            Registro 100% online. Sin costo de entrada. En menos de 24 horas podés estar haciendo tu primera entrega.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/akuosplash?view=register-transportista">
              <Button size="lg" className="w-full bg-white text-blue-700 hover:bg-blue-50 sm:w-auto">
                Crear cuenta de transportista
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/akuosplash">
              <Button size="lg" variant="outline" className="w-full border-white/40 text-white hover:bg-white/10 sm:w-auto">
                Ya tengo cuenta · Iniciar sesión
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-blue-100 bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <img src="/akuosplash/logo.png" alt="AkuoSplash" className="h-7 w-auto" />
              <span className="text-sm text-blue-700/80">Reparto de agua a domicilio · 🇨🇱</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-blue-700/70">
              <Link href="/akuosplash" className="hover:text-blue-900 hover:underline">Iniciar sesión</Link>
              <Link href="/akuosplash/terminos" className="hover:text-blue-900 hover:underline">Términos y Condiciones</Link>
              <Link href="/akuosplash/privacidad" className="hover:text-blue-900 hover:underline">Política de Privacidad</Link>
              <Link href="/akuosplash/empresa" className="hover:text-blue-900 hover:underline">Empresa</Link>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-blue-700/60 sm:text-left">
            AkuoSplash es operado por Akuologistic SpA. Al registrarte aceptás los Términos y Condiciones.
          </p>
        </div>
      </footer>
    </div>
  );
}
