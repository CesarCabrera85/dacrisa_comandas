/**
 * Routes API - Query endpoints for routes, clients, and lines
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { getRutaSummary } from '../lib/route-state-manager.js';

export async function rutasRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', requireAuth);

  /**
   * GET /api/rutas
   * List all routes for a shift with counters
   */
  app.get('/', async (request: FastifyRequest<{
    Querystring: { turno_id?: string }
  }>, reply) => {
    try {
      // Get turno_id from query or use active turno
      let turnoId = request.query.turno_id;

      if (!turnoId) {
        const activeTurno = await prisma.turno.findFirst({
          where: { estado: 'ACTIVO' },
        });

        if (!activeTurno) {
          return reply.status(404).send({
            code: 'NO_TURNO_ACTIVO',
            message: 'No hay turno activo',
          });
        }

        turnoId = activeTurno.id;
      }

      // Get all rutas_dia for this turno
      const rutasDia = await prisma.rutaDia.findMany({
        where: {
          turno_id: turnoId,
        },
        orderBy: {
          ruta_norm: 'asc',
        },
      });

      // Build response with counters
      const rutas = await Promise.all(
        rutasDia.map(async (rd) => {
          // Count lotes
          const lotesCount = await prisma.lote.count({
            where: {
              ruta_dia_id: rd.id,
            },
          });

          // Count clients
          const clientesCount = await prisma.pedidoCliente.count({
            where: {
              lote: {
                ruta_dia_id: rd.id,
              },
            },
          });

          // Count total lines
          const totalLineas = await prisma.linea.count({
            where: {
              pedido_cliente: {
                lote: {
                  ruta_dia_id: rd.id,
                },
              },
            },
          });

          // Count unprinted lines
          const pendienteImprimible = await prisma.linea.count({
            where: {
              printed_at: null,
              pedido_cliente: {
                lote: {
                  ruta_dia_id: rd.id,
                },
              },
            },
          });

          return {
            ruta_id: rd.id,
            ruta_nombre: rd.ruta_norm,
            estado_visual: rd.estado_visual,
            estado_logico: rd.estado_logico,
            pendiente_imprimible: pendienteImprimible,
            total_clientes: clientesCount,
            total_lineas: totalLineas,
            lotes_count: lotesCount,
          };
        })
      );

      return rutas;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.log.error(`Error getting rutas: ${errorMsg}`);
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Error obteniendo rutas',
      });
    }
  });

  /**
   * GET /api/rutas/:ruta_id/clientes
   * List clients for a route with counters
   */
  app.get('/:ruta_id/clientes', async (request: FastifyRequest<{
    Params: { ruta_id: string }
    Querystring: { turno_id?: string }
  }>, reply) => {
    try {
      const { ruta_id } = request.params;
      let turnoId = request.query.turno_id;

      // Get the ruta_dia
      const rutaDia = await prisma.rutaDia.findUnique({
        where: { id: ruta_id },
      });

      if (!rutaDia) {
        return reply.status(404).send({
          code: 'RUTA_NO_ENCONTRADA',
          message: 'Ruta no encontrada',
        });
      }

      // Get all pedidos for this route
      const pedidos = await prisma.pedidoCliente.findMany({
        where: {
          lote: {
            ruta_dia_id: ruta_id,
          },
        },
        include: {
          lineas: {
            select: {
              id: true,
              printed_at: true,
              operario_id: true,
            },
          },
        },
        orderBy: {
          created_at: 'asc',
        },
      });

      // Get operator names for unique operator IDs
      const operarioIds = [...new Set(
        pedidos.flatMap((p) => p.lineas.map((l) => l.operario_id).filter(Boolean))
      )];

      const operarios = await prisma.usuario.findMany({
        where: {
          id: { in: operarioIds as string[] },
        },
        select: {
          id: true,
          nombre: true,
        },
      });

      const operarioMap = new Map(operarios.map((o) => [o.id, o.nombre]));

      // Build response
      const clientes = pedidos.map((p) => {
        const totalLineas = p.lineas.length;
        const lineasImpresas = p.lineas.filter((l) => l.printed_at !== null).length;
        const lineasPendientes = totalLineas - lineasImpresas;

        // Get primary operator (most common)
        const operarioCount = new Map<string, number>();
        for (const l of p.lineas) {
          if (l.operario_id) {
            operarioCount.set(l.operario_id, (operarioCount.get(l.operario_id) || 0) + 1);
          }
        }

        let operarioId: string | null = null;
        let maxCount = 0;
        for (const [id, count] of operarioCount) {
          if (count > maxCount) {
            maxCount = count;
            operarioId = id;
          }
        }

        return {
          pedido_cliente_id: p.id,
          cliente_nombre: p.nombre_cliente_raw || p.codigo_cliente,
          operario_id: operarioId,
          operario_nombre: operarioId ? operarioMap.get(operarioId) || null : null,
          observaciones: p.observaciones,
          total_lineas: totalLineas,
          lineas_impresas: lineasImpresas,
          lineas_pendientes: lineasPendientes,
        };
      });

      return clientes;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.log.error(`Error getting clientes: ${errorMsg}`);
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Error obteniendo clientes',
      });
    }
  });

  /**
   * GET /api/rutas/:ruta_id/clientes/:cliente_id/lineas
   * List lines for a client
   */
  app.get('/:ruta_id/clientes/:cliente_id/lineas', async (request: FastifyRequest<{
    Params: { ruta_id: string; cliente_id: string }
  }>, reply) => {
    try {
      const { ruta_id, cliente_id } = request.params;

      // Verify the pedido_cliente belongs to the ruta
      const pedido = await prisma.pedidoCliente.findFirst({
        where: {
          id: cliente_id,
          lote: {
            ruta_dia_id: ruta_id,
          },
        },
      });

      if (!pedido) {
        return reply.status(404).send({
          code: 'CLIENTE_NO_ENCONTRADO',
          message: 'Cliente no encontrado en esta ruta',
        });
      }

      // Get all lines for this client
      const lineas = await prisma.linea.findMany({
        where: {
          pedido_cliente_id: cliente_id,
        },
        orderBy: {
          seq_in_cliente: 'asc',
        },
      });

      // Build response
      const response = lineas.map((l) => ({
        linea_id: l.id,
        producto_nombre: l.producto_raw,
        producto_norm: l.producto_norm,
        cantidad: Number(l.cantidad),
        unidad: l.unidad_raw,
        precio: l.precio_num ? Number(l.precio_num) : null,
        match_method: l.match_method,
        match_score: l.match_score ? Number(l.match_score) : null,
        impreso: l.printed_at !== null,
        printed_at: l.printed_at,
        print_count: l.print_count,
        operario_id: l.operario_id,
        familia: l.familia,
        observacion: l.linea_observacion,
      }));

      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.log.error(`Error getting lineas: ${errorMsg}`);
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Error obteniendo líneas',
      });
    }
  });

  /**
   * GET /api/rutas/:ruta_id/summary
   * Get route summary with all counters
   */
  app.get('/:ruta_id/summary', async (request: FastifyRequest<{
    Params: { ruta_id: string }
  }>, reply) => {
    try {
      const { ruta_id } = request.params;

      const rutaDia = await prisma.rutaDia.findUnique({
        where: { id: ruta_id },
      });

      if (!rutaDia) {
        return reply.status(404).send({
          code: 'RUTA_NO_ENCONTRADA',
          message: 'Ruta no encontrada',
        });
      }

      const summary = await getRutaSummary(rutaDia.turno_id, rutaDia.ruta_norm);

      return summary;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      app.log.error(`Error getting ruta summary: ${errorMsg}`);
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Error obteniendo resumen de ruta',
      });
    }
  });
}

export default rutasRoutes;
