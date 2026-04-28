import { Router } from 'express';
import pool from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/asistencias?fecha=2024-01-15
router.get('/', requireAuth, async (req, res) => {
  try {
    const { fecha, from, to } = req.query;
    let query = `
      SELECT a.employee_id, a.status,
        TO_CHAR(a.fecha, 'YYYY-MM-DD') AS fecha,
        e.apellidos_nombres, e.dni, e.orden,
        s.nombre_sede
      FROM asistencias a
      JOIN empleados e ON a.employee_id = e.id
      LEFT JOIN sedes s ON e.sede_id = s.id
    `;
    const params: any[] = [];
    if (fecha) {
      params.push(fecha);
      query += ` WHERE a.fecha = $1`;
    } else if (from && to) {
      params.push(from, to);
      query += ` WHERE a.fecha >= $1 AND a.fecha <= $2`;
    }
    query += ' ORDER BY e.orden NULLS LAST, e.apellidos_nombres';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/asistencias/batch — guarda múltiples asistencias a la vez
router.post('/batch', requireAuth, async (req, res) => {
  const { fecha, records } = req.body;
  // records: [{ employee_id, status, justification_type?, justification_notes? }]
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of records) {
      await client.query(
        `INSERT INTO asistencias (employee_id, fecha, status, justification_type, justification_notes)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (employee_id, fecha) DO UPDATE
         SET status = EXCLUDED.status,
             justification_type = EXCLUDED.justification_type,
             justification_notes = EXCLUDED.justification_notes`,
        [r.employee_id, fecha, r.status, r.justification_type ?? null, r.justification_notes ?? null]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, count: records.length });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { employee_id, fecha, status, justification_type, justification_notes } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO asistencias (employee_id, fecha, status, justification_type, justification_notes)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (employee_id, fecha) DO UPDATE
       SET status = EXCLUDED.status,
           justification_type = EXCLUDED.justification_type,
           justification_notes = EXCLUDED.justification_notes
       RETURNING *`,
      [employee_id, fecha, status, justification_type, justification_notes]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
