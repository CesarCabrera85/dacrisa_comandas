/**
 * IMAP Routes
 * Status and control endpoints for IMAP worker
 */

import { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/auth.js';
import { imapWorker } from '../services/imap-worker.js';

export async function imapRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/imap/status
   * Get current IMAP worker status
   * Permission: DIOS only
   */
  fastify.get('/status', { preHandler: requireRole('DIOS') }, async (request, reply) => {
    try {
      const status = await imapWorker.getStatus();
      
      return reply.send({
        isRunning: status.isRunning,
        isConnected: status.isConnected,
        lastError: status.lastError,
        lastPollTime: status.lastPollTime?.toISOString() || null,
        cursor: {
          lastUid: status.cursor.lastUid,
          uidValidity: status.cursor.uidValidity,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener estado IMAP',
      });
    }
  });

  /**
   * POST /api/imap/force-poll
   * Force an immediate polling cycle
   * Permission: DIOS only
   */
  fastify.post('/force-poll', { preHandler: requireRole('DIOS') }, async (request, reply) => {
    try {
      fastify.log.info('Forzando polling IMAP...');
      await imapWorker.poll();
      
      return reply.send({
        success: true,
        message: 'Polling forzado ejecutado',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Error en force-poll: ${errorMessage}`);
      return reply.status(500).send({
        code: 'IMAP_POLL_ERROR',
        message: `Error al forzar polling: ${errorMessage}`,
      });
    }
  });

  /**
   * POST /api/imap/restart
   * Restart the IMAP worker (stop and start)
   * Permission: DIOS only
   */
  fastify.post('/restart', { preHandler: requireRole('DIOS') }, async (request, reply) => {
    try {
      fastify.log.info('Reiniciando IMAP worker...');
      await imapWorker.stop();
      await imapWorker.start();
      
      return reply.send({
        success: true,
        message: 'IMAP worker reiniciado',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      fastify.log.error(`Error reiniciando IMAP worker: ${errorMessage}`);
      return reply.status(500).send({
        code: 'IMAP_RESTART_ERROR',
        message: `Error al reiniciar worker: ${errorMessage}`,
      });
    }
  });
}
