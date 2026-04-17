import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import importRoutes from './routes/import';
import empleadosRoutes from './routes/empleados';
import asistenciasRoutes from './routes/asistencias';
import {
  sedesRouter, divisionesRouter, dttRouter, proyectosRouter,
  modalidadesRouter, tiposContratoRouter, coordinadoresRouter,
  scrumMastersRouter, justificacionesRouter, relacionesDivisionRouter, conocimientosRouter
} from './routes/catalogos';

dotenv.config();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api', importRoutes);
app.use('/api/empleados', empleadosRoutes);
app.use('/api/asistencias', asistenciasRoutes);
app.use('/api/sedes', sedesRouter);
app.use('/api/divisiones', divisionesRouter);
app.use('/api/dtt', dttRouter);
app.use('/api/proyectos', proyectosRouter);
app.use('/api/modalidades', modalidadesRouter);
app.use('/api/tipos-contrato', tiposContratoRouter);
app.use('/api/coordinadores', coordinadoresRouter);
app.use('/api/scrum-masters', scrumMastersRouter);
app.use('/api/justificaciones', justificacionesRouter);
app.use('/api/relaciones-division', relacionesDivisionRouter);
app.use('/api/conocimientos', conocimientosRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend corriendo en puerto ${PORT}`));
