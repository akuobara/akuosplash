"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Building2, Truck, FileText, Save, AlertCircle, CheckCircle2, CreditCard, Image as ImageIcon, ExternalLink, X } from "lucide-react";
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
    licenciaConducirAtrasUrl: "",
    permisoCircUrl: "",
    seguroUrl: "",
    revisonTecnicaUrl: "",
    // Datos de la empresa
    razonSocial: "", rutEmpresa: "", giro: "",
    direccionEmpresa: "", comunaEmpresa: "", ciudadEmpresa: "",
    telefonoEmpresa: "", emailEmpresa: "",
    // Datos del vehículo
    patenteVehiculo: "", tipoVehiculo: "aljibe", capacidadVehiculoKg: "",
    // Fotos del vehículo
    fotoVehiculoFrenteUrl: "",
    fotoVehiculoAtrasUrl: "",
    fotoVehiculoIzquierdaUrl: "",
    fotoVehiculoDerechaUrl: "",
  });

  useEffect(() => {
    akuoGet<{ user: any }>("/api/akuosplash/cliente/perfil").then(d => {
      if (!d.user) return;
      const u = d.user;
      setForm({
        nombre: u.nombre || "", telefono: u.telefono || "", rut: u.rut || "",
        licenciaConducirUrl: u.licenciaConducirUrl || "",
        licenciaConducirAtrasUrl: u.licenciaConducirAtrasUrl || "",
        permisoCircUrl: u.permisoCircUrl || "",
        seguroUrl: u.seguroUrl || "",
        revisonTecnicaUrl: u.revisonTecnicaUrl || "",
        razonSocial: u.razonSocial || "", rutEmpresa: u.rutEmpresa || "", giro: u.giro || "",
        direccionEmpresa: u.direccionEmpresa || "", comunaEmpresa: u.comunaEmpresa || "",
        ciudadEmpresa: u.ciudadEmpresa || "", telefonoEmpresa: u.telefonoEmpresa || "",
        emailEmpresa: u.emailEmpresa || "",
        patenteVehiculo: u.patenteVehiculo || "", tipoVehiculo: u.tipoVehiculo || "aljibe",
        capacidadVehiculoKg: u.capacidadVehiculoKg ? String(u.capacidadVehiculoKg) : "",
        fotoVehiculoFrenteUrl: u.fotoVehiculoFrenteUrl || "",
        fotoVehiculoAtrasUrl: u.fotoVehiculoAtrasUrl || "",
        fotoVehiculoIzquierdaUrl: u.fotoVehiculoIzquierdaUrl || "",
        fotoVehiculoDerechaUrl: u.fotoVehiculoDerechaUrl || "",
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
          licenciaConducirAtrasUrl: form.licenciaConducirAtrasUrl || undefined,
          permisoCircUrl: form.permisoCircUrl || undefined,
          seguroUrl: form.seguroUrl || undefined,
          revisonTecnicaUrl: form.revisonTecnicaUrl || undefined,
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
          fotoVehiculoFrenteUrl: form.fotoVehiculoFrenteUrl || undefined,
          fotoVehiculoAtrasUrl: form.fotoVehiculoAtrasUrl || undefined,
          fotoVehiculoIzquierdaUrl: form.fotoVehiculoIzquierdaUrl || undefined,
          fotoVehiculoDerechaUrl: form.fotoVehiculoDerechaUrl || undefined,
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
          <div className="space-y-3">
            <PhotoUploadField label="Licencia de conducir (frente)" value={form.licenciaConducirUrl} onChange={(v) => update("licenciaConducirUrl", v)} uploadTipo="licencia_de_conducir" helpText="Carné de licencia clase A1/A2/A3/A4/A5 — foto frontal." />
            <PhotoUploadField label="Licencia de conducir (atrás)" value={form.licenciaConducirAtrasUrl} onChange={(v) => update("licenciaConducirAtrasUrl", v)} uploadTipo="licencia_de_conducir_atras" helpText="Reverso del carné de licencia." />
            <PhotoUploadField label="Permiso de circulación" value={form.permisoCircUrl} onChange={(v) => update("permisoCircUrl", v)} uploadTipo="permiso_de_circulacion" helpText="Permiso del vehículo, si lo tenés a tu nombre." />
            <PhotoUploadField label="Seguro del vehículo" value={form.seguroUrl} onChange={(v) => update("seguroUrl", v)} uploadTipo="seguro_del_vehiculo" helpText="Póliza de seguro del vehículo." />
            <PhotoUploadField label="Revisión técnica" value={form.revisonTecnicaUrl} onChange={(v) => update("revisonTecnicaUrl", v)} uploadTipo="revision_tecnica" helpText="Documento de revisión técnica vigente." />
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
          {/* Fotos del vehículo (4 ángulos) */}
          <div className="grid gap-3 sm:grid-cols-2 mt-3">
            <PhotoUploadField label="Foto del vehículo (frente)" value={form.fotoVehiculoFrenteUrl} onChange={(v) => update("fotoVehiculoFrenteUrl", v)} uploadTipo="foto_frente" helpText="Frente del camión — la patente debe verse claramente." />
            <PhotoUploadField label="Foto del vehículo (atrás)" value={form.fotoVehiculoAtrasUrl} onChange={(v) => update("fotoVehiculoAtrasUrl", v)} uploadTipo="foto_atras" helpText="Parte trasera del camión." />
            <PhotoUploadField label="Foto del vehículo (lado izquierdo)" value={form.fotoVehiculoIzquierdaUrl} onChange={(v) => update("fotoVehiculoIzquierdaUrl", v)} uploadTipo="foto_lado_izquierdo" helpText="Lado izquierdo del camión." />
            <PhotoUploadField label="Foto del vehículo (lado derecho)" value={form.fotoVehiculoDerechaUrl} onChange={(v) => update("fotoVehiculoDerechaUrl", v)} uploadTipo="foto_lado_derecho" helpText="Lado derecho del camión." />
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

// Componente para mostrar/cargar un documento o foto
// - Si hay URL guardada: muestra preview de imagen + link para ver original
// - Permite pegar URL nueva o SUBIR archivo directamente (vía /api/akuosplash/upload)
function PhotoUploadField({ label, value, onChange, helpText, uploadTipo }: { label: string; value: string; onChange: (v: string) => void; helpText?: string; uploadTipo?: string }) {
  const hasValue = value && value.trim().length > 0;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      // Validar tamaño (máx 5MB para base64 — la DB no debería tener archivos muy grandes)
      if (file.size > 5 * 1024 * 1024) {
        setError("El archivo supera 5MB. Subí una imagen más chica.");
        setUploading(false);
        e.target.value = "";
        return;
      }
      // Subir como base64 data URL (no requiere endpoint — la URL se guarda directo en la DB)
      const reader = new FileReader();
      reader.onload = () => {
        onChange(reader.result as string);
        setUploading(false);
      };
      reader.onerror = () => {
        setError("No se pudo leer el archivo");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err?.message || "Error al subir");
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {hasValue ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 overflow-hidden">
          <a href={value} target="_blank" rel="noopener noreferrer" className="block">
            <img src={value} alt={label} className="w-full max-h-48 object-contain bg-white" />
          </a>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-emerald-50/50">
            <a href={value} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-emerald-700 hover:underline min-w-0">
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">Ver original</span>
            </a>
            <button
              type="button"
              onClick={() => onChange("")}
              className="flex items-center gap-1 text-[11px] text-red-600 hover:underline"
            >
              <X className="h-3 w-3" /> Quitar
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-3 text-center">
          {uploading ? (
            <div className="flex flex-col items-center gap-1 py-2">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <p className="text-[11px] text-blue-600">Subiendo...</p>
            </div>
          ) : (
            <>
              <ImageIcon className="h-6 w-6 text-gray-400 mx-auto mb-1" />
              <p className="text-[11px] text-muted-foreground mb-2">Sin documento cargado</p>
              <label className="inline-flex items-center gap-1 cursor-pointer text-[11px] bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md">
                <ImageIcon className="h-3 w-3" /> Subir archivo
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFile} className="hidden" />
              </label>
            </>
          )}
        </div>
      )}
      {error && <p className="text-[10px] text-red-600">{error}</p>}
      {/* Input URL para pegar link manual si quiere */}
      <Input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="o pegá una URL https://..."
        className="text-xs"
      />
      {helpText && <p className="text-[10px] text-muted-foreground">{helpText}</p>}
    </div>
  );
}
