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
import { Loader2, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { apiPost, apiPatch, uploadFile } from "@/components/akuosplash/akuosplash-api-client";
import { TIPOS_GASTO, PAGADO_POR, formatCurrency } from "@/components/akuosplash/akuosplash-helpers";

export interface Gasto {
  id: string;
  fecha: string;
  tipo: string;
  monto: number;
  descripcion: string | null;
  fotoUrl: string | null;
  pagadoPor: string;
}

interface GastoFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  gasto?: Gasto | null;
}

export function GastoForm({ open, onOpenChange, onSaved, gasto }: GastoFormProps) {
  const isEdit = !!gasto;

  const [tipo, setTipo] = useState<string>("agua_planta");
  const [monto, setMonto] = useState<string>("");
  const [descripcion, setDescripcion] = useState("");
  const [pagadoPor, setPagadoPor] = useState<string>("chofer");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (gasto) {
      setTipo(gasto.tipo);
      setMonto(String(gasto.monto ?? ""));
      setDescripcion(gasto.descripcion ?? "");
      setPagadoPor(gasto.pagadoPor || "chofer");
      setFotoUrl(gasto.fotoUrl);
    } else {
      setTipo("agua_planta");
      setMonto("");
      setDescripcion("");
      setPagadoPor("chofer");
      setFotoUrl(null);
    }
  }, [open, gasto]);

  async function handleFoto(file: File) {
    setSubiendoFoto(true);
    try {
      const result = await uploadFile(file, { tipo: "gasto" });
      setFotoUrl(result.url);
      if (result.uploadedToServer) {
        toast.success("Boleta/factura subida");
      } else {
        toast.success("📷 Foto guardada en el dispositivo (sin señal). Se subirá cuando tengas conexión.", { duration: 8000 });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir la imagen");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const montoNum = Number(monto) || 0;
    if (montoNum <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tipo,
        monto: montoNum,
        descripcion: descripcion.trim() || null,
        fotoUrl,
        pagadoPor,
      };

      if (isEdit && gasto) {
        await apiPatch(`/api/akuosplash/gastos/${gasto.id}`, payload);
        toast.success("Gasto actualizado");
      } else {
        await apiPost("/api/akuosplash/gastos", payload);
        toast.success("Gasto registrado");
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
      <DialogContent className="max-h-[95vh] w-[95vw] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar gasto" : "Registrar gasto"}</DialogTitle>
          <DialogDescription>
            Cargas de agua, combustibles, cloro, mantenimiento y otros.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tipoGasto">Tipo de gasto *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger id="tipoGasto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_GASTO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="montoGasto">Monto *</Label>
              <Input
                id="montoGasto"
                type="number"
                inputMode="decimal"
                step="any"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
                required
              />
              <p className="text-xs text-muted-foreground">Total: {formatCurrency(Number(monto) || 0)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pagadoPor">Pagado por</Label>
              <Select value={pagadoPor} onValueChange={setPagadoPor}>
                <SelectTrigger id="pagadoPor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGADO_POR.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {pagadoPor === "chofer"
                  ? "Lo pagaste tú — se reembolsa en la liquidación."
                  : "Lo pagó el administrador — no se reembolsa."}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descGasto">Descripción</Label>
            <Textarea
              id="descGasto"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. 200 L diesel, carga completa en planta norte"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Boleta / factura (opcional)</Label>
            {fotoUrl ? (
              <div className="relative w-fit">
                { }
                <img
                  src={fotoUrl}
                  alt="Comprobante"
                  className="h-32 w-auto rounded-lg border border-border object-cover"
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
              <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/30 text-sm text-muted-foreground transition hover:border-primary hover:bg-primary/5">
                {subiendoFoto ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <Camera className="h-6 w-6" />
                    <span>Tomar foto o subir imagen</span>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Registrar gasto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
