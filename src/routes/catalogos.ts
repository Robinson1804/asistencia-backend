import { Router } from 'express';
import pool from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

function crudRoutes(table: string, fields: string[]) {
  const r = Router();

  r.get('/', requireAuth, async (_req, res) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM ${table} ORDER BY id`);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  r.post('/', requireAuth, async (req, res) => {
    const values = fields.map(f => req.body[f]);
    const cols = fields.join(', ');
    const params = fields.map((_, i) => `$${i + 1}`).join(', ');
    try {
      const { rows } = await pool.query(
        `INSERT INTO ${table} (${cols}) VALUES (${params}) RETURNING *`, values
      );
      res.status(201).json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  r.put('/:id', requireAuth, async (req, res) => {
    const keys = Object.keys(req.body);
    const vals = Object.values(req.body);
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    try {
      const { rows } = await pool.query(
        `UPDATE ${table} SET ${set} WHERE id = $${keys.length + 1} RETURNING *`,
        [...vals, req.params.id]
      );
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  r.delete('/:id', requireAuth, async (req, res) => {
    try {
      await pool.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  return r;
}

export const sedesRouter = crudRoutes('sedes', ['nombre_sede', 'direccion', 'activo']);
export const divisionesRouter = crudRoutes('divisiones', ['nombre_division', 'descripcion', 'activo']);
export const dttRouter = crudRoutes('dtt', ['nombre_dtt', 'codigo_dtt', 'descripcion']);
export const proyectosRouter = crudRoutes('proyectos', ['codigo_proyecto', 'nombre_proyecto', 'descripcion', 'activo']);
export const modalidadesRouter = crudRoutes('modalidades', ['nombre_modalidad', 'descripcion']);
export const tiposContratoRouter = crudRoutes('tipos_contrato', ['tipo_contrato', 'descripcion']);
export const coordinadoresRouter = crudRoutes('coordinadores', ['nombre_coordinador', 'activo']);
export const scrumMastersRouter = crudRoutes('scrum_masters', ['nombre_scrum_master', 'activo']);

export const justificacionesRouter = (() => {
  const r = Router();
  r.get('/', requireAuth, async (req, res) => {
    try {
      const { employee_id, fecha } = req.query;
      let q = 'SELECT * FROM justificaciones WHERE 1=1';
      const params: any[] = [];
      if (employee_id) { params.push(employee_id); q += ` AND employee_id = $${params.length}`; }
      if (fecha) { params.push(fecha); q += ` AND fecha = $${params.length}`; }
      const { rows } = await pool.query(q, params);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  r.post('/', requireAuth, async (req, res) => {
    const { employee_id, fecha, tipo, notas } = req.body;
    try {
      const { rows } = await pool.query(
        `INSERT INTO justificaciones (employee_id, fecha, tipo, notas) VALUES ($1,$2,$3,$4) RETURNING *`,
        [employee_id, fecha, tipo, notas]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  return r;
})();

export default router;
