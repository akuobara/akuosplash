"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Camera,
  X,
  MapPin,
  Navigation,
  Package,
  Home,
  Mountain,
  Banknote,
  Smartphone,
  Clock,
  AlertTriangle,
  Truck,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { apiPost, uploadFile } from "@/lib/api-client";
import {
  formatCurrency,
  formatNumber,
} from "@/lib/helpers";
import type { VueltaActual } from "./entrega-form";

// === Tipos de transporte soportados ===
type TipoTransporte = "flete" | "mudanza" | "aridos";

const TIPOS_LABEL: Record<TipoTransporte, { label: string; icon: string }> = {
  flete: { label: "Flete", icon: "📦" },
  mudanza: { label: "Mudanza", icon: "🏠" },
  aridos: { label: "Áridos", icon: "⛰️" },
};

const MATERIALES_ARIDOS = [
  { value: "arena", label: "Arena" },
  { value: "ripio", label: "Ripio" },
  { value: "tierra", label: "Tierra" },
  { value: "gravilla", label: "Gravilla" },
  { value: "otros", label: "Otros" },
];

const TIPOS_CARGA_FLETE = [
  { value: "general", label: "General" },
  { value: "materiales_construccion", label: "Materiales de construcción" },
  { value: "madera", label: "Madera" },
  { value: "mobiliario", label: "Mobiliario" },
  { value: "escombros", label: "Escombros" },
  { value: "otros", label: "Otros" },
];

const UNIDADES_VOLUMEN = [
  { value: "m3", label: "m³" },
  { value: "kg", label: "kg" },
  { value: "toneladas", label: "toneladas" },
];

interface ClienteOption {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  zona: string | null;
}

interface EntregaMultiFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  clientes: ClienteOption[];
  config: {
    tipoTransporte?: string | null;
    tiposTransporteActivos?: string | null;
  };
  vueltaActual?: VueltaActual | null;
  isDueno?: boolean;
}

