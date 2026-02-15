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

// Error codes
export const ErrorCodes = {
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_USER_INACTIVE: 'AUTH_USER_INACTIVE',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
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
