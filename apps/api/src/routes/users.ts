import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export async function usersRoutes(fastify: FastifyInstance) {
  // GET /api/users - Listar usuarios con filtro opcional por rol
  fastify.get<{ Querystring: { rol?: string } }>('/', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { rol } = request.query;

      const where: Record<string, unknown> = { estado: 'ACTIVO' };
      if (rol) {
        where.rol_tag = rol.toUpperCase();
      }

      const usuarios = await prisma.usuario.findMany({
        where,
        select: {
          id: true,
          nombre: true,
          rol_tag: true,
          funcion: true,
          estado: true,
        },
        orderBy: { nombre: 'asc' },
      });

      return reply.send(usuarios);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Error al obtener usuarios',
      });
    }
  });
}
