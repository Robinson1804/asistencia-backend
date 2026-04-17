import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import pool from '../db';

const router = Router();

router.post('/import', async (req, res) => {
  const { secret } = req.body;
  if (secret !== process.env.IMPORT_SECRET) {
    return res.status(403).json({ error: 'Clave incorrecta' });
  }

  const possiblePaths = [
    path.join(__dirname, '../../scripts/firestore-export.json'),
    path.join(__dirname, '../scripts/firestore-export.json'),
    path.join(process.cwd(), 'scripts/firestore-export.json'),
  ];

  let exportPath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) { exportPath = p; break; }
  }

  if (!exportPath) {
    return res.status(404).json({ error: 'No se encontró firestore-export.json' });
  }

  const raw = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  const maps: Record<string, Record<string, string>> = {
    sedes: {}, divisiones: {}, dtt: {}, proyectos: {},
    modalidades: {}, tiposContrato: {}, coordinadores: {},
    scrumMasters: {}, relacionesDivision: {}, empleados: {},
  };

  function toDate(val: any): string | null {
    if (!val) return null;
    if (val._type === 'Timestamp') return val.value;
    if (typeof val === 'string') return val;
    return null;
  }

  const client = await pool.connect();
  const results: Record<string, number> = {};

  try {
    await client.query('BEGIN');

    // 1. Sedes
    let c = 0;
    for (const [fbId, doc] of Object.entries(raw.sedes || {}) as any) {
      const r = await client.query(
        `INSERT INTO sedes (nombre_sede, direccion, activo) VALUES ($1,$2,$3) RETURNING id`,
        [doc.nombreSede ?? 'Sin nombre', doc.direccion ?? null, doc.activo ?? true]
      );
      maps.sedes[fbId] = r.rows[0].id; c++;
    }
    results.sedes = c;

    // 2. Divisiones
    c = 0;
    for (const [fbId, doc] of Object.entries(raw.divisiones || {}) as any) {
      const r = await client.query(
        `INSERT INTO divisiones (nombre_division, descripcion, activo) VALUES ($1,$2,$3) RETURNING id`,
        [doc.nombreDivision ?? 'Sin nombre', doc.descripcion ?? null, doc.activo ?? true]
      );
      maps.divisiones[fbId] = r.rows[0].id; c++;
    }
    results.divisiones = c;

    // 3. DTT
    c = 0;
    for (const [fbId, doc] of Object.entries(raw.dtt || {}) as any) {
      const r = await client.query(
        `INSERT INTO dtt (nombre_dtt, codigo_dtt, descripcion) VALUES ($1,$2,$3) RETURNING id`,
        [doc.nombreDTT ?? 'Sin nombre', doc.codigoDTT ?? null, doc.descripcion ?? null]
      );
      maps.dtt[fbId] = r.rows[0].id; c++;
    }
    results.dtt = c;

    // 4. Proyectos
    c = 0;
    for (const [fbId, doc] of Object.entries(raw.proyectos || {}) as any) {
      const r = await client.query(
        `INSERT INTO proyectos (codigo_proyecto, nombre_proyecto, descripcion, activo) VALUES ($1,$2,$3,$4) RETURNING id`,
        [doc.codigoProyecto ?? null, doc.nombreProyecto ?? 'Sin nombre', doc.descripcion ?? null, doc.activo ?? true]
      );
      maps.proyectos[fbId] = r.rows[0].id; c++;
    }
    results.proyectos = c;

    // 5. Modalidades
    c = 0;
    for (const [fbId, doc] of Object.entries(raw.modalidades || {}) as any) {
      const r = await client.query(
        `INSERT INTO modalidades (nombre_modalidad, descripcion) VALUES ($1,$2) RETURNING id`,
        [doc.nombreModalidad ?? 'Sin nombre', doc.descripcion ?? null]
      );
      maps.modalidades[fbId] = r.rows[0].id; c++;
    }
    results.modalidades = c;

    // 6. Tipos Contrato
    c = 0;
    for (const [fbId, doc] of Object.entries(raw.tiposContrato || {}) as any) {
      const r = await client.query(
        `INSERT INTO tipos_contrato (tipo_contrato, descripcion) VALUES ($1,$2) RETURNING id`,
        [doc.tipoContrato ?? 'Sin nombre', doc.descripcion ?? null]
      );
      maps.tiposContrato[fbId] = r.rows[0].id; c++;
    }
    results.tiposContrato = c;

    // 7. Coordinadores
    c = 0;
    const coordSource = raw.coordinadoresDivision || raw.coordinadoresDivisiones || raw.coordinadores || {};
    for (const [fbId, doc] of Object.entries(coordSource) as any) {
      if (!doc.nombreCoordinador) continue;
      const r = await client.query(
        `INSERT INTO coordinadores (nombre_coordinador, activo) VALUES ($1,$2) RETURNING id`,
        [doc.nombreCoordinador, doc.activo ?? true]
      );
      maps.coordinadores[fbId] = r.rows[0].id; c++;
    }
    results.coordinadores = c;

    // 8. Scrum Masters
    c = 0;
    for (const [fbId, doc] of Object.entries(raw.scrumMasters || {}) as any) {
      const r = await client.query(
        `INSERT INTO scrum_masters (nombre_scrum_master, activo) VALUES ($1,$2) RETURNING id`,
        [doc.nombreScrumMaster ?? 'Sin nombre', doc.activo ?? true]
      );
      maps.scrumMasters[fbId] = r.rows[0].id; c++;
    }
    results.scrumMasters = c;

    // 9. Relaciones División
    c = 0;
    for (const [fbId, doc] of Object.entries(raw.relacionesDivision || raw.relacionDivisiones || {}) as any) {
      const r = await client.query(
        `INSERT INTO relaciones_division (coordinador_id, division_id, scrum_master_id) VALUES ($1,$2,$3) RETURNING id`,
        [maps.coordinadores[doc.coordinadorId] ?? null, maps.divisiones[doc.divisionId] ?? null, maps.scrumMasters[doc.scrumMasterId] ?? null]
      );
      maps.relacionesDivision[fbId] = r.rows[0].id; c++;
    }
    results.relacionesDivision = c;

    // 10. Empleados
    c = 0;
    for (const [fbId, doc] of Object.entries(raw.empleados || {}) as any) {
      if (!doc.dni && !doc.DNI) continue;
      try {
        const r = await client.query(
          `INSERT INTO empleados (
             dni, apellidos_nombres, orden, email, telefono,
             activo, avatar_url, edad, correo_personal, fecha_inicio, fecha_fin,
             sede_id, dtt_id, proyecto_id, modalidad_id, tipo_contrato_id, relacion_division_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           ON CONFLICT (dni) DO NOTHING RETURNING id`,
          [
            doc.dni ?? doc.DNI,
            doc.apellidosNombres ?? 'Sin nombre', doc.orden ?? null,
            doc.email ?? null, doc.telefono ?? null, doc.activo ?? true,
            doc.avatarUrl ?? null, doc.edad ?? null, doc.correoPersonal ?? null,
            toDate(doc.fechaInicio), toDate(doc.fechaFin),
            maps.sedes[doc.sedeId] ?? null, maps.dtt[doc.dttId] ?? null,
            maps.proyectos[doc.proyectoId] ?? null, maps.modalidades[doc.modalidadId] ?? null,
            maps.tiposContrato[doc.tipoContratoId] ?? null, maps.relacionesDivision[doc.relacionDivisionId] ?? null,
          ]
        );
        if (r.rows[0]) { maps.empleados[fbId] = r.rows[0].id; c++; }
      } catch {}
    }
    results.empleados = c;

    // 11. Asistencias
    c = 0;
    for (const [, doc] of Object.entries(raw.asistencias || {}) as any) {
      const empId = maps.empleados[doc.employeeId];
      if (!empId) continue;
      const fecha = toDate(doc.date) ?? toDate(doc.timestamp) ?? toDate(doc.fecha);
      if (!fecha) continue;
      try {
        await client.query(
          `INSERT INTO asistencias (employee_id, fecha, status, justification_type, justification_notes)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (employee_id, fecha) DO NOTHING`,
          [empId, fecha, doc.status ?? 'No Registrado', doc.justificationType ?? null, doc.justificationNotes ?? null]
        );
        c++;
      } catch {}
    }
    results.asistencias = c;

    // 12. Justificaciones
    c = 0;
    for (const [, doc] of Object.entries(raw.justificaciones || {}) as any) {
      const empId = maps.empleados[doc.employeeId];
      if (!empId) continue;
      const fecha = toDate(doc.date) ?? toDate(doc.fecha);
      if (!fecha) continue;
      try {
        await client.query(
          `INSERT INTO justificaciones (employee_id, fecha, tipo, notas) VALUES ($1,$2,$3,$4)`,
          [empId, fecha, doc.type ?? 'Sin tipo', doc.notes ?? null]
        );
        c++;
      } catch {}
    }
    results.justificaciones = c;

    // 13. Conocimientos
    c = 0;
    for (const [, doc] of Object.entries(raw.conocimientos || {}) as any) {
      const empId = maps.empleados[doc.employeeId];
      if (!empId) continue;
      try {
        await client.query(
          `INSERT INTO conocimientos_empleado (
             employee_id, grado_instruccion, grado_instruccion_otro,
             cargo, cargo_otro, anos_experiencia, frontend, backend, databases, devops,
             proyectos_otin, tecnologias_aprender, otras_tecnologias
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (employee_id) DO NOTHING`,
          [
            empId, doc.gradoInstruccion ?? null, doc.gradoInstruccionOtro ?? null,
            doc.cargo ?? null, doc.cargoOtro ?? null, doc.añosExperiencia ?? null,
            JSON.stringify(doc.frontend ?? {}), JSON.stringify(doc.backend ?? {}),
            JSON.stringify(doc.databases ?? {}), JSON.stringify(doc.devops ?? {}),
            doc.proyectosOtin ?? null, doc.tecnologiasAprender ?? null, doc.otrasTecnologias ?? null,
          ]
        );
        c++;
      } catch {}
    }
    results.conocimientos = c;

    // 14. Users
    c = 0;
    for (const [, doc] of Object.entries(raw.users || {}) as any) {
      const hash = await bcrypt.hash('Cambiar123!', 10);
      await client.query(
        `INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING`,
        [doc.email, hash, doc.role ?? 'registrador']
      );
      c++;
    }
    results.users = c;

    await client.query('COMMIT');
    res.json({ success: true, results, message: 'Importación completa. Password temporal: Cambiar123!' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
