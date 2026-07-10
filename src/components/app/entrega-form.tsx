"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Loader2, Camera, X, Droplets, MapPin } from "lucide-react";
import { toast } from "sonner";
import { apiPost, apiPatch, uploadFile } from "@/lib/api-client";
import {
  ESTADOS_PAGO,
  METODOS_PAGO,
  formatCurrency,
  formatNumber,
} from "@/lib/helpers";

export interface Entrega {
  id: string;
  fecha: string;
  clienteNombre: string;
  clienteDireccion: string | null;
  clienteTelefono: string | null;
  clienteZona: string | null;
  clienteId: string | null;
  vueltaId: string | null;
  vuelta?: { id: string; numero: number; activa: boolean } | null;
  lecturaAnterior: number | null;
  lecturaActual: number | null;
  litros: number;
  metodoPago: string;
  precioPorLitro: number;
  total: number;
  montoEfectivo: number;
  montoTransferencia: number;
  montoRecibido: number;
  estadoPago: string;
  fotoMedidorUrl: string | null;
  nota: string | null;
}

export interface VueltaActual {
  id: string;
  numero: number;
  iniciadaEn: string;
  cantidadEntregas: number;
  litros: number;
  litrosRestantes?: number;
  capacidadCamion?: number;
  camion?: {
    id: string;
    nombre: string;
    patente: string | null;
    capacidad: number;
  } | null;
}

interface ClienteOption {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  zona: string | null;
  precioEfectivoPorLitro: number;
  precioTransferenciaPorLitro: number;
}

interface EntregaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  entrega?: Entrega | null;
  clientes: ClienteOption[];
  config: {
    precioEfectivoPorLitro: number;
    precioTransferenciaPorLitro: number;
    capacidadCamion: number;
  };
  vueltaActual: VueltaActual | null;
}

