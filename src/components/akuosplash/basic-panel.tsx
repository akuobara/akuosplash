"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Crown, Truck, FileText, ChevronRight, Loader2, AlertCircle, CheckCircle2,
} from "lucide-react";
import { akuoGet, formatCLP } from "@/components/akuosplash/akuosplash-utils";
import type { PlanConfig, PlanId } from "@/lib/akuosplash-plans";

interface BasicPanelProps {
  user: any;
  plan: PlanConfig;
  planId: PlanId;
  onGoToSubscripcion: () => void;
  onGoToPedidos: () => void;
  onGoToVehiculo: () => void;
  onGoToPerfil: () => void;
}

interface MarketplaceStats {
  pedidosPendientes: number;
  pedidosAceptados: number;
  pedidosEnRuta: number;
  totalEntregas: number;
}

// Datos dinámicos de los 3 planes (cargados desde /api/akuosplash/planes)
interface PlanPublico {
  comisionPct: number;
  precioMensual: number;
}
interface PlanesData {
  gratis?: PlanPublico;
  premium?: PlanPublico;
  pro?: PlanPublico;
}

export function BasicPanel({ user, plan, planId, onGoToSubscripcion, onGoToPedidos, onGoToVehiculo, onGoToPerfil }: BasicPanelProps) {
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [planesData, setPlanesData] = useState<PlanesData>({});

  useEffect(() => {
    // Cargar valores publicados de los 3 planes para mostrar en el banner de upgrade
    fetch("/api/akuosplash/planes", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.planes && Array.isArray(d.planes)) {
          const obj: PlanesData = {};
          for (const p of d.planes) {
            obj[p.id] = { comisionPct: p.comisionPct, precioMensual: p.precioMensual };
          }
          setPlanesData(obj);
        }
      })
      .catch(() => {});
    (async () => {
      try {
        // Cargar stats básicas del marketplace (cuántos pedidos pendientes tengo)
        const data = await akuoGet<{ pedidos?: any[]; stats?: any }>("/api/akuosplash/transportista/pedidos");
        const pedidos = data.pedidos || [];
        setStats({
          pedidosPendientes: pedidos.filter((p: any) => p.estado === "pendiente").length,
          pedidosAceptados: pedidos.filter((p: any) => p.estado === "aceptado").length,
          pedidosEnRuta: pedidos.filter((p: any) => p.estado === "en_ruta").length,
          totalEntregas: pedidos.filter((p: any) => p.estado === "entregado").length,
        });
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Verificar que el transportista tiene los requisitos para marketplace
  // El chofer debe ser persona natural (RUT + licencia), separado de la empresa
  const tieneEmpresa = !!(user?.rutEmpresa && user?.razonSocial);
  const tieneChofer = !!(user?.rut && user?.licenciaConducirUrl);
  const tieneVehiculo = !!(user?.patenteVehiculo && user?.capacidadVehiculoKg);
  const perfilCompleto = tieneEmpresa && tieneChofer && tieneVehiculo;

  return (
    <div className="space-y-4">
      {/* Estado del perfil */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-blue-600" /> Estado del registro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground mb-2">
            Para participar en el marketplace (próximamente) necesitás tener registrados: tu empresa, un chofer (persona natural con su propio RUT + licencia) y un vehículo.
          </p>
          <Row label="Empresa (RUT + razón social)" ok={!!(user?.rutEmpresa && user?.razonSocial)} onClick={onGoToPerfil} />
          <Row label="Chofer (persona natural — RUT + licencia)" ok={!!(user?.rut && user?.licenciaConducirUrl)} onClick={onGoToPerfil} />
          <Row label="Vehículo (patente + capacidad)" ok={!!(user?.patenteVehiculo && user?.capacidadVehiculoKg)} onClick={onGoToVehiculo} />
          {perfilCompleto ? (
            <EstadoAprobacionBanner
              estado={user?.estadoAprobacion || "pendiente"}
              nota={user?.estadoAprobacionNota}
              actualizadoEn={user?.estadoAprobacionActualizadoEn}
            />
          ) : (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-2 mt-2 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900">
                Te falta completar el registro para poder aceptar pedidos del marketplace.
                <br />
                <span className="font-medium">Importante:</span> el chofer debe ser una persona natural (no la empresa), aunque seas el representante legal.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pedidos del marketplace */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">📦 Pedidos del marketplace</CardTitle>
            <Button variant="ghost" size="sm" onClick={onGoToPedidos} className="text-xs">
              Ver todos <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : stats ? (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Pendientes" value={stats.pedidosPendientes} color="amber" />
              <Stat label="Aceptados" value={stats.pedidosAceptados} color="blue" />
              <Stat label="Entregados" value={stats.totalEntregas} color="emerald" />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No se pudo cargar</p>
          )}
          <Button variant="outline" size="sm" className="w-full mt-3" onClick={onGoToPedidos}>
            Ver pedidos disponibles
          </Button>
        </CardContent>
      </Card>

      {/* CTA upgrade */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-violet-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Crown className="h-8 w-8 text-violet-600 shrink-0 mt-1" />
            <div className="flex-1">
              <p className="font-semibold">Subí a Premium o Pro</p>
              <p className="text-xs text-muted-foreground mt-1">
                Desbloqueá gastos, clientes, pedidos recurrentes, historial, liquidación y equipo. Comisión reducida en cada venta del marketplace.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <div className="rounded-md border border-blue-200 bg-white p-2 text-xs">
                  <p className="font-medium text-blue-700">⭐ Premium</p>
                  <p className="text-[10px] text-muted-foreground">{planesData.premium?.comisionPct ?? 12.5}% comisión · MP Split*</p>
                  <p className="font-bold tabular-nums mt-0.5">{formatCLP(planesData.premium?.precioMensual ?? 7990)}/mes</p>
                </div>
                <div className="rounded-md border border-violet-200 bg-white p-2 text-xs">
                  <p className="font-medium text-violet-700">👑 Pro</p>
                  <p className="text-[10px] text-muted-foreground">{planesData.pro?.comisionPct ?? 8.5}% comisión · MP Split*</p>
                  <p className="font-bold tabular-nums mt-0.5">{formatCLP(planesData.pro?.precioMensual ?? 23990)}/mes</p>
                </div>
              </div>
              <Button size="sm" className="w-full mt-3" onClick={onGoToSubscripcion}>
                Ver planes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, ok, onClick }: { label: string; ok: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between rounded-md border border-border p-2 hover:bg-gray-50 transition text-left"
    >
      <span className="text-xs flex items-center gap-1.5">
        {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-600" />}
        {label}
      </span>
      <span className={`text-[10px] font-semibold ${ok ? "text-emerald-700" : "text-amber-700"}`}>
        {ok ? "✓ Completo" : "Falta →"}
      </span>
    </button>
  );
}

function EstadoAprobacionBanner({ estado, nota, actualizadoEn }: { estado: string; nota?: string | null; actualizadoEn?: string | Date | null; }) {
  // Mapa de estados → color + ícono + título + descripción
  // (cuenta de prueba es un flag aparte, no un estado)
  const config: Record<string, { color: string; border: string; bg: string; iconColor: string; title: string; desc: string }> = {
    pendiente: {
      color: "text-amber-800",
      border: "border-amber-300",
      bg: "bg-amber-50",
      iconColor: "text-amber-600",
      title: "En espera de aprobación",
      desc: "Tu registro está completo. El equipo de AkuoSplash va a revisar tu cuenta y aprobarla para que puedas participar del marketplace cuando esté disponible.",
    },
    pre_aprobado: {
      color: "text-blue-800",
      border: "border-blue-300",
      bg: "bg-blue-50",
      iconColor: "text-blue-600",
      title: "Pre-aprobado",
      desc: "Tu cuenta cumple con los requisitos y está pre-aprobada. Vas a poder acceder al marketplace cuando esté disponible en tu zona. El acceso puede demorar si tu zona todavía no está habilitada.",
    },
    aprobado: {
      color: "text-emerald-800",
      border: "border-emerald-300",
      bg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      title: "Aprobado",
      desc: "Tu cuenta está aprobada. Vas a poder acceder al marketplace cuando esté disponible en tu zona.",
    },
    rechazado: {
      color: "text-red-800",
      border: "border-red-300",
      bg: "bg-red-50",
      iconColor: "text-red-600",
      title: "Rechazado",
      desc: "Tu cuenta fue rechazada para participar del marketplace. Revisá la nota del equipo o contactá soporte para más info.",
    },
  };
  const c = config[estado] || config.pendiente;
  return (
    <div className="space-y-2 mt-3">
      <div className={`rounded-md ${c.bg} border ${c.border} p-2.5`}>
        <div className="flex items-start gap-2">
          <CheckCircle2 className={`h-4 w-4 ${c.iconColor} shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold ${c.color}`}>{c.title}</p>
            <p className={`text-[11px] ${c.color} mt-0.5`}>{c.desc}</p>
            {nota && (
              <p className={`text-[10px] ${c.color} mt-1.5 italic opacity-80`}>Nota: {nota}</p>
            )}
            {actualizadoEn && (
              <p className={`text-[10px] ${c.color} opacity-60 mt-0.5`}>
                Actualizado: {new Date(actualizadoEn).toLocaleString("es-CL")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-md border border-${color}-200 bg-${color}-50 p-2 text-center`}>
      <p className={`text-2xl font-bold tabular-nums text-${color}-700`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}
