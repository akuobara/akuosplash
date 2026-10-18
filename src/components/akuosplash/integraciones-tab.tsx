"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CreditCard, CheckCircle2, XCircle, Save, ExternalLink, ShieldCheck, RefreshCw, Copy,
} from "lucide-react";
import { toast } from "sonner";
import { akuoGet, akuoPut } from "@/components/akuosplash/akuosplash-utils";

interface IntegracionEstado {
  mpSplit: {
    configured: boolean;
    hasAccessToken: boolean;
    hasPublicKey: boolean;
    hasUserId: boolean;
  };
  mpSub: {
    configured: boolean;
    hasAccessToken: boolean;
    hasPublicKey: boolean;
  };
  mercadopago?: { configured: boolean; sandbox: boolean };
  transbank?: { configured: boolean; environment: string };
}

export function IntegracionesTab() {
  const [estado, setEstado] = useState<IntegracionEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // MP Split (marketplace — cliente paga)
  const [splitAccessToken, setSplitAccessToken] = useState("");
  const [splitPublicKey, setSplitPublicKey] = useState("");
  const [splitUserId, setSplitUserId] = useState("");

  // MP Subscriptions (transportista paga por plan)
  const [subAccessToken, setSubAccessToken] = useState("");
  const [subPublicKey, setSubPublicKey] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await akuoGet<IntegracionEstado>("/api/akuosplash/integraciones/estado");
      setEstado(d);
    } catch (e: any) {
      toast.error("No se pudo cargar el estado: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardarSplit() {
    setSaving(true);
    try {
      await akuoPut("/api/akuosplash/integraciones/mercadopago-split", {
        accessToken: splitAccessToken || undefined,
        publicKey: splitPublicKey || undefined,
        userId: splitUserId || undefined,
      });
      toast.success("MP Split (marketplace) actualizado");
      setSplitAccessToken(""); setSplitPublicKey(""); setSplitUserId("");
      cargar();
    } catch (e: any) {
      toast.error("No se pudo guardar: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  async function guardarSub() {
    setSaving(true);
    try {
      await akuoPut("/api/akuosplash/integraciones/mercadopago-sub", {
        accessToken: subAccessToken || undefined,
        publicKey: subPublicKey || undefined,
      });
      toast.success("MP Subscriptions actualizado");
      setSubAccessToken(""); setSubPublicKey("");
      cargar();
    } catch (e: any) {
      toast.error("No se pudo guardar: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  }

  // Copiar valores actuales (si están configurados) a los inputs para editarlos fácilmente
  function copyLegacyToSplit() {
    // Si hay env vars AKUO_MP_ACCESS_TOKEN, copiarlos al form (solo si los inputs están vacíos)
    setSplitAccessToken(prev => prev || "");
    toast.info("Podés pegar las credenciales actuales del entorno (AKUO_MP_*) en los inputs.");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function StatusBadge({ configured }: { configured: boolean }) {
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
            MercadoPago usa <strong>2 cuentas separadas</strong>:
            <br />
            1. <strong>MP Split</strong> — para pagos del marketplace (cliente paga por agua). MP divide entre plataforma y transportista. La comisión la calcula AkuoSplash según el plan del transportista, no MP.
            <br />
            2. <strong>MP Subscriptions</strong> — para subscripciones de planes (transportista paga por su plan mensual/anual). Usa la API de preapprovals de MP.
            <br />
            Para testing, podés usar la misma cuenta de MP para ambas (mismas credenciales).
          </p>
        </CardContent>
      </Card>

      {/* === MP SPLIT (marketplace) === */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-blue-600" /> MP Split — Marketplace
              <StatusBadge configured={estado?.mpSplit?.configured || false} />
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
            Cuando un cliente paga por un pedido de agua en el marketplace, MP divide el pago:
            <br />• Transportista recibe: <strong>total − comisión</strong>
            <br />• Plataforma retiene: <strong>comisión</strong> (calculada por AkuoSplash según el plan del transportista)
            <br />El tiempo de liberación de fondos (10 días para Premium, inmediato para Pro) se configura en la cuenta de cada transportista en MP, no acá.
          </div>

          <div className="space-y-2">
            <div>
              <Label className="text-xs">Access Token {estado?.mpSplit?.hasAccessToken && <span className="text-emerald-600">✓ configurado</span>}</Label>
              <Input type="password" value={splitAccessToken} onChange={(e) => setSplitAccessToken(e.target.value)}
                placeholder={estado?.mpSplit?.hasAccessToken ? "••••• (cambiar)" : "APP_USR-1234-... o TEST-1234-... (sandbox)"} className="h-8 text-sm" />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Token de la cuenta MP de la plataforma. Para testing usar uno que empiece con <code>TEST-</code>.
              </p>
            </div>
            <div>
              <Label className="text-xs">Public Key {estado?.mpSplit?.hasPublicKey && <span className="text-emerald-600">✓</span>}</Label>
              <Input type="password" value={splitPublicKey} onChange={(e) => setSplitPublicKey(e.target.value)}
                placeholder={estado?.mpSplit?.hasPublicKey ? "••••• (cambiar)" : "APP_USR-... o TEST-..."} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">User ID del collector (plataforma) {estado?.mpSplit?.hasUserId && <span className="text-emerald-600">✓</span>}</Label>
              <Input value={splitUserId} onChange={(e) => setSplitUserId(e.target.value)}
                placeholder={estado?.mpSplit?.hasUserId ? "(cambiar)" : "123456789"} className="h-8 text-sm" />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                ID de usuario de la plataforma en MP (para recibir la comisión del split).
              </p>
            </div>
          </div>

          <Button onClick={guardarSplit} disabled={saving} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
            Guardar MP Split
          </Button>
        </CardContent>
      </Card>

      {/* === MP SUBSCRIPTIONS (transportistas pagan por plan) === */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-violet-600" /> MP Subscriptions — Planes
              <StatusBadge configured={estado?.mpSub?.configured || false} />
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-violet-50 border border-violet-200 p-2 text-xs text-violet-900 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-200">
            <p className="font-medium mb-0.5">Uso</p>
            Cuando un transportista sube de plan (Premium $15.000/mes o Pro $50.000/mes), se crea una
            <strong> preapproval (subscripción recurrente)</strong> en MP. MP cobra automáticamente cada mes/año.
            <br />Usa la API de preapprovals de MP (<code>/preapproval</code>).
          </div>

          <div className="space-y-2">
            <div>
              <Label className="text-xs">Access Token {estado?.mpSub?.hasAccessToken && <span className="text-emerald-600">✓ configurado</span>}</Label>
              <Input type="password" value={subAccessToken} onChange={(e) => setSubAccessToken(e.target.value)}
                placeholder={estado?.mpSub?.hasAccessToken ? "••••• (cambiar)" : "APP_USR-... o TEST-..."} className="h-8 text-sm" />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Token de la cuenta MP para subscripciones. Para testing, podés usar el mismo que en MP Split.
              </p>
            </div>
            <div>
              <Label className="text-xs">Public Key {estado?.mpSub?.hasPublicKey && <span className="text-emerald-600">✓</span>}</Label>
              <Input type="password" value={subPublicKey} onChange={(e) => setSubPublicKey(e.target.value)}
                placeholder={estado?.mpSub?.hasPublicKey ? "••••• (cambiar)" : "APP_USR-... o TEST-..."} className="h-8 text-sm" />
            </div>
          </div>

          <Button onClick={guardarSub} disabled={saving} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
            Guardar MP Subscriptions
          </Button>
        </CardContent>
      </Card>

      {/* Helper: cómo obtener credenciales de testing */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">🧪 Cómo probar con credenciales de sandbox</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-amber-900 dark:text-amber-200">
          <p>
            1. Andá a <a href="https://www.mercadopago.cl/developers/panel/app" target="_blank" rel="noopener" className="underline font-medium">Panel MP</a> y create una aplicación (o usá una existente).
          </p>
          <p>
            2. En la sección <strong>"Credenciales de prueba"</strong> (sandbox), copiá:
            <br />• <code>Access Token</code> (empieza con <code>TEST-</code>)
            <br />• <code>Public Key</code> (empieza con <code>TEST-</code>)
            <br />• <code>User ID</code> (número, ej: <code>123456789</code>)
          </p>
          <p>
            3. Pegá esos valores en los inputs de <strong>MP Split</strong> y <strong>MP Subscriptions</strong> (podés usar los mismos para ambas).
          </p>
          <p>
            4. En la misma app de MP, andá a <strong>Webhooks → Notificaciones</strong> y agregá la URL:
            <br /><code className="text-[10px]">https://akuosplash.cl/api/akuosplash/subscription/mercadopago/webhook</code>
          </p>
          <p>
            5. Para probar un pago de plan: logueate como transportista → tab 💎 Subscripción → elegir plan → "Pagar con MercadoPago" → usar tarjeta de test de MP:
            <br /><code>4075 5957 4254 3645</code> (visa, sin clave, vence 11/25)
          </p>
          <p>
            6. Para probar un pago de marketplace (split): logueate como cliente → pedir agua → MP checkout → misma tarjeta de test.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
