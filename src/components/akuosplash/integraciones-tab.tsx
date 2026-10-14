"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CreditCard, CheckCircle2, XCircle, AlertTriangle, Save, ExternalLink, ShieldCheck, Zap, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { akuoGet, akuoPut, akuoApi } from "@/components/akuosplash/akuosplash-utils";

interface IntegracionEstado {
  mercadopago: {
    configured: boolean;
    sandbox: boolean;
    hasAccessToken: boolean;
    hasPublicKey: boolean;
    hasClientId: boolean;
    hasUserId: boolean;
  };
  mpInstant: {
    configured: boolean;
    hasAccessToken: boolean;
    hasPublicKey: boolean;
    hasUserId: boolean;
  };
  mp10day: {
    configured: boolean;
    hasAccessToken: boolean;
    hasPublicKey: boolean;
    hasUserId: boolean;
  };
  transbank: {
    configured: boolean;
    environment: string;
    hasCommerceCode: boolean;
    hasApiKey: boolean;
  };
}

export function IntegracionesTab() {
  const [estado, setEstado] = useState<IntegracionEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // MP Legacy (default)
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [mpPublicKey, setMpPublicKey] = useState("");
  const [mpClientId, setMpClientId] = useState("");
  const [mpUserId, setMpUserId] = useState("");
  const [mpSandbox, setMpSandbox] = useState(true);

  // MP Instant (Plan Pro)
  const [mpInstAccessToken, setMpInstAccessToken] = useState("");
  const [mpInstPublicKey, setMpInstPublicKey] = useState("");
  const [mpInstUserId, setMpInstUserId] = useState("");

  // MP 10day (Plan Premium)
  const [mp10AccessToken, setMp10AccessToken] = useState("");
  const [mp10PublicKey, setMp10PublicKey] = useState("");
  const [mp10UserId, setMp10UserId] = useState("");

  // Transbank (legacy subscriptions — ahora solo fallback)
  const [tbCommerceCode, setTbCommerceCode] = useState("");
  const [tbApiKey, setTbApiKey] = useState("");
  const [tbEnvironment, setTbEnvironment] = useState("INTEGRACION");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await akuoGet<IntegracionEstado>("/api/akuosplash/integraciones/estado");
      setEstado(d);
      if (d.mercadopago) setMpSandbox(d.mercadopago.sandbox);
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
      toast.success("MercadoPago (default) actualizado");
      setMpAccessToken(""); setMpPublicKey(""); setMpClientId(""); setMpUserId("");
      cargar();
    } catch (e: any) {
      toast.error("No se pudo guardar: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  async function guardarMPInstant() {
    setSaving(true);
    try {
      await akuoPut("/api/akuosplash/integraciones/mercadopago-instant", {
        accessToken: mpInstAccessToken || undefined,
        publicKey: mpInstPublicKey || undefined,
        userId: mpInstUserId || undefined,
      });
      toast.success("MercadoPago (Instant) actualizado");
      setMpInstAccessToken(""); setMpInstPublicKey(""); setMpInstUserId("");
      cargar();
    } catch (e: any) {
      toast.error("No se pudo guardar: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  async function guardarMP10day() {
    setSaving(true);
    try {
      await akuoPut("/api/akuosplash/integraciones/mercadopago-10day", {
        accessToken: mp10AccessToken || undefined,
        publicKey: mp10PublicKey || undefined,
        userId: mp10UserId || undefined,
      });
      toast.success("MercadoPago (10 días) actualizado");
      setMp10AccessToken(""); setMp10PublicKey(""); setMp10UserId("");
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

  function MPStatusBadge({ configured }: { configured: boolean }) {
    return configured ? (
      <Badge variant="default" className="bg-emerald-100 text-emerald-800 ml-2 text-[10px]">
        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Configurado
      </Badge>
    ) : (
      <Badge variant="destructive" className="ml-2 text-[10px]">
        <XCircle className="h-2.5 w-2.5 mr-0.5" /> Sin configurar
      </Badge>
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
            MercadoPago tiene 3 cuentas: <strong>Default</strong> (legacy, para Plan Gratis — sin split), <strong>Instant</strong> (pago inmediato, Plan Pro) y <strong>10 días</strong> (pago diferido, Plan Premium). Configurá las 2 nuevas para que el split del marketplace funcione según el plan del transportista.
          </p>
        </CardContent>
      </Card>

      {/* === MP DEFAULT (legacy, fallback para Plan Gratis) === */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-amber-600" /> MercadoPago — Default (sin split)
              <MPStatusBadge configured={estado?.mercadopago?.configured || false} />
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
          <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
            <p className="font-medium mb-0.5">Uso</p>
            Plan Gratis: el cliente paga a la plataforma (sin split). El transportista recibe el pago solo después de subir su factura a la plataforma. Comisión 20%.
          </div>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Access Token {estado?.mercadopago?.hasAccessToken && <span className="text-emerald-600">✓</span>}</Label>
              <Input type="password" value={mpAccessToken} onChange={(e) => setMpAccessToken(e.target.value)}
                placeholder={estado?.mercadopago?.hasAccessToken ? "••••• (cambiar)" : "APP_USR-..."} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Public Key {estado?.mercadopago?.hasPublicKey && <span className="text-emerald-600">✓</span>}</Label>
              <Input type="password" value={mpPublicKey} onChange={(e) => setMpPublicKey(e.target.value)}
                placeholder={estado?.mercadopago?.hasPublicKey ? "••••• (cambiar)" : "APP_USR-..."} className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Client ID {estado?.mercadopago?.hasClientId && <span className="text-emerald-600">✓</span>}</Label>
                <Input value={mpClientId} onChange={(e) => setMpClientId(e.target.value)}
                  placeholder={estado?.mercadopago?.hasClientId ? "(cambiar)" : "1234567890123"} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">User ID {estado?.mercadopago?.hasUserId && <span className="text-emerald-600">✓</span>}</Label>
                <Input value={mpUserId} onChange={(e) => setMpUserId(e.target.value)}
                  placeholder={estado?.mercadopago?.hasUserId ? "(cambiar)" : "123456789"} className="h-8 text-sm" />
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
            Guardar MP Default
          </Button>
        </CardContent>
      </Card>

      {/* === MP INSTANT (Plan Pro) === */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-violet-600" /> MercadoPago — Instant (Plan Pro)
              <MPStatusBadge configured={estado?.mpInstant?.configured || false} />
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-violet-50 border border-violet-200 p-2 text-xs text-violet-900 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-200">
            <p className="font-medium mb-0.5">Uso</p>
            Plan Pro: split con pago inmediato al transportista (MP libera los fondos al transportista apenas se aprueba el pago). Comisión 10%.
          </div>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Access Token (cuenta MP con liberación inmediata) {estado?.mpInstant?.hasAccessToken && <span className="text-emerald-600">✓</span>}</Label>
              <Input type="password" value={mpInstAccessToken} onChange={(e) => setMpInstAccessToken(e.target.value)}
                placeholder={estado?.mpInstant?.hasAccessToken ? "••••• (cambiar)" : "APP_USR-... (cuenta PRO)"} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Public Key {estado?.mpInstant?.hasPublicKey && <span className="text-emerald-600">✓</span>}</Label>
              <Input type="password" value={mpInstPublicKey} onChange={(e) => setMpInstPublicKey(e.target.value)}
                placeholder={estado?.mpInstant?.hasPublicKey ? "••••• (cambiar)" : "APP_USR-..."} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">User ID de la plataforma (collector) {estado?.mpInstant?.hasUserId && <span className="text-emerald-600">✓</span>}</Label>
              <Input value={mpInstUserId} onChange={(e) => setMpInstUserId(e.target.value)}
                placeholder={estado?.mpInstant?.hasUserId ? "(cambiar)" : "123456789"} className="h-8 text-sm" />
            </div>
          </div>
          <Button onClick={guardarMPInstant} disabled={saving} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
            Guardar MP Instant
          </Button>
        </CardContent>
      </Card>

      {/* === MP 10day (Plan Premium) === */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-600" /> MercadoPago — 10 días (Plan Premium)
              <MPStatusBadge configured={estado?.mp10day?.configured || false} />
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-blue-50 border border-blue-200 p-2 text-xs text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200">
            <p className="font-medium mb-0.5">Uso</p>
            Plan Premium: split con retención de 10 días (MP libera los fondos al transportista 10 días después del pago). Comisión 15%. El transportista emite sus propios documentos tributarios para el SII.
          </div>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Access Token (cuenta MP con liberación a 10 días) {estado?.mp10day?.hasAccessToken && <span className="text-emerald-600">✓</span>}</Label>
              <Input type="password" value={mp10AccessToken} onChange={(e) => setMp10AccessToken(e.target.value)}
                placeholder={estado?.mp10day?.hasAccessToken ? "••••• (cambiar)" : "APP_USR-... (cuenta 10d)"} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Public Key {estado?.mp10day?.hasPublicKey && <span className="text-emerald-600">✓</span>}</Label>
              <Input type="password" value={mp10PublicKey} onChange={(e) => setMp10PublicKey(e.target.value)}
                placeholder={estado?.mp10day?.hasPublicKey ? "••••• (cambiar)" : "APP_USR-..."} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">User ID de la plataforma (collector) {estado?.mp10day?.hasUserId && <span className="text-emerald-600">✓</span>}</Label>
              <Input value={mp10UserId} onChange={(e) => setMp10UserId(e.target.value)}
                placeholder={estado?.mp10day?.hasUserId ? "(cambiar)" : "123456789"} className="h-8 text-sm" />
            </div>
          </div>
          <Button onClick={guardarMP10day} disabled={saving} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
            Guardar MP 10 días
          </Button>
        </CardContent>
      </Card>

      {/* === TRANSBANK === */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-red-600" /> Transbank Webpay (legacy)
              <MPStatusBadge configured={estado?.transbank?.configured || false} />
            </CardTitle>
            <a href="https://transbank.cl/login" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              Panel Transbank <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-gray-50 border border-gray-200 p-2 text-xs text-gray-700 dark:bg-gray-950/30 dark:border-gray-800 dark:text-gray-300">
            <p className="font-medium mb-0.5">Uso</p>
            Legacy: subscripciones de planes (ahora MercadoPago es el método principal). Mantenido como fallback.
          </div>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Código de comercio {estado?.transbank?.hasCommerceCode && <span className="text-emerald-600">✓</span>}</Label>
              <Input value={tbCommerceCode} onChange={(e) => setTbCommerceCode(e.target.value)}
                placeholder={estado?.transbank?.hasCommerceCode ? "••••• (cambiar)" : "597055555536 (test)"} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">API Key {estado?.transbank?.hasApiKey && <span className="text-emerald-600">✓</span>}</Label>
              <Input type="password" value={tbApiKey} onChange={(e) => setTbApiKey(e.target.value)}
                placeholder={estado?.transbank?.hasApiKey ? "••••• (cambiar)" : "579B5324D7449C24..."} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Ambiente</Label>
              <select value={tbEnvironment} onChange={(e) => setTbEnvironment(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm">
                <option value="INTEGRACION">INTEGRACION (test)</option>
                <option value="PRODUCCION">PRODUCCION (real)</option>
              </select>
              <p className="text-[10px] text-muted-foreground mt-0.5">Actual: <strong>{estado?.transbank?.environment || "no configurado"}</strong></p>
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
          <p className="font-medium text-foreground mb-1">Resumen del flujo de pago según plan</p>
          <ul className="space-y-1">
            <li>• <strong>Plan Gratis</strong> (default MP, sin split): el cliente paga a la plataforma. Comisión 20%. El transportista sube su factura y la plataforma le paga.</li>
            <li>• <strong>Plan Premium</strong> (MP 10 días, split): el cliente paga, MP retiene 10 días, luego libera al transportista. Comisión 15%. El transportista emite sus propios docs SII.</li>
            <li>• <strong>Plan Pro</strong> (MP Instant, split + Wasabil Growth): el cliente paga, MP libera inmediatamente al transportista. Comisión 10%. Wasabil (plan Growth de wasabil.cl) emite la factura automáticamente (incluido en el plan).</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
