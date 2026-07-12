"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { saveToken } from "@/lib/api-client";

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

// Tipos para Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
              locale?: string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function AuthScreen({ hasUsers, onAuthSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">(hasUsers ? "login" : "register");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [googleConfig, setGoogleConfig] = useState<{ enabled: boolean; clientId: string | null }>({
    enabled: false,
    clientId: null,
  });
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleScriptLoaded = useRef(false);

  // Cargar configuración pública (¿Google login habilitado?)
  useEffect(() => {
    fetch("/api/config/public")
      .then((r) => r.json())
      .then((data) => {
        setGoogleConfig({
          enabled: !!data.googleLoginEnabled,
          clientId: data.googleClientId,
        });
      })
      .catch(() => {
        // Si falla, simplemente no mostramos Google
      });
  }, []);

  // Cargar script de Google Identity Services cuando esté habilitado
  useEffect(() => {
    if (!googleConfig.enabled || !googleConfig.clientId) return;
    if (googleScriptLoaded.current) return;
    if (document.getElementById("google-gsi-script")) {
      googleScriptLoaded.current = true;
      return;
    }

    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    googleScriptLoaded.current = true;
  }, [googleConfig.enabled, googleConfig.clientId]);

  // Callback de Google — definido con useCallback antes del useEffect que lo usa
  const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
    setGoogleLoading(true);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo iniciar sesión con Google");
        setGoogleLoading(false);
        return;
      }
      toast.success(`¡Bienvenido, ${data.user.nombre}!`);
      if (data.token) saveToken(data.token);
      onAuthSuccess(data.user);
    } catch (err) {
      toast.error("Error de conexión con Google");
      setGoogleLoading(false);
    }
  }, [onAuthSuccess]);

  // Inicializar Google button cuando el script esté cargado
  useEffect(() => {
    if (!googleConfig.enabled || !googleConfig.clientId) return;
    if (!googleButtonRef.current) return;
    if (typeof window.google === "undefined") {
      // El script aún no cargó — reintentar en 200ms
      const timer = setTimeout(() => {
        // Trigger re-render verificando
        setGoogleConfig((c) => ({ ...c }));
      }, 200);
      return () => clearTimeout(timer);
    }

    try {
      window.google!.accounts.id.initialize({
        client_id: googleConfig.clientId!,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      window.google!.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 400,
        locale: "es",
      });
    } catch (err) {
      console.error("Error initializing Google:", err);
    }
  }, [googleConfig.enabled, googleConfig.clientId, handleGoogleCredential]);

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
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "No se pudo registrar");
          setLoading(false);
          return;
        }
        toast.success(`¡Bienvenido, ${data.user.nombre}! Tu cuenta de dueño está lista.`);
        if (data.token) saveToken(data.token);
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
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "No se pudo iniciar sesión");
          setLoading(false);
          return;
        }
        toast.success(`¡Bienvenido, ${data.user.nombre}!`);
        if (data.token) saveToken(data.token);
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
            {/* Google Sign-In button */}
            {googleConfig.enabled && (
              <div className="mb-4 space-y-3">
                <div ref={googleButtonRef} className="flex justify-center min-h-[40px]" />
                {googleLoading && (
                  <p className="text-center text-xs text-muted-foreground">
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                    Verificando con Google…
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">o con email y contraseña</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              </div>
            )}

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
                  <p>
                    ¿Eres chofer?{" "}
                    <span className="text-muted-foreground">
                      Pídeele al dueño que te agregue desde la sección Equipo.
                    </span>
                  </p>
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
            ? googleConfig.enabled
              ? "Puedes ingresar con Google si tu email coincide con una cuenta existente."
              : "Si eres chofer, pídeele al dueño tu email y contraseña."
            : "Primera vez: crea la cuenta del dueño del camión."}
        </p>
      </div>
    </div>
  );
}
