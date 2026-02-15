/**
 * EventBus - Singleton for SSE event broadcasting
 * Enables real-time event streaming to connected clients
 */

import { EventEmitter } from 'events';

export interface SSEEvent {
  id: string;
  ts: Date;
  actor_user_id: string | null;
  tipo: string;
  entidad_tipo: string;
  entidad_id: string;
  payload: object;
}

class EventBus extends EventEmitter {
  private static instance: EventBus;
  
  private constructor() {
    super();
    this.setMaxListeners(100); // Allow many SSE connections
  }
  
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
  
  emitSSEEvent(event: SSEEvent) {
    this.emit('new-event', event);
  }
}

export const eventBus = EventBus.getInstance();
