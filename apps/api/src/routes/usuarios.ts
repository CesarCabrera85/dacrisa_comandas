import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireRole } from '../middleware/auth.js';
import { hashPassword, createCodeLookup, encryptCode } from '../lib/crypto.js';
import { validateCreateUsuario, validateUpdateUsuario, validateCodigo } from '../lib/validators.js';
import { invalidateUserSessions } from '../lib/session-manager.js';

const requireCalidadOrDios = requireRole('CALIDAD', 'DIOS');
const requireDios = requireRole('DIOS');

interface CreateUsuarioBody {
  nombre: string;
  codigo: string;
  rol: string;
  estado?: string;
}

interface UpdateUsuarioBody {
  nombre?: string;
  rol?: string;
  estado?: string;
}

interface CambiarCodigoBody {
  nuevo_codigo: string;
}

interface IdParams {
  id: string;
}

interface ListQueryParams {
  rol?: string;
  estado?: string;
}

// Helper to record event
async function recordEvent(tipo: string, entidadId: string | null, actorId: string, payload: any = {}) {
  await prisma.evento.create({
    data: {
      tipo,
      entidad_tipo: 'USUARIO',
      entidad_id: entidadId || '',
      actor_user_id: actorId,
      payload,
    },
  });
}

export async function usuariosRoutes(fastify: FastifyInstance) {
  // GET /api/usuarios - List all users
  fastify.get<{ Querystring: ListQueryParams }>('/', { preHandler: requireCalidadOrDios }, async (request, reply) => {
    const { rol, estado } = request.query;
    
    const where: any = {};
    if (rol) where.rol_tag = rol;
    if (estado) where.estado = estado;
    
    const usuarios = await prisma.usuario.findMany({
      where,
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        rol_tag: true,
        estado: true,
        created_at: true,
        updated_at: true,
      },
    });
    
    return usuarios.map(u => ({
      id: u.id,
      nombre: u.nombre,
      rol: u.rol_tag,
      estado: u.estado,
      created_at: u.created_at,
      updated_at: u.updated_at,
    }));
  });

  // GET /api/usuarios/:id - Get single user
  fastify.get<{ Params: IdParams }>('/:id', { preHandler: requireCalidadOrDios }, async (request, reply) => {
    const { id } = request.params;
    
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        rol_tag: true,
        estado: true,
        created_at: true,
        updated_at: true,
      },
    });
    
    if (!usuario) {
      return reply.code(404).send({ error: 'Usuario no encontrado' });
    }
    
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol_tag,
      estado: usuario.estado,
      created_at: usuario.created_at,
      updated_at: usuario.updated_at,
    };
  });

  // POST /api/usuarios - Create user
  fastify.post<{ Body: CreateUsuarioBody }>('/', { preHandler: requireCalidadOrDios }, async (request, reply) => {
    const { nombre, codigo, rol, estado = 'ACTIVO' } = request.body;
    
    // Validate input
    const validation = validateCreateUsuario({ nombre, codigo, rol, estado });
    if (!validation.valid) {
      return reply.code(400).send({ error: validation.error });
    }
    
    // Check if code is already in use
    const codigoLookup = createCodeLookup(codigo);
    const existing = await prisma.usuario.findFirst({
      where: { codigo_lookup: codigoLookup },
    });
    
    if (existing) {
      return reply.code(400).send({ error: 'El código ya está en uso' });
    }
    
    // Hash and encrypt code
    const codigoHash = await hashPassword(codigo);
    const { encrypted, iv, tag } = encryptCode(codigo);
    
    // Create user
    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        codigo_lookup: codigoLookup,
        codigo_hash: codigoHash,
        codigo_enc: encrypted,
        codigo_enc_iv: iv,
        codigo_enc_tag: tag,
        rol_tag: rol,
        estado,
      },
      select: {
        id: true,
        nombre: true,
        rol_tag: true,
        estado: true,
        created_at: true,
        updated_at: true,
      },
    });
    
    // Record event
    await recordEvent('USUARIO_CREADO', usuario.id, request.user!.id, { nombre, rol, estado });
    
    return reply.code(201).send({
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol_tag,
      estado: usuario.estado,
      created_at: usuario.created_at,
      updated_at: usuario.updated_at,
    });
  });

  // PUT /api/usuarios/:id - Update user (not code)
  fastify.put<{ Params: IdParams; Body: UpdateUsuarioBody }>('/:id', { preHandler: requireCalidadOrDios }, async (request, reply) => {
    const { id } = request.params;
    const { nombre, rol, estado } = request.body;
    
    // Validate input
    const validation = validateUpdateUsuario({ nombre, rol, estado });
    if (!validation.valid) {
      return reply.code(400).send({ error: validation.error });
    }
    
    // Check user exists
    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: 'Usuario no encontrado' });
    }
    
    // Build update data
    const updateData: any = { updated_at: new Date() };
    if (nombre) updateData.nombre = nombre;
    if (rol) updateData.rol_tag = rol;
    if (estado) updateData.estado = estado;
    
    const usuario = await prisma.usuario.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nombre: true,
        rol_tag: true,
        estado: true,
        created_at: true,
        updated_at: true,
      },
    });
    
    // Record event
    await recordEvent('USUARIO_ACTUALIZADO', id, request.user!.id, { nombre, rol, estado });
    
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol_tag,
      estado: usuario.estado,
      created_at: usuario.created_at,
      updated_at: usuario.updated_at,
    };
  });

  // PUT /api/usuarios/:id/codigo - Change user code
  fastify.put<{ Params: IdParams; Body: CambiarCodigoBody }>('/:id/codigo', { preHandler: requireCalidadOrDios }, async (request, reply) => {
    const { id } = request.params;
    const { nuevo_codigo } = request.body;
    
    // Validate code
    if (!nuevo_codigo || !validateCodigo(nuevo_codigo)) {
      return reply.code(400).send({ error: 'El código debe ser numérico de 4-6 dígitos' });
    }
    
    // Check user exists
    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: 'Usuario no encontrado' });
    }
    
    // Check if new code is already in use by another user
    const codigoLookup = createCodeLookup(nuevo_codigo);
    const codeInUse = await prisma.usuario.findFirst({
      where: {
        codigo_lookup: codigoLookup,
        id: { not: id },
      },
    });
    
    if (codeInUse) {
      return reply.code(400).send({ error: 'El código ya está en uso por otro usuario' });
    }
    
    // Hash and encrypt new code
    const codigoHash = await hashPassword(nuevo_codigo);
    const { encrypted, iv, tag } = encryptCode(nuevo_codigo);
    
    // Update user code
    await prisma.usuario.update({
      where: { id },
      data: {
        codigo_lookup: codigoLookup,
        codigo_hash: codigoHash,
        codigo_enc: encrypted,
        codigo_enc_iv: iv,
        codigo_enc_tag: tag,
        updated_at: new Date(),
      },
    });
    
    // Invalidate all sessions for this user
    const invalidatedCount = await invalidateUserSessions(id);
    
    // Record event
    await recordEvent('USUARIO_CODIGO_CAMBIADO', id, request.user!.id, { sessions_invalidated: invalidatedCount });
    
    return { success: true, message: 'Código actualizado', sessions_invalidated: invalidatedCount };
  });

  // PUT /api/usuarios/:id/baja-temporal - Temporary leave
  fastify.put<{ Params: IdParams }>('/:id/baja-temporal', { preHandler: requireCalidadOrDios }, async (request, reply) => {
    const { id } = request.params;
    
    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: 'Usuario no encontrado' });
    }
    
    const usuario = await prisma.usuario.update({
      where: { id },
      data: {
        estado: 'BAJA_TEMPORAL',
        baja_inicio: new Date(),
        updated_at: new Date(),
      },
      select: {
        id: true,
        nombre: true,
        rol_tag: true,
        estado: true,
        created_at: true,
        updated_at: true,
      },
    });
    
    // Invalidate sessions
    await invalidateUserSessions(id);
    
    // Record event
    await recordEvent('USUARIO_BAJA_TEMPORAL', id, request.user!.id);
    
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol_tag,
      estado: usuario.estado,
      created_at: usuario.created_at,
      updated_at: usuario.updated_at,
    };
  });

  // PUT /api/usuarios/:id/reactivar - Reactivate user
  fastify.put<{ Params: IdParams }>('/:id/reactivar', { preHandler: requireCalidadOrDios }, async (request, reply) => {
    const { id } = request.params;
    
    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: 'Usuario no encontrado' });
    }
    
    const usuario = await prisma.usuario.update({
      where: { id },
      data: {
        estado: 'ACTIVO',
        baja_inicio: null,
        baja_fin: new Date(),
        updated_at: new Date(),
      },
      select: {
        id: true,
        nombre: true,
        rol_tag: true,
        estado: true,
        created_at: true,
        updated_at: true,
      },
    });
    
    // Record event
    await recordEvent('USUARIO_REACTIVADO', id, request.user!.id);
    
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol_tag,
      estado: usuario.estado,
      created_at: usuario.created_at,
      updated_at: usuario.updated_at,
    };
  });

  // PUT /api/usuarios/:id/desactivar - Deactivate user
  fastify.put<{ Params: IdParams }>('/:id/desactivar', { preHandler: requireCalidadOrDios }, async (request, reply) => {
    const { id } = request.params;
    
    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: 'Usuario no encontrado' });
    }
    
    const usuario = await prisma.usuario.update({
      where: { id },
      data: {
        estado: 'INACTIVO',
        updated_at: new Date(),
      },
      select: {
        id: true,
        nombre: true,
        rol_tag: true,
        estado: true,
        created_at: true,
        updated_at: true,
      },
    });
    
    // Invalidate sessions
    await invalidateUserSessions(id);
    
    // Record event
    await recordEvent('USUARIO_DESACTIVADO', id, request.user!.id);
    
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol_tag,
      estado: usuario.estado,
      created_at: usuario.created_at,
      updated_at: usuario.updated_at,
    };
  });

  // DELETE /api/usuarios/:id - Delete user (DIOS only)
  fastify.delete<{ Params: IdParams }>('/:id', { preHandler: requireDios }, async (request, reply) => {
    const { id } = request.params;
    
    // Cannot delete self
    if (id === request.user!.id) {
      return reply.code(400).send({ error: 'No puedes eliminar tu propio usuario' });
    }
    
    const existing = await prisma.usuario.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({ error: 'Usuario no encontrado' });
    }
    
    // Record event before deletion
    await recordEvent('USUARIO_ELIMINADO', id, request.user!.id, { nombre: existing.nombre, rol: existing.rol_tag });
    
    // Invalidate sessions first
    await invalidateUserSessions(id);
    
    // Delete user (cascade will handle related records)
    await prisma.usuario.delete({ where: { id } });
    
    return { success: true, message: 'Usuario eliminado' };
  });
}
