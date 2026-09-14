"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Truck,
  Droplets,
  Calendar,
  FileText,
  Shield,
  Wrench,
  AlertTriangle,
  User as UserIcon,
  Users,
  Plus,
  Check,
  ExternalLink,
  Loader2,
  Gauge,
  Banknote,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  uploadFile,
} from "@/lib/api-client";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/helpers";

// ===== Constantes para dropdowns =====

const CARROCERIAS = [
  { value: "cisterna_agua", label: "Cisterna de agua" },
  { value: "flete", label: "Flete" },
  { value: "hormigon", label: "Hormigón" },
  { value: "otro", label: "Otro" },
];

const TIPOS_CISTERNA = [
  { value: "agua", label: "Agua" },
  { value: "combustible", label: "Combustible" },
  { value: "quimico", label: "Químico" },
  { value: "otro", label: "Otro" },
];

const MATERIALES = [
  { value: "acero_inoxidable", label: "Acero inoxidable" },
  { value: "fibrocemento", label: "Fibrocemento" },
  { value: "polietileno", label: "Polietileno" },
  { value: "aluminio", label: "Aluminio" },
  { value: "acero", label: "Acero" },
];

const TIPOS_AGUA = [
  { value: "riego", label: "Agua de riego" },
  { value: "aljibe", label: "Agua aljibe" },
  { value: "consumo_humano", label: "Agua de consumo humano" },
];

type CategoriaBitacora = "Mantenimiento" | "Falla" | "Observación" | "Otro";

const TIPOS_BITACORA: {
  value: string;
  label: string;
  categoria: CategoriaBitacora;
}[] = [
  { value: "cambio_aceite", label: "Cambio de aceite", categoria: "Mantenimiento" },
  { value: "cambio_filtros", label: "Cambio de filtros", categoria: "Mantenimiento" },
  { value: "cambio_plumillas", label: "Cambio de plumillas", categoria: "Mantenimiento" },
  { value: "frenos", label: "Frenos", categoria: "Mantenimiento" },
  { value: "neumaticos", label: "Neumáticos", categoria: "Mantenimiento" },
  { value: "revision_tecnica", label: "Revisión técnica", categoria: "Mantenimiento" },
  { value: "falla_motor", label: "Falla de motor", categoria: "Falla" },
  { value: "falla_frenos", label: "Falla de frenos", categoria: "Falla" },
  { value: "falla_electrica", label: "Falla eléctrica", categoria: "Falla" },
  { value: "falla_hidraulica", label: "Falla hidráulica", categoria: "Falla" },
  { value: "fuga", label: "Fuga", categoria: "Falla" },
  { value: "observacion", label: "Observación", categoria: "Observación" },
  { value: "otro", label: "Otro", categoria: "Otro" },
];

function labelTipoBitacora(value: string): string {
  return TIPOS_BITACORA.find((t) => t.value === value)?.label ?? value;
}

function categoriaTipo(value: string): CategoriaBitacora {
  return TIPOS_BITACORA.find((t) => t.value === value)?.categoria ?? "Otro";
}

function labelCarroceria(value?: string | null): string {
  if (!value) return "—";
  return CARROCERIAS.find((c) => c.value === value)?.label ?? value;
}
function labelTipoCisterna(value?: string | null): string {
  if (!value) return "—";
  return TIPOS_CISTERNA.find((c) => c.value === value)?.label ?? value;
}
function labelMaterial(value?: string | null): string {
  if (!value) return "—";
  return MATERIALES.find((c) => c.value === value)?.label ?? value;
}
function labelTipoAgua(value?: string | null): string {
  if (!value) return "—";
  return TIPOS_AGUA.find((c) => c.value === value)?.label ?? value;
}

// ===== Tipos =====

interface ChoferAsignado {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  role: string;
  activo: boolean;
  asignadoEn?: string;
}

