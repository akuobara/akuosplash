"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Users, Truck, Droplets, DollarSign, TrendingUp, TrendingDown,
  Activity, Shield, Search, UserCheck, UserX, ArrowLeft, LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch } from "@/lib/api-client";
import { formatCurrency, formatNumber, formatDate } from "@/lib/helpers";
import { saveToken, clearToken } from "@/lib/api-client";

interface Stats {
  globales: {
    administradores: number;
    choferes: number;
    clientes: number;
    camiones: number;
    entregas: number;
    vueltas: number;
    gastos: number;
    pagos: number;
    ventasTotal: number;
    efectivoTotal: number;
    transferenciaTotal: number;
    litrosTotal: number;
  };
  administradores: Array<{
    id: string;
    nombre: string;
    email: string;
    activo: boolean;
    creadoEn: string;
    _count: {
      choferes: number;
      camionesDueno: number;
      clientesDueno: number;
      vueltasComoDueno: number;
      entregasComoDueno: number;
    };
    ventasTotal: number;
    litrosTotal: number;
  }>;
}

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  role: string;
  activo: boolean;
  creadoEn: string;
  duenoId: string | null;
}

export default function SuperAdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [tab, setTab] = useState<"dashboard" | "administradores" | "usuarios">("dashboard");

  const cargar = async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        apiGet<Stats>("/api/super-admin/stats"),
        apiGet<{ usuarios: Usuario[] }>("/api/super-admin/usuarios"),
      ]);
      setStats(s);
      setUsuarios(u.usuarios);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  async function toggleUsuario(u: { id: string; activo: boolean }) {
    try {
      await apiPatch(`/api/super-admin/usuarios`, { userId: u.id, activo: !u.activo });
      toast.success(u.activo ? "Usuario desactivado" : "Usuario activado");
      cargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  }

  function handleLogout() {
    clearToken();
    window.location.href = "/";
  }

  const usuariosFiltrados = usuarios.filter((u) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto max-w-5xl space-y-4">
          <Skeleton className="h-12 rounded-lg" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-base font-bold sm:text-lg">Panel Súper Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-1 inline h-3 w-3" /> App
            </a>
            <Button onClick={handleLogout} variant="ghost" size="sm">
              <LogOut className="mr-1 h-4 w-4" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2">
          <Button size="sm" variant={tab === "dashboard" ? "default" : "outline"} onClick={() => setTab("dashboard")}>
            <Activity className="mr-1 h-4 w-4" /> Resumen
          </Button>
          <Button size="sm" variant={tab === "administradores" ? "default" : "outline"} onClick={() => setTab("administradores")}>
            <Users className="mr-1 h-4 w-4" /> Administradores
          </Button>
          <Button size="sm" variant={tab === "usuarios" ? "default" : "outline"} onClick={() => setTab("usuarios")}>
            <UserCheck className="mr-1 h-4 w-4" /> Todos los usuarios
          </Button>
        </div>

        {/* Dashboard */}
        {tab === "dashboard" && stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Administradores</p>
                      <p className="text-xl font-bold">{stats.globales.administradores}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-emerald-500" />
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Choferes</p>
                      <p className="text-xl font-bold">{stats.globales.choferes}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Clientes</p>
                      <p className="text-xl font-bold">{stats.globales.clientes}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Camiones</p>
                      <p className="text-xl font-bold">{stats.globales.camiones}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <p className="text-[10px] uppercase text-muted-foreground">Ventas totales</p>
                  <p className="text-lg font-bold tabular-nums">{formatCurrency(stats.globales.ventasTotal)}</p>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10">
                <CardContent className="p-3">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <p className="text-[10px] uppercase text-muted-foreground">Efectivo</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-600">{formatCurrency(stats.globales.efectivoTotal)}</p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/10">
                <CardContent className="p-3">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <p className="text-[10px] uppercase text-muted-foreground">Transferencia</p>
                  <p className="text-lg font-bold tabular-nums text-blue-600">{formatCurrency(stats.globales.transferenciaTotal)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <Droplets className="h-4 w-4 text-cyan-500" />
                  <p className="text-[10px] uppercase text-muted-foreground">Litros entregados</p>
                  <p className="text-lg font-bold tabular-nums">{formatNumber(stats.globales.litrosTotal, 0)} L</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Entregas</p>
                  <p className="text-lg font-bold">{stats.globales.entregas}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Vueltas</p>
                  <p className="text-lg font-bold">{stats.globales.vueltas}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Gastos</p>
                  <p className="text-lg font-bold">{stats.globales.gastos}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Pagos</p>
                  <p className="text-lg font-bold">{stats.globales.pagos}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Administradores */}
        {tab === "administradores" && stats && (
          <div className="space-y-3">
            {stats.administradores.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  No hay administradores registrados.
                </CardContent>
              </Card>
            ) : (
              stats.administradores.map((a) => (
                <Card key={a.id} className={!a.activo ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{a.nombre}</span>
                          {!a.activo && <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactivo</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{a.email}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Registrado: {formatDate(a.creadoEn)}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          <div><span className="text-muted-foreground">Choferes:</span> <strong>{a._count.choferes}</strong></div>
                          <div><span className="text-muted-foreground">Camiones:</span> <strong>{a._count.camionesDueno}</strong></div>
                          <div><span className="text-muted-foreground">Clientes:</span> <strong>{a._count.clientesDueno}</strong></div>
                          <div><span className="text-muted-foreground">Entregas:</span> <strong>{a._count.entregasComoDueno}</strong></div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs">
                          <span className="text-primary font-medium">{formatCurrency(a.ventasTotal)} en ventas</span>
                          <span className="text-muted-foreground">{formatNumber(a.litrosTotal, 0)} L entregados</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={a.activo ? "outline" : "default"}
                        onClick={() => toggleUsuario(a)}
                        className={a.activo ? "text-destructive" : ""}
                      >
                        {a.activo ? <><UserX className="mr-1 h-3 w-3" /> Desactivar</> : <><UserCheck className="mr-1 h-3 w-3" /> Activar</>}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Todos los usuarios */}
        {tab === "usuarios" && (
          <div className="space-y-3">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, email, rol..."
                className="pl-8 h-9"
              />
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="p-3">Nombre</th>
                        <th className="p-3 hidden sm:table-cell">Email</th>
                        <th className="p-3">Rol</th>
                        <th className="p-3">Estado</th>
                        <th className="p-3 hidden sm:table-cell">Registro</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuariosFiltrados.map((u) => (
                        <tr key={u.id} className="border-b border-border last:border-0">
                          <td className="p-3 font-medium">{u.nombre}</td>
                          <td className="p-3 hidden sm:table-cell text-muted-foreground">{u.email}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-[10px]">
                              {u.role === "dueno" ? "Administrador" : u.role === "chofer" ? "Chofer" : u.role === "super_admin" ? "Súper Admin" : u.role}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {u.activo ? (
                              <Badge variant="secondary" className="text-[10px] text-emerald-700">Activo</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactivo</Badge>
                            )}
                          </td>
                          <td className="p-3 hidden sm:table-cell text-xs text-muted-foreground">{formatDate(u.creadoEn)}</td>
                          <td className="p-3">
                            {u.role !== "super_admin" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleUsuario(u)}
                                className={u.activo ? "text-destructive" : "text-emerald-600"}
                              >
                                {u.activo ? "Desactivar" : "Activar"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
