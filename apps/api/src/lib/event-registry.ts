/**
 * Event Registry Module
 * Centralized event logging to the eventos table
 * Now with EventBus integration for SSE broadcasting
 */

import prisma from './prisma.js';
import { eventBus } from './event-emitter.js';

export interface EventoInput {
  tipo: string;
  entidad_tipo: string;
  entidad_id: string;
  actor_user_id?: string | null;
  payload?: object;
}

/**
 * Register an event in the eventos table and emit via EventBus for SSE
 * @param evento Event data
 * @returns Created event record
 */
export async function registerEvento(evento: EventoInput) {
  const createdEvento = await prisma.evento.create({
    data: {
      tipo: evento.tipo,
      entidad_tipo: evento.entidad_tipo,
      entidad_id: evento.entidad_id,
      actor_user_id: evento.actor_user_id ?? null,
      payload: evento.payload ?? {},
      ts: new Date(),
    },
  });

  // Emit event to EventBus for SSE broadcasting
  eventBus.emitSSEEvent({
    id: createdEvento.id,
    ts: createdEvento.ts,
    actor_user_id: createdEvento.actor_user_id,
    tipo: createdEvento.tipo,
    entidad_tipo: createdEvento.entidad_tipo,
    entidad_id: createdEvento.entidad_id,
    payload: createdEvento.payload as object,
  });

  return createdEvento;
}

/**
 * Get events by type
 * @param tipo Event type
 * @param limit Maximum number of events to return
 */
export async function getEventosByTipo(tipo: string, limit = 100) {
  return prisma.evento.findMany({
    where: { tipo },
    orderBy: { ts: 'desc' },
    take: limit,
  });
}

/**
 * Get events for an entity
 * @param entidadTipo Entity type
 * @param entidadId Entity ID
 * @param limit Maximum number of events to return
 */
export async function getEventosByEntidad(
  entidadTipo: string,
  entidadId: string,
  limit = 100
) {
  return prisma.evento.findMany({
    where: {
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
    },
    orderBy: { ts: 'desc' },
    take: limit,
  });
}

// Event type constants for parser and batch processing
export const PARSER_EVENT_TYPES = {
  ERROR_PARSE_RUTA: 'ERROR_PARSE_RUTA',
  ERROR_PARSE_BODY: 'ERROR_PARSE_BODY',
  PRODUCTO_NO_ENCONTRADO: 'PRODUCTO_NO_ENCONTRADO',
  PRODUCTO_ASIGNADO_POR_PROBABILIDAD: 'PRODUCTO_ASIGNADO_POR_PROBABILIDAD',
  SIN_POOL_CODIGO_FUNCIONAL: 'SIN_POOL_CODIGO_FUNCIONAL',
  LOTE_PROCESADO: 'LOTE_PROCESADO',
  ERROR_PROCESAMIENTO_LOTE: 'ERROR_PROCESAMIENTO_LOTE',
  RUTA_ALERTA_ROJA: 'RUTA_ALERTA_ROJA',
  RUTA_COMPLETA_VERDE: 'RUTA_COMPLETA_VERDE',
  RUTA_RECOLECTADA: 'RUTA_RECOLECTADA',
  LOTE_CARRYOVER: 'LOTE_CARRYOVER',
} as const;

// Additional event types for SSE monitoring
export const SSE_EVENT_TYPES = {
  TURNO_INICIADO: 'TURNO_INICIADO',
  TURNO_CERRADO: 'TURNO_CERRADO',
  IMPRESION_REALIZADA: 'IMPRESION_REALIZADA',
  PRODUCTOS_ACTIVATED: 'PRODUCTOS_ACTIVATED',
  RUTAS_ACTIVATED: 'RUTAS_ACTIVATED',
} as const;
