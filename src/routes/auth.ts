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

    const token = jwt.sign(
      { id: rows[0].id, email: rows[0].email, role: rows[0].role, scrumMasterId: rows[0].scrum_master_id ?? null },
      process.env.JWT_SECRET!,
      { expiresIn: '8h' }
    );
    res.json({ token, user: { id: rows[0].id, email: rows[0].email, role: rows[0].role, scrumMasterId: rows[0].scrum_master_id ?? null } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/version', (_req, res) => res.json({ version: '2026-04-28-v2' }));

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
    // Asegurar que la columna scrum_master_id exista
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS scrum_master_id INTEGER REFERENCES scrum_masters(id)
    `);
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

export default router;
