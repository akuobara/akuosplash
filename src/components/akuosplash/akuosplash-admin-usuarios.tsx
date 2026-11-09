"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LogOut, Loader2, Check, X, MapPin, Mail, Phone, Truck, Search } from "lucide-react";
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
  documentosAprobacionJson?: string | null;
}

export function AkuosplashAdminUsuarios({ rol, titulo }: { rol: "transportista" | "cliente"; titulo: string }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(undefined);
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [docViewer, setDocViewer] = useState<{ url: string; label: string; usuario: Usuario; docKey?: string } | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState("");

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
      await akuoApi(`/api/akuosplash/superadmin/usuarios/${u.id}`, {
        method: "PATCH", body: JSON.stringify({ aprobado: val }),
      });
      toast.success(val ? "Repartidor aprobado" : "Aprobación revocada");
      setRefreshKey(k => k + 1);
    } catch (e: any) { toast.error(e.message || "Error"); }
  }

  // Cambiar estado de aprobación granular (pendiente | pre_aprobado | aprobado | rechazado)
  async function setEstadoAprobacion(u: Usuario, nuevoEstado: string, nota?: string) {
    try {
      await akuoApi(`/api/akuosplash/superadmin/usuarios/${u.id}`, {
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

  // Guardar aprobación de un documento específico
  async function setDocumentoAprobacion(usuario: Usuario, tipoDocumento: string, estado: string, nota?: string) {
    try {
      await akuoApi(`/api/akuosplash/superadmin/usuarios/${usuario.id}/documento`, {
        method: "PATCH",
        body: JSON.stringify({ tipoDocumento, estado, nota }),
      });
      toast.success(`Documento ${estado}`);
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      toast.error(e?.message || "Error");
    }
  }

  async function toggleActivo(u: Usuario, val: boolean) {
    try {
      await akuoApi(`/api/akuosplash/superadmin/usuarios/${u.id}`, {
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

  // Filtrar usuarios por estado y búsqueda
  const filtered = usuarios.filter(u => {
    if (filterEstado !== "todos") {
      const est = u.estadoAprobacion || "pendiente";
      if (est !== filterEstado) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      if (!(u.nombre?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.telefono?.toLowerCase().includes(q) || u.razonSocial?.toLowerCase().includes(q) || u.patenteVehiculo?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

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

        {/* Filtros: búsqueda + estado */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, email, teléfono..."
              className="pl-8 h-9 text-sm"
            />
          </div>
          {rol === "transportista" && (
            <div className="flex gap-1.5 flex-wrap">
              {["todos", "pendiente", "pre_aprobado", "aprobado", "rechazado"].map(est => (
                <button
                  key={est}
                  onClick={() => setFilterEstado(est)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                    filterEstado === est
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {est === "todos" ? "Todos" : est === "pre_aprobado" ? "Pre-aprobados" : est.charAt(0).toUpperCase() + est.slice(1) + "s"}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center">
            <p className="text-sm text-gray-400">No hay resultados{filterEstado !== "todos" ? ` con estado "${filterEstado}"` : ""}.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.length < usuarios.length && (
              <p className="text-[11px] text-gray-400 text-center">Mostrando {filtered.length} de {usuarios.length}</p>
            )}
            {filtered.map(u => {
            const isExpanded = expandedIds.has(u.id);
            const toggleExpand = () => {
              setExpandedIds(prev => {
                const next = new Set(prev);
                if (next.has(u.id)) next.delete(u.id);
                else next.add(u.id);
                return next;
              });
            };
            return (
              <Card key={u.id} className="border-gray-100">
                <CardContent className="p-3.5">
                  {/* Header siempre visible — click para expandir/colapsar */}
                  <button
                    onClick={toggleExpand}
                    className="w-full flex items-center justify-between gap-2 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{u.nombre}</p>
                        {rol === "transportista" && (
                          <Badge variant="outline" className={`text-[9px] shrink-0 ${
                            u.estadoAprobacion === "aprobado" ? "text-emerald-700 border-emerald-300 bg-emerald-50" :
                            u.estadoAprobacion === "pre_aprobado" ? "text-blue-700 border-blue-300 bg-blue-50" :
                            u.estadoAprobacion === "rechazado" ? "text-red-700 border-red-300 bg-red-50" :
                            "text-amber-700 border-amber-300 bg-amber-50"
                          }`}>
                            {u.estadoAprobacion === "aprobado" ? "✓ Aprobado" :
                             u.estadoAprobacion === "pre_aprobado" ? "🔍 Pre-aprob." :
                             u.estadoAprobacion === "rechazado" ? "✗ Rechazado" :
                             "⏳ Pendiente"}
                          </Badge>
                        )}
                        {u.banned && <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 text-[9px]">Bloqueado</Badge>}
                        {!u.activo && <Badge variant="outline" className="text-gray-500 text-[9px]">Inactivo</Badge>}
                        {u.mpUserId && <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[9px]">MP</Badge>}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{u.email}</p>
                    </div>
                    <span className="text-gray-400 text-xs shrink-0">{isExpanded ? "▲" : "▼"}</span>
                  </button>

                  {/* Contenido colapsable */}
                  {isExpanded && (
                    <div className="space-y-2 pt-2 mt-2 border-t border-gray-100">
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
                          {u.estadoAprobacion === "aprobado" ? "✓ Aprobado" :
                           u.estadoAprobacion === "pre_aprobado" ? "🔍 Pre-aprobado" :
                           u.estadoAprobacion === "rechazado" ? "✗ Rechazado" :
                           "⏳ Pendiente"}
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

                      {/* Sección: Documentos para revisión — con estado individual por documento */}
                      <div className="pt-1 border-t border-gray-100">
                        <p className="text-[10px] text-gray-500 font-medium mb-1.5">📄 Documentos para revisión:</p>
                        {(() => {
                          let docsAprob: Record<string, { estado: string; nota?: string }> = {};
                          try { docsAprob = u.documentosAprobacionJson ? JSON.parse(u.documentosAprobacionJson) : {}; } catch {}
                          const docs = [
                            { key: "licenciaConducirUrl", label: "Licencia frente", url: u.licenciaConducirUrl },
                            { key: "licenciaConducirAtrasUrl", label: "Licencia atrás", url: u.licenciaConducirAtrasUrl },
                            { key: "permisoCircUrl", label: "Permiso circ.", url: u.permisoCircUrl },
                            { key: "seguroUrl", label: "Seguro", url: u.seguroUrl },
                            { key: "revisonTecnicaUrl", label: "Revisión técnica", url: u.revisonTecnicaUrl },
                            { key: "fotoVehiculoFrenteUrl", label: "Vehículo frente", url: u.fotoVehiculoFrenteUrl },
                            { key: "fotoVehiculoAtrasUrl", label: "Vehículo atrás", url: u.fotoVehiculoAtrasUrl },
                            { key: "fotoVehiculoIzquierdaUrl", label: "Vehículo izq.", url: u.fotoVehiculoIzquierdaUrl },
                            { key: "fotoVehiculoDerechaUrl", label: "Vehículo der.", url: u.fotoVehiculoDerechaUrl },
                          ].filter((d) => d.url);

                          if (docs.length === 0) {
                            return <p className="text-[10px] text-gray-400">Sin documentos cargados</p>;
                          }

                          return (
                            <div className="space-y-1">
                              {docs.map((d) => {
                                const ap = docsAprob[d.key];
                                const est = ap?.estado;
                                return (
                                  <div key={d.key} className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => setDocViewer({ url: d.url!, label: d.label, usuario: u, docKey: d.key })}
                                      className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition cursor-pointer flex-1 min-w-0"
                                    >
                                      <span className="truncate flex-1 text-left">{d.label}</span>
                                    </button>
                                    <span className="text-[10px] shrink-0 w-16 text-center">
                                      {est === "aprobado" ? (
                                        <span className="text-emerald-700 font-medium">✓ Aprob.</span>
                                      ) : est === "rechazado" ? (
                                        <span className="text-red-700 font-medium" title={ap?.nota}>✗ Rechaz.</span>
                                      ) : (
                                        <span className="text-amber-600 font-medium">⏳ Pend.</span>
                                      )}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Sección: Revisión de cuenta */}
                      <div className="pt-1">
                        <p className="text-[10px] text-gray-500 font-medium mb-1">Revisión de cuenta:</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm" variant="outline"
                            onClick={() => setEstadoAprobacion(u, "pre_aprobado")}
                            disabled={u.estadoAprobacion === "pre_aprobado"}
                            className="text-blue-700 border-blue-300 hover:bg-blue-50 text-[11px] disabled:opacity-40"
                          >
                            🔍 Pre-aprobar
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => setEstadoAprobacion(u, "aprobado")}
                            disabled={u.estadoAprobacion === "aprobado"}
                            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-[11px] disabled:opacity-40"
                          >
                            ✓ Aprobar
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => {
                              const nota = prompt("Motivo del rechazo (opcional):");
                              if (nota === null) return;
                              setEstadoAprobacion(u, "rechazado", nota || undefined);
                            }}
                            disabled={u.estadoAprobacion === "rechazado"}
                            className="text-red-700 border-red-300 hover:bg-red-50 text-[11px] disabled:opacity-40"
                          >
                            ✗ Rechazar
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            onClick={() => setEstadoAprobacion(u, "pendiente")}
                            disabled={u.estadoAprobacion === "pendiente" || !u.estadoAprobacion}
                            className="text-amber-700 border-amber-300 hover:bg-amber-50 text-[11px] disabled:opacity-40"
                          >
                            ⏳ Pendiente
                          </Button>
                        </div>
                        <p className="text-[9px] text-gray-400 mt-1">
                          Pre-aprobar = documentos OK, falta verificación final · Aprobar = puede participar del marketplace · Rechazar = documentos rechazados
                        </p>
                      </div>

                      {/* Sección: Activación de cuenta (separada de la aprobación) */}
                      <div className="pt-1 border-t border-gray-100">
                        <p className="text-[10px] text-gray-500 font-medium mb-1">Cuenta:</p>
                        <Button
                          size="sm" variant="outline"
                          onClick={() => toggleActivo(u, !u.activo)}
                          className={u.activo
                            ? "text-red-600 border-red-300 hover:bg-red-50 w-full text-[11px]"
                            : "text-emerald-600 border-emerald-300 hover:bg-emerald-50 w-full text-[11px]"}
                        >
                          {u.activo ? "🚫 Desactivar cuenta (bloquear acceso)" : "✅ Activar cuenta (permitir acceso)"}
                        </Button>
                        <p className="text-[9px] text-gray-400 mt-1">
                          {u.activo
                            ? "Desactivar = el transportista no puede ingresar a la app (cuenta bloqueada)"
                            : "La cuenta está desactivada — el transportista no puede ingresar"}
                        </p>
                      </div>
                    </div>
                  )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          </div>
        )}

        <Button variant="outline" onClick={() => setRefreshKey(k => k + 1)} className="w-full">Actualizar</Button>
      </main>

      {/* Modal: Visor de documentos con botones aprobar/rechazar */}
      {docViewer && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4"
          onClick={() => setDocViewer(null)}
        >
          <div
            className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <p className="font-bold text-sm">{docViewer.label}</p>
                <p className="text-xs text-gray-500">{docViewer.usuario.nombre} · {docViewer.usuario.email}</p>
              </div>
              <button onClick={() => setDocViewer(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {/* Imagen del documento */}
            <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center min-h-[300px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={docViewer.url}
                alt={docViewer.label}
                className="max-w-full max-h-[60vh] object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).parentElement!.innerHTML =
                    '<div class="text-gray-500 text-sm">No se pudo cargar la imagen. <a href="' + docViewer.url + '" target="_blank" class="text-blue-600 underline">Abrir en pestaña nueva</a></div>';
                }}
              />
            </div>

            {/* Botones de acción */}
            <div className="border-t px-4 py-3 space-y-2">
              {/* Estado actual */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Estado actual:</span>
                <Badge variant="outline" className={`text-[10px] ${
                  docViewer.usuario.estadoAprobacion === "aprobado" ? "text-emerald-700 border-emerald-300 bg-emerald-50" :
                  docViewer.usuario.estadoAprobacion === "pre_aprobado" ? "text-blue-700 border-blue-300 bg-blue-50" :
                  docViewer.usuario.estadoAprobacion === "rechazado" ? "text-red-700 border-red-300 bg-red-50" :
                  "text-amber-700 border-amber-300 bg-amber-50"
                }`}>
                  {docViewer.usuario.estadoAprobacion === "aprobado" ? "✓ Aprobado" :
                   docViewer.usuario.estadoAprobacion === "pre_aprobado" ? "🔍 Pre-aprobado" :
                   docViewer.usuario.estadoAprobacion === "rechazado" ? "✗ Rechazado" :
                   "⏳ Pendiente"}
                </Badge>
              </div>

              {/* Botones — guardan el estado de ESTE documento específico */}
              {docViewer.docKey && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setDocumentoAprobacion(docViewer.usuario, docViewer.docKey!, "aprobado");
                      setDocViewer(null);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  >
                    ✓ Aprobar este documento
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const nota = prompt("Motivo del rechazo (opcional):");
                      if (nota === null) return;
                      setDocumentoAprobacion(docViewer.usuario, docViewer.docKey!, "rechazado", nota || undefined);
                      setDocViewer(null);
                    }}
                    className="text-red-700 border-red-300 hover:bg-red-50 text-xs"
                  >
                    ✗ Rechazar este documento
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDocumentoAprobacion(docViewer.usuario, docViewer.docKey!, "pendiente");
                      setDocViewer(null);
                    }}
                    className="text-amber-700 border-amber-300 hover:bg-amber-50 text-xs"
                  >
                    ⏳ Marcar pendiente
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
