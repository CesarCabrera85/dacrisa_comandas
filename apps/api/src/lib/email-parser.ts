/**
 * Email Parser Module
 * Parses email subject (route) and body (clients and lines)
 */

import { normalizeRuta, normalizeText } from './normalization.js';

// Types
export interface RutaMaster {
  id: string;
  ruta_norm: string;
}

export interface ParsedSubject {
  success: boolean;
  ruta_id?: string;
  ruta_norm: string;
  error?: string;
}

export interface ParsedLinea {
  cantidad: number;
  unidad: string;
  producto: string;
  precio: number;
}

export interface ParsedCliente {
  nombre: string;
  observaciones: string | null;
  lineas: ParsedLinea[];
}

export interface ParseError {
  tipo: 'ERROR' | 'WARNING';
  mensaje: string;
  linea?: number;
}

export interface ParsedBody {
  success: boolean;
  clientes: ParsedCliente[];
  errores: ParseError[];
}

/**
 * Parse email subject to extract route
 * @param subject Email subject line
 * @param rutasMaster List of master routes to match against
 * @returns ParsedSubject with route ID or error
 */
export function parseSubject(subject: string, rutasMaster: RutaMaster[]): ParsedSubject {
  if (!subject || typeof subject !== 'string') {
    return {
      success: false,
      ruta_norm: '',
      error: 'ERROR_RUTA',
    };
  }

  // Normalize subject
  const rutaNorm = normalizeRuta(subject);

  if (!rutaNorm) {
    return {
      success: false,
      ruta_norm: '',
      error: 'ERROR_RUTA',
    };
  }

  // Find exact match in rutasMaster
  const matchedRuta = rutasMaster.find((ruta) => ruta.ruta_norm === rutaNorm);

  if (matchedRuta) {
    return {
      success: true,
      ruta_id: matchedRuta.id,
      ruta_norm: rutaNorm,
    };
  }

  // No match found
  return {
    success: false,
    ruta_norm: rutaNorm,
    error: 'ERROR_RUTA',
  };
}

// Regex for parsing product lines
// Format: cantidad unidad - producto - precio
// Examples: "3 kg - Tomates - 2.50", "2 L - Leche Entera - 1.80"
const LINEA_REGEX = /^(\d+(?:[.,]\d+)?)\s+(\w+)\s*-\s*(.+?)\s*-\s*(\d+(?:[.,]\d+)?)$/;

/**
 * Parse email body to extract clients and product lines
 * @param body Email body content
 * @returns ParsedBody with clients, lines, and errors
 */
export function parseBody(body: string): ParsedBody {
  const errores: ParseError[] = [];
  const clientes: ParsedCliente[] = [];

  if (!body || typeof body !== 'string') {
    return {
      success: false,
      clientes: [],
      errores: [{ tipo: 'ERROR', mensaje: 'Body vacío o inválido' }],
    };
  }

  // Split body into lines and normalize
  const lines = body.split(/\r?\n/).map((line) => line.trim());

  // Track current client block
  let currentCliente: ParsedCliente | null = null;
  let lineNumber = 0;
  let expectingObservaciones = false;

  for (const line of lines) {
    lineNumber++;

    // Skip empty lines
    if (!line) {
      continue;
    }

    // Check for "Cliente:" prefix (case-insensitive)
    const clienteMatch = line.match(/^Cliente:\s*(.*)$/i);
    if (clienteMatch) {
      // Save previous client if exists
      if (currentCliente) {
        if (currentCliente.lineas.length === 0) {
          errores.push({
            tipo: 'WARNING',
            mensaje: `Cliente sin líneas de producto: ${currentCliente.nombre}`,
            linea: lineNumber - 1,
          });
        }
        clientes.push(currentCliente);
      }

      const nombreCliente = clienteMatch[1].trim();
      if (!nombreCliente) {
        errores.push({
          tipo: 'ERROR',
          mensaje: 'Cliente sin nombre',
          linea: lineNumber,
        });
        currentCliente = null;
        expectingObservaciones = false;
        continue;
      }

      currentCliente = {
        nombre: nombreCliente,
        observaciones: null,
        lineas: [],
      };
      expectingObservaciones = true;
      continue;
    }

    // Check for "Observaciones:" prefix (case-insensitive)
    if (expectingObservaciones) {
      const obsMatch = line.match(/^Observaciones:\s*(.*)$/i);
      if (obsMatch) {
        if (currentCliente) {
          currentCliente.observaciones = obsMatch[1].trim() || null;
        }
        expectingObservaciones = false;
        continue;
      }
      // Not an observaciones line, so we don't expect it anymore
      expectingObservaciones = false;
    }

    // Skip if no current client
    if (!currentCliente) {
      // Check if this looks like a product line outside of a client block
      if (LINEA_REGEX.test(line)) {
        errores.push({
          tipo: 'WARNING',
          mensaje: `Línea de producto sin cliente asociado: ${line}`,
          linea: lineNumber,
        });
      }
      continue;
    }

    // Try to parse as product line
    const lineaMatch = line.match(LINEA_REGEX);
    if (lineaMatch) {
      const cantidad = parseFloat(lineaMatch[1].replace(',', '.'));
      const unidad = lineaMatch[2].trim();
      const producto = lineaMatch[3].trim();
      const precio = parseFloat(lineaMatch[4].replace(',', '.'));

      if (isNaN(cantidad) || isNaN(precio)) {
        errores.push({
          tipo: 'WARNING',
          mensaje: `Valores numéricos inválidos en línea: ${line}`,
          linea: lineNumber,
        });
        continue;
      }

      currentCliente.lineas.push({
        cantidad,
        unidad,
        producto,
        precio,
      });
    } else if (line.length > 0 && !line.startsWith('--') && !line.startsWith('===')) {
      // Line doesn't match expected format and is not a separator
      errores.push({
        tipo: 'WARNING',
        mensaje: `Línea mal formateada: ${line}`,
        linea: lineNumber,
      });
    }
  }

  // Add last client
  if (currentCliente) {
    if (currentCliente.lineas.length === 0) {
      errores.push({
        tipo: 'WARNING',
        mensaje: `Cliente sin líneas de producto: ${currentCliente.nombre}`,
        linea: lineNumber,
      });
    }
    clientes.push(currentCliente);
  }

  // Check for critical errors (no clients at all)
  const hasClients = clientes.length > 0;
  const hasCriticalErrors = errores.some(
    (e) => e.tipo === 'ERROR' && e.mensaje === 'Cliente sin nombre'
  );

  return {
    success: hasClients && !hasCriticalErrors,
    clientes,
    errores,
  };
}
