"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

export interface SessionUser {
  userId: string;
  email: string;
  nombre: string;
  role: "dueno" | "chofer";
  duenoId: string | null;
}

interface AuthScreenProps {
  hasUsers: boolean;
  onAuthSuccess: (user: SessionUser) => void;
}

export function AuthScreen({ hasUsers, onAuthSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">(hasUsers ? "login" : "register");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "register") {
        if (!nombre.trim() || !email.trim() || !password) {
          toast.error("Completa todos los campos");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, email, password, telefono }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "No se pudo registrar");
          setLoading(false);
          return;
        }
        toast.success(`¡Bienvenido, ${data.user.nombre}! Tu cuenta de dueño está lista.`);
        onAuthSuccess(data.user);
      } else {
        if (!email.trim() || !password) {
          toast.error("Ingresa email y contraseña");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "No se pudo iniciar sesión");
          setLoading(false);
          return;
        }
        toast.success(`¡Bienvenido, ${data.user.nombre}!`);
        onAuthSuccess(data.user);
      }
    } catch (err) {
      toast.error("Error de conexión");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Droplets className="h-9 w-9" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">Aljibe App</h1>
            <p className="text-sm text-muted-foreground">Registro de entregas de agua</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {mode === "register"
                ? hasUsers
                  ? "Crear cuenta"
                  : "Crear cuenta de dueño"
                : "Iniciar sesión"}
            </CardTitle>
            {!hasUsers && mode === "register" && (
              <p className="text-center text-sm text-muted-foreground">
                Esta será la primera cuenta y se creará como <strong>dueño</strong>. Podrás agregar choferes después.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre completo</Label>
                  <Input
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Pedro González"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  required
                />
              </div>

              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono (opcional)</Label>
                  <Input
                    id="telefono"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+56 9 1234 5678"
                  />
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : mode === "register" ? (
                  <UserPlus className="mr-2 h-4 w-4" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                {mode === "register" ? "Crear cuenta" : "Iniciar sesión"}
              </Button>
            </form>

            {hasUsers && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                {mode === "login" ? (
                  <>
                    ¿No tienes cuenta?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("register")}
                      className="font-medium text-primary hover:underline"
                    >
                      Pídeele al dueño que te agregue
                    </button>
                  </>
                ) : (
                  <>
                    ¿Ya tienes cuenta?{" "}
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="font-medium text-primary hover:underline"
                    >
                      Inicia sesión
                    </button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {hasUsers
            ? "Si eres chofer, pídele al dueño tu email y contraseña."
            : "Primera vez: crea la cuenta del dueño del camión."}
        </p>
      </div>
    </div>
  );
}
