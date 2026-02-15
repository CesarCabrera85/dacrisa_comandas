/**
 * Pantalla Techo - Real-time monitoring dashboard
 * Fullscreen display for production floor monitoring
 */

import { useEffect, useState, useCallback } from 'react';
import { useSSE, SSEEvent } from '../hooks/useSSE';
import './Techo.css';

interface RutaResumen {
  ruta_id: string;
  ruta_nombre: string;
  estado_visual: 'AZUL' | 'VERDE' | 'ROJO';
  estado_logico: string;
  pendiente_imprimible: number;
  total_clientes: number;
  total_lineas: number;
  lotes_count: number;
}

interface Turno {
  id: string;
  fecha: string;
  franja: string;
  estado: string;
  started_at: string | null;
}

// Event types that trigger data refresh
const REFRESH_EVENTS = [
  'LOTE_PROCESADO',
  'IMPRESION_REALIZADA',
  'RUTA_ALERTA_ROJA',
  'RUTA_COMPLETA_VERDE',
  'RUTA_RECOLECTADA',
  'TURNO_INICIADO',
  'TURNO_CERRADO',
  'LOTE_CARRYOVER',
];

function RutaCard({ ruta }: { ruta: RutaResumen }) {
  const estadoColorClass: Record<string, string> = {
    AZUL: 'ruta-card--azul',
    VERDE: 'ruta-card--verde',
    ROJO: 'ruta-card--rojo',
  };

  return (
    <div className={`ruta-card ${estadoColorClass[ruta.estado_visual] || 'ruta-card--azul'}`}>
      <h2 className="ruta-card__nombre">{ruta.ruta_nombre}</h2>
      <div className="ruta-card__estado-badge">{ruta.estado_visual}</div>
      <div className="ruta-card__stats">
        <div className="stat">
          <span className="stat__label">Pendientes</span>
          <span className="stat__value">{ruta.pendiente_imprimible}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Clientes</span>
          <span className="stat__value">{ruta.total_clientes}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Líneas</span>
          <span className="stat__value">{ruta.total_lineas}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Lotes</span>
          <span className="stat__value">{ruta.lotes_count}</span>
        </div>
      </div>
      {ruta.estado_logico === 'RECOLECTADA' && (
        <div className="ruta-card__recolectada">✓ RECOLECTADA</div>
      )}
    </div>
  );
}

function EventoItem({ evento }: { evento: SSEEvent }) {
  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getEventIcon = (tipo: string) => {
    const icons: Record<string, string> = {
      LOTE_PROCESADO: '📦',
      IMPRESION_REALIZADA: '🖨️',
      RUTA_ALERTA_ROJA: '🔴',
      RUTA_COMPLETA_VERDE: '🟢',
      RUTA_RECOLECTADA: '✅',
      TURNO_INICIADO: '▶️',
      TURNO_CERRADO: '⏹️',
      LOTE_CARRYOVER: '🔄',
      PRODUCTO_NO_ENCONTRADO: '❓',
      ERROR_PARSE_RUTA: '⚠️',
      ERROR_PARSE_BODY: '⚠️',
    };
    return icons[tipo] || '📋';
  };

  return (
    <div className="evento-item">
      <span className="evento-item__icon">{getEventIcon(evento.tipo)}</span>
      <div className="evento-item__content">
        <span className="evento-item__tipo">{evento.tipo}</span>
        <span className="evento-item__time">{formatTime(evento.ts)}</span>
      </div>
    </div>
  );
}

