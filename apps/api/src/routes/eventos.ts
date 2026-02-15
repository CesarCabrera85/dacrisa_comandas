/**
 * Eventos Routes - SSE Stream and Historical Events
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { eventBus, SSEEvent } from '../lib/event-emitter.js';

export async function eventosRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', requireAuth);

  /**
   * GET /api/eventos/stream - SSE Stream for real-time events
   * Permissions: All authenticated roles
   */
  fastify.get('/stream', async (request: FastifyRequest<{
    Querystring: { lastEventId?: string }
  }>, reply: FastifyReply) => {
    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Get last event timestamp from client
    const lastEventId = request.headers['last-event-id'] as string || request.query.lastEventId;
    let lastEventTs: Date | null = null;
    
    if (lastEventId) {
      // lastEventId is ISO timestamp or event id - try to parse
      const parsedDate = new Date(lastEventId);
      if (!isNaN(parsedDate.getTime())) {
        lastEventTs = parsedDate;
      } else {
        // Try to find event by ID
        const existingEvent = await prisma.evento.findUnique({
          where: { id: lastEventId },
        });
        if (existingEvent) {
          lastEventTs = existingEvent.ts;
        }
      }
    }

    // Send historical events (replay)
    try {
      const historicalEvents = await prisma.evento.findMany({
        where: lastEventTs ? { ts: { gt: lastEventTs } } : {},
        orderBy: { ts: 'asc' },
        take: 100,
      });

      for (const evento of historicalEvents) {
        const eventData = {
          id: evento.id,
          ts: evento.ts.toISOString(),
          actor_user_id: evento.actor_user_id,
          tipo: evento.tipo,
          entidad_tipo: evento.entidad_tipo,
          entidad_id: evento.entidad_id,
          payload: evento.payload,
        };
        
        reply.raw.write(`id: ${evento.ts.toISOString()}\n`);
        reply.raw.write(`event: evento\n`);
        reply.raw.write(`data: ${JSON.stringify(eventData)}\n\n`);
      }
    } catch (error) {
      console.error('Error fetching historical events:', error);
    }

    // Track last sent timestamp to avoid duplicates
    let lastSentTs = lastEventTs || new Date();

    // Listener for new events
    const listener = (evento: SSEEvent) => {
      // Only send if newer than last sent
      if (evento.ts > lastSentTs) {
        const eventData = {
          id: evento.id,
          ts: evento.ts.toISOString(),
          actor_user_id: evento.actor_user_id,
          tipo: evento.tipo,
          entidad_tipo: evento.entidad_tipo,
          entidad_id: evento.entidad_id,
          payload: evento.payload,
        };

        try {
          reply.raw.write(`id: ${evento.ts.toISOString()}\n`);
          reply.raw.write(`event: evento\n`);
          reply.raw.write(`data: ${JSON.stringify(eventData)}\n\n`);
          lastSentTs = evento.ts;
        } catch (error) {
          console.error('Error writing SSE event:', error);
        }
      }
    };

    eventBus.on('new-event', listener);

    // Keepalive every 30 seconds
    const keepaliveInterval = setInterval(() => {
      try {
        reply.raw.write(': keepalive\n\n');
      } catch (error) {
        // Connection closed
        clearInterval(keepaliveInterval);
      }
    }, 30000);

    // Cleanup on connection close
    request.raw.on('close', () => {
      eventBus.off('new-event', listener);
      clearInterval(keepaliveInterval);
    });

    // Keep connection open (don't return reply)
  });

  /**
   * GET /api/eventos - Historical events with filters
   * Permissions: All authenticated roles
   */
  fastify.get('/', async (request: FastifyRequest<{
    Querystring: {
      tipo?: string;
      entidad_tipo?: string;
      entidad_id?: string;
      actor_user_id?: string;
      desde?: string;
      hasta?: string;
      limit?: string;
      offset?: string;
    }
  }>, reply: FastifyReply) => {
    const {
      tipo,
      entidad_tipo,
      entidad_id,
      actor_user_id,
      desde,
      hasta,
      limit = '50',
      offset = '0',
    } = request.query;

    const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    const skip = Math.max(parseInt(offset, 10) || 0, 0);

    // Build where clause dynamically
    const where: any = {};
    
    if (tipo) {
      where.tipo = tipo;
    }
    
    if (entidad_tipo) {
      where.entidad_tipo = entidad_tipo;
    }
    
    if (entidad_id) {
      where.entidad_id = entidad_id;
    }
    
    if (actor_user_id) {
      where.actor_user_id = actor_user_id;
    }
    
    // Date filters
    if (desde || hasta) {
      where.ts = {};
      if (desde) {
        where.ts.gte = new Date(desde);
      }
      if (hasta) {
        // End of day for hasta
        const hastaDate = new Date(hasta);
        hastaDate.setHours(23, 59, 59, 999);
        where.ts.lte = hastaDate;
      }
    }

    const [eventos, total] = await Promise.all([
      prisma.evento.findMany({
        where,
        orderBy: { ts: 'desc' },
        take,
        skip,
        include: {
          actor: {
            select: {
              id: true,
              nombre: true,
              rol_tag: true,
            },
          },
        },
      }),
      prisma.evento.count({ where }),
    ]);

    return reply.send({
      eventos: eventos.map(e => ({
        id: e.id,
        ts: e.ts.toISOString(),
        actor_user_id: e.actor_user_id,
        actor: e.actor ? {
          id: e.actor.id,
          nombre: e.actor.nombre,
          rol_tag: e.actor.rol_tag,
        } : null,
        tipo: e.tipo,
        entidad_tipo: e.entidad_tipo,
        entidad_id: e.entidad_id,
        payload: e.payload,
      })),
      pagination: {
        total,
        limit: take,
        offset: skip,
        hasMore: skip + take < total,
      },
    });
  });

  /**
   * GET /api/eventos/tipos - List all distinct event types
   * Permissions: All authenticated roles
   */
  fastify.get('/tipos', async (_request: FastifyRequest, reply: FastifyReply) => {
    const tipos = await prisma.evento.findMany({
      select: { tipo: true },
      distinct: ['tipo'],
      orderBy: { tipo: 'asc' },
    });

    return reply.send({
      tipos: tipos.map(t => t.tipo),
    });
  });
}
