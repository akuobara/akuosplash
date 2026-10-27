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
  LayoutDashboard,
  ClipboardList,
  Truck,
  Receipt,
  Calculator,
  Users,
  CalendarClock,
  UserCog,
  Repeat,
  History,
  ShoppingCart,
  MapPin,
  Smartphone,
  TrendingUp,
  Crown,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Wallet,
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
  // qué herramientas del panel desbloquea el plan (true = incluido)
  incluye: {
    dashboard: boolean;
    pedidos: boolean;
    entregas: boolean;
    camiones: boolean;
    gastos: boolean;
    liquidacion: boolean;
    clientes: boolean;
    recurrentes: boolean;
    historial: boolean;
    equipo: boolean;
    perfil: boolean;
    marketplace: boolean;
    mpPropio: boolean;
    wasabil: boolean;
  };
}

const DEFAULT_PLANES: PlanInfo[] = [
  {
    id: "gratis",
    nombre: "Gratis",
    precioMensual: 0,
    comisionPct: 20,
    pagoDiferadoDias: 0,
    maxVehiculos: 1,
    maxChoferes: 1,
    mpSplitMode: "none",
    wasabil: false,
    mpPropio: false,
    activa: true,
    color: "amber",
    bg: "from-amber-50 to-orange-50",
    badge: "Para arrancar",
    highlight: false,
    incluye: {
      dashboard: true,
      pedidos: true,
      entregas: false,
      camiones: true,
      gastos: false,
      liquidacion: false,
      clientes: false,
      recurrentes: false,
      historial: false,
      equipo: false,
      perfil: true,
      marketplace: true,
      mpPropio: false,
      wasabil: false,
    },
  },
  {
    id: "premium",
    nombre: "Premium",
    precioMensual: 15000,
    comisionPct: 15,
    pagoDiferadoDias: 10,
    maxVehiculos: 5,
    maxChoferes: 3,
    mpSplitMode: "10day",
    wasabil: false,
    mpPropio: false,
    activa: true,
    color: "blue",
    bg: "from-blue-50 to-sky-50",
    badge: "Todas las herramientas",
    highlight: true,
    incluye: {
      dashboard: true,
      pedidos: true,
      entregas: true,
      camiones: true,
      gastos: true,
      liquidacion: true,
      clientes: true,
      recurrentes: true,
      historial: true,
      equipo: true,
      perfil: true,
      marketplace: true,
      mpPropio: false,
      wasabil: false,
    },
  },
  {
    id: "pro",
    nombre: "Pro",
    precioMensual: 50000,
    comisionPct: 10,
    pagoDiferadoDias: 0,
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
    incluye: {
      dashboard: true,
      pedidos: true,
      entregas: true,
      camiones: true,
      gastos: true,
      liquidacion: true,
      clientes: true,
      recurrentes: true,
      historial: true,
      equipo: true,
      perfil: true,
      marketplace: true,
      mpPropio: true,
      wasabil: true,
    },
  },
];

