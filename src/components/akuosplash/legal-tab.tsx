"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, FileText, Shield, Building2 } from "lucide-react";
import { toast } from "sonner";
import { akuoGet, akuoPut } from "@/components/akuosplash/akuosplash-utils";

interface EmpresaData {
  razonSocial: string;
  rut: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  email: string;
  telefono: string;
  giro: string;
}

interface LegalPage {
  version: string;
  lastUpdated: string | null;
  content: string;
}

export function LegalTab() {
  const [activeTab, setActiveTab] = useState<"terminos" | "privacidad" | "empresa">("terminos");
  const [terminos, setTerminos] = useState<LegalPage>({ version: "1.0", lastUpdated: null, content: "" });
  const [privacidad, setPrivacidad] = useState<LegalPage>({ version: "1.0", lastUpdated: null, content: "" });
  const [empresa, setEmpresa] = useState<EmpresaData>({
    razonSocial: "Akuologistic SpA",
    rut: "",
    direccion: "",
    comuna: "",
    ciudad: "Santiago",
    email: "contacto@akuosplash.cl",
    telefono: "",
    giro: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const d = await akuoGet<{ terminos: LegalPage; privacidad: LegalPage; empresa: EmpresaData }>(
        "/api/akuosplash/legal"
      );
      setTerminos(d.terminos || { version: "1.0", lastUpdated: null, content: "" });
      setPrivacidad(d.privacidad || { version: "1.0", lastUpdated: null, content: "" });
      setEmpresa(d.empresa || {
        razonSocial: "Akuologistic SpA", rut: "", direccion: "", comuna: "",
        ciudad: "Santiago", email: "contacto@akuosplash.cl", telefono: "", giro: "",
      });
    } catch (e: any) {
      toast.error("No se pudo cargar: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardar() {
    setSaving(true);
    try {
      const body: any = {};
      if (activeTab === "terminos") body.terminos = terminos;
      else if (activeTab === "privacidad") body.privacidad = privacidad;
      else if (activeTab === "empresa") body.empresa = empresa;
      await akuoPut("/api/akuosplash/admin/legal", body);
      toast.success("Contenido guardado");
      cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Páginas Legales</h3>
      <p className="text-xs text-muted-foreground">
        Editá el contenido de los Términos y Condiciones, Política de Privacidad y datos de la empresa.
        Los cambios se publican automáticamente en las páginas públicas.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <TabButton active={activeTab === "terminos"} onClick={() => setActiveTab("terminos")} icon={<FileText className="h-3.5 w-3.5" />} label="Términos" />
        <TabButton active={activeTab === "privacidad"} onClick={() => setActiveTab("privacidad")} icon={<Shield className="h-3.5 w-3.5" />} label="Privacidad" />
        <TabButton active={activeTab === "empresa"} onClick={() => setActiveTab("empresa")} icon={<Building2 className="h-3.5 w-3.5" />} label="Empresa" />
      </div>

      {/* Términos y Condiciones */}
      {activeTab === "terminos" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">Términos y Condiciones</p>
              {terminos.lastUpdated && (
                <Badge variant="outline" className="text-[10px]">
                  v{terminos.version} · {new Date(terminos.lastUpdated).toLocaleDateString("es-CL")}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Se publica en <code className="bg-gray-100 px-1 rounded">/akuosplash/terminos</code>. Usá HTML para formato.
            </p>
            <div>
              <Label className="text-xs">Versión</Label>
              <Input value={terminos.version} onChange={(e) => setTerminos({ ...terminos, version: e.target.value })} className="h-8 w-32" />
            </div>
            <div>
              <Label className="text-xs">Contenido (HTML)</Label>
              <textarea
                value={terminos.content}
                onChange={(e) => setTerminos({ ...terminos, content: e.target.value })}
                placeholder="<h1>Términos y Condiciones</h1>&#10;<p>...</p>"
                className="w-full min-h-[400px] rounded-md border border-gray-300 p-2 text-sm font-mono"
              />
            </div>
            <Button onClick={guardar} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Guardar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Política de Privacidad */}
      {activeTab === "privacidad" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">Política de Privacidad</p>
              {privacidad.lastUpdated && (
                <Badge variant="outline" className="text-[10px]">
                  v{privacidad.version} · {new Date(privacidad.lastUpdated).toLocaleDateString("es-CL")}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Se publica en <code className="bg-gray-100 px-1 rounded">/akuosplash/privacidad</code>. Usá HTML para formato.
            </p>
            <div>
              <Label className="text-xs">Versión</Label>
              <Input value={privacidad.version} onChange={(e) => setPrivacidad({ ...privacidad, version: e.target.value })} className="h-8 w-32" />
            </div>
            <div>
              <Label className="text-xs">Contenido (HTML)</Label>
              <textarea
                value={privacidad.content}
                onChange={(e) => setPrivacidad({ ...privacidad, content: e.target.value })}
                placeholder="<h1>Política de Privacidad</h1>&#10;<p>...</p>"
                className="w-full min-h-[400px] rounded-md border border-gray-300 p-2 text-sm font-mono"
              />
            </div>
            <Button onClick={guardar} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Guardar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Datos de la Empresa */}
      {activeTab === "empresa" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="font-medium">Datos de la Empresa</p>
            <p className="text-xs text-muted-foreground">
              Se muestra en <code className="bg-gray-100 px-1 rounded">/akuosplash/empresa</code> y en el footer de las páginas legales.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Razón social</Label>
                <Input value={empresa.razonSocial} onChange={(e) => setEmpresa({ ...empresa, razonSocial: e.target.value })} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">RUT</Label>
                <Input value={empresa.rut} onChange={(e) => setEmpresa({ ...empresa, rut: e.target.value })} placeholder="76.xxx.xxx-x" className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Dirección</Label>
                <Input value={empresa.direccion} onChange={(e) => setEmpresa({ ...empresa, direccion: e.target.value })} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Comuna</Label>
                <Input value={empresa.comuna} onChange={(e) => setEmpresa({ ...empresa, comuna: e.target.value })} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Ciudad</Label>
                <Input value={empresa.ciudad} onChange={(e) => setEmpresa({ ...empresa, ciudad: e.target.value })} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={empresa.email} onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Teléfono</Label>
                <Input value={empresa.telefono} onChange={(e) => setEmpresa({ ...empresa, telefono: e.target.value })} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Giro</Label>
                <Input value={empresa.giro} onChange={(e) => setEmpresa({ ...empresa, giro: e.target.value })} className="h-8" />
              </div>
            </div>
            <Button onClick={guardar} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Guardar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-2 text-sm border-b-2 transition ${
        active ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
