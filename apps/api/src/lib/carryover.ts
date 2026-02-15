/**
 * Carryover Module
 * Carries over unprinted lotes from previous shift to new shift
 */

import prisma from './prisma.js';
import { registerEvento, PARSER_EVENT_TYPES } from './event-registry.js';
import { updateRutaDiaEstado } from './route-state-manager.js';
import { Decimal } from '@prisma/client/runtime/library';

export interface CarryoverResult {
  lotes_carryover: number;
  lineas_carryover: number;
}

/**
 * Get the previous closed shift
 * @returns Previous turno or null
 */
export async function getTurnoAnterior() {
  return prisma.turno.findFirst({
    where: {
      estado: 'CERRADO',
    },
    orderBy: {
      ended_at: 'desc',
    },
  });
}

/**
 * Execute carryover from previous shift to new shift
 * Copies lotes with unprinted lines to the new shift
 * 
 * @param nuevoTurnoId New shift ID
 * @param turnoAnteriorId Previous shift ID
 * @returns CarryoverResult with counts
 */
export async function executeCarryover(
  nuevoTurnoId: string,
  turnoAnteriorId: string
): Promise<CarryoverResult> {
  let lotesCarryover = 0;
  let lineasCarryover = 0;

  // Find lotes with unprinted lines from previous shift
  const lotesConPendientes = await prisma.lote.findMany({
    where: {
      original_turno_id: turnoAnteriorId,
      pedidos: {
        some: {
          lineas: {
            some: {
              printed_at: null,
            },
          },
        },
      },
    },
    include: {
      ruta_dia: true,
      pedidos: {
        include: {
          lineas: {
            where: {
              printed_at: null, // Only unprinted lines
            },
          },
        },
      },
    },
  });

  const affectedRutas = new Set<string>();

  for (const loteAnterior of lotesConPendientes) {
    // Skip lotes without unprinted lines
    const lineasSinImprimir = loteAnterior.pedidos.flatMap((p) => p.lineas);
    if (lineasSinImprimir.length === 0) {
      continue;
    }

    // Get or create ruta_dia for the new turno
    const rutaNorm = loteAnterior.ruta_dia?.ruta_norm;
    if (!rutaNorm) {
      console.warn(`Lote ${loteAnterior.id} has no ruta_dia, skipping carryover`);
      continue;
    }

    let rutaDiaNueva = await prisma.rutaDia.findUnique({
      where: {
        turno_id_ruta_norm: {
          turno_id: nuevoTurnoId,
          ruta_norm: rutaNorm,
        },
      },
    });

    if (!rutaDiaNueva) {
      rutaDiaNueva = await prisma.rutaDia.create({
        data: {
          turno_id: nuevoTurnoId,
          ruta_norm: rutaNorm,
          estado_visual: 'AZUL',
          estado_logico: 'ACTIVA',
          reactivaciones_count: 0,
        },
      });
    }

    // Create new lote in new turno
    const nuevoLote = await prisma.lote.create({
      data: {
        imap_uid: loteAnterior.imap_uid,
        imap_uidvalidity: loteAnterior.imap_uidvalidity,
        received_at: loteAnterior.received_at,
        subject_raw: loteAnterior.subject_raw,
        body_raw: loteAnterior.body_raw,
        parse_status: 'OK', // Already parsed
        business_date: new Date(),
        ruta_dia_id: rutaDiaNueva.id,
        productos_version_id: loteAnterior.productos_version_id, // Keep original version
        rutas_version_id: loteAnterior.rutas_version_id, // Keep original version
        original_turno_id: nuevoTurnoId,
        carried_over: true,
      },
    });

    // Copy pedidos and lineas
    let loteLinesCount = 0;

    for (const pedidoAnterior of loteAnterior.pedidos) {
      // Only copy if has unprinted lines
      if (pedidoAnterior.lineas.length === 0) {
        continue;
      }

      // Create new pedido_cliente
      const nuevoPedido = await prisma.pedidoCliente.create({
        data: {
          lote_id: nuevoLote.id,
          codigo_cliente: pedidoAnterior.codigo_cliente,
          nombre_cliente_raw: pedidoAnterior.nombre_cliente_raw,
          localidad_raw: pedidoAnterior.localidad_raw,
          cliente_affinity_key: pedidoAnterior.cliente_affinity_key,
          observaciones: pedidoAnterior.observaciones,
        },
      });

      // Copy unprinted lines
      for (const lineaAnterior of pedidoAnterior.lineas) {
        await prisma.linea.create({
          data: {
            pedido_cliente_id: nuevoPedido.id,
            seq_in_cliente: lineaAnterior.seq_in_cliente,
            cantidad: lineaAnterior.cantidad,
            unidad_raw: lineaAnterior.unidad_raw,
            producto_raw: lineaAnterior.producto_raw,
            producto_norm: lineaAnterior.producto_norm,
            precio_raw: lineaAnterior.precio_raw,
            precio_num: lineaAnterior.precio_num,
            moneda: lineaAnterior.moneda,
            match_method: lineaAnterior.match_method,
            match_score: lineaAnterior.match_score,
            familia: lineaAnterior.familia,
            codigo_funcional: lineaAnterior.codigo_funcional,
            operario_id: lineaAnterior.operario_id, // Keep same operator
            assigned_at: lineaAnterior.assigned_at,
            linea_observacion: lineaAnterior.linea_observacion,
            // printed_at and print_count are reset (not copied)
          },
        });

        loteLinesCount++;
        lineasCarryover++;
      }
    }

    // Register carryover event
    await registerEvento({
      tipo: PARSER_EVENT_TYPES.LOTE_CARRYOVER,
      entidad_tipo: 'lote',
      entidad_id: nuevoLote.id,
      payload: {
        lote_original_id: loteAnterior.id,
        lote_nuevo_id: nuevoLote.id,
        turno_anterior_id: turnoAnteriorId,
        turno_nuevo_id: nuevoTurnoId,
        lineas_count: loteLinesCount,
        ruta_norm: rutaNorm,
      },
    });

    lotesCarryover++;
    affectedRutas.add(rutaNorm);
  }

  // Update route states for all affected routes
  for (const rutaNorm of affectedRutas) {
    await updateRutaDiaEstado(nuevoTurnoId, rutaNorm);
  }

  return {
    lotes_carryover: lotesCarryover,
    lineas_carryover: lineasCarryover,
  };
}

/**
 * Check if carryover is needed (are there unprinted lines from previous shift)
 * @param turnoAnteriorId Previous shift ID
 * @returns true if carryover is needed
 */
export async function needsCarryover(turnoAnteriorId: string): Promise<boolean> {
  const count = await prisma.linea.count({
    where: {
      printed_at: null,
      pedido_cliente: {
        lote: {
          original_turno_id: turnoAnteriorId,
        },
      },
    },
  });

  return count > 0;
}
