import { prisma } from '../lib/prisma.js';

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Función que cierra automáticamente los turnos cuando llega su hora de fin
 */
export async function autoCloseTurno(): Promise<void> {
  try {
    // Buscar turno activo
    const turnoActivo = await prisma.turno.findFirst({
      where: { estado: 'ACTIVO' },
    });

    if (!turnoActivo) {
      return; // No hay turno activo
    }

    // Verificar si es hora de cerrar
    const now = new Date();
    
    if (turnoActivo.ended_at && now >= turnoActivo.ended_at) {
      console.log(`[Scheduler] Cerrando turno ${turnoActivo.id} automáticamente (ended_at: ${turnoActivo.ended_at.toISOString()})`);

      // Cerrar turno
      await prisma.turno.update({
        where: { id: turnoActivo.id },
        data: {
          estado: 'CERRADO',
          ended_at: now,
        },
      });

      // Registrar evento
      await prisma.evento.create({
        data: {
          tipo: 'TURNO_CERRADO_AUTO',
          entidad_tipo: 'TURNO',
          entidad_id: turnoActivo.id,
          actor_user_id: null,
          payload: {
            cerrado_automaticamente: true,
            hora_programada: turnoActivo.ended_at.toISOString(),
            hora_real: now.toISOString(),
          },
        },
      });

      console.log(`[Scheduler] Turno ${turnoActivo.id} cerrado automáticamente`);
    }
  } catch (error) {
    console.error('[Scheduler] Error en autoCloseTurno:', error);
  }
}

/**
 * Inicia el scheduler de cierre automático de turnos
 */
export function startTurnoScheduler(): void {
  if (schedulerInterval) {
    console.warn('[Scheduler] El scheduler ya está corriendo');
    return;
  }

  console.log('[Scheduler] Iniciando scheduler de cierre automático de turnos (cada 30s)');
  
  // Ejecutar inmediatamente una vez
  autoCloseTurno();
  
  // Configurar intervalo de 30 segundos
  schedulerInterval = setInterval(autoCloseTurno, 30000);
}

/**
 * Detiene el scheduler de cierre automático de turnos
 */
export function stopTurnoScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Scheduler de cierre automático detenido');
  }
}
