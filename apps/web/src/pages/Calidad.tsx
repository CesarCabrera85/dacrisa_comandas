import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import LogoutButton from '../components/LogoutButton';
import type { 
  TurnoHorario, 
  FranjaTurno, 
  ProductosMasterVersion, 
  RutasMasterVersion,
  MasterdataValidationError
} from '@dacrisa/shared';

const FRANJAS: FranjaTurno[] = ['MANANA', 'TARDE', 'NOCHE'];

// ===== TIPOS LOCALES =====

interface HorarioFormData {
  franja: FranjaTurno;
  start_time: string;
  end_time: string;
  activo: boolean;
}

interface UploadResult {
  version_id: string;
  version_label: string;
  validation_status: 'OK' | 'WARNING' | 'BLOQUEADO';
  validation_errors: MasterdataValidationError[];
  productos_count?: number;
  rutas_count?: number;
}

// ===== HORARIOS MANAGER (existente) =====

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

// ===== VALIDATION ERRORS DISPLAY =====

function ValidationErrorsTable({ errors }: { errors: MasterdataValidationError[] }) {
  if (!errors || errors.length === 0) return null;
  
  return (
    <div className="mt-4 max-h-60 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            <th className="px-2 py-1 text-left">Fila</th>
            <th className="px-2 py-1 text-left">Campo</th>
            <th className="px-2 py-1 text-left">Tipo</th>
            <th className="px-2 py-1 text-left">Mensaje</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((err, idx) => (
            <tr key={idx} className={err.tipo === 'ERROR' ? 'bg-red-50' : 'bg-yellow-50'}>
              <td className="px-2 py-1">{err.fila}</td>
              <td className="px-2 py-1">{err.campo}</td>
              <td className="px-2 py-1">
                <span className={`px-1 py-0.5 rounded text-xs ${
                  err.tipo === 'ERROR' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
                }`}>
                  {err.tipo}
                </span>
              </td>
              <td className="px-2 py-1">{err.mensaje}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===== PRODUCTOS MASTER MANAGER =====

function UploadProductosModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Seleccione un archivo XLSX');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/masterdata/productos/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error al subir archivo');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async () => {
    if (!result) return;

    try {
      const res = await fetch(`/api/masterdata/productos/${result.version_id}/activate`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Error al activar versión');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">Subir Productos Master</h3>

        {!result ? (
          <>
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archivo XLSX
              </label>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls"
                className="w-full border rounded-lg px-3 py-2"
              />
              <p className="text-sm text-gray-500 mt-1">
                Columnas esperadas: Producto, Familia (1-6)
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                disabled={uploading}
              >
                {uploading ? 'Subiendo...' : 'Subir y Validar'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`p-4 rounded-lg mb-4 ${
              result.validation_status === 'OK' ? 'bg-green-100 text-green-800' :
              result.validation_status === 'WARNING' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              <p className="font-semibold">
                Versión creada: {result.version_label}
              </p>
              <p>Estado: {result.validation_status}</p>
              <p>Productos válidos: {result.productos_count}</p>
            </div>

            {result.validation_errors.length > 0 && (
              <div className="mb-4">
                <p className="font-medium text-gray-700 mb-2">
                  Errores de validación ({result.validation_errors.length}):
                </p>
                <ValidationErrorsTable errors={result.validation_errors} />
              </div>
            )}

            {result.validation_status === 'BLOQUEADO' && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                ⚠️ No se puede activar esta versión debido a errores bloqueantes.
                Corrija el archivo y vuelva a subirlo.
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cerrar
              </button>
              {result.validation_status !== 'BLOQUEADO' && (
                <button
                  onClick={handleActivate}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Activar Ahora
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProductosMasterManager() {
  const [versions, setVersions] = useState<ProductosMasterVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/masterdata/productos/versions', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar versiones');
      const data = await res.json();
      setVersions(data);
    } catch (err) {
      setError('Error al cargar versiones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  const handleActivate = async (versionId: string) => {
    if (!confirm('¿Activar esta versión? La versión actual será desactivada.')) return;

    try {
      const res = await fetch(`/api/masterdata/productos/${versionId}/activate`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Error al activar versión');
      }

      fetchVersions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!confirm('¿Hacer rollback a esta versión?')) return;

    try {
      const res = await fetch(`/api/masterdata/productos/${versionId}/rollback`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Error al hacer rollback');
      }

      fetchVersions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white">Productos Master</h2>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2"
        >
          <span>📤</span> Subir Nueva Versión
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => setError('')} className="float-right font-bold">×</button>
        </div>
      )}

      {loading ? (
        <div className="text-yellow-200 text-center py-8">Cargando versiones...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-yellow-200 border-b border-yellow-500/30">
                <th className="pb-3 px-2">Versión</th>
                <th className="pb-3 px-2">Archivo</th>
                <th className="pb-3 px-2">Productos</th>
                <th className="pb-3 px-2">Validación</th>
                <th className="pb-3 px-2">Estado</th>
                <th className="pb-3 px-2">Fecha</th>
                <th className="pb-3 px-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className="border-b border-yellow-500/20">
                  <td className="py-3 px-2 text-white font-medium">{v.version_label}</td>
                  <td className="py-3 px-2 text-yellow-200">{v.archivo_nombre}</td>
                  <td className="py-3 px-2 text-yellow-200">{v.productos_count}</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-1 rounded text-sm ${
                      v.validacion_estado === 'OK'
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}>
                      {v.validacion_estado}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    {v.activo ? (
                      <span className="px-2 py-1 rounded text-sm bg-blue-500/20 text-blue-300">
                        ✓ ACTIVA
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-yellow-200">
                    {new Date(v.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-2">
                    {!v.activo && v.validacion_estado === 'OK' && (
                      <>
                        <button
                          onClick={() => handleActivate(v.id)}
                          className="text-green-300 hover:text-green-100 mr-3"
                        >
                          ✓ Activar
                        </button>
                        <button
                          onClick={() => handleRollback(v.id)}
                          className="text-blue-300 hover:text-blue-100"
                        >
                          ↺ Rollback
                        </button>
                      </>
                    )}
                    {v.activo && (
                      <span className="text-gray-400">Versión actual</span>
                    )}
                    {!v.activo && v.validacion_estado === 'BLOQUEADO' && (
                      <span className="text-red-300">Bloqueada</span>
                    )}
                  </td>
                </tr>
              ))}
              {versions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-yellow-200">
                    No hay versiones de productos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <UploadProductosModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={fetchVersions}
      />
    </div>
  );
}

// ===== RUTAS MASTER MANAGER =====

function UploadRutasModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Seleccione un archivo XLSX');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/masterdata/rutas/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error al subir archivo');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async () => {
    if (!result) return;

    try {
      const res = await fetch(`/api/masterdata/rutas/${result.version_id}/activate`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Error al activar versión');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">Subir Rutas Master</h3>

        {!result ? (
          <>
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archivo XLSX
              </label>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls"
                className="w-full border rounded-lg px-3 py-2"
              />
              <p className="text-sm text-gray-500 mt-1">
                Columnas esperadas: Ruta, Orden (opcional)
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                disabled={uploading}
              >
                {uploading ? 'Subiendo...' : 'Subir y Validar'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`p-4 rounded-lg mb-4 ${
              result.validation_status === 'OK' ? 'bg-green-100 text-green-800' :
              result.validation_status === 'WARNING' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              <p className="font-semibold">
                Versión creada: {result.version_label}
              </p>
              <p>Estado: {result.validation_status}</p>
              <p>Rutas válidas: {result.rutas_count}</p>
            </div>

            {result.validation_errors.length > 0 && (
              <div className="mb-4">
                <p className="font-medium text-gray-700 mb-2">
                  Errores de validación ({result.validation_errors.length}):
                </p>
                <ValidationErrorsTable errors={result.validation_errors} />
              </div>
            )}

            {result.validation_status === 'BLOQUEADO' && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                ⚠️ No se puede activar esta versión debido a errores bloqueantes.
                Corrija el archivo y vuelva a subirlo.
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cerrar
              </button>
              {result.validation_status !== 'BLOQUEADO' && (
                <button
                  onClick={handleActivate}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Activar Ahora
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RutasMasterManager() {
  const [versions, setVersions] = useState<RutasMasterVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const fetchVersions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/masterdata/rutas/versions', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar versiones');
      const data = await res.json();
      setVersions(data);
    } catch (err) {
      setError('Error al cargar versiones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  const handleActivate = async (versionId: string) => {
    if (!confirm('¿Activar esta versión? La versión actual será desactivada.')) return;

    try {
      const res = await fetch(`/api/masterdata/rutas/${versionId}/activate`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Error al activar versión');
      }

      fetchVersions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!confirm('¿Hacer rollback a esta versión?')) return;

    try {
      const res = await fetch(`/api/masterdata/rutas/${versionId}/rollback`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Error al hacer rollback');
      }

      fetchVersions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white">Rutas Master</h2>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2"
        >
          <span>📤</span> Subir Nueva Versión
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button onClick={() => setError('')} className="float-right font-bold">×</button>
        </div>
      )}

      {loading ? (
        <div className="text-yellow-200 text-center py-8">Cargando versiones...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-yellow-200 border-b border-yellow-500/30">
                <th className="pb-3 px-2">Versión</th>
                <th className="pb-3 px-2">Archivo</th>
                <th className="pb-3 px-2">Rutas</th>
                <th className="pb-3 px-2">Validación</th>
                <th className="pb-3 px-2">Estado</th>
                <th className="pb-3 px-2">Fecha</th>
                <th className="pb-3 px-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className="border-b border-yellow-500/20">
                  <td className="py-3 px-2 text-white font-medium">{v.version_label}</td>
                  <td className="py-3 px-2 text-yellow-200">{v.archivo_nombre}</td>
                  <td className="py-3 px-2 text-yellow-200">{v.rutas_count}</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-1 rounded text-sm ${
                      v.validacion_estado === 'OK'
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}>
                      {v.validacion_estado}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    {v.activo ? (
                      <span className="px-2 py-1 rounded text-sm bg-blue-500/20 text-blue-300">
                        ✓ ACTIVA
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-yellow-200">
                    {new Date(v.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-2">
                    {!v.activo && v.validacion_estado === 'OK' && (
                      <>
                        <button
                          onClick={() => handleActivate(v.id)}
                          className="text-green-300 hover:text-green-100 mr-3"
                        >
                          ✓ Activar
                        </button>
                        <button
                          onClick={() => handleRollback(v.id)}
                          className="text-blue-300 hover:text-blue-100"
                        >
                          ↺ Rollback
                        </button>
                      </>
                    )}
                    {v.activo && (
                      <span className="text-gray-400">Versión actual</span>
                    )}
                    {!v.activo && v.validacion_estado === 'BLOQUEADO' && (
                      <span className="text-red-300">Bloqueada</span>
                    )}
                  </td>
                </tr>
              ))}
              {versions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-yellow-200">
                    No hay versiones de rutas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <UploadRutasModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={fetchVersions}
      />
    </div>
  );
}

// ===== MAIN CALIDAD PAGE WITH TABS =====

type CalidadTab = 'horarios' | 'productos' | 'rutas';

function Calidad() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<CalidadTab>('horarios');

  const tabs: { key: CalidadTab; label: string; icon: string }[] = [
    { key: 'horarios', label: 'Horarios', icon: '🕐' },
    { key: 'productos', label: 'Productos Master', icon: '📦' },
    { key: 'rutas', label: 'Rutas Master', icon: '🚚' },
  ];

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

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white/10 text-yellow-200 hover:bg-white/20'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'horarios' && <HorariosManager />}
        {activeTab === 'productos' && <ProductosMasterManager />}
        {activeTab === 'rutas' && <RutasMasterManager />}
      </div>
    </div>
  );
}

export default Calidad;