interface Camion {
  id: string;
  nombre: string;
  patente: string | null;
  capacidad: number;
  activo: boolean;
  creadoEn: string;
  marca?: string | null;
  modelo?: string | null;
  anio?: number | null;
  color?: string | null;
  numeroMotor?: string | null;
  numeroChasis?: string | null;
  permisoCirculacionVencimiento?: string | null;
  permisoCirculacionFotoUrl?: string | null;
  revisionTecnicaVencimiento?: string | null;
  revisionTecnicaFotoUrl?: string | null;
  seguroVencimiento?: string | null;
  seguroFotoUrl?: string | null;
  seguroCompania?: string | null;
  seguroNumero?: string | null;
  carroceria?: string | null;
  tipoCisterna?: string | null;
  materialEstanque?: string | null;
  tipoAgua?: string | null;
  resolucionSanitaria?: string | null;
  resolucionSanitariaVencimiento?: string | null;
  resolucionSanitariaFotoUrl?: string | null;
  choferes?: ChoferAsignado[];
  _count?: { vueltas: number };
}

interface BitacoraEntrada {
  id: string;
  camionId: string;
  autorId: string;
  autor?: { id: string; nombre: string; role: string } | null;
  tipo: string;
  descripcion: string;
  monto: number | null;
  fecha: string;
  kilometraje: number | null;
  severidad: string | null;
  resuelta: boolean;
  resueltaEn: string | null;
  resueltaPorId: string | null;
  resueltaPor?: { id: string; nombre: string } | null;
  creadoEn: string;
}

interface UsuarioLista {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  role: string;
  activo: boolean;
}

interface SessionUser {
  userId: string;
  email: string;
  nombre: string;
  role: "dueno" | "chofer" | "super_admin";
  duenoId: string | null;
  isDemo?: boolean;
}

// ===== Helpers de vencimientos =====

type EstadoVenc = "vigente" | "por_vencer" | "vencido" | "sin_fecha";

function estadoVencimiento(fecha?: string | null): {
  estado: EstadoVenc;
  dias: number | null;
} {
  if (!fecha) return { estado: "sin_fecha", dias: null };
  const venc = new Date(fecha);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diffMs = venc.getTime() - hoy.getTime();
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (dias < 0) return { estado: "vencido", dias };
  if (dias <= 30) return { estado: "por_vencer", dias };
  return { estado: "vigente", dias };
}

function badgeVencimiento(fecha?: string | null) {
  const { estado, dias } = estadoVencimiento(fecha);
  if (estado === "sin_fecha") return null;
  if (estado === "vencido") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] text-red-700 border-red-300 dark:border-red-800 dark:text-red-300"
      >
        <AlertTriangle className="h-3 w-3" /> Vencido
      </Badge>
    );
  }
  if (estado === "por_vencer") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] text-amber-700 border-amber-300 dark:border-amber-700 dark:text-amber-300"
      >
        <AlertTriangle className="h-3 w-3" /> Vence en {dias}d
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-[10px] text-emerald-700 border-emerald-300 dark:border-emerald-700 dark:text-emerald-300"
    >
      <Check className="h-3 w-3" /> Vigente
    </Badge>
  );
}

// ===== Página =====

