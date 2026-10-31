const { SignJWT, jwtVerify } = require('/home/z/my-project/node_modules/jose');
const http = require('http');

async function tryToken(secret) {
  const enc = new TextEncoder().encode(secret);
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
    .sign(enc);

  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost', port: 3000, path: '/api/clientes', method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Cookie: `aljibe-session=${token}` },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data.substring(0, 200) }));
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.end();
  });
}

(async () => {
  const secrets = [
    'aljibe-app-dev-secret-change-in-production',
    process.env.JWT_SECRET,
    'aljibe-app-secret',
    'secret',
    'change-me',
  ];
  for (const s of secrets) {
    if (!s) continue;
    const r = await tryToken(s);
    console.log(`Secret "${s.substring(0,30)}..." → ${r.status || r.error}: ${r.body || ''}`);
  }
})();
