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
  Clock,
} from "lucide-react";
import { useEffect, useState } from "react";

type PlanId = "gratis" | "premium" | "pro";

interface PlanInfo {
  id: PlanId;
  nombre: string;
  precioMensual: number;
  comisionPct: number;
  pagoDiferadoDias: number;
  maxVehiculos: number;
  maxChoferes: number;
  mpSplitMode: string;
  activa: boolean;
  color: string;
  bg: string;
  badge: string;
  highlight: boolean;
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
  };
}

// Defaults alineados con la config publicada en producción (AkuoConfig.planConfigsJson)
const DEFAULT_PLANES: PlanInfo[] = [
  {
    id: "gratis",
    nombre: "Gratis",
    precioMensual: 0,
    comisionPct: 15,
    pagoDiferadoDias: 10,
    maxVehiculos: 1,
    maxChoferes: 1,
    mpSplitMode: "split",
    activa: true,
    color: "amber",
    bg: "from-amber-50 to-orange-50",
    badge: "Para arrancar",
    highlight: false,
    incluye: {
      dashboard: true,
      pedidos: false,
      entregas: true,
      camiones: false,
      gastos: false,
      liquidacion: false,
      clientes: false,
      recurrentes: false,
      historial: false,
      equipo: false,
      perfil: true,
    },
  },
  {
    id: "premium",
    nombre: "Premium",
    precioMensual: 7990,
    comisionPct: 12.5,
    pagoDiferadoDias: 0,
    maxVehiculos: 1,
    maxChoferes: 1,
    mpSplitMode: "split",
    activa: true,
    color: "blue",
    bg: "from-blue-50 to-sky-50",
    badge: "Más elegido",
    highlight: true,
    incluye: {
      dashboard: true,
      pedidos: true,
      entregas: true,
      camiones: false,
      gastos: true,
      liquidacion: false,
      clientes: true,
      recurrentes: true,
      historial: true,
      equipo: false,
      perfil: true,
    },
  },
  {
    id: "pro",
    nombre: "Pro",
    precioMensual: 23990,
    comisionPct: 8.5,
    pagoDiferadoDias: 0,
    maxVehiculos: 5,
    maxChoferes: 5,
    mpSplitMode: "split",
    activa: true,
    color: "violet",
    bg: "from-violet-50 to-purple-50",
    badge: "Para flotas",
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
    },
  },
];

