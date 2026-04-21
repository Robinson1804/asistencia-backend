import { Router } from 'express';
import pool from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

function crudRoutes(table: string, fields: string[]) {
  const r = Router();

  r.get('/', requireAuth, async (req, res) => {
    try {
      const { activo } = req.query;
      const where = activo === 'true' ? `WHERE activo = true` : activo === 'false' ? `WHERE activo = false` : '';
      const { rows } = await pool.query(`SELECT * FROM ${table} ${where} ORDER BY id`);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  r.get('/:id', requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
      res.json(rows[0]);
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

export const conocimientosRouter = (() => {
  const r = Router();
  r.get('/:employeeId', requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM conocimientos_empleado WHERE employee_id = $1', [req.params.employeeId]);
      res.json(rows[0] || null);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  r.post('/', requireAuth, async (req, res) => {
    const { employee_id, grado_instruccion, grado_instruccion_otro, cargo, cargo_otro, anos_experiencia,
      frontend, backend, databases, devops, proyectos_otin, tecnologias_aprender, otras_tecnologias } = req.body;
    try {
      const { rows } = await pool.query(`
        INSERT INTO conocimientos_empleado
          (employee_id, grado_instruccion, grado_instruccion_otro, cargo, cargo_otro, anos_experiencia,
           frontend, backend, databases, devops, proyectos_otin, tecnologias_aprender, otras_tecnologias)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (employee_id) DO UPDATE SET
          grado_instruccion=$2, grado_instruccion_otro=$3, cargo=$4, cargo_otro=$5, anos_experiencia=$6,
          frontend=$7, backend=$8, databases=$9, devops=$10, proyectos_otin=$11,
          tecnologias_aprender=$12, otras_tecnologias=$13, updated_at=NOW()
        RETURNING *`,
        [employee_id, grado_instruccion, grado_instruccion_otro, cargo, cargo_otro, anos_experiencia,
         JSON.stringify(frontend), JSON.stringify(backend), JSON.stringify(databases), JSON.stringify(devops),
         proyectos_otin, tecnologias_aprender, otras_tecnologias]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  return r;
})();

export const relacionesDivisionRouter = (() => {
  const r = Router();

  r.get('/', requireAuth, async (_req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT rd.*, sm.nombre_scrum_master, c.nombre_coordinador, d.nombre_division
        FROM relaciones_division rd
        LEFT JOIN scrum_masters sm ON rd.scrum_master_id = sm.id
        LEFT JOIN coordinadores c ON rd.coordinador_id = c.id
        LEFT JOIN divisiones d ON rd.division_id = d.id
        ORDER BY sm.nombre_scrum_master
      `);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  r.post('/', requireAuth, async (req, res) => {
    const { scrum_master_id, coordinador_id, division_id } = req.body;
    try {
      const { rows } = await pool.query(
        `INSERT INTO relaciones_division (scrum_master_id, coordinador_id, division_id) VALUES ($1,$2,$3) RETURNING *`,
        [scrum_master_id, coordinador_id, division_id]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  r.put('/:id', requireAuth, async (req, res) => {
    const { scrum_master_id, coordinador_id, division_id } = req.body;
    try {
      const { rows } = await pool.query(
        `UPDATE relaciones_division SET scrum_master_id=$1, coordinador_id=$2, division_id=$3 WHERE id=$4 RETURNING *`,
        [scrum_master_id, coordinador_id, division_id, req.params.id]
      );
      res.json(rows[0]);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  r.delete('/:id', requireAuth, async (req, res) => {
    try {
      await pool.query(`DELETE FROM relaciones_division WHERE id=$1`, [req.params.id]);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  return r;
})();

export const justificacionesRouter = (() => {
  const r = Router();
  r.get('/', requireAuth, async (req, res) => {
    try {
      const { employee_id, fecha } = req.query;
      let q = `SELECT j.*, e.dni FROM justificaciones j JOIN empleados e ON j.employee_id = e.id WHERE 1=1`;
      const params: any[] = [];
      if (employee_id) { params.push(employee_id); q += ` AND j.employee_id = $${params.length}`; }
      if (fecha) { params.push(fecha); q += ` AND j.fecha = $${params.length}`; }
      const { rows } = await pool.query(q, params);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  r.post('/', requireAuth, async (req, res) => {
    const { employee_id, fecha, tipo, notas } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query(
        `SELECT id FROM justificaciones WHERE employee_id=$1 AND fecha=$2`,
        [employee_id, fecha]
      );
      let rows;
      if (existing.rows[0]) {
        ({ rows } = await client.query(
          `UPDATE justificaciones SET tipo=$3, notas=$4 WHERE employee_id=$1 AND fecha=$2 RETURNING *`,
          [employee_id, fecha, tipo, notas]
        ));
      } else {
        ({ rows } = await client.query(
          `INSERT INTO justificaciones (employee_id, fecha, tipo, notas) VALUES ($1,$2,$3,$4) RETURNING *`,
          [employee_id, fecha, tipo, notas]
        ));
      }
      await client.query(
        `UPDATE asistencias SET status = 'Falta Justificada'
         WHERE employee_id = $1 AND fecha = $2`,
        [employee_id, fecha]
      );
      await client.query('COMMIT');
      res.status(201).json(rows[0]);
    } catch (err: any) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });
  return r;
})();

export default router;
