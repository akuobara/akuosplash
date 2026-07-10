"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Database, Info } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch } from "@/lib/api-client";

interface Config {
  id: string;
  nombreChofer: string;
  nombreDueno: string;
  porcentajeComisionChofer: number;
  porcentajeComisionDueno: number;
  precioPorLitroDefault: number;
}

interface ConfiguracionTabProps {
  config: Config | null;
  onConfigChange: (c: Config) => void;
}

export function ConfiguracionTab({ config, onConfigChange }: ConfiguracionTabProps) {
  const [nombreChofer, setNombreChofer] = useState("");
  const [nombreDueno, setNombreDueno] = useState("");
  const [pctChofer, setPctChofer] = useState("50");
  const [pctDueno, setPctDueno] = useState("50");
  const [precioDefault, setPrecioDefault] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setNombreChofer(config.nombreChofer);
      setNombreDueno(config.nombreDueno);
      setPctChofer(String(config.porcentajeComisionChofer));
      setPctDueno(String(config.porcentajeComisionDueno));
      setPrecioDefault(String(config.precioPorLitroDefault));
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
      const r = await apiPatch<{ configuracion: Config }>("/api/configuracion", {
        nombreChofer,
        nombreDueno,
        porcentajeComisionChofer: Number(pctChofer),
        porcentajeComisionDueno: Number(pctDueno),
        precioPorLitroDefault: Number(precioDefault) || 0,
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
          Datos del negocio, reparto con el dueño y precio por defecto.
        </p>
      </div>

      {/* Datos del chofer y dueño */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Partes involucradas</CardTitle>
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

      {/* Reparto de utilidad */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reparto de utilidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>
              La suma de los porcentajes debe ser 100%. Si uno cambia, el otro se ajusta automáticamente.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Precio por defecto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Precio por litro por defecto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="cfgPrecioDefault">Precio sugerido para nuevas entregas</Label>
          <Input
            id="cfgPrecioDefault"
            type="number"
            inputMode="decimal"
            step="any"
            value={precioDefault}
            onChange={(e) => setPrecioDefault(e.target.value)}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            Lo puedes cambiar en cada entrega. Sirve como valor inicial para ahorrar tiempo.
          </p>
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
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar configuración
        </Button>
      </div>
    </div>
  );
}
