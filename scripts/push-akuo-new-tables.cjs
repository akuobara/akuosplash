const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

const sentencias = [
  `CREATE TABLE IF NOT EXISTS AkuoConversacion (
    id TEXT PRIMARY KEY NOT NULL,
    creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
    clienteId TEXT NOT NULL,
    transportistaId TEXT NOT NULL,
    ultimoMensajeEn TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (clienteId) REFERENCES AkuoUsuario(id) ON DELETE CASCADE,
    FOREIGN KEY (transportistaId) REFERENCES AkuoUsuario(id) ON DELETE CASCADE,
    UNIQUE (clienteId, transportistaId)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_akuo_conv_clienteId ON AkuoConversacion(clienteId)`,
  `CREATE INDEX IF NOT EXISTS idx_akuo_conv_transportistaId ON AkuoConversacion(transportistaId)`,
  `CREATE TABLE IF NOT EXISTS AkuoMensaje (
    id TEXT PRIMARY KEY NOT NULL,
    creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
    leidoEn TEXT,
    conversacionId TEXT NOT NULL,
    remitenteId TEXT NOT NULL,
    contenido TEXT NOT NULL,
    FOREIGN KEY (conversacionId) REFERENCES AkuoConversacion(id) ON DELETE CASCADE,
    FOREIGN KEY (remitenteId) REFERENCES AkuoUsuario(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_akuo_msg_convId_creadoEn ON AkuoMensaje(conversacionId, creadoEn)`,
  `CREATE TABLE IF NOT EXISTS AkuoPedidoCliente (
    id TEXT PRIMARY KEY NOT NULL,
    creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
    clienteId TEXT NOT NULL,
    transportistaId TEXT,
    litros REAL NOT NULL,
    direccion TEXT NOT NULL,
    comuna TEXT,
    lat REAL,
    lng REAL,
    fechaDeseada TEXT,
    franjaHoraria TEXT,
    metodoPago TEXT NOT NULL DEFAULT 'efectivo',
    estado TEXT NOT NULL DEFAULT 'pendiente',
    nota TEXT,
    precioTotal REAL,
    entregaId TEXT,
    FOREIGN KEY (clienteId) REFERENCES AkuoUsuario(id) ON DELETE CASCADE,
    FOREIGN KEY (transportistaId) REFERENCES AkuoUsuario(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_akuo_pedcli_clienteId_estado ON AkuoPedidoCliente(clienteId, estado)`,
  `CREATE INDEX IF NOT EXISTS idx_akuo_pedcli_transportistaId_estado ON AkuoPedidoCliente(transportistaId, estado)`,
];

async function main() {
  let ok = 0;
  for (const sql of sentencias) {
    try { await client.execute(sql); ok++; } catch (e) { console.error('✗', e.message.slice(0, 100)); }
  }
  console.log(`✓ ${ok}/${sentencias.length} tablas creadas`);
}
main().catch(e => { console.error(e); process.exit(1); });
