/**
 * Route State Manager Module
 * Manages route visual states: AZUL, VERDE, ROJO
 * 
 * States:
 * - AZUL: Initial state, there are pending unprinted lines
 * - VERDE: All lines printed (pendiente_imprimible = 0)
 * - ROJO: Alert, new batch arrived when route was VERDE or RECOLECTADA
 */

import prisma from './prisma.js';
import { registerEvento } from './event-registry.js';

export type EstadoVisualRuta = 'AZUL' | 'VERDE' | 'ROJO';
export type EstadoLogicoRuta = 'ACTIVA' | 'RECOLECTADA';

/**
 * Get or create a RutaDia record
 * @param turnoId Shift ID
 * @param rutaNorm Normalized route name
 * @returns RutaDia record
 */
async function getOrCreateRutaDia(turnoId: string, rutaNorm: string) {
  let rutaDia = await prisma.rutaDia.findUnique({
    where: {
      turno_id_ruta_norm: {
        turno_id: turnoId,
        ruta_norm: rutaNorm,
      },
    },
  });

  if (!rutaDia) {
    rutaDia = await prisma.rutaDia.create({
      data: {
        turno_id: turnoId,
        ruta_norm: rutaNorm,
        estado_visual: 'AZUL',
        estado_logico: 'ACTIVA',
        reactivaciones_count: 0,
      },
    });
  }

  return rutaDia;
}

/**
 * Calculate the number of unprinted lines for a route in a shift
 * @param turnoId Shift ID
 * @param rutaNorm Normalized route name
 * @returns Count of unprinted lines
 */
async function countPendienteImprimible(
  turnoId: string,
  rutaNorm: string
): Promise<number> {
  // Count lines that are not printed for this route in this shift
  const result = await prisma.linea.count({
    where: {
      printed_at: null,
      pedido_cliente: {
        lote: {
          ruta_dia: {
            turno_id: turnoId,
            ruta_norm: rutaNorm,
          },
        },
      },
    },
  });

  return result;
}

/**
 * Update the visual state of a route based on pending lines
 * @param turnoId Shift ID
 * @param rutaNorm Normalized route name
 * @returns Updated estado_visual
 */
export async function updateRutaDiaEstado(
  turnoId: string,
  rutaNorm: string
): Promise<EstadoVisualRuta> {
  const rutaDia = await getOrCreateRutaDia(turnoId, rutaNorm);
  const pendiente = await countPendienteImprimible(turnoId, rutaNorm);

  let nuevoEstado: EstadoVisualRuta;

  if (pendiente === 0) {
    // All printed
    nuevoEstado = 'VERDE';
  } else {
    // There are pending lines
    if (rutaDia.estado_visual === 'VERDE' || rutaDia.estado_logico === 'RECOLECTADA') {
      // Alert: new batch arrived in a route that was already green/collected
      nuevoEstado = 'ROJO';
    } else if (rutaDia.estado_visual === 'ROJO') {
      // Keep red if already red and still has pending
      nuevoEstado = 'ROJO';
    } else {
      // Normal pending state
      nuevoEstado = 'AZUL';
    }
  }

  // Update the route
  await prisma.rutaDia.update({
    where: {
      turno_id_ruta_norm: {
        turno_id: turnoId,
        ruta_norm: rutaNorm,
      },
    },
    data: {
      estado_visual: nuevoEstado,
      last_event_at: new Date(),
    },
  });

  return nuevoEstado;
}

/**
 * Handle new batch arrival for a route
 * Updates state and registers alert if necessary
 * @param turnoId Shift ID
 * @param rutaNorm Normalized route name
 * @param actorUserId Optional user ID for event logging
 */
