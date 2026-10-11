"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AkuosplashCliente } from "@/components/akuosplash/akuosplash-cliente";
import { akuoGet } from "@/components/akuosplash/akuosplash-utils";
export const dynamic = "force-dynamic";

function ClientePageInner() {
  const searchParams = useSearchParams();
  const incompleto = searchParams.get("incompleto");
  const [checking, setChecking] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);

  useEffect(() => {
    // Si ya viene con ?incompleto=1, redirigir directo
    if (incompleto === "1") {
      window.location.href = "/akuosplash/cliente/perfil?incompleto=1";
      return;
    }
    // Sino, verificar si el perfil está completo
    akuoGet<{ user: any }>("/api/akuosplash/auth/me").then((d) => {
      if (d.user?.perfilIncompleto) {
        setNeedsProfile(true);
        window.location.href = "/akuosplash/cliente/perfil?incompleto=1";
      }
      setChecking(false);
    }).catch(() => setChecking(false));
  }, [incompleto]);

  if (checking || needsProfile) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>;
  }

  return <AkuosplashCliente />;
}

export default function ClientePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>}>
      <ClientePageInner />
    </Suspense>
  );
}
