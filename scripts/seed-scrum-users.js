/**
 * Crea cuentas de usuario para todos los Scrum Masters activos.
 * Email: primernombre.primerapellido@inei.gob.pe
 * Contraseña por defecto: Inei@2025
 *
 * Uso: node scripts/seed-scrum-users.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DEFAULT_PASSWORD = 'Inei@2025';

function toEmail(nombreCompleto) {
  // Normaliza: quita tildes y caracteres especiales
  const normalize = (s) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // nombre_scrum_master puede venir como "APELLIDO1 APELLIDO2 Nombres"
  // o "Nombres APELLIDO1 APELLIDO2" — asumimos formato INEI: APELLIDOS NOMBRES
  const parts = nombreCompleto.trim().split(/\s+/);

  if (parts.length === 1) return `${normalize(parts[0])}@inei.gob.pe`;

  // Heurística: si todo está en mayúsculas, probablemente es apellidos + nombres
  const allUpper = parts.every(p => p === p.toUpperCase());
  if (allUpper) {
    // Tomamos primera palabra como primer apellido y última como primer nombre
    const primerApellido = parts[0];
    const primerNombre = parts[parts.length - 1];
    return `${normalize(primerNombre)}.${normalize(primerApellido)}@inei.gob.pe`;
  }

  // Mixto: tomamos las dos primeras palabras
  return `${normalize(parts[0])}.${normalize(parts[1])}@inei.gob.pe`;
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows: masters } = await client.query(
      `SELECT id, nombre_scrum_master FROM scrum_masters WHERE activo = true ORDER BY nombre_scrum_master`
    );

    if (masters.length === 0) {
      console.log('No se encontraron scrum masters activos.');
      return;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const results = [];

    for (const sm of masters) {
      const email = toEmail(sm.nombre_scrum_master);

      // Verificar si ya existe
      const { rows: existing } = await client.query(
        `SELECT id, email FROM users WHERE email = $1 OR scrum_master_id = $2`,
        [email, sm.id]
      );

      if (existing.length > 0) {
        results.push({ nombre: sm.nombre_scrum_master, email: existing[0].email, estado: 'YA EXISTE', id: existing[0].id });
        continue;
      }

      const { rows: inserted } = await client.query(
        `INSERT INTO users (email, password_hash, role, scrum_master_id)
         VALUES ($1, $2, 'scrum_master', $3)
         RETURNING id, email`,
        [email, passwordHash, sm.id]
      );

      results.push({ nombre: sm.nombre_scrum_master, email: inserted[0].email, estado: 'CREADO', id: inserted[0].id });
    }

    console.log('\n=== CUENTAS SCRUM MASTER ===\n');
    console.log(`Contraseña por defecto: ${DEFAULT_PASSWORD}\n`);
    console.log('NOMBRE'.padEnd(40) + 'EMAIL'.padEnd(45) + 'ESTADO');
    console.log('-'.repeat(100));
    results.forEach(r => {
      console.log(r.nombre.padEnd(40) + r.email.padEnd(45) + r.estado);
    });
    console.log(`\nTotal: ${results.length} scrum masters procesados.`);
    console.log(`Creados: ${results.filter(r => r.estado === 'CREADO').length}`);
    console.log(`Ya existían: ${results.filter(r => r.estado === 'YA EXISTE').length}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
