"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Info, Droplets, HandCoins, Users, Receipt, FileText, Calendar, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { apiPut } from "@/components/akuosplash/akuosplash-api-client";
import {
  MODOS_LIQUIDACION,
  TIPOS_TRIBUTO,
  APLICA_IMPUESTO_SOBRE,
  formatCurrency,
} from "@/components/akuosplash/akuosplash-helpers";


interface Config {
  id: string;
  nombreChofer: string;
  nombreDueno: string;
  capacidadCamion: number;
  modoLiquidacion: string;
  porcentajeComisionChofer: number;
  porcentajeComisionDueno: number;
  montoPorVueltaUnicoCliente: number;
  montoPorVueltaMultiple: number;
  precioEfectivoPorLitro: number;
  precioTransferenciaPorLitro: number;
  precioCamionCompleto: number;
  tipoTributo: string;
  porcentajeImpuesto: number;
  aplicaImpuestoSobre: string;
  choferesPuedenEditarClientes: boolean;
  choferesPuedenCrearPedidos: boolean;
  // Periodo de liquidación
  periodoLiquidacion?: string;
  diaCierreMes?: number;
  diaCierreSemana?: number;
  // Empresa
  empresaRazonSocial?: string | null;
  empresaRut?: string | null;
  empresaDireccion?: string | null;
  empresaTelefono?: string | null;
  empresaEmail?: string | null;
  empresaGiro?: string | null;
  empresaComuna?: string | null;
  empresaCiudad?: string | null;
  // Datos para transferencias
  transfBanco?: string | null;
  transfTipoCuenta?: string | null;
  transfNumeroCuenta?: string | null;
  transfTitular?: string | null;
  transfRutTitular?: string | null;
  transfEmail?: string | null;
  transfTelefono?: string | null;
}

interface ConfiguracionTabProps {
  config: Config | null;
  onConfigChange: (c: Config) => void;
  refreshKey: number;
  onRefresh: () => void;
  onCamionesChange: (camiones: { id: string; nombre: string; patente: string | null; capacidad: number; activo: boolean }[]) => void;
}

