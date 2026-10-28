"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Repeat,
  Clock,
  Droplets,
} from "lucide-react";
import { formatNumber, formatDate } from "@/components/akuosplash/akuosplash-helpers";

interface DiaPedido {
  fecha: Date;
  litros: number;
  pedidos: { nombre: string; litros: number; tipo: "recurrente" | "programado" }[];
}

interface CalendarViewProps {
  eventos: DiaPedido[];
}

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Helper: formatear fecha como YYYY-MM-DD en hora LOCAL (no UTC)
function fechaKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CalendarView({ eventos }: CalendarViewProps) {
  const [fechaActual, setFechaActual] = useState(new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null);

  const year = fechaActual.getFullYear();
  const month = fechaActual.getMonth();

  const primerDia = new Date(year, month, 1);
  const primerDiaSemana = primerDia.getDay() === 0 ? 6 : primerDia.getDay() - 1;
  const ultimoDia = new Date(year, month + 1, 0);
  const diasEnMes = ultimoDia.getDate();

  const dias: (Date | null)[] = [];
  for (let i = 0; i < primerDiaSemana; i++) {
    dias.push(null);
  }
  for (let i = 1; i <= diasEnMes; i++) {
    dias.push(new Date(year, month, i));
  }

  // Mapa de eventos por fecha (usando hora local)
  const eventosPorFecha = useMemo(() => {
    const map: Record<string, DiaPedido> = {};
    for (const ev of eventos) {
      const key = fechaKey(ev.fecha);
      if (!map[key]) {
        map[key] = { fecha: ev.fecha, litros: 0, pedidos: [] };
      }
      map[key].pedidos.push(...ev.pedidos);
      map[key].litros += ev.litros;
    }
    return map;
  }, [eventos]);

  function getEventosDia(dia: Date): DiaPedido | null {
    const key = fechaKey(dia);
    return eventosPorFecha[key] || null;
  }

  function esHoy(dia: Date): boolean {
    const hoy = new Date();
    return dia.getDate() === hoy.getDate() &&
      dia.getMonth() === hoy.getMonth() &&
      dia.getFullYear() === hoy.getFullYear();
  }

  function mesAnterior() {
    setFechaActual(new Date(year, month - 1, 1));
    setDiaSeleccionado(null);
  }

  function mesSiguiente() {
    setFechaActual(new Date(year, month + 1, 1));
    setDiaSeleccionado(null);
  }

  function irHoy() {
    setFechaActual(new Date());
    setDiaSeleccionado(null);
  }

  const eventosSeleccionados = diaSeleccionado ? getEventosDia(diaSeleccionado) : null;

  // Próximos eventos ordenados por fecha
  const proximosEventos = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return eventos
      .filter((e) => {
        const f = new Date(e.fecha);
        f.setHours(0, 0, 0, 0);
        return f >= hoy;
      })
      .sort((a, b) => {
        const fa = new Date(a.fecha); fa.setHours(0,0,0,0);
        const fb = new Date(b.fecha); fb.setHours(0,0,0,0);
        return fa.getTime() - fb.getTime();
      })
      .slice(0, 15);
  }, [eventos]);

  // Agrupar próximos eventos por fecha
  const proximosAgrupados = useMemo(() => {
    const map: Record<string, DiaPedido> = {};
    for (const ev of proximosEventos) {
      const key = fechaKey(ev.fecha);
      if (!map[key]) {
        map[key] = { fecha: ev.fecha, litros: 0, pedidos: [] };
      }
      map[key].pedidos.push(...ev.pedidos);
      map[key].litros += ev.litros;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [proximosEventos]);

  return (
    <div className="space-y-4">
      {/* Controles del calendario */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={mesAnterior}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="min-w-[140px] text-center text-base font-semibold">
            {MESES[month]} {year}
          </h3>
          <Button variant="outline" size="icon" onClick={mesSiguiente}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={irHoy}>
          Hoy
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Grilla del calendario */}
        <Card>
          <CardContent className="p-3">
            <div className="mb-1 grid grid-cols-7 gap-1">
              {DIAS_SEMANA.map((dia) => (
                <div key={dia} className="py-1 text-center text-xs font-medium text-muted-foreground">
                  {dia}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {dias.map((dia, i) => {
                if (!dia) return <div key={`empty-${i}`} />;
                const evs = getEventosDia(dia);
                const tieneEventos = !!evs;
                const esHoyFlag = esHoy(dia);
                const esSeleccionado = diaSeleccionado &&
                  dia.getDate() === diaSeleccionado.getDate() &&
                  dia.getMonth() === diaSeleccionado.getMonth() &&
                  dia.getFullYear() === diaSeleccionado.getFullYear();

                return (
                  <button
                    key={fechaKey(dia)}
                    type="button"
                    onClick={() => setDiaSeleccionado(dia)}
                    className={`relative aspect-square rounded-lg border p-1 text-left transition ${
                      esSeleccionado
                        ? "border-primary bg-primary/10"
                        : tieneEventos
                        ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                        : "border-border hover:bg-muted/30"
                    } ${esHoyFlag ? "ring-2 ring-primary ring-offset-1" : ""}`}
                  >
                    <span className={`text-xs ${esHoyFlag ? "font-bold text-primary" : ""}`}>
                      {dia.getDate()}
                    </span>
                    {tieneEventos && (
                      <div className="absolute bottom-1 left-1 right-1">
                        <div className="flex items-center gap-0.5">
                          {evs!.pedidos.some((p) => p.tipo === "recurrente") && (
                            <Repeat className="h-2.5 w-2.5 text-primary" />
                          )}
                          {evs!.pedidos.some((p) => p.tipo === "programado") && (
                            <Clock className="h-2.5 w-2.5 text-blue-500" />
                          )}
                        </div>
                        <p className="truncate text-[9px] font-medium text-muted-foreground">
                          {formatNumber(evs!.litros, 0)} L
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Repeat className="h-3 w-3 text-primary" /> Recurrente
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-blue-500" /> Programado
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Panel lateral */}
        <Card>
          <CardContent className="p-3">
            {eventosSeleccionados ? (
              <>
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  {formatDate(diaSeleccionado!)}
                </p>
                <div className="space-y-2">
                  {eventosSeleccionados.pedidos.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                        p.tipo === "recurrente" ? "bg-primary/10 text-primary" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                      }`}>
                        {p.tipo === "recurrente" ? <Repeat className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          <Droplets className="mr-0.5 inline h-3 w-3" />
                          {formatNumber(p.litros, 0)} L
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {p.tipo === "recurrente" ? "Recurrente" : "Programado"}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-lg bg-muted/40 p-2 text-center text-sm">
                  <span className="text-muted-foreground">Total del día: </span>
                  <strong className="tabular-nums">{formatNumber(eventosSeleccionados.litros, 0)} L</strong>
                </div>
              </>
            ) : (
              <>
                <p className="mb-2 flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
                  <Calendar className="h-3 w-3" /> Próximos pedidos programados
                </p>
                {proximosAgrupados.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No hay pedidos programados.
                  </p>
                ) : (
                  <div className="max-h-[450px] space-y-2 overflow-y-auto">
                    {proximosAgrupados.map(([key, ev]) => {
                      const f = new Date(key + "T12:00:00");
                      const hoy = new Date();
                      hoy.setHours(0,0,0,0);
                      const diff = Math.round((f.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                      const etiqueta = diff === 0 ? "Hoy" : diff === 1 ? "Mañana" : diff === 7 ? "En 1 semana" : `En ${diff} días`;

                      return (
                        <div key={key} className="rounded-lg border border-border p-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-medium">{formatDate(f)}</span>
                              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{etiqueta}</span>
                            </div>
                            <span className="text-xs font-bold tabular-nums">
                              {formatNumber(ev.litros, 0)} L
                            </span>
                          </div>
                          <div className="mt-1 space-y-0.5">
                            {ev.pedidos.map((p, j) => (
                              <div key={j} className="flex items-center gap-1.5 text-xs">
                                {p.tipo === "recurrente" ? (
                                  <Repeat className="h-3 w-3 shrink-0 text-primary" />
                                ) : (
                                  <Clock className="h-3 w-3 shrink-0 text-blue-500" />
                                )}
                                <span className="truncate">{p.nombre}</span>
                                <span className="ml-auto text-muted-foreground">{formatNumber(p.litros, 0)} L</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
