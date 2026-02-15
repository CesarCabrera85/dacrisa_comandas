/**
 * useSSE - React hook for Server-Sent Events
 * Handles connection, reconnection, and event management
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export interface SSEEvent {
  id: string;
  ts: string;
  actor_user_id: string | null;
  tipo: string;
  entidad_tipo: string;
  entidad_id: string;
  payload: Record<string, unknown>;
}

interface UseSSEOptions {
  maxEvents?: number;  // Maximum events to keep in memory
  reconnectDelay?: number;  // Delay before reconnecting (ms)
}

interface UseSSEReturn {
  events: SSEEvent[];
  connected: boolean;
  lastEventId: string | null;
  clearEvents: () => void;
}

export function useSSE(url: string, options: UseSSEOptions = {}): UseSSEReturn {
  const { maxEvents = 100, reconnectDelay = 3000 } = options;
  
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    let isActive = true;

    const connect = () => {
      if (!isActive) return;

      // Build URL with lastEventId if available
      const urlWithId = lastEventId
        ? `${url}${url.includes('?') ? '&' : '?'}lastEventId=${encodeURIComponent(lastEventId)}`
        : url;

      const eventSource = new EventSource(urlWithId, {
        withCredentials: true,
      });
      
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (isActive) {
          setConnected(true);
          console.log('[SSE] Connected');
        }
      };

      eventSource.addEventListener('evento', (e: MessageEvent) => {
        if (!isActive) return;
        
        try {
          const evento: SSEEvent = JSON.parse(e.data);
          
          setEvents(prev => {
            // Avoid duplicates
            if (prev.some(ev => ev.id === evento.id)) {
              return prev;
            }
            
            // Add new event and trim if needed
            const updated = [...prev, evento];
            if (updated.length > maxEvents) {
              return updated.slice(-maxEvents);
            }
            return updated;
          });
          
          // Update lastEventId using the event timestamp
          setLastEventId(evento.ts);
        } catch (error) {
          console.error('[SSE] Error parsing event:', error);
        }
      });

      eventSource.onerror = () => {
        if (!isActive) return;
        
        console.log('[SSE] Connection error, reconnecting...');
        setConnected(false);
        eventSource.close();
        eventSourceRef.current = null;
        
        // Reconnect after delay
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isActive) {
            connect();
          }
        }, reconnectDelay);
      };
    };

    connect();

    // Cleanup
    return () => {
      isActive = false;
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [url, maxEvents, reconnectDelay]); // Don't include lastEventId to avoid reconnection loops

  return { events, connected, lastEventId, clearEvents };
}

export default useSSE;
