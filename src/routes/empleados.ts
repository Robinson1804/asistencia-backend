import { Router } from 'express';
import pool from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.*,
        s.nombre_sede, s.direccion as sede_direccion,
        d.nombre_dtt, d.codigo_dtt,
        p.nombre_proyecto, p.codigo_proyecto,
        m.nombre_modalidad,
        tc.tipo_contrato,
        div.nombre_division,
        c.nombre_coordinador,
        sm.nombre_scrum_master
      FROM empleados e
      LEFT JOIN sedes s ON e.sede_id = s.id
      LEFT JOIN dtt d ON e.dtt_id = d.id
      LEFT JOIN proyectos p ON e.proyecto_id = p.id
      LEFT JOIN modalidades m ON e.modalidad_id = m.id
      LEFT JOIN tipos_contrato tc ON e.tipo_contrato_id = tc.id
      LEFT JOIN relaciones_division rd ON e.relacion_division_id = rd.id
      LEFT JOIN divisiones div ON rd.division_id = div.id
      LEFT JOIN coordinadores c ON rd.coordinador_id = c.id
      LEFT JOIN scrum_masters sm ON rd.scrum_master_id = sm.id
      ORDER BY e.orden NULLS LAST, e.apellidos_nombres
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM empleados WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { dni, apellidos_nombres, orden, email, telefono, activo, avatar_url, edad,
    correo_personal, fecha_inicio, fecha_fin, sede_id, dtt_id, proyecto_id,
    modalidad_id, tipo_contrato_id, relacion_division_id } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO empleados (dni, apellidos_nombres, orden, email, telefono, activo,
         avatar_url, edad, correo_personal, fecha_inicio, fecha_fin,
         sede_id, dtt_id, proyecto_id, modalidad_id, tipo_contrato_id, relacion_division_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [dni, apellidos_nombres, orden, email, telefono, activo ?? true, avatar_url, edad,
       correo_personal, fecha_inicio, fecha_fin, sede_id, dtt_id, proyecto_id,
       modalidad_id, tipo_contrato_id, relacion_division_id]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const fields = req.body;
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  try {
    const { rows } = await pool.query(
      `UPDATE empleados SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE empleados SET activo = false WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
