"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, User, Droplets, Wallet, Calendar, Mail, Phone, LogOut } from "lucide-react";
import { apiGet } from "@/components/akuosplash/akuosplash-api-client";
import { formatCurrency, formatNumber, formatDate } from "@/components/akuosplash/akuosplash-helpers";
import { Button } from "@/components/ui/button";

interface MiPerfilData {
  usuario: {
    id: string;
    nombre: string;
    email: string;
    telefono: string | null;
    role: string;
  };
  camiones: {
    id: string;
    nombre: string;
    patente: string | null;
    capacidad: number;
    activo: boolean;
  }[];
  stats: {
    totalEntregas: number;
    totalLitros: number;
    totalVueltas: number;
    ventasMes: number;
  };
  dueno: {
    nombre: string;
    email: string;
    telefono: string | null;
  } | null;
}

export function MiPerfilTab({ onLogout }: { onLogout?: () => void }) {
  const [data, setData] = useState<MiPerfilData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<MiPerfilData>("/api/akuosplash/auth/me?perfil=true")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-sm text-muted-foreground py-8">No se pudo cargar el perfil.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Datos personales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" /> Mis datos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{data.usuario.nombre}</span>
            <Badge variant="outline" className="text-[10px]">Chofer</Badge>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>{data.usuario.email}</span>
          </div>
          {data.usuario.telefono && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{data.usuario.telefono}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Camión asignado */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4 text-primary" /> Mi camión
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.camiones.length === 0 ? (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 p-3 text-sm text-amber-900 dark:text-amber-200">
              <p className="font-medium">No tienes camión asignado</p>
              <p className="text-xs mt-1">Pedile al administrador que te asigne uno desde Ajustes → Camiones.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.camiones.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium">{c.nombre}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {c.patente && <span>Patente: {c.patente}</span>}
                      <span>Capacidad: {formatNumber(c.capacidad, 0)} L</span>
                    </div>
                  </div>
                  <Badge variant={c.activo ? "default" : "secondary"} className="text-[10px]">
                    {c.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Droplets className="h-4 w-4 text-primary" /> Mis estadísticas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground">Total entregas</p>
              <p className="text-xl font-bold">{data.stats.totalEntregas}</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground">Total litros</p>
              <p className="text-xl font-bold">{formatNumber(data.stats.totalLitros, 0)} L</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground">Vueltas</p>
              <p className="text-xl font-bold">{data.stats.totalVueltas}</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground">Ventas del mes</p>
              <p className="text-xl font-bold">{formatCurrency(data.stats.ventasMes)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacto del admin */}
      {data.dueno && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-primary" /> Contacto del administrador
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{data.dueno.nombre}</p>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${data.dueno.email}`} className="hover:underline">{data.dueno.email}</a>
            </div>
            {data.dueno.telefono && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <a href={`tel:${data.dueno.telefono}`} className="hover:underline">{data.dueno.telefono}</a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cerrar sesión */}
      {onLogout && (
        <Button variant="outline" className="w-full" onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
        </Button>
      )}
    </div>
  );
}
