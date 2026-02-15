/**
 * Product Matcher Module
 * Exact and fuzzy matching of products using fuzzball
 */

import * as fuzzball from 'fuzzball';
import { normalizeProducto } from './normalization.js';

// Types
export interface ProductoMaster {
  id: string;
  producto_norm: string;
  familia: number;
}

export type MatchType = 'EXACT' | 'FUZZY' | 'NO_MATCH';

export interface MatchResult {
  type: MatchType;
  producto_master_id: string | null;
  familia_producto_id: number | null;
  match_score: number;
  error?: string;
}

// Default fuzzy match threshold (can be overridden via env)
const DEFAULT_FUZZY_THRESHOLD = 80;

/**
 * Get the fuzzy match threshold from environment or use default
 */
function getFuzzyThreshold(): number {
  const envThreshold = process.env.FUZZY_MATCH_THRESHOLD;
  if (envThreshold) {
    const parsed = parseInt(envThreshold, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }
  }
  return DEFAULT_FUZZY_THRESHOLD;
}

/**
 * Match a raw product name against the master product list
 * First attempts exact match, then fuzzy match using Levenshtein distance
 * 
 * @param productoRaw Raw product name from email
 * @param productosMaster List of master products to match against
 * @returns MatchResult with match type, product ID, family ID, and score
 */
export function matchProducto(
  productoRaw: string,
  productosMaster: ProductoMaster[]
): MatchResult {
  if (!productoRaw || typeof productoRaw !== 'string') {
    return {
      type: 'NO_MATCH',
      producto_master_id: null,
      familia_producto_id: null,
      match_score: 0,
      error: 'PRODUCTO_NO_ENCONTRADO',
    };
  }

  if (!productosMaster || productosMaster.length === 0) {
    return {
      type: 'NO_MATCH',
      producto_master_id: null,
      familia_producto_id: null,
      match_score: 0,
      error: 'PRODUCTO_NO_ENCONTRADO',
    };
  }

  // Normalize the raw product
  const productoNorm = normalizeProducto(productoRaw);

  if (!productoNorm) {
    return {
      type: 'NO_MATCH',
      producto_master_id: null,
      familia_producto_id: null,
      match_score: 0,
      error: 'PRODUCTO_NO_ENCONTRADO',
    };
  }

  // Step 1: Try EXACT match
  const exactMatch = productosMaster.find(
    (p) => p.producto_norm === productoNorm
  );

  if (exactMatch) {
    return {
      type: 'EXACT',
      producto_master_id: exactMatch.id,
      familia_producto_id: exactMatch.familia,
      match_score: 1.0,
    };
  }

  // Step 2: Try FUZZY match using fuzzball
  // Create choices array for fuzzball.extract
  const choices = productosMaster.map((p) => ({
    id: p.id,
    producto_norm: p.producto_norm,
    familia: p.familia,
  }));

  // Use ratio for Levenshtein-like comparison
  const results = fuzzball.extract(
    productoNorm,
    choices,
    {
      scorer: fuzzball.ratio,
      processor: (choice: { producto_norm: string }) => choice.producto_norm,
      limit: 1,
      cutoff: 0, // Get all results, we'll filter by threshold
    }
  );

  if (results.length > 0) {
    const bestMatch = results[0];
    const score = bestMatch[1]; // Score is 0-100
    const matchedProduct = bestMatch[0] as { id: string; producto_norm: string; familia: number };

    const threshold = getFuzzyThreshold();

    if (score >= threshold) {
      return {
        type: 'FUZZY',
        producto_master_id: matchedProduct.id,
        familia_producto_id: matchedProduct.familia,
        match_score: score / 100, // Convert to 0-1 scale
      };
    }
  }

  // No match found
  return {
    type: 'NO_MATCH',
    producto_master_id: null,
    familia_producto_id: null,
    match_score: 0,
    error: 'PRODUCTO_NO_ENCONTRADO',
  };
}

/**
 * Batch match multiple products
 * @param productosRaw Array of raw product names
 * @param productosMaster List of master products
 * @returns Array of match results
 */
export function matchProductosBatch(
  productosRaw: string[],
  productosMaster: ProductoMaster[]
): MatchResult[] {
  return productosRaw.map((producto) => matchProducto(producto, productosMaster));
}
