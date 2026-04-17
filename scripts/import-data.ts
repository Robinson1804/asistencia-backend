import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

const exportPath = path.join(__dirname, '../../firebase-export/firestore-export.json');
const raw = JSON.parse(fs.readFileSync(exportPath, 'utf8'));

// Mapas firebase_id -> nuevo UUID PostgreSQL
const maps: Record<string, Record<string, string>> = {
  sedes: {},
  divisiones: {},
  dtt: {},
  proyectos: {},
  modalidades: {},
  tiposContrato: {},
  coordinadores: {},
  scrumMasters: {},
  relacionesDivision: {},
  empleados: {},
};

function toDate(val: any): string | null {
  if (!val) return null;
  if (val._type === 'Timestamp') return val.value;
  if (typeof val === 'string') return val;
  return null;
}

async function main() {
  const client = await pool.connect();
  console.log('✅ Conectado a PostgreSQL en Railway\n');

  try {
    await client.query('BEGIN');

    // ── 1. SEDES ──────────────────────────────────────────────
    let count = 0;
    for (const [fbId, doc] of Object.entries(raw.sedes || {}) as any) {
      const res = await client.query(
        `INSERT INTO sedes (firebase_id, nombre_sede, direccion, activo)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [fbId, doc.nombreSede ?? doc.nombre_sede ?? 'Sin nombre', doc.direccion ?? null, doc.activo ?? true]
      );
      maps.sedes[fbId] = res.rows[0].id;
      count++;
    }
    console.log(`  ✓ sedes              ${count} registros`);

    // ── 2. DIVISIONES ─────────────────────────────────────────
    count = 0;
    for (const [fbId, doc] of Object.entries(raw.divisiones || {}) as any) {
      const res = await client.query(
        `INSERT INTO divisiones (firebase_id, nombre_division, descripcion, activo)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [fbId, doc.nombreDivision ?? doc.nombre_division ?? 'Sin nombre', doc.descripcion ?? null, doc.activo ?? true]
      );
      maps.divisiones[fbId] = res.rows[0].id;
      count++;
    }
    console.log(`  ✓ divisiones         ${count} registros`);

    // ── 3. DTT ────────────────────────────────────────────────
    count = 0;
    for (const [fbId, doc] of Object.entries(raw.dtt || {}) as any) {
      const res = await client.query(
        `INSERT INTO dtt (firebase_id, nombre_dtt, codigo_dtt, descripcion)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [fbId, doc.nombreDTT ?? doc.nombre_dtt ?? 'Sin nombre', doc.codigoDTT ?? null, doc.descripcion ?? null]
      );
      maps.dtt[fbId] = res.rows[0].id;
      count++;
    }
    console.log(`  ✓ dtt                ${count} registros`);

    // ── 4. PROYECTOS ──────────────────────────────────────────
    count = 0;
    for (const [fbId, doc] of Object.entries(raw.proyectos || {}) as any) {
      const res = await client.query(
        `INSERT INTO proyectos (firebase_id, codigo_proyecto, nombre_proyecto, descripcion, activo)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [fbId, doc.codigoProyecto ?? null, doc.nombreProyecto ?? doc.nombre_proyecto ?? 'Sin nombre', doc.descripcion ?? null, doc.activo ?? true]
      );
      maps.proyectos[fbId] = res.rows[0].id;
      count++;
    }
    console.log(`  ✓ proyectos          ${count} registros`);

    // ── 5. MODALIDADES ────────────────────────────────────────
    count = 0;
    for (const [fbId, doc] of Object.entries(raw.modalidades || {}) as any) {
      const res = await client.query(
        `INSERT INTO modalidades (firebase_id, nombre_modalidad, descripcion)
         VALUES ($1,$2,$3) RETURNING id`,
        [fbId, doc.nombreModalidad ?? doc.nombre_modalidad ?? 'Sin nombre', doc.descripcion ?? null]
      );
      maps.modalidades[fbId] = res.rows[0].id;
      count++;
    }
    console.log(`  ✓ modalidades        ${count} registros`);

    // ── 6. TIPOS CONTRATO ─────────────────────────────────────
    count = 0;
    for (const [fbId, doc] of Object.entries(raw.tiposContrato || {}) as any) {
      const res = await client.query(
        `INSERT INTO tipos_contrato (firebase_id, tipo_contrato, descripcion)
         VALUES ($1,$2,$3) RETURNING id`,
        [fbId, doc.tipoContrato ?? doc.tipo_contrato ?? 'Sin nombre', doc.descripcion ?? null]
      );
      maps.tiposContrato[fbId] = res.rows[0].id;
      count++;
    }
    console.log(`  ✓ tipos_contrato     ${count} registros`);

    // ── 7. COORDINADORES ──────────────────────────────────────
    count = 0;
    // Pueden estar en 'coordinadoresDivisiones' o como subdocumentos
    const coordSource = raw.coordinadoresDivisiones || raw.coordinadores || {};
    for (const [fbId, doc] of Object.entries(coordSource) as any) {
      if (!doc.nombreCoordinador && !doc.nombre_coordinador) continue;
      const res = await client.query(
        `INSERT INTO coordinadores (firebase_id, nombre_coordinador, activo)
         VALUES ($1,$2,$3) RETURNING id`,
        [fbId, doc.nombreCoordinador ?? doc.nombre_coordinador, doc.activo ?? true]
      );
      maps.coordinadores[fbId] = res.rows[0].id;
      count++;
    }
    console.log(`  ✓ coordinadores      ${count} registros`);

    // ── 8. SCRUM MASTERS ──────────────────────────────────────
    count = 0;
    for (const [fbId, doc] of Object.entries(raw.scrumMasters || {}) as any) {
      const res = await client.query(
        `INSERT INTO scrum_masters (firebase_id, nombre_scrum_master, activo)
         VALUES ($1,$2,$3) RETURNING id`,
        [fbId, doc.nombreScrumMaster ?? doc.nombre_scrum_master ?? 'Sin nombre', doc.activo ?? true]
      );
      maps.scrumMasters[fbId] = res.rows[0].id;
      count++;
    }
    console.log(`  ✓ scrum_masters      ${count} registros`);

    // ── 9. RELACIONES DIVISION ────────────────────────────────
    count = 0;
    for (const [fbId, doc] of Object.entries(raw.relacionesDivision || raw.relacionDivisiones || {}) as any) {
      const coordId = maps.coordinadores[doc.coordinadorId] ?? null;
      const divId = maps.divisiones[doc.divisionId] ?? null;
      const smId = maps.scrumMasters[doc.scrumMasterId] ?? null;
      const res = await client.query(
        `INSERT INTO relaciones_division (firebase_id, coordinador_id, division_id, scrum_master_id)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [fbId, coordId, divId, smId]
      );
      maps.relacionesDivision[fbId] = res.rows[0].id;
      count++;
    }
    console.log(`  ✓ relaciones_division ${count} registros`);

    // ── 10. EMPLEADOS ─────────────────────────────────────────
    count = 0;
    let skipped = 0;
    for (const [fbId, doc] of Object.entries(raw.empleados || {}) as any) {
      if (!doc.dni && !doc.DNI) { skipped++; continue; }
      const dni = doc.dni ?? doc.DNI;
      try {
        const res = await client.query(
          `INSERT INTO empleados (
             firebase_id, dni, apellidos_nombres, orden, email, telefono,
             activo, avatar_url, edad, correo_personal, fecha_inicio, fecha_fin,
             sede_id, dtt_id, proyecto_id, modalidad_id, tipo_contrato_id, relacion_division_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           ON CONFLICT (dni) DO NOTHING
           RETURNING id`,
          [
            fbId,
            dni,
            doc.apellidosNombres ?? doc.apellidos_nombres ?? 'Sin nombre',
            doc.orden ?? null,
            doc.email ?? null,
            doc.telefono ?? null,
            doc.activo ?? true,
            doc.avatarUrl ?? null,
            doc.edad ?? null,
            doc.correoPersonal ?? null,
            toDate(doc.fechaInicio),
            toDate(doc.fechaFin),
            maps.sedes[doc.sedeId] ?? null,
            maps.dtt[doc.dttId] ?? null,
            maps.proyectos[doc.proyectoId] ?? null,
            maps.modalidades[doc.modalidadId] ?? null,
            maps.tiposContrato[doc.tipoContratoId] ?? null,
            maps.relacionesDivision[doc.relacionDivisionId] ?? null,
          ]
        );
        if (res.rows[0]) {
          maps.empleados[fbId] = res.rows[0].id;
          count++;
        }
      } catch (e: any) {
        console.warn(`    ⚠ Empleado ${dni} omitido: ${e.message}`);
        skipped++;
      }
    }
    console.log(`  ✓ empleados          ${count} registros (${skipped} omitidos)`);

    // ── 11. ASISTENCIAS ───────────────────────────────────────
    count = 0; skipped = 0;
    for (const [fbId, doc] of Object.entries(raw.asistencias || {}) as any) {
      const empId = maps.empleados[doc.employeeId];
      if (!empId) { skipped++; continue; }
      const fecha = toDate(doc.date) ?? toDate(doc.timestamp) ?? toDate(doc.fecha);
      if (!fecha) { skipped++; continue; }
      try {
        await client.query(
          `INSERT INTO asistencias (firebase_id, employee_id, fecha, status, justification_type, justification_notes)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (employee_id, fecha) DO NOTHING`,
          [fbId, empId, fecha, doc.status ?? 'No Registrado', doc.justificationType ?? null, doc.justificationNotes ?? null]
        );
        count++;
      } catch { skipped++; }
    }
    console.log(`  ✓ asistencias        ${count} registros (${skipped} omitidos)`);

    // ── 12. JUSTIFICACIONES ───────────────────────────────────
    count = 0; skipped = 0;
    for (const [fbId, doc] of Object.entries(raw.justificaciones || {}) as any) {
      const empId = maps.empleados[doc.employeeId];
      if (!empId) { skipped++; continue; }
      const fecha = toDate(doc.date) ?? toDate(doc.fecha);
      if (!fecha) { skipped++; continue; }
      try {
        await client.query(
          `INSERT INTO justificaciones (firebase_id, employee_id, fecha, tipo, notas)
           VALUES ($1,$2,$3,$4,$5)`,
          [fbId, empId, fecha, doc.type ?? doc.tipo ?? 'Sin tipo', doc.notes ?? doc.notas ?? null]
        );
        count++;
      } catch { skipped++; }
    }
    console.log(`  ✓ justificaciones    ${count} registros (${skipped} omitidos)`);

    // ── 13. CONOCIMIENTOS ─────────────────────────────────────
    count = 0; skipped = 0;
    for (const [fbId, doc] of Object.entries(raw.conocimientos || {}) as any) {
      const empId = maps.empleados[doc.employeeId];
      if (!empId) { skipped++; continue; }
      try {
        await client.query(
          `INSERT INTO conocimientos_empleado (
             firebase_id, employee_id, grado_instruccion, grado_instruccion_otro,
             cargo, cargo_otro, anos_experiencia,
             frontend, backend, databases, devops,
             proyectos_otin, tecnologias_aprender, otras_tecnologias
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (employee_id) DO NOTHING`,
          [
            fbId, empId,
            doc.gradoInstruccion ?? null, doc.gradoInstruccionOtro ?? null,
            doc.cargo ?? null, doc.cargoOtro ?? null,
            doc.añosExperiencia ?? doc.anosExperiencia ?? null,
            JSON.stringify(doc.frontend ?? {}),
            JSON.stringify(doc.backend ?? {}),
            JSON.stringify(doc.databases ?? {}),
            JSON.stringify(doc.devops ?? {}),
            doc.proyectosOtin ?? null,
            doc.tecnologiasAprender ?? null,
            doc.otrasTecnologias ?? null,
          ]
        );
        count++;
      } catch { skipped++; }
    }
    console.log(`  ✓ conocimientos      ${count} registros (${skipped} omitidos)`);

    // ── 14. USERS ─────────────────────────────────────────────
    count = 0;
    for (const [uid, doc] of Object.entries(raw.users || {}) as any) {
      const hash = await bcrypt.hash('Cambiar123!', 10);
      await client.query(
        `INSERT INTO users (firebase_uid, email, password_hash, role)
         VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING`,
        [uid, doc.email, hash, doc.role ?? 'registrador']
      );
      count++;
    }
    console.log(`  ✓ users              ${count} registros`);

    await client.query('COMMIT');

    console.log('\n─────────────────────────────────────────');
    console.log('✅ Importación completa');
    console.log('   Contraseña temporal para todos los usuarios: Cambiar123!');
    console.log('─────────────────────────────────────────\n');

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error fatal (ROLLBACK):', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
