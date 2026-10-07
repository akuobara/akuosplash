"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AkuosplashChoferDashboard } from "@/components/akuosplash/akuosplash-chofer-dashboard";
import { AkuosplashTransportista } from "@/components/akuosplash/akuosplash-transportista";
import { akuoGet, akuoPost } from "@/components/akuosplash/akuosplash-utils";
import { Loader2, Settings, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export default function TransportistaPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(undefined);
  const [view, setView] = useState<"dashboard" | "marketplace">("dashboard");

  useEffect(() => {
    akuoGet("/api/akuosplash/auth/me").then((d: any) => {
      if (!d.user) { router.push("/akuosplash"); return; }
      if (d.user.rol !== "transportista" && d.user.rol !== "superadmin") { router.push("/akuosplash/" + d.user.rol); return; }
      setUser(d.user);
      // Si la URL tiene ?tab=disponibles, abrir marketplace
      if (typeof window !== "undefined" && window.location.search.includes("tab=disponibles")) {
        setView("marketplace");
      }
    });
  }, [router]);

  if (user === undefined) return <div className="flex min-h-screen items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  if (!user) return null;

  return (
    <div>
      {/* Switcher entre Dashboard y Marketplace */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-6xl px-4 py-1.5 flex gap-2 sm:px-6">
          <Button
            size="sm"
            variant={view === "dashboard" ? "default" : "ghost"}
            onClick={() => setView("dashboard")}
            className={view === "dashboard" ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            <Settings className="h-4 w-4 mr-1" /> Mi trabajo
          </Button>
          <Button
            size="sm"
            variant={view === "marketplace" ? "default" : "ghost"}
            onClick={() => setView("marketplace")}
            className={view === "marketplace" ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            <Store className="h-4 w-4 mr-1" /> Marketplace
          </Button>
        </div>
      </div>

      {view === "dashboard" ? (
        <AkuosplashChoferDashboard
          user={user}
          onLogout={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }}
          onGoToPerfil={() => setView("marketplace")}
          onGoToMensajes={() => setView("marketplace")}
          pedidosPendientes={[]}
        />
      ) : (
        <AkuosplashTransportista />
      )}
    </div>
  );
}
