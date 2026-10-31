const { SignJWT } = require('/home/z/my-project/node_modules/jose');
const http = require('http');

async function signToken(secret) {
  const enc = new TextEncoder().encode(secret);
  return await new SignJWT({
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
}

function call(headers, label) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost', port: 3000, path: '/api/clientes', method: 'GET', headers,
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        console.log(`${label}: ${res.statusCode} - ${data.substring(0,150)}`);
        resolve();
      });
    });
    req.on('error', (e) => { console.log(`${label}: ERROR ${e.message}`); resolve(); });
    req.end();
  });
}

(async () => {
  const secret = 'aljibe-app-dev-secret-change-in-production';
  const token = await signToken(secret);
  
  // Test 1: only Authorization header
  await call({ Authorization: `Bearer ${token}` }, 'AUTH header only');
  // Test 2: only Cookie
  await call({ Cookie: `aljibe-session=${token}` }, 'COOKIE only');
  // Test 3: both
  await call({ Authorization: `Bearer ${token}`, Cookie: `aljibe-session=${token}` }, 'BOTH');
  // Test 4: check /api/auth/me with cookie
  await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost', port: 3000, path: '/api/auth/me', method: 'GET',
      headers: { Cookie: `aljibe-session=${token}` },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { console.log(`AUTH/me: ${res.statusCode} - ${data.substring(0,150)}`); resolve(); });
    });
    req.end();
  });
})();
