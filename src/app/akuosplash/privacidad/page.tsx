"use client";

import { useEffect, useState } from "react";
import { Loader2, Shield, Download, Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PrivacidadPage() {
  const [content, setContent] = useState<string>("");
  const [version, setVersion] = useState("1.0");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/akuosplash/legal").then(r => r.json()).then(d => {
      if (d.privacidad) {
        setContent(d.privacidad.content || "");
        setVersion(d.privacidad.version || "1.0");
        setLastUpdated(d.privacidad.lastUpdated);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  const hoy = lastUpdated ? new Date(lastUpdated).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8 print:max-w-none">
        <div className="text-center mb-8">
          <Shield className="h-10 w-10 text-blue-600 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">Política de Privacidad de AkuoSplash</h1>
          <p className="text-sm text-gray-600 mt-1">
            Operado por <strong>Akuologistic SpA</strong> {hoy && `· Actualizada: ${hoy}`} · Versión {version}
          </p>
        </div>
        <div className="flex gap-2 justify-center mb-6 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}><Download className="h-4 w-4 mr-1" /> PDF</Button>
          <Link href="/akuosplash"><Button variant="ghost" size="sm">Volver a AkuoSplash</Button></Link>
        </div>
        {content ? (
          <div className="prose prose-sm max-w-none print:prose-lg" dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <p className="text-sm text-amber-800">El contenido de esta página aún no ha sido publicado. El administrador puede editarlo desde el panel de superadmin → 📄 Páginas Legales → Privacidad.</p>
          </div>
        )}
      </div>
    </div>
  );
}
