import { Router } from 'express';
import pool from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

function computeDailyStatus(statuses: string[]): string {
  const present = statuses.filter(s => s === 'Presente').length;
  if (present >= 3) return 'Presente';
  if (present >= 2) return 'Tardanza';
  return 'Falta';
}

router.get('/', requireAuth, async (req, res) => {
  const { fecha, from, to } = req.query;
  try {
    let q: string;
    let params: any[];
    if (fecha) {
      q = `SELECT at.employee_id, at.turno, at.status,
                  TO_CHAR(at.fecha, 'YYYY-MM-DD') AS fecha, e.dni
           FROM asistencias_turno at
           JOIN empleados e ON at.employee_id = e.id::text
           WHERE TO_CHAR(at.fecha, 'YYYY-MM-DD') = $1`;
      params = [fecha];
    } else if (from && to) {
      q = `SELECT at.employee_id, at.turno, at.status,
                  TO_CHAR(at.fecha, 'YYYY-MM-DD') AS fecha, e.dni
           FROM asistencias_turno at
           JOIN empleados e ON at.employee_id = e.id::text
           WHERE at.fecha BETWEEN $1::date AND $2::date`;
      params = [from, to];
    } else {
      return res.status(400).json({ error: 'fecha o from/to requeridos' });
    }
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/batch', requireAuth, async (req, res) => {
  const { fecha, turno, records } = req.body;
  if (!fecha || !turno || !records?.length) return res.status(400).json({ error: 'Datos incompletos' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of records) {
      await client.query(
        `INSERT INTO asistencias_turno (employee_id, fecha, turno, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (employee_id, fecha, turno) DO UPDATE SET status = EXCLUDED.status`,
        [r.employee_id, fecha, turno, r.status]
      );
      // Compute and update daily status in asistencias
      const { rows: turnos } = await client.query(
        `SELECT status FROM asistencias_turno WHERE employee_id = $1 AND TO_CHAR(fecha, 'YYYY-MM-DD') = $2`,
        [r.employee_id, fecha]
      );
      const daily = computeDailyStatus(turnos.map((t: any) => t.status));
      await client.query(
        `INSERT INTO asistencias (employee_id, fecha, status)
         VALUES ($1, $2, $3)
         ON CONFLICT (employee_id, fecha) DO UPDATE SET status = EXCLUDED.status`,
        [r.employee_id, fecha, daily]
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

export default router;
