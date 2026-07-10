"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, Info, Droplets, HandCoins, Truck, Users } from "lucide-react";
import { toast } from "sonner";
import { apiPut } from "@/lib/api-client";
import { MODOS_LIQUIDACION, formatCurrency } from "@/lib/helpers";

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
}

interface ConfiguracionTabProps {
  config: Config | null;
  onConfigChange: (c: Config) => void;
}

export function ConfiguracionTab({ config, onConfigChange }: ConfiguracionTabProps) {
  const [nombreChofer, setNombreChofer] = useState("");
  const [nombreDueno, setNombreDueno] = useState("");
  const [capacidadCamion, setCapacidadCamion] = useState("17000");

  const [modoLiquidacion, setModoLiquidacion] = useState("porcentaje");

  const [pctChofer, setPctChofer] = useState("50");
  const [pctDueno, setPctDueno] = useState("50");

  const [montoVueltaUnico, setMontoVueltaUnico] = useState("20000");
  const [montoVueltaMultiple, setMontoVueltaMultiple] = useState("25000");

  const [precioEfectivo, setPrecioEfectivo] = useState("0");
  const [precioTransferencia, setPrecioTransferencia] = useState("0");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setNombreChofer(config.nombreChofer);
      setNombreDueno(config.nombreDueno);
      setCapacidadCamion(String(config.capacidadCamion));
      setModoLiquidacion(config.modoLiquidacion || "porcentaje");
      setPctChofer(String(config.porcentajeComisionChofer));
      setPctDueno(String(config.porcentajeComisionDueno));
      setMontoVueltaUnico(String(config.montoPorVueltaUnicoCliente));
      setMontoVueltaMultiple(String(config.montoPorVueltaMultiple));
      setPrecioEfectivo(String(config.precioEfectivoPorLitro));
      setPrecioTransferencia(String(config.precioTransferenciaPorLitro));
    }
  }, [config]);

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
      const r = await apiPut<{ configuracion: Config }>("/api/configuracion", {
        nombreChofer,
        nombreDueno,
        capacidadCamion: Number(capacidadCamion) || 17000,
        modoLiquidacion,
        porcentajeComisionChofer: Number(pctChofer),
        porcentajeComisionDueno: Number(pctDueno),
        montoPorVueltaUnicoCliente: Number(montoVueltaUnico),
        montoPorVueltaMultiple: Number(montoVueltaMultiple),
        precioEfectivoPorLitro: Number(precioEfectivo),
        precioTransferenciaPorLitro: Number(precioTransferencia),
      });
      onConfigChange(r.configuracion);
      toast.success("Configuración guardada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold sm:text-xl">Configuración</h2>
        <p className="text-sm text-muted-foreground">
          Datos del negocio, capacidad del camión, precios y reparto con el dueño.
        </p>
      </div>

      {/* Datos del chofer y dueño */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Partes involucradas</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cfgNombreChofer">Tu nombre (chofer)</Label>
            <Input
              id="cfgNombreChofer"
              value={nombreChofer}
              onChange={(e) => setNombreChofer(e.target.value)}
              placeholder="Ej. Pedro"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cfgNombreDueno">Nombre del dueño del camión</Label>
            <Input
              id="cfgNombreDueno"
              value={nombreDueno}
              onChange={(e) => setNombreDueno(e.target.value)}
              placeholder="Ej. Transportes Agua Ltda."
            />
          </div>
        </CardContent>
      </Card>

      {/* Datos del camión */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Camión aljibe</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="cfgCapacidad">Capacidad del estanque (litros)</Label>
          <Input
            id="cfgCapacidad"
            type="number"
            inputMode="numeric"
            value={capacidadCamion}
            onChange={(e) => setCapacidadCamion(e.target.value)}
            placeholder="17000"
          />
          <p className="text-xs text-muted-foreground">
            Se usa para mostrar el progreso de carga de cada vuelta y avisarte si la superas.
          </p>
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
        </CardContent>
      </Card>

      {/* Modo de liquidación */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Modo de liquidación con el dueño</CardTitle>
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
                  <Label htmlFor="cfgPctDueno">% para el dueño</Label>
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
                La utilidad bruta (ventas − gastos) se reparte entre chofer y dueño según estos porcentajes.
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
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Próximas funciones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Próximas funciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Estas funciones están planificadas para siguientes versiones de la app:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Venta de agua directa desde la app (clientes pueden pedir y pagar online).</li>
            <li>Recordatorios automáticos a clientes con saldo pendiente.</li>
            <li>Exportación de reportes a PDF/Excel para compartir con el dueño.</li>
            <li>Soporte multi-camión si en el futuro manejas más de una unidad.</li>
            <li>Cuentas de usuario separadas para chofer y dueño (cada uno ve lo que le corresponde).</li>
          </ul>
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
