import { Router } from 'express';
import pool from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/asistencias', requireAuth, async (req, res) => {
  const { from, to, status, justificado } = req.query;

  const conditions: string[] = [];
  const params: any[] = [];

  if (from) { params.push(from); conditions.push(`a.fecha >= $${params.length}`); }
  if (to)   { params.push(to);   conditions.push(`a.fecha <= $${params.length}`); }

  if (status === 'falta') {
    if (justificado === 'si')   conditions.push(`a.status = 'Falta Justificada'`);
    else if (justificado === 'no') conditions.push(`a.status = 'Falta'`);
    else conditions.push(`a.status IN ('Falta', 'Falta Justificada')`);
  } else if (status === 'tardanza') {
    if (justificado === 'si')   conditions.push(`a.status = 'Tardanza Justificada'`);
    else if (justificado === 'no') conditions.push(`a.status = 'Tardanza'`);
    else conditions.push(`a.status IN ('Tardanza', 'Tardanza Justificada')`);
  } else {
    conditions.push(`a.status NOT IN ('No Registrado')`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(a.fecha, 'YYYY-MM-DD') AS fecha,
        a.status,
        e.apellidos_nombres,
        e.dni,
        s.nombre_sede,
        j.tipo  AS justificacion_tipo,
        j.notas AS justificacion_notas
      FROM asistencias a
      JOIN empleados e ON a.employee_id = e.id
      LEFT JOIN sedes s ON e.sede_id = s.id
      LEFT JOIN justificaciones j ON j.employee_id = a.employee_id AND j.fecha = a.fecha
      ${where}
      ORDER BY a.fecha DESC, e.apellidos_nombres
    `, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