export default function CamionDetallePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [session, setSession] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [camion, setCamion] = useState<Camion | null>(null);
  const [bitacora, setBitacora] = useState<BitacoraEntrada[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioLista[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<string>("info");

  // Cargar sesión
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<{ user: SessionUser | null }>("/api/auth/me");
        setSession(data.user);
      } catch {
        setSession(null);
      } finally {
        setSessionLoading(false);
      }
    })();
  }, []);

  const cargarCamion = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ camion: Camion }>(`/api/camiones/${id}`);
      setCamion(data.camion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el camión");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const cargarBitacora = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiGet<{ entradas: BitacoraEntrada[] }>(
        `/api/camiones/${id}/bitacora`
      );
      setBitacora(data.entradas);
    } catch (e) {
      console.error(e);
    }
  }, [id]);

  const cargarUsuarios = useCallback(async () => {
    if (!session || session.role !== "dueno") return;
    try {
      const data = await apiGet<{ usuarios: UsuarioLista[] }>("/api/usuarios");
      setUsuarios(data.usuarios);
    } catch (e) {
      console.error(e);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    cargarCamion();
    cargarBitacora();
    cargarUsuarios();
  }, [session, cargarCamion, cargarBitacora, cargarUsuarios]);

  const isDueno = session?.role === "dueno";

  // ===== Render =====

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <HeaderSkeleton />
        <main className="flex-1 container mx-auto max-w-5xl px-4 py-6">
          <Skeleton className="h-10 w-32 mb-4" />
          <Skeleton className="h-48 w-full mb-4" />
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <Truck className="h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-xl font-semibold mb-2">Sesión expirada</h1>
        <p className="text-sm text-muted-foreground mb-4 text-center">
          Inicia sesión para ver el detalle del camión.
        </p>
        <Button onClick={() => router.push("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al inicio
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <HeaderSkeleton />
        <main className="flex-1 container mx-auto max-w-5xl px-4 py-6">
          <Skeleton className="h-10 w-32 mb-4" />
          <Skeleton className="h-48 w-full mb-4" />
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (error || !camion) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h1 className="text-xl font-semibold mb-2">No se pudo cargar el camión</h1>
        <p className="text-sm text-muted-foreground mb-4 text-center">
          {error ?? "Camión no encontrado o no tienes acceso."}
        </p>
        <Button onClick={() => router.push("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
              className="px-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Volver</span>
            </Button>
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Truck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-semibold truncate">{camion.nombre}</h1>
                <p className="text-xs text-muted-foreground truncate">
                  {camion.patente ?? "Sin patente"} · {camion.capacidad.toLocaleString("es-CL")} L
                </p>
              </div>
            </div>
            {camion.activo ? (
              <Badge
                variant="outline"
                className="text-[10px] text-emerald-700 border-emerald-300 dark:border-emerald-700 dark:text-emerald-300"
              >
                Activo
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Inactivo
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-5xl px-4 py-6 space-y-4">
        {/* Resumen rápido */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-0.5">
                <p className="text-[10px] uppercase text-muted-foreground">Marca / Modelo</p>
                <p className="text-sm font-medium truncate">
                  {camion.marca ?? "—"} {camion.modelo ?? ""}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] uppercase text-muted-foreground">Año</p>
                <p className="text-sm font-medium">{camion.anio ?? "—"}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] uppercase text-muted-foreground">Color</p>
                <p className="text-sm font-medium">{camion.color ?? "—"}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] uppercase text-muted-foreground">Vueltas</p>
                <p className="text-sm font-medium">{camion._count?.vueltas ?? 0}</p>
              </div>
            </div>
            {/* Badges de documentos a punto de vencer */}
            {(() => {
              const docs: { label: string; fecha?: string | null }[] = [
                { label: "Perm. circ.", fecha: camion.permisoCirculacionVencimiento },
                { label: "Rev. técnica", fecha: camion.revisionTecnicaVencimiento },
                { label: "Seguro", fecha: camion.seguroVencimiento },
                { label: "Res. sanitaria", fecha: camion.resolucionSanitariaVencimiento },
              ];
              const alertas = docs.filter((d) => {
                const { estado } = estadoVencimiento(d.fecha);
                return estado === "vencido" || estado === "por_vencer";
              });
              if (alertas.length === 0) return null;
              return (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {alertas.map((d) => (
                    <span key={d.label} className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{d.label}:</span>
                      {badgeVencimiento(d.fecha)}
                    </span>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="info">
              <FileText className="h-4 w-4" /> Info
            </TabsTrigger>
            <TabsTrigger value="choferes">
              <Users className="h-4 w-4" /> Choferes
            </TabsTrigger>
            <TabsTrigger value="bitacora">
              <Wrench className="h-4 w-4" /> Bitácora
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4">
            <InfoTab camion={camion} isDueno={isDueno} onUpdate={cargarCamion} />
          </TabsContent>

          <TabsContent value="choferes" className="mt-4">
            <ChoferesTab
              camion={camion}
              isDueno={isDueno}
              usuarios={usuarios}
              onUpdate={cargarCamion}
            />
          </TabsContent>

          <TabsContent value="bitacora" className="mt-4">
            <BitacoraTab
              camionId={camion.id}
              entradas={bitacora}
              isDueno={isDueno}
              onRefresh={cargarBitacora}
            />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t border-border bg-background py-4">
        <div className="container mx-auto max-w-5xl px-4 text-center text-xs text-muted-foreground">
          Aljibe · Gestión de camiones aljibe
        </div>
      </footer>
    </div>
  );
}

// ===== Header Skeleton =====

function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95">
      <div className="container mx-auto max-w-5xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-20" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1 min-w-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-5 w-14" />
        </div>
      </div>
    </header>
  );
}

// ===== Tab 1: Info =====

interface InfoTabProps {
  camion: Camion;
  isDueno: boolean;
  onUpdate: () => void;
}

function InfoTab({ camion, isDueno, onUpdate }: InfoTabProps) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Datos del vehículo */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Datos del vehículo</CardTitle>
            </div>
            {isDueno && (
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <InfoField label="Nombre / alias" value={camion.nombre} />
            <InfoField label="Patente" value={camion.patente ?? "—"} />
            <InfoField
              label="Capacidad"
              value={`${camion.capacidad.toLocaleString("es-CL")} L`}
              icon={<Droplets className="h-3 w-3" />}
            />
            <InfoField label="Marca" value={camion.marca ?? "—"} />
            <InfoField label="Modelo" value={camion.modelo ?? "—"} />
            <InfoField label="Año" value={camion.anio ? String(camion.anio) : "—"} />
            <InfoField label="Color" value={camion.color ?? "—"} />
            <InfoField label="N° Motor" value={camion.numeroMotor ?? "—"} />
            <InfoField label="N° Chasis / VIN" value={camion.numeroChasis ?? "—"} />
          </div>
        </CardContent>
      </Card>

      {/* Configuración del camión */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Configuración del camión</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <InfoField label="Carrocería" value={labelCarroceria(camion.carroceria)} />
            <InfoField label="Tipo de cisterna" value={labelTipoCisterna(camion.tipoCisterna)} />
            <InfoField label="Material del estanque" value={labelMaterial(camion.materialEstanque)} />
            <InfoField label="Tipo de agua" value={labelTipoAgua(camion.tipoAgua)} />
          </div>

          {/* Resolución sanitaria — solo si tipoAgua = consumo_humano */}
          {camion.tipoAgua === "consumo_humano" && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-3 dark:border-amber-800 dark:bg-amber-900/20">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                <p className="text-xs font-medium uppercase text-amber-900 dark:text-amber-200">
                  Resolución sanitaria
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoField label="N° resolución" value={camion.resolucionSanitaria ?? "—"} />
                <div className="space-y-1">
                  <p className="text-[10px] uppercase text-muted-foreground">Vencimiento</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {camion.resolucionSanitariaVencimiento
                        ? formatDate(camion.resolucionSanitariaVencimiento)
                        : "—"}
                    </span>
                    {badgeVencimiento(camion.resolucionSanitariaVencimiento)}
                  </div>
                </div>
              </div>
              {camion.resolucionSanitariaFotoUrl && (
                <a
                  href={camion.resolucionSanitariaFotoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Ver documento
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Documentos del vehículo</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <DocumentoItem
            label="Permiso de circulación"
            fecha={camion.permisoCirculacionVencimiento}
            fotoUrl={camion.permisoCirculacionFotoUrl}
          />
          <DocumentoItem
            label="Revisión técnica"
            fecha={camion.revisionTecnicaVencimiento}
            fotoUrl={camion.revisionTecnicaFotoUrl}
          />
          <DocumentoItem
            label="Seguro"
            fecha={camion.seguroVencimiento}
            fotoUrl={camion.seguroFotoUrl}
            extra={
              <>
                {camion.seguroCompania && (
                  <span className="text-xs text-muted-foreground">
                    Compañía: <strong>{camion.seguroCompania}</strong>
                  </span>
                )}
                {camion.seguroNumero && (
                  <span className="text-xs text-muted-foreground">
                    Póliza: <strong>{camion.seguroNumero}</strong>
                  </span>
                )}
              </>
            }
          />
        </CardContent>
      </Card>

      {/* Diálogo de edición (solo admin) */}
      {isDueno && (
        <EditCamionDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          camion={camion}
          onSaved={() => {
            setEditOpen(false);
            onUpdate();
            toast.success("Camión actualizado");
          }}
        />
      )}
    </div>
  );
}

function InfoField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5 min-w-0">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-medium truncate flex items-center gap-1">
        {icon}
        {value}
      </p>
    </div>
  );
}

function DocumentoItem({
  label,
  fecha,
  fotoUrl,
  extra,
}: {
  label: string;
  fecha?: string | null;
  fotoUrl?: string | null;
  extra?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Vence:{" "}
              <strong className="text-foreground">
                {fecha ? formatDate(fecha) : "Sin fecha"}
              </strong>
            </span>
            {badgeVencimiento(fecha)}
          </div>
        </div>
        {fotoUrl && (
          <a
            href={fotoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
          >
            <ExternalLink className="h-3 w-3" /> Ver foto
          </a>
        )}
      </div>
      {extra && (
        <div className="flex flex-wrap gap-3 pt-1 border-t border-border/60">{extra}</div>
      )}
    </div>
  );
}

// ===== Diálogo de edición (Info) =====

function EditCamionDialog({
  open,
  onOpenChange,
  camion,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  camion: Camion;
  onSaved: () => void;
}) {
  const [marca, setMarca] = useState(camion.marca ?? "");
  const [modelo, setModelo] = useState(camion.modelo ?? "");
  const [anio, setAnio] = useState(camion.anio ? String(camion.anio) : "");
  const [color, setColor] = useState(camion.color ?? "");
  const [numeroMotor, setNumeroMotor] = useState(camion.numeroMotor ?? "");
  const [numeroChasis, setNumeroChasis] = useState(camion.numeroChasis ?? "");
  const [capacidad, setCapacidad] = useState(String(camion.capacidad));
  const [carroceria, setCarroceria] = useState(camion.carroceria ?? "");
  const [tipoCisterna, setTipoCisterna] = useState(camion.tipoCisterna ?? "");
  const [materialEstanque, setMaterialEstanque] = useState(camion.materialEstanque ?? "");
  const [tipoAgua, setTipoAgua] = useState(camion.tipoAgua ?? "");
  const [resolucionSanitaria, setResolucionSanitaria] = useState(camion.resolucionSanitaria ?? "");
  const [resolucionVenc, setResolucionVenc] = useState(
    camion.resolucionSanitariaVencimiento ? camion.resolucionSanitariaVencimiento.split("T")[0] : ""
  );
  const [saving, setSaving] = useState(false);

  // Reset cuando se reabre
  useEffect(() => {
    if (open) {
      setMarca(camion.marca ?? "");
      setModelo(camion.modelo ?? "");
      setAnio(camion.anio ? String(camion.anio) : "");
      setColor(camion.color ?? "");
      setNumeroMotor(camion.numeroMotor ?? "");
      setNumeroChasis(camion.numeroChasis ?? "");
      setCapacidad(String(camion.capacidad));
      setCarroceria(camion.carroceria ?? "");
      setTipoCisterna(camion.tipoCisterna ?? "");
      setMaterialEstanque(camion.materialEstanque ?? "");
      setTipoAgua(camion.tipoAgua ?? "");
      setResolucionSanitaria(camion.resolucionSanitaria ?? "");
      setResolucionVenc(
        camion.resolucionSanitariaVencimiento
          ? camion.resolucionSanitariaVencimiento.split("T")[0]
          : ""
      );
    }
  }, [open, camion]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const capacidadNum = Number(capacidad) || 0;
    if (capacidadNum <= 0) {
      toast.error("La capacidad debe ser mayor a 0");
      return;
    }
    setSaving(true);
    try {
      await apiPatch(`/api/camiones/${camion.id}`, {
        marca: marca.trim() || null,
        modelo: modelo.trim() || null,
        anio: anio ? Number(anio) : null,
        color: color.trim() || null,
        numeroMotor: numeroMotor.trim() || null,
        numeroChasis: numeroChasis.trim() || null,
        capacidad: capacidadNum,
        carroceria: carroceria || null,
        tipoCisterna: tipoCisterna || null,
        materialEstanque: materialEstanque || null,
        tipoAgua: tipoAgua || null,
        resolucionSanitaria: resolucionSanitaria.trim() || null,
        resolucionSanitariaVencimiento: resolucionVenc || null,
      });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar camión</DialogTitle>
          <DialogDescription>
            Datos del vehículo, configuración y resolución sanitaria.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          {/* Datos del vehículo */}
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Datos del vehículo
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Marca</Label>
                <Input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ford" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo</Label>
                <Input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="F-1000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Año</Label>
                <Input
                  type="number"
                  value={anio}
                  onChange={(e) => setAnio(e.target.value)}
                  placeholder="2015"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Azul" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">N° Motor</Label>
                <Input value={numeroMotor} onChange={(e) => setNumeroMotor(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">N° Chasis/VIN</Label>
                <Input value={numeroChasis} onChange={(e) => setNumeroChasis(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Capacidad (litros)</Label>
                <Input
                  type="number"
                  value={capacidad}
                  onChange={(e) => setCapacidad(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Configuración */}
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Configuración del camión
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Carrocería</Label>
                <Select value={carroceria} onValueChange={setCarroceria}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CARROCERIAS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de cisterna</Label>
                <Select value={tipoCisterna} onValueChange={setTipoCisterna}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CISTERNA.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Material del estanque</Label>
                <Select value={materialEstanque} onValueChange={setMaterialEstanque}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIALES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de agua</Label>
                <Select value={tipoAgua} onValueChange={setTipoAgua}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_AGUA.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Resolución sanitaria — solo si consumo_humano */}
          {tipoAgua === "consumo_humano" && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-3 dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-xs font-medium uppercase text-amber-900 dark:text-amber-200">
                Resolución sanitaria
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">N° resolución</Label>
                  <Input
                    value={resolucionSanitaria}
                    onChange={(e) => setResolucionSanitaria(e.target.value)}
                    placeholder="RES-1234/2024"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Vencimiento</Label>
                  <Input
                    type="date"
                    value={resolucionVenc}
                    onChange={(e) => setResolucionVenc(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Guardando…
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ===== Tab 2: Choferes =====

interface ChoferesTabProps {
  camion: Camion;
  isDueno: boolean;
  usuarios: UsuarioLista[];
  onUpdate: () => void;
}

function ChoferesTab({ camion, isDueno, usuarios, onUpdate }: ChoferesTabProps) {
  const [asignando, setAsignando] = useState(false);
  const choferes = camion.choferes ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">
              Choferes asignados ({choferes.length})
            </CardTitle>
          </div>
          {isDueno && (
            <Button size="sm" variant="outline" onClick={() => setAsignando(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Asignar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {choferes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Sin choferes asignados.{" "}
            {isDueno && "Usa el botón “Asignar” para agregar choferes a este camión."}
          </div>
        ) : (
          <ul className="space-y-2">
            {choferes.map((ch) => (
              <li
                key={ch.id}
                className="rounded-lg border border-border p-3 flex items-center gap-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{ch.nombre}</span>
                    {ch.role === "dueno" && (
                      <Badge variant="outline" className="text-[10px]">Dueño</Badge>
                    )}
                    {ch.role === "chofer" && (
                      <Badge variant="outline" className="text-[10px]">Chofer</Badge>
                    )}
                    {!ch.activo && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Inactivo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {ch.email}
                    {ch.telefono ? ` · ${ch.telefono}` : ""}
                    {ch.asignadoEn ? ` · Desde ${formatDate(ch.asignadoEn)}` : ""}
                  </p>
                </div>
                {isDueno && ch.role !== "dueno" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => desasignar(ch.id, camion.id, onUpdate)}
                  >
                    Quitar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {isDueno && (
        <AsignarChoferesDialog
          open={asignando}
          onOpenChange={setAsignando}
          camion={camion}
          usuarios={usuarios}
          onSaved={() => {
            setAsignando(false);
            onUpdate();
          }}
        />
      )}
    </Card>
  );
}

async function desasignar(choferId: string, camionId: string, onDone: () => void) {
  try {
    await apiDelete(`/api/camiones/${camionId}/choferes?choferId=${choferId}`);
    toast.success("Chofer desasignado");
    onDone();
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "No se pudo desasignar");
  }
}

function AsignarChoferesDialog({
  open,
  onOpenChange,
  camion,
  usuarios,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  camion: Camion;
  usuarios: UsuarioLista[];
  onSaved: () => void;
}) {
  const actuales = useMemo(
    () => new Set((camion.choferes ?? []).map((c) => c.id)),
    [camion.choferes]
  );
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set(actuales));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setSeleccionados(new Set(actuales));
  }, [open, actuales]);

  function toggle(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function guardar() {
    const agregar = [...seleccionados].filter((id) => !actuales.has(id));
    const quitar = [...actuales].filter((id) => !seleccionados.has(id));
    if (agregar.length === 0 && quitar.length === 0) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        ...agregar.map((choferId) =>
          apiPost(`/api/camiones/${camion.id}/choferes`, { choferId })
        ),
        ...quitar.map((choferId) =>
          apiDelete(`/api/camiones/${camion.id}/choferes?choferId=${choferId}`)
        ),
      ]);
      toast.success("Choferes actualizados");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar choferes a {camion.nombre}</DialogTitle>
          <DialogDescription>
            Selecciona quiénes pueden conducir este camión.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {usuarios.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center p-4">
              No hay usuarios. Crea choferes en la pestaña Equipo (desde el panel
              principal).
            </p>
          ) : (
            usuarios
              .filter((u) => u.activo || seleccionados.has(u.id))
              .map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30"
                >
                  <input
                    type="checkbox"
                    checked={seleccionados.has(u.id)}
                    onChange={() => toggle(u.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{u.nombre}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {u.role === "dueno" ? "Dueño" : "Chofer"}
                      </Badge>
                      {!u.activo && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </label>
              ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Guardando…
              </>
            ) : (
              "Guardar asignación"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Tab 3: Bitácora =====

interface BitacoraTabProps {
  camionId: string;
  entradas: BitacoraEntrada[];
  isDueno: boolean;
  onRefresh: () => void;
}

function BitacoraTab({ camionId, entradas, isDueno, onRefresh }: BitacoraTabProps) {
  const [tipo, setTipo] = useState<string>("observacion");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [kilometraje, setKilometraje] = useState("");
  const [fecha, setFecha] = useState(() => {
    // Fecha actual en formato yyyy-MM-dd
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descripcion.trim()) {
      toast.error("La descripción es obligatoria");
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/api/camiones/${camionId}/bitacora`, {
        tipo,
        descripcion: descripcion.trim(),
        monto: monto ? Number(monto) : null,
        kilometraje: kilometraje ? Number(kilometraje) : null,
        fecha: fecha ? new Date(fecha).toISOString() : null,
      });
      toast.success("Entrada registrada");
      setDescripcion("");
      setMonto("");
      setKilometraje("");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleResuelta(entrada: BitacoraEntrada) {
    setTogglingId(entrada.id);
    try {
      await apiPatch(
        `/api/camiones/${camionId}/bitacora?entradaId=${entrada.id}`,
        { resuelta: !entrada.resuelta }
      );
      toast.success(entrada.resuelta ? "Marcada como no resuelta" : "Marcada como resuelta");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Formulario nueva entrada */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Nueva entrada</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup label="Mantenimiento">
                      {TIPOS_BITACORA.filter((t) => t.categoria === "Mantenimiento").map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup label="Falla">
                      {TIPOS_BITACORA.filter((t) => t.categoria === "Falla").map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup label="Observación">
                      {TIPOS_BITACORA.filter((t) => t.categoria === "Observación").map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                      {TIPOS_BITACORA.filter((t) => t.categoria === "Otro").map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha</Label>
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción *</Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe el trabajo realizado, la falla detectada o la observación…"
                rows={3}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Monto ($)</Label>
                <Input
                  type="number"
                  min={0}
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kilometraje</Label>
                <Input
                  type="number"
                  min={0}
                  value={kilometraje}
                  onChange={(e) => setKilometraje(e.target.value)}
                  placeholder="Ej. 124500"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Guardando…
                  </>
                ) : (
                  <>
                    <Plus className="mr-1 h-4 w-4" /> Registrar entrada
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lista de entradas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">
                Historial ({entradas.length})
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {entradas.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Aún no hay entradas en la bitácora de este camión.
            </div>
          ) : (
            <ul className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
              {entradas.map((entrada) => (
                <BitacoraItem
                  key={entrada.id}
                  entrada={entrada}
                  isDueno={isDueno}
                  onToggle={() => toggleResuelta(entrada)}
                  toggling={togglingId === entrada.id}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// SelectGroup helper (no existe en shadcn/ui select directamente)
function SelectGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-1">
      <p className="px-2 py-1 text-[10px] uppercase font-semibold text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function BitacoraItem({
  entrada,
  isDueno,
  onToggle,
  toggling,
}: {
  entrada: BitacoraEntrada;
  isDueno: boolean;
  onToggle: () => void;
  toggling: boolean;
}) {
  const categoria = categoriaTipo(entrada.tipo);

  // Color por categoría
  const badgeClass =
    categoria === "Mantenimiento"
      ? "text-emerald-700 border-emerald-300 dark:border-emerald-700 dark:text-emerald-300"
      : categoria === "Falla"
      ? "text-red-700 border-red-300 dark:border-red-800 dark:text-red-300"
      : categoria === "Observación"
      ? "text-blue-700 border-blue-300 dark:border-blue-800 dark:text-blue-300"
      : "text-muted-foreground";

  return (
    <li className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${badgeClass}`}>
              {labelTipoBitacora(entrada.tipo)}
            </Badge>
            {entrada.severidad && (
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  entrada.severidad === "critica"
                    ? "text-red-700 border-red-400 dark:text-red-300"
                    : entrada.severidad === "alta"
                    ? "text-orange-700 border-orange-300 dark:text-orange-300"
                    : entrada.severidad === "media"
                    ? "text-amber-700 border-amber-300 dark:text-amber-300"
                    : "text-muted-foreground"
                }`}
              >
                {entrada.severidad}
              </Badge>
            )}
            {entrada.resuelta && (
              <Badge
                variant="outline"
                className="text-[10px] text-emerald-700 border-emerald-300 dark:border-emerald-700 dark:text-emerald-300"
              >
                <Check className="h-3 w-3" /> Resuelta
              </Badge>
            )}
          </div>
          <p className="text-sm mt-1 whitespace-pre-wrap break-words">
            {entrada.descripcion}
          </p>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1 border-t border-border/60">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(entrada.fecha)}
        </span>
        {entrada.kilometraje != null && (
          <span className="inline-flex items-center gap-1">
            <Gauge className="h-3 w-3" />
            {entrada.kilometraje.toLocaleString("es-CL")} km
          </span>
        )}
        {entrada.monto != null && entrada.monto > 0 && (
          <span className="inline-flex items-center gap-1">
            <Banknote className="h-3 w-3" />
            {formatCurrency(entrada.monto)}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <UserIcon className="h-3 w-3" />
          {entrada.autor?.nombre ?? "—"}
        </span>
        {entrada.creadoEn && (
          <span className="text-[10px]">
            Registrada: {formatDateTime(entrada.creadoEn)}
          </span>
        )}
        {entrada.resuelta && entrada.resueltaEn && (
          <span className="text-[10px] text-emerald-700 dark:text-emerald-300">
            Resuelta: {formatDateTime(entrada.resueltaEn)}
            {entrada.resueltaPor?.nombre ? ` por ${entrada.resueltaPor.nombre}` : ""}
          </span>
        )}
      </div>

      {/* Acción admin */}
      {isDueno && (
        <div className="pt-1">
          <Button
            size="sm"
            variant={entrada.resuelta ? "outline" : "default"}
            onClick={onToggle}
            disabled={toggling}
            className="h-7"
          >
            {toggling ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : entrada.resuelta ? (
              <Check className="mr-1 h-3 w-3" />
            ) : null}
            {entrada.resuelta ? "Marcar no resuelta" : "Marcar como resuelta"}
          </Button>
        </div>
      )}
    </li>
  );
}