export async function onNuevoLote(
  turnoId: string,
  rutaNorm: string,
  actorUserId?: string
): Promise<void> {
  const rutaDiaAntes = await getOrCreateRutaDia(turnoId, rutaNorm);
  const estadoAntes = rutaDiaAntes.estado_visual;

  const nuevoEstado = await updateRutaDiaEstado(turnoId, rutaNorm);

  // Register alert if state changed to RED
  if (nuevoEstado === 'ROJO' && estadoAntes !== 'ROJO') {
    await registerEvento({
      tipo: 'RUTA_ALERTA_ROJA',
      entidad_tipo: 'ruta_dia',
      entidad_id: `${turnoId}:${rutaNorm}`,
      actor_user_id: actorUserId,
      payload: {
        turno_id: turnoId,
        ruta_norm: rutaNorm,
        estado_antes: estadoAntes,
      },
    });
  }
}

/**
 * Handle line printed event
 * Updates state and registers completion if all lines printed
 * @param turnoId Shift ID
 * @param rutaNorm Normalized route name
 * @param actorUserId Optional user ID for event logging
 */
export async function onLineaImpresa(
  turnoId: string,
  rutaNorm: string,
  actorUserId?: string
): Promise<void> {
  const estadoAntes = (await getOrCreateRutaDia(turnoId, rutaNorm)).estado_visual;
  const nuevoEstado = await updateRutaDiaEstado(turnoId, rutaNorm);

  // Register completion if state changed to GREEN
  if (nuevoEstado === 'VERDE' && estadoAntes !== 'VERDE') {
    await registerEvento({
      tipo: 'RUTA_COMPLETA_VERDE',
      entidad_tipo: 'ruta_dia',
      entidad_id: `${turnoId}:${rutaNorm}`,
      actor_user_id: actorUserId,
      payload: {
        turno_id: turnoId,
        ruta_norm: rutaNorm,
        estado_antes: estadoAntes,
      },
    });
  }
}

/**
 * Mark a route as collected (recolectada)
 * @param turnoId Shift ID
 * @param rutaNorm Normalized route name
 * @param actorUserId User who marked it
 */
export async function markRutaRecolectada(
  turnoId: string,
  rutaNorm: string,
  actorUserId?: string
): Promise<void> {
  await prisma.rutaDia.update({
    where: {
      turno_id_ruta_norm: {
        turno_id: turnoId,
        ruta_norm: rutaNorm,
      },
    },
    data: {
      estado_logico: 'RECOLECTADA',
      last_event_at: new Date(),
    },
  });

  await registerEvento({
    tipo: 'RUTA_RECOLECTADA',
    entidad_tipo: 'ruta_dia',
    entidad_id: `${turnoId}:${rutaNorm}`,
    actor_user_id: actorUserId,
    payload: {
      turno_id: turnoId,
      ruta_norm: rutaNorm,
    },
  });
}

/**
 * Get route summary with counts
 * @param turnoId Shift ID
 * @param rutaNorm Normalized route name
 */
export async function getRutaSummary(
  turnoId: string,
  rutaNorm: string
) {
  const rutaDia = await getOrCreateRutaDia(turnoId, rutaNorm);
  const pendiente = await countPendienteImprimible(turnoId, rutaNorm);

  const totalLineas = await prisma.linea.count({
    where: {
      pedido_cliente: {
        lote: {
          ruta_dia: {
            turno_id: turnoId,
            ruta_norm: rutaNorm,
          },
        },
      },
    },
  });

  const totalClientes = await prisma.pedidoCliente.count({
    where: {
      lote: {
        ruta_dia: {
          turno_id: turnoId,
          ruta_norm: rutaNorm,
        },
      },
    },
  });

  const totalLotes = await prisma.lote.count({
    where: {
      ruta_dia: {
        turno_id: turnoId,
        ruta_norm: rutaNorm,
      },
    },
  });

  return {
    ruta_norm: rutaNorm,
    estado_visual: rutaDia.estado_visual,
    estado_logico: rutaDia.estado_logico,
    pendiente_imprimible: pendiente,
    total_lineas: totalLineas,
    total_clientes: totalClientes,
    total_lotes: totalLotes,
    last_event_at: rutaDia.last_event_at,
  };
}
