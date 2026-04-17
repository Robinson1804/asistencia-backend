import { readFileSync } from 'fs';
import { join } from 'path';
import pool from '../src/db';

async function migrate() {
  const sql = readFileSync(join(__dirname, '../migrations/001_schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    console.log('🚀 Ejecutando schema SQL en Railway...\n');
    await client.query(sql);
    console.log('✅ Schema creado correctamente en PostgreSQL');
  } catch (err: any) {
    console.error('❌ Error al ejecutar el schema:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
