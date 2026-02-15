// DACRISA Comandas - Shared Types

export type RolTag = 'OPERARIO' | 'COLECTA' | 'JEFE' | 'CALIDAD' | 'DIOS' | 'PANTALLA_TECHO';

export type EstadoUsuario = 'ACTIVO' | 'BAJA_TEMPORAL' | 'INACTIVO';

export type EstadoTurno = 'CREADO' | 'ACTIVO' | 'CERRADO';

export type FranjaTurno = 'MANANA' | 'TARDE' | 'NOCHE';

export type EstadoVisualRuta = 'AZUL' | 'VERDE' | 'ROJO';

export type EstadoLogicoRuta = 'ACTIVA' | 'RECOLECTADA';

export type ParseStatus = 'OK' | 'ERROR_RUTA' | 'ERROR_PARSE';

export type MatchMethod = 'EXACT' | 'FUZZY';

export type PrintJobTipo = 'OPERARIO_INICIAL' | 'OPERARIO_NUEVOS' | 'COLECTA_NUEVOS' | 'REIMPRESION';

export type PrintJobStatus = 'CREADO' | 'PDF_GENERADO' | 'ENVIADO' | 'FALLIDO';

export type ValidationEstado = 'OK' | 'BLOQUEADO';

export interface Usuario {
  id: string;
  nombre: string;
  rol_tag: RolTag;
  funcion?: string;
  estado: EstadoUsuario;
}

export interface AuthUser {
  id: string;
  nombre: string;
  rol_tag: RolTag;
  estado: EstadoUsuario;
}

export interface LoginRequest {
  code: string;
}

export interface LoginResponse {
  user: AuthUser;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
}

// ===== TURNOS Y HORARIOS =====

export interface TurnoHorario {
  id: string;
  franja: FranjaTurno;
  start_time: string; // HH:MM:SS
  end_time: string;   // HH:MM:SS
  activo: boolean;
}

export interface Turno {
  id: string;
  fecha: string;
  franja: FranjaTurno;
  jefe_id: string | null;
  estado: EstadoTurno;
  started_at: string | null;
  ended_at: string | null;
  horario?: TurnoHorario;
}

export interface TurnoCompleto extends Turno {
  horario?: TurnoHorario;
  habilidades?: TurnoHabilidad[];
  colecta?: TurnoColectaAsignacion[];
}

export interface TurnoHabilidad {
  turno_id: string;
  usuario_id: string;
  codigo_funcional: number;
  habilitada: boolean;
  usuario?: { id: string; nombre: string };
}

export interface TurnoColectaAsignacion {
  turno_id: string;
  ruta_norm: string;
  colecta_user_id: string;
  colecta?: { id: string; nombre: string };
}

export interface IniciarTurnoRequest {
  franja: FranjaTurno;
  fecha: string; // YYYY-MM-DD
}

export interface ConfigurarHabilidadesRequest {
  habilidades: {
    usuario_id: string;
    codigo_funcional_ids: number[];
  }[];
}

export interface ConfigurarColectaRequest {
  colecta: {
    ruta_norm: string;
    colecta_user_id: string;
  }[];
}

// Error codes
export const ErrorCodes = {
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_USER_INACTIVE: 'AUTH_USER_INACTIVE',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  // Turnos
  TURNO_NO_ENCONTRADO: 'TURNO_NO_ENCONTRADO',
  TURNO_YA_ACTIVO: 'TURNO_YA_ACTIVO',
  TURNO_DUPLICADO: 'TURNO_DUPLICADO',
  TURNO_NO_ACTIVO: 'TURNO_NO_ACTIVO',
  // Horarios
  HORARIO_NO_ENCONTRADO: 'HORARIO_NO_ENCONTRADO',
  HORARIO_EN_USO: 'HORARIO_EN_USO',
  HORARIO_INVALIDO: 'HORARIO_INVALIDO',
} as const;

// Role routing
export const ROLE_ROUTES: Record<RolTag, string> = {
  OPERARIO: '/operario',
  COLECTA: '/colecta',
  JEFE: '/jefe',
  CALIDAD: '/calidad',
  DIOS: '/dios',
  PANTALLA_TECHO: '/techo',
};
