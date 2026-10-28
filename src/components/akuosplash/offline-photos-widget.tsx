"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CloudOff, Cloud, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  listOfflinePhotos,
  syncOfflinePhotos,
  countOfflinePhotos,
  deleteOfflinePhoto,
  onOnline,
  isOnline,
  type OfflinePhoto,
} from "@/lib/akuosplash-offline-photos";

export function OfflinePhotosWidget() {
  const [count, setCount] = useState(0);
  const [photos, setPhotos] = useState<OfflinePhoto[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Cargar count + lista
  const refresh = async () => {
    const c = await countOfflinePhotos();
    setCount(c);
    if (c > 0) {
      const list = await listOfflinePhotos();
      setPhotos(list);
    } else {
      setPhotos([]);
    }
  };

  useEffect(() => {
    refresh();
    // Cada 30s revisar si hay nuevas fotos offline
    const interval = setInterval(refresh, 30000);
    // Cuando vuelve la conexión, intentar sincronizar automáticamente
    const offHandler = onOnline(async () => {
      toast.info("Conexión restablecida. Sincronizando fotos pendientes...");
      await doSync();
    });
    return () => {
      clearInterval(interval);
      offHandler();
    };
  }, []);

  // Sincronizar manualmente o automáticamente
  async function doSync() {
    setSyncing(true);
    try {
      const result = await syncOfflinePhotos();
      if (result.total === 0) {
        toast.info("No hay fotos pendientes para subir");
      } else if (result.failed === 0) {
        toast.success(`✓ ${result.uploaded} foto(s) subida(s) correctamente`);
      } else {
        toast.warning(`${result.uploaded} subidas, ${result.failed} fallaron (probá de nuevo más tarde)`);
      }
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Error al sincronizar fotos");
    } finally {
      setSyncing(false);
    }
  }

  // Borrar una foto offline sin subirla (si el usuario se equivocó)
  async function borrar(id: string) {
    await deleteOfflinePhoto(id);
    await refresh();
    toast.success("Foto borrada del almacenamiento offline");
  }

  // Si no hay fotos offline, no mostrar nada
  if (count === 0) return null;

  return (
    <Card className="border-2 border-amber-400 bg-amber-50 dark:bg-amber-900/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200">
            <CloudOff className="h-4 w-4" />
            {count} foto{count !== 1 ? "s" : ""} pendiente{count !== 1 ? "s" : ""} de subir
          </CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500 text-amber-700 hover:bg-amber-100"
              disabled={syncing || !isOnline()}
              onClick={() => doSync()}
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Cloud className="h-3.5 w-3.5 mr-1" />}
              {isOnline() ? "Subir ahora" : "Sin conexión"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-amber-700"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Ocultar" : "Ver"}
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && photos.length > 0 && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {photos.slice(0, 12).map((photo) => (
              <div key={photo.id} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.dataUrl}
                  alt="Foto offline"
                  className="aspect-square w-full rounded-lg border border-amber-300 object-cover"
                />
                <button
                  type="button"
                  onClick={() => borrar(photo.id)}
                  className="absolute -right-1 -top-1 hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
                  title="Borrar foto"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black/60 px-1 py-0.5 text-[9px] text-white">
                  {photo.clienteNombre || photo.estanqueNombre || photo.tipo}
                </div>
              </div>
            ))}
          </div>
          {photos.length > 12 && (
            <p className="mt-2 text-center text-xs text-amber-700">
              ... y {photos.length - 12} foto(s) más
            </p>
          )}
        </CardContent>
      )}
      {!expanded && (
        <CardContent className="pt-0">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Se guardaron en tu dispositivo cuando no tenías señal. Se subirán automáticamente cuando vuelva la conexión.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
