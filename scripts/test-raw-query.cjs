const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});
(async () => {
  // Test the EXACT query from akuoGetCurrentUser
  try {
    const r = await c.execute({
      sql: `SELECT id, email, nombre, telefono, direccion, comuna, lat, lng, rut, indicacionesAcceso,
              requiereClientePresente, usoAgua, saldo, zonaId, passwordHash, avatarUrl, rol,
              activo, aprobado, banned, banRazon, creadoEn, ultimoLoginEn, googleId, facebookId,
              rutEmpresa, razonSocial, direccionEmpresa, giro,
              licenciaConducirUrl, licenciaConducirAtrasUrl, permisoCircUrl, seguroUrl, revisonTecnicaUrl,
              capacidadVehiculoKg, patenteVehiculo, tipoVehiculo,
              fotoVehiculoFrenteUrl, fotoVehiculoAtrasUrl, fotoVehiculoIzquierdaUrl, fotoVehiculoDerechaUrl,
              estadoAprobacion, estadoAprobacionNota, estadoAprobacionActualizadoEn,
              facturacionPlataforma, facturacionApiKey,
              precioEfectivoPorLitro, precioTransferenciaPorLitro,
              mpUserId, mpAccessToken, mpRefreshToken, mpTokenExpiresAt, mpConnectedAt,
              plan, planActivoDesde, planActivoHasta,
              transbankBuyOrder, transbankTokenWs, transbankStatus, transbankAmount,
              transbankPlanSolicitado, transbankCiclo, transbankIniciadoEn, transbankAutorizadoEn,
              transbankAuthorizationCode,
              verificado, verificadoEn, verificadoPor,
              mpSubPreapprovalId, mpSubPlanSolicitado, mpSubCiclo, mpSubStatus,
              mpSubIniciadoEn, mpSubAutorizadoEn, mpSubAmount,
              mpTestUserEmail, regionTrabajo, comunaTrabajo, localidadTrabajo
       FROM AkuoUsuario WHERE id = ?`,
      args: ['cmv05q5im0000jr06etufs3ru']
    });
    console.log('SUCCESS! Row count:', r.rows.length);
    console.log('rol:', r.rows[0]?.rol, '| activo:', r.rows[0]?.activo, '| banned:', r.rows[0]?.banned);
  } catch (e) {
    console.error('FAILED:', e.message);
  }
})();
