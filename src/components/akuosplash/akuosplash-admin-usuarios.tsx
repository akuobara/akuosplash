"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LogOut, Loader2, Check, X, MapPin, Mail, Phone, Truck } from "lucide-react";
import { akuoGet, akuoApi, akuoPost, formatCLP } from "@/components/akuosplash/akuosplash-utils";
import { toast } from "sonner";

interface Usuario {
  id: string; email: string | null; nombre: string; telefono: string | null; rol: string;
  aprobado: boolean; activo: boolean; banned: boolean; plan: string;
  creadoEn: string; ultimoLoginEn: string | null;
  razonSocial?: string | null; patenteVehiculo?: string | null; tipoVehiculo?: string | null;
  areasCobertura?: string | null;
  mpUserId?: string | null; mpAccessToken?: string | null;
  zonaId?: string | null;
  zona?: { id: string; nombre: string; precioPorLitro: number } | null;
  // Estado de aprobación granular (4 valores)
  estadoAprobacion?: string | null;
  estadoAprobacionNota?: string | null;
  estadoAprobacionActualizadoEn?: string | null;
  // Campos de perfil (para validar completitud)
  rut?: string | null;
  rutEmpresa?: string | null;
  licenciaConducirUrl?: string | null;
  licenciaConducirAtrasUrl?: string | null;
  permisoCircUrl?: string | null;
  seguroUrl?: string | null;
  revisonTecnicaUrl?: string | null;
  capacidadVehiculoKg?: number | null;
  fotoVehiculoFrenteUrl?: string | null;
  fotoVehiculoAtrasUrl?: string | null;
  fotoVehiculoIzquierdaUrl?: string | null;
  fotoVehiculoDerechaUrl?: string | null;
}

