"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Truck,
  Droplets,
  Calendar,
  ShieldCheck,
  Wrench,
  ClipboardList,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch } from "@/components/akuosplash/akuosplash-api-client";
import { formatNumber, formatDateTime } from "@/components/akuosplash/akuosplash-helpers";

interface Camion {
  id: string;
  nombre: string;
  patente: string | null;
  capacidad: number;
  activo: boolean;
  marca?: string | null;
  modelo?: string | null;
  anio?: number | null;
  color?: string | null;
  numeroMotor?: string | null;
  numeroChasis?: string | null;
  permisoCirculacionVencimiento?: string | null;
  revisionTecnicaVencimiento?: string | null;
  seguroVencimiento?: string | null;
  seguroCompania?: string | null;
  seguroNumero?: string | null;
}

interface BitacoraEntrada {
  id: string;
  creadoEn: string;
  tipo: string;
  descripcion: string;
  severidad: string | null;
  resuelta: boolean;
  resueltaEn: string | null;
  autor: { id: string; nombre: string; role: string };
  resueltaPor: { id: string; nombre: string } | null;
}

interface CamionWidgetProps {
  camiones: Camion[];
  isDueno: boolean;
  refreshKey: number;
}

const TIPOS_BITACORA: { value: string; label: string; color: string }[] = [
  { value: "falla_mecanica", label: "Falla mecánica", color: "text-red-600 border-red-300" },
  { value: "mantenimiento", label: "Mantenimiento", color: "text-blue-600 border-blue-300" },
  { value: "observacion", label: "Observación", color: "text-amber-600 border-amber-300" },
  { value: "otro", label: "Otro", color: "text-muted-foreground" },
];

const SEVERIDADES = ["baja", "media", "alta", "critica"];

function labelTipo(tipo: string): string {
  return TIPOS_BITACORA.find((t) => t.value === tipo)?.label ?? tipo;
}

function colorTipo(tipo: string): string {
  return TIPOS_BITACORA.find((t) => t.value === tipo)?.color ?? "text-muted-foreground";
}

function colorSeveridad(sev: string | null): string {
  if (!sev) return "";
  switch (sev) {
    case "critica":
      return "text-red-700 bg-red-100 border-red-300 dark:text-red-300 dark:bg-red-900/30 dark:border-red-800";
    case "alta":
      return "text-orange-700 bg-orange-100 border-orange-300 dark:text-orange-300 dark:bg-orange-900/30 dark:border-orange-800";
    case "media":
      return "text-amber-700 bg-amber-100 border-amber-300 dark:text-amber-300 dark:bg-amber-900/30 dark:border-amber-800";
    case "baja":
      return "text-blue-700 bg-blue-100 border-blue-300 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-800";
    default:
      return "";
  }
}

function estadoVencimiento(fecha?: string | null): { vencido: boolean; porVencer: boolean; dias: number } {
  if (!fecha) return { vencido: false, porVencer: false, dias: Infinity };
  const venc = new Date(fecha);
  const hoy = new Date();
  const dias = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  return { vencido: dias < 0, porVencer: dias >= 0 && dias <= 30, dias };
}