const HERRAMIENTAS = [
  {
    icon: LayoutDashboard,
    titulo: "Dashboard",
    desc: "Panel principal con métricas en tiempo real: litros entregados hoy, ingresos generados, vueltas activas, gastos del período y pedidos pendientes. De un vistazo ves cómo va tu día.",
    color: "text-blue-600 bg-blue-100",
    plan: "Todos los planes",
  },
  {
    icon: ClipboardList,
    titulo: "Pedidos",
    desc: "Marketplace de pedidos disponibles en tu zona + creá pedidos manuales para tus clientes fijos. Asigná pedidos a tu vuelta actual, especificá litros, método de pago y cliente.",
    color: "text-violet-600 bg-violet-100",
    plan: "Todos los planes",
  },
  {
    icon: Droplets,
    titulo: "Entregas",
    desc: "Vueltas activas con litros restantes y capacidad del camión. Marcá cada entrega como completada, registrá litros efectivos, método de pago (efectivo/transferencia/camión completo) y cierre de vuelta.",
    color: "text-cyan-600 bg-cyan-100",
    plan: "Premium y Pro",
  },
  {
    icon: Truck,
    titulo: "Camiones",
    desc: "Gestioná tus vehículos: nombre, patente, capacidad en litros. Sabé cuánto te queda por entregar en cada vuelta y nunca pases del límite. Activá/desactivá camiones según disponibilidad.",
    color: "text-orange-600 bg-orange-100",
    plan: "Todos los planes",
  },
  {
    icon: Receipt,
    titulo: "Gastos operativos",
    desc: "Registrá todos los gastos: combustible, mantenimiento, peajes, sueldos de choferes, repuestos. Por fecha, por tipo, con monto y descripción. Para tu contabilidad y liquidación final.",
    color: "text-rose-600 bg-rose-100",
    plan: "Premium y Pro",
  },
  {
    icon: Calculator,
    titulo: "Liquidación",
    desc: "Calculá cuánto cobraste, cuánto gastaste y cuánto te quedó neto por período. Con detalle por cliente, por vuelta y por chofer. El sistema agrupa todo y te da el número final claro.",
    color: "text-emerald-600 bg-emerald-100",
    plan: "Premium y Pro",
  },
  {
    icon: Users,
    titulo: "Clientes",
    desc: "CRUD completo de tus clientes: precios personalizados por tipo (efectivo/transferencia/camión completo), dirección, GPS, datos de acceso (si requiere ingreso a propiedad), chofer preferido, indicaciones de entrega.",
    color: "text-teal-600 bg-teal-100",
    plan: "Premium y Pro",
  },
  {
    icon: Repeat,
    titulo: "Pedidos recurrentes",
    desc: "Configurá entregas automáticas semanales, quincenales o mensuales para clientes fijos. El sistema genera los pedidos solo según el calendario que definas, sin que tengas que acordarte de cada cliente.",
    color: "text-indigo-600 bg-indigo-100",
    plan: "Premium y Pro",
  },
  {
    icon: History,
    titulo: "Historial de vueltas",
    desc: "Cada vuelta pasada queda registrada con fecha, cliente, litros, monto, chofer asignado y método de pago. Filtrá por período, cliente o chofer. Para rendiciones, declaraciones y auditoría.",
    color: "text-amber-600 bg-amber-100",
    plan: "Premium y Pro",
  },
  {
    icon: UserCog,
    titulo: "Equipo",
    desc: "Si sos dueño con choferes: gestioná tu equipo, asigná vueltas a cada chofer, hacé seguimiento de su actividad. Cada chofer tiene su propia sesión y solo ve lo que le asignaste.",
    color: "text-purple-600 bg-purple-100",
    plan: "Premium y Pro",
  },
  {
    icon: ShieldCheck,
    titulo: "Perfil y configuración",
    desc: "Datos de tu negocio: RUT, razón social, datos de facturación, comisiones configurables, precios base, modos de liquidación. Todo editable desde tu perfil. Subí tus documentos tributarios para recibir pago.",
    color: "text-slate-600 bg-slate-100",
    plan: "Todos los planes",
  },
];

const PASOS = [
  {
    n: 1,
    titulo: "Registrate y cargá tu camión",
    desc: "Creás tu cuenta de transportista (gratis) y agregás tu vehículo con patente y capacidad en litros. Ya tenés el panel y el marketplace disponibles.",
  },
  {
    n: 2,
    titulo: "Sumá tus clientes fijos",
    desc: "Si ya tenés clientes propios, los cargás en la pestaña Clientes con sus precios, dirección y GPS. Quedan todos organizados en el panel.",
  },
  {
    n: 3,
    titulo: "Tomá pedidos del marketplace",
    desc: "AkuoSplash conecta con clientes que piden agua en tu zona. Esos pedidos aparecen en tu pestaña Pedidos. Elegís cuáles tomar, los asignás a tu vuelta y salís a repartir.",
  },
  {
    n: 4,
    titulo: "Gestioná vueltas, gastos y liquidación",
    desc: "Marcás entregas como completadas, registrás gastos del día (combustible, peajes) y al cerrar la vuelta ves cuánto cobraste, cuánto gastaste y cuánto te quedó neto.",
  },
];

