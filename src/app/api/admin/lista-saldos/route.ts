import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/admin/lista-saldos
// Devuelve una página HTML simple lista para leer en el navegador.
// Muestra todos los clientes con su deuda/saldo, ordenados:
//   1. Saldo a favor (más negativo primero)
//   2. Sin deuda
//   3. Con deuda (mayor deuda al final)
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("No autenticado", { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return new Response("No autorizado", { status: 401 });

  const clientes = await db.cliente.findMany({
    where: { duenoId },
    select: { id: true, nombre: true, deudaInicial: true, telefono: true },
    orderBy: { nombre: "asc" },
  });

  type Fila = {
    nombre: string;
    telefono: string | null;
    id: string;
    deudaInicial: number;
    totalVentas: number;
    totalRecibido: number;
    totalPagosSueltos: number;
    saldoFinal: number;
    cantidadEntregas: number;
    cantidadPagos: number;
  };

  const filasData: Fila[] = [];

  for (const c of clientes) {
    const [entregas, pagos] = await Promise.all([
      db.entrega.findMany({
        where: { clienteId: c.id },
        select: { total: true, montoRecibido: true },
      }),
      db.pago.findMany({
        where: { clienteId: c.id },
        select: { monto: true },
      }),
    ]);

    const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
    const totalRecibido = entregas.reduce((s, e) => s + e.montoRecibido, 0);
    const totalPagosSueltos = pagos.reduce((s, p) => s + p.monto, 0);
    const deudaInicial = c.deudaInicial || 0;
    const saldoFinal = deudaInicial + totalVentas - totalRecibido - totalPagosSueltos;

    filasData.push({
      nombre: c.nombre,
      telefono: c.telefono,
      id: c.id,
      deudaInicial,
      totalVentas,
      totalRecibido,
      totalPagosSueltos,
      saldoFinal,
      cantidadEntregas: entregas.length,
      cantidadPagos: pagos.length,
    });
  }

  // Ordenar: saldo a favor primero (más negativo), luego sin deuda, luego con deuda
  filasData.sort((a, b) => {
    if (a.saldoFinal < 0 && b.saldoFinal >= 0) return -1;
    if (a.saldoFinal >= 0 && b.saldoFinal < 0) return 1;
    if (a.saldoFinal < 0 && b.saldoFinal < 0) return a.saldoFinal - b.saldoFinal;
    return a.nombre.localeCompare(b.nombre);
  });

  let totalDeuda = 0;
  let totalSaldoFavor = 0;
  let cantidadConSaldoFavor = 0;
  let cantidadConDeuda = 0;

  const filasHtml = filasData.map((f) => {
    let color = "gray";
    let badge = "Sin deuda";
    if (f.saldoFinal < 0) {
      color = "red";
      badge = "SALDO A FAVOR";
      totalSaldoFavor += Math.abs(f.saldoFinal);
      cantidadConSaldoFavor++;
    } else if (f.saldoFinal > 0) {
      color = "amber";
      badge = "Debe";
      totalDeuda += f.saldoFinal;
      cantidadConDeuda++;
    }

    const fmt = (n: number) => "$" + Math.abs(n).toLocaleString("es-CL");
    const bg = f.saldoFinal < 0 ? "#fee2e2" : f.saldoFinal > 0 ? "#fef3c7" : "transparent";

    return `
      <tr style="background:${bg}">
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">
          <strong>${escapeHtml(f.nombre)}</strong>
          ${f.telefono ? `<br><span style="color:#6b7280;font-size:11px;">${escapeHtml(f.telefono)}</span>` : ""}
        </td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(f.saldoFinal)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;color:${color};font-weight:700;">${badge}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px;color:#6b7280;">
          DI: ${fmt(f.deudaInicial)}<br>
          Ventas: ${fmt(f.totalVentas)}<br>
          Recibido: ${fmt(f.totalRecibido)}<br>
          Pagos sueltos: ${fmt(f.totalPagosSueltos)}<br>
          (${f.cantidadEntregas} ent, ${f.cantidadPagos} pagos)
        </td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:11px;">
          <a href="/api/admin/debug-cliente-saldo?clienteId=${f.id}" target="_blank">Ver detalle</a>
        </td>
      </tr>
    `;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Saldos de clientes</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 16px; background: #f9fafb; color: #111827; }
  h1 { font-size: 20px; margin: 0 0 8px 0; }
  .summary { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .card { padding: 12px; border-radius: 8px; flex: 1; min-width: 150px; }
  .card.total { background: #eff6ff; border: 1px solid #bfdbfe; }
  .card.favor { background: #fee2e2; border: 1px solid #fecaca; }
  .card.deuda { background: #fef3c7; border: 1px solid #fde68a; }
  .card-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
  .card-value { font-size: 20px; font-weight: 700; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  th { background: #f3f4f6; padding: 10px 8px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; }
  th.right { text-align: right; }
  th.center { text-align: center; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <h1>Saldos de clientes</h1>
  <div class="summary">
    <div class="card total">
      <div class="card-label">Clientes</div>
      <div class="card-value">${clientes.length}</div>
    </div>
    <div class="card favor">
      <div class="card-label">Con saldo a favor</div>
      <div class="card-value">${cantidadConSaldoFavor}</div>
      <div style="font-size:13px;margin-top:4px;">${totalSaldoFavor === 0 ? "—" : "Total: $" + totalSaldoFavor.toLocaleString("es-CL")}</div>
    </div>
    <div class="card deuda">
      <div class="card-label">Con deuda</div>
      <div class="card-value">${cantidadConDeuda}</div>
      <div style="font-size:13px;margin-top:4px;">${totalDeuda === 0 ? "—" : "Total: $" + totalDeuda.toLocaleString("es-CL")}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Cliente</th>
        <th class="right">Saldo</th>
        <th class="center">Estado</th>
        <th class="right">Detalle</th>
        <th>Acción</th>
      </tr>
    </thead>
    <tbody>
      ${filasHtml}
    </tbody>
  </table>
  <p style="margin-top:16px;font-size:11px;color:#6b7280;">
    Rojo = saldo a favor (regalaste plata). Amarillo = deuda. Sin color = sin deuda.
    Hacé click en "Ver detalle" para ver las entregas y pagos que generan ese saldo.
  </p>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
