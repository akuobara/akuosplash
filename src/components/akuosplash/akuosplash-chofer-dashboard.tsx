"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Droplets, DollarSign, Wallet, TrendingDown, TrendingUp, Plus, Fuel, Gauge,
  ArrowRight, Banknote, Clock, ChevronDown, ChevronRight, Loader2, Play, Square,
  Truck, User, MessageSquare, Settings,
} from "lucide-react";
import { StatCard } from "./stat-card";
import { akuoGet, akuoPost, akuoApi, formatCLP } from "./akuosplash-utils";
import { toast } from "sonner";

interface Resumen {
  period: string;
  totalVentas: number;
  totalEfectivoRecibido: number;
  totalTransferenciaRecibida: number;
  totalRecibido: number;
  totalPorCobrar: number;
  totalLitros: number;
  totalGastos: number;
  utilidadBruta: number;
  cantidadEntregas: number;
  cantidadVueltas: number;
  gastosPorTipo: Record<string, number>;
  vueltas: Array<{ id: string; numero: number; iniciadaEn: string; cerradaEn: string | null; activa: boolean }>;
}

interface VueltaActual {
  id: string;
  numero: number;
  iniciadaEn: string;
  vehiculo: { id: string; nombre: string; patente: string; capacidadLitros: number } | null;
  litros: number;
  ventas: number;
  efectivo: number;
  transferencia: number;
  numEntregas: number;
}

interface Entrega {
  id: string;
  creadoEn: string;
  clienteNombre: string;
  clienteDireccion: string | null;
  clienteZona: string | null;
  litros: number;
  total: number;
  montoEfectivo: number;
  montoTransferencia: number;
  montoRecibido: number;
  metodoPago: string;
  estadoPago: string;
  nota: string | null;
  vueltaId: string | null;
  cliente: { id: string; nombre: string } | null;
}

interface Gasto {
  id: string;
  fecha: string;
  tipo: string;
  monto: number;
  descripcion: string | null;
  metodoPago: string;
}

const PERIODS = [
  { value: "hoy", label: "Hoy" },
  { value: "ayer", label: "Ayer" },
  { value: "semana", label: "Esta semana (Dom-Sáb)" },
  { value: "semana7", label: "Últimos 7 días" },
  { value: "mes", label: "Este mes" },
  { value: "mes_anterior", label: "Mes anterior" },
  { value: "mes3", label: "Últimos 3 meses" },
  { value: "todo", label: "Todo" },
];

function formatNumber(n: number, dec = 0): string {
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: dec }).format(n);
}

function formatTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

