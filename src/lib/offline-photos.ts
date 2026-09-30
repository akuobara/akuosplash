// Almacenamiento offline de fotos usando IndexedDB
// Cuando el chofer toma una foto sin señal, se guarda acá.
// Sobrevive recargas de página, cierres del navegador y reinicios.
// Cuando vuelve la señal, las fotos se suben al servidor automáticamente
// o cuando el usuario hace clic en "Subir fotos pendientes".

// Estructura de cada entrada:
//   id: string (uuid) — identificador único
//   dataUrl: string — la foto en base64 (data:image/...;base64,...)
//   createdAt: Date — cuándo se guardó
//   tipo: string — "medidor" | "estanque" | "gasto" | "generico"
//   clienteId?: string — para asociar a un cliente (opcional)
//   clienteNombre?: string — para mostrar en la UI
//   metadata?: any — info adicional (ej: nombre del estanque)

const DB_NAME = "aljibe_offline_photos";
const STORE_NAME = "photos";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no está disponible en este navegador"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("tipo", "tipo", { unique: false });
      }
    };
  });
}

export interface OfflinePhoto {
  id: string;
  dataUrl: string;
  createdAt: string; // ISO
  tipo: string;
  clienteId?: string;
  clienteNombre?: string;
  estanqueNombre?: string;
  metadata?: any;
}

// Guarda una foto offline. Devuelve el ID asignado.
export async function saveOfflinePhoto(photo: Omit<OfflinePhoto, "id" | "createdAt">): Promise<string> {
  try {
    const db = await openDB();
    const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: OfflinePhoto = {
      ...photo,
      id,
      createdAt: new Date().toISOString(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(entry);
      req.onsuccess = () => resolve(id);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("saveOfflinePhoto: no se pudo guardar en IndexedDB:", e);
    return "";
  }
}

// Obtiene una foto por su ID offline (ej: para mostrarla en un <img>)
export async function getOfflinePhoto(id: string): Promise<OfflinePhoto | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("getOfflinePhoto: error:", e);
    return null;
  }
}

// Lista TODAS las fotos offline pendientes (para mostrar en UI y para sincronizar)
export async function listOfflinePhotos(): Promise<OfflinePhoto[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const result = (req.result || []) as OfflinePhoto[];
        // Ordenar por createdAt DESC (más recientes primero)
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(result);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("listOfflinePhotos: error:", e);
    return [];
  }
}

// Cuenta cuántas fotos offline hay pendientes (más liviano que getAll)
export async function countOfflinePhotos(): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return 0;
  }
}

// Borra una foto offline (después de subirla exitosamente al server)
export async function deleteOfflinePhoto(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("deleteOfflinePhoto: error:", e);
  }
}

// Borra TODAS las fotos offline (para debugging o reseteo manual)
export async function clearAllOfflinePhotos(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("clearAllOfflinePhotos: error:", e);
  }
}

// Sube UNA foto offline al servidor (/api/upload).
// Devuelve la URL pública del blob o null si falló.
async function uploadOneOfflinePhoto(dataUrl: string): Promise<string | null> {
  try {
    // Convertir data URL a Blob
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], `offline-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });

    // Subir al server usando el mismo endpoint que uploadFile
    const fd = new FormData();
    fd.append("file", file);
    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    if (!uploadRes.ok) return null;
    const data = await uploadRes.json();
    return data.url as string;
  } catch (e) {
    console.error("uploadOneOfflinePhoto: error:", e);
    return null;
  }
}

// Intenta subir TODAS las fotos offline pendientes.
// Devuelve un resumen de cuántas se subieron y cuántas fallaron.
export async function syncOfflinePhotos(): Promise<{ uploaded: number; failed: number; total: number; results: Array<{ id: string; ok: boolean; url?: string }> }> {
  const photos = await listOfflinePhotos();
  const results: Array<{ id: string; ok: boolean; url?: string }> = [];
  let uploaded = 0;
  let failed = 0;

  for (const photo of photos) {
    try {
      const url = await uploadOneOfflinePhoto(photo.dataUrl);
      if (url) {
        results.push({ id: photo.id, ok: true, url });
        uploaded++;
        // Borrar del almacenamiento offline
        await deleteOfflinePhoto(photo.id);
      } else {
        results.push({ id: photo.id, ok: false });
        failed++;
      }
    } catch (e) {
      results.push({ id: photo.id, ok: false });
      failed++;
    }
  }

  return { uploaded, failed, total: photos.length, results };
}

// Helper para generar un ID corto único (para usar como referencia en la UI)
export function generateOfflineId(): string {
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Verifica si una URL es una foto offline (data URL base64)
export function isOfflinePhotoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith("data:image/");
}

// Verifica si el navegador está online
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

// Registra un callback para cuando se recupera la conexión
export function onOnline(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}
