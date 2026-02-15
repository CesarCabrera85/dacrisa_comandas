import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import LogoutButton from '../components/LogoutButton';
import type { FranjaTurno, TurnoHorario, TurnoCompleto, Usuario } from '@dacrisa/shared';

const FRANJAS: FranjaTurno[] = ['MANANA', 'TARDE', 'NOCHE'];

// Obtener fecha actual en formato YYYY-MM-DD
const getTodayDate = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

interface CodigoFuncional {
  codigo_funcional: number;
  nombre: string;
}

// Códigos funcionales por defecto (1-6)
const CODIGOS_FUNCIONALES: CodigoFuncional[] = [
  { codigo_funcional: 1, nombre: 'Código 1' },
  { codigo_funcional: 2, nombre: 'Código 2' },
  { codigo_funcional: 3, nombre: 'Código 3' },
  { codigo_funcional: 4, nombre: 'Código 4' },
  { codigo_funcional: 5, nombre: 'Código 5' },
  { codigo_funcional: 6, nombre: 'Código 6' },
];

function IniciarTurnoForm({
  horarios,
  onTurnoIniciado,
}: {
  horarios: TurnoHorario[];
  onTurnoIniciado: () => void;
}) {
  const [franja, setFranja] = useState<FranjaTurno>('MANANA');
  const [fecha, setFecha] = useState(getTodayDate());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/turnos/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ franja, fecha }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.code === 'TURNO_YA_ACTIVO') {
          setError('Ya existe un turno activo');
        } else if (err.code === 'TURNO_DUPLICADO') {
          setError('Ya existe un turno para esta fecha y horario');
        } else {
          setError(err.message || 'Error al iniciar turno');
        }
        return;
      }

      onTurnoIniciado();
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const horariosActivos = horarios.filter((h) => h.activo);

  return (
    <div className="bg-white/10 backdrop-blur rounded-2xl p-8">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">⏰</div>
        <h2 className="text-2xl font-semibold text-white mb-2">No hay turno activo</h2>
        <p className="text-purple-200">Inicia un nuevo turno para comenzar las operaciones</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-md mx-auto">
        <div className="mb-4">
          <label className="block text-purple-200 text-sm font-medium mb-2">
            Franja Horaria
          </label>
          <select
            value={franja}
            onChange={(e) => setFranja(e.target.value as FranjaTurno)}
            className="w-full bg-white/20 border border-purple-400/50 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-400"
          >
            {horariosActivos.length > 0 ? (
              horariosActivos.map((h) => (
                <option key={h.franja} value={h.franja} className="text-gray-900">
                  {h.franja} ({h.start_time.substring(0, 5)} - {h.end_time.substring(0, 5)})
                </option>
              ))
            ) : (
              FRANJAS.map((f) => (
                <option key={f} value={f} className="text-gray-900">{f}</option>
              ))
            )}
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-purple-200 text-sm font-medium mb-2">
            Fecha
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full bg-white/20 border border-purple-400/50 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-400"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-purple-400 text-white font-bold py-4 px-6 rounded-lg transition-colors text-lg"
        >
          {loading ? 'Iniciando...' : '🚀 INICIAR TURNO'}
        </button>
      </form>
    </div>
  );
}

