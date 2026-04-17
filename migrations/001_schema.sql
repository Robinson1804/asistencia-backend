-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Usuarios (reemplaza Firebase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'registrador',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sedes
CREATE TABLE IF NOT EXISTS sedes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_sede VARCHAR(255) NOT NULL,
  direccion TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Divisiones
CREATE TABLE IF NOT EXISTS divisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_division VARCHAR(255) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE
);

-- DTT
CREATE TABLE IF NOT EXISTS dtt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_dtt VARCHAR(255) NOT NULL,
  codigo_dtt VARCHAR(100),
  descripcion TEXT
);

-- Proyectos
CREATE TABLE IF NOT EXISTS proyectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_proyecto VARCHAR(100),
  nombre_proyecto VARCHAR(255) NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE
);

-- Modalidades
CREATE TABLE IF NOT EXISTS modalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_modalidad VARCHAR(255) NOT NULL,
  descripcion TEXT
);

-- Tipos de Contrato
CREATE TABLE IF NOT EXISTS tipos_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_contrato VARCHAR(255) NOT NULL,
  descripcion TEXT
);

-- Coordinadores
CREATE TABLE IF NOT EXISTS coordinadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_coordinador VARCHAR(255) NOT NULL,
  activo BOOLEAN DEFAULT TRUE
);

-- Scrum Masters
CREATE TABLE IF NOT EXISTS scrum_masters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_scrum_master VARCHAR(255) NOT NULL,
  activo BOOLEAN DEFAULT TRUE
);

-- Relaciones División
CREATE TABLE IF NOT EXISTS relaciones_division (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinador_id UUID REFERENCES coordinadores(id),
  division_id UUID REFERENCES divisiones(id),
  scrum_master_id UUID REFERENCES scrum_masters(id)
);

-- Empleados
CREATE TABLE IF NOT EXISTS empleados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dni VARCHAR(20) UNIQUE NOT NULL,
  apellidos_nombres VARCHAR(255) NOT NULL,
  orden VARCHAR(50),
  email VARCHAR(255),
  telefono VARCHAR(50),
  activo BOOLEAN DEFAULT TRUE,
  avatar_url TEXT,
  edad INTEGER,
  correo_personal VARCHAR(255),
  fecha_inicio DATE,
  fecha_fin DATE,
  sede_id UUID REFERENCES sedes(id),
  dtt_id UUID REFERENCES dtt(id),
  proyecto_id UUID REFERENCES proyectos(id),
  modalidad_id UUID REFERENCES modalidades(id),
  tipo_contrato_id UUID REFERENCES tipos_contrato(id),
  relacion_division_id UUID REFERENCES relaciones_division(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asistencias
CREATE TABLE IF NOT EXISTS asistencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES empleados(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  status VARCHAR(50) NOT NULL,
  justification_type VARCHAR(100),
  justification_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, fecha)
);

-- Justificaciones
CREATE TABLE IF NOT EXISTS justificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES empleados(id),
  fecha DATE NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conocimientos del empleado
CREATE TABLE IF NOT EXISTS conocimientos_empleado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES empleados(id) UNIQUE,
  grado_instruccion VARCHAR(100),
  grado_instruccion_otro VARCHAR(100),
  cargo VARCHAR(100),
  cargo_otro VARCHAR(100),
  anos_experiencia VARCHAR(50),
  frontend JSONB,
  backend JSONB,
  databases JSONB,
  devops JSONB,
  proyectos_otin TEXT,
  tecnologias_aprender TEXT,
  otras_tecnologias TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha ON asistencias(fecha);
CREATE INDEX IF NOT EXISTS idx_asistencias_employee ON asistencias(employee_id);
CREATE INDEX IF NOT EXISTS idx_empleados_activo ON empleados(activo);
CREATE INDEX IF NOT EXISTS idx_empleados_dni ON empleados(dni);
