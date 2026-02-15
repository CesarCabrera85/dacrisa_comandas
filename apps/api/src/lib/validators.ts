/**
 * Validation utilities for user management
 */

/**
 * Validates a user code (4-6 numeric digits)
 */
export function validateCodigo(codigo: string): boolean {
  return /^\d{4,6}$/.test(codigo);
}

/**
 * Validates a user name (3-100 characters)
 */
export function validateNombre(nombre: string): boolean {
  return nombre.length >= 3 && nombre.length <= 100;
}

/**
 * Validates a role tag
 */
export function validateRol(rol: string): boolean {
  return ['OPERARIO', 'COLECTA', 'JEFE', 'CALIDAD', 'DIOS', 'PANTALLA_TECHO'].includes(rol);
}

/**
 * Validates a user status
 */
export function validateEstado(estado: string): boolean {
  return ['ACTIVO', 'INACTIVO', 'BAJA_TEMPORAL'].includes(estado);
}

/**
 * Validates CreateUsuarioDTO
 */
export function validateCreateUsuario(data: {
  nombre?: string;
  codigo?: string;
  rol?: string;
  estado?: string;
}): { valid: boolean; error?: string } {
  if (!data.nombre || !validateNombre(data.nombre)) {
    return { valid: false, error: 'El nombre debe tener entre 3 y 100 caracteres' };
  }
  
  if (!data.codigo || !validateCodigo(data.codigo)) {
    return { valid: false, error: 'El código debe ser numérico de 4-6 dígitos' };
  }
  
  if (!data.rol || !validateRol(data.rol)) {
    return { valid: false, error: 'Rol inválido' };
  }
  
  if (data.estado && !validateEstado(data.estado)) {
    return { valid: false, error: 'Estado inválido' };
  }
  
  return { valid: true };
}

/**
 * Validates UpdateUsuarioDTO
 */
export function validateUpdateUsuario(data: {
  nombre?: string;
  rol?: string;
  estado?: string;
}): { valid: boolean; error?: string } {
  if (data.nombre && !validateNombre(data.nombre)) {
    return { valid: false, error: 'El nombre debe tener entre 3 y 100 caracteres' };
  }
  
  if (data.rol && !validateRol(data.rol)) {
    return { valid: false, error: 'Rol inválido' };
  }
  
  if (data.estado && !validateEstado(data.estado)) {
    return { valid: false, error: 'Estado inválido' };
  }
  
  return { valid: true };
}
