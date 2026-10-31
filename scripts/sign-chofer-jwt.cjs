const { SignJWT } = require('/home/z/my-project/node_modules/jose');
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
  // Print just the token (no newline)
  process.stdout.write(token);
})();
