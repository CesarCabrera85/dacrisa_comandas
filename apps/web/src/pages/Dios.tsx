import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LogoutButton from '../components/LogoutButton';
import type { ImapStatus } from '@dacrisa/shared';

// IMAP Monitor Component
function ImapMonitor() {
  const [status, setStatus] = useState<ImapStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forcing, setForcing] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/imap/status', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener estado IMAP');
      }
      
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Auto-refresh cada 5 segundos
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleForcePoll = async () => {
    setForcing(true);
    try {
      const response = await fetch('/api/imap/force-poll', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Error al forzar polling');
      }
      
      // Refresh status after force poll
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al forzar polling');
    } finally {
      setForcing(false);
    }
  };

  const handleRestart = async () => {
    if (!confirm('¿Estás seguro de reiniciar el worker IMAP?')) {
      return;
    }
    
    setRestarting(true);
    try {
      const response = await fetch('/api/imap/restart', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Error al reiniciar worker');
      }
      
      // Refresh status after restart
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reiniciar worker');
    } finally {
      setRestarting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleString('es-ES');
  };

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">📧 Monitor IMAP</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur rounded-xl p-6">
      <h3 className="text-xl font-semibold text-white mb-4">📧 Monitor IMAP</h3>
      
      {error && (
        <div className="bg-red-500/20 border border-red-400 rounded-lg p-3 mb-4 text-red-200">
          ⚠️ {error}
        </div>
      )}

      {status && (
        <>
          {/* Status Indicators */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-black/20 rounded-lg p-4">
              <div className="text-sm text-red-200 mb-1">Estado Worker</div>
              <div className="flex items-center gap-2">
                <span className={`inline-block w-3 h-3 rounded-full ${status.isRunning ? 'bg-green-400' : 'bg-red-400'}`}></span>
                <span className="text-white font-medium">
                  {status.isRunning ? '▶️ Corriendo' : '⏸️ Detenido'}
                </span>
              </div>
            </div>
            
            <div className="bg-black/20 rounded-lg p-4">
              <div className="text-sm text-red-200 mb-1">Conexión IMAP</div>
              <div className="flex items-center gap-2">
                <span className={`inline-block w-3 h-3 rounded-full ${status.isConnected ? 'bg-green-400' : 'bg-red-400'}`}></span>
                <span className="text-white font-medium">
                  {status.isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
                </span>
              </div>
            </div>
          </div>

          {/* Cursor Information */}
          <div className="bg-black/20 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-medium text-red-200 mb-3">📈 Cursor IMAP</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-red-300">Último UID:</span>
                <span className="text-white ml-2 font-mono">{status.cursor.lastUid}</span>
              </div>
              <div>
                <span className="text-red-300">UIDValidity:</span>
                <span className="text-white ml-2 font-mono">{status.cursor.uidValidity || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Last Poll */}
          <div className="bg-black/20 rounded-lg p-4 mb-4">
            <div className="text-sm text-red-200 mb-1">Último Polling</div>
            <div className="text-white font-medium">
              {formatDate(status.lastPollTime)}
            </div>
          </div>

          {/* Last Error */}
          {status.lastError && (
            <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-4 mb-4">
              <div className="text-sm text-red-200 mb-1">⚠️ Último Error</div>
              <div className="text-red-100 text-sm font-mono break-all">
                {status.lastError}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleForcePoll}
              disabled={forcing || !status.isRunning}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {forcing ? '⏳ Ejecutando...' : '🔄 Forzar Polling'}
            </button>
            
            <button
              onClick={handleRestart}
              disabled={restarting}
              className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {restarting ? '⏳ Reiniciando...' : '🔄 Reiniciar Worker'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Dios() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 to-red-700 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Vista Administrador (DIOS)</h1>
            <p className="text-red-200">Bienvenido, {user?.nombre}</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/usuarios')}
              className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2"
            >
              👥 Gestión de Usuarios
            </button>
            <button
              onClick={() => navigate('/calidad')}
              className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2"
            >
              🔧 Panel Calidad
            </button>
            <LogoutButton />
          </div>
        </div>

        <div className="space-y-6">
          {/* Welcome Card */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8 text-center">
            <div className="text-6xl mb-4">👑</div>
            <h2 className="text-2xl font-semibold text-white mb-2">Panel de Administrador</h2>
            <p className="text-red-200">Acceso completo a todas las funciones del sistema.</p>
          </div>

          {/* IMAP Monitor */}
          <ImapMonitor />
        </div>
      </div>
    </div>
  );
}

export default Dios;
