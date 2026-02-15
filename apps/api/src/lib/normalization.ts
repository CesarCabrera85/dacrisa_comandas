/**
 * Normalization library for master data
 * Ensures deterministic text normalization for consistent matching
 */

/**
 * Normalize text to uppercase, remove accents and special characters
 * @param text Input text to normalize
 * @returns Normalized text (uppercase, no accents, no special chars)
 */
export function normalizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  // Convert to uppercase
  let result = text.toUpperCase();
  
  // Remove accents (Spanish-focused)
  const accentMap: Record<string, string> = {
    'Á': 'A', 'À': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A',
    'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
    'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
    'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O',
    'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
    'Ñ': 'N',
    'Ç': 'C',
  };
  
  for (const [accented, plain] of Object.entries(accentMap)) {
    result = result.replace(new RegExp(accented, 'g'), plain);
  }
  
  // Remove special characters except letters, numbers, and spaces
  result = result.replace(/[^A-Z0-9\s]/g, '');
  
  // Replace multiple spaces with single space
  result = result.replace(/\s+/g, ' ');
  
  // Trim
  result = result.trim();
  
  return result;
}

/**
 * Normalize a product name
 * @param producto Product name to normalize
 * @returns Normalized product name
 */
export function normalizeProducto(producto: string): string {
  return normalizeText(producto);
}

/**
 * Normalize a route name
 * @param ruta Route name to normalize
 * @returns Normalized route name
 */
export function normalizeRuta(ruta: string): string {
  return normalizeText(ruta);
}