export function ConfiguracionTab({
  config,
  onConfigChange,
  refreshKey,
  onRefresh,
  onCamionesChange,
}: ConfiguracionTabProps) {
  const [nombreChofer, setNombreChofer] = useState("");
  const [nombreDueno, setNombreDueno] = useState("");

  // Datos de empresa
  const [empresaRazonSocial, setEmpresaRazonSocial] = useState("");
  const [empresaRut, setEmpresaRut] = useState("");
  const [empresaDireccion, setEmpresaDireccion] = useState("");
  const [empresaTelefono, setEmpresaTelefono] = useState("");
  const [empresaEmail, setEmpresaEmail] = useState("");
  const [empresaGiro, setEmpresaGiro] = useState("");
  const [empresaComuna, setEmpresaComuna] = useState("");
  const [empresaCiudad, setEmpresaCiudad] = useState("");

  // Datos para transferencias
  const [transfBanco, setTransfBanco] = useState("");
  const [transfTipoCuenta, setTransfTipoCuenta] = useState("");
  const [transfNumeroCuenta, setTransfNumeroCuenta] = useState("");
  const [transfTitular, setTransfTitular] = useState("");
  const [transfRutTitular, setTransfRutTitular] = useState("");
  const [transfEmail, setTransfEmail] = useState("");
  const [transfTelefono, setTransfTelefono] = useState("");

  const [modoLiquidacion, setModoLiquidacion] = useState("porcentaje");

  const [pctChofer, setPctChofer] = useState("50");
  const [pctDueno, setPctDueno] = useState("50");

  const [montoVueltaUnico, setMontoVueltaUnico] = useState("20000");
  const [montoVueltaMultiple, setMontoVueltaMultiple] = useState("25000");

  const [precioEfectivo, setPrecioEfectivo] = useState("0");
  const [precioTransferencia, setPrecioTransferencia] = useState("0");
  const [precioCamionCompleto, setPrecioCamionCompleto] = useState("0");

  // Impuestos
  const [tipoTributo, setTipoTributo] = useState("boleta_honorarios");
  const [porcentajeImpuesto, setPorcentajeImpuesto] = useState("15.25");
  const [aplicaImpuestoSobre, setAplicaImpuestoSobre] = useState("pago_chofer");

  // Permisos para choferes
  const [choferesPuedenEditarClientes, setChoferesPuedenEditarClientes] = useState(false);
  const [choferesPuedenCrearPedidos, setChoferesPuedenCrearPedidos] = useState(false);
  const [umbralCompletacion, setUmbralCompletacion] = useState("97.5");

  // Periodo de liquidación
  const [periodoLiquidacion, setPeriodoLiquidacion] = useState("mensual");
  const [diaCierreMes, setDiaCierreMes] = useState("0");
  const [diaCierreSemana, setDiaCierreSemana] = useState("6");

  const [saving, setSaving] = useState(false);
  const [wasabilApiKey, setWasabilApiKey] = useState("");

  useEffect(() => {
    if (config) {
      setNombreChofer(config.nombreChofer);
      setNombreDueno(config.nombreDueno);
      setModoLiquidacion(config.modoLiquidacion || "porcentaje");
      setPctChofer(String(config.porcentajeComisionChofer));
      setPctDueno(String(config.porcentajeComisionDueno));
      setMontoVueltaUnico(String(config.montoPorVueltaUnicoCliente));
      setMontoVueltaMultiple(String(config.montoPorVueltaMultiple));
      setPrecioEfectivo(String(config.precioEfectivoPorLitro));
      setPrecioTransferencia(String(config.precioTransferenciaPorLitro));
      setPrecioCamionCompleto(String(config.precioCamionCompleto ?? 0));
      setTipoTributo(config.tipoTributo || "boleta_honorarios");
      setPorcentajeImpuesto(String(config.porcentajeImpuesto ?? 15.25));
      setAplicaImpuestoSobre(config.aplicaImpuestoSobre || "pago_chofer");
      setChoferesPuedenEditarClientes(config.choferesPuedenEditarClientes ?? false);
      setChoferesPuedenCrearPedidos(config.choferesPuedenCrearPedidos ?? false);
      const umbral = (config as any).umbralCompletacionVuelta ?? 0.975;
      setUmbralCompletacion(String(Math.round(umbral * 1000) / 10));
      // Periodo de liquidación
      setPeriodoLiquidacion(config.periodoLiquidacion || "mensual");
      setDiaCierreMes(String(config.diaCierreMes ?? 0));
      setDiaCierreSemana(String(config.diaCierreSemana ?? 6));
      // Empresa
      setEmpresaRazonSocial(config.empresaRazonSocial ?? "");
      setEmpresaRut(config.empresaRut ?? "");
      setEmpresaDireccion(config.empresaDireccion ?? "");
      setEmpresaTelefono(config.empresaTelefono ?? "");
      setEmpresaEmail(config.empresaEmail ?? "");
      setEmpresaGiro(config.empresaGiro ?? "");
      setEmpresaComuna(config.empresaComuna ?? "");
      setEmpresaCiudad(config.empresaCiudad ?? "");

      // Datos para transferencias
      setTransfBanco((config as any).transfBanco ?? "");
      setTransfTipoCuenta((config as any).transfTipoCuenta ?? "");
      setTransfNumeroCuenta((config as any).transfNumeroCuenta ?? "");
      setTransfTitular((config as any).transfTitular ?? "");
      setTransfRutTitular((config as any).transfRutTitular ?? "");
      setTransfEmail((config as any).transfEmail ?? "");
      setTransfTelefono((config as any).transfTelefono ?? "");
    }
  }, [config]);

  // Auto-ajustar porcentaje cuando cambia tipo de tributo
  function onChangeTipoTributo(t: string) {
    setTipoTributo(t);
    if (t === "ninguno") {
      setPorcentajeImpuesto("0");
    } else if (t === "boleta_honorarios" && porcentajeImpuesto === "0") {
      setPorcentajeImpuesto("15.25");
    }
  }

  function onChangeChofer(v: string) {
    const n = Number(v) || 0;
    setPctChofer(String(n));
    setPctDueno(String(Math.max(0, 100 - n)));
  }
  function onChangeDueno(v: string) {
    const n = Number(v) || 0;
    setPctDueno(String(n));
    setPctChofer(String(Math.max(0, 100 - n)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const r = await apiPut<{ configuracion: Config }>("/api/akuosplash/configuracion", {
        nombreChofer,
        nombreDueno,
        modoLiquidacion,
        porcentajeComisionChofer: Number(pctChofer),
        porcentajeComisionDueno: Number(pctDueno),
        montoPorVueltaUnicoCliente: Number(montoVueltaUnico),
        montoPorVueltaMultiple: Number(montoVueltaMultiple),
        precioEfectivoPorLitro: Number(precioEfectivo),
        precioTransferenciaPorLitro: Number(precioTransferencia),
        precioCamionCompleto: Number(precioCamionCompleto),
        tipoTributo,
        porcentajeImpuesto: Number(porcentajeImpuesto),
        aplicaImpuestoSobre,
        choferesPuedenEditarClientes,
        choferesPuedenCrearPedidos: true, // siempre true — los choferes siempre pueden crear pedidos
        umbralCompletacionVuelta: (Number(umbralCompletacion) || 97.5) / 100,
        periodoLiquidacion,
        diaCierreMes: Number(diaCierreMes) || 0,
        diaCierreSemana: Number(diaCierreSemana) || 6,
        empresaRazonSocial,
        empresaRut,
        empresaDireccion,
        empresaTelefono,
        empresaEmail,
        empresaGiro,
        empresaComuna,
        empresaCiudad,
        // Datos para transferencias
        transfBanco,
        transfTipoCuenta,
        transfNumeroCuenta,
        transfTitular,
        transfRutTitular,
        transfEmail,
        transfTelefono,
        // wasabil.com
        wasabilApiKey,
      });
      onConfigChange(r.configuracion);
      toast.success("Configuración guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  // Ejemplo de cálculo de impuesto para mostrar
  const ejemploBase = 100000;
  const ejemploImpuesto = (ejemploBase * (Number(porcentajeImpuesto) || 0)) / 100;
  const ejemploLiquido = ejemploBase - ejemploImpuesto;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold sm:text-xl">Configuración</h2>
        <p className="text-sm text-muted-foreground">
          Datos del negocio, camiones, precios, reparto con la administración e impuestos.
        </p>
      </div>

      {/* Datos de la empresa */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Datos de la empresa</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="empresaRazonSocial" className="text-xs">Razón social</Label>
              <Input id="empresaRazonSocial" value={empresaRazonSocial} onChange={(e) => setEmpresaRazonSocial(e.target.value)} placeholder="Transporte VM SPA" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresaRut" className="text-xs">RUT</Label>
              <Input id="empresaRut" value={empresaRut} onChange={(e) => setEmpresaRut(e.target.value)} placeholder="77.123.456-7" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="empresaGiro" className="text-xs">Giro comercial</Label>
              <Input id="empresaGiro" value={empresaGiro} onChange={(e) => setEmpresaGiro(e.target.value)} placeholder="Transporte de agua" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresaDireccion" className="text-xs">Dirección</Label>
              <Input id="empresaDireccion" value={empresaDireccion} onChange={(e) => setEmpresaDireccion(e.target.value)} placeholder="Av. Principal 123" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="empresaComuna" className="text-xs">Comuna</Label>
              <Input id="empresaComuna" value={empresaComuna} onChange={(e) => setEmpresaComuna(e.target.value)} placeholder="La Serena" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresaCiudad" className="text-xs">Ciudad</Label>
              <Input id="empresaCiudad" value={empresaCiudad} onChange={(e) => setEmpresaCiudad(e.target.value)} placeholder="La Serena" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="empresaTelefono" className="text-xs">Teléfono</Label>
              <Input id="empresaTelefono" value={empresaTelefono} onChange={(e) => setEmpresaTelefono(e.target.value)} placeholder="+56 51 123 4567" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="empresaEmail" className="text-xs">Email comercial</Label>
            <Input id="empresaEmail" type="email" value={empresaEmail} onChange={(e) => setEmpresaEmail(e.target.value)} placeholder="contacto@transportevm.cl" />
          </div>
          <p className="text-xs text-muted-foreground">
            Estos datos aparecerán en los reportes y facturas. Aparecen en la liquidación como el nombre de la empresa.
          </p>
        </CardContent>
      </Card>

      {/* Datos para transferencias */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Datos para transferencias</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Estos datos van a aparecer cuando se registre un pago por transferencia
            (en entregas o cobros de deudas) para que el cliente los copie rápidamente.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transfBanco" className="text-xs">Banco</Label>
              <Input id="transfBanco" value={transfBanco} onChange={(e) => setTransfBanco(e.target.value)} placeholder="BancoEstado" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfTipoCuenta" className="text-xs">Tipo de cuenta</Label>
              <Input id="transfTipoCuenta" value={transfTipoCuenta} onChange={(e) => setTransfTipoCuenta(e.target.value)} placeholder="Cuenta Corriente" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transfNumeroCuenta" className="text-xs">Número de cuenta</Label>
            <Input id="transfNumeroCuenta" value={transfNumeroCuenta} onChange={(e) => setTransfNumeroCuenta(e.target.value)} placeholder="123456789" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transfTitular" className="text-xs">Titular</Label>
              <Input id="transfTitular" value={transfTitular} onChange={(e) => setTransfTitular(e.target.value)} placeholder="Transporte VM SPA" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfRutTitular" className="text-xs">RUT del titular</Label>
              <Input id="transfRutTitular" value={transfRutTitular} onChange={(e) => setTransfRutTitular(e.target.value)} placeholder="77.123.456-7" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transfEmail" className="text-xs">Email para transferencias (opcional)</Label>
              <Input id="transfEmail" type="email" value={transfEmail} onChange={(e) => setTransfEmail(e.target.value)} placeholder="pago@transportevm.cl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transfTelefono" className="text-xs">Teléfono PagoRUT (opcional)</Label>
              <Input id="transfTelefono" value={transfTelefono} onChange={(e) => setTransfTelefono(e.target.value)} placeholder="+56 9 1234 5678" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Precios por método de pago */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Precios por litro</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cfgPrecioEfectivo">Precio efectivo ($/litro)</Label>
              <Input
                id="cfgPrecioEfectivo"
                type="number"
                inputMode="decimal"
                step="any"
                value={precioEfectivo}
                onChange={(e) => setPrecioEfectivo(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Precio cuando el cliente paga en efectivo.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cfgPrecioTransferencia">Precio transferencia ($/litro)</Label>
              <Input
                id="cfgPrecioTransferencia"
                type="number"
                inputMode="decimal"
                step="any"
                value={precioTransferencia}
                onChange={(e) => setPrecioTransferencia(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Precio cuando el cliente paga por transferencia bancaria.
              </p>
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="mb-1 inline h-3 w-3" />{" "}
            <strong>Cómo se calcula:</strong> Al registrar una entrega, el precio se autocompleta según el método de pago elegido.
            Puedes modificarlo manualmente en cada entrega. Si un cliente tiene su propio precio configurado en su ficha,
            ese precio tiene prioridad sobre estos defaults.
          </div>
          <div className="space-y-2">
            <Label htmlFor="cfgPrecioCamionCompleto">Precio camión completo ($ fijo)</Label>
            <Input
              id="cfgPrecioCamionCompleto"
              type="number"
              inputMode="decimal"
              step="any"
              value={precioCamionCompleto}
              onChange={(e) => setPrecioCamionCompleto(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              Precio fijo por camión completo (independiente del método de pago). Útil para clientes con tarifa plana por viaje.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Modo de liquidación */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Modo de liquidación con la administración</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cfgModoLiquidacion">Modo</Label>
            <Select value={modoLiquidacion} onValueChange={setModoLiquidacion}>
              <SelectTrigger id="cfgModoLiquidacion">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODOS_LIQUIDACION.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {modoLiquidacion === "porcentaje" && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-sm font-medium">Reparto de utilidad</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cfgPctChofer">% para el chofer</Label>
                  <Input
                    id="cfgPctChofer"
                    type="number"
                    inputMode="decimal"
                    value={pctChofer}
                    onChange={(e) => onChangeChofer(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cfgPctDueno">% para el administrador</Label>
                  <Input
                    id="cfgPctDueno"
                    type="number"
                    inputMode="decimal"
                    value={pctDueno}
                    onChange={(e) => onChangeDueno(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                La utilidad bruta (ventas − gastos) se reparte entre chofer y administrador según estos porcentajes.
              </p>
            </div>
          )}

          {modoLiquidacion === "vuelta" && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-sm font-medium">Pago por vuelta entregada</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cfgMontoUnico">Monto por vuelta a 1 cliente</Label>
                  <Input
                    id="cfgMontoUnico"
                    type="number"
                    inputMode="decimal"
                    value={montoVueltaUnico}
                    onChange={(e) => setMontoVueltaUnico(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ejemplo: {formatCurrency(Number(montoVueltaUnico) || 0)} si el camión completo se descarga en un solo cliente.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cfgMontoMultiple">Monto por vuelta a múltiples clientes</Label>
                  <Input
                    id="cfgMontoMultiple"
                    type="number"
                    inputMode="decimal"
                    value={montoVueltaMultiple}
                    onChange={(e) => setMontoVueltaMultiple(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ejemplo: {formatCurrency(Number(montoVueltaMultiple) || 0)} si se entrega a más de un cliente en la misma vuelta.
                  </p>
                </div>
              </div>
              <Separator className="my-2" />
              <div className="rounded-lg bg-amber-50 p-3 text-xs dark:bg-amber-900/20">
                <p className="font-medium text-amber-800 dark:text-amber-200">Cómo se calcula tu pago:</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-amber-700 dark:text-amber-300">
                  <li>Cada vez que sales de la planta con el camión cargado, inicias una vuelta.</li>
                  <li>Si esa vuelta terminas entregando a 1 solo cliente → te pagan <strong>{formatCurrency(Number(montoVueltaUnico) || 0)}</strong>.</li>
                  <li>Si esa vuelta entregas a 2+ clientes → te pagan <strong>{formatCurrency(Number(montoVueltaMultiple) || 0)}</strong>.</li>
                  <li>Los gastos que pagaste tú (chofer) se suman a tu pago como reembolso.</li>
                  <li>El efectivo que recibiste en ruta se descuenta de tu pago total.</li>
                  <li>Se descuentan los impuestos según la configuración de abajo.</li>
                </ul>
              </div>
              <Separator className="my-2" />
              <div className="space-y-2">
                <Label htmlFor="cfgUmbral">Umbral de completación de vuelta (%)</Label>
                <Input
                  id="cfgUmbral"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  max="100"
                  value={umbralCompletacion}
                  onChange={(e) => setUmbralCompletacion(e.target.value)}
                  placeholder="97.5"
                />
                <p className="text-xs text-muted-foreground">
                  Porcentaje mínimo de agua entregada para que una vuelta cuente como válida automáticamente. Default: 97.5%. También puedes validar o invalidar vueltas manualmente desde el Historial.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PERÍODO DE LIQUIDACIÓN */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Período de liquidación</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cfgPeriodo">Tipo de período</Label>
            <Select value={periodoLiquidacion} onValueChange={setPeriodoLiquidacion}>
              <SelectTrigger id="cfgPeriodo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensual">Mensual (día 1 al último día del mes)</SelectItem>
                <SelectItem value="semanal">Semanal (domingo a sábado)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define cómo se agrupan las liquidaciones. El período actual y los anteriores aparecen en la pestaña Liquidación.
            </p>
          </div>

          {periodoLiquidacion === "mensual" && (
            <div className="space-y-2">
              <Label htmlFor="cfgDiaCierreMes">Día de cierre del mes</Label>
              <Input
                id="cfgDiaCierreMes"
                type="number"
                min="0"
                max="31"
                value={diaCierreMes}
                onChange={(e) => setDiaCierreMes(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                0 = último día del mes (default). 1-31 = día específico del mes.
              </p>
            </div>
          )}

          {periodoLiquidacion === "semanal" && (
            <div className="space-y-2">
              <Label htmlFor="cfgDiaCierreSemana">Día de cierre de la semana</Label>
              <Select value={diaCierreSemana} onValueChange={setDiaCierreSemana}>
                <SelectTrigger id="cfgDiaCierreSemana">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Domingo</SelectItem>
                  <SelectItem value="1">Lunes</SelectItem>
                  <SelectItem value="2">Martes</SelectItem>
                  <SelectItem value="3">Miércoles</SelectItem>
                  <SelectItem value="4">Jueves</SelectItem>
                  <SelectItem value="5">Viernes</SelectItem>
                  <SelectItem value="6">Sábado (default)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                La semana cierra ese día en la noche. Por defecto sábado.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* IMPUESTOS — nueva sección */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Impuestos</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cfgTipoTributo">Tipo de tributo</Label>
            <Select value={tipoTributo} onValueChange={onChangeTipoTributo}>
              <SelectTrigger id="cfgTipoTributo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_TRIBUTO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex flex-col">
                      <span>{t.label}</span>
                      <span className="text-xs text-muted-foreground">{t.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipoTributo !== "ninguno" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cfgPorcentajeImp">Porcentaje de impuesto (%)</Label>
                  <Input
                    id="cfgPorcentajeImp"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={porcentajeImpuesto}
                    onChange={(e) => setPorcentajeImpuesto(e.target.value)}
                    placeholder="15.25"
                  />
                  <p className="text-xs text-muted-foreground">
                    Variable según tu régimen. Boleta honorarios en Chile: 15.25% (10.75% retención + 4.5% previsión).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cfgAplicaSobre">Se aplica sobre</Label>
                  <Select value={aplicaImpuestoSobre} onValueChange={setAplicaImpuestoSobre}>
                    <SelectTrigger id="cfgAplicaSobre">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APLICA_IMPUESTO_SOBRE.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          <div className="flex flex-col">
                            <span>{a.label}</span>
                            <span className="text-xs text-muted-foreground">{a.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Ejemplo de cálculo */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
                <p className="mb-1 flex items-center gap-1 font-medium">
                  <FileText className="h-3.5 w-3.5" /> Ejemplo de cálculo (base {formatCurrency(ejemploBase)})
                </p>
                <div className="space-y-0.5 tabular-nums">
                  <p>Base imponible: <strong>{formatCurrency(ejemploBase)}</strong></p>
                  <p>Impuesto ({Number(porcentajeImpuesto) || 0}%): <strong className="text-red-600 dark:text-red-400">−{formatCurrency(ejemploImpuesto)}</strong></p>
                  <p className="border-t border-border pt-0.5">Líquido a recibir: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(ejemploLiquido)}</strong></p>
                </div>
              </div>
            </>
          )}

          {tipoTributo === "ninguno" && (
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              No se calcularán impuestos en la liquidación.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Permisos para choferes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Permisos para choferes</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex-1">
              <Label htmlFor="permChoferesClientes" className="text-sm font-medium">
                Choferes pueden agregar y editar clientes
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Si está activo, los choferes podrán crear nuevos clientes y editar los existentes
                desde su cuenta. Si está inactivo, solo ven el catálogo (solo lectura).
              </p>
            </div>
            <Switch
              id="permChoferesClientes"
              checked={choferesPuedenEditarClientes}
              onCheckedChange={setChoferesPuedenEditarClientes}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex-1">
              <Label htmlFor="permChoferesPedidos" className="text-sm font-medium">
                Choferes pueden crear pedidos
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Los choferes siempre pueden crear pedidos desde la app (es su trabajo en el terreno).
                Este permiso ya no se puede desactivar.
              </p>
            </div>
            <Switch
              id="permChoferesPedidos"
              checked={true}
              disabled
            />
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="mb-1 inline h-3 w-3" />{" "}
            <strong>Consejo:</strong> Los choferes pueden registrar pedidos cuando reciben llamadas
            de clientes directamente. Así registran el pedido en el momento y después lo convierten en
            entrega cuando lo llevan.
          </div>
        </CardContent>
      </Card>

      {/* MercadoPago */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">MercadoPago</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Conectá tu cuenta MercadoPago para recibir pagos automáticamente con división (split payment).
            Cuando un cliente paga, MercadoPago envía tu parte y retiene la comisión de la plataforma.
          </p>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
            <p className="font-medium text-blue-700">Estado: pendiente de conexión</p>
            <p className="text-xs text-blue-600 mt-1">Conectá tu cuenta desde la pestaña "Perfil".</p>
          </div>
        </CardContent>
      </Card>

      {/* Facturación electrónica SII — wasabil.com */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Facturación electrónica (SII)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Integración con <a href="https://wasabil.com" target="_blank" className="text-blue-600 hover:underline font-medium">wasabil.com</a> para emitir facturas electrónicas ante el SII de forma automática.
          </p>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Plataforma</Label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium">wasabil.com</div>
              <p className="text-[10px] text-muted-foreground">Plataforma externa de facturación electrónica integrada</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wasabilApiKey" className="text-xs">API Key de wasabil.com</Label>
              <Input id="wasabilApiKey" type="password" placeholder="Tu API key de wasabil.com" value={wasabilApiKey} onChange={(e) => setWasabilApiKey(e.target.value)} />
              <p className="text-[10px] text-muted-foreground">Obtené tu API key desde tu cuenta de wasabil.com → Configuración → API</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              <Info className="mb-1 inline h-3 w-3" /> Las facturas se emiten automáticamente cuando se confirma una entrega. El cliente recibe la factura por email.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar configuración
        </Button>
      </div>
    </div>
  );
}