export function CamionWidget({ camiones, isDueno, refreshKey }: CamionWidgetProps) {
  const [camionSeleccionadoId, setCamionSeleccionadoId] = useState<string>("");
  const [bitacora, setBitacora] = useState<BitacoraEntrada[]>([]);
  const [cargandoBitacora, setCargandoBitacora] = useState(false);
  const [mostrarBitacora, setMostrarBitacora] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [nuevaEntradaOpen, setNuevaEntradaOpen] = useState(false);

  // Form nueva entrada
  const [tipoEntrada, setTipoEntrada] = useState("observacion");
  const [severidadEntrada, setSeveridadEntrada] = useState("");
  const [descripcionEntrada, setDescripcionEntrada] = useState("");
  const [saving, setSaving] = useState(false);

  const camionesActivos = camiones.filter((c) => c.activo);

  // Seleccionar automáticamente el primer camión activo si no hay selección
  useEffect(() => {
    if (!camionSeleccionadoId && camionesActivos.length > 0) {
      setCamionSeleccionadoId(camionesActivos[0].id);
    }
  }, [camionesActivos, camionSeleccionadoId]);

  const camionActual = camionesActivos.find((c) => c.id === camionSeleccionadoId) ?? camionesActivos[0];

  const cargarBitacora = useCallback(async () => {
    if (!camionActual) return;
    setCargandoBitacora(true);
    try {
      const data = await apiGet<{ entradas: BitacoraEntrada[] }>(`/api/akuosplash/vehiculos/${camionActual.id}/bitacora`);
      setBitacora(data.entradas);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar la bitácora");
    } finally {
      setCargandoBitacora(false);
    }
  }, [camionActual]);

  useEffect(() => {
    if (camionActual && mostrarBitacora) {
      cargarBitacora();
    }
  }, [camionActual, mostrarBitacora, cargarBitacora, refreshKey]);

  async function handleGuardarEntrada(e: React.FormEvent) {
    e.preventDefault();
    if (!camionActual) return;
    if (!descripcionEntrada.trim()) {
      toast.error("La descripción es obligatoria");
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/api/akuosplash/vehiculos/${camionActual.id}/bitacora`, {
        tipo: tipoEntrada,
        severidad: severidadEntrada || null,
        descripcion: descripcionEntrada.trim(),
      });
      toast.success("Entrada registrada");
      setNuevaEntradaOpen(false);
      setTipoEntrada("observacion");
      setSeveridadEntrada("");
      setDescripcionEntrada("");
      cargarBitacora();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar la entrada");
    } finally {
      setSaving(false);
    }
  }

  async function toggleResuelta(entrada: BitacoraEntrada) {
    if (!camionActual) return;
    if (!isDueno) {
      toast.error("Solo el dueño puede marcar entradas como resueltas");
      return;
    }
    try {
      await apiPatch(`/api/akuosplash/vehiculos/${camionActual.id}/bitacora?entradaId=${entrada.id}`, {
        resuelta: !entrada.resuelta,
      });
      cargarBitacora();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  }

  if (camionesActivos.length === 0) {
    return null; // El aviso ya lo muestra el dashboard
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setExpandido(!expandido)}
            className="flex items-center gap-2 hover:text-primary transition"
          >
            <Truck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Mi camión</CardTitle>
            {expandido ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <Button onClick={() => setNuevaEntradaOpen(true)} size="sm" variant="outline">
            <Plus className="mr-1 h-4 w-4" /> Reportar
          </Button>
        </div>
      </CardHeader>
      {expandido && (
      <CardContent>
        {/* Selector de camión si hay más de uno */}
        {camionesActivos.length > 1 && (
          <div className="mb-3 space-y-1.5">
            <Label className="text-xs">Camión</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={camionSeleccionadoId}
              onChange={(e) => setCamionSeleccionadoId(e.target.value)}
            >
              {camionesActivos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}{c.patente ? ` · ${c.patente}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {camionActual && (
          <div className="space-y-3">
            {/* Identidad del camión */}
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Truck className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-base leading-tight">{camionActual.nombre}</p>
                  {camionActual.patente && (
                    <Badge variant="outline" className="text-[10px] mt-1">{camionActual.patente}</Badge>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {camionActual.marca && (
                      <span>{camionActual.marca}{camionActual.modelo ? ` ${camionActual.modelo}` : ""}{camionActual.anio ? ` ${camionActual.anio}` : ""}</span>
                    )}
                    {camionActual.color && <span>· {camionActual.color}</span>}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs">
                    <Droplets className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">Capacidad: {formatNumber(camionActual.capacidad, 0)} L</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Documentos del vehículo */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-medium uppercase text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Documentos
              </p>
              <div className="grid gap-1.5 sm:grid-cols-3">
                <DocStatus
                  icon={<Calendar className="h-3 w-3" />}
                  label="Perm. circ."
                  fecha={camionActual.permisoCirculacionVencimiento}
                />
                <DocStatus
                  icon={<Wrench className="h-3 w-3" />}
                  label="Rev. técnica"
                  fecha={camionActual.revisionTecnicaVencimiento}
                />
                <DocStatus
                  icon={<ShieldCheck className="h-3 w-3" />}
                  label="Seguro"
                  fecha={camionActual.seguroVencimiento}
                />
              </div>
              {camionActual.seguroCompania && (
                <p className="text-[10px] text-muted-foreground">
                  Seguro: {camionActual.seguroCompania}{camionActual.seguroNumero ? ` · póliza ${camionActual.seguroNumero}` : ""}
                </p>
              )}
            </div>

            {/* Datos técnicos (colapsable) */}
            {(camionActual.numeroMotor || camionActual.numeroChasis) && (
              <div className="rounded-lg border border-border p-3 space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Identificación</p>
                <div className="grid gap-1 sm:grid-cols-2 text-xs">
                  {camionActual.numeroMotor && (
                    <div>
                      <span className="text-muted-foreground">N° Motor: </span>
                      <span className="font-mono">{camionActual.numeroMotor}</span>
                    </div>
                  )}
                  {camionActual.numeroChasis && (
                    <div>
                      <span className="text-muted-foreground">N° Chasis/VIN: </span>
                      <span className="font-mono">{camionActual.numeroChasis}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bitácora (colapsable) */}
            <div className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setMostrarBitacora(!mostrarBitacora)}
                className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/30"
              >
                <span className="flex items-center gap-2">
                  {mostrarBitacora ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <ClipboardList className="h-4 w-4" />
                  Bitácora del camión
                </span>
                <span className="text-xs text-muted-foreground">
                  {bitacora.filter((b) => !b.resuelta).length} pendiente(s)
                </span>
              </button>
              {mostrarBitacora && (
                <div className="border-t border-border p-3 space-y-2">
                  {cargandoBitacora ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 rounded-lg" />
                      <Skeleton className="h-16 rounded-lg" />
                    </div>
                  ) : bitacora.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Sin entradas en la bitácora. Usa “Reportar” para registrar una falla, mantenimiento u observación.
                    </p>
                  ) : (
                    <ul className="space-y-2 max-h-[300px] overflow-y-auto">
                      {bitacora.map((b) => (
                        <li key={b.id} className={`rounded-lg border p-2.5 text-sm ${b.resuelta ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10" : "border-border"}`}>
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() => toggleResuelta(b)}
                              className="mt-0.5 shrink-0"
                              title={isDueno ? (b.resuelta ? "Marcar como no resuelta" : "Marcar como resuelta") : "Solo el dueño puede cambiar el estado"}
                            >
                              {b.resuelta ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className={`text-[10px] ${colorTipo(b.tipo)}`}>
                                  {labelTipo(b.tipo)}
                                </Badge>
                                {b.severidad && (
                                  <Badge variant="outline" className={`text-[10px] ${colorSeveridad(b.severidad)}`}>
                                    {b.severidad}
                                  </Badge>
                                )}
                                {b.resuelta && (
                                  <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-800">
                                    Resuelta
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 text-sm whitespace-pre-wrap break-words">{b.descripcion}</p>
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                {b.autor.nombre} · {formatDateTime(b.creadoEn)}
                                {b.resuelta && b.resueltaPor && b.resueltaEn && ` · resuelta por ${b.resueltaPor.nombre} el ${formatDateTime(b.resueltaEn)}`}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
      )}

      {/* Diálogo: nueva entrada de bitácora */}
      <Dialog open={nuevaEntradaOpen} onOpenChange={setNuevaEntradaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reportar en bitácora</DialogTitle>
            <DialogDescription>
              Registra una falla, mantenimiento u observación sobre {camionActual?.nombre}. El dueño verá esta entrada.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGuardarEntrada} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tipoEntrada" className="text-xs">Tipo</Label>
              <select
                id="tipoEntrada"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={tipoEntrada}
                onChange={(e) => setTipoEntrada(e.target.value)}
              >
                {TIPOS_BITACORA.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="severidadEntrada" className="text-xs">Severidad (opcional)</Label>
              <select
                id="severidadEntrada"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={severidadEntrada}
                onChange={(e) => setSeveridadEntrada(e.target.value)}
              >
                <option value="">— Sin severidad —</option>
                {SEVERIDADES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcionEntrada" className="text-xs">Descripción *</Label>
              <textarea
                id="descripcionEntrada"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={descripcionEntrada}
                onChange={(e) => setDescripcionEntrada(e.target.value)}
                placeholder="Ej: Frenos hacen ruido al frenar en bajada. Llevar a taller."
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNuevaEntradaOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DocStatus({ icon, label, fecha }: { icon: React.ReactNode; label: string; fecha?: string | null }) {
  const { vencido, porVencer, dias } = estadoVencimiento(fecha);
  if (!fecha) {
    return (
      <div className="rounded-md border border-border p-2">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">{icon} {label}</div>
        <p className="text-xs font-medium text-muted-foreground">Sin registro</p>
      </div>
    );
  }
  return (
    <div className={`rounded-md border p-2 ${vencido ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20" : porVencer ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20" : "border-border"}`}>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">{icon} {label}</div>
      {vencido ? (
        <p className="text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-0.5">
          <AlertTriangle className="h-3 w-3" /> Vencido
        </p>
      ) : porVencer ? (
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
          Vence en {dias}d
        </p>
      ) : (
        <p className="text-xs font-medium text-muted-foreground">
          {new Date(fecha).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </p>
      )}
    </div>
  );
}
