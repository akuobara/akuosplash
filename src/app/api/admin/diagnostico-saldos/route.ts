import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/admin/diagnostico-saldos
// Una sola página HTML que muestra:
//   - Lista de todos los clientes con su saldo
//   - Para cada cliente con problema, EXPLICACIÓN de por qué (pago fantasma, over-pay, etc.)
//   - Botones para ejecutar todas las correcciones automáticamente
//
// No requiere loguearse como admin — cualquier usuario autenticado puede verlo.
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("No autenticado", { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return new Response("No autorizado", { status: 401 });

  const clientes = await db.cliente.findMany({
    where: { duenoId },
    select: {
      id: true,
      nombre: true,
      deudaInicial: true,
    },
    orderBy: { nombre: "asc" },
  });

  const filasHtml: string[] = [];
  let totalDeuda = 0;
  let totalSaldoFavor = 0;
  let cantidadConSaldoFavor = 0;
  let cantidadConDeuda = 0;
  let cantidadProblemas = 0;

  for (const c of clientes) {
    const [entregas, pagos] = await Promise.all([
      db.entrega.findMany({
        where: { clienteId: c.id },
        select: { id: true, fecha: true, litros: true, total: true, montoRecibido: true, estadoPago: true },
      }),
      db.pago.findMany({
        where: { clienteId: c.id },
        select: { id: true, fecha: true, monto: true, metodoPago: true, descripcion: true, nota: true },
      }),
    ]);

    const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
    const totalRecibido = entregas.reduce((s, e) => s + e.montoRecibido, 0);
    const totalPagosSueltos = pagos.reduce((s, p) => s + p.monto, 0);
    const deudaInicial = c.deudaInicial || 0;
    const saldoFinal = deudaInicial + totalVentas - totalRecibido - totalPagosSueltos;

    // Detectar problemas
    const problemas: string[] = [];

    // 1. Over-pay: entregas con montoRecibido > total
    const overpay = entregas.filter((e) => e.montoRecibido > e.total && e.total > 0);
    if (overpay.length > 0) {
      const totalOver = overpay.reduce((s, e) => s + (e.montoRecibido - e.total), 0);
      problemas.push(
        `<div class="problema problema-overpay">⚠ <strong>${overpay.length} entrega(s) con sobre-pago</strong> — el cliente pagó más que el total. Excedente: ${fmtCLP(totalOver)}.</div>`
      );
    }

    // 1b. Under-pay: entregas con montoRecibido < total (pagos parciales o sin pagar)
    const underpay = entregas.filter((e) => e.montoRecibido < e.total && e.total > 0);
    if (underpay.length > 0) {
      const totalFalta = underpay.reduce((s, e) => s + (e.total - e.montoRecibido), 0);
      problemas.push(
        `<div class="problema problema-underpay">💸 <strong>${underpay.length} entrega(s) con pago faltante</strong> — el cliente pagó menos que el total. Falta: ${fmtCLP(totalFalta)}. Entregas:</div>`
      );
      for (const e of underpay) {
        const fecha = new Date(e.fecha).toLocaleDateString("es-CL");
        problemas.push(
          `<div class="problema problema-underpay-detalle"> &nbsp;↳ ${fecha}: ${e.litros} L · Total ${fmtCLP(e.total)} · Recibido ${fmtCLP(e.montoRecibido)} · Falta ${fmtCLP(e.total - e.montoRecibido)} (${e.estadoPago})</div>`
        );
      }
    }

    // 2. Pago suelto duplicado: pago con monto == montoRecibido de una entrega del mismo día
    for (const p of pagos) {
      const fechaPago = new Date(p.fecha);
      const inicio = new Date(fechaPago);
      inicio.setHours(0, 0, 0, 0);
      const fin = new Date(fechaPago);
      fin.setHours(23, 59, 59, 999);
      const matchEntrega = entregas.find((e) => {
        const fe = new Date(e.fecha);
        return fe >= inicio && fe <= fin && e.montoRecibido >= p.monto && e.montoRecibido > 0;
      });
      if (matchEntrega) {
        problemas.push(
          `<div class="problema problema-duplicado">🚨 <strong>Pago suelto duplicado</strong> — ${fmtCLP(p.monto)} (${p.metodoPago}) del ${fechaPago.toLocaleDateString("es-CL")} coincide con el montoRecibido de una entrega del mismo día.</div>`
        );
        break;
      }
    }

    // 3. DeudaInicial mal seteada
    if (deudaInicial > 0 && entregas.length === 0 && pagos.length === 0) {
      problemas.push(
        `<div class="problema problema-deuda-inicial">⚠ <strong>deudaInicial sospechosa</strong> — el cliente tiene deudaInicial de ${fmtCLP(deudaInicial)} pero ninguna entrega ni pago. Probablemente un leftover.</div>`
      );
    }

    // 4. Sin pagos pero con saldo a favor
    if (saldoFinal < 0 && pagos.length === 0 && entregas.every((e) => e.montoRecibido <= e.total)) {
      problemas.push(
        `<div class="problema">❓ <strong>Saldo a favor sin causa clara</strong> — el cliente no tiene pagos sueltos ni sobre-pagos. Investigar manualmente.</div>`
      );
    }

    // Estado visual
    let color = "gray";
    let badge = "Sin deuda";
    let bg = "transparent";
    if (saldoFinal < 0) {
      color = "red";
      badge = "SALDO A FAVOR";
      bg = "#fee2e2";
      totalSaldoFavor += Math.abs(saldoFinal);
      cantidadConSaldoFavor++;
    } else if (saldoFinal > 0) {
      color = "amber";
      badge = "Debe";
      bg = "#fef3c7";
      totalDeuda += saldoFinal;
      cantidadConDeuda++;
    }

    const tieneProblemas = problemas.length > 0;
    if (tieneProblemas) cantidadProblemas++;

    filasHtml.push(`
      <tr style="background:${bg}">
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;">
          <strong>${escapeHtml(c.nombre)}</strong>
          ${tieneProblemas ? '<br><span style="font-size:11px;color:#dc2626;font-weight:600;">⚠ problema</span>' : ''}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;${saldoFinal < 0 ? 'color:#dc2626;font-weight:700;' : ''}">
          ${fmtCLP(saldoFinal)}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:center;color:${color};font-weight:700;">
          ${badge}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#6b7280;">
          DI: ${fmtCLP(deudaInicial)}<br>
          Ventas: ${fmtCLP(totalVentas)}<br>
          Recibido: ${fmtCLP(totalRecibido)}<br>
          Pagos sueltos: ${fmtCLP(totalPagosSueltos)}<br>
          (${entregas.length} ent, ${pagos.length} pagos)
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;">
          ${tieneProblemas ? problemas.join("") : '<span style="color:#9ca3af;">— sin problemas —</span>'}
          <br>
          <a href="/api/admin/debug-cliente-saldo?clienteId=${c.id}" target="_blank" style="color:#2563eb;font-size:10px;">ver detalle →</a>
        </td>
      </tr>
    `);
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Diagnóstico de saldos</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 16px; background: #f9fafb; color: #111827; }
  h1 { font-size: 20px; margin: 0 0 8px 0; }
  .summary { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .card { padding: 10px; border-radius: 8px; flex: 1; min-width: 130px; }
  .card.total { background: #eff6ff; border: 1px solid #bfdbfe; }
  .card.favor { background: #fee2e2; border: 1px solid #fecaca; }
  .card.deuda { background: #fef3c7; border: 1px solid #fde68a; }
  .card.problemas { background: #ede9fe; border: 1px solid #ddd6fe; }
  .card-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
  .card-value { font-size: 18px; font-weight: 700; margin-top: 4px; }
  .acciones { margin: 16px 0; padding: 12px; background: white; border-radius: 8px; border: 1px solid #e5e7eb; }
  .acciones h2 { font-size: 14px; margin: 0 0 8px 0; }
  .btn { display: inline-block; padding: 8px 14px; border-radius: 6px; text-decoration: none; font-size: 13px; margin-right: 8px; margin-bottom: 4px; }
  .btn-primary { background: #2563eb; color: white; }
  .btn-danger { background: #dc2626; color: white; }
  .btn-warning { background: #f59e0b; color: white; }
  table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 8px; }
  th { background: #f3f4f6; padding: 10px 8px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; }
  th.right { text-align: right; }
  th.center { text-align: center; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .problema { padding: 4px 6px; margin: 2px 0; border-radius: 4px; font-size: 11px; }
  .problema-overpay { background: #fef3c7; color: #92400e; }
  .problema-duplicado { background: #fee2e2; color: #991b1b; }
  .problema-deuda-inicial { background: #ede9fe; color: #5b21b6; }
  .problema-underpay { background: #ffedd5; color: #9a3412; font-weight: 600; }
  .problema-underpay-detalle { background: #ffedd5; color: #9a3412; font-family: monospace; font-size: 10px; }
</style>
</head>
<body>
  <h1>Diagnóstico de saldos</h1>
  <div class="summary">
    <div class="card total">
      <div class="card-label">Clientes</div>
      <div class="card-value">${clientes.length}</div>
    </div>
    <div class="card favor">
      <div class="card-label">Saldo a favor</div>
      <div class="card-value">${cantidadConSaldoFavor}</div>
      <div style="font-size:12px;margin-top:2px;">${totalSaldoFavor === 0 ? "—" : "Total: $" + totalSaldoFavor.toLocaleString("es-CL")}</div>
    </div>
    <div class="card deuda">
      <div class="card-label">Con deuda</div>
      <div class="card-value">${cantidadConDeuda}</div>
      <div style="font-size:12px;margin-top:2px;">${totalDeuda === 0 ? "—" : "Total: $" + totalDeuda.toLocaleString("es-CL")}</div>
    </div>
    <div class="card problemas">
      <div class="card-label">Con problemas</div>
      <div class="card-value">${cantidadProblemas}</div>
      <div style="font-size:12px;margin-top:2px;">acciones recomendadas abajo ↓</div>
    </div>
  </div>

  <div class="acciones">
    <h2>Acciones automáticas (clic para ejecutar)</h2>
    <p style="font-size:11px;color:#6b7280;margin:0 0 8px 0;">
      Abrí cada link en una pestaña nueva. Cada uno te muestra un JSON con qué se hizo.
      No necesitás loguearte de nuevo — ya estás logueado.
    </p>
    <a class="btn btn-danger" href="/api/admin/fix-pagos-duplicados?confirmar=true" target="_blank">🚨 Borrar pagos duplicados</a>
    <a class="btn btn-danger" href="/api/admin/fix-entregas-underpay" target="_blank">💸 Detectar underpay (dry-run)</a>
    <a class="btn btn-warning" href="/api/admin/sincronizar-estanques-cliente" target="_blank">🛢️ Sincronizar estanques</a>
    <a class="btn btn-primary" href="/api/admin/fix-totales-estanques" target="_blank">🔧 Recalcular totales estanques</a>
    <a class="btn btn-primary" href="/api/admin/fix-gasto-pagado-por?corregirTodos=1" target="_blank">💰 Arreglar gastos pagados por dueño</a>
  </div>

  <table>
    <thead>
      <tr>
        <th>Cliente</th>
        <th class="right">Saldo</th>
        <th class="center">Estado</th>
        <th class="right">Detalle</th>
        <th>Problemas detectados</th>
      </tr>
    </thead>
    <tbody>
      ${filasHtml.join("")}
    </tbody>
  </table>
  <p style="margin-top:16px;font-size:11px;color:#6b7280;">
    Rojo = saldo a favor. Amarillo = deuda. Sin color = sin deuda.
    Si hay un problema detectado, hacé clic en "ver detalle" para ver las entregas y pagos que lo causan.
  </p>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function fmtCLP(n: number): string {
  return "$" + Math.abs(n).toLocaleString("es-CL");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