export function AkuosplashAdminUsuarios({ rol, titulo }: { rol: "transportista" | "cliente"; titulo: string }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(undefined);
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    akuoGet<{ user: any }>("/api/akuosplash/auth/me").then(d => {
      if (!d.user) { router.push("/akuosplash"); return; }
      if (d.user.rol !== "superadmin") { router.push("/akuosplash/" + d.user.rol); return; }
      setUser(d.user);
    });
  }, [router]);

  const cargar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const d = await akuoGet<{ usuarios: Usuario[] }>(`/api/akuosplash/superadmin/usuarios?rol=${rol}`);
      setUsuarios(d.usuarios);
    } catch (e: any) { toast.error(e.message || "Error"); }
    finally { setLoading(false); }
  }, [user, rol, refreshKey]);

  useEffect(() => { if (user) cargar(); }, [user, rol, refreshKey]);

  async function aprobar(u: Usuario, val: boolean) {
    try {
      await akuoApi(`/api/akuosplash/superadmin/usuarios?id=${u.id}`, {
        method: "PATCH", body: JSON.stringify({ aprobado: val }),
      });
      toast.success(val ? "Repartidor aprobado" : "Aprobación revocada");
      setRefreshKey(k => k + 1);
    } catch (e: any) { toast.error(e.message || "Error"); }
  }

  // Cambiar estado de aprobación granular (pendiente | pre_aprobado | aprobado | rechazado)
  async function setEstadoAprobacion(u: Usuario, nuevoEstado: string, nota?: string) {
    try {
      await akuoApi(`/api/akuosplash/superadmin/usuarios?id=${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ estadoAprobacion: nuevoEstado, estadoAprobacionNota: nota || undefined }),
      });
      const labels: Record<string, string> = {
        pendiente: "marcado como Pendiente",
        pre_aprobado: "Pre-aprobado",
        aprobado: "Aprobado",
        rechazado: "Rechazado",
      };
      toast.success(`Usuario ${labels[nuevoEstado] || nuevoEstado}`);
      setRefreshKey(k => k + 1);
    } catch (e: any) { toast.error(e.message || "Error"); }
  }

  // Helper: verificar si el transportista tiene el perfil completo
  function perfilCompleto(u: Usuario): boolean {
    return !!(u.rut && u.rutEmpresa && u.razonSocial && u.licenciaConducirUrl && u.patenteVehiculo && u.capacidadVehiculoKg);
  }

  async function toggleActivo(u: Usuario, val: boolean) {
    try {
      await akuoApi(`/api/akuosplash/superadmin/usuarios?id=${u.id}`, {
        method: "PATCH", body: JSON.stringify({ activo: val }),
      });
      toast.success(val ? "Cuenta activada" : "Cuenta desactivada");
      setRefreshKey(k => k + 1);
    } catch (e: any) { toast.error(e.message || "Error"); }
  }

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <Link href="/akuosplash/superadmin" className="flex items-center gap-2 text-gray-600">
            <ArrowLeft className="h-4 w-4" /><span className="font-bold text-sm">Volver</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }}>
            <LogOut className="mr-1 h-4 w-4" /> Salir
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{titulo}</h1>
          <p className="text-sm text-gray-500">{usuarios.length} registrados</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : usuarios.length === 0 ? (
          <Card><CardContent className="p-8 text-center">
            <p className="text-sm text-gray-400">No hay {titulo.toLowerCase()} registrados todavía.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {usuarios.map(u => (
              <Card key={u.id} className="border-gray-100">
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{u.nombre}</p>
                        {rol === "transportista" && !u.aprobado && (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">Pendiente</Badge>
                        )}
                        {u.banned && <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 text-[10px]">Bloqueado</Badge>}
                        {!u.activo && <Badge variant="outline" className="text-gray-500 text-[10px]">Inactivo</Badge>}
                        {u.mpUserId && <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]">MP conectado</Badge>}
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3" /> {u.email}
                      </p>
                      {u.telefono && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {u.telefono}
                        </p>
                      )}
                      {rol === "transportista" && (
                        <>
                          {u.razonSocial && <p className="text-xs text-gray-500">Empresa: {u.razonSocial}</p>}
                          {u.patenteVehiculo && (
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              <Truck className="h-3 w-3" /> {u.patenteVehiculo} {u.tipoVehiculo && `· ${u.tipoVehiculo}`}
                            </p>
                          )}
                          {u.areasCobertura && <p className="text-xs text-gray-500">Cobertura: {u.areasCobertura}</p>}
                        </>
                      )}
                      {rol === "cliente" && u.zona && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Zona: {u.zona.nombre} · {formatCLP(u.zona.precioPorLitro)}/L
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        Registrado: {new Date(u.creadoEn).toLocaleDateString("es-CL")}
                        {u.ultimoLoginEn && ` · Último login: ${new Date(u.ultimoLoginEn).toLocaleDateString("es-CL")}`}
                      </p>
                    </div>
                  </div>

                  {rol === "transportista" && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      {/* Estado de aprobación actual + badges de perfil */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={`text-[10px] ${
                          u.estadoAprobacion === "aprobado" ? "text-emerald-700 border-emerald-300 bg-emerald-50" :
                          u.estadoAprobacion === "pre_aprobado" ? "text-blue-700 border-blue-300 bg-blue-50" :
                          u.estadoAprobacion === "rechazado" ? "text-red-700 border-red-300 bg-red-50" :
                          "text-amber-700 border-amber-300 bg-amber-50"
                        }`}>
                          {u.estadoAprobacion === "aprobado" ? "Aprobado" :
                           u.estadoAprobacion === "pre_aprobado" ? "Pre-aprobado" :
                           u.estadoAprobacion === "rechazado" ? "Rechazado" :
                           "Pendiente"}
                        </Badge>
                        {perfilCompleto(u) ? (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]">Perfil completo</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">Perfil incompleto</Badge>
                        )}
                        {u.mpUserId && <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]">MP conectado</Badge>}
                      </div>
                      {u.estadoAprobacionNota && (
                        <p className="text-[10px] text-gray-500 italic">Nota: {u.estadoAprobacionNota}</p>
                      )}
                      {/* Botones para cambiar estado de aprobación (4 estados) */}
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEstadoAprobacion(u, "pre_aprobado")} className="text-blue-700 border-blue-300 hover:bg-blue-50 text-[11px]">
                          Pre-aprobar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEstadoAprobacion(u, "aprobado")} className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-[11px]">
                          Aprobar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const nota = prompt("Motivo del rechazo (opcional):");
                          if (nota === null) return;
                          setEstadoAprobacion(u, "rechazado", nota || undefined);
                        }} className="text-red-700 border-red-300 hover:bg-red-50 text-[11px]">
                          Rechazar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEstadoAprobacion(u, "pendiente")} className="text-amber-700 border-amber-300 hover:bg-amber-50 text-[11px]">
                          Pendiente
                        </Button>
                      </div>
                      {/* Activar/Desactivar separado */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleActivo(u, !u.activo)}
                          className={u.activo ? "text-red-600 border-red-300 hover:bg-red-50 flex-1" : "text-emerald-600 border-emerald-300 hover:bg-emerald-50 flex-1"}
                        >
                          {u.activo ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Button variant="outline" onClick={() => setRefreshKey(k => k + 1)} className="w-full">Actualizar</Button>
      </main>
    </div>
  );
}