const FAQS = [
  {
    q: "¿Qué herramientas de productividad tengo al registrarme?",
    a: "En el plan Gratis tenés: Dashboard, Pedidos (con marketplace), Camiones y Perfil. En el plan Premium desbloqueás las 11 herramientas completas: Entregas, Gastos, Liquidación, Clientes, Recurrentes, Historial y Equipo. En el plan Pro (próximamente) sumás MercadoPago propio y facturación SII automática con Wasabil.",
  },
  {
    q: "¿Qué es el marketplace de AkuoSplash?",
    a: "Es una red de clientes que piden agua a domicilio a través de AkuoSplash. Cuando un cliente hace un pedido en tu zona, te aparece en la pestaña Pedidos. Vos decidís si lo tomás o no. Si lo tomás, lo entregás y cobrás tu porcentaje del valor del pedido. No necesitás buscar clientes: ya están acá pidiendo agua todos los días.",
  },
  {
    q: "¿Las herramientas de productividad funcionan aunque no use el marketplace?",
    a: "Sí. Podés usar el panel solo para gestionar tus clientes actuales, sin tocar el marketplace. Las herramientas de Entregas, Gastos, Liquidación, Clientes, Recurrentes e Historial funcionan para tu operación propia. El marketplace es una fuente adicional de pedidos, no obligatoria.",
  },
  {
    q: "¿Tengo que pagar para usar las herramientas?",
    a: "Las básicas (Dashboard, Pedidos, Camiones, Perfil) son gratis. Para desbloquear Entregas, Gastos, Liquidación, Clientes, Recurrentes, Historial y Equipo necesitás el plan Premium ($15.000 CLP/mes). El plan Pro ($50.000 CLP/mes) suma facturación automática con Wasabil y pago MP inmediato (próximamente).",
  },
  {
    q: "¿Cómo se calcula la comisión del marketplace?",
    a: "Por cada pedido que tomás del marketplace, AkuoSplash retiene un porcentaje: 20% en Gratis, 15% en Premium, 10% en Pro. Vos recibís el resto. La comisión cubre desarrollo, soporte y adquisición de clientes del marketplace. Cuando usás las herramientas con tus propios clientes, no hay comisión (vos cobrás directo a ellos).",
  },
  {
    q: "¿Cuándo cobro por mis entregas del marketplace?",
    a: "Plan Gratis: subís tus documentos tributarios y te pagamos por fuera de la app. Plan Premium: MercadoPago hace el split automático y te paga a 10 días. Plan Pro: pago inmediato después de cada entrega (próximamente).",
  },
  {
    q: "¿Necesito vehículo propio?",
    a: "Sí, necesitás al menos un camión o vehículo con capacidad para llevar agua. Lo registrás en la pestaña Camiones con patente y capacidad en litros. Plan Gratis: 1 vehículo. Premium: hasta 5. Pro: ilimitados.",
  },
  {
    q: "¿Puedo tener choferes que trabajen para mí?",
    a: "Sí, en el plan Premium y Pro. Los registrás en la pestaña Equipo, les asignás vueltas y cada chofer tiene su propia sesión para reportar sus entregas. Plan Premium: hasta 3 choferes. Pro: ilimitados.",
  },
  {
    q: "¿Puedo registrar mis clientes actuales en la app?",
    a: "Sí, en la pestaña Clientes (plan Premium o superior). Cargás cada cliente con sus precios por tipo de pago, dirección, GPS, datos de acceso a la propiedad y chofer preferido. Cuando ese cliente te pida agua, lo generás como pedido y queda registrado en el sistema.",
  },
  {
    q: "¿En qué zonas funciona?",
    a: "AkuoSplash funciona en comunas donde ya hay clientes registrados pidiendo agua. Al registrarte ves los pedidos disponibles en tu zona. Si tu zona todavía no tiene pedidos del marketplace, podés igualmente usar todas las herramientas de productividad con tus clientes propios.",
  },
];

