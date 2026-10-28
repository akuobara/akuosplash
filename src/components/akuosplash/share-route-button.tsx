"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Smartphone, QrCode, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ShareRouteButtonProps {
  /** URL a compartir (deep-link a Google Maps). */
  url: string;
  /** Etiqueta del botón que abre el diálogo. */
  label?: string;
  /** Título del diálogo. */
  dialogTitle?: string;
  /** Variante del botón. */
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

/**
 * Botón que abre un diálogo para compartir la ruta con el chofer:
 *   1. Link directo (clic para abrir Google Maps en este dispositivo)
 *   2. QR code para escanear desde el celular del chofer
 *   3. Copy-to-clipboard para pegar donde quieras
 *
 * El QR se genera vía api.qrserver.com (gratuito, sin auth).
 * El URL del QR se URL-encodea.
 */
export function ShareRouteButton({
  url,
  label = "Enviar al móvil",
  dialogTitle = "Enviar ruta al móvil",
  variant = "outline",
  size = "sm",
}: ShareRouteButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState<string | null>(null);

  // Reset copied state after 2s
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  // Generar QR URL cuando se abre
  useEffect(() => {
    if (!open) return;
    setQrLoading(true);
    setQrError(null);
    if (!url) {
      setQrError("No hay URL para compartir");
      setQrLoading(false);
      return;
    }
    // api.qrserver.com — gratis, sin auth, hasta 2953 chars
    if (url.length > 2500) {
      setQrError("URL demasiado larga para QR (más de 2500 caracteres). Usa el botón Copiar o el link directo.");
      setQrLoading(false);
      return;
    }
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(url)}`;
    setQrUrl(qr);
    setQrLoading(false);
  }, [open, url]);

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado");
    } catch {
      // Fallback para navegadores sin clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      try {
        textarea.select();
        document.execCommand("copy");
        setCopied(true);
        toast.success("Link copiado");
      } catch {
        toast.error("No se pudo copiar el link. Copialo manualmente.");
      }
      document.body.removeChild(textarea);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        disabled={!url}
        title="Enviar ruta al móvil del chofer"
      >
        <Smartphone className="h-4 w-4" />
        {label && <span className="ml-1">{label}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" /> {dialogTitle}
            </DialogTitle>
            <DialogDescription>
              Escaneá el QR con la cámara del celular del chofer para abrir Google Maps con la ruta completa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* QR Code */}
            {qrLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : qrError ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                {qrError}
              </div>
            ) : qrUrl ? (
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-lg border border-border bg-white p-2">
                  <img
                    src={qrUrl}
                    alt="QR de la ruta"
                    width={300}
                    height={300}
                    className="h-[300px] w-[300px]"
                    loading="lazy"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Apuntá la cámara del celular al QR → se abre Google Maps con la ruta completa en modo navigate.
                </p>
              </div>
            ) : null}

            {/* Acciones alternativas */}
            <div className="flex flex-col gap-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1 rounded-md bg-blue-600 hover:bg-blue-700 px-3 py-2 text-sm text-white font-medium transition"
              >
                <ExternalLink className="h-4 w-4" /> Abrir en este dispositivo
              </a>
              <Button
                type="button"
                variant="outline"
                onClick={copyLink}
                className="w-full"
              >
                {copied ? (
                  <>
                    <Check className="mr-1 h-4 w-4 text-emerald-600" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-4 w-4" /> Copiar link
                  </>
                )}
              </Button>
            </div>

            {/* URL truncada para visualización */}
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Ver URL completa
              </summary>
              <p className="mt-1 break-all rounded-md bg-muted/30 p-2 font-mono text-[10px] text-muted-foreground">
                {url}
              </p>
            </details>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
