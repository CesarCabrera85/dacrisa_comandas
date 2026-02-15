/**
 * Operator Assignment Module
 * Implements deterministic assignment: Pool + Affinity + Round-Robin
 */

import prisma from './prisma.js';
import { normalizeText } from './normalization.js';

// Types
export type AssignmentReason = 'AFINIDAD' | 'ROUND_ROBIN' | 'SIN_POOL';

export interface AssignmentResult {
  operario_id: string | null;
  razon: AssignmentReason;
}

export interface PoolOperario {
  usuario_id: string;
}

/**
 * Assign an operator to a client/product family combination
 * 
 * Logic (in order):
 * 1. Get pool of operators enabled for this family in this shift
 * 2. Check for existing affinity (same client + codigo_funcional)
 * 3. If no affinity or affinity not in pool, use round-robin
 * 4. Create/update affinity if assigned by round-robin
 * 
 * @param clienteNombre Client name (will be normalized)
 * @param codigoFuncional Product functional code
 * @param turnoId Current shift ID
 * @returns AssignmentResult with operator ID and reason
 */
export async function assignOperario(
  clienteNombre: string,
  codigoFuncional: number,
  turnoId: string
): Promise<AssignmentResult> {
  // Normalize client name for affinity lookup
  const clienteAffinityKey = normalizeText(clienteNombre);

  // Step 1: Get pool of enabled operators
  const pool = await prisma.turnoUsuarioFamiliaHabilitada.findMany({
    where: {
      turno_id: turnoId,
      codigo_funcional: codigoFuncional,
      habilitada: true,
    },
    select: {
      usuario_id: true,
    },
    orderBy: {
      usuario_id: 'asc', // Deterministic order
    },
  });

  if (pool.length === 0) {
    // No operators in pool for this family
    return {
      operario_id: null,
      razon: 'SIN_POOL',
    };
  }

  const poolIds = pool.map((p) => p.usuario_id);

  // Step 2: Check for existing affinity
  const afinidad = await prisma.ownerAfinidad.findUnique({
    where: {
      turno_id_cliente_affinity_key_codigo_funcional: {
        turno_id: turnoId,
        cliente_affinity_key: clienteAffinityKey,
        codigo_funcional: codigoFuncional,
      },
    },
  });

  if (afinidad && poolIds.includes(afinidad.operario_id)) {
    // Affinity exists and operator is in pool
    return {
      operario_id: afinidad.operario_id,
      razon: 'AFINIDAD',
    };
  }

  // Step 3: Round-robin assignment
  // Get or create cursor for this turno/familia
  let cursor = await prisma.rRCursor.findUnique({
    where: {
      turno_id_codigo_funcional: {
        turno_id: turnoId,
        codigo_funcional: codigoFuncional,
      },
    },
  });

  let nextOperarioId: string;

  if (!cursor || !cursor.last_operario_id) {
    // No cursor, start with first operator in pool
    nextOperarioId = poolIds[0];
  } else {
    // Find next operator after last_operario_id
    const lastIndex = poolIds.indexOf(cursor.last_operario_id);
    
    if (lastIndex === -1 || lastIndex === poolIds.length - 1) {
      // Last operator not in pool or was the last one, wrap around
      nextOperarioId = poolIds[0];
    } else {
      // Take next operator
      nextOperarioId = poolIds[lastIndex + 1];
    }
  }

  // Update round-robin cursor
  await prisma.rRCursor.upsert({
    where: {
      turno_id_codigo_funcional: {
        turno_id: turnoId,
        codigo_funcional: codigoFuncional,
      },
    },
    update: {
      last_operario_id: nextOperarioId,
    },
    create: {
      turno_id: turnoId,
      codigo_funcional: codigoFuncional,
      last_operario_id: nextOperarioId,
    },
  });

  // Step 4: Create affinity if didn't exist
  if (!afinidad) {
    await prisma.ownerAfinidad.create({
      data: {
        turno_id: turnoId,
        cliente_affinity_key: clienteAffinityKey,
        codigo_funcional: codigoFuncional,
        operario_id: nextOperarioId,
      },
    });
  } else {
    // Update affinity to new operator (since old one wasn't in pool)
    await prisma.ownerAfinidad.update({
      where: {
        turno_id_cliente_affinity_key_codigo_funcional: {
          turno_id: turnoId,
          cliente_affinity_key: clienteAffinityKey,
          codigo_funcional: codigoFuncional,
        },
      },
      data: {
        operario_id: nextOperarioId,
      },
    });
  }

  return {
    operario_id: nextOperarioId,
    razon: 'ROUND_ROBIN',
  };
}

/**
 * Check if an operator is enabled for a specific family in a shift
 * @param operarioId Operator ID
 * @param codigoFuncional Family code
 * @param turnoId Shift ID
 * @returns boolean
 */
export async function isOperarioHabilitado(
  operarioId: string,
  codigoFuncional: number,
  turnoId: string
): Promise<boolean> {
  const habilitacion = await prisma.turnoUsuarioFamiliaHabilitada.findUnique({
    where: {
      turno_id_usuario_id_codigo_funcional: {
        turno_id: turnoId,
        usuario_id: operarioId,
        codigo_funcional: codigoFuncional,
      },
    },
  });

  return habilitacion?.habilitada === true;
}

/**
 * Get the pool of operators for a family in a shift
 * @param codigoFuncional Family code
 * @param turnoId Shift ID
 * @returns Array of operator IDs
 */
export async function getPoolOperarios(
  codigoFuncional: number,
  turnoId: string
): Promise<string[]> {
  const pool = await prisma.turnoUsuarioFamiliaHabilitada.findMany({
    where: {
      turno_id: turnoId,
      codigo_funcional: codigoFuncional,
      habilitada: true,
    },
    select: {
      usuario_id: true,
    },
    orderBy: {
      usuario_id: 'asc',
    },
  });

  return pool.map((p) => p.usuario_id);
}
