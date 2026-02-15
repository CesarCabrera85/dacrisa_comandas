/**
 * XLSX Parser for master data files
 * Uses exceljs to parse uploaded Excel files
 */

import ExcelJS from 'exceljs';
import { normalizeProducto, normalizeRuta } from './normalization.js';

export interface ParsedProducto {
  fila: number;
  producto_original: string;
  producto_norm: string;
  familia_nombre: string;
  familia_id: number | null;
}

export interface ParsedRuta {
  fila: number;
  ruta_original: string;
  ruta_norm: string;
  orden_sugerido: number | null;
}

export interface ParseError {
  fila: number;
  campo: string;
  mensaje: string;
}

export interface ParsedProductosResult {
  productos: ParsedProducto[];
  errores: ParseError[];
}

export interface ParsedRutasResult {
  rutas: ParsedRuta[];
  errores: ParseError[];
}

// Family name to ID mapping (1-6)
const FAMILIA_MAP: Record<string, number> = {
  '1': 1, 'FAMILIA 1': 1, 'F1': 1,
  '2': 2, 'FAMILIA 2': 2, 'F2': 2,
  '3': 3, 'FAMILIA 3': 3, 'F3': 3,
  '4': 4, 'FAMILIA 4': 4, 'F4': 4,
  '5': 5, 'FAMILIA 5': 5, 'F5': 5,
  '6': 6, 'FAMILIA 6': 6, 'F6': 6,
  'FRESCO': 1, 'CONGELADO': 2, 'SECO': 3,
  'BEBIDAS': 4, 'LIMPIEZA': 5, 'OTROS': 6,
};

function getFamiliaId(familiaName: string): number | null {
  if (!familiaName) return null;
  const normalized = familiaName.toUpperCase().trim();
  return FAMILIA_MAP[normalized] ?? null;
}

function getCellValue(cell: ExcelJS.Cell | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object') {
    // Handle rich text or formula results
    if ('text' in cell.value) return String(cell.value.text);
    if ('result' in cell.value) return String(cell.value.result);
    if ('richText' in cell.value) {
      return (cell.value.richText as any[]).map(rt => rt.text).join('');
    }
    return '';
  }
  return String(cell.value);
}

function findColumnIndex(headerRow: ExcelJS.Row, names: string[]): number | null {
  for (let colIdx = 1; colIdx <= headerRow.cellCount; colIdx++) {
    const cellValue = getCellValue(headerRow.getCell(colIdx)).toUpperCase().trim();
    for (const name of names) {
      if (cellValue === name.toUpperCase() || cellValue.includes(name.toUpperCase())) {
        return colIdx;
      }
    }
  }
  return null;
}

/**
 * Parse an XLSX file containing products master data
 */
export async function parseProductosXLSX(buffer: Buffer | Uint8Array): Promise<ParsedProductosResult> {
  const productos: ParsedProducto[] = [];
  const errores: ParseError[] = [];
  
  const workbook = new ExcelJS.Workbook();
  
  try {
    await workbook.xlsx.load(buffer as any);
  } catch (error) {
    return {
      productos: [],
      errores: [{ fila: 0, campo: 'archivo', mensaje: 'ARCHIVO_ILEGIBLE: No se pudo leer el archivo XLSX' }],
    };
  }
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 1) {
    return {
      productos: [],
      errores: [{ fila: 0, campo: 'archivo', mensaje: 'ARCHIVO_VACIO: El archivo no contiene datos' }],
    };
  }
  
  // Find header row (first row)
  const headerRow = worksheet.getRow(1);
  const productoCol = findColumnIndex(headerRow, ['Producto', 'Nombre', 'Descripcion']);
  const familiaCol = findColumnIndex(headerRow, ['Familia', 'Family', 'Tipo', 'Codigo Funcional']);
  
  if (productoCol === null) {
    return {
      productos: [],
      errores: [{ fila: 1, campo: 'columnas', mensaje: 'COLUMNAS_FALTANTES: No se encontró columna "Producto"' }],
    };
  }
  
  // Parse data rows (skip header)
  for (let rowIdx = 2; rowIdx <= worksheet.rowCount; rowIdx++) {
    const row = worksheet.getRow(rowIdx);
    
    // Skip empty rows
    if (row.cellCount === 0) continue;
    
    const productoOriginal = getCellValue(row.getCell(productoCol)).trim();
    const familiaNombre = familiaCol ? getCellValue(row.getCell(familiaCol)).trim() : '';
    
    // Skip completely empty rows
    if (!productoOriginal && !familiaNombre) continue;
    
    const productoNorm = normalizeProducto(productoOriginal);
    const familiaId = getFamiliaId(familiaNombre);
    
    productos.push({
      fila: rowIdx,
      producto_original: productoOriginal,
      producto_norm: productoNorm,
      familia_nombre: familiaNombre,
      familia_id: familiaId,
    });
  }
  
  if (productos.length === 0) {
    errores.push({ fila: 0, campo: 'datos', mensaje: 'ARCHIVO_VACIO: El archivo no contiene productos' });
  }
  
  return { productos, errores };
}

/**
 * Parse an XLSX file containing routes master data
 */
export async function parseRutasXLSX(buffer: Buffer | Uint8Array): Promise<ParsedRutasResult> {
  const rutas: ParsedRuta[] = [];
  const errores: ParseError[] = [];
  
  const workbook = new ExcelJS.Workbook();
  
  try {
    await workbook.xlsx.load(buffer as any);
  } catch (error) {
    return {
      rutas: [],
      errores: [{ fila: 0, campo: 'archivo', mensaje: 'ARCHIVO_ILEGIBLE: No se pudo leer el archivo XLSX' }],
    };
  }
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 1) {
    return {
      rutas: [],
      errores: [{ fila: 0, campo: 'archivo', mensaje: 'ARCHIVO_VACIO: El archivo no contiene datos' }],
    };
  }
  
  // Find header row (first row)
  const headerRow = worksheet.getRow(1);
  const rutaCol = findColumnIndex(headerRow, ['Ruta', 'Route', 'Nombre']);
  const ordenCol = findColumnIndex(headerRow, ['Orden', 'Order', 'Prioridad']);
  
  if (rutaCol === null) {
    return {
      rutas: [],
      errores: [{ fila: 1, campo: 'columnas', mensaje: 'COLUMNAS_FALTANTES: No se encontró columna "Ruta"' }],
    };
  }
  
  // Parse data rows (skip header)
  for (let rowIdx = 2; rowIdx <= worksheet.rowCount; rowIdx++) {
    const row = worksheet.getRow(rowIdx);
    
    // Skip empty rows
    if (row.cellCount === 0) continue;
    
    const rutaOriginal = getCellValue(row.getCell(rutaCol)).trim();
    const ordenStr = ordenCol ? getCellValue(row.getCell(ordenCol)).trim() : '';
    
    // Skip completely empty rows
    if (!rutaOriginal) continue;
    
    const rutaNorm = normalizeRuta(rutaOriginal);
    const ordenSugerido = ordenStr ? parseInt(ordenStr, 10) : null;
    
    rutas.push({
      fila: rowIdx,
      ruta_original: rutaOriginal,
      ruta_norm: rutaNorm,
      orden_sugerido: isNaN(ordenSugerido as number) ? null : ordenSugerido,
    });
  }
  
  if (rutas.length === 0) {
    errores.push({ fila: 0, campo: 'datos', mensaje: 'ARCHIVO_VACIO: El archivo no contiene rutas' });
  }
  
  return { rutas, errores };
}
