"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Droplets, LogOut } from "lucide-react";
import { akuoGet, akuoPost } from "@/components/akuosplash/akuosplash-utils";
import Link from "next/link";

export default function TransportistaPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(undefined);

  useEffect(() => {
    akuoGet<{ user: any }>("/api/akuosplash/auth/me").then((d) => {
      if (!d.user) { window.location.href = "/akuosplash"; return; }
      if (d.user.rol !== "transportista" && d.user.rol !== "superadmin") {
        window.location.href = "/akuosplash/" + d.user.rol;
        return;
      }
      setUser(d.user);
    });
  }, []);

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white animate-pulse">
          <Droplets className="h-9 w-9" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/akuosplash/logo.png" alt="AkuoSplash" className="h-8 w-auto" />
            <div className="hidden sm:block">
              <p className="font-bold text-blue-600">AkuoSplash</p>
              <p className="-mt-1 text-xs text-gray-400">Repartidor · {user.nombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user.rol === "superadmin" && (
              <Link href="/akuosplash/superadmin" className="text-xs text-violet-600 hover:underline">
                Volver a admin
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); window.location.href = "/akuosplash"; }}>
              <LogOut className="h-4 w-4" /> Salir
            </Button>
          </div>
        </div>
      </header>

      {user.rol === "superadmin" && (
        <Link href="/akuosplash/superadmin" className="block bg-violet-600 text-white text-xs py-1.5 text-center font-medium hover:bg-violet-700">
          Estás viendo como repartidor (modo superadmin) — Volver al panel
        </Link>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">Hola, {user.nombre}</h1>
            <p className="text-sm text-gray-500">Panel del repartidor — copia del dashboard de Aljibe</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-700">
              Los componentes del dashboard de Aljibe fueron copiados a <code className="bg-blue-100 px-1 rounded">src/components/akuosplash/</code> con las sustituciones de marca, BD y auth.
              Los endpoints necesarios están en <code className="bg-blue-100 px-1 rounded">/api/akuosplash/</code>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
