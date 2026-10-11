import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calcularProximaFechaConDiaPreferido } from "@/lib/helpers";

// GET /api/cron/generar-recurrentes
// Cron job que genera pedidos a partir de pedidos recurrentes vencidos
// Se puede llamar con Vercel Cron (configurar en vercel.json) o manualmente
// Protegido con CRON_SECRET para que solo Vercel (o el admin) pueda llamarlo
export async function GET(req: NextRequest) {
  // Verificar secret (opcional, para que no cualquiera lo llame)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const ahora = new Date();

    // Buscar todos los pedidos recurrentes activos vencidos
    const recurrentes = await db.pedidoRecurrente.findMany({
      where: {
        activo: true,
        fechaProximaGeneracion: { lte: ahora },
      },
      include: { cliente: true },
    });

    let generados = 0;

    for (const rec of recurrentes) {
      // Dedup: buscar CUALQUIER pedido existente para este recurrente con la misma fechaSolicitada.
      // Sin importar el estado (incluso entregado/cancelado) — si ya fue creado para esa fecha,
      // no crear otro. Solo avanzar fechaProximaGeneracion.
      // Esto evita el bug de doble avance cuando el cron y el inline en /api/pedidos corren el mismo día.
      const existente = await db.pedido.findFirst({
        where: {
          pedidoRecurrenteId: rec.id,
          fechaSolicitada: rec.fechaProximaGeneracion,
        },
      });
      if (existente) {
        // Avanzar fechaProximaGeneracion a la próxima fecha
        const proxima = calcularProximaFechaConDiaPreferido(
          rec.fechaProximaGeneracion,
          rec.frecuenciaDias,
          rec.diaSemanaPreferido
        );
        await db.pedidoRecurrente.update({
          where: { id: rec.id },
          data: { fechaProximaGeneracion: proxima },
        });
        continue;
      }

      // Crear el pedido
      await db.pedido.create({
        data: {
          clienteNombre: rec.cliente.nombre,
          clienteDireccion: rec.cliente.direccion,
          clienteTelefono: rec.cliente.telefono,
          clienteZona: rec.cliente.zona,
          clienteLat: rec.cliente.lat,
          clienteLng: rec.cliente.lng,
          clienteId: rec.clienteId,
          litrosSolicitados: rec.litrosSolicitados,
          fechaSolicitada: rec.fechaProximaGeneracion,
          metodoPagoPreferido: rec.metodoPagoPreferido,
          nota: rec.nota,
          estado: "pendiente",
          choferId: rec.choferAsignadoId || rec.duenoId,
          duenoId: rec.duenoId,
          asignacionTipo: rec.asignacionTipo,
          choferAsignadoId: rec.choferAsignadoId,
          prioridadTipo: "ninguna",
          publicadoEn: rec.asignacionTipo === "publicado" ? ahora : null,
          pedidoRecurrenteId: rec.id,
        },
      });

      // Actualizar próxima generación — respeta diaSemanaPreferido si está seteado
      const proxima = calcularProximaFechaConDiaPreferido(
        rec.fechaProximaGeneracion,
        rec.frecuenciaDias,
        rec.diaSemanaPreferido
      );
      await db.pedidoRecurrente.update({
        where: { id: rec.id },
        data: { fechaProximaGeneracion: proxima },
      });

      generados++;
    }

    return NextResponse.json({
      ok: true,
      generados,
      totalRecurrentes: recurrentes.length,
      fecha: ahora.toISOString(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al generar recurrentes" }, { status: 500 });
  }
}
