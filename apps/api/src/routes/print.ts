/**
 * Print Routes - Endpoints for PDF generation and print job management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { generateThermalPDF, generateA4PDF, getPdfFullUrl } from '../lib/pdf-generator.js';
import {
  enterRutaOperario,
  getOperarioProgress,
  updateOperarioLastPrinted,
  getColectaProgress,
  updateColectaLastPrinted,
} from '../lib/print-progress.js';
import {
  selectLineasOperarioInicial,
  selectLineasOperarioNuevos,
  selectLineasColectaNuevos,
  getMaxLoteIdFromLineas,
} from '../lib/line-selector.js';
import { createPrintJob, getPrintJobsForRuta } from '../lib/print-job-manager.js';
import { markRutaRecolectada } from '../lib/route-state-manager.js';

/**
 * Get the active turno or throw an error
 */
async function getActiveTurno() {
  const turno = await prisma.turno.findFirst({
    where: { estado: 'ACTIVO' },
  });

  if (!turno) {
    throw { statusCode: 404, code: 'NO_TURNO_ACTIVO', message: 'No hay turno activo' };
  }

  return turno;
}

/**
 * Validate that a ruta exists in the current turno
 */
async function validateRuta(turnoId: string, rutaNorm: string) {
  const rutaDia = await prisma.rutaDia.findUnique({
    where: {
      turno_id_ruta_norm: {
        turno_id: turnoId,
        ruta_norm: rutaNorm,
      },
    },
  });

  if (!rutaDia) {
    throw { statusCode: 404, code: 'RUTA_NO_ENCONTRADA', message: 'Ruta no encontrada en el turno actual' };
  }

  return rutaDia;
}

/**
 * Format date for PDF metadata
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Helper to check roles
 */
function checkRoles(request: FastifyRequest, allowedRoles: string[]): boolean {
  return allowedRoles.includes(request.user?.rol_tag || '');
}