export function EntregaForm({
  open,
  onOpenChange,
  onSaved,
  entrega,
  clientes,
  config,
  vueltaActual,
}: EntregaFormProps) {
  const isEdit = !!entrega;

  const [clienteId, setClienteId] = useState<string>("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteZona, setClienteZona] = useState("");

  const [lecturaAnterior, setLecturaAnterior] = useState<string>("");
  const [lecturaActual, setLecturaActual] = useState<string>("");
  const [litrosManual, setLitrosManual] = useState<string>("");
  const [precioPorLitro, setPrecioPorLitro] = useState<string>("");
  const [metodoPago, setMetodoPago] = useState<string>("efectivo");

  const [montoEfectivo, setMontoEfectivo] = useState<string>("");
  const [montoTransferencia, setMontoTransferencia] = useState<string>("");
  const [estadoPago, setEstadoPago] = useState<string>("pendiente");

  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset al abrir / cambia entrega
  useEffect(() => {
    if (!open) return;
    if (entrega) {
      setClienteId(entrega.clienteId ?? "");
      setClienteNombre(entrega.clienteNombre);
      setClienteDireccion(entrega.clienteDireccion ?? "");
      setClienteTelefono(entrega.clienteTelefono ?? "");
      setClienteZona(entrega.clienteZona ?? "");
      setLecturaAnterior(entrega.lecturaAnterior != null ? String(entrega.lecturaAnterior) : "");
      setLecturaActual(entrega.lecturaActual != null ? String(entrega.lecturaActual) : "");
      setLitrosManual(String(entrega.litros ?? ""));
      setPrecioPorLitro(String(entrega.precioPorLitro ?? ""));
      setMetodoPago(entrega.metodoPago || "efectivo");
      setMontoEfectivo(entrega.montoEfectivo ? String(entrega.montoEfectivo) : "");
      setMontoTransferencia(entrega.montoTransferencia ? String(entrega.montoTransferencia) : "");
      setEstadoPago(entrega.estadoPago);
      setFotoUrl(entrega.fotoMedidorUrl);
      setNota(entrega.nota ?? "");
    } else {
      setClienteId("");
      setClienteNombre("");
      setClienteDireccion("");
      setClienteTelefono("");
      setClienteZona("");
      setLecturaAnterior("");
      setLecturaActual("");
      setLitrosManual("");
      setPrecioPorLitro("");
      setMetodoPago("efectivo");
      setMontoEfectivo("");
      setMontoTransferencia("");
      setEstadoPago("pendiente");
      setFotoUrl(null);
      setNota("");
    }
  }, [open, entrega]);

  // Si el usuario selecciona un cliente del catálogo, autollenar datos y precio
  function onSelectCliente(id: string) {
    setClienteId(id);
    if (!id || id === "__manual") {
      // Para cliente manual, usar precio global según método
      aplicarPrecioSegunMetodo(metodoPago, null);
      return;
    }
    const c = clientes.find((c) => c.id === id);
    if (c) {
      setClienteNombre(c.nombre);
      setClienteDireccion(c.direccion ?? "");
      setClienteTelefono(c.telefono ?? "");
      setClienteZona(c.zona ?? "");
      // Aplicar precio del cliente según método (si no tiene, usar global)
      aplicarPrecioSegunMetodo(metodoPago, c);
    }
  }

  // Helper: aplicar precio según método de pago
  function aplicarPrecioSegunMetodo(metodo: string, cliente: ClienteOption | null) {
    let precio = 0;
    if (metodo === "efectivo") {
      precio = cliente?.precioEfectivoPorLitro || config.precioEfectivoPorLitro || 0;
    } else if (metodo === "transferencia") {
      precio = cliente?.precioTransferenciaPorLitro || config.precioTransferenciaPorLitro || 0;
    } else {
      // mixto o crédito: usar precio efectivo como base
      precio = cliente?.precioEfectivoPorLitro || config.precioEfectivoPorLitro || 0;
    }
    if (precio > 0) {
      setPrecioPorLitro(String(precio));
    }
  }

  // Si cambia método de pago (y el usuario no ha tocado el precio manualmente)
  function onChangeMetodoPago(nuevoMetodo: string) {
    const metodoAnterior = metodoPago;
    setMetodoPago(nuevoMetodo);
    // Solo recalcular si el precio actual coincide con el del método anterior
    // (es decir, el usuario no lo modificó manualmente)
    const clienteActual = clienteId ? clientes.find((c) => c.id === clienteId) : null;
    const precioEsperadoAnterior =
      metodoAnterior === "efectivo"
        ? clienteActual?.precioEfectivoPorLitro || config.precioEfectivoPorLitro
        : metodoAnterior === "transferencia"
        ? clienteActual?.precioTransferenciaPorLitro || config.precioTransferenciaPorLitro
        : clienteActual?.precioEfectivoPorLitro || config.precioEfectivoPorLitro;
    const precioActual = Number(precioPorLitro) || 0;
    if (precioActual === precioEsperadoAnterior || precioActual === 0) {
      aplicarPrecioSegunMetodo(nuevoMetodo, clienteActual);
    }
  }

  // Calcular litros desde lecturas si no se ingresa manualmente
  const litrosCalculado =
    lecturaAnterior !== "" && lecturaActual !== ""
      ? Number(lecturaActual) - Number(lecturaAnterior)
      : null;

  const litrosFinal = litrosManual !== "" ? Number(litrosManual) : litrosCalculado ?? 0;
  const precioFinal = Number(precioPorLitro) || 0;
  const totalCalculado = litrosFinal * precioFinal;
  const efectivoFinal = Number(montoEfectivo) || 0;
  const transferenciaFinal = Number(montoTransferencia) || 0;
  const recibidoFinal = efectivoFinal + transferenciaFinal;
  const saldoFinal = totalCalculado - recibidoFinal;

  // Auto-actualizar estadoPago según monto recibido
  useEffect(() => {
    if (recibidoFinal >= totalCalculado && totalCalculado > 0) setEstadoPago("pagado");
    else if (recibidoFinal > 0) setEstadoPago("parcial");
    else setEstadoPago("pendiente");
     
  }, [recibidoFinal, totalCalculado]);

  async function handleFoto(file: File) {
    setSubiendoFoto(true);
    try {
      const url = await uploadFile(file);
      setFotoUrl(url);
      toast.success("Foto del medidor subida");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir la foto");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteNombre.trim()) {
      toast.error("Indica el nombre del cliente");
      return;
    }
    if (litrosFinal <= 0) {
      toast.error("Los litros deben ser mayores a 0");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        clienteId: clienteId && clienteId !== "__manual" ? clienteId : null,
        clienteNombre: clienteNombre.trim(),
        clienteDireccion: clienteDireccion.trim() || null,
        clienteTelefono: clienteTelefono.trim() || null,
        clienteZona: clienteZona.trim() || null,
        lecturaAnterior: lecturaAnterior !== "" ? Number(lecturaAnterior) : null,
        lecturaActual: lecturaActual !== "" ? Number(lecturaActual) : null,
        litros: litrosFinal,
        metodoPago,
        precioPorLitro: precioFinal,
        total: totalCalculado,
        montoEfectivo: efectivoFinal,
        montoTransferencia: transferenciaFinal,
        estadoPago,
        fotoMedidorUrl: fotoUrl,
        nota: nota.trim() || null,
      };

      if (isEdit && entrega) {
        await apiPatch(`/api/entregas/${entrega.id}`, payload);
        toast.success("Entrega actualizada");
      } else {
        await apiPost("/api/entregas", payload);
        toast.success("Entrega registrada");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar entrega" : "Registrar entrega de agua"}</DialogTitle>
          <DialogDescription>
            Registra la venta de agua. Puedes calcular los litros desde las lecturas del medidor o ingresarlos manualmente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vuelta actual (info) */}
          {vueltaActual && !isEdit && (
            <div className="flex flex-col gap-1 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-primary" />
                <span>
                  Se asignará a la <strong>Vuelta #{vueltaActual.numero}</strong>
                  {vueltaActual.camion && <> · {vueltaActual.camion.nombre}</>}
                </span>
              </div>
              {vueltaActual.capacidadCamion != null && vueltaActual.capacidadCamion > 0 && (
                <span className="text-xs text-muted-foreground">
                  Entregado: {formatNumber(vueltaActual.litros, 0)} L · Disponible: {formatNumber(Math.max(0, vueltaActual.capacidadCamion - vueltaActual.litros), 0)} L
                </span>
              )}
            </div>
          )}

          {/* Cliente */}
          <div className="space-y-2">
            <Label htmlFor="clienteSelect">Cliente del catálogo (opcional)</Label>
            <Select value={clienteId || "__manual"} onValueChange={onSelectCliente}>
              <SelectTrigger id="clienteSelect">
                <SelectValue placeholder="Sin cliente del catálogo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual">— Ingreso manual —</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                    {c.zona ? ` · ${c.zona}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clienteNombre">Nombre del cliente *</Label>
              <Input
                id="clienteNombre"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                placeholder="Ej. Juan Pérez"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clienteTelefono">Teléfono</Label>
              <Input
                id="clienteTelefono"
                value={clienteTelefono}
                onChange={(e) => setClienteTelefono(e.target.value)}
                placeholder="+56 9 1234 5678"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="clienteDireccion">Dirección</Label>
              <Input
                id="clienteDireccion"
                value={clienteDireccion}
                onChange={(e) => setClienteDireccion(e.target.value)}
                placeholder="Calle, número, referencia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clienteZona">Zona</Label>
              <Input
                id="clienteZona"
                value={clienteZona}
                onChange={(e) => setClienteZona(e.target.value)}
                placeholder="Ej. Rural 5km"
                className="w-[150px]"
              />
            </div>
          </div>

          {/* Lecturas del medidor */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-sm font-medium">Lecturas del medidor</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="lecturaAnterior" className="text-xs">Lectura anterior</Label>
                <Input
                  id="lecturaAnterior"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={lecturaAnterior}
                  onChange={(e) => setLecturaAnterior(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lecturaActual" className="text-xs">Lectura actual</Label>
                <Input
                  id="lecturaActual"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={lecturaActual}
                  onChange={(e) => setLecturaActual(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="litrosManual" className="text-xs">
                  Litros {litrosCalculado != null && litrosManual === "" && "(auto)"}
                </Label>
                <Input
                  id="litrosManual"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={litrosManual}
                  onChange={(e) => setLitrosManual(e.target.value)}
                  placeholder={litrosCalculado != null ? String(litrosCalculado) : "0"}
                />
              </div>
            </div>
            {litrosCalculado != null && litrosManual === "" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Litros calculados: <strong>{formatNumber(litrosCalculado, 0)} L</strong>
                {vueltaActual && vueltaActual.capacidadCamion != null && vueltaActual.capacidadCamion > 0 && (
                  (() => {
                    const disponible = Math.max(0, vueltaActual.capacidadCamion - vueltaActual.litros);
                    if (litrosCalculado > disponible) {
                      return (
                        <span className="ml-2 text-amber-600 dark:text-amber-400">
                          ⚠ Solo quedan {formatNumber(disponible, 0)} L en el camión
                        </span>
                      );
                    }
                    return null;
                  })()
                )}
              </p>
            )}
          </div>

          {/* Método de pago + precio */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="metodoPago">Método de pago</Label>
              <Select value={metodoPago} onValueChange={onChangeMetodoPago}>
                <SelectTrigger id="metodoPago">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METODOS_PAGO.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="precio">Precio por litro</Label>
              <Input
                id="precio"
                type="number"
                inputMode="decimal"
                step="any"
                value={precioPorLitro}
                onChange={(e) => setPrecioPorLitro(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Default: {formatCurrency(config.precioEfectivoPorLitro)}/L efectivo · {formatCurrency(config.precioTransferenciaPorLitro)}/L transferencia
              </p>
            </div>
          </div>

          {/* Pagos desglosados */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-sm font-medium">Pagos recibidos</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="montoEfectivo" className="text-xs">Efectivo recibido</Label>
                <Input
                  id="montoEfectivo"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={montoEfectivo}
                  onChange={(e) => setMontoEfectivo(e.target.value)}
                  placeholder="0"
                  disabled={metodoPago === "transferencia"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="montoTransferencia" className="text-xs">Transferencia recibida</Label>
                <Input
                  id="montoTransferencia"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={montoTransferencia}
                  onChange={(e) => setMontoTransferencia(e.target.value)}
                  placeholder="0"
                  disabled={metodoPago === "efectivo"}
                />
              </div>
            </div>
          </div>

          {/* Resumen de cálculo */}
          <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-4">
            <div>
              <span className="text-xs uppercase text-muted-foreground">Litros</span>
              <p className="font-semibold tabular-nums">{formatNumber(litrosFinal, 0)} L</p>
            </div>
            <div>
              <span className="text-xs uppercase text-muted-foreground">Total</span>
              <p className="font-semibold tabular-nums">{formatCurrency(totalCalculado)}</p>
            </div>
            <div>
              <span className="text-xs uppercase text-muted-foreground">Recibido</span>
              <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(recibidoFinal)}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase text-muted-foreground">Saldo</span>
              <p className={`font-semibold tabular-nums ${saldoFinal > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {formatCurrency(saldoFinal)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Estado del pago</Label>
            <div className="flex flex-wrap gap-2">
              {ESTADOS_PAGO.map((e) => (
                <Button
                  key={e.value}
                  type="button"
                  variant={estadoPago === e.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEstadoPago(e.value)}
                >
                  {e.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Foto del medidor */}
          <div className="space-y-2">
            <Label>Foto del medidor (respaldo)</Label>
            {fotoUrl ? (
              <div className="relative w-fit">
                { }
                <img
                  src={fotoUrl}
                  alt="Foto del medidor"
                  className="h-40 w-auto rounded-lg border border-border object-cover"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute -right-2 -top-2 h-7 w-7 rounded-full"
                  onClick={() => setFotoUrl(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/30 text-sm text-muted-foreground transition hover:border-primary hover:bg-primary/5">
                {subiendoFoto ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <Camera className="h-6 w-6" />
                    <span>Tomar foto o subir imagen</span>
                    <span className="text-xs">JPG / PNG / WEBP · máx 8 MB</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFoto(f);
                  }}
                />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nota">Nota</Label>
            <Textarea
              id="nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Observaciones: ubicación del estanque, dificultad de acceso, etc."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Registrar entrega"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
