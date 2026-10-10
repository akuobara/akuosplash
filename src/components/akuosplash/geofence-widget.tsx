"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Crosshair, Loader2, CheckCircle2, AlertTriangle, XCircle, MapPinOff } from "lucide-react";
import { getCurrentPosition, evaluateGeofence, type GeofenceCheck as GeofenceCheckResult } from "@/lib/google-maps";
import { toast } from "sonner";

interface GeofenceWidgetProps {
  clienteLat: number | null;
  clienteLng: number | null;
  clienteNombre?: string;
  /** Se llama cuando el chofer confirma la llegada (cualquier status, incluso 'far'). */
  onConfirm?: (result: GeofenceCheckResult) => void;
  /** Compact mode — sólo un botón + badge, sin texto extra */
  compact?: boolean;
}

export function GeofenceWidget({
  clienteLat,
  clienteLng,
  clienteNombre,
  onConfirm,
  compact = false,
}: GeofenceWidgetProps) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<GeofenceCheckResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Resetear cuando cambia el cliente
  useEffect(() => {
    setResult(null);
    setConfirmed(false);
  }, [clienteLat, clienteLng]);

  async function handleCheck() {
    setChecking(true);
    setResult(null);
    setConfirmed(false);
    try {
      const pos = await getCurrentPosition();
      const r = evaluateGeofence(pos.lat, pos.lng, pos.accuracyMeters, clienteLat, clienteLng);
      setResult(r);
      if (r.status === "ok") {
        toast.success("Llegada confirmada");
        setConfirmed(true);
        onConfirm?.(r);
      } else if (r.status === "no_gps") {
        toast.info("El cliente no tiene ubicación GPS registrada");
      } else {
        toast.warning("Revisá la distancia al cliente");
      }
    } catch (e: any) {
      toast.error(e?.message || "No se pudo obtener tu ubicación");
      setResult({
        status: "error",
        distanceMeters: null,
        accuracyMeters: null,
        message: e?.message || "No se pudo obtener tu ubicación.",
      });
    } finally {
      setChecking(false);
    }
  }

  function handleConfirmAnyway() {
    if (!result) return;
    setConfirmed(true);
    onConfirm?.(result);
    toast.success("Llegada confirmada manualmente");
  }

  const statusIcon = () => {
    if (!result) return null;
    switch (result.status) {
      case "ok":
        return <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
      case "near":
        return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case "far":
        return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case "no_gps":
        return <MapPinOff className="h-5 w-5 text-muted-foreground" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
    }
  };

  const statusColor = () => {
    if (!result) return "";
    switch (result.status) {
      case "ok":
        return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200";
      case "near":
        return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200";
      case "far":
        return "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200";
      case "no_gps":
        return "border-border bg-muted/40 text-muted-foreground";
      case "error":
        return "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200";
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCheck}
          disabled={checking}
        >
          {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crosshair className="h-3 w-3" />}
          <span className="ml-1 text-xs">Estoy aquí</span>
        </Button>
        {result && (
          <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${statusColor()}`}>
            {statusIcon()}
            {result.distanceMeters != null ? `${Math.round(result.distanceMeters)} m` : "sin GPS"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Crosshair className="h-4 w-4 text-primary" />
          Verificar llegada
          {clienteNombre && (
            <span className="text-muted-foreground font-normal truncate">— {clienteNombre}</span>
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCheck}
          disabled={checking}
        >
          {checking ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Crosshair className="mr-1 h-3 w-3" />}
          Estoy aquí
        </Button>
      </div>

      {result && (
        <div className={`rounded-lg border p-2 text-xs ${statusColor()}`}>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">{statusIcon()}</span>
            <div className="flex-1 space-y-0.5">
              <p className="font-medium">{result.message}</p>
              {result.accuracyMeters != null && (
                <p className="opacity-80">Precisión del GPS: ±{Math.round(result.accuracyMeters)} m</p>
              )}
              {!confirmed && (result.status === "near" || result.status === "far") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 h-7 text-xs"
                  onClick={handleConfirmAnyway}
                >
                  Confirmar de todas formas
                </Button>
              )}
              {confirmed && (
                <p className="mt-1 font-medium">✓ Llegada confirmada</p>
              )}
            </div>
          </div>
        </div>
      )}

      {!result && !checking && (
        <p className="text-xs text-muted-foreground">
          Tocá "Estoy aquí" para verificar que estás en la ubicación correcta del cliente. Usa tu GPS.
        </p>
      )}
    </div>
  );
}