export async function printRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', requireAuth);

  // =============================================
  // OPERARIO ENDPOINTS
  // =============================================

  /**
   * POST /api/print/rutas/:ruta_norm/operario/enter
   * Operario enters a route - creates snapshot/cutoff
   */
  app.post('/rutas/:ruta_norm/operario/enter', async (request: FastifyRequest<{
    Params: { ruta_norm: string }
  }>, reply: FastifyReply) => {
    // Check role
    if (!checkRoles(request, ['OPERARIO', 'JEFE', 'DIOS'])) {
      return reply.status(403).send({ code: 'FORBIDDEN', message: 'No tiene permisos para esta operación' });
    }

    try {
      const { ruta_norm } = request.params;
      const userId = request.user!.id;

      const turno = await getActiveTurno();
      await validateRuta(turno.id, ruta_norm);

      const progress = await enterRutaOperario(userId, ruta_norm, turno.id);

      return {
        success: true,
        cutoff_lote_id: progress.cutoff_lote_id,
        message: progress.cutoff_lote_id 
          ? 'Entrada registrada con snapshot'
          : 'Entrada registrada (sin lotes disponibles)',
      };
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ code: error.code, message: error.message });
      }
      app.log.error(`Error in operario enter: ${error.message}`);
      return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Error al registrar entrada' });
    }
  });

  /**
   * POST /api/print/rutas/:ruta_norm/operario/print-inicial
   * Print all lines up to cutoff snapshot
   */
  app.post('/rutas/:ruta_norm/operario/print-inicial', async (request: FastifyRequest<{
    Params: { ruta_norm: string }
  }>, reply: FastifyReply) => {
    if (!checkRoles(request, ['OPERARIO', 'JEFE', 'DIOS'])) {
      return reply.status(403).send({ code: 'FORBIDDEN', message: 'No tiene permisos para esta operación' });
    }

    try {
      const { ruta_norm } = request.params;
      const userId = request.user!.id;
      const userName = request.user!.nombre;

      const turno = await getActiveTurno();
      await validateRuta(turno.id, ruta_norm);

      // Get progress
      const progress = await getOperarioProgress(userId, ruta_norm, turno.id);

      if (!progress) {
        return reply.status(400).send({
          code: 'NO_ENTER',
          message: 'Debe hacer enter primero',
        });
      }

      if (!progress.cutoff_lote_id) {
        return reply.status(409).send({
          code: 'NOTHING_TO_PRINT',
          message: 'No hay lotes para imprimir en el snapshot',
        });
      }

      // Select lines
      const lineas = await selectLineasOperarioInicial(
        userId,
        ruta_norm,
        turno.id,
        progress.cutoff_lote_id
      );

      if (lineas.length === 0) {
        return reply.status(409).send({
          code: 'NOTHING_TO_PRINT',
          message: 'No hay líneas asignadas para imprimir',
        });
      }

      // Generate PDF
      const pdfPath = await generateThermalPDF(lineas, {
        tipo: 'OPERARIO_INICIAL',
        usuario_nombre: userName,
        ruta_nombre: ruta_norm,
        fecha: formatDate(new Date()),
      });

      // Get max lote ID for progress update
      const maxLoteId = await getMaxLoteIdFromLineas(lineas);

      // Create print job
      const printJob = await createPrintJob({
        tipo: 'OPERARIO_INICIAL',
        actor_user_id: userId,
        ruta_norm,
        turno_id: turno.id,
        lineas,
        pdf_path: pdfPath,
        cutoff_lote_id: progress.cutoff_lote_id,
        to_lote_id: maxLoteId,
      });

      // Update progress
      if (maxLoteId) {
        await updateOperarioLastPrinted(userId, ruta_norm, turno.id, maxLoteId);
      }

      return {
        success: true,
        print_job_id: printJob.id,
        pdf_url: pdfPath,
        pdf_full_url: getPdfFullUrl(pdfPath),
        lineas_count: lineas.length,
      };
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ code: error.code, message: error.message });
      }
      app.log.error(`Error in operario print-inicial: ${error.message}`);
      return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Error al generar PDF' });
    }
  });

  /**
   * POST /api/print/rutas/:ruta_norm/operario/print-nuevos
   * Print new lines (after last printed lote)
   */
  app.post('/rutas/:ruta_norm/operario/print-nuevos', async (request: FastifyRequest<{
    Params: { ruta_norm: string }
  }>, reply: FastifyReply) => {
    if (!checkRoles(request, ['OPERARIO', 'JEFE', 'DIOS'])) {
      return reply.status(403).send({ code: 'FORBIDDEN', message: 'No tiene permisos para esta operación' });
    }

    try {
      const { ruta_norm } = request.params;
      const userId = request.user!.id;
      const userName = request.user!.nombre;

      const turno = await getActiveTurno();
      await validateRuta(turno.id, ruta_norm);

      // Get progress
      const progress = await getOperarioProgress(userId, ruta_norm, turno.id);

      if (!progress) {
        return reply.status(400).send({
          code: 'NO_ENTER',
          message: 'Debe hacer enter primero',
        });
      }

      if (!progress.last_printed_lote_id) {
        return reply.status(400).send({
          code: 'NO_INICIAL',
          message: 'Debe imprimir inicial primero',
        });
      }

      // Select new lines
      const lineas = await selectLineasOperarioNuevos(
        userId,
        ruta_norm,
        turno.id,
        progress.last_printed_lote_id
      );

      if (lineas.length === 0) {
        return reply.status(409).send({
          code: 'NOTHING_TO_PRINT',
          message: 'No hay nuevas líneas para imprimir',
        });
      }

      // Generate PDF
      const pdfPath = await generateThermalPDF(lineas, {
        tipo: 'OPERARIO_NUEVOS',
        usuario_nombre: userName,
        ruta_nombre: ruta_norm,
        fecha: formatDate(new Date()),
      });

      // Get max lote ID for progress update
      const maxLoteId = await getMaxLoteIdFromLineas(lineas);

      // Create print job
      const printJob = await createPrintJob({
        tipo: 'OPERARIO_NUEVOS',
        actor_user_id: userId,
        ruta_norm,
        turno_id: turno.id,
        lineas,
        pdf_path: pdfPath,
        from_lote_id: progress.last_printed_lote_id,
        to_lote_id: maxLoteId,
      });

      // Update progress
      if (maxLoteId) {
        await updateOperarioLastPrinted(userId, ruta_norm, turno.id, maxLoteId);
      }

      return {
        success: true,
        print_job_id: printJob.id,
        pdf_url: pdfPath,
        pdf_full_url: getPdfFullUrl(pdfPath),
        lineas_count: lineas.length,
      };
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ code: error.code, message: error.message });
      }
      app.log.error(`Error in operario print-nuevos: ${error.message}`);
      return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Error al generar PDF' });
    }
  });

  /**
   * GET /api/print/rutas/:ruta_norm/operario/status
   * Get operario progress and available actions
   */
  app.get('/rutas/:ruta_norm/operario/status', async (request: FastifyRequest<{
    Params: { ruta_norm: string }
  }>, reply: FastifyReply) => {
    if (!checkRoles(request, ['OPERARIO', 'JEFE', 'DIOS'])) {
      return reply.status(403).send({ code: 'FORBIDDEN', message: 'No tiene permisos para esta operación' });
    }

    try {
      const { ruta_norm } = request.params;
      const userId = request.user!.id;

      const turno = await getActiveTurno();
      await validateRuta(turno.id, ruta_norm);

      const progress = await getOperarioProgress(userId, ruta_norm, turno.id);

      if (!progress) {
        return {
          has_entered: false,
          can_print_inicial: false,
          can_print_nuevos: false,
          cutoff_lote_id: null,
          last_printed_lote_id: null,
        };
      }

      return {
        has_entered: true,
        can_print_inicial: progress.cutoff_lote_id !== null,
        can_print_nuevos: progress.last_printed_lote_id !== null,
        cutoff_lote_id: progress.cutoff_lote_id,
        last_printed_lote_id: progress.last_printed_lote_id,
        last_printed_at: progress.last_printed_at,
      };
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ code: error.code, message: error.message });
      }
      app.log.error(`Error in operario status: ${error.message}`);
      return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Error al obtener estado' });
    }
  });

  // =============================================
  // COLECTA ENDPOINTS
  // =============================================

  /**
   * POST /api/print/rutas/:ruta_norm/colecta/print-nuevos
   * Print new lines for colecta (A4 format)
   */
  app.post('/rutas/:ruta_norm/colecta/print-nuevos', async (request: FastifyRequest<{
    Params: { ruta_norm: string }
  }>, reply: FastifyReply) => {
    if (!checkRoles(request, ['COLECTA', 'JEFE', 'DIOS'])) {
      return reply.status(403).send({ code: 'FORBIDDEN', message: 'No tiene permisos para esta operación' });
    }

    try {
      const { ruta_norm } = request.params;
      const userId = request.user!.id;

      const turno = await getActiveTurno();
      await validateRuta(turno.id, ruta_norm);

      // Get colecta progress
      const progress = await getColectaProgress(ruta_norm, turno.id);

      // Select lines (null lastPrintedLoteId means get all)
      const lineas = await selectLineasColectaNuevos(
        ruta_norm,
        turno.id,
        progress?.last_closed_lote_id || null
      );

      if (lineas.length === 0) {
        return reply.status(409).send({
          code: 'NOTHING_TO_PRINT',
          message: 'No hay líneas para imprimir',
        });
      }

      // Generate A4 PDF
      const pdfPath = await generateA4PDF(lineas, {
        tipo: 'COLECTA_NUEVOS',
        ruta_nombre: ruta_norm,
        fecha: formatDate(new Date()),
      });

      // Get max lote ID for progress update
      const maxLoteId = await getMaxLoteIdFromLineas(lineas);

      // Create print job
      const printJob = await createPrintJob({
        tipo: 'COLECTA_NUEVOS',
        actor_user_id: userId,
        ruta_norm,
        turno_id: turno.id,
        lineas,
        pdf_path: pdfPath,
        from_lote_id: progress?.last_closed_lote_id || null,
        to_lote_id: maxLoteId,
      });

      // Update progress
      if (maxLoteId) {
        await updateColectaLastPrinted(ruta_norm, turno.id, maxLoteId);
      }

      return {
        success: true,
        print_job_id: printJob.id,
        pdf_url: pdfPath,
        pdf_full_url: getPdfFullUrl(pdfPath),
        lineas_count: lineas.length,
      };
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ code: error.code, message: error.message });
      }
      app.log.error(`Error in colecta print-nuevos: ${error.message}`);
      return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Error al generar PDF' });
    }
  });

  /**
   * POST /api/print/rutas/:ruta_norm/colecta/marcar-recolectada
   * Mark route as collected
   */
  app.post('/rutas/:ruta_norm/colecta/marcar-recolectada', async (request: FastifyRequest<{
    Params: { ruta_norm: string }
  }>, reply: FastifyReply) => {
    if (!checkRoles(request, ['COLECTA', 'JEFE', 'DIOS'])) {
      return reply.status(403).send({ code: 'FORBIDDEN', message: 'No tiene permisos para esta operación' });
    }

    try {
      const { ruta_norm } = request.params;
      const userId = request.user!.id;

      const turno = await getActiveTurno();
      await validateRuta(turno.id, ruta_norm);

      // Mark route as collected
      await markRutaRecolectada(turno.id, ruta_norm, userId);

      return {
        success: true,
        message: 'Ruta marcada como recolectada',
      };
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ code: error.code, message: error.message });
      }
      app.log.error(`Error in marcar-recolectada: ${error.message}`);
      return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Error al marcar ruta' });
    }
  });

  /**
   * GET /api/print/rutas/:ruta_norm/colecta/status
   * Get colecta progress
   */
  app.get('/rutas/:ruta_norm/colecta/status', async (request: FastifyRequest<{
    Params: { ruta_norm: string }
  }>, reply: FastifyReply) => {
    if (!checkRoles(request, ['COLECTA', 'JEFE', 'DIOS'])) {
      return reply.status(403).send({ code: 'FORBIDDEN', message: 'No tiene permisos para esta operación' });
    }

    try {
      const { ruta_norm } = request.params;

      const turno = await getActiveTurno();
      const rutaDia = await validateRuta(turno.id, ruta_norm);

      const progress = await getColectaProgress(ruta_norm, turno.id);

      return {
        estado_logico: rutaDia.estado_logico,
        estado_visual: rutaDia.estado_visual,
        last_closed_lote_id: progress?.last_closed_lote_id || null,
        last_closed_at: progress?.last_closed_at || null,
      };
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ code: error.code, message: error.message });
      }
      app.log.error(`Error in colecta status: ${error.message}`);
      return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Error al obtener estado' });
    }
  });

  // =============================================
  // COMMON ENDPOINTS
  // =============================================

  /**
   * GET /api/print/rutas/:ruta_norm/jobs
   * Get print jobs history for a route
   */
  app.get('/rutas/:ruta_norm/jobs', async (request: FastifyRequest<{
    Params: { ruta_norm: string }
  }>, reply: FastifyReply) => {
    try {
      const { ruta_norm } = request.params;

      const turno = await getActiveTurno();
      await validateRuta(turno.id, ruta_norm);

      const jobs = await getPrintJobsForRuta(turno.id, ruta_norm);

      return jobs;
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ code: error.code, message: error.message });
      }
      app.log.error(`Error getting print jobs: ${error.message}`);
      return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Error al obtener trabajos' });
    }
  });
}

export default printRoutes;
