"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CreditCard, CheckCircle2, XCircle, AlertTriangle, Save, ExternalLink, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { akuoGet, akuoPut } from "@/components/akuosplash/akuosplash-utils";

interface IntegracionEstado {
  mercadopago: {
    configured: boolean;
    sandbox: boolean;
    hasAccessToken: boolean;
    hasPublicKey: boolean;
    hasClientId: boolean;
    hasUserId: boolean;
  };
  transbank: {
    configured: boolean;
    environment: string; // "INTEGRACION" | "PRODUCCION" | ""
    hasCommerceCode: boolean;
    hasApiKey: boolean;
  };
}

export function IntegracionesTab() {
  const [estado, setEstado] = useState<IntegracionEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Formularios para configurar
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [mpPublicKey, setMpPublicKey] = useState("");
  const [mpClientId, setMpClientId] = useState("");
  const [mpUserId, setMpUserId] = useState("");
  const [mpSandbox, setMpSandbox] = useState(true);

  const [tbCommerceCode, setTbCommerceCode] = useState("");
  const [tbApiKey, setTbApiKey] = useState("");
  const [tbEnvironment, setTbEnvironment] = useState("INTEGRACION");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await akuoGet<IntegracionEstado>("/api/akuosplash/integraciones/estado");
      setEstado(d);
      // Pre-llenar el form con valores actuales (placeholders, no exponemos secrets)
      if (d.mercadopago) {
        setMpSandbox(d.mercadopago.sandbox);
      }
    } catch (e: any) {
      toast.error("No se pudo cargar el estado: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardarMP() {
    setSaving(true);
    try {
      await akuoPut("/api/akuosplash/integraciones/mercadopago", {
        accessToken: mpAccessToken || undefined,
        publicKey: mpPublicKey || undefined,
        clientId: mpClientId || undefined,
        userId: mpUserId || undefined,
        sandbox: mpSandbox,
      });
      toast.success("MercadoPago actualizado");
      setMpAccessToken(""); setMpPublicKey(""); setMpClientId(""); setMpUserId("");
      cargar();
    } catch (e: any) {
      toast.error("No se pudo guardar: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  async function guardarTB() {
    setSaving(true);
    try {
      await akuoPut("/api/akuosplash/integraciones/transbank", {
        commerceCode: tbCommerceCode || undefined,
        apiKey: tbApiKey || undefined,
        environment: tbEnvironment,
      });
      toast.success("Transbank actualizado");
      setTbCommerceCode(""); setTbApiKey("");
      cargar();
    } catch (e: any) {
      toast.error("No se pudo guardar: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <p className="font-medium flex items-center gap-1.5">
            <CreditCard className="h-4 w-4 text-primary" /> Integraciones de pago
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Configurá las pasarelas de pago. MercadoPago se usa para las ventas de agua en el marketplace (con split entre la plataforma y el repartidor). Transbank se usa para las subscripciones de planes (sin split, más económico).
          </p>
        </CardContent>
      </Card>

      {/* === MERCADOPAGO === */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-blue-600" /> MercadoPago
              {estado?.mercadopago?.configured ? (
                <Badge variant="default" className="bg-emerald-100 text-emerald-800 ml-2 text-[10px]">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Configurado
                </Badge>
              ) : (
                <Badge variant="destructive" className="ml-2 text-[10px]">
                  <XCircle className="h-2.5 w-2.5 mr-0.5" /> Sin configurar
                </Badge>
              )}
            </CardTitle>
            <a
              href="https://www.mercadopago.cl/developers/panel/app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
            >
              Panel MP <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-blue-50 border border-blue-200 p-2 text-xs text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200">
            <p className="font-medium mb-0.5">Uso</p>
            Pago de pedidos del marketplace (con split payment entre plataforma y repartidor que tenga MP OAuth conectado).
          </div>

          <div className="space-y-2">
            <div>
              <Label htmlFor="mpAccessToken" className="text-xs">Access Token {estado?.mercadopago?.hasAccessToken && <span className="text-emerald-600">✓ configurado</span>}</Label>
              <Input
                id="mpAccessToken"
                type="password"
                value={mpAccessToken}
                onChange={(e) => setMpAccessToken(e.target.value)}
                placeholder={estado?.mercadopago?.hasAccessToken ? "•••••••• (cambiar)" : "APP_USR-1234-..."}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="mpPublicKey" className="text-xs">Public Key (frontend) {estado?.mercadopago?.hasPublicKey && <span className="text-emerald-600">✓</span>}</Label>
              <Input
                id="mpPublicKey"
                type="password"
                value={mpPublicKey}
                onChange={(e) => setMpPublicKey(e.target.value)}
                placeholder={estado?.mercadopago?.hasPublicKey ? "•••••• (cambiar)" : "APP_USR-..."}
                className="h-8 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="mpClientId" className="text-xs">Client ID {estado?.mercadopago?.hasClientId && <span className="text-emerald-600">✓</span>}</Label>
                <Input
                  id="mpClientId"
                  value={mpClientId}
                  onChange={(e) => setMpClientId(e.target.value)}
                  placeholder={estado?.mercadopago?.hasClientId ? "(cambiar)" : "1234567890123"}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="mpUserId" className="text-xs">User ID {estado?.mercadopago?.hasUserId && <span className="text-emerald-600">✓</span>}</Label>
                <Input
                  id="mpUserId"
                  value={mpUserId}
                  onChange={(e) => setMpUserId(e.target.value)}
                  placeholder={estado?.mercadopago?.hasUserId ? "(cambiar)" : "123456789"}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-2.5">
              <div>
                <p className="text-sm font-medium">Modo sandbox</p>
                <p className="text-xs text-muted-foreground">Usar credenciales de prueba (no cobra real).</p>
              </div>
              <Switch checked={mpSandbox} onCheckedChange={setMpSandbox} />
            </div>
          </div>

          <Button onClick={guardarMP} disabled={saving} size="sm">
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
            Guardar MercadoPago
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Los cambios se guardan como variables de entorno en Vercel. Para que tengan efecto en producción, hay que re-deployar después de cambiar.
          </p>
        </CardContent>
      </Card>

      {/* === TRANSBANK === */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-red-600" /> Transbank Webpay
              {estado?.transbank?.configured ? (
                <Badge variant="default" className="bg-emerald-100 text-emerald-800 ml-2 text-[10px]">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Configurado
                </Badge>
              ) : (
                <Badge variant="destructive" className="ml-2 text-[10px]">
                  <XCircle className="h-2.5 w-2.5 mr-0.5" /> Sin configurar
                </Badge>
              )}
            </CardTitle>
            <a
              href="https://transbank.cl/login"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
            >
              Panel Transbank <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200">
            <p className="font-medium mb-0.5">Uso</p>
            Pago de subscripciones de planes (Free / Pro / Enterprise) de los transportistas. Sin split, comisión más baja que MercadoPago para pagos recurrentes.
          </div>

          {!estado?.transbank?.configured && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Pendiente de configuración</p>
                <p className="mt-0.5">Para activar el pago de subscripciones con Transbank, necesitás:</p>
                <ol className="list-decimal list-inside mt-1 space-y-0.5">
                  <li>Crear cuenta en <a href="https://transbank.cl/" target="_blank" rel="noopener" className="underline">transbank.cl</a></li>
                  <li>Solicitar código de comercio (generalmente 597055555536 para pruebas INTEGRACION)</li>
                  <li>Obtener API Key desde el panel</li>
                  <li>Configurar URL de retorno: <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">{typeof window !== "undefined" ? window.location.origin : "https://my-project-azure-five-82.vercel.app"}/api/akuosplash/subscription/transbank/return</code></li>
                </ol>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div>
              <Label htmlFor="tbCommerceCode" className="text-xs">Código de comercio {estado?.transbank?.hasCommerceCode && <span className="text-emerald-600">✓ configurado</span>}</Label>
              <Input
                id="tbCommerceCode"
                value={tbCommerceCode}
                onChange={(e) => setTbCommerceCode(e.target.value)}
                placeholder={estado?.transbank?.hasCommerceCode ? "••••• (cambiar)" : "597055555536 (test) o el tuyo real"}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="tbApiKey" className="text-xs">API Key {estado?.transbank?.hasApiKey && <span className="text-emerald-600">✓</span>}</Label>
              <Input
                id="tbApiKey"
                type="password"
                value={tbApiKey}
                onChange={(e) => setTbApiKey(e.target.value)}
                placeholder={estado?.transbank?.hasApiKey ? "••••• (cambiar)" : "579B5324D7449C24..."
                }
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="tbEnvironment" className="text-xs">Ambiente</Label>
              <select
                id="tbEnvironment"
                value={tbEnvironment}
                onChange={(e) => setTbEnvironment(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="INTEGRACION">INTEGRACION (test, sin cobro real)</option>
                <option value="PRODUCCION">PRODUCCION (real)</option>
              </select>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Ambiente actual: <strong>{estado?.transbank?.environment || "no configurado"}</strong>
              </p>
            </div>
          </div>

          <Button onClick={guardarTB} disabled={saving} size="sm">
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
            Guardar Transbank
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Tipos de pago soportados</p>
          <ul className="space-y-0.5">
            <li>• <strong>MercadoPago Orders API</strong> — ventas del marketplace con tarjeta tokenizada (sin redirect). Split automático entre plataforma y repartidor que tenga MP OAuth conectado.</li>
            <li>• <strong>Transbank Webpay</strong> — subscripciones de planes (mensual/anual). Redirect a Webpay para pago con tarjeta/débito/crédito. Sin split, más económico para pagos fijos.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
