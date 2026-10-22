import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "La imagen no puede superar 10MB" }, { status: 413 });
    const allowed = ["image/jpeg","image/jpg","image/png","image/webp","image/heic","image/heif","image/gif"];
    if (!allowed.includes(file.type.toLowerCase())) return NextResponse.json({ error: `Tipo no soportado: ${file.type}` }, { status: 415 });
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg","jpeg","png","webp","heic","heif","gif"].includes(ext) ? ext : "jpg";
    const filename = `uploads/${session.userId}/${Date.now()}-${Math.random().toString(36).slice(2,10)}.${safeExt}`;
    const blob = await put(filename, file, { access: "public", addRandomSuffix: false, contentType: file.type || `image/${safeExt}` });
    return NextResponse.json({ url: blob.url, uploadedToServer: true, pathname: blob.pathname });
  } catch (err: any) {
    console.error("[upload] error:", err);
    return NextResponse.json({ error: err?.message || "No se pudo subir el archivo" }, { status: 500 });
  }
}
export async function GET() { return NextResponse.json({ ok: true, endpoint: "/api/upload", method: "POST" }); }