function Techo() {
  const { events, connected } = useSSE('/api/eventos/stream');
  const [rutas, setRutas] = useState<RutaResumen[]>([]);
  const [turnoActivo, setTurnoActivo] = useState<Turno | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchTurnoActivo = useCallback(async () => {
    try {
      const response = await fetch('/api/turnos/activo', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setTurnoActivo(data.turno);
      } else {
        setTurnoActivo(null);
      }
    } catch (error) {
      console.error('Error fetching turno activo:', error);
    }
  }, []);

  const fetchRutas = useCallback(async () => {
    try {
      const response = await fetch('/api/rutas', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setRutas(data);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Error fetching rutas:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTurnoActivo();
    fetchRutas();
  }, [fetchTurnoActivo, fetchRutas]);

  // Auto refresh every 60 seconds as fallback
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRutas();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchRutas]);

  // React to SSE events
  useEffect(() => {
    if (events.length > 0) {
      const lastEvent = events[events.length - 1];
      
      // Check if this event type should trigger a refresh
      if (REFRESH_EVENTS.includes(lastEvent.tipo)) {
        fetchRutas();
        
        // Also refresh turno on turno events
        if (lastEvent.tipo === 'TURNO_INICIADO' || lastEvent.tipo === 'TURNO_CERRADO') {
          fetchTurnoActivo();
        }
      }
    }
  }, [events, fetchRutas, fetchTurnoActivo]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  // Sort rutas: ROJO first, then AZUL, then VERDE
  const sortedRutas = [...rutas].sort((a, b) => {
    const order: Record<string, number> = { ROJO: 0, AZUL: 1, VERDE: 2 };
    return (order[a.estado_visual] ?? 3) - (order[b.estado_visual] ?? 3);
  });

  // Calculate summary stats
  const totalPendientes = rutas.reduce((sum, r) => sum + r.pendiente_imprimible, 0);
  const totalLineas = rutas.reduce((sum, r) => sum + r.total_lineas, 0);
  const rutasRojas = rutas.filter(r => r.estado_visual === 'ROJO').length;
  const rutasVerdes = rutas.filter(r => r.estado_visual === 'VERDE').length;

  return (
    <div className="techo-container">
      {/* Header */}
      <header className="techo-header">
        <div className="techo-header__title">
          <h1>DACRISA COMANDAS</h1>
          <span className="techo-header__subtitle">PANTALLA TECHO</span>
        </div>
        
        <div className="techo-header__status">
          <span className={`connection-status ${connected ? 'connection-status--connected' : 'connection-status--disconnected'}`}>
            {connected ? '🟢 Conectado' : '🔴 Desconectado'}
          </span>
          
          {turnoActivo ? (
            <div className="turno-info">
              <span className="turno-info__label">Turno:</span>
              <span className="turno-info__franja">{turnoActivo.franja}</span>
              <span className="turno-info__fecha">{formatDate(turnoActivo.fecha)}</span>
            </div>
          ) : (
            <span className="no-turno">Sin turno activo</span>
          )}
        </div>
      </header>

      {/* Summary Bar */}
      <div className="techo-summary">
        <div className="summary-stat">
          <span className="summary-stat__value">{rutas.length}</span>
          <span className="summary-stat__label">Rutas</span>
        </div>
        <div className="summary-stat summary-stat--warning">
          <span className="summary-stat__value">{totalPendientes}</span>
          <span className="summary-stat__label">Pendientes</span>
        </div>
        <div className="summary-stat">
          <span className="summary-stat__value">{totalLineas}</span>
          <span className="summary-stat__label">Líneas Total</span>
        </div>
        <div className="summary-stat summary-stat--danger">
          <span className="summary-stat__value">{rutasRojas}</span>
          <span className="summary-stat__label">Rutas Rojas</span>
        </div>
        <div className="summary-stat summary-stat--success">
          <span className="summary-stat__value">{rutasVerdes}</span>
          <span className="summary-stat__label">Rutas Verdes</span>
        </div>
        <div className="summary-stat summary-stat--muted">
          <span className="summary-stat__value">
            {lastRefresh.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="summary-stat__label">Última Act.</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="techo-main">
        {/* Routes Grid */}
        <div className="rutas-grid">
          {loading ? (
            <div className="loading-message">Cargando rutas...</div>
          ) : sortedRutas.length === 0 ? (
            <div className="empty-message">
              <span className="empty-message__icon">📭</span>
              <span>No hay rutas activas</span>
            </div>
          ) : (
            sortedRutas.map(ruta => (
              <RutaCard key={ruta.ruta_id} ruta={ruta} />
            ))
          )}
        </div>

        {/* Events Sidebar */}
        <aside className="eventos-sidebar">
          <h3 className="eventos-sidebar__title">
            Eventos Recientes
            <span className="eventos-sidebar__count">({events.length})</span>
          </h3>
          <div className="eventos-list">
            {events.length === 0 ? (
              <div className="eventos-list__empty">Esperando eventos...</div>
            ) : (
              events.slice(-15).reverse().map(evento => (
                <EventoItem key={evento.id} evento={evento} />
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Techo;
