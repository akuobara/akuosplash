"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  Phone,
  MapPin,
  Droplets,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { formatCurrency, formatNumber } from "@/lib/helpers";

interface Cliente {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  precioPorLitro: number;
  nota: string | null;
  _count?: { entregas: number };
}

interface ClientesTabProps {
  refreshKey: number;
  onRefresh: () => void;
}

export function ClientesTab({ refreshKey, onRefresh }: ClientesTabProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [borrando, setBorrando] = useState<Cliente | null>(null);

  // Campos del formulario
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [precio, setPrecio] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ clientes: Cliente[] }>("/api/clientes");
      setClientes(data.clientes);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, refreshKey]);

  const filtrados = clientes.filter((c) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(q) ||
      (c.direccion ?? "").toLowerCase().includes(q) ||
      (c.telefono ?? "").toLowerCase().includes(q)
    );
  });

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setDireccion("");
    setTelefono("");
    setPrecio("");
    setNota("");
    setFormOpen(true);
  }

  function abrirEditar(c: Cliente) {
    setEditando(c);
    setNombre(c.nombre);
    setDireccion(c.direccion ?? "");
    setTelefono(c.telefono ?? "");
    setPrecio(c.precioPorLitro ? String(c.precioPorLitro) : "");
    setNota(c.nota ?? "");
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        direccion: direccion.trim() || null,
        telefono: telefono.trim() || null,
        precioPorLitro: Number(precio) || 0,
        nota: nota.trim() || null,
      };
      if (editando) {
        await apiPatch(`/api/clientes/${editando.id}`, payload);
        toast.success("Cliente actualizado");
      } else {
        await apiPost("/api/clientes", payload);
        toast.success("Cliente creado");
      }
      setFormOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleBorrar(c: Cliente) {
    try {
      await apiDelete(`/api/clientes/${c.id}`);
      toast.success("Cliente eliminado");
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
          <h2 className="text-lg font-semibold sm:text-xl">Clientes</h2>
          <p className="text-sm text-muted-foreground">
            Catálogo de clientes frecuentes — útil para autocompletar entregas y para futuras ventas online.
          </p>
        </div>
        <Button onClick={abrirNuevo} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Nuevo cliente
        </Button>
      </div>

      <Input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, dirección o teléfono…"
        className="max-w-md"
      />

      {/* Lista */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {clientes.length === 0
                ? "Aún no hay clientes registrados."
                : "No se encontraron clientes."}
            </p>
            <Button onClick={abrirNuevo} variant="outline" size="sm">
              <Plus className="mr-1 h-4 w-4" /> Agregar cliente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.nombre}</p>
                    {c._count && (
                      <p className="text-xs text-muted-foreground">
                        {c._count.entregas} entrega{c._count.entregas !== 1 ? "s" : ""} registradas
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
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
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {c.direccion && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.direccion}</span>
                    </div>
                  )}
                  {c.telefono && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <a href={`tel:${c.telefono}`} className="hover:underline">
                        {c.telefono}
                      </a>
                    </div>
                  )}
                  {c.precioPorLitro > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Droplets className="h-3.5 w-3.5 shrink-0" />
                      <span>{formatCurrency(c.precioPorLitro)} / L</span>
                    </div>
                  )}
                </div>
                {c.nota && (
                  <p className="mt-1 line-clamp-2 rounded bg-muted/40 p-2 text-xs text-muted-foreground">
                    {c.nota}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Formulario */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
            <DialogDescription>
              Los datos del cliente se guardan para autocompletar nuevas entregas.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombreCliente">Nombre *</Label>
              <Input
                id="nombreCliente"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Juan Pérez"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="direccionCliente">Dirección</Label>
              <Input
                id="direccionCliente"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número, comuna"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefonoCliente">Teléfono</Label>
              <Input
                id="telefonoCliente"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+56 9 1234 5678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="precioCliente">Precio por litro (opcional)</Label>
              <Input
                id="precioCliente"
                type="number"
                inputMode="decimal"
                step="any"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notaCliente">Nota</Label>
              <Textarea
                id="notaCliente"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ej. Llamar 15 min antes, estanque en el patio trasero"
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : editando ? "Guardar cambios" : "Crear cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <Dialog open={!!borrando} onOpenChange={(o) => !o && setBorrando(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar cliente</DialogTitle>
            <DialogDescription>
              ¿Eliminar a <strong>{borrando?.nombre}</strong>? El historial de entregas no se borra,
              pero ya no estará asociado a este cliente.
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
