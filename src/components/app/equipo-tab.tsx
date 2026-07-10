"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  User,
  Mail,
  Phone,
  Users,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { formatDateTime } from "@/lib/helpers";

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  role: string;
  activo: boolean;
  duenoId: string | null;
  creadoEn: string;
  _count?: {
    vueltasComoChofer: number;
    entregasComoChofer: number;
    asignaciones: number;
  };
}

interface EquipoTabProps {
  refreshKey: number;
  onRefresh: () => void;
}

export function EquipoTab({ refreshKey, onRefresh }: EquipoTabProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [borrando, setBorrando] = useState<Usuario | null>(null);

  // Campos del formulario
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telefono, setTelefono] = useState("");
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ usuarios: Usuario[] }>("/api/usuarios");
      setUsuarios(data.usuarios);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setEmail("");
    setPassword("");
    setTelefono("");
    setActivo(true);
    setFormOpen(true);
  }

  function abrirEditar(u: Usuario) {
    setEditando(u);
    setNombre(u.nombre);
    setEmail(u.email);
    setPassword("");
    setTelefono(u.telefono ?? "");
    setActivo(u.activo);
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !email.trim()) {
      toast.error("Nombre y email son obligatorios");
      return;
    }
    if (!editando && (!password || password.length < 4)) {
      toast.error("La contraseña debe tener al menos 4 caracteres");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim() || null,
        activo,
      };
      if (password) {
        payload.password = password;
      }

      if (editando) {
        await apiPatch(`/api/usuarios/${editando.id}`, payload);
        toast.success("Chofer actualizado");
      } else {
        await apiPost("/api/usuarios", payload);
        toast.success("Chofer creado");
      }
      setFormOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleBorrar(u: Usuario) {
    try {
      await apiDelete(`/api/usuarios/${u.id}`);
      toast.success("Chofer eliminado");
      setBorrando(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">Equipo</h2>
          <p className="text-sm text-muted-foreground">
            Gestiona los choferes que pueden usar la app. Asigna camiones desde la pestaña Ajustes → Camiones.
          </p>
        </div>
        <Button onClick={abrirNuevo} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Nuevo chofer
        </Button>
      </div>

      {/* Lista */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Usuarios ({usuarios.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : usuarios.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No hay usuarios.
            </div>
          ) : (
            <ul className="space-y-2">
              {usuarios.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{u.nombre}</span>
                      <Badge
                        variant={u.role === "dueno" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {u.role === "dueno" ? "Dueño" : "Chofer"}
                      </Badge>
                      {!u.activo && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {u.email}
                      </span>
                      {u.telefono && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {u.telefono}
                        </span>
                      )}
                    </div>
                    {u._count && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <Truck className="mr-1 inline h-3 w-3" />
                        {u._count.asignaciones} camión(es) · {u._count.entregasComoChofer} entrega(s) · {u._count.vueltasComoChofer} vuelta(s)
                      </p>
                    )}
                  </div>
                  {u.role !== "dueno" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => abrirEditar(u)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setBorrando(u)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Formulario crear/editar chofer */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar chofer" : "Nuevo chofer"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Actualiza los datos del chofer. Deja la contraseña vacía para no cambiarla."
                : "Crea una cuenta de chofer. El chofer podrá iniciar sesión con email y contraseña."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="choferNombre">Nombre completo *</Label>
              <Input
                id="choferNombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Juan Pérez"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="choferEmail">Email *</Label>
              <Input
                id="choferEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="chofer@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="choferPassword">
                Contraseña {editando && "(dejar vacío para no cambiar)"}
              </Label>
              <Input
                id="choferPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required={!editando}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="choferTelefono">Teléfono (opcional)</Label>
              <Input
                id="choferTelefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+56 9 1234 5678"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="choferActivo" className="text-sm font-medium">Cuenta activa</Label>
                <p className="text-xs text-muted-foreground">
                  Los choferes inactivos no pueden iniciar sesión.
                </p>
              </div>
              <Switch id="choferActivo" checked={activo} onCheckedChange={setActivo} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : editando ? "Guardar cambios" : "Crear chofer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <Dialog open={!!borrando} onOpenChange={(o) => !o && setBorrando(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar chofer</DialogTitle>
            <DialogDescription>
              ¿Eliminar a <strong>{borrando?.nombre}</strong>? Las entregas y vueltas registradas
              se conservan, pero el chofer ya no podrá iniciar sesión.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBorrando(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => borrando && handleBorrar(borrando)}>
              <Trash2 className="mr-1 h-4 w-4" /> Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
