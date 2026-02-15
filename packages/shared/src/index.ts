// DACRISA Comandas - Shared Types

export type RolTag = 'OPERARIO' | 'COLECTA' | 'JEFE' | 'CALIDAD' | 'DIOS' | 'PANTALLA_TECHO';

export type EstadoUsuario = 'ACTIVO' | 'BAJA_TEMPORAL' | 'INACTIVO';

export type EstadoTurno = 'CREADO' | 'ACTIVO' | 'CERRADO';

export type FranjaTurno = 'MANANA' | 'TARDE' | 'NOCHE';

export type EstadoVisualRuta = 'AZUL' | 'VERDE' | 'ROJO';

export type EstadoLogicoRuta = 'ACTIVA' | 'RECOLECTADA';

export type ParseStatus = 'OK' | 'ERROR_RUTA' | 'ERROR_PARSE' | 'PENDING';

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

// ===== USUARIOS CRUD =====

export interface UsuarioCRUD {
  id: string;
  nombre: string;
  rol: RolTag;
  estado: EstadoUsuario;
  created_at: string;
  updated_at: string;
}

export interface CreateUsuarioDTO {
  nombre: string;
  codigo: string;
  rol: string;
  estado?: string;
}

export interface UpdateUsuarioDTO {
  nombre?: string;
  rol?: string;
  estado?: string;
}

export interface CambiarCodigoDTO {
  nuevo_codigo: string;
}

// User Management Events
export const USER_EVENT_TYPES = {
  USUARIO_CREADO: 'USUARIO_CREADO',
  USUARIO_ACTUALIZADO: 'USUARIO_ACTUALIZADO',
  USUARIO_CODIGO_CAMBIADO: 'USUARIO_CODIGO_CAMBIADO',
  USUARIO_BAJA_TEMPORAL: 'USUARIO_BAJA_TEMPORAL',
  USUARIO_REACTIVADO: 'USUARIO_REACTIVADO',
  USUARIO_DESACTIVADO: 'USUARIO_DESACTIVADO',
  USUARIO_ELIMINADO: 'USUARIO_ELIMINADO',
} as const;

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
  // Masterdata
  VALIDACION_BLOQUEADA: 'VALIDACION_BLOQUEADA',
  ARCHIVO_VACIO: 'ARCHIVO_VACIO',
  ARCHIVO_ILEGIBLE: 'ARCHIVO_ILEGIBLE',
  COLUMNAS_FALTANTES: 'COLUMNAS_FALTANTES',
  CONFLICTO_FAMILIA: 'CONFLICTO_FAMILIA',
  FAMILIA_NO_EXISTE: 'FAMILIA_NO_EXISTE',
  NO_ACTIVE_VERSION: 'NO_ACTIVE_VERSION',
} as const;

// ===== MASTERDATA TYPES =====

export type MasterdataValidationStatus = 'OK' | 'WARNING' | 'BLOQUEADO';

export interface MasterdataValidationError {
  fila: number;
  campo: string;
  tipo: 'ERROR' | 'WARNING';
  mensaje: string;
  codigo: string;
}

export interface ProductosMasterVersion {
  id: string;
  version_label: string;
  archivo_nombre: string;
  activo: boolean;
  validacion_estado: string;
  validacion_resumen?: {
    status: MasterdataValidationStatus;
    errores: MasterdataValidationError[];
    productos_count: number;
    warnings_count: number;
    errors_count: number;
  };
  productos_count?: number;
  activated_at: string | null;
  created_at: string;
}

export interface ProductoMaster {
  id: string;
  version_id: string;
  producto_raw: string;
  producto_norm: string;
  familia: number;
  codigo_producto: string | null;
}

export interface RutasMasterVersion {
  id: string;
  version_label: string;
  archivo_nombre: string;
  activo: boolean;
  validacion_estado: string;
  validacion_resumen?: {
    status: MasterdataValidationStatus;
    errores: MasterdataValidationError[];
    rutas_count: number;
    warnings_count: number;
    errors_count: number;
  };
  rutas_count?: number;
  activated_at: string | null;
  created_at: string;
}

export interface RutaMaster {
  id: string;
  version_id: string;
  ruta_raw: string;
  ruta_norm: string;
}

// Family mapping (1-6)
export const FAMILIA_NAMES: Record<number, string> = {
  1: 'Familia 1',
  2: 'Familia 2',
  3: 'Familia 3',
  4: 'Familia 4',
  5: 'Familia 5',
  6: 'Familia 6',
};

// Role routing
export const ROLE_ROUTES: Record<RolTag, string> = {
  OPERARIO: '/operario',
  COLECTA: '/colecta',
  JEFE: '/jefe',
  CALIDAD: '/calidad',
  DIOS: '/dios',
  PANTALLA_TECHO: '/techo',
};

// ===== IMAP TYPES =====

export interface Lote {
  id: string;
  turno_id: string | null;
  imap_uid: number;
  imap_uidvalidity: number;
  subject_raw: string;
  body_raw: string;
  received_at: string;
  parse_status: ParseStatus;
  parse_error: string | null;
  business_date: string | null;
  created_at: string;
}

export interface ImapStatus {
  isRunning: boolean;
  isConnected: boolean;
  lastError: string | null;
  lastPollTime: string | null;
  cursor: {
    lastUid: number;
    uidValidity: number | null;
  };
}