function HabilidadesSection({
  turno,
  operarios,
  onSave,
}: {
  turno: TurnoCompleto;
  operarios: Usuario[];
  onSave: () => void;
}) {
  const [habilidades, setHabilidades] = useState<Record<string, number[]>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Inicializar habilidades desde el turno
    const initialHab: Record<string, number[]> = {};
    operarios.forEach((op) => {
      initialHab[op.id] = [];
    });
    
    turno.habilidades?.forEach((h) => {
      if (!initialHab[h.usuario_id]) {
        initialHab[h.usuario_id] = [];
      }
      if (h.habilitada && !initialHab[h.usuario_id].includes(h.codigo_funcional)) {
        initialHab[h.usuario_id].push(h.codigo_funcional);
      }
    });
    
    setHabilidades(initialHab);
  }, [turno, operarios]);

  const toggleHabilidad = (usuarioId: string, codigoFuncional: number) => {
    setHabilidades((prev) => {
      const userHab = prev[usuarioId] || [];
      if (userHab.includes(codigoFuncional)) {
        return { ...prev, [usuarioId]: userHab.filter((c) => c !== codigoFuncional) };
      } else {
        return { ...prev, [usuarioId]: [...userHab, codigoFuncional] };
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        habilidades: Object.entries(habilidades)
          .filter(([_, codigos]) => codigos.length > 0)
          .map(([usuario_id, codigo_funcional_ids]) => ({
            usuario_id,
            codigo_funcional_ids,
          })),
      };

      const res = await fetch(`/api/turnos/${turno.id}/habilidades`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al guardar');
      }

      setSuccess('Habilidades guardadas correctamente');
      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur rounded-xl p-6 mb-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        📋 Configuración de Habilidades
      </h3>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded mb-4 text-sm">
          {success}
        </div>
      )}

      {operarios.length === 0 ? (
        <p className="text-purple-200">No hay operarios disponibles</p>
      ) : (
        <div className="space-y-4">
          {operarios.map((operario) => (
            <div key={operario.id} className="border-b border-purple-500/30 pb-4">
              <div className="text-white font-medium mb-2">{operario.nombre}</div>
              <div className="flex flex-wrap gap-2">
                {CODIGOS_FUNCIONALES.map((cf) => (
                  <button
                    key={cf.codigo_funcional}
                    onClick={() => toggleHabilidad(operario.id, cf.codigo_funcional)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      (habilidades[operario.id] || []).includes(cf.codigo_funcional)
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/20 text-purple-200 hover:bg-white/30'
                    }`}
                  >
                    {cf.nombre}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg"
      >
        {saving ? 'Guardando...' : '💾 Guardar Habilidades'}
      </button>
    </div>
  );
}

function ColectaSection({
  turno,
  colectores,
  onSave,
}: {
  turno: TurnoCompleto;
  colectores: Usuario[];
  onSave: () => void;
}) {
  const [asignaciones, setAsignaciones] = useState<{ ruta_norm: string; colecta_user_id: string }[]>([]);
  const [newRuta, setNewRuta] = useState('');
  const [newColector, setNewColector] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Inicializar asignaciones desde el turno
    if (turno.colecta && turno.colecta.length > 0) {
      setAsignaciones(turno.colecta.map((c) => ({
        ruta_norm: c.ruta_norm,
        colecta_user_id: c.colecta_user_id,
      })));
    }
  }, [turno]);

  const addAsignacion = () => {
    if (!newRuta.trim() || !newColector) return;
    
    // Verificar si la ruta ya está asignada
    if (asignaciones.some((a) => a.ruta_norm === newRuta.trim().toUpperCase())) {
      setError('Esta ruta ya está asignada');
      return;
    }

    setAsignaciones([...asignaciones, {
      ruta_norm: newRuta.trim().toUpperCase(),
      colecta_user_id: newColector,
    }]);
    setNewRuta('');
    setNewColector('');
    setError('');
  };

  const removeAsignacion = (rutaNorm: string) => {
    setAsignaciones(asignaciones.filter((a) => a.ruta_norm !== rutaNorm));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/turnos/${turno.id}/colecta`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ colecta: asignaciones }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al guardar');
      }

      setSuccess('Configuración de colecta guardada');
      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur rounded-xl p-6 mb-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        🚚 Configuración de Colecta
      </h3>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded mb-4 text-sm">
          {success}
        </div>
      )}

      {/* Lista de asignaciones actuales */}
      {asignaciones.length > 0 && (
        <div className="mb-4 space-y-2">
          {asignaciones.map((a) => {
            const colector = colectores.find((c) => c.id === a.colecta_user_id);
            return (
              <div key={a.ruta_norm} className="flex items-center justify-between bg-white/10 rounded px-3 py-2">
                <span className="text-white">
                  <span className="font-medium">{a.ruta_norm}</span>
                  <span className="text-purple-200 mx-2">→</span>
                  <span>{colector?.nombre || 'Desconocido'}</span>
                </span>
                <button
                  onClick={() => removeAsignacion(a.ruta_norm)}
                  className="text-red-300 hover:text-red-100"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Formulario para agregar */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Código de ruta"
          value={newRuta}
          onChange={(e) => setNewRuta(e.target.value)}
          className="flex-1 bg-white/20 border border-purple-400/50 rounded px-3 py-2 text-white placeholder-purple-300"
        />
        <select
          value={newColector}
          onChange={(e) => setNewColector(e.target.value)}
          className="flex-1 bg-white/20 border border-purple-400/50 rounded px-3 py-2 text-white"
        >
          <option value="" className="text-gray-900">Seleccionar colector</option>
          {colectores.map((c) => (
            <option key={c.id} value={c.id} className="text-gray-900">{c.nombre}</option>
          ))}
        </select>
        <button
          onClick={addAsignacion}
          disabled={!newRuta.trim() || !newColector}
          className="bg-purple-500 hover:bg-purple-600 disabled:bg-purple-400 text-white px-4 py-2 rounded"
        >
          +
        </button>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-purple-500 hover:bg-purple-600 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg"
      >
        {saving ? 'Guardando...' : '💾 Guardar Colecta'}
      </button>
    </div>
  );
}

function TurnoActivoView({
  turno,
  operarios,
  colectores,
  onCerrar,
  onRefresh,
}: {
  turno: TurnoCompleto;
  operarios: Usuario[];
  colectores: Usuario[];
  onCerrar: () => void;
  onRefresh: () => void;
}) {
  const [cerrando, setCerrando] = useState(false);

  const handleCerrar = async () => {
    if (!confirm('¿Estás seguro de cerrar el turno?')) return;

    setCerrando(true);
    try {
      const res = await fetch(`/api/turnos/${turno.id}/cerrar`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.message || 'Error al cerrar turno');
        return;
      }

      onCerrar();
    } catch (err) {
      alert('Error de conexión');
    } finally {
      setCerrando(false);
    }
  };

  return (
    <div>
      {/* Info del turno */}
      <div className="bg-white/10 backdrop-blur rounded-xl p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">✅</span>
              <h2 className="text-2xl font-bold text-white">Turno Activo</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <span className="text-purple-300">Fecha:</span>
                <span className="text-white ml-2">{turno.fecha}</span>
              </div>
              <div>
                <span className="text-purple-300">Franja:</span>
                <span className="text-white ml-2">{turno.franja}</span>
              </div>
              <div>
                <span className="text-purple-300">Inicio:</span>
                <span className="text-white ml-2">
                  {turno.started_at ? new Date(turno.started_at).toLocaleTimeString() : '-'}
                </span>
              </div>
              <div>
                <span className="text-purple-300">Fin estimado:</span>
                <span className="text-white ml-2">
                  {turno.ended_at ? new Date(turno.ended_at).toLocaleTimeString() : '-'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleCerrar}
            disabled={cerrando}
            className="bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white font-bold px-6 py-3 rounded-lg"
          >
            {cerrando ? 'Cerrando...' : '🛑 CERRAR TURNO'}
          </button>
        </div>
      </div>

      {/* Configuración de habilidades */}
      <HabilidadesSection turno={turno} operarios={operarios} onSave={onRefresh} />

      {/* Configuración de colecta */}
      <ColectaSection turno={turno} colectores={colectores} onSave={onRefresh} />
    </div>
  );
}

function TurnoManager() {
  const [turno, setTurno] = useState<TurnoCompleto | null>(null);
  const [horarios, setHorarios] = useState<TurnoHorario[]>([]);
  const [operarios, setOperarios] = useState<Usuario[]>([]);
  const [colectores, setColectores] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTurnoActivo = useCallback(async () => {
    try {
      const res = await fetch('/api/turnos/activo', { credentials: 'include' });
      
      if (res.status === 404) {
        setTurno(null);
        return;
      }

      if (!res.ok) {
        throw new Error('Error al obtener turno');
      }

      const data = await res.json();
      setTurno(data);
    } catch (err) {
      console.error('Error fetching turno:', err);
    }
  }, []);

  const fetchHorarios = async () => {
    try {
      const res = await fetch('/api/horarios', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setHorarios(data);
      }
    } catch (err) {
      console.error('Error fetching horarios:', err);
    }
  };

  const fetchUsuarios = async () => {
    try {
      // Fetch operarios
      const resOp = await fetch('/api/users?rol=OPERARIO', { credentials: 'include' });
      if (resOp.ok) {
        const data = await resOp.json();
        setOperarios(data);
      }

      // Fetch colectores
      const resCol = await fetch('/api/users?rol=COLECTA', { credentials: 'include' });
      if (resCol.ok) {
        const data = await resCol.json();
        setColectores(data);
      }
    } catch (err) {
      console.error('Error fetching usuarios:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchTurnoActivo(), fetchHorarios(), fetchUsuarios()]);
      setLoading(false);
    };
    init();
  }, [fetchTurnoActivo]);

  // Polling cada 10 segundos
  useEffect(() => {
    const interval = setInterval(fetchTurnoActivo, 10000);
    return () => clearInterval(interval);
  }, [fetchTurnoActivo]);

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">⏳</div>
        <p className="text-purple-200">Cargando...</p>
      </div>
    );
  }

  if (!turno) {
    return (
      <IniciarTurnoForm
        horarios={horarios}
        onTurnoIniciado={fetchTurnoActivo}
      />
    );
  }

  return (
    <TurnoActivoView
      turno={turno}
      operarios={operarios}
      colectores={colectores}
      onCerrar={fetchTurnoActivo}
      onRefresh={fetchTurnoActivo}
    />
  );
}

function Jefe() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-purple-700 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Vista Jefe</h1>
            <p className="text-purple-200">Bienvenido, {user?.nombre}</p>
          </div>
          <LogoutButton />
        </div>

        <TurnoManager />
      </div>
    </div>
  );
}

export default Jefe;
