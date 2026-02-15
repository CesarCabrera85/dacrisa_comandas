/**
 * Print Progress Management Module
 * Manages snapshot/cutoff tracking for operario and colecta printing
 */

import prisma from './prisma.js';
import { registerEvento } from './event-registry.js';

export interface OperarioProgress {
  turno_id: string;
  operario_id: string;
  ruta_norm: string;
  login_at: Date;
  cutoff_lote_id: string | null;
  last_printed_lote_id: string | null;
  last_printed_at: Date | null;
}

export interface ColectaProgress {
  turno_id: string;
  ruta_norm: string;
  last_closed_lote_id: string | null;
  last_closed_at: Date | null;
}

/**
 * Get the latest lote ID for a route in a turno
 */
async function getLatestLoteId(turnoId: string, rutaNorm: string): Promise<string | null> {
  const latestLote = await prisma.lote.findFirst({
    where: {
      ruta_dia: {
        turno_id: turnoId,
        ruta_norm: rutaNorm,
      },
      parse_status: 'OK',
    },
    orderBy: {
      created_at: 'desc',
    },
    select: {
      id: true,
    },
  });

  return latestLote?.id || null;
}

/**
 * Get the max lote ID from a list of lines (based on their pedido's lote)
 */
export async function getMaxLoteIdFromLineas(lineaIds: string[]): Promise<string | null> {
  if (lineaIds.length === 0) return null;

  const result = await prisma.linea.findFirst({
    where: {
      id: { in: lineaIds },
    },
    select: {
      pedido_cliente: {
        select: {
          lote_id: true,
        },
      },
    },
    orderBy: {
      pedido_cliente: {
        lote: {
          created_at: 'desc',
        },
      },
    },
  });

  return result?.pedido_cliente.lote_id || null;
}

/**
 * Called when an operario enters a route
 * Creates or updates the progress record with a cutoff snapshot
 * 
 * @param operarioId User ID of the operario
 * @param rutaNorm Normalized route name
 * @param turnoId Turno ID
 * @returns The progress record
 */
export async function enterRutaOperario(
  operarioId: string,
  rutaNorm: string,
  turnoId: string
): Promise<OperarioProgress> {
  // Check if there's an existing progress record
  const existingProgress = await prisma.operarioRutaProgress.findUnique({
    where: {
      turno_id_operario_id_ruta_norm: {
        turno_id: turnoId,
        operario_id: operarioId,
        ruta_norm: rutaNorm,
      },
    },
  });

  // If already exists, just return it (cutoff doesn't change)
  if (existingProgress) {
    return {
      turno_id: existingProgress.turno_id,
      operario_id: existingProgress.operario_id,
      ruta_norm: existingProgress.ruta_norm,
      login_at: existingProgress.login_at,
      cutoff_lote_id: existingProgress.cutoff_lote_id,
      last_printed_lote_id: existingProgress.last_printed_lote_id,
      last_printed_at: existingProgress.last_printed_at,
    };
  }

  // Get the latest lote for this route as the cutoff
  const cutoffLoteId = await getLatestLoteId(turnoId, rutaNorm);

  // Create new progress record
  const newProgress = await prisma.operarioRutaProgress.create({
    data: {
      turno_id: turnoId,
      operario_id: operarioId,
      ruta_norm: rutaNorm,
      login_at: new Date(),
      cutoff_lote_id: cutoffLoteId,
      last_printed_lote_id: null,
      last_printed_at: null,
    },
  });

  // Register event
  await registerEvento({
    tipo: 'OPERARIO_ENTER_RUTA',
    entidad_tipo: 'operario_ruta_progress',
    entidad_id: `${turnoId}:${operarioId}:${rutaNorm}`,
    actor_user_id: operarioId,
    payload: {
      turno_id: turnoId,
      operario_id: operarioId,
      ruta_norm: rutaNorm,
      cutoff_lote_id: cutoffLoteId,
    },
  });

  return {
    turno_id: newProgress.turno_id,
    operario_id: newProgress.operario_id,
    ruta_norm: newProgress.ruta_norm,
    login_at: newProgress.login_at,
    cutoff_lote_id: newProgress.cutoff_lote_id,
    last_printed_lote_id: newProgress.last_printed_lote_id,
    last_printed_at: newProgress.last_printed_at,
  };
}

/**
 * Get the current progress for an operario on a route
 */
export async function getOperarioProgress(
  operarioId: string,
  rutaNorm: string,
  turnoId: string
): Promise<OperarioProgress | null> {
  const progress = await prisma.operarioRutaProgress.findUnique({
    where: {
      turno_id_operario_id_ruta_norm: {
        turno_id: turnoId,
        operario_id: operarioId,
        ruta_norm: rutaNorm,
      },
    },
  });

  if (!progress) return null;

  return {
    turno_id: progress.turno_id,
    operario_id: progress.operario_id,
    ruta_norm: progress.ruta_norm,
    login_at: progress.login_at,
    cutoff_lote_id: progress.cutoff_lote_id,
    last_printed_lote_id: progress.last_printed_lote_id,
    last_printed_at: progress.last_printed_at,
  };
}

/**
 * Update the last printed lote for an operario
 */
export async function updateOperarioLastPrinted(
  operarioId: string,
  rutaNorm: string,
  turnoId: string,
  loteId: string
): Promise<void> {
  await prisma.operarioRutaProgress.update({
    where: {
      turno_id_operario_id_ruta_norm: {
        turno_id: turnoId,
        operario_id: operarioId,
        ruta_norm: rutaNorm,
      },
    },
    data: {
      last_printed_lote_id: loteId,
      last_printed_at: new Date(),
    },
  });
}

/**
 * Get the current progress for colecta on a route
 */
export async function getColectaProgress(
  rutaNorm: string,
  turnoId: string
): Promise<ColectaProgress | null> {
  const progress = await prisma.colectaRutaProgress.findUnique({
    where: {
      turno_id_ruta_norm: {
        turno_id: turnoId,
        ruta_norm: rutaNorm,
      },
    },
  });

  if (!progress) return null;

  return {
    turno_id: progress.turno_id,
    ruta_norm: progress.ruta_norm,
    last_closed_lote_id: progress.last_closed_lote_id,
    last_closed_at: progress.last_closed_at,
  };
}

/**
 * Update the last printed lote for colecta
 */
export async function updateColectaLastPrinted(
  rutaNorm: string,
  turnoId: string,
  loteId: string
): Promise<void> {
  await prisma.colectaRutaProgress.upsert({
    where: {
      turno_id_ruta_norm: {
        turno_id: turnoId,
        ruta_norm: rutaNorm,
      },
    },
    update: {
      last_closed_lote_id: loteId,
      last_closed_at: new Date(),
    },
    create: {
      turno_id: turnoId,
      ruta_norm: rutaNorm,
      last_closed_lote_id: loteId,
      last_closed_at: new Date(),
    },
  });
}
