/**
 * Master Data Validation Library
 * Validates parsed products and routes for conflicts and errors
 */

import type { ParsedProducto, ParsedRuta, ParseError } from './xlsx-parser.js';

export type ValidationStatus = 'OK' | 'WARNING' | 'BLOQUEADO';

export interface ValidationError {
  fila: number;
  campo: string;
  tipo: 'ERROR' | 'WARNING';
  mensaje: string;
  codigo: string;
}

export interface ValidationResult {
  status: ValidationStatus;
  errores: ValidationError[];
}

/**
 * Validate parsed products for conflicts and errors
 */
export function validateProductos(productos: ParsedProducto[]): ValidationResult {
  const errores: ValidationError[] = [];
  let hasBlockingError = false;
  
  // Track products by normalized name
  const productMap = new Map<string, { familia_id: number | null; filas: number[] }[]>();
  
  for (const producto of productos) {
    // 1. Check for empty product name
    if (!producto.producto_original || producto.producto_norm === '') {
      errores.push({
        fila: producto.fila,
        campo: 'producto',
        tipo: 'WARNING',
        mensaje: 'Producto vacío o inválido',
        codigo: 'PRODUCTO_VACIO',
      });
      continue;
    }
    
    // 2. Check if familia exists (is valid)
    if (producto.familia_id === null) {
      errores.push({
        fila: producto.fila,
        campo: 'familia',
        tipo: 'ERROR',
        mensaje: `Familia "${producto.familia_nombre}" no existe o es inválida`,
        codigo: 'FAMILIA_NO_EXISTE',
      });
      hasBlockingError = true;
      continue;
    }
    
    // Track for duplicate and conflict detection
    const existing = productMap.get(producto.producto_norm);
    if (existing) {
      existing.push({ familia_id: producto.familia_id, filas: [producto.fila] });
    } else {
      productMap.set(producto.producto_norm, [{ familia_id: producto.familia_id, filas: [producto.fila] }]);
    }
  }
  
  // 3. Check for family conflicts (same product with different families)
  // 4. Check for duplicates (same product with same family)
  for (const [productoNorm, entries] of productMap) {
    if (entries.length > 1) {
      // Group by familia
      const familiaGroups = new Map<number | null, number[]>();
      for (const entry of entries) {
        const existing = familiaGroups.get(entry.familia_id);
        if (existing) {
          existing.push(...entry.filas);
        } else {
          familiaGroups.set(entry.familia_id, [...entry.filas]);
        }
      }
      
      // If more than one familia for the same product -> BLOCKING ERROR
      if (familiaGroups.size > 1) {
        const filas = entries.flatMap(e => e.filas).join(', ');
        errores.push({
          fila: entries[0].filas[0],
          campo: 'familia',
          tipo: 'ERROR',
          mensaje: `Conflicto de familia: "${productoNorm}" aparece con diferentes familias en filas ${filas}`,
          codigo: 'CONFLICTO_FAMILIA',
        });
        hasBlockingError = true;
      }
      
      // Check for duplicates within same familia
      for (const [familiaId, filas] of familiaGroups) {
        if (filas.length > 1) {
          errores.push({
            fila: filas[0],
            campo: 'producto',
            tipo: 'WARNING',
            mensaje: `Producto duplicado: "${productoNorm}" (familia ${familiaId}) aparece en filas ${filas.join(', ')}`,
            codigo: 'PRODUCTO_DUPLICADO',
          });
        }
      }
    }
  }
  
  let status: ValidationStatus = 'OK';
  if (hasBlockingError) {
    status = 'BLOQUEADO';
  } else if (errores.length > 0) {
    status = 'WARNING';
  }
  
  return { status, errores };
}

/**
 * Validate parsed routes for conflicts and errors
 */
export function validateRutas(rutas: ParsedRuta[]): ValidationResult {
  const errores: ValidationError[] = [];
  let hasBlockingError = false;
  
  // Check for empty file
  if (rutas.length === 0) {
    errores.push({
      fila: 0,
      campo: 'archivo',
      tipo: 'ERROR',
      mensaje: 'El archivo no contiene rutas válidas',
      codigo: 'ARCHIVO_VACIO',
    });
    return { status: 'BLOQUEADO', errores };
  }
  
  // Track routes by normalized name
  const rutaMap = new Map<string, number[]>();
  
  for (const ruta of rutas) {
    // 1. Check for empty route name
    if (!ruta.ruta_original || ruta.ruta_norm === '') {
      errores.push({
        fila: ruta.fila,
        campo: 'ruta',
        tipo: 'WARNING',
        mensaje: 'Ruta vacía o inválida',
        codigo: 'RUTA_VACIA',
      });
      continue;
    }
    
    // Track for duplicate detection
    const existing = rutaMap.get(ruta.ruta_norm);
    if (existing) {
      existing.push(ruta.fila);
    } else {
      rutaMap.set(ruta.ruta_norm, [ruta.fila]);
    }
  }
  
  // 2. Check for duplicates
  for (const [rutaNorm, filas] of rutaMap) {
    if (filas.length > 1) {
      errores.push({
        fila: filas[0],
        campo: 'ruta',
        tipo: 'WARNING',
        mensaje: `Ruta duplicada: "${rutaNorm}" aparece en filas ${filas.join(', ')}`,
        codigo: 'RUTA_DUPLICADA',
      });
    }
  }
  
  let status: ValidationStatus = 'OK';
  if (hasBlockingError) {
    status = 'BLOQUEADO';
  } else if (errores.length > 0) {
    status = 'WARNING';
  }
  
  return { status, errores };
}
