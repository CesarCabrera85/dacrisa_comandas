import { prisma } from './prisma.js';
import type { FranjaTurno } from '@dacrisa/shared';

export class TurnoRulesError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'TurnoRulesError';
  }
}

/**
 * Verifica que no exista un turno ACTIVO
 * Lanza error 409 si existe
 */
export async function validateSingleActiveTurno(): Promise<void> {
  const activeTurno = await prisma.turno.findFirst({
    where: { estado: 'ACTIVO' },
  });

  if (activeTurno) {
    throw new TurnoRulesError(
      'TURNO_YA_ACTIVO',
      'Ya existe un turno activo. Cierra el turno actual antes de iniciar uno nuevo.',
      409
    );
  }
}

/**
 * Verifica que el horario existe y está activo
 * Lanza error 404 si no existe o está inactivo
 */
export async function validateHorarioActivo(franja: FranjaTurno): Promise<{ id: string; start_time: Date; end_time: Date }> {
  const horario = await prisma.turnoHorario.findFirst({
    where: { franja, activo: true },
  });

  if (!horario) {
    throw new TurnoRulesError(
      'HORARIO_NO_ENCONTRADO',
      `No existe un horario activo para la franja ${franja}`,
      404
    );
  }

  return horario;
}

/**
 * Verifica que no existe turno para la misma fecha y franja
 * Lanza error 409 si existe
 */
export async function validateTurnoDuplicado(fecha: Date, franja: FranjaTurno): Promise<void> {
  const existingTurno = await prisma.turno.findFirst({
    where: {
      fecha,
      franja,
    },
  });

  if (existingTurno) {
    throw new TurnoRulesError(
      'TURNO_DUPLICADO',
      `Ya existe un turno para la fecha ${fecha.toISOString().split('T')[0]} y franja ${franja}`,
      409
    );
  }
}

/**
 * Calcula ended_at basado en fecha + horario.end_time
 */
export function calculateTurnoEndTime(fecha: Date, endTime: Date): Date {
  const result = new Date(fecha);
  result.setHours(endTime.getHours(), endTime.getMinutes(), endTime.getSeconds(), 0);
  
  // Si el end_time es antes del start_time (ej: turno noche que termina al día siguiente)
  // entonces sumamos un día
  return result;
}

/**
 * Valida que el turno existe y está en estado ACTIVO o CREADO
 */
export async function validateTurnoParaConfiguracion(turnoId: string): Promise<{ id: string; estado: string }> {
  const turno = await prisma.turno.findUnique({
    where: { id: turnoId },
  });

  if (!turno) {
    throw new TurnoRulesError(
      'TURNO_NO_ENCONTRADO',
      'El turno especificado no existe',
      404
    );
  }

  if (turno.estado !== 'ACTIVO' && turno.estado !== 'CREADO') {
    throw new TurnoRulesError(
      'TURNO_NO_ACTIVO',
      'Solo se puede configurar un turno en estado ACTIVO o CREADO',
      400
    );
  }

  return turno;
}

/**
 * Valida que el turno existe y está en estado ACTIVO (para cerrar)
 */
export async function validateTurnoParaCerrar(turnoId: string): Promise<{ id: string }> {
  const turno = await prisma.turno.findUnique({
    where: { id: turnoId },
  });

  if (!turno) {
    throw new TurnoRulesError(
      'TURNO_NO_ENCONTRADO',
      'El turno especificado no existe',
      404
    );
  }

  if (turno.estado !== 'ACTIVO') {
    throw new TurnoRulesError(
      'TURNO_NO_ACTIVO',
      'Solo se puede cerrar un turno en estado ACTIVO',
      400
    );
  }

  return turno;
}

/**
 * Verifica si un horario está en uso por turnos activos
 */
export async function validateHorarioNoEnUso(franja: string): Promise<void> {
  const turnosActivos = await prisma.turno.count({
    where: {
      franja,
      estado: 'ACTIVO',
    },
  });

  if (turnosActivos > 0) {
    throw new TurnoRulesError(
      'HORARIO_EN_USO',
      'No se puede desactivar el horario porque hay turnos activos usándolo',
      409
    );
  }
}
