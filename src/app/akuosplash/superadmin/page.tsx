"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { akuoGet, akuoPost } from "@/components/akuosplash/akuosplash-utils";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
export const dynamic = "force-dynamic";
export default function SuperadminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(undefined);
  useEffect(() => {
    akuoGet("/api/akuosplash/auth/me").then((d: any) => {
      if (!d.user) { router.push("/akuosplash"); return; }
      if (d.user.rol !== "superadmin" && d.user.rol !== "superadmin") { router.push("/akuosplash/" + d.user.rol); return; }
      setUser(d.user);
    });
  }, [router]);
  if (user === undefined) return <div className="flex min-h-screen items-center justify-center bg-blue-50"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  if (!user) return null;
  return (
    <div className="min-h-screen bg-blue-50">
      <header className="border-b-2 border-blue-200 bg-blue-600 text-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><div className="flex items-center gap-2"><img src="/akuosplash/logo.png" alt="AkuoSplash" className="h-8 w-auto" /><span className="font-bold">Superadmin</span></div><Button variant="outline" size="sm" className="border-white text-white hover:bg-blue-700" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }}>Salir</Button></div></header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-bold text-blue-900">¡Hola, {user.nombre}!</h1>
        <p className="text-blue-600">Panel de superadmin</p>
        <div className="mt-4 rounded-lg border border-blue-200 bg-white p-4"><p className="text-sm text-blue-700">Email: {user.email}</p><p className="text-sm text-blue-700">Plan: {user.plan}</p><p className="text-sm text-blue-700">Rol: {user.rol}</p></div>
      </main>
    </div>
  );
}
