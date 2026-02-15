/**
 * Feature Flags Routes - Dynamic feature toggling
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import { requireAuth, requireDios } from '../middleware/auth.js';
import { registerEvento } from '../lib/event-registry.js';

export async function featureFlagsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/feature-flags - Get all enabled feature flags
   * Permissions: All authenticated roles
   * Returns object with flag keys as keys and true/false as values
   */
  fastify.get('/', {
    preHandler: requireAuth,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const flags = await prisma.featureFlag.findMany({
      select: {
        key: true,
        enabled: true,
      },
    });

    // Return as object for easy access
    const flagsObject: Record<string, boolean> = {};
    for (const flag of flags) {
      flagsObject[flag.key] = flag.enabled;
    }

    return reply.send(flagsObject);
  });

  /**
   * GET /api/feature-flags/all - Get all feature flags with details
   * Permissions: DIOS only
   */
  fastify.get('/all', {
    preHandler: requireDios,
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const flags = await prisma.featureFlag.findMany({
      include: {
        updater: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: { key: 'asc' },
    });

    return reply.send({
      flags: flags.map(f => ({
        id: f.id,
        key: f.key,
        enabled: f.enabled,
        updated_by: f.updated_by,
        updater: f.updater ? {
          id: f.updater.id,
          nombre: f.updater.nombre,
        } : null,
        created_at: f.created_at.toISOString(),
        updated_at: f.updated_at.toISOString(),
      })),
    });
  });

  /**
   * PUT /api/feature-flags/:key - Update a feature flag
   * Permissions: DIOS only
   */
  fastify.put('/:key', {
    preHandler: requireDios,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const { enabled } = request.body as { enabled: boolean };

    // Find existing flag
    const existingFlag = await prisma.featureFlag.findUnique({
      where: { key },
    });

    if (!existingFlag) {
      return reply.code(404).send({
        error: 'FEATURE_FLAG_NOT_FOUND',
        message: `Feature flag '${key}' not found`,
      });
    }

    // Update flag
    const updatedFlag = await prisma.featureFlag.update({
      where: { key },
      data: {
        enabled,
        updated_by: request.user!.id,
      },
    });

    // Register event
    await registerEvento({
      tipo: 'FEATURE_FLAG_UPDATED',
      entidad_tipo: 'FeatureFlag',
      entidad_id: updatedFlag.id,
      actor_user_id: request.user!.id,
      payload: {
        key,
        enabled,
        previous_enabled: existingFlag.enabled,
      },
    });

    return reply.send({
      id: updatedFlag.id,
      key: updatedFlag.key,
      enabled: updatedFlag.enabled,
      updated_at: updatedFlag.updated_at.toISOString(),
    });
  });

  /**
   * POST /api/feature-flags - Create a new feature flag
   * Permissions: DIOS only
   */
  fastify.post('/', {
    preHandler: requireDios,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { key, enabled } = request.body as { key: string; enabled: boolean };

    // Check if key already exists
    const existingFlag = await prisma.featureFlag.findUnique({
      where: { key },
    });

    if (existingFlag) {
      return reply.code(409).send({
        error: 'FEATURE_FLAG_EXISTS',
        message: `Feature flag '${key}' already exists`,
      });
    }

    // Create flag
    const newFlag = await prisma.featureFlag.create({
      data: {
        key,
        enabled,
        updated_by: request.user!.id,
      },
    });

    // Register event
    await registerEvento({
      tipo: 'FEATURE_FLAG_CREATED',
      entidad_tipo: 'FeatureFlag',
      entidad_id: newFlag.id,
      actor_user_id: request.user!.id,
      payload: {
        key,
        enabled,
      },
    });

    return reply.code(201).send({
      id: newFlag.id,
      key: newFlag.key,
      enabled: newFlag.enabled,
      created_at: newFlag.created_at.toISOString(),
    });
  });

  /**
   * DELETE /api/feature-flags/:key - Delete a feature flag
   * Permissions: DIOS only
   */
  fastify.delete('/:key', {
    preHandler: requireDios,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };

    // Find existing flag
    const existingFlag = await prisma.featureFlag.findUnique({
      where: { key },
    });

    if (!existingFlag) {
      return reply.code(404).send({
        error: 'FEATURE_FLAG_NOT_FOUND',
        message: `Feature flag '${key}' not found`,
      });
    }

    // Delete flag
    await prisma.featureFlag.delete({
      where: { key },
    });

    // Register event
    await registerEvento({
      tipo: 'FEATURE_FLAG_DELETED',
      entidad_tipo: 'FeatureFlag',
      entidad_id: existingFlag.id,
      actor_user_id: request.user!.id,
      payload: {
        key,
        previous_enabled: existingFlag.enabled,
      },
    });

    return reply.send({ success: true });
  });
}
