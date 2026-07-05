require('dotenv').config();
const fs = require('fs');
const mysql = require('mysql2/promise');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const u = new URL(url);
  const c = await mysql.createConnection({
    host: u.hostname,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
    multipleStatements: true,
  });

  const sql = fs.readFileSync(require('path').join(__dirname, '001_guests.sql'), 'utf8');
  const parts = sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    try {
      await c.query(part);
      console.log('OK:', part.split('\n')[0].slice(0, 60));
    } catch (e) {
      if (/Duplicate|already exists|check that column\/key exists/i.test(e.message)) {
        console.log('SKIP:', e.message);
      } else {
        throw e;
      }
    }
  }

  await c.end();
  console.log('Migration done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
