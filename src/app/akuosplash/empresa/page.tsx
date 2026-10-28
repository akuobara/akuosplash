"use client";

import { useEffect, useState } from "react";
import { Loader2, Building2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function EmpresaPage() {
  const [empresa, setEmpresa] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/akuosplash/legal").then(r => r.json()).then(d => {
      setEmpresa(d.empresa);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="text-center mb-8">
          <Building2 className="h-10 w-10 text-blue-600 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">{empresa?.razonSocial || "Akuologistic SpA"}</h1>
          <p className="text-sm text-gray-600 mt-1">Marca: <strong>AkuoSplash</strong></p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
          {empresa?.rut && (
            <div className="flex justify-between border-b pb-2"><span className="text-gray-600 text-sm">RUT</span><span className="font-medium">{empresa.rut}</span></div>
          )}
          {empresa?.direccion && (
            <div className="flex justify-between border-b pb-2"><span className="text-gray-600 text-sm">Dirección</span><span className="font-medium">{empresa.direccion}</span></div>
          )}
          {empresa?.comuna && (
            <div className="flex justify-between border-b pb-2"><span className="text-gray-600 text-sm">Comuna</span><span className="font-medium">{empresa.comuna}</span></div>
          )}
          {empresa?.ciudad && (
            <div className="flex justify-between border-b pb-2"><span className="text-gray-600 text-sm">Ciudad</span><span className="font-medium">{empresa.ciudad}</span></div>
          )}
          {empresa?.giro && (
            <div className="flex justify-between border-b pb-2"><span className="text-gray-600 text-sm">Giro</span><span className="font-medium">{empresa.giro}</span></div>
          )}
          {empresa?.email && (
            <div className="flex justify-between border-b pb-2"><span className="text-gray-600 text-sm">Email</span><a href={`mailto:${empresa.email}`} className="text-blue-600 hover:underline">{empresa.email}</a></div>
          )}
          {empresa?.telefono && (
            <div className="flex justify-between"><span className="text-gray-600 text-sm">Teléfono</span><span className="font-medium">{empresa.telefono}</span></div>
          )}
        </div>
        <div className="flex gap-2 justify-center mt-6">
          <Link href="/akuosplash/terminos"><Button variant="ghost" size="sm">Términos y Condiciones</Button></Link>
          <Link href="/akuosplash/privacidad"><Button variant="ghost" size="sm">Política de Privacidad</Button></Link>
          <Link href="/akuosplash"><Button variant="ghost" size="sm">Volver a AkuoSplash</Button></Link>
        </div>
      </div>
    </div>
  );
}
