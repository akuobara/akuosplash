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
import { formatNumber, formatDate } from "@/lib/helpers";

interface DiaPedido {
  fecha: Date;
  litros: number;
  pedidos: { nombre: string; litros: number; tipo: "recurrente" | "programado" }[];
}

interface CalendarViewProps {
  // Lista de fechas programadas con sus pedidos
  eventos: DiaPedido[];
}

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export function CalendarView({ eventos }: CalendarViewProps) {
  const [fechaActual, setFechaActual] = useState(new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null);

  const year = fechaActual.getFullYear();
  const month = fechaActual.getMonth();

  // Calcular primer día del mes y ajustar para que la semana empiece en lunes
  const primerDia = new Date(year, month, 1);
  const primerDiaSemana = primerDia.getDay() === 0 ? 6 : primerDia.getDay() - 1;

  // Último día del mes
  const ultimoDia = new Date(year, month + 1, 0);
  const diasEnMes = ultimoDia.getDate();

  // Generar array de días (con espacios vacíos al inicio)
  const dias: (Date | null)[] = [];
  for (let i = 0; i < primerDiaSemana; i++) {
    dias.push(null);
  }
  for (let i = 1; i <= diasEnMes; i++) {
    dias.push(new Date(year, month, i));
  }

  // Mapa de eventos por fecha (YYYY-MM-DD)
  const eventosPorFecha = useMemo(() => {
    const map: Record<string, DiaPedido> = {};
    for (const ev of eventos) {
      const key = ev.fecha.toISOString().slice(0, 10);
      if (!map[key]) {
        map[key] = { ...ev, pedidos: [] };
      }
      map[key].pedidos.push(...ev.pedidos);
      map[key].litros += ev.litros;
    }
    return map;
  }, [eventos]);

  function getEventosDia(dia: Date): DiaPedido | null {
    const key = dia.toISOString().slice(0, 10);
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

  // Eventos del día seleccionado
  const eventosSeleccionados = diaSeleccionado ? getEventosDia(diaSeleccionado) : null;

  // Próximos eventos (desde hoy en adelante)
  const proximosEventos = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return eventos
      .filter((e) => e.fecha >= hoy)
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
      .slice(0, 10);
  }, [eventos]);

  return (
    <div className="space-y-4">
      {/* Controles del calendario */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={mesAnterior}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-base font-semibold min-w-[140px] text-center">
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

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Grilla del calendario */}
        <Card>
          <CardContent className="p-3">
            {/* Encabezados de días */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DIAS_SEMANA.map((dia) => (
                <div key={dia} className="text-center text-xs font-medium text-muted-foreground py-1">
                  {dia}
                </div>
              ))}
            </div>
            {/* Días */}
            <div className="grid grid-cols-7 gap-1">
              {dias.map((dia, i) => {
                if (!dia) return <div key={`empty-${i}`} />;
                const eventos = getEventosDia(dia);
                const tieneEventos = !!eventos;
                const esHoyFlag = esHoy(dia);
                const esSeleccionado = diaSeleccionado &&
                  dia.getDate() === diaSeleccionado.getDate() &&
                  dia.getMonth() === diaSeleccionado.getMonth();

                return (
                  <button
                    key={dia.toISOString()}
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
                          {eventos!.pedidos.some((p) => p.tipo === "recurrente") && (
                            <Repeat className="h-2.5 w-2.5 text-primary" />
                          )}
                          {eventos!.pedidos.some((p) => p.tipo === "programado") && (
                            <Clock className="h-2.5 w-2.5 text-blue-500" />
                          )}
                        </div>
                        <p className="text-[9px] font-medium text-muted-foreground truncate">
                          {formatNumber(eventos!.litros, 0)} L
                        </p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Leyenda */}
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

        {/* Panel lateral: detalles del día seleccionado o próximos eventos */}
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
                {proximosEventos.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No hay pedidos programados.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {proximosEventos.map((ev, i) => (
                      <div key={i} className="rounded-lg border border-border p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            {formatDate(ev.fecha)}
                          </span>
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
                    ))}
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
