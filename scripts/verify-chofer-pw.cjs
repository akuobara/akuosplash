const crypto = require('crypto');
const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});
function verify(password, stored) {
  try {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
  } catch { return false; }
}
(async () => {
  const r = await c.execute("SELECT email, telefono, nombre, passwordHash FROM Usuario WHERE email = 'jeremymichelraymond@gmail.com'");
  const u = r.rows[0];
  console.log('User:', u.email, u.telefono);
  const candidates = ['Test1234!', 'test1234', 'password', '123456', 'admin', 'chofer', 'aljibe', 'agua', 'transporte', 'Jeremy', 'jeremy', 'J12345678!', 'Password1!', 'qwerty', 'VMspa123', 'transportevmspa', 'Transporte1!', 'aguacolor', 'aguacate', 'tomas123', 'aljibe123', 'aljibeapp'];
  for (const p of candidates) {
    if (verify(p, u.passwordHash)) { console.log('MATCH:', p); return; }
  }
  console.log('No match found among', candidates.length, 'candidates');
})();
