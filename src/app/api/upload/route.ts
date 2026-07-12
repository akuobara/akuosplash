import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

// POST /api/upload
// Sube un archivo (foto del medidor, foto de gasto, etc.) al directorio public/uploads.
// Retorna la URL pública del archivo.
// Limitado a imágenes (image/*) de hasta 10MB.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    // Validar tipo
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Solo se permiten imágenes" }, { status: 400 });
    }

    // Validar tamaño (10MB máximo)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "La imagen no puede superar 10MB" }, { status: 400 });
    }

    // Generar nombre único
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const allowedExts = ["jpg", "jpeg", "png", "gif", "webp", "heic"];
    const safeExt = allowedExts.includes(ext) ? ext : "jpg";
    const fileName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${safeExt}`;

    // Asegurar que el directorio existe
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Escribir el archivo
    const filePath = path.join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Retornar URL pública
    const url = `/uploads/${fileName}`;
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Error en upload:", err);
    return NextResponse.json({ error: "No se pudo subir el archivo" }, { status: 500 });
  }
}
