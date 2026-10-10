// Push AkuoSplash schema to Turso production (same DB, tables prefixed Akuo*)
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  const sentencias = [
    `CREATE TABLE IF NOT EXISTS AkuoUsuario (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      telefono TEXT,
      passwordHash TEXT,
      avatarUrl TEXT,
      rol TEXT NOT NULL DEFAULT 'cliente',
      activo INTEGER NOT NULL DEFAULT 1,
      aprobado INTEGER NOT NULL DEFAULT 0,
      banned INTEGER NOT NULL DEFAULT 0,
      banRazon TEXT,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      ultimoLoginEn TEXT,
      googleId TEXT UNIQUE,
      facebookId TEXT UNIQUE,
      rutEmpresa TEXT,
      razonSocial TEXT,
      direccionEmpresa TEXT,
      capacidadVehiculoKg INTEGER,
      patenteVehiculo TEXT,
      tipoVehiculo TEXT,
      licenciaConducirUrl TEXT,
      permisoCircUrl TEXT,
      seguroUrl TEXT,
      areasCobertura TEXT,
      descripcion TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      suscripcionActiva INTEGER NOT NULL DEFAULT 0,
      suscripcionInicio TEXT,
      suscripcionFin TEXT,
      vehiculosPermitidos INTEGER NOT NULL DEFAULT 1,
      choferesPermitidos INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_usuario_rol_activo ON AkuoUsuario(rol, activo)`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_usuario_email ON AkuoUsuario(email)`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_usuario_googleId ON AkuoUsuario(googleId)`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_usuario_facebookId ON AkuoUsuario(facebookId)`,
    `CREATE TABLE IF NOT EXISTS AkuoSesion (
      id TEXT PRIMARY KEY NOT NULL,
      usuarioId TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      expiraEn TEXT NOT NULL,
      userAgent TEXT,
      ip TEXT,
      FOREIGN KEY (usuarioId) REFERENCES AkuoUsuario(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_sesion_usuarioId ON AkuoSesion(usuarioId)`,
    `CREATE TABLE IF NOT EXISTS AkuoCodigoLogin (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      codigo TEXT NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      expiraEn TEXT NOT NULL,
      usado INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_codigo_email ON AkuoCodigoLogin(email)`,
    `CREATE TABLE IF NOT EXISTS AkuoVehiculo (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      transportistaId TEXT NOT NULL,
      patente TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'aljibe',
      capacidadLitros INTEGER NOT NULL,
      marca TEXT,
      modelo TEXT,
      año INTEGER,
      activo INTEGER NOT NULL DEFAULT 1,
      permisoCircUrl TEXT,
      revisionTecUrl TEXT,
      seguroUrl TEXT,
      fotoUrl TEXT,
      FOREIGN KEY (transportistaId) REFERENCES AkuoUsuario(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_vehiculo_transportistaId_activo ON AkuoVehiculo(transportistaId, activo)`,
    `CREATE TABLE IF NOT EXISTS AkuoCliente (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      transportistaId TEXT NOT NULL,
      nombre TEXT NOT NULL,
      telefono TEXT,
      direccion TEXT,
      zona TEXT,
      lat REAL,
      lng REAL,
      precioEfectivoPorLitro REAL NOT NULL DEFAULT 0,
      precioTransferenciaPorLitro REAL NOT NULL DEFAULT 0,
      nota TEXT,
      estanquesJson TEXT,
      requiereIngresoPropiedad INTEGER NOT NULL DEFAULT 0,
      entregaDesdeAfuera INTEGER NOT NULL DEFAULT 0,
      conexionExterna INTEGER NOT NULL DEFAULT 0,
      indicacionesAcceso TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (transportistaId) REFERENCES AkuoUsuario(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_cliente_transportistaId_activo ON AkuoCliente(transportistaId, activo)`,
    `CREATE TABLE IF NOT EXISTS AkuoEntrega (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      transportistaId TEXT NOT NULL,
      clienteId TEXT,
      clienteNombre TEXT NOT NULL,
      clienteDireccion TEXT,
      clienteTelefono TEXT,
      clienteZona TEXT,
      clienteLat REAL,
      clienteLng REAL,
      vehiculoId TEXT,
      litros REAL NOT NULL,
      total REAL NOT NULL,
      montoEfectivo REAL NOT NULL DEFAULT 0,
      montoTransferencia REAL NOT NULL DEFAULT 0,
      montoRecibido REAL NOT NULL DEFAULT 0,
      metodoPago TEXT NOT NULL DEFAULT 'credito',
      estadoPago TEXT NOT NULL DEFAULT 'pendiente',
      descuento REAL NOT NULL DEFAULT 0,
      descuentoPor TEXT,
      fotoMedidorUrl TEXT,
      nota TEXT,
      detalleEstanquesJson TEXT,
      lecturaAnterior REAL,
      lecturaActual REAL,
      FOREIGN KEY (transportistaId) REFERENCES AkuoUsuario(id) ON DELETE CASCADE,
      FOREIGN KEY (clienteId) REFERENCES AkuoCliente(id),
      FOREIGN KEY (vehiculoId) REFERENCES AkuoVehiculo(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_entrega_transportistaId_creadoEn ON AkuoEntrega(transportistaId, creadoEn)`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_entrega_clienteId ON AkuoEntrega(clienteId)`,
    `CREATE TABLE IF NOT EXISTS AkuoPedido (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      transportistaId TEXT NOT NULL,
      clienteId TEXT,
      clienteNombre TEXT NOT NULL,
      clienteDireccion TEXT,
      clienteTelefono TEXT,
      clienteZona TEXT,
      clienteLat REAL,
      clienteLng REAL,
      litrosSolicitados REAL NOT NULL,
      fechaSolicitada TEXT,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      metodoPagoPreferido TEXT NOT NULL DEFAULT 'credito',
      nota TEXT,
      entregaId TEXT UNIQUE,
      FOREIGN KEY (transportistaId) REFERENCES AkuoUsuario(id) ON DELETE CASCADE,
      FOREIGN KEY (clienteId) REFERENCES AkuoCliente(id),
      FOREIGN KEY (entregaId) REFERENCES AkuoEntrega(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_pedido_transportistaId_estado ON AkuoPedido(transportistaId, estado)`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_pedido_clienteId ON AkuoPedido(clienteId)`,
    `CREATE TABLE IF NOT EXISTS AkuoPago (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      transportistaId TEXT NOT NULL,
      monto REAL NOT NULL,
      concepto TEXT NOT NULL,
      metodoPago TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      referencia TEXT,
      FOREIGN KEY (transportistaId) REFERENCES AkuoUsuario(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_pago_transportistaId ON AkuoPago(transportistaId)`,
    `CREATE TABLE IF NOT EXISTS AkuoSuscripcion (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      transportistaId TEXT NOT NULL,
      plan TEXT NOT NULL,
      monto REAL NOT NULL,
      periodoDias INTEGER NOT NULL DEFAULT 30,
      inicio TEXT NOT NULL,
      fin TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'activa',
      metodoPago TEXT,
      referencia TEXT,
      FOREIGN KEY (transportistaId) REFERENCES AkuoUsuario(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_suscripcion_transportistaId_estado ON AkuoSuscripcion(transportistaId, estado)`,
    `CREATE TABLE IF NOT EXISTS AkuoValoracion (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      transportistaId TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comentario TEXT,
      clienteNombre TEXT,
      FOREIGN KEY (transportistaId) REFERENCES AkuoUsuario(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_valoracion_transportistaId_creadoEn ON AkuoValoracion(transportistaId, creadoEn)`,
    `CREATE TABLE IF NOT EXISTS AkuoNotificacion (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      leidaEn TEXT,
      usuarioId TEXT NOT NULL,
      tipo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      link TEXT,
      FOREIGN KEY (usuarioId) REFERENCES AkuoUsuario(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_notif_usuarioId_leidaEn ON AkuoNotificacion(usuarioId, leidaEn)`,
    `CREATE TABLE IF NOT EXISTS AkuoAuditLog (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      superadminId TEXT,
      accion TEXT NOT NULL,
      entidad TEXT,
      entidadId TEXT,
      detalles TEXT,
      ip TEXT,
      FOREIGN KEY (superadminId) REFERENCES AkuoUsuario(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_akuo_audit_superadminId_creadoEn ON AkuoAuditLog(superadminId, creadoEn)`,
    `CREATE TABLE IF NOT EXISTS AkuoConfig (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      comisionPorcentaje REAL NOT NULL DEFAULT 0,
      precioPlanPro REAL NOT NULL DEFAULT 15000,
      precioPlanEnterprise REAL NOT NULL DEFAULT 50000,
      maxVehiculosFree INTEGER NOT NULL DEFAULT 1,
      maxVehiculosPro INTEGER NOT NULL DEFAULT 5,
      maxVehiculosEnterprise INTEGER NOT NULL DEFAULT 999,
      activo INTEGER NOT NULL DEFAULT 1
    )`,
  ];

  console.log(`Ejecutando ${sentencias.length} sentencias CREATE...`);
  let ok = 0;
  for (const sql of sentencias) {
    try {
      await client.execute(sql);
      ok++;
    } catch (e) {
      console.error(`✗ Error: ${e.message.slice(0, 100)}`);
    }
  }
  console.log(`✓ ${ok}/${sentencias.length} sentencias ejecutadas.`);

  // Verificar tablas creadas
  const tabs = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Akuo%' ORDER BY name");
  console.log(`\nTablas Akuo* creadas: ${tabs.rows.length}`);
  for (const t of tabs.rows) console.log(`  ${t.name}`);
}
main().catch(e => { console.error(e); process.exit(1); });
