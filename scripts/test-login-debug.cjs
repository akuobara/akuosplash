const crypto = require('crypto');
const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

(async () => {
  const r = await c.execute({
    sql: "SELECT passwordHash FROM AkuoUsuario WHERE email = ? LIMIT 1",
    args: ['transtest3@akuosplash.test']
  });
  
  const hashStr = String(r.rows[0].passwordHash);
  console.log('Hash:', hashStr.substring(0, 50) + '...');
  console.log('Has colon:', hashStr.includes(':'));
  console.log('Starts with $2:', hashStr.startsWith('$2'));
  
  // Try scrypt
  const [salt, hash] = hashStr.split(':');
  console.log('Salt length:', salt?.length);
  console.log('Hash length:', hash?.length);
  
  const verifyHash = crypto.scryptSync('Test1234!', salt, 64).toString('hex');
  console.log('Verify hash length:', verifyHash.length);
  console.log('Match:', verifyHash === hash);
  
  // Try bcrypt
  const bcrypt = require('bcryptjs');
  const bcryptMatch = await bcrypt.compare('Test1234!', hashStr);
  console.log('Bcrypt match:', bcryptMatch);
})();
