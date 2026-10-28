"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Mail, KeyRound, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { apiPatch } from "@/components/akuosplash/akuosplash-api-client";

interface CuentaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  nombreActual: string;
  emailActual: string;
  onUpdated?: () => void;
}

export function CuentaDialog({ open, onOpenChange, userId, nombreActual, emailActual, onUpdated }: CuentaDialogProps) {
  const [nombre, setNombre] = useState(nombreActual);
  const [email, setEmail] = useState(emailActual);
  const [telefono, setTelefono] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Cambiar contraseña
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Cargar datos actuales al abrir
  useState(() => {
    if (open) {
      setNombre(nombreActual);
      setEmail(emailActual);
    }
  });

  async function guardarPerfil() {
    if (!nombre.trim() || !email.trim()) {
      toast.error("Nombre y email son obligatorios");
      return;
    }
    setSavingProfile(true);
    try {
      await apiPatch(`/api/akuosplash/usuarios/${userId}`, {
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim() || null,
      });
      toast.success("Perfil actualizado");
      onUpdated?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setSavingProfile(false);
    }
  }

  async function cambiarPassword() {
    if (!currentPassword || !newPassword) {
      toast.error("Completa todos los campos");
      return;
    }
    if (newPassword.length < 4) {
      toast.error("La nueva contraseña debe tener al menos 4 caracteres");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Las contraseñas nuevas no coinciden");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/akuosplash/auth/cambiar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo cambiar");
        return;
      }
      toast.success("Contraseña cambiada exitosamente");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (e) {
      toast.error("Error de conexión");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mi cuenta</DialogTitle>
          <DialogDescription>
            Actualiza tu email, nombre o contraseña. Si cambiaste el email temporal por uno definitivo, actualízalo aquí.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sección: Perfil */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4 text-muted-foreground" /> Datos de la cuenta
            </div>

            <div className="space-y-2">
              <Label htmlFor="cuentaNombre" className="text-xs">Nombre</Label>
              <Input id="cuentaNombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cuentaEmail" className="text-xs">Email</Label>
              <Input id="cuentaEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
              <p className="text-[10px] text-muted-foreground">
                Si vas a traspasar la cuenta al administrador, cambia el email por el suyo aquí.
              </p>
            </div>

            <Button onClick={guardarPerfil} disabled={savingProfile} size="sm" className="w-full">
              {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Guardar cambios
            </Button>
          </div>

          <Separator />

          {/* Sección: Contraseña */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4 text-muted-foreground" /> Cambiar contraseña
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentPwd" className="text-xs">Contraseña actual</Label>
              <div className="relative">
                <Input
                  id="currentPwd"
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="newPwd" className="text-xs">Nueva contraseña</Label>
                <Input
                  id="newPwd"
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmNewPwd" className="text-xs">Confirmar</Label>
                <div className="relative">
                  <Input
                    id="confirmNewPwd"
                    type={showPasswords ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••"
                  />
                  {confirmNewPassword.length > 0 && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2">
                      {newPassword === confirmNewPassword ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <span className="text-xs text-red-500">✗</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Button onClick={cambiarPassword} disabled={savingPassword} size="sm" variant="outline" className="w-full">
              {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Cambiar contraseña
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
