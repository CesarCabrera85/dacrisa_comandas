import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  validateSingleActiveTurno,
  validateHorarioActivo,
  validateTurnoDuplicado,
  validateTurnoParaConfiguracion,
  validateTurnoParaCerrar,
  calculateTurnoEndTime,
  TurnoRulesError,
} from '../lib/turno-rules.js';

type FranjaTurno = 'MANANA' | 'TARDE' | 'NOCHE';

interface IniciarTurnoBody {
  franja: FranjaTurno;
  fecha: string;
}

interface ConfigurarHabilidadesBody {
  habilidades: {
    usuario_id: string;
    codigo_funcional_ids: number[];
  }[];
}

interface ConfigurarColectaBody {
  colecta: {
    ruta_norm: string;
    colecta_user_id: string;
  }[];
}

function formatTimeForResponse(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().substr(11, 8);
}

export async function turnosRoutes(fastify: FastifyInstance) {
  // GET /api/turnos/activo - Obtener turno activo con toda la configuración
  fastify.get('/activo', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const turno = await prisma.turno.findFirst({
        where: { estado: 'ACTIVO' },
        include: {
          jefe: {
            select: { id: true, nombre: true },
          },
          turno_usuarios: {
            include: {
              usuario: {
                select: { id: true, nombre: true },
              },
            },
          },
          colecta_asignaciones: {
            include: {
              colecta: {
                select: { id: true, nombre: true },
              },
            },
          },
        },
      });

      if (!turno) {
        return reply.status(404).send({
          code: 'TURNO_NO_ENCONTRADO',
          message: 'No hay turno activo',
        });
      }

      // Obtener horario asociado
      const horario = await prisma.turnoHorario.findFirst({
        where: { franja: turno.franja, activo: true },
      });

      return reply.send({
        id: turno.id,
        fecha: turno.fecha.toISOString().split('T')[0],
        franja: turno.franja,
        jefe_id: turno.jefe_id,
        jefe: turno.jefe,
        estado: turno.estado,
        started_at: turno.started_at?.toISOString() || null,
        ended_at: turno.ended_at?.toISOString() || null,
        horario: horario ? {
          id: horario.id,
          franja: horario.franja,
          start_time: formatTimeForResponse(horario.start_time),
          end_time: formatTimeForResponse(horario.end_time),
          activo: horario.activo,
        } : null,
        habilidades: turno.turno_usuarios.map((tu) => ({
          turno_id: tu.turno_id,
          usuario_id: tu.usuario_id,
          codigo_funcional: tu.codigo_funcional,
          habilitada: tu.habilitada,
          usuario: tu.usuario,
        })),
        colecta: turno.colecta_asignaciones.map((ca) => ({
          turno_id: ca.turno_id,
          ruta_norm: ca.ruta_norm,
          colecta_user_id: ca.colecta_user_id,
          colecta: ca.colecta,
        })),
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener turno activo',
      });
    }
  });

  // POST /api/turnos/iniciar - Iniciar nuevo turno
  fastify.post<{ Body: IniciarTurnoBody }>('/iniciar', { preHandler: requireRole('JEFE', 'DIOS') }, async (request, reply) => {
    try {
      const { franja, fecha } = request.body;
      const fechaDate = new Date(fecha);
      const userId = request.user!.id;

      // Validaciones
      await validateSingleActiveTurno();
      const horario = await validateHorarioActivo(franja);
      await validateTurnoDuplicado(fechaDate, franja);

      // Calcular ended_at
      const endedAt = calculateTurnoEndTime(fechaDate, horario.end_time);

      // Crear turno
      const turno = await prisma.turno.create({
        data: {
          fecha: fechaDate,
          franja,
          jefe_id: userId,
          estado: 'ACTIVO',
          started_at: new Date(),
          ended_at: endedAt,
        },
      });

      // Registrar evento
      await prisma.evento.create({
        data: {
          tipo: 'TURNO_INICIADO',
          entidad_tipo: 'TURNO',
          entidad_id: turno.id,
          actor_user_id: userId,
          payload: {
            franja,
            fecha: fecha,
          },
        },
      });

      fastify.log.info(`Turno ${turno.id} iniciado por usuario ${userId}`);

      return reply.status(201).send({
        id: turno.id,
        fecha: turno.fecha.toISOString().split('T')[0],
        franja: turno.franja,
        jefe_id: turno.jefe_id,
        estado: turno.estado,
        started_at: turno.started_at?.toISOString() || null,
        ended_at: turno.ended_at?.toISOString() || null,
      });
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
        message: 'Error al iniciar turno',
      });
    }
  });

  // PUT /api/turnos/:turno_id/habilidades - Configurar habilidades del turno
  fastify.put<{ Params: { turno_id: string }; Body: ConfigurarHabilidadesBody }>('/:turno_id/habilidades', { preHandler: requireRole('JEFE', 'DIOS') }, async (request, reply) => {
    try {
      const { turno_id } = request.params;
      const { habilidades } = request.body;

      // Validar turno
      await validateTurnoParaConfiguracion(turno_id);

      // Eliminar habilidades existentes
      await prisma.turnoUsuarioFamiliaHabilitada.deleteMany({
        where: { turno_id },
      });

      // Insertar nuevas habilidades
      const habilidadesData: {
        turno_id: string;
        usuario_id: string;
        codigo_funcional: number;
        habilitada: boolean;
      }[] = [];

      for (const hab of habilidades) {
        for (const codigoFuncional of hab.codigo_funcional_ids) {
          habilidadesData.push({
            turno_id,
            usuario_id: hab.usuario_id,
            codigo_funcional: codigoFuncional,
            habilitada: true,
          });
        }
      }

      if (habilidadesData.length > 0) {
        await prisma.turnoUsuarioFamiliaHabilitada.createMany({
          data: habilidadesData,
        });
      }

      // Obtener habilidades actualizadas
      const updatedHabilidades = await prisma.turnoUsuarioFamiliaHabilitada.findMany({
        where: { turno_id },
        include: {
          usuario: {
            select: { id: true, nombre: true },
          },
        },
      });

      return reply.send({
        turno_id,
        habilidades: updatedHabilidades.map((h) => ({
          turno_id: h.turno_id,
          usuario_id: h.usuario_id,
          codigo_funcional: h.codigo_funcional,
          habilitada: h.habilitada,
          usuario: h.usuario,
        })),
      });
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
        message: 'Error al configurar habilidades',
      });
    }
  });

  // PUT /api/turnos/:turno_id/colecta - Configurar colecta del turno
  fastify.put<{ Params: { turno_id: string }; Body: ConfigurarColectaBody }>('/:turno_id/colecta', { preHandler: requireRole('JEFE', 'DIOS') }, async (request, reply) => {
    try {
      const { turno_id } = request.params;
      const { colecta } = request.body;

      // Validar turno
      await validateTurnoParaConfiguracion(turno_id);

      // Eliminar configuración de colecta existente
      await prisma.colectaAsignacion.deleteMany({
        where: { turno_id },
      });

      // Insertar nueva configuración
      if (colecta.length > 0) {
        await prisma.colectaAsignacion.createMany({
          data: colecta.map((c) => ({
            turno_id,
            ruta_norm: c.ruta_norm,
            colecta_user_id: c.colecta_user_id,
          })),
        });
      }

      // Obtener configuración actualizada
      const updatedColecta = await prisma.colectaAsignacion.findMany({
        where: { turno_id },
        include: {
          colecta: {
            select: { id: true, nombre: true },
          },
        },
      });

      return reply.send({
        turno_id,
        colecta: updatedColecta.map((c) => ({
          turno_id: c.turno_id,
          ruta_norm: c.ruta_norm,
          colecta_user_id: c.colecta_user_id,
          colecta: c.colecta,
        })),
      });
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
        message: 'Error al configurar colecta',
      });
    }
  });

  // POST /api/turnos/:turno_id/cerrar - Cerrar turno manualmente
  fastify.post<{ Params: { turno_id: string } }>('/:turno_id/cerrar', { preHandler: requireRole('JEFE', 'DIOS') }, async (request, reply) => {
    try {
      const { turno_id } = request.params;
      const userId = request.user!.id;

      // Validar turno
      await validateTurnoParaCerrar(turno_id);

      // Cerrar turno
      const turno = await prisma.turno.update({
        where: { id: turno_id },
        data: {
          estado: 'CERRADO',
          ended_at: new Date(),
        },
      });

      // Registrar evento
      await prisma.evento.create({
        data: {
          tipo: 'TURNO_CERRADO',
          entidad_tipo: 'TURNO',
          entidad_id: turno_id,
          actor_user_id: userId,
          payload: {
            cerrado_manualmente: true,
          },
        },
      });

      fastify.log.info(`Turno ${turno_id} cerrado manualmente por usuario ${userId}`);

      return reply.send({
        id: turno.id,
        fecha: turno.fecha.toISOString().split('T')[0],
        franja: turno.franja,
        jefe_id: turno.jefe_id,
        estado: turno.estado,
        started_at: turno.started_at?.toISOString() || null,
        ended_at: turno.ended_at?.toISOString() || null,
      });
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
        message: 'Error al cerrar turno',
      });
    }
  });
}
