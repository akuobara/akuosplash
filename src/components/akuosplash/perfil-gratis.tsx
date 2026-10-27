"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Building2, Truck, FileText, Save, AlertCircle, CheckCircle2, CreditCard } from "lucide-react";
import { akuoGet, akuoApi, formatCLP } from "@/components/akuosplash/akuosplash-utils";
import { toast } from "sonner";

interface PerfilGratisProps {
  user: any;
  onUpdated: () => void;
}

export function PerfilGratis({ user, onUpdated }: PerfilGratisProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    // Datos personales del chofer (persona natural)
    nombre: "", telefono: "", rut: "",
    licenciaConducirUrl: "",
    permisoCircUrl: "",
    seguroUrl: "",
    // Datos de la empresa
    razonSocial: "", rutEmpresa: "", giro: "",
    direccionEmpresa: "", comunaEmpresa: "", ciudadEmpresa: "",
    telefonoEmpresa: "", emailEmpresa: "",
    // Datos del vehículo
    patenteVehiculo: "", tipoVehiculo: "aljibe", capacidadVehiculoKg: "",
  });

  useEffect(() => {
    akuoGet<{ user: any }>("/api/akuosplash/cliente/perfil").then(d => {
      if (!d.user) return;
      const u = d.user;
      setForm({
        nombre: u.nombre || "", telefono: u.telefono || "", rut: u.rut || "",
        licenciaConducirUrl: u.licenciaConducirUrl || "",
        permisoCircUrl: u.permisoCircUrl || "",
        seguroUrl: u.seguroUrl || "",
        razonSocial: u.razonSocial || "", rutEmpresa: u.rutEmpresa || "", giro: u.giro || "",
        direccionEmpresa: u.direccionEmpresa || "", comunaEmpresa: u.comunaEmpresa || "",
        ciudadEmpresa: u.ciudadEmpresa || "", telefonoEmpresa: u.telefonoEmpresa || "",
        emailEmpresa: u.emailEmpresa || "",
        patenteVehiculo: u.patenteVehiculo || "", tipoVehiculo: u.tipoVehiculo || "aljibe",
        capacidadVehiculoKg: u.capacidadVehiculoKg ? String(u.capacidadVehiculoKg) : "",
      });
    }).catch(() => {});
  }, []);

  function update(field: string, value: any) { setForm({ ...form, [field]: value }); }

  async function guardar() {
    if (!form.rut.trim()) { toast.error("El RUT personal del chofer es obligatorio"); return; }
    if (!form.razonSocial.trim()) { toast.error("La razón social de la empresa es obligatoria"); return; }
    if (!form.rutEmpresa.trim()) { toast.error("El RUT de la empresa es obligatorio"); return; }
    if (!form.patenteVehiculo.trim()) { toast.error("La patente del vehículo es obligatoria"); return; }
    setSaving(true);
    try {
      await akuoApi("/api/akuosplash/cliente/perfil", {
        method: "PATCH",
        body: JSON.stringify({
          nombre: form.nombre,
          telefono: form.telefono,
          rut: form.rut,
          licenciaConducirUrl: form.licenciaConducirUrl || undefined,
          permisoCircUrl: form.permisoCircUrl || undefined,
          seguroUrl: form.seguroUrl || undefined,
          razonSocial: form.razonSocial,
          rutEmpresa: form.rutEmpresa,
          giro: form.giro || undefined,
          direccionEmpresa: form.direccionEmpresa || undefined,
          comunaEmpresa: form.comunaEmpresa || undefined,
          ciudadEmpresa: form.ciudadEmpresa || undefined,
          telefonoEmpresa: form.telefonoEmpresa || undefined,
          emailEmpresa: form.emailEmpresa || undefined,
          patenteVehiculo: form.patenteVehiculo,
          tipoVehiculo: form.tipoVehiculo,
          capacidadVehiculoKg: form.capacidadVehiculoKg ? Number(form.capacidadVehiculoKg) : undefined,
        }),
      });
      toast.success("Perfil actualizado");
      onUpdated();
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setSaving(false); }
  }

  // Estado de completitud
  const tieneEmpresa = !!(form.razonSocial && form.rutEmpresa);
  const tieneChofer = !!(form.rut && form.licenciaConducirUrl);
  const tieneVehiculo = !!(form.patenteVehiculo && form.capacidadVehiculoKg);

  return (
    <div className="space-y-4">
      {/* Banner informativo */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-3">
          <p className="text-xs text-amber-900 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Estás en <strong>Plan Gratis</strong>. Marketplace próximamente. Necesitás registrar tu empresa, un chofer (persona natural con licencia) y un vehículo para poder aceptar pedidos cuando el marketplace esté disponible.
              <br />
              <strong>El chofer no puede ser la empresa</strong> — debe ser una persona natural, aunque seas el representante legal.
            </span>
          </p>
        </CardContent>
      </Card>

      {/* === CHOFER (persona natural) === */}
      <Card className={tieneChofer ? "border-emerald-200" : "border-amber-200"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2"><User className="h-4 w-4 text-blue-600" /> Chofer (persona natural)</span>
            {tieneChofer ? (
              <Badge className="bg-emerald-100 text-emerald-800 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-0.5" /> Completo</Badge>
            ) : (
              <Badge variant="outline" className="text-amber-700 text-[10px]">Falta</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Datos de la persona que va a manejar el camión y hacer las entregas. Si sos el representante legal de la empresa y vas a manejar vos mismo, igual tenés que cargar tus datos personales acá.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Nombre completo *</Label>
              <Input value={form.nombre} onChange={(e) => update("nombre", e.target.value)} placeholder="Juan Pérez" />
            </div>
            <div>
              <Label>RUT personal *</Label>
              <Input value={form.rut} onChange={(e) => update("rut", e.target.value)} placeholder="12.345.678-9" />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => update("telefono", e.target.value)} placeholder="+56 9 1234 5678" />
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <Label>Licencia de conducir (URL)</Label>
              <Input
                value={form.licenciaConducirUrl}
                onChange={(e) => update("licenciaConducirUrl", e.target.value)}
                placeholder="https://... (subí tu licencia y pegá el link)"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Foto/scan del carné de licencia de conducir clase A1/A2/A3/A4/A5.
              </p>
            </div>
            <div>
              <Label>Permiso de circulación (URL)</Label>
              <Input
                value={form.permisoCircUrl}
                onChange={(e) => update("permisoCircUrl", e.target.value)}
                placeholder="https://... (permiso del vehículo, si lo tenés a tu nombre)"
              />
            </div>
            <div>
              <Label>Seguro (URL)</Label>
              <Input
                value={form.seguroUrl}
                onChange={(e) => update("seguroUrl", e.target.value)}
                placeholder="https://... (póliza de seguro del vehículo)"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === EMPRESA === */}
      <Card className={tieneEmpresa ? "border-emerald-200" : "border-amber-200"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Empresa</span>
            {tieneEmpresa ? (
              <Badge className="bg-emerald-100 text-emerald-800 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-0.5" /> Completo</Badge>
            ) : (
              <Badge variant="outline" className="text-amber-700 text-[10px]">Falta</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Datos legales de tu empresa (persona jurídica) para identificación ante la plataforma.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Razón social *</Label>
              <Input value={form.razonSocial} onChange={(e) => update("razonSocial", e.target.value)} placeholder="Agua San Pedro Ltda." />
            </div>
            <div>
              <Label>RUT empresa *</Label>
              <Input value={form.rutEmpresa} onChange={(e) => update("rutEmpresa", e.target.value)} placeholder="76.123.456-7" />
            </div>
            <div>
              <Label>Giro</Label>
              <Input value={form.giro} onChange={(e) => update("giro", e.target.value)} placeholder="Distribución de agua potable" />
            </div>
            <div>
              <Label>Dirección fiscal</Label>
              <Input value={form.direccionEmpresa} onChange={(e) => update("direccionEmpresa", e.target.value)} placeholder="Av. Las Condes 123" />
            </div>
            <div>
              <Label>Comuna</Label>
              <Input value={form.comunaEmpresa} onChange={(e) => update("comunaEmpresa", e.target.value)} placeholder="Las Condes" />
            </div>
            <div>
              <Label>Ciudad</Label>
              <Input value={form.ciudadEmpresa} onChange={(e) => update("ciudadEmpresa", e.target.value)} placeholder="Santiago" />
            </div>
            <div>
              <Label>Teléfono empresa</Label>
              <Input value={form.telefonoEmpresa} onChange={(e) => update("telefonoEmpresa", e.target.value)} placeholder="+56 2 2345 6789" />
            </div>
            <div>
              <Label>Email empresa</Label>
              <Input value={form.emailEmpresa} onChange={(e) => update("emailEmpresa", e.target.value)} placeholder="contacto@empresa.cl" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === VEHÍCULO === */}
      <Card className={tieneVehiculo ? "border-emerald-200" : "border-amber-200"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Vehículo</span>
            {tieneVehiculo ? (
              <Badge className="bg-emerald-100 text-emerald-800 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-0.5" /> Completo</Badge>
            ) : (
              <Badge variant="outline" className="text-amber-700 text-[10px]">Falta</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Datos del camión aljibe que vas a usar para las entregas.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Patente *</Label>
              <Input value={form.patenteVehiculo} onChange={(e) => update("patenteVehiculo", e.target.value)} placeholder="AB-CD-12" />
            </div>
            <div>
              <Label>Tipo de vehículo</Label>
              <select
                value={form.tipoVehiculo}
                onChange={(e) => update("tipoVehiculo", e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="aljibe">Camión aljibe</option>
                <option value="camioneta">Camioneta</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <Label>Capacidad (litros) *</Label>
              <Input type="number" value={form.capacidadVehiculoKg} onChange={(e) => update("capacidadVehiculoKg", e.target.value)} placeholder="5000" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={guardar} disabled={saving} className="w-full h-12">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Guardar registro
      </Button>

      {/* Nota: lo que NO está acá */}
      <Card className="border-dashed border-gray-300 bg-gray-50/50">
        <CardContent className="p-3">
          <p className="text-[11px] text-muted-foreground flex items-start gap-2">
            <CreditCard className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>Plan Gratis no incluye:</strong> gestión de camiones, clientes propios, gastos, liquidación, pedidos recurrentes, historial de vueltas y equipo. Para eso, subí a <strong>Premium</strong> o <strong>Pro</strong>. MercadoPago Split* estará disponible en los 3 planes junto con el marketplace.
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
