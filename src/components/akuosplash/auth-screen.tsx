"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, Loader2, LogIn, UserPlus, Eye, EyeOff, KeyRound, ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { saveToken } from "@/components/akuosplash/akuosplash-api-client";

export interface SessionUser {
  userId: string;
  email: string;
  nombre: string;
  role: "dueno" | "chofer" | "super_admin";
  transportistaId: string | null;
  isDemo?: boolean;
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

type Screen = "login" | "register" | "recuperar" | "reset";

export function AuthScreen({ hasUsers, onAuthSuccess }: AuthScreenProps) {
  const [screen, setScreen] = useState<Screen>(hasUsers ? "login" : "register");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Tipo de cuenta al registrarse (solo si ya hay usuarios)
  const [registerRole, setRegisterRole] = useState<"dueno" | "chofer">("dueno");

  // Recuperación
  const [recoveryToken, setRecoveryToken] = useState("");
  const [recoveryUserId, setRecoveryUserId] = useState("");
  const [recoveryUserName, setRecoveryUserName] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [googleConfig, setGoogleConfig] = useState<{ enabled: boolean; clientId: string | null }>({
    enabled: false,
    clientId: null,
  });
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleScriptLoaded = useRef(false);

  // Cargar configuración pública
  useEffect(() => {
    fetch("/api/akuosplash/config/public")
      .then((r) => r.json())
      .then((data) => {
        setGoogleConfig({
          enabled: !!data.googleLoginEnabled,
          clientId: data.googleClientId,
        });
      })
      .catch(() => {});
  }, []);

  // Cargar script de Google
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

  const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
    setGoogleLoading(true);
    try {
      const res = await fetch("/api/akuosplash/auth/google", {
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

  useEffect(() => {
    if (!googleConfig.enabled || !googleConfig.clientId) return;
    if (!googleButtonRef.current) return;
    if (typeof window.google === "undefined") {
      const timer = setTimeout(() => {
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

  // Validación de contraseña
  function passwordStrength(pwd: string): { score: number; label: string; color: string } {
    let score = 0;
    if (pwd.length >= 4) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { score, label: "Muy débil", color: "bg-red-500" };
    if (score === 2) return { score, label: "Débil", color: "bg-orange-500" };
    if (score === 3) return { score, label: "Aceptable", color: "bg-yellow-500" };
    if (score === 4) return { score, label: "Buena", color: "bg-emerald-500" };
    return { score, label: "Excelente", color: "bg-emerald-600" };
  }

  const strength = passwordStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (screen === "register") {
        if (!nombre.trim() || !password || (!email.trim() && !telefono.trim())) {
          toast.error("Completa nombre, contraseña y email o teléfono");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          toast.error("Las contraseñas no coinciden");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/akuosplash/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, email, password, telefono, role: registerRole }),
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "No se pudo registrar");
          setLoading(false);
          return;
        }
        toast.success(`¡Bienvenido, ${data.user.nombre}! Tu cuenta de administrador está lista.`);
        if (data.token) saveToken(data.token);
        onAuthSuccess(data.user);
      } else if (screen === "login") {
        if (!email.trim() || !password) {
          toast.error("Ingresa tu email o teléfono y contraseña");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/akuosplash/auth/login", {
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
        if (data.user.role === "super_admin") {
          window.location.href = "/super-admin";
          return;
        }
        onAuthSuccess(data.user);
      } else if (screen === "recuperar") {
        if (!email.trim()) {
          toast.error("Ingresa tu email");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/akuosplash/auth/recuperar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "No se pudo procesar");
          setLoading(false);
          return;
        }
        if (data.token) {
          // El email existe — mostrar pantalla de reset
          setRecoveryToken(data.token);
          setRecoveryUserId(data.userId);
          setRecoveryUserName(data.userName);
          setScreen("reset");
          toast.info(`Código generado: ${data.token}`);
        } else {
          toast.info("Si el email existe, se ha enviado un código de recuperación.");
        }
      } else if (screen === "reset") {
        if (!newPassword) {
          toast.error("Ingresa tu nueva contraseña");
          setLoading(false);
          return;
        }
        if (newPassword.length < 4) {
          toast.error("La contraseña debe tener al menos 4 caracteres");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/akuosplash/auth/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: recoveryUserId, token: recoveryToken, newPassword }),
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || "No se pudo cambiar");
          setLoading(false);
          return;
        }
        toast.success("Contraseña cambiada. Ahora puedes iniciar sesión.");
        setScreen("login");
        setPassword("");
        setNewPassword("");
        setRecoveryToken("");
        setRecoveryUserId("");
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
            <h1 className="text-2xl font-bold">AkuoSplash</h1>
            <p className="text-sm text-muted-foreground">Registro de entregas de agua</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {screen === "register" && (hasUsers ? "Crear cuenta" : "Crear cuenta de administrador")}
              {screen === "login" && "Iniciar sesión"}
              {screen === "recuperar" && "Recuperar contraseña"}
              {screen === "reset" && `Nueva contraseña${recoveryUserName ? ` — ${recoveryUserName}` : ""}`}
            </CardTitle>
            {!hasUsers && screen === "register" && (
              <p className="text-center text-sm text-muted-foreground">
                Esta será la primera cuenta y se creará como <strong>administrador</strong>. Podrás agregar choferes después.
              </p>
            )}
          </CardHeader>
          <CardContent>
            {/* Google Sign-In (solo login y register) */}
            {(screen === "login" || screen === "register") && googleConfig.enabled && (
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
              {/* Registro: tipo de cuenta (solo si ya hay usuarios — primer usuario siempre es administrador) */}
              {screen === "register" && hasUsers && (
                <div className="space-y-2">
                  <Label>Tipo de cuenta</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegisterRole("dueno")}
                      className={`rounded-lg border-2 p-3 text-left transition ${
                        registerRole === "dueno"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="text-sm font-medium">Administrador</p>
                      <p className="text-[10px] text-muted-foreground">Gestiona camiones, choferes y clientes</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterRole("chofer")}
                      className={`rounded-lg border-2 p-3 text-left transition ${
                        registerRole === "chofer"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="text-sm font-medium">Chofer</p>
                      <p className="text-[10px] text-muted-foreground">Entrega agua en ruta</p>
                    </button>
                  </div>
                  {registerRole === "chofer" && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      Tu cuenta deberá ser aprobada por un administrador antes de poder usar la app.
                    </p>
                  )}
                </div>
              )}

              {/* Registro: nombre */}
              {screen === "register" && (
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

              {/* Email (login, register, recuperar) */}
              {screen !== "reset" && (
                <div className="space-y-2">
                  <Label htmlFor="email">
                    {screen === "login" ? "Email o teléfono" : screen === "register" ? "Email (opcional)" : "Email"}
                  </Label>
                  <Input
                    id="email"
                    type={screen === "login" ? "text" : "email"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={screen === "login" ? "tu@email.com o +56912345678" : "tu@email.com (opcional si das teléfono)"}
                    required={screen === "login" || screen === "recuperar"}
                    disabled={screen === "recuperar" && !!recoveryToken}
                  />
                </div>
              )}

              {/* Contraseña (login, register) */}
              {(screen === "login" || screen === "register") && (
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Indicador de fortaleza (solo registro) */}
                  {screen === "register" && password.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-all ${
                              i <= strength.score ? strength.color : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Fortaleza: <span className="font-medium">{strength.label}</span>
                      </p>
                      {/* Checklist */}
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <span className={`flex items-center gap-1 ${password.length >= 8 ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {password.length >= 8 ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} Mínimo 8 caracteres
                        </span>
                        <span className={`flex items-center gap-1 ${/[A-Z]/.test(password) ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {/[A-Z]/.test(password) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} Mayúscula
                        </span>
                        <span className={`flex items-center gap-1 ${/[0-9]/.test(password) ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {/[0-9]/.test(password) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} Número
                        </span>
                        <span className={`flex items-center gap-1 ${/[^A-Za-z0-9]/.test(password) ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {/[^A-Za-z0-9]/.test(password) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} Símbolo
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Confirmar contraseña (registro) */}
              {screen === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••"
                      required
                    />
                    {confirmPassword.length > 0 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2">
                        {password === confirmPassword ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Teléfono (registro) */}
              {screen === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+56 9 1234 5678 (obligatorio si no das email)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Puedes registrarte con email o teléfono. Al menos uno es obligatorio.
                  </p>
                </div>
              )}

              {/* Reset: mostrar código y nueva contraseña */}
              {screen === "reset" && (
                <>
                  <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm dark:border-blue-800 dark:bg-blue-900/20">
                    <p className="font-medium text-blue-900 dark:text-blue-200">Código de recuperación:</p>
                    <p className="text-2xl font-bold tracking-widest text-blue-700 dark:text-blue-300">{recoveryToken}</p>
                    <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                      Si el código no es correcto, vuelve atrás y solicita uno nuevo.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nueva contraseña</Label>
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••"
                      required
                    />
                  </div>
                </>
              )}

              {/* Botón principal */}
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : screen === "register" ? (
                  <UserPlus className="mr-2 h-4 w-4" />
                ) : screen === "recuperar" ? (
                  <KeyRound className="mr-2 h-4 w-4" />
                ) : screen === "reset" ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                {screen === "register" && "Crear cuenta"}
                {screen === "login" && "Iniciar sesión"}
                {screen === "recuperar" && "Generar código"}
                {screen === "reset" && "Cambiar contraseña"}
              </Button>
            </form>

            {/* Links entre pantallas */}
            <div className="mt-4 space-y-2 text-center text-sm text-muted-foreground">
              {/* Login: link a recuperar */}
              {screen === "login" && (
                <button
                  type="button"
                  onClick={() => { setScreen("recuperar"); setPassword(""); }}
                  className="block w-full font-medium text-primary hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}

              {/* Recuperar: volver atrás */}
              {screen === "recuperar" && (
                <button
                  type="button"
                  onClick={() => setScreen("login")}
                  className="flex items-center justify-center gap-1 font-medium text-primary hover:underline"
                >
                  <ArrowLeft className="h-3 w-3" /> Volver a iniciar sesión
                </button>
              )}

              {/* Reset: volver atrás */}
              {screen === "reset" && (
                <button
                  type="button"
                  onClick={() => { setScreen("login"); setRecoveryToken(""); setRecoveryUserId(""); setNewPassword(""); }}
                  className="flex items-center justify-center gap-1 font-medium text-primary hover:underline"
                >
                  <ArrowLeft className="h-3 w-3" /> Volver a iniciar sesión
                </button>
              )}

              {/* Login: link a registrar */}
              {screen === "login" && hasUsers && (
                <button
                  type="button"
                  onClick={() => { setScreen("register"); setPassword(""); }}
                  className="block w-full font-medium text-primary hover:underline"
                >
                  ¿No tienes cuenta? Regístrate
                </button>
              )}

              {/* Register: volver a login */}
              {screen === "register" && hasUsers && (
                <>
                  ¿Ya tienes cuenta?{" "}
                  <button
                    type="button"
                    onClick={() => setScreen("login")}
                    className="font-medium text-primary hover:underline"
                  >
                    Inicia sesión
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {hasUsers
            ? googleConfig.enabled
              ? "Puedes ingresar con Google si tu email coincide con una cuenta existente."
              : "Si eres chofer, pídeele al administrador tu email y contraseña."
            : "Primera vez: crea la cuenta del administrador."}
        </p>
      </div>
    </div>
  );
}
