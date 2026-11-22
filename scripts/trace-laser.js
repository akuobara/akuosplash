// Traza calcularProximaFechaConDiaPreferido con las fechas reales del láser
function calc(fechaActual, frecuenciaDias, diaSemanaPreferido) {
  if (diaSemanaPreferido === null || diaSemanaPreferido === undefined || frecuenciaDias !== 7) {
    const proxima = new Date(fechaActual);
    proxima.setDate(proxima.getDate() + frecuenciaDias);
    proxima.setUTCHours(0, 0, 0, 0);
    return proxima;
  }
  const proxima = new Date(fechaActual);
  proxima.setDate(proxima.getDate() + 7);
  const diaActual = proxima.getDay();
  const diff = (diaSemanaPreferido - diaActual + 7) % 7;
  proxima.setDate(proxima.getDate() + diff);
  proxima.setUTCHours(0, 0, 0, 0);
  return proxima;
}
const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const fechas = ["2026-10-01", "2026-10-08", "2026-10-14", "2026-10-21", "2026-10-28", "2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25", "2026-12-02", "2026-12-09"];
console.log("=== Día de la semana de cada fecha ===");
for (const f of fechas) {
  const d = new Date(f + "T00:00:00.000Z");
  console.log(`  ${f} = ${dias[d.getDay()]} (getDay=${d.getDay()})`);
}

console.log("\n=== Traza calcularProximaFechaConDiaPreferido(fecha, 7, 3=miércoles) ===");
// Simular la secuencia: desde 11-11 (último pedido antes del salto)
const pruebas = ["2026-10-21", "2026-11-04", "2026-11-11", "2026-11-25"];
for (const f of pruebas) {
  const d = new Date(f + "T00:00:00.000Z");
  const r = calc(d, 7, 3);
  console.log(`  calc(${f} [${dias[d.getDay()]}], 7, 3) = ${r.toISOString().slice(0,10)} [${dias[r.getDay()]}]`);
}
