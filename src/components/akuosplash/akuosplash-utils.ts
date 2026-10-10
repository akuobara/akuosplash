export function formatCLP(monto: number | null | undefined): string {
  if (!monto && monto !== 0) return "$—";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(monto);
}
export async function akuoApi<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) }, credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status, data });
  return data as T;
}
export const akuoGet = <T = any>(p: string) => akuoApi<T>(p, { method: "GET" });
export const akuoPost = <T = any>(p: string, body?: any) => akuoApi<T>(p, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });
export const akuoPut = <T = any>(p: string, body?: any) => akuoApi<T>(p, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined });
export const akuoDelete = <T = any>(p: string) => akuoApi<T>(p, { method: "DELETE" });
