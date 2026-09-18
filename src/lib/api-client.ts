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

  const fd = new FormData();
  fd.append("file", fileToUpload);
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
}
