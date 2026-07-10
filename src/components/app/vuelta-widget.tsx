"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Droplets, Play, Square, Plus, AlertCircle, Truck } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";
import { formatNumber, formatTime } from "@/lib/helpers";
import type { VueltaActual } from "./entrega-form";

export interface CamionOption {
  id: string;
  nombre: string;
  patente: string | null;
  capacidad: number;
  activo: boolean;
}

interface VueltaWidgetProps {
  vueltaActual: VueltaActual | null;
  camiones: CamionOption[];
  onVueltaChange: () => void;
  onRegistrarEntrega: () => void;
}

export function VueltaWidget({
  vueltaActual,
  camiones,
  onVueltaChange,
  onRegistrarEntrega,
}: VueltaWidgetProps) {
  const [iniciando, setIniciando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [confirmarCerrar, setConfirmarCerrar] = useState(false);
  const [confirmarNueva, setConfirmarNueva] = useState(false);
  const [camionSeleccionado, setCamionSeleccionado] = useState<string>("");

  const camionesActivos = (camiones ?? []).filter((c) => c.activo);

  // Si no hay vuelta activa
  if (!vueltaActual) {
    const mostrarSelectorCamion = camionesActivos.length > 1;

    return (
      <>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Droplets className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">No hay vuelta activa</p>
                <p className="text-sm text-muted-foreground">
                  Inicia una vuelta para registrar entregas.
                  {camionesActivos.length === 0 && " Primero agrega un camión en Ajustes."}
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                if (camionesActivos.length === 0) {
                  toast.error("Primero agrega un camión en Ajustes");
                  return;
                }
                if (camionesActivos.length === 1) {
                  setCamionSeleccionado(camionesActivos[0].id);
                }
                setConfirmarNueva(true);
              }}
              disabled={camionesActivos.length === 0}
            >
              <Play className="mr-2 h-4 w-4" /> Iniciar vuelta
            </Button>
          </CardContent>
        </Card>

        <Dialog open={confirmarNueva} onOpenChange={setConfirmarNueva}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Iniciar nueva vuelta</DialogTitle>
              <DialogDescription>
                Se creará una nueva vuelta activa. Podrás registrar entregas asociadas a ella.
                {mostrarSelectorCamion && " Selecciona qué camión usarás en esta vuelta."}
              </DialogDescription>
            </DialogHeader>
            {mostrarSelectorCamion && (
              <div className="space-y-2">
                <Label htmlFor="camionSelect">Camión</Label>
                <Select
                  value={camionSeleccionado || camionesActivos[0]?.id || ""}
                  onValueChange={setCamionSeleccionado}
                >
                  <SelectTrigger id="camionSelect">
                    <SelectValue placeholder="Selecciona un camión" />
                  </SelectTrigger>
                  <SelectContent>
                    {camionesActivos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre} · {formatNumber(c.capacidad, 0)} L
                        {c.patente ? ` · ${c.patente}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmarNueva(false)}>
                Cancelar
              </Button>
              <Button onClick={iniciarVuelta} disabled={iniciando}>
                <Play className="mr-2 h-4 w-4" /> Iniciar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Si hay vuelta activa
  const capacidadCamion = vueltaActual.capacidadCamion || vueltaActual.camion?.capacidad || 0;
  const litrosEntregados = vueltaActual.litros;
  const litrosRestantes = Math.max(0, capacidadCamion - litrosEntregados);
  const porcentajeUsado = capacidadCamion > 0 ? (litrosEntregados / capacidadCamion) * 100 : 0;
  const excede = litrosEntregados > capacidadCamion && capacidadCamion > 0;

  async function iniciarVuelta() {
    setIniciando(true);
    try {
      await apiPost("/api/vueltas", { camionId: camionSeleccionado || undefined });
      toast.success("Vuelta iniciada");
      onVueltaChange();
      setConfirmarNueva(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo iniciar la vuelta");
    } finally {
      setIniciando(false);
    }
  }

  async function cerrarVuelta() {
    if (!vueltaActual) return;
    setCerrando(true);
    try {
      await apiPost(`/api/vueltas/${vueltaActual.id}/cerrar`, {});
      toast.success(`Vuelta #${vueltaActual.numero} cerrada`);
      onVueltaChange();
      setConfirmarCerrar(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cerrar la vuelta");
    } finally {
      setCerrando(false);
    }
  }

  return (
    <>
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Droplets className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-lg">Vuelta #{vueltaActual.numero}</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Activa
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Iniciada {formatTime(vueltaActual.iniciadaEn)} · {vueltaActual.cantidadEntregas} entrega(s)
                  {vueltaActual.camion && (
                    <> · <Truck className="inline h-3 w-3" /> {vueltaActual.camion.nombre}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onRegistrarEntrega} size="sm">
                <Plus className="mr-1 h-4 w-4" /> Entrega
              </Button>
              <Button onClick={() => setConfirmarCerrar(true)} variant="outline" size="sm" disabled={cerrando}>
                <Square className="mr-1 h-4 w-4" /> Cerrar
              </Button>
            </div>
          </div>

          {/* Visualización de capacidad: Salí con X / Entregado Y / Quedan Z */}
          {capacidadCamion > 0 && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md bg-muted/40 p-2">
                  <p className="text-[10px] uppercase text-muted-foreground">Salí con</p>
                  <p className="font-bold tabular-nums">{formatNumber(capacidadCamion, 0)} L</p>
                </div>
                <div className="rounded-md bg-amber-100/60 p-2 dark:bg-amber-900/20">
                  <p className="text-[10px] uppercase text-muted-foreground">Entregado</p>
                  <p className="font-bold tabular-nums text-amber-700 dark:text-amber-300">{formatNumber(litrosEntregados, 0)} L</p>
                </div>
                <div className="rounded-md bg-emerald-100/60 p-2 dark:bg-emerald-900/20">
                  <p className="text-[10px] uppercase text-muted-foreground">Quedan</p>
                  <p className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatNumber(litrosRestantes, 0)} L</p>
                </div>
              </div>

              {/* Barra de progreso visual */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Capacidad usada</span>
                  <span className={excede ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}>
                    {porcentajeUsado.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${excede ? "bg-red-500" : porcentajeUsado >= 90 ? "bg-amber-500" : "bg-primary"}`}
                    style={{ width: `${Math.min(100, porcentajeUsado)}%` }}
                  />
                </div>
                {excede && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="h-3 w-3" />
                    <span>Excede la capacidad del camión — debería cerrar la vuelta y hacer otra.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmarCerrar} onOpenChange={setConfirmarCerrar}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cerrar Vuelta #{vueltaActual.numero}</DialogTitle>
            <DialogDescription>
              Vas a cerrar la vuelta actual con {vueltaActual.cantidadEntregas} entrega(s) y {formatNumber(vueltaActual.litros, 0)} L entregados.
              {vueltaActual.cantidadEntregas === 0 && " Esta vuelta no tiene entregas, igual se cerrará."}
              {" "}Luego podrás iniciar una nueva vuelta cuando recargues agua en la planta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarCerrar(false)}>
              Cancelar
            </Button>
            <Button onClick={cerrarVuelta} disabled={cerrando}>
              <Square className="mr-2 h-4 w-4" /> Cerrar vuelta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmarNueva} onOpenChange={setConfirmarNueva}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Iniciar nueva vuelta</DialogTitle>
            <DialogDescription>
              Se cerrará la vuelta actual (#{vueltaActual.numero}) y se iniciará una nueva.
            </DialogDescription>
          </DialogHeader>
          {camionesActivos.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="camionSelect2">Camión</Label>
              <Select
                value={camionSeleccionado || camionesActivos[0]?.id || ""}
                onValueChange={setCamionSeleccionado}
              >
                <SelectTrigger id="camionSelect2">
                  <SelectValue placeholder="Selecciona un camión" />
                </SelectTrigger>
                <SelectContent>
                  {camionesActivos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre} · {formatNumber(c.capacidad, 0)} L
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarNueva(false)}>
              Cancelar
            </Button>
            <Button onClick={iniciarVuelta} disabled={iniciando}>
              <Play className="mr-2 h-4 w-4" /> Cerrar e iniciar nueva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
