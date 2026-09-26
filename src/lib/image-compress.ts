// src/lib/image-compress.ts
// Compresión automática de imágenes en el navegador antes de subir.
// Reduce fotos de hasta 10 MB a ~200 KB (para thumbnails de medidor/comprobantes).
// Usa la librería browser-image-compression.

import imageCompression from "browser-image-compression";

interface CompressOptions {
  maxSize?: number; // KB — tamaño máximo objetivo (default 300)
  quality?: number; // 0-1 — calidad JPEG inicial (default 0.7)
  maxWidthOrHeight?: number; // px — default 1600
}

export async function compressImageClient(file: File, opts?: CompressOptions): Promise<File> {
  // Si ya es chiquita (< 500 KB), no comprimir (salvo que se especifique maxSize menor)
  const maxSizeKB = opts?.maxSize ?? 300;
  if (file.size < 500 * 1024 && !opts) {
    return file;
  }

  const options = {
    maxSizeMB: maxSizeKB / 1024,         // objetivo
    maxWidthOrHeight: opts?.maxWidthOrHeight ?? 1600, // máximo 1600 px de ancho o alto
    useWebWorker: true,     // no bloquea el hilo principal
    fileType: "image/jpeg", // convertir a JPEG (más eficiente que PNG)
    initialQuality: opts?.quality ?? 0.7,    // calidad 70% — buena relación tamaño/calidad
  };

  try {
    const compressed = await imageCompression(file, options);
    // Si por alguna razón sale más grande que el original, devolver el original
    if (compressed.size >= file.size) {
      return file;
    }
    // Renombrar a .jpg si cambió el tipo
    if (file.type !== "image/jpeg" && compressed.type === "image/jpeg") {
      const newName = file.name.replace(/\.[^.]+$/, ".jpg") || "foto.jpg";
      return new File([compressed], newName, { type: "image/jpeg" });
    }
    return compressed as File;
  } catch (e) {
    console.warn("compressImageClient: error, devolviendo original:", e);
    return file;
  }
}
