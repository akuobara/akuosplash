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
  Truck,
  Droplets,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { formatNumber } from "@/lib/helpers";

interface Camion {
  id: string;
  nombre: string;
  patente: string | null;
  capacidad: number;
  activo: boolean;
  _count?: { vueltas: number };
}

interface CamionesManagerProps {
  refreshKey: number;
  onRefresh: () => void;
  onCamionesChange: (camiones: Camion[]) => void;
}

export function CamionesManager({ refreshKey, onRefresh, onCamionesChange }: CamionesManagerProps) {
  const [camiones, setCamiones] = useState<Camion[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Camion | null>(null);
  const [borrando, setBorrando] = useState<Camion | null>(null);

  // Campos del formulario
  const [nombre, setNombre] = useState("");
  const [patente, setPatente] = useState("");
  const [capacidad, setCapacidad] = useState("17000");
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ camiones: Camion[] }>("/api/camiones");
      setCamiones(data.camiones);
      onCamionesChange(data.camiones);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los camiones");
    } finally {
      setLoading(false);
    }
  }, [onCamionesChange]);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setPatente("");
    setCapacidad("17000");
    setActivo(true);
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Camiones ({camiones.length})</CardTitle>
          </div>
          <Button onClick={abrirNuevo} size="sm" variant="outline">
            <Plus className="mr-1 h-4 w-4" /> Agregar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada camión tiene su propia capacidad. Cuando tengas más camiones o más dueños/chóferes, los agregas aquí.
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
            No hay camiones. Agrega el primero.
          </div>
        ) : (
          <ul className="space-y-2">
            {camiones.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
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
                    {c._count && c._count.vueltas > 0 && ` · ${c._count.vueltas} vuelta(s) registradas`}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
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
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {/* Formulario */}
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
              <p className="text-xs text-muted-foreground">
                Cuando sales de la planta con el camión lleno, la app descuenta los litros entregados para mostrar cuánto queda disponible.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="camionActivo" className="text-sm font-medium">Camión activo</Label>
                <p className="text-xs text-muted-foreground">
                  Los camiones inactivos no aparecen al iniciar una nueva vuelta.
                </p>
              </div>
              <Switch id="camionActivo" checked={activo} onCheckedChange={setActivo} />
            </div>
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
