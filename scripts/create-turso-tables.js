const { createClient } = require('@libsql/client');

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

console.log('Conectando a:', url);

const client = createClient({ url, authToken });

async function main() {
  // Leer el schema de Prisma y generar SQL
  const { execSync } = require('child_process');
  
  // Generar el SQL del schema
  const sql = execSync('npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script', {
    cwd: '/home/z/my-project',
    encoding: 'utf-8',
  });
  
  console.log('SQL generado, ejecutando en Turso...');
  
  // Ejecutar cada statement
  const statements = sql.split(';').filter(s => s.trim());
  console.log(`Ejecutando ${statements.length} statements...`);
  
  for (const stmt of statements) {
    if (stmt.trim()) {
      try {
        await client.execute(stmt);
      } catch (e) {
        console.error('Error:', e.message, 'en:', stmt.substring(0, 80));
      }
    }
  }
  
  console.log('¡Tablas creadas en Turso!');
  
  // Verificar
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('\nTablas creadas:');
  for (const row of tables.rows) {
    console.log('  -', row.name);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
