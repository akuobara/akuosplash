// API client para AkuoSplash — misma interfaz que @/lib/api-client de Aljibe
// pero usa cookies de AkuoSplash (akuoosplash_session)

interface UploadResult {
  url: string;
  uploadedToServer: boolean;
}

export async function akuoApiInternal<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status, data });
  return data as T;
}

export const apiGet = <T = any>(p: string) => akuoApiInternal<T>(p, { method: "GET" });
export const apiPost = <T = any>(p: string, body?: any) => akuoApiInternal<T>(p, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });
export const apiPatch = <T = any>(p: string, body?: any) => akuoApiInternal<T>(p, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined });
export const apiPut = <T = any>(p: string, body?: any) => akuoApiInternal<T>(p, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined });
export const apiDelete = <T = any>(p: string) => akuoApiInternal<T>(p, { method: "DELETE" });

// saveToken — en Aljibe guarda el JWT en localStorage
// En AkuoSplash la auth es por cookie, así que esto es un no-op
export function saveToken(token: string) {
  // No-op: AkuoSplash usa cookies httpOnly
}

// clearToken — en Aljibe limpia el JWT del localStorage
// En AkuoSplash la auth es por cookie, así que esto redirige al login
export function clearToken() {
  if (typeof window !== "undefined") {
    window.location.href = "/akuosplash";
  }
}

// Upload de archivos con fallback a base64 (igual que Aljibe)
export async function uploadFile(file: File, opts?: { tipo?: string; clienteId?: string; clienteNombre?: string; estanqueNombre?: string }): Promise<UploadResult> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (opts?.tipo) formData.append("tipo", opts.tipo);
    if (opts?.clienteId) formData.append("clienteId", opts.clienteId);
    if (opts?.clienteNombre) formData.append("clienteNombre", opts.clienteNombre);
    if (opts?.estanqueNombre) formData.append("estanqueNombre", opts.estanqueNombre);
    const res = await fetch("/api/akuosplash/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    const data = await res.json();
    if (data.url) return { url: data.url, uploadedToServer: true };
    throw new Error(data.error || "Upload failed");
  } catch (e) {
    // Fallback: base64 client-side
    return new Promise<UploadResult>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ url: reader.result as string, uploadedToServer: false });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
