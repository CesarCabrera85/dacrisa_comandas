/**
 * Line Selector Module
 * Selects lines eligible for printing based on cutoff/progress
 */

import prisma from './prisma.js';
import { LineaConDatos } from './pdf-generator.js';

/**
 * Transform raw Prisma results to LineaConDatos format
 */
function transformToLineaConDatos(rawLinea: any): LineaConDatos {
  return {
    id: rawLinea.id,
    lote_id: rawLinea.pedido_cliente.lote_id,
    pedido_cliente_id: rawLinea.pedido_cliente_id,
    cliente_nombre: rawLinea.pedido_cliente.nombre_cliente_raw || rawLinea.pedido_cliente.codigo_cliente,
    cliente_codigo: rawLinea.pedido_cliente.codigo_cliente,
    observaciones: rawLinea.pedido_cliente.observaciones,
    producto_nombre: rawLinea.producto_raw,
    producto_norm: rawLinea.producto_norm,
    cantidad: Number(rawLinea.cantidad),
    unidad: rawLinea.unidad_raw,
    precio: rawLinea.precio_num ? Number(rawLinea.precio_num) : null,
    linea_observacion: rawLinea.linea_observacion,
  };
}

/**
 * Select lines for initial operario printing (lotes <= cutoff)
 * 
 * @param operarioId User ID of the operario
 * @param rutaNorm Normalized route name
 * @param turnoId Turno ID
 * @param cutoffLoteId The cutoff lote ID (snapshot)
 * @returns Array of lines eligible for printing
 */
export async function selectLineasOperarioInicial(
  operarioId: string,
  rutaNorm: string,
  turnoId: string,
  cutoffLoteId: string
): Promise<LineaConDatos[]> {
  // Get the cutoff lote's created_at timestamp for comparison
  const cutoffLote = await prisma.lote.findUnique({
    where: { id: cutoffLoteId },
    select: { created_at: true },
  });

  if (!cutoffLote) {
    return [];
  }

  // Select all lines assigned to this operario in this route
  // where the lote was created before or at the cutoff time
  const lineas = await prisma.linea.findMany({
    where: {
      operario_id: operarioId,
      pedido_cliente: {
        lote: {
          ruta_dia: {
            turno_id: turnoId,
            ruta_norm: rutaNorm,
          },
          created_at: {
            lte: cutoffLote.created_at,
          },
          parse_status: 'OK',
        },
      },
    },
    include: {
      pedido_cliente: {
        select: {
          id: true,
          lote_id: true,
          codigo_cliente: true,
          nombre_cliente_raw: true,
          observaciones: true,
          lote: {
            select: {
              id: true,
              created_at: true,
            },
          },
        },
      },
    },
    orderBy: [
      {
        pedido_cliente: {
          lote: {
            created_at: 'asc',
          },
        },
      },
      {
        pedido_cliente: {
          id: 'asc',
        },
      },
      {
        seq_in_cliente: 'asc',
      },
    ],
  });

  return lineas.map(transformToLineaConDatos);
}

/**
 * Select NEW lines for operario printing (lotes > lastPrintedLoteId)
 * 
 * @param operarioId User ID of the operario
 * @param rutaNorm Normalized route name
 * @param turnoId Turno ID
 * @param lastPrintedLoteId The last printed lote ID
 * @returns Array of new lines eligible for printing
 */
export async function selectLineasOperarioNuevos(
  operarioId: string,
  rutaNorm: string,
  turnoId: string,
  lastPrintedLoteId: string
): Promise<LineaConDatos[]> {
  // Get the last printed lote's created_at timestamp
  const lastPrintedLote = await prisma.lote.findUnique({
    where: { id: lastPrintedLoteId },
    select: { created_at: true },
  });

  if (!lastPrintedLote) {
    return [];
  }

  // Select all lines assigned to this operario in this route
  // where the lote was created AFTER the last printed lote
  const lineas = await prisma.linea.findMany({
    where: {
      operario_id: operarioId,
      pedido_cliente: {
        lote: {
          ruta_dia: {
            turno_id: turnoId,
            ruta_norm: rutaNorm,
          },
          created_at: {
            gt: lastPrintedLote.created_at,
          },
          parse_status: 'OK',
        },
      },
    },
    include: {
      pedido_cliente: {
        select: {
          id: true,
          lote_id: true,
          codigo_cliente: true,
          nombre_cliente_raw: true,
          observaciones: true,
          lote: {
            select: {
              id: true,
              created_at: true,
            },
          },
        },
      },
    },
    orderBy: [
      {
        pedido_cliente: {
          lote: {
            created_at: 'asc',
          },
        },
      },
      {
        pedido_cliente: {
          id: 'asc',
        },
      },
      {
        seq_in_cliente: 'asc',
      },
    ],
  });

  return lineas.map(transformToLineaConDatos);
}

/**
 * Select NEW lines for colecta printing
 * If lastPrintedLoteId is null, returns ALL lines for the route
 * 
 * @param rutaNorm Normalized route name
 * @param turnoId Turno ID
 * @param lastPrintedLoteId The last printed lote ID (can be null for first print)
 * @returns Array of lines eligible for printing
 */
export async function selectLineasColectaNuevos(
  rutaNorm: string,
  turnoId: string,
  lastPrintedLoteId: string | null
): Promise<LineaConDatos[]> {
  // Base where clause
  const whereClause: any = {
    pedido_cliente: {
      lote: {
        ruta_dia: {
          turno_id: turnoId,
          ruta_norm: rutaNorm,
        },
        parse_status: 'OK',
      },
    },
  };

  // If there's a last printed lote, only get newer ones
  if (lastPrintedLoteId) {
    const lastPrintedLote = await prisma.lote.findUnique({
      where: { id: lastPrintedLoteId },
      select: { created_at: true },
    });

    if (lastPrintedLote) {
      whereClause.pedido_cliente.lote.created_at = {
        gt: lastPrintedLote.created_at,
      };
    }
  }

  const lineas = await prisma.linea.findMany({
    where: whereClause,
    include: {
      pedido_cliente: {
        select: {
          id: true,
          lote_id: true,
          codigo_cliente: true,
          nombre_cliente_raw: true,
          observaciones: true,
          lote: {
            select: {
              id: true,
              created_at: true,
            },
          },
        },
      },
    },
    orderBy: [
      {
        pedido_cliente: {
          lote: {
            created_at: 'asc',
          },
        },
      },
      {
        pedido_cliente: {
          codigo_cliente: 'asc',
        },
      },
      {
        seq_in_cliente: 'asc',
      },
    ],
  });

  return lineas.map(transformToLineaConDatos);
}

/**
 * Get the max lote ID from an array of lines
 */
export async function getMaxLoteIdFromLineas(lineas: LineaConDatos[]): Promise<string | null> {
  if (lineas.length === 0) return null;

  // Get unique lote IDs
  const loteIds = [...new Set(lineas.map(l => l.lote_id))];

  // Find the most recent lote
  const maxLote = await prisma.lote.findFirst({
    where: {
      id: { in: loteIds },
    },
    orderBy: {
      created_at: 'desc',
    },
    select: {
      id: true,
    },
  });

  return maxLote?.id || null;
}