export function EntregaMultiForm({
  open,
  onOpenChange,
  onSaved,
  clientes,
  config,
  vueltaActual,
  isDueno = false,
}: EntregaMultiFormProps) {
  // Tipos activos desde la config (JSON string) → array de tipos habilitados (sin aljibe)
  const tiposActivos = useMemo<TipoTransporte[]>(() => {
    let arr: string[] = [];
    try {
      if (config.tiposTransporteActivos) {
        const parsed = JSON.parse(config.tiposTransporteActivos);
        if (Array.isArray(parsed)) arr = parsed;
      }
    } catch {
      // ignore
    }
    if (arr.length === 0) {
      // fallback: usar tipoTransporte individual
      const t = config.tipoTransporte || "flete";
      arr = [t];
    }
    // filtrar aljibe (este form NO maneja aljibe)
    const filtered = arr.filter((t) => t !== "aljibe") as TipoTransporte[];
    if (filtered.length === 0) return ["flete"];
    return filtered;
  }, [config.tiposTransporteActivos, config.tipoTransporte]);

  // === Estado del formulario ===
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoTransporte>("flete");
  const [clienteId, setClienteId] = useState<string>("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteZona, setClienteZona] = useState("");

  // Método de pago
  // efectivo: solo montoEfectivo
  // transferencia: solo montoTransferencia
  // sin_pago (credito): ambos 0
  const [metodoPago, setMetodoPago] = useState<string>("efectivo");
  const [montoEfectivo, setMontoEfectivo] = useState<string>("");
  const [montoTransferencia, setMontoTransferencia] = useState<string>("");

  // Foto de respaldo
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  // Nota
  const [nota, setNota] = useState("");

  // Campos Flete
  const [fleteOrigen, setFleteOrigen] = useState("");
  const [fleteDestino, setFleteDestino] = useState("");
  const [fleteTipoCarga, setFleteTipoCarga] = useState("general");
  const [fleteVolumen, setFleteVolumen] = useState("");
  const [fleteUnidad, setFleteUnidad] = useState("m3");
  const [fletePrecio, setFletePrecio] = useState("");

  // Campos Mudanza
  const [mudOrigen, setMudOrigen] = useState("");
  const [mudDestino, setMudDestino] = useState("");
  const [mudVolumen, setMudVolumen] = useState("");
  const [mudHoras, setMudHoras] = useState("");
  const [mudPersonal, setMudPersonal] = useState("");
  const [mudPrecio, setMudPrecio] = useState("");

  // Campos Áridos
  const [ariOrigen, setAriOrigen] = useState("");
  const [ariDestino, setAriDestino] = useState("");
  const [ariMaterial, setAriMaterial] = useState("arena");
  const [ariToneladas, setAriToneladas] = useState("");
  const [ariPrecioTonelada, setAriPrecioTonelada] = useState("");

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Resetear formulario al abrir/cerrar
  useEffect(() => {
    if (!open) {
      // reset tras cerrar
      setTimeout(() => {
        setClienteId("");
        setClienteNombre("");
        setClienteDireccion("");
        setClienteTelefono("");
        setClienteZona("");
        setMetodoPago("efectivo");
        setMontoEfectivo("");
        setMontoTransferencia("");
        setFotoUrl(null);
        setNota("");
        setFleteOrigen("");
        setFleteDestino("");
        setFleteTipoCarga("general");
        setFleteVolumen("");
        setFleteUnidad("m3");
        setFletePrecio("");
        setMudOrigen("");
        setMudDestino("");
        setMudVolumen("");
        setMudHoras("");
        setMudPersonal("");
        setMudPrecio("");
        setAriOrigen("");
        setAriDestino("");
        setAriMaterial("arena");
        setAriToneladas("");
        setAriPrecioTonelada("");
      }, 200);
    } else {
      // Al abrir: si solo hay un tipo activo, preseleccionarlo
      if (tiposActivos.length === 1) {
        setTipoSeleccionado(tiposActivos[0]);
      } else if (!tiposActivos.includes(tipoSeleccionado)) {
        setTipoSeleccionado(tiposActivos[0]);
      }
    }
  }, [open, tiposActivos, tipoSeleccionado]);

  // Cargar datos del cliente seleccionado
  useEffect(() => {
    if (!clienteId || clienteId === "__manual") {
      return;
    }
    const c = clientes.find((x) => x.id === clienteId);
    if (c) {
      setClienteNombre(c.nombre);
      setClienteDireccion(c.direccion ?? "");
      setClienteTelefono(c.telefono ?? "");
      setClienteZona(c.zona ?? "");
    }
  }, [clienteId, clientes]);

  // === Cálculos ===
  const totalCalculado = useMemo(() => {
    if (tipoSeleccionado === "flete") {
      return Number(fletePrecio) || 0;
    }
    if (tipoSeleccionado === "mudanza") {
      return Number(mudPrecio) || 0;
    }
    // aridos
    const ton = Number(ariToneladas) || 0;
    const precio = Number(ariPrecioTonelada) || 0;
    const raw = ton * precio;
    if (raw <= 0) return 0;
    // Redondear a $100 superior
    return Math.ceil(raw / 100) * 100;
  }, [
    tipoSeleccionado,
    fletePrecio,
    mudPrecio,
    ariToneladas,
    ariPrecioTonelada,
  ]);

  const efectivoNum = metodoPago === "efectivo" ? (Number(montoEfectivo) || 0) : 0;
  const transferenciaNum = metodoPago === "transferencia" ? (Number(montoTransferencia) || 0) : 0;
  const montoRecibido = efectivoNum + transferenciaNum;
  const saldo = Math.max(0, totalCalculado - montoRecibido);

  const estadoPago = useMemo(() => {
    if (totalCalculado <= 0) return "pendiente";
    if (montoRecibido >= totalCalculado) return "pagado";
    if (montoRecibido > 0) return "parcial";
    return "pendiente";
  }, [totalCalculado, montoRecibido]);

  // Auto-rellenar monto recibido cuando cambia el total o método (si el usuario no lo editó manualmente)
  // Si es efectivo o transferencia, sugerir el total como monto recibido
  const [montoEditadoManual, setMontoEditadoManual] = useState(false);
  useEffect(() => {
    if (!montoEditadoManual && totalCalculado > 0) {
      if (metodoPago === "efectivo") {
        setMontoEfectivo(String(totalCalculado));
      } else if (metodoPago === "transferencia") {
        setMontoTransferencia(String(totalCalculado));
      }
    }
  }, [totalCalculado, metodoPago, montoEditadoManual]);

  function onChangeMontoEfectivo(v: string) {
    setMontoEditadoManual(true);
    setMontoEfectivo(v);
  }
  function onChangeMontoTransferencia(v: string) {
    setMontoEditadoManual(true);
    setMontoTransferencia(v);
  }
  function onChangeMetodoPago(m: string) {
    setMetodoPago(m);
    setMontoEditadoManual(false);
    if (m === "efectivo") {
      setMontoTransferencia("");
    } else if (m === "transferencia") {
      setMontoEfectivo("");
    } else {
      // sin pago
      setMontoEfectivo("");
      setMontoTransferencia("");
    }
  }

  async function handleUploadFoto(file: File) {
    setSubiendoFoto(true);
    try {
      const url = await uploadFile(file);
      setFotoUrl(url);
      toast.success("Foto de respaldo subida");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir la foto");
    } finally {
      setSubiendoFoto(false);
    }
  }

  // Validaciones y guardado
  async function handleGuardar() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    try {
      const nombreTrim = clienteNombre.trim();
      if (!nombreTrim) {
        toast.error("Ingresá el nombre del cliente");
        return;
      }

      // Validar por tipo
      let origen: string | null = null;
      let destino: string | null = null;
      let tipoCarga: string | null = null;
      let toneladas: number | null = null;
      let horasTrabajadas: number | null = null;
      let cantidadPersonal: number | null = null;
      let material: string | null = null;
      let duracionMinutos: number | null = null;

      if (tipoSeleccionado === "flete") {
        if (!fleteOrigen.trim() || !fleteDestino.trim()) {
          toast.error("Ingresá origen y destino del flete");
          return;
        }
        if (!fletePrecio || Number(fletePrecio) <= 0) {
          toast.error("Ingresá el precio del viaje");
          return;
        }
        origen = fleteOrigen.trim();
        destino = fleteDestino.trim();
        tipoCarga = fleteTipoCarga;
      } else if (tipoSeleccionado === "mudanza") {
        if (!mudOrigen.trim() || !mudDestino.trim()) {
          toast.error("Ingresá origen y destino de la mudanza");
          return;
        }
        if (!mudPrecio || Number(mudPrecio) <= 0) {
          toast.error("Ingresá el precio de la mudanza");
          return;
        }
        origen = mudOrigen.trim();
        destino = mudDestino.trim();
        if (mudHoras && Number(mudHoras) > 0) horasTrabajadas = Number(mudHoras);
        if (mudPersonal && Number(mudPersonal) > 0) cantidadPersonal = Number(mudPersonal);
        // Duración estimada: horas × 60 minutos (si hay horas)
        if (horasTrabajadas) duracionMinutos = Math.round(horasTrabajadas * 60);
      } else if (tipoSeleccionado === "aridos") {
        if (!ariOrigen.trim() || !ariDestino.trim()) {
          toast.error("Ingresá cantera de origen y destino");
          return;
        }
        if (!ariToneladas || Number(ariToneladas) <= 0) {
          toast.error("Ingresá las toneladas");
          return;
        }
        if (!ariPrecioTonelada || Number(ariPrecioTonelada) <= 0) {
          toast.error("Ingresá el precio por tonelada");
          return;
        }
        origen = ariOrigen.trim();
        destino = ariDestino.trim();
        material = ariMaterial;
        toneladas = Number(ariToneladas);
      }

      const payload: Record<string, unknown> = {
        clienteId: clienteId && clienteId !== "__manual" ? clienteId : null,
        clienteNombre: nombreTrim,
        clienteDireccion: clienteDireccion.trim() || null,
        clienteTelefono: clienteTelefono.trim() || null,
        clienteZona: clienteZona.trim() || null,
        // Para multi-transporte, litros = 0 y precioPorLitro = 0
        litros: 0,
        precioPorLitro: 0,
        total: totalCalculado,
        montoEfectivo: efectivoNum,
        montoTransferencia: transferenciaNum,
        estadoPago,
        metodoPago: metodoPago === "sin_pago" ? "credito" : metodoPago,
        fotoMedidorUrl: fotoUrl,
        nota: nota.trim() || null,
        // Multi-transporte
        tipoTransporte: tipoSeleccionado,
        origen,
        destino,
        tipoCarga,
        toneladas,
        horasTrabajadas,
        cantidadPersonal,
        material,
        duracionMinutos,
      };

      await apiPost("/api/entregas", payload);
      const tipoLabel = TIPOS_LABEL[tipoSeleccionado].label;
      toast.success(
        `✓ ${tipoLabel} registrado: ${formatCurrency(totalCalculado)} · ${nombreTrim}`,
        {
          duration: 8000,
          description: "La entrega se guardó correctamente.",
        }
      );
      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error("[EntregaMultiForm] error al guardar:", e);
      toast.error(
        e instanceof Error
          ? `No se pudo guardar: ${e.message}`
          : "No se pudo guardar la entrega",
        { duration: 10000 }
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const sinVueltaActiva = !vueltaActual;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Registrar entrega
          </DialogTitle>
          <DialogDescription>
            Cargá los datos del servicio de transporte realizado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">

          {/* Selector de tipo (solo si hay múltiples) */}
          {tiposActivos.length > 1 && (
            <div className="space-y-2">
              <Label className="text-xs">Tipo de transporte</Label>
              <div className="grid grid-cols-3 gap-2">
                {tiposActivos.map((t) => {
                  const activo = tipoSeleccionado === t;
                  const { label, icon } = TIPOS_LABEL[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoSeleccionado(t)}
                      className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-center transition ${
                        activo
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="text-2xl">{icon}</span>
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cliente */}
          <div className="space-y-2">
            <Label className="text-xs">Cliente</Label>
            <Select
              value={clienteId}
              onValueChange={(v) => {
                setClienteId(v);
                if (v === "__manual") {
                  setClienteNombre("");
                  setClienteDireccion("");
                  setClienteTelefono("");
                  setClienteZona("");
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegir cliente del catálogo o ingreso manual…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual">+ Ingreso manual</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                    {c.zona ? ` · ${c.zona}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Datos del cliente (siempre visibles, editables) */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre del cliente *</Label>
              <Input
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                placeholder="Nombre y apellido"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Teléfono</Label>
              <Input
                value={clienteTelefono}
                onChange={(e) => setClienteTelefono(e.target.value)}
                placeholder="+56 9…"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Dirección</Label>
              <Input
                value={clienteDireccion}
                onChange={(e) => setClienteDireccion(e.target.value)}
                placeholder="Calle, número, depto…"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Zona / Comuna</Label>
              <Input
                value={clienteZona}
                onChange={(e) => setClienteZona(e.target.value)}
                placeholder="Sector, comuna…"
              />
            </div>
          </div>

          {/* === Campos específicos por tipo === */}
          {tipoSeleccionado === "flete" && (
            <FleteFields
              origen={fleteOrigen}
              setOrigen={setFleteOrigen}
              destino={fleteDestino}
              setDestino={setFleteDestino}
              tipoCarga={fleteTipoCarga}
              setTipoCarga={setFleteTipoCarga}
              volumen={fleteVolumen}
              setVolumen={setFleteVolumen}
              unidad={fleteUnidad}
              setUnidad={setFleteUnidad}
              precio={fletePrecio}
              setPrecio={setFletePrecio}
            />
          )}

          {tipoSeleccionado === "mudanza" && (
            <MudanzaFields
              origen={mudOrigen}
              setOrigen={setMudOrigen}
              destino={mudDestino}
              setDestino={setMudDestino}
              volumen={mudVolumen}
              setVolumen={setMudVolumen}
              horas={mudHoras}
              setHoras={setMudHoras}
              personal={mudPersonal}
              setPersonal={setMudPersonal}
              precio={mudPrecio}
              setPrecio={setMudPrecio}
            />
          )}

          {tipoSeleccionado === "aridos" && (
            <AridosFields
              origen={ariOrigen}
              setOrigen={setAriOrigen}
              destino={ariDestino}
              setDestino={setAriDestino}
              material={ariMaterial}
              setMaterial={setAriMaterial}
              toneladas={ariToneladas}
              setToneladas={setAriToneladas}
              precioTonelada={ariPrecioTonelada}
              setPrecioTonelada={setAriPrecioTonelada}
              totalCalculado={totalCalculado}
            />
          )}

          {/* === Método de pago y montos === */}
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase">Pago</Label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onChangeMetodoPago("efectivo")}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                    metodoPago === "efectivo"
                      ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "border-border"
                  }`}
                >
                  <Banknote className="h-3 w-3" /> Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => onChangeMetodoPago("transferencia")}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                    metodoPago === "transferencia"
                      ? "border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "border-border"
                  }`}
                >
                  <Smartphone className="h-3 w-3" /> Transferencia
                </button>
                <button
                  type="button"
                  onClick={() => onChangeMetodoPago("sin_pago")}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                    metodoPago === "sin_pago"
                      ? "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      : "border-border"
                  }`}
                >
                  Sin pago
                </button>
              </div>
            </div>

            {metodoPago === "efectivo" && (
              <div>
                <Label className="text-xs">Monto en efectivo</Label>
                <Input
                  type="number"
                  min="0"
                  value={montoEfectivo}
                  onChange={(e) => onChangeMontoEfectivo(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
            {metodoPago === "transferencia" && (
              <div>
                <Label className="text-xs">Monto por transferencia</Label>
                <Input
                  type="number"
                  min="0"
                  value={montoTransferencia}
                  onChange={(e) => onChangeMontoTransferencia(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
            {metodoPago === "sin_pago" && (
              <p className="text-xs text-muted-foreground">
                La entrega quedará como <strong>pendiente de pago</strong>. El saldo se sumará a la deuda del cliente.
              </p>
            )}

            {/* Resumen total / saldo / estado */}
            <div className="grid grid-cols-3 gap-2 border-t border-border pt-2 text-center">
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Total</p>
                <p className="text-sm font-bold tabular-nums">{formatCurrency(totalCalculado)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Recibido</p>
                <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(montoRecibido)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Saldo</p>
                <p className={`text-sm font-bold tabular-nums ${
                  saldo > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                }`}>
                  {formatCurrency(saldo)}
                </p>
              </div>
            </div>
            <div className="text-center">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  estadoPago === "pagado"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : estadoPago === "parcial"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {estadoPago.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Foto de respaldo */}
          <div className="space-y-2">
            <Label className="text-xs">Foto de respaldo (opcional)</Label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={subiendoFoto}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadFoto(f);
              }}
              className="hidden"
              id="multi-foto-respaldo"
            />
            {fotoUrl ? (
              <div className="relative inline-block">
                <img
                  src={fotoUrl}
                  alt="Respaldo"
                  className="h-24 rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => setFotoUrl(null)}
                  className="absolute -right-2 -top-2 rounded-full bg-destructive text-destructive-foreground p-1 shadow"
                  aria-label="Quitar foto"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label
                htmlFor="multi-foto-respaldo"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-muted/30"
              >
                {subiendoFoto ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo…</>
                ) : (
                  <><Camera className="h-4 w-4" /> Subir foto / tomar con cámara</>
                )}
              </label>
            )}
          </div>

          {/* Nota */}
          <div className="space-y-2">
            <Label className="text-xs">Nota (opcional)</Label>
            <Textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={2}
              placeholder="Detalles del servicio, indicaciones, observaciones…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={saving || (!isDueno && false)}>
            {saving ? (
              <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Guardando…</>
            ) : (
              "Registrar entrega"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// === Sub-componentes por tipo ===

function FleteFields({
  origen,
  setOrigen,
  destino,
  setDestino,
  tipoCarga,
  setTipoCarga,
  volumen,
  setVolumen,
  unidad,
  setUnidad,
  precio,
  setPrecio,
}: {
  origen: string;
  setOrigen: (v: string) => void;
  destino: string;
  setDestino: (v: string) => void;
  tipoCarga: string;
  setTipoCarga: (v: string) => void;
  volumen: string;
  setVolumen: (v: string) => void;
  unidad: string;
  setUnidad: (v: string) => void;
  precio: string;
  setPrecio: (v: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
        <Package className="h-3.5 w-3.5" /> Flete
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Origen *</Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              placeholder="Dirección de origen"
              className="pl-8"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Destino *</Label>
          <div className="relative">
            <Navigation className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Dirección de destino"
              className="pl-8"
            />
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo de carga</Label>
          <Select value={tipoCarga} onValueChange={setTipoCarga}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_CARGA_FLETE.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Volumen / Peso</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={volumen}
            onChange={(e) => setVolumen(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Unidad</Label>
          <Select value={unidad} onValueChange={setUnidad}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIDADES_VOLUMEN.map((u) => (
                <SelectItem key={u.value} value={u.value}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Precio del viaje *</Label>
        <Input
          type="number"
          min="0"
          step="100"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder="Ej: 25000"
        />
        {precio && Number(precio) > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Total del flete: <strong className="tabular-nums">{formatCurrency(Number(precio))}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

function MudanzaFields({
  origen,
  setOrigen,
  destino,
  setDestino,
  volumen,
  setVolumen,
  horas,
  setHoras,
  personal,
  setPersonal,
  precio,
  setPrecio,
}: {
  origen: string;
  setOrigen: (v: string) => void;
  destino: string;
  setDestino: (v: string) => void;
  volumen: string;
  setVolumen: (v: string) => void;
  horas: string;
  setHoras: (v: string) => void;
  personal: string;
  setPersonal: (v: string) => void;
  precio: string;
  setPrecio: (v: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
        <Home className="h-3.5 w-3.5" /> Mudanza
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Origen *</Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              placeholder="Dirección de origen"
              className="pl-8"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Destino *</Label>
          <div className="relative">
            <Navigation className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Dirección de destino"
              className="pl-8"
            />
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Volumen estimado (m³)</Label>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={volumen}
            onChange={(e) => setVolumen(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Horas trabajadas</Label>
          <div className="relative">
            <Clock className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="number"
              min="0"
              step="0.5"
              value={horas}
              onChange={(e) => setHoras(e.target.value)}
              placeholder="0"
              className="pl-8"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Personal</Label>
          <div className="relative">
            <UserCheck className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="number"
              min="1"
              step="1"
              value={personal}
              onChange={(e) => setPersonal(e.target.value)}
              placeholder="1"
              className="pl-8"
            />
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Precio de la mudanza *</Label>
        <Input
          type="number"
          min="0"
          step="1000"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          placeholder="Ej: 80000"
        />
        {precio && Number(precio) > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Total de la mudanza: <strong className="tabular-nums">{formatCurrency(Number(precio))}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

function AridosFields({
  origen,
  setOrigen,
  destino,
  setDestino,
  material,
  setMaterial,
  toneladas,
  setToneladas,
  precioTonelada,
  setPrecioTonelada,
  totalCalculado,
}: {
  origen: string;
  setOrigen: (v: string) => void;
  destino: string;
  setDestino: (v: string) => void;
  material: string;
  setMaterial: (v: string) => void;
  toneladas: string;
  setToneladas: (v: string) => void;
  precioTonelada: string;
  setPrecioTonelada: (v: string) => void;
  totalCalculado: number;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
        <Mountain className="h-3.5 w-3.5" /> Áridos
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Cantera origen *</Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              placeholder="Nombre o dirección de la cantera"
              className="pl-8"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Destino *</Label>
          <div className="relative">
            <Navigation className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Dirección de destino"
              className="pl-8"
            />
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Material</Label>
          <Select value={material} onValueChange={setMaterial}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATERIALES_ARIDOS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Toneladas *</Label>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={toneladas}
            onChange={(e) => setToneladas(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Precio por tonelada *</Label>
          <Input
            type="number"
            min="0"
            step="100"
            value={precioTonelada}
            onChange={(e) => setPrecioTonelada(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>
      {totalCalculado > 0 && (
        <div className="rounded-md bg-primary/5 p-2 text-center text-sm">
          <span className="text-muted-foreground">Total automático (redondeado a $100): </span>
          <strong className="tabular-nums">{formatCurrency(totalCalculado)}</strong>
          <span className="ml-1 text-xs text-muted-foreground">
            ({formatNumber(Number(toneladas) || 0, 1)} t × {formatCurrency(Number(precioTonelada) || 0)})
          </span>
        </div>
      )}
    </div>
  );
}

// === Helpers para mostrar badges de tipo en listas externas ===
// Exportamos utilidades que dashboard y entregas-tab usan para renderizar entregas multi-tipo.

export function getTipoTransporteLabel(tipo: string | null | undefined): string {
  if (!tipo || tipo === "aljibe") return "Aljibe";
  return TIPOS_LABEL[tipo as TipoTransporte]?.label ?? tipo;
}

export function getTipoTransporteIcon(tipo: string | null | undefined): string {
  if (!tipo || tipo === "aljibe") return "💧";
  return TIPOS_LABEL[tipo as TipoTransporte]?.icon ?? "🚚";
}

// Utilidad para construir un resumen compacto de una entrega multi-tipo
// Retorna { tipo, icon, origen, destino, detalle, monto }
export function getResumenMultiEntrega(e: {
  tipoTransporte?: string | null;
  origen?: string | null;
  destino?: string | null;
  tipoCarga?: string | null;
  toneladas?: number | null;
  horasTrabajadas?: number | null;
  cantidadPersonal?: number | null;
  material?: string | null;
}): {
  tipo: string;
  icon: string;
  origen?: string;
  destino?: string;
  detalle?: string;
} {
  const tipo = e.tipoTransporte || "aljibe";
  const icon = getTipoTransporteIcon(tipo);
  const tipoLabel = getTipoTransporteLabel(tipo);

  const res: { tipo: string; icon: string; origen?: string; destino?: string; detalle?: string } = {
    tipo: tipoLabel,
    icon,
  };

  if (e.origen) res.origen = e.origen;
  if (e.destino) res.destino = e.destino;

  if (tipo === "flete") {
    const partes: string[] = [];
    if (e.tipoCarga) {
      const labelCarga = TIPOS_CARGA_FLETE.find((t) => t.value === e.tipoCarga)?.label ?? e.tipoCarga;
      partes.push(labelCarga);
    }
    if (partes.length > 0) res.detalle = partes.join(" · ");
  } else if (tipo === "mudanza") {
    const partes: string[] = [];
    if (e.horasTrabajadas) partes.push(`${formatNumber(e.horasTrabajadas, 1)} h`);
    if (e.cantidadPersonal) partes.push(`${e.cantidadPersonal} pers.`);
    if (partes.length > 0) res.detalle = partes.join(" · ");
  } else if (tipo === "aridos") {
    const partes: string[] = [];
    if (e.material) {
      const labelMat = MATERIALES_ARIDOS.find((m) => m.value === e.material)?.label ?? e.material;
      partes.push(labelMat);
    }
    if (e.toneladas) partes.push(`${formatNumber(e.toneladas, 1)} t`);
    if (partes.length > 0) res.detalle = partes.join(" · ");
  }

  return res;
}
