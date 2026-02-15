import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import LogoutButton from '../components/LogoutButton';
import type { TurnoHorario, FranjaTurno } from '@dacrisa/shared';

const FRANJAS: FranjaTurno[] = ['MANANA', 'TARDE', 'NOCHE'];

interface HorarioFormData {
  franja: FranjaTurno;
  start_time: string;
  end_time: string;
  activo: boolean;
}

function HorarioModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: HorarioFormData) => void;
  initialData?: TurnoHorario;
  isEditing: boolean;
}) {
  const [formData, setFormData] = useState<HorarioFormData>({
    franja: 'MANANA',
    start_time: '06:00',
    end_time: '14:00',
    activo: true,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        franja: initialData.franja,
        start_time: initialData.start_time.substring(0, 5),
        end_time: initialData.end_time.substring(0, 5),
        activo: initialData.activo,
      });
    } else {
      setFormData({
        franja: 'MANANA',
        start_time: '06:00',
        end_time: '14:00',
        activo: true,
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validación: start_time < end_time (excepto para turno noche)
    if (formData.franja !== 'NOCHE' && formData.start_time >= formData.end_time) {
      setError('La hora de inicio debe ser anterior a la hora de fin');
      return;
    }

    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4">
          {isEditing ? 'Editar Horario' : 'Nuevo Horario'}
        </h3>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Franja
            </label>
            <select
              value={formData.franja}
              onChange={(e) => setFormData({ ...formData, franja: e.target.value as FranjaTurno })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              disabled={isEditing}
            >
              {FRANJAS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hora Inicio
            </label>
            <input
              type="time"
              value={formData.start_time}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hora Fin
            </label>
            <input
              type="time"
              value={formData.end_time}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              required
            />
          </div>

          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.activo}
                onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                className="mr-2 h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Activo</span>
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HorariosManager() {
  const [horarios, setHorarios] = useState<TurnoHorario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHorario, setEditingHorario] = useState<TurnoHorario | undefined>();

  const fetchHorarios = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/horarios', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar horarios');
      const data = await res.json();
      setHorarios(data);
    } catch (err) {
      setError('Error al cargar horarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHorarios();
  }, []);

  const handleCreate = async (data: HorarioFormData) => {
    try {
      const res = await fetch('/api/horarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al crear horario');
      }

      setModalOpen(false);
      fetchHorarios();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdate = async (data: HorarioFormData) => {
    if (!editingHorario) return;

    try {
      const res = await fetch(`/api/horarios/${editingHorario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error al actualizar horario');
      }

      setModalOpen(false);
      setEditingHorario(undefined);
      fetchHorarios();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (horario: TurnoHorario) => {
    if (!confirm(`¿Desactivar el horario de ${horario.franja}?`)) return;

    try {
      const res = await fetch(`/api/horarios/${horario.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.status === 409) {
        const err = await res.json();
        setError(err.message || 'El horario está en uso por turnos activos');
        return;
      }

      if (!res.ok && res.status !== 204) {
        throw new Error('Error al desactivar horario');
      }

      fetchHorarios();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openEditModal = (horario: TurnoHorario) => {
    setEditingHorario(horario);
    setModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingHorario(undefined);
    setModalOpen(true);
  };

  return (
    <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white">Gestión de Horarios</h2>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2"
        >
          <span>+</span> Nuevo Horario
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => setError('')} className="float-right font-bold">×</button>
        </div>
      )}

      {loading ? (
        <div className="text-yellow-200 text-center py-8">Cargando horarios...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-yellow-200 border-b border-yellow-500/30">
                <th className="pb-3 px-2">Franja</th>
                <th className="pb-3 px-2">Hora Inicio</th>
                <th className="pb-3 px-2">Hora Fin</th>
                <th className="pb-3 px-2">Estado</th>
                <th className="pb-3 px-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {horarios.map((horario) => (
                <tr key={horario.id} className="border-b border-yellow-500/20">
                  <td className="py-3 px-2 text-white font-medium">{horario.franja}</td>
                  <td className="py-3 px-2 text-yellow-200">{horario.start_time.substring(0, 5)}</td>
                  <td className="py-3 px-2 text-yellow-200">{horario.end_time.substring(0, 5)}</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-1 rounded text-sm ${
                      horario.activo
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}>
                      {horario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <button
                      onClick={() => openEditModal(horario)}
                      className="text-yellow-300 hover:text-yellow-100 mr-3"
                    >
                      ✏️ Editar
                    </button>
                    {horario.activo && (
                      <button
                        onClick={() => handleDelete(horario)}
                        className="text-red-300 hover:text-red-100"
                      >
                        🗑️ Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {horarios.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-yellow-200">
                    No hay horarios configurados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <HorarioModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingHorario(undefined);
        }}
        onSubmit={editingHorario ? handleUpdate : handleCreate}
        initialData={editingHorario}
        isEditing={!!editingHorario}
      />
    </div>
  );
}

function Calidad() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-900 to-yellow-700 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Vista Calidad</h1>
            <p className="text-yellow-200">Bienvenido, {user?.nombre}</p>
          </div>
          <LogoutButton />
        </div>

        <HorariosManager />
      </div>
    </div>
  );
}

export default Calidad;
