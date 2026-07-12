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
  Checkbox,
} from "@/components/ui/checkbox";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Truck,
  Droplets,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { formatNumber } from "@/lib/helpers";

interface Chofer {
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
  choferes?: Chofer[];
  _count?: { vueltas: number };
}

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  role: string;
  activo: boolean;
}

interface CamionesManagerProps {
  refreshKey: number;
  onRefresh: () => void;
  onCamionesChange: (camiones: Camion[]) => void;
  isDueno: boolean;
}

export function CamionesManager({ refreshKey, onRefresh, onCamionesChange, isDueno }: CamionesManagerProps) {
  const [camiones, setCamiones] = useState<Camion[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Camion | null>(null);
  const [borrando, setBorrando] = useState<Camion | null>(null);
  const [asignando, setAsignando] = useState<Camion | null>(null);

  // Campos del formulario
  const [nombre, setNombre] = useState("");
  const [patente, setPatente] = useState("");
  const [capacidad, setCapacidad] = useState("17000");
  const [activo, setActivo] = useState(true);
  const [autoAsignarDueno, setAutoAsignarDueno] = useState(true);
  const [saving, setSaving] = useState(false);

  // Choferes seleccionados para asignar
  const [choferesSeleccionados, setChoferesSeleccionados] = useState<Set<string>>(new Set());

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ camiones: Camion[] }>("/api/camiones");
      setCamiones(data.camiones);
      onCamionesChange(data.camiones);
      if (isDueno) {
        const userData = await apiGet<{ usuarios: Usuario[] }>("/api/usuarios");
        setUsuarios(userData.usuarios);
      }
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los camiones");
    } finally {
      setLoading(false);
    }
  }, [onCamionesChange, isDueno]);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setPatente("");
    setCapacidad("17000");
    setActivo(true);
    setAutoAsignarDueno(true);
    setFormOpen(true);
  }

  function abrirEditar(c: Camion) {
    setEditando(c);
    setNombre(c.nombre);
    setPatente(c.patente ?? "");
    setCapacidad(String(c.capacidad));
    setActivo(c.activo);
    setFormOpen(true);
  }

  function abrirAsignar(c: Camion) {
    setAsignando(c);
    setChoferesSeleccionados(new Set((c.choferes ?? []).map((ch) => ch.id)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    const capacidadNum = Number(capacidad) || 0;
    if (capacidadNum <= 0) {
      toast.error("La capacidad debe ser mayor a 0");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        patente: patente.trim() || null,
        capacidad: capacidadNum,
        activo,
        autoAsignarDueno: !editando && autoAsignarDueno,
      };
      if (editando) {
        await apiPatch(`/api/camiones/${editando.id}`, payload);
        toast.success("Camión actualizado");
      } else {
        await apiPost("/api/camiones", payload);
        toast.success("Camión creado");
      }
      setFormOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleBorrar(c: Camion) {
    try {
      await apiDelete(`/api/camiones/${c.id}`);
      toast.success("Camión eliminado");
      setBorrando(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  async function guardarAsignacion() {
    if (!asignando) return;

    const actuales = new Set((asignando.choferes ?? []).map((ch) => ch.id));
    const agregar = [...choferesSeleccionados].filter((id) => !actuales.has(id));
    const quitar = [...actuales].filter((id) => !choferesSeleccionados.has(id));

    try {
      await Promise.all([
        ...agregar.map((choferId) =>
          apiPost(`/api/camiones/${asignando.id}/choferes`, { choferId })
        ),
        ...quitar.map((choferId) =>
          apiDelete(`/api/camiones/${asignando.id}/choferes?choferId=${choferId}`)
        ),
      ]);
      toast.success("Choferes asignados");
      setAsignando(null);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo asignar");
    }
  }

  function toggleChofer(id: string) {
    setChoferesSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Camiones ({camiones.length})</CardTitle>
          </div>
          {isDueno && (
            <Button onClick={abrirNuevo} size="sm" variant="outline">
              <Plus className="mr-1 h-4 w-4" /> Agregar
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Cada camión tiene su propia capacidad y choferes asignados.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : camiones.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No hay camiones. {isDueno && "Agrega el primero."}
          </div>
        ) : (
          <ul className="space-y-2">
            {camiones.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.nombre}</span>
                      {c.patente && (
                        <Badge variant="outline" className="text-[10px]">{c.patente}</Badge>
                      )}
                      {c.activo ? (
                        <Badge variant="secondary" className="text-[10px] text-emerald-700 dark:text-emerald-300">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <Droplets className="mr-1 inline h-3 w-3" />
                      Capacidad: <strong>{formatNumber(c.capacidad, 0)} L</strong>
                      {c._count && c._count.vueltas > 0 && ` · ${c._count.vueltas} vuelta(s)`}
                    </p>
                    {/* Choferes asignados */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {(c.choferes ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin choferes asignados</span>
                      ) : (
                        (c.choferes ?? []).map((ch) => (
                          <Badge key={ch.id} variant="outline" className="text-[10px] gap-1">
                            <User className="h-2.5 w-2.5" />
                            {ch.nombre}
                            {ch.role === "dueno" && " (dueño)"}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  {isDueno && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => abrirAsignar(c)}>
                          <Users className="mr-2 h-4 w-4" /> Asignar choferes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => abrirEditar(c)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setBorrando(c)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {/* Formulario crear/editar camión */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar camión" : "Nuevo camión"}</DialogTitle>
            <DialogDescription>
              Define el nombre (alias) y la capacidad del estanque en litros.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="camionNombre">Nombre / alias *</Label>
              <Input
                id="camionNombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Camión grande, Camión azul, Unidad 1"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="camionPatente">Patente (opcional)</Label>
              <Input
                id="camionPatente"
                value={patente}
                onChange={(e) => setPatente(e.target.value.toUpperCase())}
                placeholder="Ej. ABCD12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="camionCapacidad">Capacidad del estanque (litros) *</Label>
              <Input
                id="camionCapacidad"
                type="number"
                inputMode="numeric"
                value={capacidad}
                onChange={(e) => setCapacidad(e.target.value)}
                placeholder="17000"
                required
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="camionActivo" className="text-sm font-medium">Camión activo</Label>
                <p className="text-xs text-muted-foreground">
                  Los inactivos no aparecen al iniciar vueltas.
                </p>
              </div>
              <Switch id="camionActivo" checked={activo} onCheckedChange={setActivo} />
            </div>
            {!editando && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label htmlFor="autoAsignar" className="text-sm font-medium">Asignarme como chofer</Label>
                  <p className="text-xs text-muted-foreground">
                    Te asigna automáticamente a ti (dueño) como chofer de este camión.
                  </p>
                </div>
                <Switch id="autoAsignar" checked={autoAsignarDueno} onCheckedChange={setAutoAsignarDueno} />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : editando ? "Guardar cambios" : "Crear camión"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo asignar choferes */}
      <Dialog open={!!asignando} onOpenChange={(o) => !o && setAsignando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar choferes a {asignando?.nombre}</DialogTitle>
            <DialogDescription>
              Selecciona quiénes pueden conducir este camión. Un camión puede tener varios choferes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {usuarios.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center p-4">
                No hay usuarios. Crea choferes en la pestaña Equipo.
              </p>
            ) : (
              usuarios.filter((u) => u.activo || choferesSeleccionados.has(u.id)).map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30"
                >
                  <Checkbox
                    checked={choferesSeleccionados.has(u.id)}
                    onCheckedChange={() => toggleChofer(u.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
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
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAsignando(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarAsignacion}>
              Guardar asignación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <Dialog open={!!borrando} onOpenChange={(o) => !o && setBorrando(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar camión</DialogTitle>
            <DialogDescription>
              ¿Eliminar el camión <strong>{borrando?.nombre}</strong>? Las vueltas ya registradas
              se conservan pero quedarán sin camión asociado.
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
    </Card>
  );
}