function formatCLP(n: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

function Check({ yes }: { yes: boolean }) {
  return yes ? (
    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
  ) : (
    <span className="h-4 w-4 flex-shrink-0 text-slate-300">—</span>
  );
}

export function TransportistaLanding() {
  const [planes, setPlanes] = useState<PlanInfo[]>(DEFAULT_PLANES);
  const [loadingPlanes, setLoadingPlanes] = useState(true);

  useEffect(() => {
    fetch("/api/akuosplash/planes")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.planes && Array.isArray(d.planes)) {
          const mapped: PlanInfo[] = d.planes.map((p: any) => {
            const defaults = DEFAULT_PLANES.find((dp) => dp.id === p.id) || DEFAULT_PLANES[0];
            return {
              id: p.id,
              nombre: p.nombre || defaults.nombre,
              precioMensual: p.precioMensual ?? defaults.precioMensual,
              comisionPct: p.comisionPct ?? defaults.comisionPct,
              pagoDiferadoDias: p.pagoDiferadoDias ?? defaults.pagoDiferadoDias,
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
              incluye: defaults.incluye,
            };
          });
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
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                <LayoutDashboard className="h-3.5 w-3.5" />
                Panel de transportistas · agua a domicilio
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-blue-950 sm:text-5xl">
                El panel completo para tu negocio de reparto de agua
              </h1>
              <p className="mt-4 text-lg text-blue-800/80">
                Gestioná camiones, vueltas, entregas, gastos, clientes, liquidación y equipo en una sola app. <strong className="text-blue-900">+ Acceso al marketplace de AkuoSplash</strong> con clientes que ya piden agua en tu zona.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/akuosplash?view=register-transportista">
                  <Button size="lg" className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto">
                    Crear cuenta de transportista
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#herramientas">
                  <Button size="lg" variant="outline" className="w-full border-blue-300 text-blue-700 hover:bg-blue-50 sm:w-auto">
                    Ver las 11 herramientas
                  </Button>
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-blue-700/80">
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> 11 herramientas de productividad</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Marketplace incluido</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Empezá gratis</span>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-cyan-200/60 blur-2xl" />
              <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-blue-200/60 blur-2xl" />
              <Card className="relative border-2 border-blue-200 bg-white/90 shadow-2xl backdrop-blur">
                <CardHeader className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-blue-900">Tu panel de transportista</CardTitle>
                    <LayoutDashboard className="h-5 w-5 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2 p-4">
                  {[
                    { icon: LayoutDashboard, label: "Dashboard", color: "text-blue-600 bg-blue-50" },
                    { icon: ClipboardList, label: "Pedidos", color: "text-violet-600 bg-violet-50" },
                    { icon: Droplets, label: "Entregas", color: "text-cyan-600 bg-cyan-50" },
                    { icon: Truck, label: "Camiones", color: "text-orange-600 bg-orange-50" },
                    { icon: Receipt, label: "Gastos", color: "text-rose-600 bg-rose-50" },
                    { icon: Calculator, label: "Liquidación", color: "text-emerald-600 bg-emerald-50" },
                    { icon: Users, label: "Clientes", color: "text-teal-600 bg-teal-50" },
                    { icon: Repeat, label: "Recurrentes", color: "text-indigo-600 bg-indigo-50" },
                    { icon: History, label: "Historial", color: "text-amber-600 bg-amber-50" },
                  ].map((t) => {
                    const Icon = t.icon;
                    return (
                      <div key={t.label} className={`rounded-lg p-2.5 ${t.color}`}>
                        <Icon className="h-4 w-4" />
                        <p className="mt-1 text-[10px] font-medium leading-tight">{t.label}</p>
                      </div>
                    );
                  })}
                  <div className="rounded-lg p-2.5 bg-amber-50 text-amber-700">
                    <ShoppingCart className="h-4 w-4" />
                    <p className="mt-1 text-[10px] font-medium leading-tight">Marketplace</p>
                  </div>
                  <div className="rounded-lg p-2.5 bg-slate-100 text-slate-700">
                    <UserCog className="h-4 w-4" />
                    <p className="mt-1 text-[10px] font-medium leading-tight">Equipo / Perfil</p>
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
            <p className="text-3xl font-bold text-blue-900">11</p>
            <p className="text-xs text-blue-700/70">herramientas de productividad</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-900">+ Marketplace</p>
            <p className="text-xs text-blue-700/70">clientes pidiendo agua</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-900">0%</p>
            <p className="text-xs text-blue-700/70">costo de registro</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-900">24/7</p>
            <p className="text-xs text-blue-700/70">panel siempre disponible</p>
          </div>
        </div>
      </section>

      {/* HERRAMIENTAS — la sección principal */}
      <section id="herramientas" className="bg-gradient-to-b from-white to-blue-50/40 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Las herramientas que conseguís</p>
            <h2 className="mt-2 text-3xl font-extrabold text-blue-950 sm:text-4xl">
              11 herramientas para gestionar todo tu negocio
            </h2>
            <p className="mt-3 text-blue-700/80">
              Un panel completo para gestionar camiones, vueltas, entregas, gastos, clientes, equipo y liquidación. Cada herramienta resuelve un problema concreto del día a día del reparto de agua.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {HERRAMIENTAS.map((h) => {
              const Icon = h.icon;
              return (
                <Card key={h.titulo} className="border border-blue-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${h.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                        {h.plan}
                      </span>
                    </div>
                    <CardTitle className="mt-2 text-base text-blue-950">{h.titulo}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-blue-700/80">{h.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* MARKETPLACE — sección separada y clara */}
      <section className="bg-blue-950 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-medium text-cyan-300">
                <ShoppingCart className="h-3.5 w-3.5" />
                + Marketplace de AkuoSplash
              </div>
              <h2 className="text-3xl font-extrabold sm:text-4xl">Además: clientes que ya piden agua en tu zona</h2>
              <p className="mt-4 text-blue-200/80">
                AkuoSplash tiene una red de clientes que piden agua a domicilio todos los días. Cuando uno hace un pedido en tu zona, te aparece en la pestaña <strong className="text-white">Pedidos</strong>. Vos decidís si lo tomás o no. Si lo tomás, lo entregás y cobrás tu porcentaje del valor del pedido.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-400" />
                  <span className="text-blue-100"><strong className="text-white">Sin búsqueda de clientes.</strong> Ellos ya están pidiendo agua en la plataforma.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-400" />
                  <span className="text-blue-100"><strong className="text-white">Pedidos en tiempo real.</strong> Ves cuándo entran en tu zona y los tomás en un click.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-400" />
                  <span className="text-blue-100"><strong className="text-white">Comisión variable según plan.</strong> Gratis 20%, Premium 15%, Pro 10%. Vos recibís el resto.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-400" />
                  <span className="text-blue-100"><strong className="text-white">Opcional.</strong> Podés usar las herramientas de productividad con tus propios clientes sin tocar el marketplace.</span>
                </li>
              </ul>
              <div className="mt-8">
                <Link href="/akuosplash?view=register-transportista">
                  <Button size="lg" className="bg-cyan-500 text-white hover:bg-cyan-400">
                    Crear cuenta de transportista
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
            <div>
              <Card className="border border-white/10 bg-white/5 backdrop-blur">
                <CardHeader className="border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-white">Pestaña Pedidos — Marketplace</CardTitle>
                    <ClipboardList className="h-5 w-5 text-cyan-400" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 p-4">
                  {[
                    { cliente: "Familia González", litros: 5000, comuna: "Vitacura", monto: 25000 },
                    { cliente: "Restaurante La Olla", litros: 8000, comuna: "Las Condes", monto: 40000 },
                    { cliente: "Edificio San Patricio", litros: 12000, comuna: "Lo Barnechea", monto: 60000 },
                    { cliente: "Casa Ramírez", litros: 3000, comuna: "Vitacura", monto: 15000 },
                  ].map((p, i) => (
                    <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">{p.cliente}</span>
                        <span className="text-xs font-bold text-cyan-300">${p.monto.toLocaleString("es-CL")}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[11px] text-blue-200/70">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.comuna}</span>
                        <span className="flex items-center gap-1"><Droplets className="h-3 w-3" /> {p.litros.toLocaleString("es-CL")} L</span>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-lg bg-cyan-500/20 p-2.5 text-center">
                    <p className="text-xs text-cyan-200">4 pedidos disponibles en tu zona · tomalos cuando quieras</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">¿Cómo funciona?</p>
            <h2 className="mt-2 text-3xl font-extrabold text-blue-950 sm:text-4xl">En 4 pasos estás operando</h2>
            <p className="mt-3 text-blue-700/80">Desde que te registrás hasta que cobrás tu primera entrega, menos de 24 horas.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PASOS.map((p) => (
              <div key={p.n} className="relative rounded-xl border border-blue-100 bg-blue-50/30 p-6">
                <div className="absolute -top-3 left-6 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {p.n}
                </div>
                <h3 className="mt-3 text-lg font-bold text-blue-950">{p.titulo}</h3>
                <p className="mt-2 text-sm text-blue-700/80">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANES — foco en qué herramientas desbloquean */}
      <section id="planes" className="bg-gradient-to-b from-blue-50/40 to-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Planes</p>
            <h2 className="mt-2 text-3xl font-extrabold text-blue-950 sm:text-4xl">Elegí qué herramientas desbloquear</h2>
            <p className="mt-3 text-blue-700/80">
              Empezá gratis con el panel básico y el marketplace. Cuando quieras las herramientas completas de productividad, subí a Premium.
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
                    <p className="text-xs font-medium text-blue-700">Marketplace · comisión</p>
                    <p className="text-2xl font-bold text-blue-950">{100 - p.comisionPct}% cobrás</p>
                    <p className="text-xs text-blue-700/70">({p.comisionPct}% comisión AkuoSplash)</p>
                  </div>
                  <div className="rounded-lg bg-white/70 p-3">
                    <p className="text-xs font-medium text-blue-700">Cobro por entregas del marketplace</p>
                    <p className="text-sm text-blue-900">
                      {p.mpSplitMode === "none" && "Subís tus documentos tributarios para cobrar"}
                      {p.mpSplitMode === "10day" && `MercadoPago split · pago a ${p.pagoDiferadoDias} días`}
                      {p.mpSplitMode === "instant" && "MercadoPago split · pago inmediato"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/70 p-3">
                    <p className="text-xs font-medium text-blue-700">Vehículos y choferes</p>
                    <p className="text-sm text-blue-900">
                      {p.maxVehiculos === 0 ? "Vehículos ilimitados" : `Hasta ${p.maxVehiculos} vehículo${p.maxVehiculos > 1 ? "s" : ""}`} · {p.maxChoferes === 0 ? "choferes ilimitados" : `hasta ${p.maxChoferes} chofer${p.maxChoferes > 1 ? "es" : ""}`}
                    </p>
                  </div>

                  <div className="pt-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700">Herramientas incluidas</p>
                    <ul className="grid grid-cols-1 gap-1.5 text-sm">
                      <li className="flex items-center gap-2"><Check yes={p.incluye.dashboard} /> Dashboard</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.pedidos} /> Pedidos (marketplace + propios)</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.entregas} /> Entregas y vueltas activas</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.camiones} /> Camiones</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.gastos} /> Gastos operativos</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.liquidacion} /> Liquidación</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.clientes} /> Clientes (CRUD completo)</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.recurrentes} /> Pedidos recurrentes</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.historial} /> Historial de vueltas</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.equipo} /> Equipo (choferes)</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.perfil} /> Perfil y configuración</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.marketplace} /> Acceso al marketplace</li>
                      {p.incluye.mpPropio && (
                        <li className="flex items-center gap-2"><Check yes={true} /> Tu propia cuenta MercadoPago</li>
                      )}
                      {p.incluye.wasabil && (
                        <li className="flex items-center gap-2"><Check yes={true} /> Wasabel · facturación SII automática</li>
                      )}
                    </ul>
                  </div>

                  <div className="pt-3">
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
                Hecho para transportistas que quieren profesionalizar su operación
              </h2>
              <p className="mt-3 text-blue-700/80">
                Cada herramienta del panel resuelve un problema real del reparto de agua: saber cuánto cobraste, no olvidar entregas, liquidar bien a fin de mes, tener tus clientes organizados y combinar tus pedidos propios con los del marketplace.
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
                  <p className="mt-1 text-sm text-blue-700/80">Litros entregados, ingresos, gastos y vueltas activas al instante. Sin planillas de Excel.</p>
                </CardContent>
              </Card>
              <Card className="border-blue-100 bg-white">
                <CardContent className="p-5">
                  <Wallet className="h-7 w-7 text-amber-600" />
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
          <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">Empezá a usar tu panel hoy</h2>
          <p className="mt-3 text-blue-100">
            Registro 100% online. Empezá gratis con el panel básico y el marketplace. Subí a Premium cuando quieras las 11 herramientas completas.
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
              <span className="text-sm text-blue-700/80">Panel de transportistas + marketplace de agua · 🇨🇱</span>
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