const HERRAMIENTAS = [
  {
    icon: LayoutDashboard,
    titulo: "Dashboard",
    desc: "Panel principal con métricas en tiempo real: litros entregados hoy, ingresos, vueltas activas y gastos del período. De un vistazo ves cómo va tu día.",
    color: "text-blue-600 bg-blue-100",
    planes: "Gratis, Premium y Pro",
    gratis: true, premium: true, pro: true,
  },
  {
    icon: ClipboardList,
    titulo: "Pedidos",
    desc: "Creá y gestioná pedidos manuales para tus clientes propios. Asigná pedidos a tu vuelta actual, especificá litros, método de pago y cliente. Los pedidos del marketplace (cuando esté disponible) entran por un módulo separado.",
    color: "text-violet-600 bg-violet-100",
    planes: "Premium y Pro",
    gratis: false, premium: true, pro: true,
  },
  {
    icon: Droplets,
    titulo: "Entregas",
    desc: "Historial de entregas — propias y del marketplace cuando esté disponible. Cada entrega con cliente, fecha, litros, monto y método de pago. Para seguimiento y control de tu operación.",
    color: "text-cyan-600 bg-cyan-100",
    planes: "Gratis, Premium y Pro",
    gratis: true, premium: true, pro: true,
  },
  {
    icon: Truck,
    titulo: "Camiones",
    desc: "Gestioná tus vehículos: nombre, patente, capacidad en litros. Sabé cuánto te queda por entregar en cada vuelta. Activá o desactivá camiones según disponibilidad.",
    color: "text-orange-600 bg-orange-100",
    planes: "Pro",
    gratis: false, premium: false, pro: true,
  },
  {
    icon: Receipt,
    titulo: "Gastos operativos",
    desc: "Registrá todos los gastos: combustible, mantenimiento, peajes, sueldos de choferes, repuestos. Por fecha, por tipo, con monto y descripción. Para tu contabilidad y liquidación final.",
    color: "text-rose-600 bg-rose-100",
    planes: "Premium y Pro",
    gratis: false, premium: true, pro: true,
  },
  {
    icon: Calculator,
    titulo: "Liquidación",
    desc: "Calculá cuánto cobraste, cuánto gastaste y cuánto te quedó neto por período. Con detalle por cliente, por vuelta y por chofer. El sistema agrupa todo y te da el número final claro.",
    color: "text-emerald-600 bg-emerald-100",
    planes: "Pro",
    gratis: false, premium: false, pro: true,
  },
  {
    icon: Users,
    titulo: "Clientes",
    desc: "CRUD completo de tus clientes: precios personalizados por tipo (efectivo/transferencia/camión completo), dirección, GPS, datos de acceso, chofer preferido, indicaciones de entrega.",
    color: "text-teal-600 bg-teal-100",
    planes: "Premium y Pro",
    gratis: false, premium: true, pro: true,
  },
  {
    icon: Repeat,
    titulo: "Pedidos recurrentes",
    desc: "Configurá entregas automáticas semanales, quincenales o mensuales para clientes fijos. El sistema genera los pedidos solo según el calendario que definas, sin que tengas que acordarte de cada cliente.",
    color: "text-indigo-600 bg-indigo-100",
    planes: "Premium y Pro",
    gratis: false, premium: true, pro: true,
  },
  {
    icon: History,
    titulo: "Historial de vueltas",
    desc: "Cada vuelta pasada queda registrada con fecha, cliente, litros, monto, chofer asignado y método de pago. Filtrá por período, cliente o chofer. Para rendiciones y referencia operativa. AkuoSplash no es una herramienta contable: los resultados deben ser revisados por un profesional contador antes de cualquier declaración o reporte al SII.",
    color: "text-amber-600 bg-amber-100",
    planes: "Premium y Pro",
    gratis: false, premium: true, pro: true,
  },
  {
    icon: UserCog,
    titulo: "Equipo",
    desc: "Si sos dueño con choferes: gestioná tu equipo, asigná vueltas a cada chofer, hacé seguimiento de su actividad. Cada chofer tiene su propia sesión y solo ve lo que le asignaste.",
    color: "text-purple-600 bg-purple-100",
    planes: "Pro",
    gratis: false, premium: false, pro: true,
  },
  {
    icon: ShieldCheck,
    titulo: "Perfil y configuración",
    desc: "Datos de tu negocio: RUT, razón social, datos de facturación, comisiones configurables, precios base, modos de liquidación. Todo editable desde tu perfil.",
    color: "text-slate-600 bg-slate-100",
    planes: "Gratis, Premium y Pro",
    gratis: true, premium: true, pro: true,
  },
];

const PASOS = [
  {
    n: 1,
    titulo: "Registrate y conectá tu MercadoPago",
    desc: "Creás tu cuenta de transportista (gratis) y conectás tu cuenta de MercadoPago para el Split. Así podés recibir pagos del marketplace automáticamente.",
  },
  {
    n: 2,
    titulo: "Cargá tus clientes fijos",
    desc: "Si ya tenés clientes propios, los cargás en la pestaña Clientes con sus precios, dirección y GPS. Quedan todos organizados en el panel.",
  },
  {
    n: 3,
    titulo: "Gestioná vueltas y entregas",
    desc: "Salís a repartir. Marcás entregas como completadas, registrás litros y métodos de pago. En cada vuelta ves cuánto entregaste y cuánto te queda en el camión.",
  },
  {
    n: 4,
    titulo: "Registrá gastos y liquidá",
    desc: "A fin de día cargás gastos (combustible, peajes) y al cerrar la vuelta o el período ves cuánto cobraste, cuánto gastaste y cuánto te quedó neto.",
  },
];

