// Sistema de auditoría — registra acciones importantes en la DB.
// Uso:
//   import { registrarAudit } from "@/lib/audit";
//   await registrarAudit({
//     accion: "crear",
//     entidad: "camion",
//     entidadId: camion.id,
//     entidadNombre: camion.nombre,
//     descripcion: `Creó camión "${camion.nombre}"`,
//   });
//
// El actor (quién hizo la acción) se obtiene automáticamente de la sesión.
// Para acciones del sistema (cron, webhooks), pasar actorRole: "sistema".

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export interface AuditInput {
  accion: string; // crear | actualizar | eliminar | activar | desactivar | cerrar_periodo | login | logout | etc.
  entidad: string; // usuario | camion | cliente | entrega | vuelta | gasto | pago | configuracion | zona | plan | factura | etc.
  entidadId?: string;
  entidadNombre?: string;
  descripcion: string;
  duenoId?: string; // admin dueño del recurso afectado (si aplica)
  detalleJson?: any; // objeto con datos antes/después, metadatos, etc.
}

export async function registrarAudit(input: AuditInput, req?: NextRequest): Promise<void> {
  try {
    const session = await getSession();

    // Obtener IP y User-Agent si hay request
    const ip = req?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || req?.headers?.get("x-real-ip") || null;
    const userAgent = req?.headers?.get("user-agent") || null;

    await db.auditLog.create({
      data: {
        actorId: session?.userId ?? null,
        actorNombre: session?.nombre ?? "Sistema",
        actorRole: session?.role ?? "sistema",
        actorEmail: session?.email ?? null,
        accion: input.accion,
        entidad: input.entidad,
        entidadId: input.entidadId ?? null,
        entidadNombre: input.entidadNombre ?? null,
        duenoId: input.duenoId ?? null,
        descripcion: input.descripcion,
        detalleJson: input.detalleJson ? JSON.stringify(input.detalleJson) : null,
        ip,
        userAgent,
      },
    });
  } catch (err) {
    // La auditoría NUNCA debe romper la operación principal.
    // Si falla, loggear en consola y continuar.
    console.error("[audit] Error al registrar acción:", err);
  }
}

// Variante para acciones del sistema (cron, webhooks, etc.) — sin sesión.
export async function registrarAuditSistema(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: null,
        actorNombre: "Sistema",
        actorRole: "sistema",
        actorEmail: null,
        accion: input.accion,
        entidad: input.entidad,
        entidadId: input.entidadId ?? null,
        entidadNombre: input.entidadNombre ?? null,
        duenoId: input.duenoId ?? null,
        descripcion: input.descripcion,
        detalleJson: input.detalleJson ? JSON.stringify(input.detalleJson) : null,
        ip: null,
        userAgent: null,
      },
    });
  } catch (err) {
    console.error("[audit] Error al registrar acción del sistema:", err);
  }
}
