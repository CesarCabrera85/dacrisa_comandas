/**
 * Batch Processor Module
 * Complete processing of email batches (lotes):
 * - Parse subject and body
 * - Match products
 * - Assign operators
 * - Update route states
 */

import prisma from './prisma.js';
import { parseSubject, parseBody, type RutaMaster } from './email-parser.js';
import { matchProducto, type ProductoMaster } from './product-matcher.js';
import { assignOperario } from './operator-assignment.js';
import { onNuevoLote } from './route-state-manager.js';
import { registerEvento, PARSER_EVENT_TYPES } from './event-registry.js';
import { normalizeText, normalizeProducto } from './normalization.js';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Process a single lote
 * Performs all parsing, matching, assignment, and state management
 * 
 * @param loteId ID of the lote to process
 */
export async function processLote(loteId: string): Promise<void> {
  // Get the lote
  const lote = await prisma.lote.findUnique({
    where: { id: loteId },
  });

  if (!lote) {
    throw new Error(`Lote ${loteId} not found`);
  }

  // Skip if already processed or has error
  if (lote.parse_status !== 'PENDING' && lote.parse_status !== 'OK') {
    return;
  }

  // Get active turno
  const activeTurno = await prisma.turno.findFirst({
    where: { estado: 'ACTIVO' },
  });

  if (!activeTurno) {
    await prisma.lote.update({
      where: { id: loteId },
      data: {
        parse_status: 'ERROR_PARSE',
        parse_error: 'No hay turno activo',
      },
    });
    return;
  }

  const turnoId = activeTurno.id;

  // Use transaction for atomicity
  try {
    await prisma.$transaction(async (tx) => {
      // Step 1: Get active masterdata versions
      const productosVersion = await tx.productosMasterVersion.findFirst({
        where: { activo: true },
        include: {
          productos: {
            select: {
              id: true,
              producto_norm: true,
              familia: true,
            },
          },
        },
      });

      const rutasVersion = await tx.rutasMasterVersion.findFirst({
        where: { activo: true },
        include: {
          rutas: {
            select: {
              id: true,
              ruta_norm: true,
            },
          },
        },
      });

      if (!productosVersion) {
        throw new Error('No hay versión activa de productos');
      }

      if (!rutasVersion) {
        throw new Error('No hay versión activa de rutas');
      }

      // Step 2: Parse subject (route)
      const rutasMaster: RutaMaster[] = rutasVersion.rutas;
      const parsedSubject = parseSubject(lote.subject_raw, rutasMaster);

      if (!parsedSubject.success) {
        await tx.lote.update({
          where: { id: loteId },
          data: {
            parse_status: 'ERROR_RUTA',
            parse_error: parsedSubject.error || 'Ruta no encontrada',
            productos_version_id: productosVersion.id,
            rutas_version_id: rutasVersion.id,
          },
        });

        await registerEvento({
          tipo: PARSER_EVENT_TYPES.ERROR_PARSE_RUTA,
          entidad_tipo: 'lote',
          entidad_id: loteId,
          payload: {
            subject_raw: lote.subject_raw,
            ruta_norm: parsedSubject.ruta_norm,
            error: parsedSubject.error,
          },
        });

        return; // Don't throw, just stop processing this lote
      }

      // Step 3: Get or create ruta_dia
      const rutaNorm = parsedSubject.ruta_norm;
      let rutaDia = await tx.rutaDia.findUnique({
        where: {
          turno_id_ruta_norm: {
            turno_id: turnoId,
            ruta_norm: rutaNorm,
          },
        },
      });

      if (!rutaDia) {
        rutaDia = await tx.rutaDia.create({
          data: {
            turno_id: turnoId,
            ruta_norm: rutaNorm,
            estado_visual: 'AZUL',
            estado_logico: 'ACTIVA',
            reactivaciones_count: 0,
          },
        });
      }

      // Update lote with route info
      await tx.lote.update({
        where: { id: loteId },
        data: {
          ruta_dia_id: rutaDia.id,
          productos_version_id: productosVersion.id,
          rutas_version_id: rutasVersion.id,
          original_turno_id: turnoId,
          business_date: new Date(),
        },
      });

      // Step 4: Parse body (clients and lines)
      const parsedBody = parseBody(lote.body_raw);

      if (!parsedBody.success && parsedBody.clientes.length === 0) {
        await tx.lote.update({
          where: { id: loteId },
          data: {
            parse_status: 'ERROR_PARSE',
            parse_error: parsedBody.errores.map((e) => e.mensaje).join('; '),
          },
        });

        await registerEvento({
          tipo: PARSER_EVENT_TYPES.ERROR_PARSE_BODY,
          entidad_tipo: 'lote',
          entidad_id: loteId,
          payload: {
            errores: parsedBody.errores,
          },
        });

        return;
      }

      // Log body parsing warnings
      for (const error of parsedBody.errores) {
        if (error.tipo === 'WARNING') {
          await registerEvento({
            tipo: 'PARSE_WARNING',
            entidad_tipo: 'lote',
            entidad_id: loteId,
            payload: {
              mensaje: error.mensaje,
              linea: error.linea,
            },
          });
        }
      }

      // Step 5: Process each client
      const productosMaster: ProductoMaster[] = productosVersion.productos;
      let totalLineas = 0;

      for (const clienteParsed of parsedBody.clientes) {
        // Create pedido_cliente
        const clienteAffinityKey = normalizeText(clienteParsed.nombre);
        
        const pedidoCliente = await tx.pedidoCliente.create({
          data: {
            lote_id: loteId,
            codigo_cliente: '', // Will be filled if available
            nombre_cliente_raw: clienteParsed.nombre,
            cliente_affinity_key: clienteAffinityKey,
            observaciones: clienteParsed.observaciones,
          },
        });

        // Process each line
        let seqInCliente = 0;
        for (const lineaParsed of clienteParsed.lineas) {
          seqInCliente++;
          totalLineas++;

          // Match product
          const matchResult = matchProducto(lineaParsed.producto, productosMaster);

          // Determine familia and codigo_funcional
          let familia = matchResult.familia_producto_id ?? 6; // Default to OTROS
          let codigoFuncional = familia; // In this system, familia = codigo_funcional

          // Log match events
          if (matchResult.type === 'NO_MATCH') {
            await registerEvento({
              tipo: PARSER_EVENT_TYPES.PRODUCTO_NO_ENCONTRADO,
              entidad_tipo: 'lote',
              entidad_id: loteId,
              payload: {
                producto_raw: lineaParsed.producto,
                cliente: clienteParsed.nombre,
                linea_seq: seqInCliente,
              },
            });
          } else if (matchResult.type === 'FUZZY') {
            // Get matched product details for logging
            const matchedProduct = productosMaster.find(
              (p) => p.id === matchResult.producto_master_id
            );

            await registerEvento({
              tipo: PARSER_EVENT_TYPES.PRODUCTO_ASIGNADO_POR_PROBABILIDAD,
              entidad_tipo: 'lote',
              entidad_id: loteId,
              payload: {
                producto_raw: lineaParsed.producto,
                producto_matched: matchedProduct?.producto_norm,
                score: matchResult.match_score,
                cliente: clienteParsed.nombre,
              },
            });
          }

          // Assign operator
          let operarioId: string | null = null;
          
          if (matchResult.type !== 'NO_MATCH') {
            const assignment = await assignOperario(
              clienteParsed.nombre,
              codigoFuncional,
              turnoId
            );

            operarioId = assignment.operario_id;

            if (assignment.razon === 'SIN_POOL') {
              await registerEvento({
                tipo: PARSER_EVENT_TYPES.SIN_POOL_CODIGO_FUNCIONAL,
                entidad_tipo: 'lote',
                entidad_id: loteId,
                payload: {
                  codigo_funcional: codigoFuncional,
                  familia,
                  cliente: clienteParsed.nombre,
                  producto: lineaParsed.producto,
                },
              });
            }
          }

          // Create linea
          await tx.linea.create({
            data: {
              pedido_cliente_id: pedidoCliente.id,
              seq_in_cliente: seqInCliente,
              cantidad: new Decimal(lineaParsed.cantidad),
              unidad_raw: lineaParsed.unidad,
              producto_raw: lineaParsed.producto,
              producto_norm: normalizeProducto(lineaParsed.producto),
              precio_raw: lineaParsed.precio.toString(),
              precio_num: new Decimal(lineaParsed.precio),
              moneda: 'EUR',
              match_method: matchResult.type === 'NO_MATCH' ? 'FUZZY' : matchResult.type,
              match_score: matchResult.match_score > 0 
                ? new Decimal(matchResult.match_score) 
                : null,
              familia: familia,
              codigo_funcional: codigoFuncional,
              operario_id: operarioId,
              assigned_at: operarioId ? new Date() : null,
            },
          });
        }
      }

      // Step 6: Mark lote as processed
      await tx.lote.update({
        where: { id: loteId },
        data: {
          parse_status: 'OK',
          parse_error: null,
        },
      });

      // Register success event
      await registerEvento({
        tipo: PARSER_EVENT_TYPES.LOTE_PROCESADO,
        entidad_tipo: 'lote',
        entidad_id: loteId,
        payload: {
          clientes_count: parsedBody.clientes.length,
          lineas_count: totalLineas,
          ruta_norm: rutaNorm,
          turno_id: turnoId,
        },
      });
    });

    // Step 7: Update route state (outside transaction)
    // Get the updated lote to know the route
    const updatedLote = await prisma.lote.findUnique({
      where: { id: loteId },
      include: {
        ruta_dia: true,
      },
    });

    if (updatedLote?.ruta_dia) {
      await onNuevoLote(turnoId, updatedLote.ruta_dia.ruta_norm);
    }
  } catch (error) {
    // Log processing error
    const errorMessage = error instanceof Error ? error.message : String(error);

    await prisma.lote.update({
      where: { id: loteId },
      data: {
        parse_status: 'ERROR_PARSE',
        parse_error: errorMessage,
      },
    });

    await registerEvento({
      tipo: PARSER_EVENT_TYPES.ERROR_PROCESAMIENTO_LOTE,
      entidad_tipo: 'lote',
      entidad_id: loteId,
      payload: {
        error: errorMessage,
      },
    });

    throw error;
  }
}

/**
 * Process all pending lotes
 * @returns Number of lotes processed
 */
export async function processAllPendingLotes(): Promise<number> {
  const pendingLotes = await prisma.lote.findMany({
    where: {
      parse_status: 'PENDING',
    },
    orderBy: {
      received_at: 'asc',
    },
  });

  let processed = 0;

  for (const lote of pendingLotes) {
    try {
      await processLote(lote.id);
      processed++;
    } catch (error) {
      // Error already logged in processLote
      console.error(`Error processing lote ${lote.id}:`, error);
    }
  }

  return processed;
}
