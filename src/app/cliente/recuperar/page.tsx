"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function RecuperarPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Ingresá tu email");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/cliente/auth/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo procesar");
      setEnviado(true);
      toast.success("Si el email existe, vas a recibir instrucciones");
    } catch (e) {
      // Por seguridad, no revelar si el email existe o no
      setEnviado(true);
      toast.success("Si el email existe, vas a recibir instrucciones");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center gap-2">
          <Link href="/cliente/login" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <div className="rounded-full bg-primary/10 p-1.5">
              <Droplets className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-sm">Aljibe · Cliente</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ingresá tu email y te enviaremos instrucciones
            </p>
          </div>

          {enviado ? (
            <Card>
              <CardContent className="p-6 text-center space-y-3">
                <p className="text-sm">
                  Si el email <strong>{email}</strong> está registrado, vas a recibir un correo con instrucciones para restablecer tu contraseña.
                </p>
                <Button onClick={() => router.push("/cliente/login")} className="w-full">
                  Volver al login
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4 space-y-3">
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Enviando…" : "Enviar instrucciones"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <p className="text-center text-sm text-muted-foreground">
            ¿No necesitás recuperar?{" "}
            <Link href="/cliente/login" className="text-primary font-medium hover:underline">
              Volver al login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
