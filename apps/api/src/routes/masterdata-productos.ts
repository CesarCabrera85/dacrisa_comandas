/**
 * Masterdata Productos API Routes
 * Handles XLSX upload, validation, versioning, activation and rollback
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { requireRole } from '../middleware/auth.js';
import { parseProductosXLSX } from '../lib/xlsx-parser.js';
import { validateProductos } from '../lib/masterdata-validation.js';
import crypto from 'crypto';

const requireCalidadOrDios = requireRole('CALIDAD', 'DIOS');

export async function masterdataProductosRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/masterdata/productos/upload
   * Upload and validate a new productos master XLSX file
   */
  fastify.post('/upload', {
    preHandler: requireCalidadOrDios,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();
    
    if (!data) {
      return reply.status(400).send({
        code: 'NO_FILE',
        message: 'No se proporcionó archivo',
      });
    }
    
    const buffer = await data.toBuffer();
    const fileName = data.filename || 'productos.xlsx';
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    
    // Parse XLSX
    const parseResult = await parseProductosXLSX(Buffer.from(buffer));
    
    // Check for parsing errors
    if (parseResult.errores.length > 0 && parseResult.productos.length === 0) {
      return reply.status(400).send({
        code: 'PARSE_ERROR',
        message: parseResult.errores[0].mensaje,
        errores: parseResult.errores,
      });
    }
    
    // Validate products
    const validationResult = validateProductos(parseResult.productos);
    
    // Map validation status to DB enum (OK or BLOQUEADO - WARNING maps to OK for activation purposes)
    const dbValidationStatus: string = validationResult.status === 'BLOQUEADO' ? 'BLOQUEADO' : 'OK';
    
    // Generate version label (timestamp-based)
    const versionLabel = `v${Date.now()}`;
    
    // Create version record
    const version = await prisma.productosMasterVersion.create({
      data: {
        version_label: versionLabel,
        archivo_nombre: fileName,
        archivo_hash: fileHash,
        activo: false,
        validacion_estado: dbValidationStatus,
        validacion_resumen: {
          status: validationResult.status,
          errores: validationResult.errores as unknown as object[],
          productos_count: parseResult.productos.length,
          warnings_count: validationResult.errores.filter(e => e.tipo === 'WARNING').length,
          errors_count: validationResult.errores.filter(e => e.tipo === 'ERROR').length,
        },
      },
    });
    
    // Insert products (only those with valid familia)
    const validProducts = parseResult.productos.filter(p => p.familia_id !== null);
    
    if (validProducts.length > 0) {
      await prisma.productosMaster.createMany({
        data: validProducts.map(p => ({
          version_id: version.id,
          producto_raw: p.producto_original,
          producto_norm: p.producto_norm,
          familia: p.familia_id!,
        })),
      });
    }
    
    // Register event
    await prisma.evento.create({
      data: {
        tipo: 'PRODUCTOS_UPLOADED',
        entidad_tipo: 'productos_master_version',
        entidad_id: version.id,
        actor_user_id: request.user?.id,
        payload: {
          version_label: versionLabel,
          archivo_nombre: fileName,
          productos_count: validProducts.length,
          validation_status: validationResult.status,
        },
      },
    });
    
    return reply.status(201).send({
      version_id: version.id,
      version_label: version.version_label,
      validation_status: validationResult.status,
      validation_errors: validationResult.errores,
      productos_count: validProducts.length,
    });
  });
  
  /**
   * POST /api/masterdata/productos/:version_id/activate
   * Activate a productos master version
   */
  fastify.post<{ Params: { version_id: string } }>('/:version_id/activate', {
    preHandler: requireCalidadOrDios,
  }, async (request, reply) => {
    const { version_id } = request.params;
    
    // Get version
    const version = await prisma.productosMasterVersion.findUnique({
      where: { id: version_id },
    });
    
    if (!version) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'Versión no encontrada',
      });
    }
    
    if (version.activo) {
      return reply.status(409).send({
        code: 'ALREADY_ACTIVE',
        message: 'Esta versión ya está activa',
      });
    }
    
    if (version.validacion_estado === 'BLOQUEADO') {
      return reply.status(409).send({
        code: 'VALIDACION_BLOQUEADA',
        message: 'No se puede activar una versión con errores bloqueantes',
        validation_errors: (version.validacion_resumen as any)?.errores || [],
      });
    }
    
    // Deactivate current active version
    await prisma.productosMasterVersion.updateMany({
      where: { activo: true },
      data: { activo: false },
    });
    
    // Activate new version
    const activated = await prisma.productosMasterVersion.update({
      where: { id: version_id },
      data: {
        activo: true,
        activated_at: new Date(),
        activated_by: request.user?.id,
      },
    });
    
    // Register event
    await prisma.evento.create({
      data: {
        tipo: 'PRODUCTOS_ACTIVATED',
        entidad_tipo: 'productos_master_version',
        entidad_id: version_id,
        actor_user_id: request.user?.id,
        payload: { version_label: activated.version_label },
      },
    });
    
    return reply.send({
      success: true,
      version: {
        id: activated.id,
        version_label: activated.version_label,
        activo: activated.activo,
        activated_at: activated.activated_at,
      },
    });
  });
  
  /**
   * POST /api/masterdata/productos/:version_id/rollback
   * Rollback to a previous productos master version
   */
  fastify.post<{ Params: { version_id: string } }>('/:version_id/rollback', {
    preHandler: requireCalidadOrDios,
  }, async (request, reply) => {
    const { version_id } = request.params;
    
    // Get version
    const version = await prisma.productosMasterVersion.findUnique({
      where: { id: version_id },
    });
    
    if (!version) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'Versión no encontrada',
      });
    }
    
    if (version.activo) {
      return reply.status(409).send({
        code: 'ALREADY_ACTIVE',
        message: 'Esta versión ya está activa',
      });
    }
    
    if (version.validacion_estado === 'BLOQUEADO') {
      return reply.status(409).send({
        code: 'VALIDACION_BLOQUEADA',
        message: 'No se puede hacer rollback a una versión con errores bloqueantes',
      });
    }
    
    // Deactivate current active version
    await prisma.productosMasterVersion.updateMany({
      where: { activo: true },
      data: { activo: false },
    });
    
    // Activate rollback version
    const activated = await prisma.productosMasterVersion.update({
      where: { id: version_id },
      data: {
        activo: true,
        activated_at: new Date(),
        activated_by: request.user?.id,
      },
    });
    
    // Register event
    await prisma.evento.create({
      data: {
        tipo: 'PRODUCTOS_ROLLBACK',
        entidad_tipo: 'productos_master_version',
        entidad_id: version_id,
        actor_user_id: request.user?.id,
        payload: { version_label: activated.version_label },
      },
    });
    
    return reply.send({
      success: true,
      version: {
        id: activated.id,
        version_label: activated.version_label,
        activo: activated.activo,
        activated_at: activated.activated_at,
      },
    });
  });
  
  /**
   * GET /api/masterdata/productos/versions
   * Get all productos master versions
   */
  fastify.get('/versions', {
    preHandler: requireCalidadOrDios,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const versions = await prisma.productosMasterVersion.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: { productos: true },
        },
      },
    });
    
    return reply.send(versions.map(v => ({
      id: v.id,
      version_label: v.version_label,
      archivo_nombre: v.archivo_nombre,
      activo: v.activo,
      validacion_estado: v.validacion_estado,
      productos_count: v._count.productos,
      activated_at: v.activated_at,
      created_at: v.created_at,
    })));
  });
  
  /**
   * GET /api/masterdata/productos/versions/:version_id
   * Get a specific productos master version with details
   */
  fastify.get<{ 
    Params: { version_id: string };
    Querystring: { page?: string; limit?: string };
  }>('/versions/:version_id', {
    preHandler: requireCalidadOrDios,
  }, async (request, reply) => {
    const { version_id } = request.params;
    const page = parseInt(request.query.page || '1', 10);
    const limit = Math.min(parseInt(request.query.limit || '100', 10), 100);
    const skip = (page - 1) * limit;
    
    const version = await prisma.productosMasterVersion.findUnique({
      where: { id: version_id },
      include: {
        _count: {
          select: { productos: true },
        },
      },
    });
    
    if (!version) {
      return reply.status(404).send({
        code: 'NOT_FOUND',
        message: 'Versión no encontrada',
      });
    }
    
    const productos = await prisma.productosMaster.findMany({
      where: { version_id },
      skip,
      take: limit,
      orderBy: { producto_norm: 'asc' },
    });
    
    return reply.send({
      version: {
        id: version.id,
        version_label: version.version_label,
        archivo_nombre: version.archivo_nombre,
        activo: version.activo,
        validacion_estado: version.validacion_estado,
        validacion_resumen: version.validacion_resumen,
        productos_count: version._count.productos,
        activated_at: version.activated_at,
        created_at: version.created_at,
      },
      productos,
      pagination: {
        page,
        limit,
        total: version._count.productos,
        totalPages: Math.ceil(version._count.productos / limit),
      },
    });
  });
  
  /**
   * GET /api/masterdata/productos/active
   * Get the currently active productos master version
   */
  fastify.get('/active', {
    preHandler: requireRole('OPERARIO', 'COLECTA', 'JEFE', 'CALIDAD', 'DIOS', 'PANTALLA_TECHO'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const version = await prisma.productosMasterVersion.findFirst({
      where: { activo: true },
      include: {
        _count: {
          select: { productos: true },
        },
      },
    });
    
    if (!version) {
      return reply.status(404).send({
        code: 'NO_ACTIVE_VERSION',
        message: 'No hay versión activa de productos',
      });
    }
    
    const productos = await prisma.productosMaster.findMany({
      where: { version_id: version.id },
      orderBy: { producto_norm: 'asc' },
    });
    
    return reply.send({
      version: {
        id: version.id,
        version_label: version.version_label,
        activo: version.activo,
        productos_count: version._count.productos,
      },
      productos,
    });
  });
}
