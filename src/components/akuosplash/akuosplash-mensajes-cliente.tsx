"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, LogOut, Loader2, Send, ChevronLeft, MessageSquare } from "lucide-react";
import { akuoGet, akuoPost } from "@/components/akuosplash/akuosplash-utils";
import { toast } from "sonner";

interface Conversacion { id: string; clienteId: string; transportistaId: string; cliente: { id: string; nombre: string; }; transportista: { id: string; nombre: string; razonSocial?: string; }; mensajes?: Mensaje[]; ultimoMensajeEn: string; }
interface Mensaje { id: string; creadoEn: string; contenido: string; remitenteId: string; remitente: { id: string; nombre: string; }; }

export function AkuosplashMensajesCliente() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [convActiva, setConvActiva] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMsg, setNuevoMsg] = useState("");
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    akuoGet<{ user: any }>("/api/akuosplash/auth/me").then(d => {
      if (!d.user) { router.replace("/akuosplash"); return; }
      setUser(d.user);
    });
  }, [router]);

  useEffect(() => {
    if (!user) return;
    akuoGet<{ conversaciones: Conversacion[] }>("/api/akuosplash/mensajes").then(d => {
      setConversaciones(d.conversaciones);
    }).finally(() => setLoading(false));
  }, [user, refreshKey]);

  useEffect(() => {
    if (!convActiva) return;
    setLoadingMsgs(true);
    akuoGet<{ mensajes: Mensaje[] }>(`/api/akuosplash/mensajes?conversacionId=${convActiva}`).then(d => setMensajes(d.mensajes)).finally(() => setLoadingMsgs(false));
  }, [convActiva]);

  async function enviar() {
    if (!nuevoMsg.trim() || !convActiva) return;
    try {
      await akuoPost("/api/akuosplash/mensajes", { conversacionId: convActiva, contenido: nuevoMsg.trim() });
      setNuevoMsg("");
      const d = await akuoGet<{ mensajes: Mensaje[] }>(`/api/akuosplash/mensajes?conversacionId=${convActiva}`);
      setMensajes(d.mensajes);
      setRefreshKey(k => k + 1);
    } catch (e: any) { toast.error(e.message || "Error"); }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (convActiva) {
    const conv = conversaciones.find(c => c.id === convActiva);
    const otro = conv?.transportista;
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
          <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
            <button onClick={() => setConvActiva(null)} className="flex items-center gap-2 text-gray-600">
              <ChevronLeft className="h-4 w-4" /><span className="font-bold text-sm">Volver</span>
            </button>
            <Button variant="ghost" size="sm" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }}>
              <LogOut className="mr-1 h-4 w-4" /> Salir
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-md px-4 py-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{otro?.nombre || "Conversación"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-[60vh] space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
                {loadingMsgs ? <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" /></div> :
                mensajes.length === 0 ? <p className="text-center py-4 text-sm text-gray-400">Sin mensajes. Escribí abajo.</p> :
                mensajes.map(m => (
                  <div key={m.id} className={`flex ${m.remitenteId === user.id ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 ${m.remitenteId === user.id ? "bg-blue-600 text-white" : "bg-white border"}`}>
                      <p className="text-xs opacity-70">{m.remitente.nombre}</p>
                      <p className="text-sm whitespace-pre-wrap">{m.contenido}</p>
                      <p className="text-[10px] opacity-50 mt-0.5">{new Date(m.creadoEn).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Escribí un mensaje..." value={nuevoMsg} onChange={(e) => setNuevoMsg(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
                <Button onClick={enviar}><Send className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <Link href="/akuosplash/cliente" className="flex items-center gap-2 text-gray-600">
            <ArrowLeft className="h-4 w-4" /><span className="font-bold text-sm">Volver</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await akuoPost("/api/akuosplash/auth/logout"); router.push("/akuosplash"); }}>
            <LogOut className="mr-1 h-4 w-4" /> Salir
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mensajes</h1>
          <p className="text-sm text-gray-500">Chateá con los repartidores</p>
        </div>
        <Card>
          <CardContent className="p-0">
            {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> :
            conversaciones.length === 0 ? (
              <div className="py-8 text-center">
                <MessageSquare className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                <p className="text-gray-400">Todavía no tenés mensajes.</p>
                <p className="text-xs text-gray-400 mt-1">Cuando un repartidor acepte tu pedido vas a poder chatear con él.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {conversaciones.map(c => {
                  const otro = c.transportista;
                  const ultimo = c.mensajes?.[0];
                  return (
                    <button key={c.id} onClick={() => setConvActiva(c.id)} className="w-full text-left p-3 hover:bg-gray-50 transition">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 font-bold">{otro?.nombre?.[0] || "?"}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{otro?.nombre}</p>
                          <p className="text-sm text-gray-500 truncate whitespace-pre-wrap">{ultimo ? ultimo.contenido : "Sin mensajes"}</p>
                        </div>
                        <p className="text-xs text-gray-400">{new Date(c.ultimoMensajeEn).toLocaleDateString("es-CL")}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