// IMAP Event types
export const IMAP_EVENT_TYPES = {
  NUEVO_CORREO_RECIBIDO: 'NUEVO_CORREO_RECIBIDO',
  ERROR_EN_LECTURA_DE_CORREO: 'ERROR_EN_LECTURA_DE_CORREO',
  DUPLICADO_IMAP_IGNORADO: 'DUPLICADO_IMAP_IGNORADO',
} as const;

// ===== PARSER AND BATCH PROCESSING TYPES =====

export type MatchType = 'EXACT' | 'FUZZY' | 'NO_MATCH';
export type AssignmentReason = 'AFINIDAD' | 'ROUND_ROBIN' | 'SIN_POOL';

export interface PedidoCliente {
  id: string;
  lote_id: string;
  codigo_cliente: string;
  nombre_cliente_raw: string | null;
  cliente_affinity_key: string;
  observaciones: string | null;
}

export interface Linea {
  id: string;
  pedido_cliente_id: string;
  seq_in_cliente: number;
  cantidad: number;
  unidad_raw: string;
  producto_raw: string;
  producto_norm: string;
  precio_num: number | null;
  match_method: MatchMethod;
  match_score: number | null;
  familia: number;
  codigo_funcional: number;
  operario_id: string | null;
  printed_at: string | null;
  print_count: number;
}

export interface RutaDia {
  id: string;
  turno_id: string;
  ruta_norm: string;
  estado_visual: EstadoVisualRuta;
  estado_logico: EstadoLogicoRuta;
  reactivaciones_count: number;
  last_event_at: string | null;
}

export interface RutaResumen {
  ruta_id: string;
  ruta_nombre: string;
  estado_visual: EstadoVisualRuta;
  estado_logico: EstadoLogicoRuta;
  pendiente_imprimible: number;
  total_clientes: number;
  total_lineas: number;
  lotes_count: number;
}

export interface ClienteResumen {
  pedido_cliente_id: string;
  cliente_nombre: string;
  operario_id: string | null;
  operario_nombre: string | null;
  observaciones: string | null;
  total_lineas: number;
  lineas_impresas: number;
  lineas_pendientes: number;
}

export interface LineaResumen {
  linea_id: string;
  producto_nombre: string;
  producto_norm: string;
  cantidad: number;
  unidad: string;
  precio: number | null;
  match_method: MatchMethod;
  match_score: number | null;
  impreso: boolean;
  printed_at: string | null;
  print_count: number;
  operario_id: string | null;
  familia: number;
  observacion: string | null;
}

// Parser Event types
export const PARSER_EVENT_TYPES = {
  ERROR_PARSE_RUTA: 'ERROR_PARSE_RUTA',
  ERROR_PARSE_BODY: 'ERROR_PARSE_BODY',
  PRODUCTO_NO_ENCONTRADO: 'PRODUCTO_NO_ENCONTRADO',
  PRODUCTO_ASIGNADO_POR_PROBABILIDAD: 'PRODUCTO_ASIGNADO_POR_PROBABILIDAD',
  SIN_POOL_CODIGO_FUNCIONAL: 'SIN_POOL_CODIGO_FUNCIONAL',
  LOTE_PROCESADO: 'LOTE_PROCESADO',
  ERROR_PROCESAMIENTO_LOTE: 'ERROR_PROCESAMIENTO_LOTE',
  RUTA_ALERTA_ROJA: 'RUTA_ALERTA_ROJA',
  RUTA_COMPLETA_VERDE: 'RUTA_COMPLETA_VERDE',
  RUTA_RECOLECTADA: 'RUTA_RECOLECTADA',
  LOTE_CARRYOVER: 'LOTE_CARRYOVER',
} as const;

export interface CarryoverResult {
  lotes_carryover: number;
  lineas_carryover: number;
}

// ===== PRINT TYPES =====

export interface PrintJob {
  id: string;
  tipo: PrintJobTipo;
  actor_user_id: string | null;
  ruta_norm: string;
  turno_id: string;
  status: PrintJobStatus;
  pdf_path: string;
  lineas_count: number;
  created_at: string;
}

export interface PrintJobItem {
  print_job_id: string;
  linea_id: string;
}

export interface OperarioRutaProgress {
  turno_id: string;
  operario_id: string;
  ruta_norm: string;
  login_at: string;
  cutoff_lote_id: string | null;
  last_printed_lote_id: string | null;
  last_printed_at: string | null;
}

export interface ColectaRutaProgress {
  turno_id: string;
  ruta_norm: string;
  last_closed_lote_id: string | null;
  last_closed_at: string | null;
}

export interface PrintOperarioStatus {
  has_entered: boolean;
  can_print_inicial: boolean;
  can_print_nuevos: boolean;
  cutoff_lote_id: string | null;
  last_printed_lote_id: string | null;
  last_printed_at: string | null;
}

export interface PrintColectaStatus {
  estado_logico: EstadoLogicoRuta;
  estado_visual: EstadoVisualRuta;
  last_closed_lote_id: string | null;
  last_closed_at: string | null;
}

export interface PrintResult {
  success: boolean;
  print_job_id: string;
  pdf_url: string;
  pdf_full_url: string;
  lineas_count: number;
}

// Print Event types
export const PRINT_EVENT_TYPES = {
  OPERARIO_ENTER_RUTA: 'OPERARIO_ENTER_RUTA',
  IMPRESION_REALIZADA: 'IMPRESION_REALIZADA',
  RUTA_RECOLECTADA: 'RUTA_RECOLECTADA',
} as const;
