// Cliente fetch simple para llamar a la API interna
// Usa token en localStorage + header Authorization (más confiable que cookies en preview HTTPS)

const TOKEN_KEY = "aljibe-token";

export function saveToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

export function clearToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// Manejo de 401: limpia el token y dispara un evento para que la app reaccione
function handleUnauthorized() {
  clearToken();
  if (typeof window !== "undefined") {
    // Disparar evento personalizado que page.tsx puede escuchar
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function parseError(res: Response): Promise<string> {
  try {
    const err = await res.json();
    return err.error || err.message || `HTTP ${res.status}`;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    cache: "no-store",
    credentials: "include",
    headers: authHeaders(),
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Sesión expirada");
  }
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Sesión expirada");
  }
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Sesión expirada");
  }
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Sesión expirada");
  }
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    method: "DELETE",
    credentials: "include",
    headers: authHeaders(),
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Sesión expirada");
  }
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function uploadFile(file: File): Promise<string> {
  // Comprimir imagen antes de subir (si es una imagen)
  let fileToUpload: File = file;
  if (file.type.startsWith("image/")) {
    try {
      const { compressImageClient } = await import("./image-compress");
      fileToUpload = await compressImageClient(file);
    } catch (e) {
      // Si falla la compresión, subir el original
      console.warn("No se pudo comprimir la imagen, subiendo original:", e);
    }
  }

  // En zonas rurales con señal débil, el multipart upload (que es grande) suele fallar
  // con "Failed to fetch" antes de que el request llegue al server (timeout del browser).
  // El fallback a base64 del lado del server (/api/upload) NO se ejecuta en ese caso.
  // Por eso hacemos el fallback acá, en el cliente: si el fetch falla por red,
  // convertimos la imagen comprimida a base64 en el browser y devolvemos ese data URL.
  // Esto funciona incluso con señal muy mala, porque no hay un body grande que subir.

  const fd = new FormData();
  fd.append("file", fileToUpload);
  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: fd,
      credentials: "include",
      headers: authHeaders(),
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error("Sesión expirada");
    }
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json();
    return data.url as string;
  } catch (fetchError: any) {
    // "Failed to fetch" (TypeError) o cualquier error de red → fallback client-side a base64.
    // Esto evita que el usuario pierda la foto cuando tiene mala señal.
    const esErrorDeRed =
      fetchError?.name === "TypeError" ||
      fetchError?.message?.includes("Failed to fetch") ||
      fetchError?.message?.includes("NetworkError") ||
      fetchError?.message?.includes("network") ||
      fetchError?.message?.includes("Load failed");

    if (!esErrorDeRed) {
      // No es un error de red — propagate el error original
      throw fetchError;
    }

    console.warn("uploadFile: error de red, usando fallback a base64 client-side:", fetchError?.message);

    // Re-comprimir más agresivamente para asegurar que quepa como base64 (máx ~1MB final)
    let archivoFinal = fileToUpload;
    try {
      const { compressImageClient } = await import("./image-compress");
      // Segunda pasada con calidad más baja si la primera compresión sigue pesada
      if (fileToUpload.size > 800 * 1024) {
        archivoFinal = await compressImageClient(fileToUpload, { maxSize: 600, quality: 0.5 });
      }
    } catch (e) {
      console.warn("Re-compresión falló, usando la versión anterior:", e);
    }

    // Convertir a base64 en el navegador
    const dataUrl = await fileToBase64DataUrl(archivoFinal);
    console.info(`uploadFile: usando data URL base64 (${(dataUrl.length / 1024).toFixed(0)} KB) — no requiere upload de red`);
    return dataUrl;
  }
}

// Convierte un File/Blob a un data URL base64 (todo en el browser, sin red)
function fileToBase64DataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("No se pudo leer el archivo como data URL"));
      }
    };
    reader.onerror = () => reject(new Error("FileReader falló"));
    reader.readAsDataURL(file);
  });
}
