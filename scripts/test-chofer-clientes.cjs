const { SignJWT } = require('/home/z/my-project/node_modules/jose');
const http = require('http');

(async () => {
  const secret = new TextEncoder().encode('aljibe-app-dev-secret-change-in-production');
  const token = await new SignJWT({
    userId: 'cmthfsxij0001kv04d0kran1x',
    email: 'jeremymichelraymond@gmail.com',
    nombre: 'Jeremy Michel Raymond',
    role: 'chofer',
    duenoId: 'cmthcb85x0001ld046apm4yuu',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .setIssuedAt()
    .sign(secret);
  console.log('Token signed, length:', token.length);

  // Call /api/clientes with this token
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/clientes',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: `aljibe-session=${token}`,
    },
  };
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      try {
        const j = JSON.parse(data);
        if (j.clientes) {
          console.log('Clientes count:', j.clientes.length);
          console.log('First 3:', j.clientes.slice(0, 3).map(c => ({ nombre: c.nombre, lat: c.lat, lng: c.lng })));
          const conGps = j.clientes.filter(c => c.lat != null && c.lng != null);
          console.log('Con GPS:', conGps.length);
        } else {
          console.log('Response:', JSON.stringify(j).substring(0, 300));
        }
      } catch (e) {
        console.log('Raw response:', data.substring(0, 500));
      }
    });
  });
  req.on('error', (e) => console.error('Request error:', e.message));
  req.end();
})();
