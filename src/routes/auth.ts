import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash)))
      return res.status(401).json({ error: 'Credenciales inválidas' });

    const payload = {
      id: rows[0].id,
      email: rows[0].email,
      role: rows[0].role,
      scrumMasterId: rows[0].scrum_master_id ?? null,
      sedeFiltro: rows[0].sede_filtro ?? null,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '8h' });
    res.json({ token, user: payload });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/version', (_req, res) => res.json({ version: '2026-04-29-v1' }));

router.post('/migrate', async (req, res) => {
  if (req.headers['x-import-secret'] !== process.env.IMPORT_SECRET)
    return res.status(403).json({ error: 'Forbidden' });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS asistencias_turno (
        id SERIAL PRIMARY KEY,
        employee_id TEXT NOT NULL,
        fecha DATE NOT NULL,
        turno SMALLINT NOT NULL CHECK (turno IN (1,2,3)),
        status VARCHAR(20) NOT NULL CHECK (status IN ('Presente','Falta')),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(employee_id, fecha, turno)
      );
      ALTER TABLE justificaciones ADD COLUMN IF NOT EXISTS turno SMALLINT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS scrum_master_id TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS sede_filtro TEXT;
    `);
    res.json({ success: true, message: 'Migraciones aplicadas' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/seed-scrum-users', async (req, res) => {
  if (req.headers['x-import-secret'] !== process.env.IMPORT_SECRET)
    return res.status(403).json({ error: 'Forbidden' });

  const DEFAULT_PASSWORD = 'Inei@2025';

  function toEmail(nombre: string): string {
    const normalize = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const parts = nombre.trim().split(/\s+/);
    if (parts.length === 1) return `${normalize(parts[0])}@inei.gob.pe`;
    const allUpper = parts.every(p => p === p.toUpperCase());
    if (allUpper) {
      return `${normalize(parts[parts.length - 1])}.${normalize(parts[0])}@inei.gob.pe`;
    }
    return `${normalize(parts[0])}.${normalize(parts[1])}@inei.gob.pe`;
  }

  let client: any;
  try {
    client = await pool.connect();
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS scrum_master_id TEXT`);
    const { rows: masters } = await client.query(
      `SELECT id, nombre_scrum_master FROM scrum_masters WHERE activo = true ORDER BY nombre_scrum_master`
    );
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const results: any[] = [];

    for (const sm of masters) {
      const email = toEmail(sm.nombre_scrum_master);
      const { rows: existing } = await client.query(
        `SELECT id, email FROM users WHERE email = $1 OR scrum_master_id = $2`,
        [email, sm.id]
      );
      if (existing.length > 0) {
        results.push({ nombre: sm.nombre_scrum_master, email: existing[0].email, estado: 'ya_existe' });
        continue;
      }
      await client.query(
        `INSERT INTO users (email, password_hash, role, scrum_master_id) VALUES ($1, $2, 'scrum_master', $3)`,
        [email, hash, sm.id]
      );
      results.push({ nombre: sm.nombre_scrum_master, email, estado: 'creado' });
    }

    res.json({ password_default: DEFAULT_PASSWORD, usuarios: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
});

router.post('/create-sede-user', async (req, res) => {
  if (req.headers['x-import-secret'] !== process.env.IMPORT_SECRET)
    return res.status(403).json({ error: 'Forbidden' });

  const { email, password, sede_filtro } = req.body;
  if (!email || !password || !sede_filtro)
    return res.status(400).json({ error: 'email, password y sede_filtro requeridos' });

  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sede_filtro TEXT`);
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0)
      return res.json({ estado: 'ya_existe', email });

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (email, password_hash, role, sede_filtro) VALUES ($1, $2, 'registrador', $3)`,
      [email, hash, sede_filtro]
    );
    res.json({ estado: 'creado', email, sede_filtro });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
