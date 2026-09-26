// Push Bolsón schema to Turso production
// We use the same Turso instance as Aljibe (tables are isolated by "Bolson*" prefix)
import { createClient } from '@libsql/client';

const TURSO_URL = 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA';

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

async function main() {
  // Verificar tablas existentes
  const tabs = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Bolson%' ORDER BY name");
  console.log(`Tablas Bolsón* existentes: ${tabs.rows.length}`);
  for (const t of tabs.rows) console.log(`  ${t.name}`);

  if (tabs.rows.length > 0) {
    console.log('\n⚠️  Ya existen tablas Bolsón* en Turso. Abortando para no pisar datos.');
    console.log('Si querés forzar recreación, hacelo manualmente.');
    return;
  }

  // Para crear las tablas en Turso, hago un batch de sentencias CREATE TABLE derivadas del schema.
  // Esto es simpler que ejecutar prisma db push (que requiere instalar prisma CLI contra la URL).
  // Genero las CREATE statements a mano, pero solo para las tablas principales.

  const sentencias = [
    // Categorias (sembrar también)
    `CREATE TABLE IF NOT EXISTS BolsonCategoria (
      id TEXT PRIMARY KEY NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      icono TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      orden INTEGER NOT NULL DEFAULT 0
    )`,
    // Usuario
    `CREATE TABLE IF NOT EXISTS BolsonUsuario (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT UNIQUE,
      telefono TEXT UNIQUE,
      nombre TEXT NOT NULL,
      passwordHash TEXT,
      rol TEXT NOT NULL DEFAULT 'cliente',
      activo INTEGER NOT NULL DEFAULT 1,
      aprobado INTEGER NOT NULL DEFAULT 0,
      banned INTEGER NOT NULL DEFAULT 0,
      banRazon TEXT,
      avatarUrl TEXT,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      ultimoLoginEn TEXT,
      rutEmpresa TEXT,
      razonSocial TEXT,
      capacidadCamionKg INTEGER,
      patenteCamion TEXT,
      tieneGrua INTEGER NOT NULL DEFAULT 0,
      tieneMotoneta INTEGER NOT NULL DEFAULT 0,
      areasCobertura TEXT,
      descripcionServicios TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_usuario_rol_activo ON BolsonUsuario(rol, activo)`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_usuario_telefono ON BolsonUsuario(telefono)`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_usuario_email ON BolsonUsuario(email)`,
    // Sesion
    `CREATE TABLE IF NOT EXISTS BolsonSesion (
      id TEXT PRIMARY KEY NOT NULL,
      usuarioId TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      expiraEn TEXT NOT NULL,
      userAgent TEXT,
      ip TEXT,
      FOREIGN KEY (usuarioId) REFERENCES BolsonUsuario(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_sesion_usuarioId ON BolsonSesion(usuarioId)`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_sesion_token ON BolsonSesion(token)`,
    // CodigoLogin
    `CREATE TABLE IF NOT EXISTS BolsonCodigoLogin (
      id TEXT PRIMARY KEY NOT NULL,
      telefono TEXT,
      email TEXT,
      codigo TEXT NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      expiraEn TEXT NOT NULL,
      usado INTEGER NOT NULL DEFAULT 0,
      intentos INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_codigologin_telefono ON BolsonCodigoLogin(telefono)`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_codigologin_email ON BolsonCodigoLogin(email)`,
    // Solicitud
    `CREATE TABLE IF NOT EXISTS BolsonSolicitud (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      actualizadaEn TEXT NOT NULL DEFAULT (datetime('now')),
      clienteId TEXT NOT NULL,
      categoriaId TEXT NOT NULL,
      titulo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      volumenM3 REAL,
      pesoKg REAL,
      cantidadItems INTEGER NOT NULL DEFAULT 1,
      requiereEmbalaje INTEGER NOT NULL DEFAULT 0,
      requierePersonalExtra INTEGER NOT NULL DEFAULT 0,
      requiereGrua INTEGER NOT NULL DEFAULT 0,
      requiereMotoneta INTEGER NOT NULL DEFAULT 0,
      fotoUrl TEXT,
      fechaFlexible INTEGER NOT NULL DEFAULT 1,
      fechaMin TEXT,
      fechaMax TEXT,
      franjaHoraria TEXT,
      zonaOrigen TEXT,
      zonaDestino TEXT,
      presupuestoMax REAL,
      metodoPagoPreferido TEXT,
      estado TEXT NOT NULL DEFAULT 'abierta',
      canceladaRazon TEXT,
      cerradaEn TEXT,
      cotizacionAdjudicadaId TEXT,
      FOREIGN KEY (clienteId) REFERENCES BolsonUsuario(id) ON DELETE CASCADE,
      FOREIGN KEY (categoriaId) REFERENCES BolsonCategoria(id),
      FOREIGN KEY (cotizacionAdjudicadaId) REFERENCES BolsonCotizacion(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_solicitud_clienteId_estado ON BolsonSolicitud(clienteId, estado)`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_solicitud_categoriaId_estado ON BolsonSolicitud(categoriaId, estado)`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_solicitud_estado_creadoEn ON BolsonSolicitud(estado, creadoEn)`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_solicitud_zonaOrigen ON BolsonSolicitud(zonaOrigen)`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_solicitud_zonaDestino ON BolsonSolicitud(zonaDestino)`,
    // Punto
    `CREATE TABLE IF NOT EXISTS BolsonPunto (
      id TEXT PRIMARY KEY NOT NULL,
      solicitudId TEXT NOT NULL,
      tipo TEXT NOT NULL,
      orden INTEGER NOT NULL,
      direccion TEXT NOT NULL,
      comuna TEXT,
      referencia TEXT,
      lat REAL,
      lng REAL,
      contactoNombre TEXT,
      contactoTelefono TEXT,
      requiereAscensor INTEGER NOT NULL DEFAULT 0,
      piso INTEGER,
      indicacionesAcceso TEXT,
      FOREIGN KEY (solicitudId) REFERENCES BolsonSolicitud(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_punto_solicitudId_tipo_orden ON BolsonPunto(solicitudId, tipo, orden)`,
    // Cotizacion
    `CREATE TABLE IF NOT EXISTS BolsonCotizacion (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      actualizadaEn TEXT NOT NULL DEFAULT (datetime('now')),
      solicitudId TEXT NOT NULL,
      transportistaId TEXT NOT NULL,
      monto REAL NOT NULL,
      moneda TEXT NOT NULL DEFAULT 'CLP',
      tiempoEstimadoHoras INTEGER,
      fechaPropuestaInicio TEXT,
      fechaPropuestaFin TEXT,
      mensaje TEXT,
      incluyePersonal INTEGER NOT NULL DEFAULT 0,
      incluyeEmbalaje INTEGER NOT NULL DEFAULT 0,
      incluyeGrua INTEGER NOT NULL DEFAULT 0,
      incluyeMotoneta INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      rechazadaRazon TEXT,
      aceptadaEn TEXT,
      FOREIGN KEY (solicitudId) REFERENCES BolsonSolicitud(id) ON DELETE CASCADE,
      FOREIGN KEY (transportistaId) REFERENCES BolsonUsuario(id) ON DELETE CASCADE,
      UNIQUE (solicitudId, transportistaId)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_cotizacion_solicitudId_estado ON BolsonCotizacion(solicitudId, estado)`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_cotizacion_transportistaId_estado ON BolsonCotizacion(transportistaId, estado)`,
    // Servicio
    `CREATE TABLE IF NOT EXISTS BolsonServicio (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      iniciadoEn TEXT,
      completadoEn TEXT,
      canceladoEn TEXT,
      solicitudId TEXT NOT NULL UNIQUE,
      cotizacionId TEXT NOT NULL UNIQUE,
      transportistaId TEXT NOT NULL,
      choferId TEXT,
      camionPatente TEXT,
      camionCapacidadKg INTEGER,
      estado TEXT NOT NULL DEFAULT 'asignado',
      notaInterna TEXT,
      ubicacionActualLat REAL,
      ubicacionActualLng REAL,
      ubicacionActualEn TEXT,
      firmaClienteUrl TEXT,
      firmaClienteEn TEXT,
      kmRecorridos REAL,
      litrosCombustible REAL,
      horasTrabajadas REAL,
      comisionMonto REAL,
      comisionPagada INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (solicitudId) REFERENCES BolsonSolicitud(id) ON DELETE CASCADE,
      FOREIGN KEY (cotizacionId) REFERENCES BolsonCotizacion(id) ON DELETE CASCADE,
      FOREIGN KEY (transportistaId) REFERENCES BolsonUsuario(id),
      FOREIGN KEY (choferId) REFERENCES BolsonUsuario(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_servicio_transportistaId_estado ON BolsonServicio(transportistaId, estado)`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_servicio_choferId_estado ON BolsonServicio(choferId, estado)`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_servicio_estado_creadoEn ON BolsonServicio(estado, creadoEn)`,
    // Foto
    `CREATE TABLE IF NOT EXISTS BolsonFoto (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      servicioId TEXT NOT NULL,
      tipo TEXT NOT NULL,
      orden INTEGER NOT NULL DEFAULT 0,
      url TEXT NOT NULL,
      descripcion TEXT,
      cargadoPorId TEXT,
      FOREIGN KEY (servicioId) REFERENCES BolsonServicio(id) ON DELETE CASCADE,
      FOREIGN KEY (cargadoPorId) REFERENCES BolsonUsuario(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_foto_servicioId_tipo ON BolsonFoto(servicioId, tipo)`,
    // Pago
    `CREATE TABLE IF NOT EXISTS BolsonPago (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      servicioId TEXT NOT NULL,
      monto REAL NOT NULL,
      moneda TEXT NOT NULL DEFAULT 'CLP',
      concepto TEXT NOT NULL,
      metodoPago TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      referencia TEXT,
      pagadoPorId TEXT,
      recibidoPorId TEXT,
      comprobanteUrl TEXT,
      FOREIGN KEY (servicioId) REFERENCES BolsonServicio(id) ON DELETE CASCADE,
      FOREIGN KEY (pagadoPorId) REFERENCES BolsonUsuario(id),
      FOREIGN KEY (recibidoPorId) REFERENCES BolsonUsuario(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_pago_servicioId_estado ON BolsonPago(servicioId, estado)`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_pago_pagadoPorId ON BolsonPago(pagadoPorId)`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_pago_recibidoPorId ON BolsonPago(recibidoPorId)`,
    // Valoracion
    `CREATE TABLE IF NOT EXISTS BolsonValoracion (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      servicioId TEXT NOT NULL,
      deUsuarioId TEXT NOT NULL,
      aUsuarioId TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comentario TEXT,
      respuesta TEXT,
      FOREIGN KEY (servicioId) REFERENCES BolsonServicio(id) ON DELETE CASCADE,
      FOREIGN KEY (deUsuarioId) REFERENCES BolsonUsuario(id) ON DELETE CASCADE,
      FOREIGN KEY (aUsuarioId) REFERENCES BolsonUsuario(id) ON DELETE CASCADE,
      UNIQUE (servicioId, deUsuarioId, aUsuarioId)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_valoracion_aUsuarioId_creadoEn ON BolsonValoracion(aUsuarioId, creadoEn)`,
    // Mensaje
    `CREATE TABLE IF NOT EXISTS BolsonMensaje (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      leidoEn TEXT,
      solicitudId TEXT NOT NULL,
      remitenteId TEXT NOT NULL,
      contenido TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'texto',
      metadata TEXT,
      FOREIGN KEY (solicitudId) REFERENCES BolsonSolicitud(id) ON DELETE CASCADE,
      FOREIGN KEY (remitenteId) REFERENCES BolsonUsuario(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_mensaje_solicitudId_creadoEn ON BolsonMensaje(solicitudId, creadoEn)`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_mensaje_remitenteId ON BolsonMensaje(remitenteId)`,
    // Notificacion
    `CREATE TABLE IF NOT EXISTS BolsonNotificacion (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      leidaEn TEXT,
      usuarioId TEXT NOT NULL,
      tipo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      link TEXT,
      metadata TEXT,
      solicitudId TEXT,
      FOREIGN KEY (usuarioId) REFERENCES BolsonUsuario(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_notif_usuarioId_leidaEn ON BolsonNotificacion(usuarioId, leidaEn)`,
    // ComisionConfig
    `CREATE TABLE IF NOT EXISTS BolsonComisionConfig (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      actualizadaEn TEXT NOT NULL DEFAULT (datetime('now')),
      superadminId TEXT NOT NULL UNIQUE,
      porcentajeComision REAL NOT NULL DEFAULT 0,
      montoFijoComision REAL NOT NULL DEFAULT 0,
      montoMinimoComision REAL NOT NULL DEFAULT 0,
      aplicaPorCategoria INTEGER NOT NULL DEFAULT 0,
      categoriasConfig TEXT,
      publicacionPremiumHabilitada INTEGER NOT NULL DEFAULT 0,
      publicacionPremiumMonto REAL NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (superadminId) REFERENCES BolsonUsuario(id)
    )`,
    // AuditLog
    `CREATE TABLE IF NOT EXISTS BolsonAuditLog (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      superadminId TEXT,
      accion TEXT NOT NULL,
      entidad TEXT,
      entidadId TEXT,
      detalles TEXT,
      ip TEXT,
      FOREIGN KEY (superadminId) REFERENCES BolsonUsuario(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_audit_superadminId_creadoEn ON BolsonAuditLog(superadminId, creadoEn)`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_audit_entidad_creadoEn ON BolsonAuditLog(entidad, creadoEn)`,
    // ClienteApp
    `CREATE TABLE IF NOT EXISTS BolsonClienteApp (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      usuarioId TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      telefono TEXT NOT NULL,
      email TEXT,
      pushToken TEXT,
      plataforma TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      preferenciasNotif TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_bolson_clienteapp_usuarioId ON BolsonClienteApp(usuarioId)`,
    // CuponDescuento
    `CREATE TABLE IF NOT EXISTS BolsonCuponDescuento (
      id TEXT PRIMARY KEY NOT NULL,
      codigo TEXT NOT NULL UNIQUE,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      creadoPorId TEXT,
      tipo TEXT NOT NULL,
      valor REAL NOT NULL,
      usosMaximos INTEGER,
      usosActuales INTEGER NOT NULL DEFAULT 0,
      validoDesde TEXT,
      validoHasta TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (creadoPorId) REFERENCES BolsonUsuario(id)
    )`,
    // FacturaAdmin
    `CREATE TABLE IF NOT EXISTS BolsonFacturaAdmin (
      id TEXT PRIMARY KEY NOT NULL,
      creadoEn TEXT NOT NULL DEFAULT (datetime('now')),
      numero INTEGER NOT NULL UNIQUE,
      servicioId TEXT,
      montoNeto REAL NOT NULL,
      iva REAL NOT NULL,
      montoTotal REAL NOT NULL,
      emisorRut TEXT NOT NULL,
      emisorNombre TEXT NOT NULL,
      receptorRut TEXT NOT NULL,
      receptorNombre TEXT NOT NULL,
      receptorDireccion TEXT,
      pdfUrl TEXT,
      estado TEXT NOT NULL DEFAULT 'emitida'
    )`,
  ];

  console.log(`\nEjecutando ${sentencias.length} sentencias CREATE...`);
  let i = 0;
  for (const sql of sentencias) {
    try {
      await client.execute(sql);
      i++;
    } catch (e) {
      console.error(`✗ Error en sentencia #${i+1}:`, e.message);
      console.error('SQL:', sql.slice(0, 200));
    }
  }
  console.log(`✓ ${i}/${sentencias.length} sentencias ejecutadas.`);

  // Verificar
  const tabs2 = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Bolson%' ORDER BY name");
  console.log(`\nTablas Bolsón* finales: ${tabs2.rows.length}`);
  for (const t of tabs2.rows) console.log(`  ${t.name}`);

  // Sembrar categorías
  const catsCount = await client.execute("SELECT COUNT(*) AS c FROM BolsonCategoria");
  if (catsCount.rows[0].c === 0) {
    console.log('\nSembrando categorías...');
    await client.execute({
      sql: "INSERT INTO BolsonCategoria (id, slug, nombre, descripcion, icono, activo, orden) VALUES (?, ?, ?, ?, ?, 1, ?)",
      args: ['cmuhsb-cat1', 'flete', 'Flete', 'Traslado de mercadería en general — encomiendas grandes, palets, muebles, etc.', '📦', 1],
    });
    await client.execute({
      sql: "INSERT INTO BolsonCategoria (id, slug, nombre, descripcion, icono, activo, orden) VALUES (?, ?, ?, ?, ?, 1, ?)",
      args: ['cmuhsb-cat2', 'mudanza', 'Mudanza', 'Casa o departamento completo — incluye personal extra, embalaje opcional, camión con caja cerrada.', '🏠', 2],
    });
    await client.execute({
      sql: "INSERT INTO BolsonCategoria (id, slug, nombre, descripcion, icono, activo, orden) VALUES (?, ?, ?, ?, ?, 1, ?)",
      args: ['cmuhsb-cat3', 'escombros', 'Escombros', 'Retiro de escombros, tierra, material de demolición — camión con caja abierta o tolva.', '🚚', 3],
    });
    console.log('✓ 3 categorías sembradas (flete, mudanza, escombros)');
  } else {
    console.log(`Categorías ya existen: ${catsCount.rows[0].c}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