// Fallback de fee manual si la API no responde
const DEFAULT_FEE_MANUAL = { fijo: 3290, pct: 1.7 };

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
  const [feeManual, setFeeManual] = useState(DEFAULT_FEE_MANUAL);
  const [mpSandbox, setMpSandbox] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/akuosplash/planes", { cache: "no-store" })
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
              activa: p.activa ?? defaults.activa,
              color: defaults.color,
              bg: defaults.bg,
              badge: defaults.badge,
              highlight: defaults.highlight,
              incluye: {
                dashboard: p.features?.dashboard ?? defaults.incluye.dashboard,
                pedidos: p.features?.pedidos ?? defaults.incluye.pedidos,
                entregas: p.features?.entregas ?? defaults.incluye.entregas,
                camiones: p.features?.vehiculo ?? defaults.incluye.camiones,
                gastos: p.features?.gastos ?? defaults.incluye.gastos,
                liquidacion: p.features?.liquidacion ?? defaults.incluye.liquidacion,
                clientes: p.features?.clientes ?? defaults.incluye.clientes,
                recurrentes: p.features?.recurrentes ?? defaults.incluye.recurrentes,
                historial: p.features?.historial ?? defaults.incluye.historial,
                equipo: p.features?.equipo ?? defaults.incluye.equipo,
                perfil: p.features?.perfil ?? defaults.incluye.perfil,
              },
            };
          });
          const order: PlanId[] = ["gratis", "premium", "pro"];
          mapped.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
          setPlanes(mapped);
        }
        if (d?.feeManual) {
          setFeeManual({
            fijo: Number(d.feeManual.fijo) || DEFAULT_FEE_MANUAL.fijo,
            pct: Number(d.feeManual.pct) || DEFAULT_FEE_MANUAL.pct,
          });
        }
        if (typeof d?.mpSandbox === "boolean") setMpSandbox(d.mpSandbox);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Helper: buscar plan por id en el estado actual
  const getPlan = (id: PlanId) => planes.find((p) => p.id === id);
  const planGratis = getPlan("gratis");
  const planPremium = getPlan("premium");
  const planPro = getPlan("pro");

  // Helper: texto de comisiones para reusar en FAQ/sección marketplace
  const comisionesTxt = `${planGratis?.comisionPct}% en Gratis, ${planPremium?.comisionPct}% en Premium y ${planPro?.comisionPct}% en Pro`;
  const feeManualTxt = `$${feeManual.fijo.toLocaleString("es-CL")} CLP fijo + ${feeManual.pct}% del monto`;
  const feeManualCortoTxt = `$${feeManual.fijo.toLocaleString("es-CL")} fijo + ${feeManual.pct}% del monto`;
  // Texto dinámico para límites por plan ("1 vehículo y 1 chofer" / "5 vehículos y 5 choferes")
  const limitesTxt = (p?: PlanInfo) => p ? `hasta ${p.maxVehiculos} vehículo${p.maxVehiculos > 1 ? "s" : ""} y ${p.maxChoferes} chofer${p.maxChoferes > 1 ? "es" : ""}` : "";
  // Texto dinámico para pago MP Split: el tiempo de pago lo decide cada usuario en su cuenta de MP
  // (no depende del plan, todos los planes usan MP Split igual)

  // FAQ generado dinámicamente con los valores actuales de la API
  const FAQS = [
    {
      q: "¿Qué herramientas tengo en cada plan?",
      a: "Plan Gratis: Dashboard, Entregas y Perfil. Plan Premium: suma Pedidos, Gastos, Clientes, Recurrentes e Historial. Plan Pro: suma Camiones, Liquidación y Equipo. MercadoPago Split* estará disponible en los 3 planes junto con el marketplace. *Solo si conectás tu cuenta de MP desde tu perfil.",
    },
    {
      q: "¿Qué es el marketplace de AkuoSplash?",
      a: "Es una red de clientes que piden agua a domicilio a través de AkuoSplash. Cuando un cliente hace un pedido en tu zona, el pedido entra al módulo del marketplace (sección propia dentro del panel, conectada a las herramientas de productividad — no aparece en la pestaña Pedidos, que es para tus clientes propios). Vos decidís si lo tomás. Si lo tomás, lo entregás y cobrás tu porcentaje del valor del pedido. El marketplace estará disponible próximamente y puede no estar disponible en todas las zonas al inicio.",
    },
    {
      q: "¿Necesito MercadoPago para usar la app?",
      a: `MercadoPago Split* es lo que usa AkuoSplash para dividir automáticamente los pagos del marketplace entre la comisión y tu porcentaje. Estará disponible junto con el marketplace. Conectás tu cuenta de MercadoPago una sola vez desde tu perfil. El tiempo de pago (inmediato o diferido) lo decidís vos en la configuración de tu cuenta de MercadoPago — no depende del plan. *Solo si conectás tu cuenta de MercadoPago. Las herramientas de productividad funcionan sin MercadoPago (podés operar con tus clientes propios sin MP).`,
    },
    {
      q: "¿Tengo que subir documentos tributarios?",
      a: "Sí. Todos los transportistas que aceptan ventas por el marketplace deben subir sus documentos tributarios al SII para que AkuoSplash pueda emitir los pagos. Esto aplica a los 3 planes. AkuoSplash no emite documentos tributarios por vos — vos sos responsable de emitirlos y declararlos al SII según corresponda.",
    },
    {
      q: "¿Necesito vehículo propio?",
      a: `Sí. Necesitás al menos un camión o vehículo con capacidad para llevar agua. Plan Gratis y Premium: ${limitesTxt(planGratis)}. Plan Pro: ${limitesTxt(planPro)}. La gestión de camiones (pestaña Camiones) solo está disponible en el plan Pro.`,
    },
    {
      q: "¿Hay algún fee si no uso MercadoPago Split?",
      a: `Sí. Si retirás dinero de forma manual en vez de recibir el pago automático por MP Split, se aplica un fee de ${feeManualTxt}. Es el mismo fee para los 3 planes.`,
    },
    {
      q: "¿Las herramientas de productividad funcionan aunque no use el marketplace?",
      a: "Sí. Podés usar el panel solo para gestionar tus clientes actuales y tu operación propia, sin tocar el marketplace. Las herramientas de Entregas, Gastos, Clientes, Recurrentes e Historial funcionan para tu operación. El marketplace es una fuente adicional de pedidos cuando esté disponible.",
    },
    {
      q: "¿En qué zonas funciona el marketplace?",
      a: "El marketplace estará disponible próximamente en las comunas donde AkuoSplash tenga clientes registrados pidiendo agua. Si tu zona todavía no tiene pedidos del marketplace, podés igualmente usar todas las herramientas de productividad con tus clientes propios.",
    },
    {
      q: "¿Qué comisión cobra AkuoSplash por cada venta del marketplace?",
      a: `Depende del plan: ${comisionesTxt}. Vos recibís el resto automáticamente vía MercadoPago Split* (cuando esté disponible junto con el marketplace). La comisión cubre desarrollo, soporte y adquisición de clientes del marketplace. *Solo si conectás tu cuenta de MP desde tu perfil.`,
    },
    {
      q: "¿AkuoSplash reporta al SII o es una herramienta contable?",
      a: "AkuoSplash no es una herramienta contable. Las ventas del marketplace SÍ se reportan al SII (es obligación legal cuando el marketplace esté disponible). Las ventas a tus clientes propios NO se reportan: vos sos responsable de declararlas al SII por tu cuenta ya que AkuoSplash no tiene control ni autoridad sobre cómo manejás tus movimientos con tus clientes. Los reportes de AkuoSplash (liquidación, historial de vueltas, gastos) son informativos y deben ser revisados por un profesional contador antes de cualquier declaración tributaria.",
    },
  ];

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
                Panel de transportistas · reparto de agua
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-blue-950 sm:text-5xl">
                El panel completo para tu negocio de reparto de agua
              </h1>
              <p className="mt-4 text-lg text-blue-800/80">
                Gestioná camiones, vueltas, entregas, gastos, clientes, liquidación y equipo en una sola app. <strong className="text-blue-900">+ Marketplace de AkuoSplash próximamente</strong> con clientes que piden agua en tu zona, MercadoPago Split* para que cobres automático.
              </p>
              <p className="mt-2 text-xs text-blue-700/60">* MercadoPago Split estará disponible junto con el marketplace. Solo funciona si conectás tu cuenta de MercadoPago desde tu perfil.</p>
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
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-blue-500" /> Marketplace + MP Split* próximamente</span>
              </div>
              <p className="mt-1 text-[10px] text-blue-700/50">* Solo si conectás tu cuenta de MercadoPago desde tu perfil.</p>
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
                  <div className="rounded-lg p-2.5 bg-amber-50 text-amber-700 relative">
                    <ShoppingCart className="h-4 w-4" />
                    <p className="mt-1 text-[10px] font-medium leading-tight">Marketplace</p>
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" title="Próximamente" />
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
            <p className="text-3xl font-bold text-blue-900">3</p>
            <p className="text-xs text-blue-700/70">planes (Gratis / Premium / Pro)</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-900">MP Split*</p>
            <p className="text-xs text-blue-700/70">próximamente (con marketplace)</p>
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
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className={`flex h-5 w-5 items-center justify-center rounded ${h.gratis ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-300"}`}>
                          <CheckCircle2 className="h-3 w-3" />
                        </span>
                        <span className={`flex h-5 w-5 items-center justify-center rounded ${h.premium ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-300"}`}>
                          <CheckCircle2 className="h-3 w-3" />
                        </span>
                        <span className={`flex h-5 w-5 items-center justify-center rounded ${h.pro ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-300"}`}>
                          <CheckCircle2 className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                    <CardTitle className="mt-2 text-base text-blue-950">{h.titulo}</CardTitle>
                    <p className="text-[10px] uppercase tracking-wide text-blue-700/60">{h.planes}</p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-blue-700/80">{h.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="mt-6 flex items-center justify-center gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-100" /> <CheckCircle2 className="h-3 w-3 text-amber-700" /> Gratis</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-blue-100" /> <CheckCircle2 className="h-3 w-3 text-blue-700" /> Premium</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-violet-100" /> <CheckCircle2 className="h-3 w-3 text-violet-700" /> Pro</span>
          </div>
        </div>
      </section>

      {/* MARKETPLACE — próximamente */}
      <section className="bg-blue-950 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-300">
                <Clock className="h-3.5 w-3.5" />
                Próximamente
              </div>
              <h2 className="text-3xl font-extrabold sm:text-4xl">+ Marketplace de AkuoSplash</h2>
              <p className="mt-4 text-blue-200/80">
                AkuoSplash está armando una red de clientes que piden agua a domicilio. Cuando esté disponible y haya clientes en tu zona, los pedidos entrarán al <strong className="text-white">módulo del marketplace</strong> (sección propia dentro del panel, conectada a las herramientas de productividad). Vos decidís si los tomás. Si los tomás, los entregás y cobrás tu porcentaje del valor del pedido vía MercadoPago Split*.
              </p>
              <p className="mt-2 text-xs text-blue-300/60">* MercadoPago Split funciona solo si conectás tu cuenta de MercadoPago desde tu perfil. Estará disponible junto con el marketplace.</p>
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
                  <span className="text-blue-100"><strong className="text-white">Comisión variable según plan.</strong> {comisionesTxt}. Vos recibís el resto.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-400" />
                  <span className="text-blue-100"><strong className="text-white">MercadoPago Split automático*.</strong> El pago se divide entre la comisión y tu porcentaje en cada venta.</span>
                </li>
              </ul>
              <p className="mt-6 text-xs text-blue-300/70">
                El marketplace se habilitará próximamente. Mientras tanto, podés empezar a usar todas las herramientas de productividad del panel con tus clientes actuales.
              </p>
            </div>
            <div>
              <Card className="border border-white/10 bg-white/5 backdrop-blur">
                <CardHeader className="border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-white">Módulo Marketplace (próximamente)</CardTitle>
                    <ShoppingCart className="h-5 w-5 text-cyan-400" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 p-4 opacity-60">
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
                  <div className="rounded-lg bg-amber-500/20 p-2.5 text-center">
                    <p className="text-xs text-amber-200">Marketplace no disponible todavía en tu zona</p>
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
            <p className="mt-3 text-blue-700/80">Desde que te registrás hasta que ves tu primera liquidación, menos de 24 horas.</p>
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

      {/* PLANES — con info correcta publicada */}
      <section id="planes" className="bg-gradient-to-b from-blue-50/40 to-white py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Planes</p>
            <h2 className="mt-2 text-3xl font-extrabold text-blue-950 sm:text-4xl">Elegí qué herramientas desbloquear</h2>
            <p className="mt-3 text-blue-700/80">
              Empezá gratis con el panel básico. Subí a Premium para más herramientas. Llegá a Pro para gestionar flotas, liquidación y equipo.
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
                    <p className="text-xs font-medium text-blue-700">Comisión marketplace</p>
                    <p className="text-2xl font-bold text-blue-950">{100 - p.comisionPct}% cobrás</p>
                    <p className="text-xs text-blue-700/70">({p.comisionPct}% comisión AkuoSplash)</p>
                  </div>
                  <div className="rounded-lg bg-white/70 p-3">
                    <p className="text-xs font-medium text-blue-700">MercadoPago Split* <span className="text-amber-700">(próximamente)</span></p>
                    <p className="text-sm text-blue-900">Pago decidido en tu cuenta MP</p>
                    <p className="text-[10px] text-blue-700/60">* Disponible junto con el marketplace. Solo si conectás tu cuenta de MP.</p>
                  </div>
                  <div className="rounded-lg bg-white/70 p-3">
                    <p className="text-xs font-medium text-blue-700">Vehículos y choferes</p>
                    <p className="text-sm text-blue-900">
                      Hasta {p.maxVehiculos} vehículo{p.maxVehiculos > 1 ? "s" : ""} · {p.maxChoferes} chofer{p.maxChoferes > 1 ? "es" : ""}
                    </p>
                  </div>

                  <div className="pt-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700">Herramientas incluidas</p>
                    <ul className="grid grid-cols-1 gap-1.5 text-sm">
                      <li className="flex items-center gap-2"><Check yes={p.incluye.dashboard} /> Dashboard</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.pedidos} /> Pedidos (clientes propios)</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.entregas} /> Entregas (historial)</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.camiones} /> Camiones (gestión)</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.gastos} /> Gastos operativos</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.liquidacion} /> Liquidación</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.clientes} /> Clientes</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.recurrentes} /> Pedidos recurrentes</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.historial} /> Historial de vueltas</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.equipo} /> Equipo (choferes)</li>
                      <li className="flex items-center gap-2"><Check yes={p.incluye.perfil} /> Perfil y configuración</li>
                    </ul>
                  </div>

                  <div className="rounded-lg bg-blue-50/50 p-2.5 text-xs text-blue-700/80">
                    <p className="font-medium text-blue-900">Fee por retiro manual*</p>
                    <p>{feeManualCortoTxt} (todos los planes)</p>
                    <p className="text-[10px] text-blue-700/60 mt-1">* Aplica cuando retirás dinero en vez de recibirlo por MP Split automático.</p>
                  </div>

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
            Los planes se cobran por mes y podés cancelar cuando quieras. MercadoPago Split* estará disponible en los 3 planes junto con el marketplace.
          </p>
          <p className="mt-1 text-center text-[10px] text-blue-700/50">
            * Solo si conectás tu cuenta de MercadoPago desde tu perfil. AkuoSplash no es una herramienta contable. Las ventas del marketplace se reportan al SII (es la ley); las ventas a tus clientes propios no se reportan — vos sos responsable de declararlas.
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
                Cada herramienta del panel resuelve un problema real del reparto de agua: saber cuánto cobraste, no olvidar entregas, liquidar bien a fin de mes y tener tus clientes organizados.
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
                  <p className="mt-1 text-sm text-blue-700/80">Visualizá tus clientes fijos en un mapa interactivo por zona cuando el marketplace esté activo.</p>
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
            Registro 100% online. Empezá gratis con el panel básico de productividad. MercadoPago Split* estará disponible junto con el marketplace. Subí a Premium o Pro cuando quieras más herramientas.
          </p>
          <p className="mt-2 text-xs text-blue-200/70">* Solo si conectás tu cuenta de MercadoPago desde tu perfil. AkuoSplash no es una herramienta contable. Las ventas del marketplace se reportan al SII (es la ley); las ventas a tus clientes propios no se reportan — vos sos responsable de declararlas.</p>
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
