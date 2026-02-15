import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/auth.js';
import { validateHorarioNoEnUso, TurnoRulesError } from '../lib/turno-rules.js';

type FranjaTurno = 'MANANA' | 'TARDE' | 'NOCHE';

const FRANJAS_VALIDAS: FranjaTurno[] = ['MANANA', 'TARDE', 'NOCHE'];

interface CreateHorarioBody {
  franja: FranjaTurno;
  start_time: string;
  end_time: string;
  activo?: boolean;
}

interface UpdateHorarioBody {
  franja?: FranjaTurno;
  start_time?: string;
  end_time?: string;
  activo?: boolean;
}

function parseTimeString(timeStr: string): Date {
  const parts = timeStr.split(':').map(Number);
  const date = new Date('1970-01-01T00:00:00Z');
  date.setUTCHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
  return date;
}

function formatTimeForResponse(date: Date): string {
  return date.toISOString().substr(11, 8);
}

export async function horariosRoutes(fastify: FastifyInstance) {
  // GET /api/horarios - Listar todos los horarios
  fastify.get('/', { preHandler: requireRole('CALIDAD', 'DIOS') }, async (request, reply) => {
    try {
      const horarios = await prisma.turnoHorario.findMany({
        orderBy: { franja: 'asc' },
      });

      const formatted = horarios.map((h) => ({
        id: h.id,
        franja: h.franja,
        start_time: formatTimeForResponse(h.start_time),
        end_time: formatTimeForResponse(h.end_time),
        activo: h.activo,
      }));

      return reply.send(formatted);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener horarios',
      });
    }
  });

  // POST /api/horarios - Crear horario
  fastify.post<{ Body: CreateHorarioBody }>('/', { preHandler: requireRole('CALIDAD', 'DIOS') }, async (request, reply) => {
    try {
      const { franja, start_time, end_time, activo = true } = request.body;

      // Validar franja
      if (!FRANJAS_VALIDAS.includes(franja)) {
        return reply.status(400).send({
          code: 'HORARIO_INVALIDO',
          message: `Franja inválida. Valores permitidos: ${FRANJAS_VALIDAS.join(', ')}`,
        });
      }

      // Validar tiempos
      const startTimeDate = parseTimeString(start_time);
      const endTimeDate = parseTimeString(end_time);

      // Verificar que no existe ya un horario con esa franja
      const existing = await prisma.turnoHorario.findFirst({
        where: { franja },
      });

      if (existing) {
        return reply.status(409).send({
          code: 'HORARIO_DUPLICADO',
          message: `Ya existe un horario para la franja ${franja}`,
        });
      }

      const horario = await prisma.turnoHorario.create({
        data: {
          franja,
          start_time: startTimeDate,
          end_time: endTimeDate,
          activo,
        },
      });

      return reply.status(201).send({
        id: horario.id,
        franja: horario.franja,
        start_time: formatTimeForResponse(horario.start_time),
        end_time: formatTimeForResponse(horario.end_time),
        activo: horario.activo,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Error al crear horario',
      });
    }
  });

  // PUT /api/horarios/:id - Actualizar horario
  fastify.put<{ Params: { id: string }; Body: UpdateHorarioBody }>('/:id', { preHandler: requireRole('CALIDAD', 'DIOS') }, async (request, reply) => {
    try {
      const { id } = request.params;
      const { franja, start_time, end_time, activo } = request.body;

      // Verificar que existe
      const existing = await prisma.turnoHorario.findUnique({
        where: { id },
      });

      if (!existing) {
        return reply.status(404).send({
          code: 'HORARIO_NO_ENCONTRADO',
          message: 'Horario no encontrado',
        });
      }

      // Validar franja si se proporciona
      if (franja && !FRANJAS_VALIDAS.includes(franja)) {
        return reply.status(400).send({
          code: 'HORARIO_INVALIDO',
          message: `Franja inválida. Valores permitidos: ${FRANJAS_VALIDAS.join(', ')}`,
        });
      }

      // Construir datos de actualización
      const updateData: Record<string, unknown> = {};
      if (franja !== undefined) updateData.franja = franja;
      if (start_time !== undefined) updateData.start_time = parseTimeString(start_time);
      if (end_time !== undefined) updateData.end_time = parseTimeString(end_time);
      if (activo !== undefined) updateData.activo = activo;

      const horario = await prisma.turnoHorario.update({
        where: { id },
        data: updateData,
      });

      return reply.send({
        id: horario.id,
        franja: horario.franja,
        start_time: formatTimeForResponse(horario.start_time),
        end_time: formatTimeForResponse(horario.end_time),
        activo: horario.activo,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Error al actualizar horario',
      });
    }
  });

  // DELETE /api/horarios/:id - Desactivar horario (soft delete)
  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: requireRole('CALIDAD', 'DIOS') }, async (request, reply) => {
    try {
      const { id } = request.params;

      // Verificar que existe
      const existing = await prisma.turnoHorario.findUnique({
        where: { id },
      });

      if (!existing) {
        return reply.status(404).send({
          code: 'HORARIO_NO_ENCONTRADO',
          message: 'Horario no encontrado',
        });
      }

      // Verificar que no hay turnos activos usando este horario
      await validateHorarioNoEnUso(existing.franja);

      // Soft delete - marcar como inactivo
      await prisma.turnoHorario.update({
        where: { id },
        data: { activo: false },
      });

      return reply.status(204).send();
    } catch (error) {
      if (error instanceof TurnoRulesError) {
        return reply.status(error.statusCode).send({
          code: error.code,
          message: error.message,
        });
      }
      fastify.log.error(error);
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Error al desactivar horario',
      });
    }
  });
}
