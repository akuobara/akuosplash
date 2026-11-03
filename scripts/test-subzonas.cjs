const { SignJWT } = require('/home/z/my-project/node_modules/jose');
const http = require('http');

(async () => {
  const secret = 'akuosplash-secret-dev-cambiar-en-produccion-1234567890';
  const token = await new SignJWT({
    userId: 'cmv05q5im0000jr06etufs3ru',
    email: 'akuobara@gmail.com',
    nombre: 'Administrador',
    rol: 'superadmin',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .setIssuedAt()
    .sign(new TextEncoder().encode(secret));

  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/akuosplash/admin/regiones-comunas',
    method: 'GET',
    headers: { Cookie: 'akuosplash_session=' + token },
  }, (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      try {
        const j = JSON.parse(data);
        if (j.comunas) {
          var coquimbo = j.comunas.find(function(c) { return c.codComuna === 4102 || c.codComuna === '4102'; });
          if (coquimbo) {
            console.log('Coquimbo (4102):');
            console.log('  zona activa:', coquimbo.zona ? coquimbo.zona.activa : 'NO zona');
            console.log('  subZonas count:', coquimbo.subZonas ? coquimbo.subZonas.length : 0);
            if (coquimbo.subZonas && coquimbo.subZonas.length > 0) {
              var cruz = coquimbo.subZonas.find(function(s) { return s.nombre && s.nombre.toLowerCase().indexOf('cruz') >= 0; });
              console.log('  "cruz de caña" found:', cruz ? 'YES — ' + JSON.stringify(cruz) : 'NO');
              console.log('  all subzonas:', coquimbo.subZonas.map(function(s) { return s.nombre; }).join(', '));
            } else {
              console.log('  NO subzonas returned!');
            }
          } else {
            console.log('Comuna 4102 NOT found in response');
            console.log('Total comunas:', j.comunas.length);
          }
        } else {
          console.log('Keys:', Object.keys(j));
          console.log('Response:', data.substring(0, 300));
        }
      } catch (e) {
        console.log('Parse error:', e.message);
        console.log('Raw:', data.substring(0, 500));
      }
    });
  });
  req.on('error', (e) => console.error('Request error:', e.message));
  req.end();
})();
