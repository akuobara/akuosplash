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
import { Badge } from "@/components/ui/badge";
import { Loader2, Camera, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { apiPost, apiPatch, uploadFile } from "@/lib/api-client";
import { ESTADOS_PAGO, formatCurrency, formatNumber } from "@/lib/helpers";

export interface Entrega {
  id: string;
  fecha: string;
  clienteNombre: string;
  clienteDireccion: string | null;
  clienteTelefono: string | null;
  clienteId: string | null;
  lecturaAnterior: number | null;
  lecturaActual: number | null;
  litros: number;
  precioPorLitro: number;
  total: number;
  montoRecibido: number;
  estadoPago: string;
  fotoMedidorUrl: string | null;
  nota: string | null;
}

interface ClienteOption {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  precioPorLitro: number;
}

interface EntregaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  entrega?: Entrega | null;
  clientes: ClienteOption[];
  precioPorLitroDefault: number;
}

export function EntregaForm({
  open,
  onOpenChange,
  onSaved,
  entrega,
  clientes,
  precioPorLitroDefault,
}: EntregaFormProps) {
  const isEdit = !!entrega;

  const [clienteId, setClienteId] = useState<string>("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");

  const [lecturaAnterior, setLecturaAnterior] = useState<string>("");
  const [lecturaActual, setLecturaActual] = useState<string>("");
  const [litrosManual, setLitrosManual] = useState<string>("");
  const [precioPorLitro, setPrecioPorLitro] = useState<string>(String(precioPorLitroDefault || ""));
  const [montoRecibido, setMontoRecibido] = useState<string>("");
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
      setLecturaAnterior(entrega.lecturaAnterior != null ? String(entrega.lecturaAnterior) : "");
      setLecturaActual(entrega.lecturaActual != null ? String(entrega.lecturaActual) : "");
      setLitrosManual(String(entrega.litros ?? ""));
      setPrecioPorLitro(String(entrega.precioPorLitro ?? ""));
      setMontoRecibido(String(entrega.montoRecibido ?? ""));
      setEstadoPago(entrega.estadoPago);
      setFotoUrl(entrega.fotoMedidorUrl);
      setNota(entrega.nota ?? "");
    } else {
      setClienteId("");
      setClienteNombre("");
      setClienteDireccion("");
      setClienteTelefono("");
      setLecturaAnterior("");
      setLecturaActual("");
      setLitrosManual("");
      setPrecioPorLitro(String(precioPorLitroDefault || ""));
      setMontoRecibido("");
      setEstadoPago("pendiente");
      setFotoUrl(null);
      setNota("");
    }
  }, [open, entrega, precioPorLitroDefault]);

  // Si el usuario selecciona un cliente del catálogo, autollenar datos
  function onSelectCliente(id: string) {
    setClienteId(id);
    if (!id || id === "__manual") {
      return;
    }
    const c = clientes.find((c) => c.id === id);
    if (c) {
      setClienteNombre(c.nombre);
      setClienteDireccion(c.direccion ?? "");
      setClienteTelefono(c.telefono ?? "");
      if (c.precioPorLitro > 0) setPrecioPorLitro(String(c.precioPorLitro));
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
  const recibidoFinal = Number(montoRecibido) || 0;
  const saldoFinal = totalCalculado - recibidoFinal;

  // Auto-actualizar estadoPago en UI según montoRecibido
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
        lecturaAnterior: lecturaAnterior !== "" ? Number(lecturaAnterior) : null,
        lecturaActual: lecturaActual !== "" ? Number(lecturaActual) : null,
        litros: litrosFinal,
        precioPorLitro: precioFinal,
        total: totalCalculado,
        montoRecibido: recibidoFinal,
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

          <div className="space-y-2">
            <Label htmlFor="clienteDireccion">Dirección</Label>
            <Input
              id="clienteDireccion"
              value={clienteDireccion}
              onChange={(e) => setClienteDireccion(e.target.value)}
              placeholder="Calle, número, referencia"
            />
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
              </p>
            )}
          </div>

          {/* Precios y pago */}
          <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="montoRecibido">Efectivo recibido</Label>
              <Input
                id="montoRecibido"
                type="number"
                inputMode="decimal"
                step="any"
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Resumen de cálculo */}
          <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-3">
            <div>
              <span className="text-xs uppercase text-muted-foreground">Litros</span>
              <p className="font-semibold tabular-nums">{formatNumber(litrosFinal, 0)} L</p>
            </div>
            <div>
              <span className="text-xs uppercase text-muted-foreground">Total</span>
              <p className="font-semibold tabular-nums">{formatCurrency(totalCalculado)}</p>
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