export function AkuosplashChoferDashboard({ user, onLogout, onGoToPerfil, onGoToMensajes, pedidosPendientes = [] }: {
  user: { id: string; nombre: string; email: string | null; rol: string; plan: string };
  onLogout: () => void;
  onGoToPerfil?: () => void;
  onGoToMensajes?: () => void;
  pedidosPendientes?: any[];
}) {
  const router = useRouter();
  const [period, setPeriod] = useState("hoy");
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [recientes, setRecientes] = useState<Entrega[]>([]);
  const [gastosRecientes, setGastosRecientes] = useState<Gasto[]>([]);
  const [vueltaActual, setVueltaActual] = useState<VueltaActual | null>(null);
  const [vueltaExpandida, setVueltaExpandida] = useState<string | null>(null);
  const [entregasVuelta, setEntregasVuelta] = useState<Record<string, Entrega[]>>({});
  const [vueltas, setVueltas] = useState<Resumen["vueltas"]>([]);

  // Modales
  const [entregaFormOpen, setEntregaFormOpen] = useState(false);
  const [gastoFormOpen, setGastoFormOpen] = useState(false);

  const cargarVuelta = useCallback(async () => {
    try {
      const data = await akuoGet<{ vuelta: VueltaActual | null }>(`/api/akuosplash/vueltas/activa?_t=${Date.now()}`);
      setVueltaActual(data.vuelta);
    } catch (e) { console.error(e); }
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [r, ents, gsts, vts] = await Promise.all([
        akuoGet<Resumen>(`/api/akuosplash/reportes/resumen?period=${period}`),
        akuoGet<{ entregas: Entrega[] }>(`/api/akuosplash/entregas?period=${period}`),
        akuoGet<{ gastos: Gasto[] }>(`/api/akuosplash/gastos?period=${period}`),
        akuoGet<{ vueltas: any[] }>(`/api/akuosplash/vueltas?cerradas=true&limit=20`),
      ]);
      setResumen(r);
      setRecientes(ents.entregas.slice(0, 5));
      setGastosRecientes(gsts.gastos.slice(0, 5));
      setVueltas(vts.vueltas || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarVuelta(); }, [cargarVuelta]);

  async function toggleVueltaDetalle(vueltaId: string) {
    if (vueltaExpandida === vueltaId) { setVueltaExpandida(null); return; }
    setVueltaExpandida(vueltaId);
    if (!entregasVuelta[vueltaId]) {
      try {
        const data = await akuoGet<{ entregas: Entrega[] }>(`/api/akuosplash/entregas?period=todo`);
        const deVuelta = data.entregas.filter((e) => e.vueltaId === vueltaId);
        setEntregasVuelta((prev) => ({ ...prev, [vueltaId]: deVuelta }));
      } catch (e) { console.error(e); }
    }
  }

  async function iniciarVuelta() {
    try {
      await akuoPost("/api/akuosplash/vueltas", {});
      toast.success("Vuelta iniciada");
      cargarVuelta();
      cargar();
    } catch (e: any) { toast.error(e.message || "Error"); }
  }

  async function cerrarVuelta() {
    if (!vueltaActual) return;
    try {
      await akuoPost(`/api/akuosplash/vueltas/${vueltaActual.id}/cerrar`, {});
      toast.success("Vuelta cerrada");
      cargarVuelta();
      cargar();
    } catch (e: any) { toast.error(e.message || "Error"); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between sm:px-6">
          <button onClick={() => router.push("/akuosplash")} className="flex items-center gap-2">
            <img src="/akuosplash/logo.png" alt="AkuoSplash" className="h-8 w-auto" />
            <div className="text-left hidden sm:block">
              <p className="font-bold text-blue-600">AkuoSplash</p>
              <p className="-mt-1 text-xs text-gray-400">Repartidor · {user.nombre}</p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            {onGoToMensajes && (
              <Button variant="ghost" size="sm" onClick={onGoToMensajes}>
                <MessageSquare className="h-4 w-4" />
              </Button>
            )}
            {onGoToPerfil && (
              <Button variant="ghost" size="sm" onClick={onGoToPerfil}>
                <User className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onLogout}>Salir</Button>
          </div>
        </div>
      </header>

      {/* Banner superadmin */}
      {user.rol === "superadmin" && (
        <Link href="/akuosplash/superadmin" className="block bg-violet-600 text-white text-xs py-1.5 text-center font-medium hover:bg-violet-700 transition">
          Estás viendo como repartidor (modo superadmin) — Tocá para volver al panel de administración
        </Link>
      )}

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        {/* Encabezado con selector de período + acciones */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold sm:text-xl">Resumen</h2>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"
            >
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <Button size="sm" onClick={() => setEntregaFormOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-1" /> Entrega
            </Button>
            <Button size="sm" variant="outline" onClick={() => setGastoFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Gasto
            </Button>
          </div>
        </div>

        {/* Vuelta actual */}
        <VueltaWidgetAkuo
          vueltaActual={vueltaActual}
          onIniciar={iniciarVuelta}
          onCerrar={cerrarVuelta}
          onRegistrarEntrega={() => setEntregaFormOpen(true)}
          loading={loading}
        />

        {/* Stats principales */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : resumen ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard label="Ventas" value={formatCLP(resumen.totalVentas)} icon={DollarSign} tone="positive" />
            <StatCard label="Litros" value={`${formatNumber(resumen.totalLitros)} L`} icon={Droplets} />
            <StatCard label="Efectivo" value={formatCLP(resumen.totalEfectivoRecibido)} icon={Banknote} tone="positive" />
            <StatCard label="Transferencia" value={formatCLP(resumen.totalTransferenciaRecibida)} icon={Wallet} />
            <StatCard label="Gastos" value={formatCLP(resumen.totalGastos)} icon={TrendingDown} tone="negative" />
            <StatCard label="Utilidad" value={formatCLP(resumen.utilidadBruta)} icon={TrendingUp} tone="positive" />
            <StatCard label="Por cobrar" value={formatCLP(resumen.totalPorCobrar)} icon={Gauge} tone="warning" />
            <StatCard label="Entregas" value={String(resumen.cantidadEntregas)} hint={`${resumen.cantidadVueltas} vueltas`} icon={Truck} />
          </div>
        ) : null}

        {/* Pedidos pendientes del marketplace */}
        {pedidosPendientes.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                Pedidos disponibles ({pedidosPendientes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">Hay pedidos del marketplace esperando ser aceptados.</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => router.push("/akuosplash/transportista?tab=disponibles")}>
                Ver pedidos <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Entregas recientes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Entregas recientes</h3>
          </div>
          {loading ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : recientes.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-gray-400">Sin entregas en este período.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {recientes.map(e => (
                <Card key={e.id} className="border-gray-100">
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold tabular-nums">{formatNumber(e.litros)} L</span>
                        <span className="text-sm text-gray-500">{formatCLP(e.total)}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{e.clienteNombre}</p>
                      <p className="text-[10px] text-gray-400">{new Date(e.creadoEn).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {e.montoEfectivo > 0 && <p className="text-xs text-emerald-600 tabular-nums">Efect: {formatCLP(e.montoEfectivo)}</p>}
                      {e.montoTransferencia > 0 && <p className="text-xs text-blue-600 tabular-nums">Trans: {formatCLP(e.montoTransferencia)}</p>}
                      {e.total - e.montoRecibido > 0 && <p className="text-xs text-amber-600 tabular-nums">Saldo: {formatCLP(e.total - e.montoRecibido)}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Gastos recientes */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Gastos recientes</h3>
          {loading ? (
            <Skeleton className="h-20 rounded-xl" />
          ) : gastosRecientes.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-gray-400">Sin gastos en este período.</CardContent></Card>
          ) : (
            <div className="space-y-1">
              {gastosRecientes.map(g => (
                <Card key={g.id} className="border-gray-100">
                  <CardContent className="p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm capitalize">{g.tipo}</span>
                      {g.descripcion && <span className="text-xs text-gray-400 ml-2">— {g.descripcion}</span>}
                    </div>
                    <span className="font-semibold tabular-nums text-red-600">−{formatCLP(g.monto)}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Vueltas cerradas */}
        {vueltas.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Vueltas</h3>
            <div className="space-y-1">
              {vueltas.map(v => (
                <Card key={v.id} className="border-gray-100">
                  <CardContent className="p-0">
                    <button
                      onClick={() => toggleVueltaDetalle(v.id)}
                      className="w-full p-3 flex items-center justify-between hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        {vueltaExpandida === v.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="font-medium text-sm">Vuelta #{v.numero}</span>
                        {!v.cerradaEn && <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">Activa</Badge>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(v.iniciadaEn)} {formatTime(v.iniciadaEn)}
                        {v.cerradaEn && ` → ${formatTime(v.cerradaEn)}`}
                      </div>
                    </button>
                    {vueltaExpandida === v.id && (
                      <div className="border-t border-gray-100 p-3 space-y-1">
                        {entregasVuelta[v.id]?.length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-2">Sin entregas en esta vuelta.</p>
                        )}
                        {entregasVuelta[v.id]?.map(e => (
                          <div key={e.id} className="flex items-center justify-between text-sm py-1">
                            <span>{e.clienteNombre} — {formatNumber(e.litros)} L</span>
                            <span className="font-medium tabular-nums">{formatCLP(e.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal Registrar Entrega */}
      {entregaFormOpen && (
        <EntregaFormAkuo onClose={() => { setEntregaFormOpen(false); cargar(); cargarVuelta(); }} />
      )}

      {/* Modal Registrar Gasto */}
      {gastoFormOpen && (
        <GastoFormAkuo onClose={() => { setGastoFormOpen(false); cargar(); }} />
      )}
    </div>
  );
}

// === Vuelta Widget simplificado ===
function VueltaWidgetAkuo({ vueltaActual, onIniciar, onCerrar, onRegistrarEntrega, loading }: {
  vueltaActual: VueltaActual | null;
  onIniciar: () => void;
  onCerrar: () => void;
  onRegistrarEntrega: () => void;
  loading: boolean;
}) {
  if (loading && !vueltaActual) return <Skeleton className="h-32 rounded-xl" />;

  if (!vueltaActual) {
    return (
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-sm">No tenés vuelta activa</p>
            <p className="text-xs text-gray-500">Iniciá una vuelta para registrar entregas.</p>
          </div>
          <Button onClick={onIniciar} className="bg-blue-600 hover:bg-blue-700">
            <Play className="h-4 w-4 mr-1" /> Iniciar vuelta
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-500/10 p-2"><Truck className="h-5 w-5 text-emerald-600" /></div>
            <div>
              <p className="font-bold text-sm">Vuelta #{vueltaActual.numero}</p>
              <p className="text-xs text-gray-500">Iniciada {formatTime(vueltaActual.iniciadaEn)}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onCerrar} className="text-red-600 border-red-300 hover:bg-red-50">
            <Square className="h-4 w-4 mr-1" /> Cerrar
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg bg-white/60 p-2 text-center">
            <p className="text-[10px] uppercase text-gray-500">Entregas</p>
            <p className="text-lg font-bold tabular-nums">{vueltaActual.numEntregas}</p>
          </div>
          <div className="rounded-lg bg-white/60 p-2 text-center">
            <p className="text-[10px] uppercase text-gray-500">Litros</p>
            <p className="text-lg font-bold tabular-nums">{formatNumber(vueltaActual.litros)}</p>
          </div>
          <div className="rounded-lg bg-white/60 p-2 text-center">
            <p className="text-[10px] uppercase text-gray-500">Efectivo</p>
            <p className="text-sm font-bold tabular-nums text-emerald-600">{formatCLP(vueltaActual.efectivo)}</p>
          </div>
          <div className="rounded-lg bg-white/60 p-2 text-center">
            <p className="text-[10px] uppercase text-gray-500">Transfer.</p>
            <p className="text-sm font-bold tabular-nums text-blue-600">{formatCLP(vueltaActual.transferencia)}</p>
          </div>
        </div>
        <Button onClick={onRegistrarEntrega} className="w-full bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-1" /> Registrar entrega
        </Button>
      </CardContent>
    </Card>
  );
}

// === Formulario de Entrega simplificado ===
function EntregaFormAkuo({ onClose }: { onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    clienteNombre: "",
    clienteDireccion: "",
    clienteZona: "",
    litros: "",
    precioPorLitro: "",
    montoEfectivo: "",
    montoTransferencia: "",
    metodoPago: "credito",
    nota: "",
  });

  function update(field: string, value: any) { setForm({ ...form, [field]: value }); }

  const litrosNum = Number(form.litros) || 0;
  const precio = Number(form.precioPorLitro) || 0;
  const totalCalculado = Math.round(litrosNum * precio);

  async function guardar() {
    if (!form.clienteNombre.trim() || !litrosNum) { toast.error("Cliente y litros son obligatorios"); return; }
    setSaving(true);
    try {
      await akuoPost("/api/akuosplash/entregas", {
        clienteNombre: form.clienteNombre.trim(),
        clienteDireccion: form.clienteDireccion || undefined,
        clienteZona: form.clienteZona || undefined,
        litros: litrosNum,
        precioPorLitro: precio || undefined,
        total: totalCalculado || undefined,
        montoEfectivo: Number(form.montoEfectivo) || 0,
        montoTransferencia: Number(form.montoTransferencia) || 0,
        montoRecibido: (Number(form.montoEfectivo) || 0) + (Number(form.montoTransferencia) || 0),
        metodoPago: form.metodoPago,
        nota: form.nota || undefined,
      });
      toast.success("Entrega registrada");
      onClose();
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar entrega</DialogTitle>
          <DialogDescription>Cargá los datos de la entrega de agua.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Cliente *</Label>
            <Input value={form.clienteNombre} onChange={(e) => update("clienteNombre", e.target.value)} placeholder="Nombre del cliente" />
          </div>
          <div>
            <Label>Dirección</Label>
            <Input value={form.clienteDireccion} onChange={(e) => update("clienteDireccion", e.target.value)} placeholder="Calle, número" />
          </div>
          <div>
            <Label>Zona</Label>
            <Input value={form.clienteZona} onChange={(e) => update("clienteZona", e.target.value)} placeholder="Sector, comuna" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Litros *</Label>
              <Input type="number" value={form.litros} onChange={(e) => update("litros", e.target.value)} placeholder="1000" />
            </div>
            <div>
              <Label>Precio/L</Label>
              <Input type="number" value={form.precioPorLitro} onChange={(e) => update("precioPorLitro", e.target.value)} placeholder="50" />
            </div>
          </div>
          {totalCalculado > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 text-sm flex justify-between">
              <span>Total</span>
              <span className="font-bold tabular-nums">{formatCLP(totalCalculado)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Efectivo</Label>
              <Input type="number" value={form.montoEfectivo} onChange={(e) => update("montoEfectivo", e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Transferencia</Label>
              <Input type="number" value={form.montoTransferencia} onChange={(e) => update("montoTransferencia", e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <Label>Método de pago</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.metodoPago} onChange={(e) => update("metodoPago", e.target.value)}>
              <option value="credito">Crédito (cuenta corriente)</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="mixto">Mixto</option>
            </select>
          </div>
          <div>
            <Label>Nota</Label>
            <Textarea rows={2} value={form.nota} onChange={(e) => update("nota", e.target.value)} placeholder="Observaciones..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// === Formulario de Gasto simplificado ===
function GastoFormAkuo({ onClose }: { onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ tipo: "combustible", monto: "", descripcion: "", metodoPago: "efectivo" });

  function update(field: string, value: any) { setForm({ ...form, [field]: value }); }

  async function guardar() {
    if (!form.tipo || !form.monto) { toast.error("Tipo y monto son obligatorios"); return; }
    setSaving(true);
    try {
      await akuoPost("/api/akuosplash/gastos", {
        tipo: form.tipo,
        monto: Number(form.monto),
        descripcion: form.descripcion || undefined,
        metodoPago: form.metodoPago,
      });
      toast.success("Gasto registrado");
      onClose();
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar gasto</DialogTitle>
          <DialogDescription>Cargá los gastos operativos (combustible, peajes, etc.).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo *</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.tipo} onChange={(e) => update("tipo", e.target.value)}>
              <option value="combustible">Combustible</option>
              <option value="peaje">Peaje</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="comida">Comida</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <Label>Monto *</Label>
            <Input type="number" value={form.monto} onChange={(e) => update("monto", e.target.value)} placeholder="5000" />
          </div>
          <div>
            <Label>Descripción</Label>
            <Input value={form.descripcion} onChange={(e) => update("descripcion", e.target.value)} placeholder="Detalle opcional" />
          </div>
          <div>
            <Label>Método de pago</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.metodoPago} onChange={(e) => update("metodoPago", e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={saving} variant="outline">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
