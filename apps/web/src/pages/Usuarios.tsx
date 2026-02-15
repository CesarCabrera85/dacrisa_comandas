import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import LogoutButton from '../components/LogoutButton';
import './Usuarios.css';

interface Usuario {
  id: string;
  nombre: string;
  rol: string;
  estado: string;
  created_at: string;
  updated_at: string;
}

interface ModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface EditModalProps extends ModalProps {
  usuario: Usuario;
}

// Modal Crear Usuario
function ModalCrearUsuario({ onClose, onSuccess }: ModalProps) {
  const [form, setForm] = useState({
    nombre: '',
    codigo: '',
    rol: 'OPERARIO',
    estado: 'ACTIVO'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validaciones
    if (form.nombre.length < 3) {
      setError('El nombre debe tener al menos 3 caracteres');
      return;
    }

    if (!/^\d{4,6}$/.test(form.codigo)) {
      setError('El código debe ser numérico de 4-6 dígitos');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al crear usuario');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Crear Usuario</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre:</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              required
              minLength={3}
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label>Código (4-6 dígitos):</label>
            <input
              type="password"
              value={form.codigo}
              onChange={e => setForm({ ...form, codigo: e.target.value })}
              pattern="\d{4,6}"
              required
            />
          </div>

          <div className="form-group">
            <label>Rol:</label>
            <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
              <option value="OPERARIO">Operario</option>
              <option value="COLECTA">Colecta</option>
              <option value="JEFE">Jefe</option>
              <option value="CALIDAD">Calidad</option>
              <option value="DIOS">Dios</option>
              <option value="PANTALLA_TECHO">Pantalla Techo</option>
            </select>
          </div>

          <div className="form-group">
            <label>Estado:</label>
            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal Editar Usuario
function ModalEditarUsuario({ usuario, onClose, onSuccess }: EditModalProps) {
  const [form, setForm] = useState({
    nombre: usuario.nombre,
    rol: usuario.rol,
    estado: usuario.estado
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.nombre.length < 3) {
      setError('El nombre debe tener al menos 3 caracteres');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al actualizar usuario');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Editar Usuario</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre:</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              required
              minLength={3}
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label>Rol:</label>
            <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
              <option value="OPERARIO">Operario</option>
              <option value="COLECTA">Colecta</option>
              <option value="JEFE">Jefe</option>
              <option value="CALIDAD">Calidad</option>
              <option value="DIOS">Dios</option>
              <option value="PANTALLA_TECHO">Pantalla Techo</option>
            </select>
          </div>

          <div className="form-group">
            <label>Estado:</label>
            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              <option value="BAJA_TEMPORAL">Baja Temporal</option>
            </select>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal Cambiar Código
function ModalCambiarCodigo({ usuario, onClose, onSuccess }: EditModalProps) {
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [confirmarCodigo, setConfirmarCodigo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^\d{4,6}$/.test(nuevoCodigo)) {
      setError('El código debe ser numérico de 4-6 dígitos');
      return;
    }

    if (nuevoCodigo !== confirmarCodigo) {
      setError('Los códigos no coinciden');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/usuarios/${usuario.id}/codigo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nuevo_codigo: nuevoCodigo })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al cambiar código');
      }

      alert('Código actualizado. Las sesiones del usuario han sido invalidadas.');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Cambiar Código - {usuario.nombre}</h2>

        <div className="warning">
          ⚠️ Al cambiar el código, se cerrarán todas las sesiones activas del usuario.
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nuevo Código (4-6 dígitos):</label>
            <input
              type="password"
              value={nuevoCodigo}
              onChange={e => setNuevoCodigo(e.target.value)}
              pattern="\d{4,6}"
              required
            />
          </div>

          <div className="form-group">
            <label>Confirmar Código:</label>
            <input
              type="password"
              value={confirmarCodigo}
              onChange={e => setConfirmarCodigo(e.target.value)}
              pattern="\d{4,6}"
              required
            />
          </div>

          {error && <div className="error">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" disabled={loading}>
              {loading ? 'Cambiando...' : 'Cambiar Código'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Componente principal
export default function Usuarios() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filtroRol, setFiltroRol] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState<Usuario | null>(null);
  const [modalCodigo, setModalCodigo] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsuarios = async () => {
    try {
      const params = new URLSearchParams();
      if (filtroRol) params.append('rol', filtroRol);
      if (filtroEstado) params.append('estado', filtroEstado);

      const res = await fetch(`/api/usuarios?${params}`, {
        credentials: 'include'
      });
      const data = await res.json();
      setUsuarios(data);
    } catch (error) {
      console.error('Error fetching usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, [filtroRol, filtroEstado]);

  const bajaTemporal = async (id: string) => {
    if (!confirm('¿Poner al usuario en baja temporal?')) return;

    try {
      setActionLoading(id);
      const res = await fetch(`/api/usuarios/${id}/baja-temporal`, {
        method: 'PUT',
        credentials: 'include'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      fetchUsuarios();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const reactivar = async (id: string) => {
    if (!confirm('¿Reactivar usuario?')) return;

    try {
      setActionLoading(id);
      const res = await fetch(`/api/usuarios/${id}/reactivar`, {
        method: 'PUT',
        credentials: 'include'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      fetchUsuarios();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const desactivar = async (id: string) => {
    if (!confirm('¿Desactivar usuario? El usuario no podrá iniciar sesión.')) return;

    try {
      setActionLoading(id);
      const res = await fetch(`/api/usuarios/${id}/desactivar`, {
        method: 'PUT',
        credentials: 'include'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      fetchUsuarios();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const eliminar = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar usuario "${nombre}"? Esta acción no se puede deshacer.`)) return;

    try {
      setActionLoading(id);
      const res = await fetch(`/api/usuarios/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      fetchUsuarios();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="usuarios-page">
      <header className="usuarios-header">
        <div className="header-left">
          <h1>👥 Gestión de Usuarios</h1>
          <span className="user-info">Sesión: {user?.nombre}</span>
        </div>
        <div className="header-right">
          <LogoutButton />
        </div>
      </header>

      <div className="usuarios-container">
        <div className="usuarios-toolbar">
          <div className="filtros">
            <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
              <option value="">Todos los roles</option>
              <option value="OPERARIO">Operario</option>
              <option value="COLECTA">Colecta</option>
              <option value="JEFE">Jefe</option>
              <option value="CALIDAD">Calidad</option>
              <option value="DIOS">Dios</option>
              <option value="PANTALLA_TECHO">Pantalla Techo</option>
            </select>

            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              <option value="BAJA_TEMPORAL">Baja Temporal</option>
            </select>
          </div>

          <button className="btn-crear" onClick={() => setModalCrear(true)}>
            + Crear Usuario
          </button>
        </div>

        {loading ? (
          <div className="loading">Cargando usuarios...</div>
        ) : (
          <table className="usuarios-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(usuario => (
                <tr key={usuario.id}>
                  <td>{usuario.nombre}</td>
                  <td>
                    <span className={`badge badge-${usuario.rol}`}>{usuario.rol}</span>
                  </td>
                  <td>
                    <span className={`badge badge-${usuario.estado}`}>{usuario.estado}</span>
                  </td>
                  <td>{formatDate(usuario.created_at)}</td>
                  <td className="actions-cell">
                    <button
                      onClick={() => setModalEditar(usuario)}
                      disabled={actionLoading === usuario.id}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setModalCodigo(usuario)}
                      disabled={actionLoading === usuario.id}
                    >
                      Cambiar Código
                    </button>

                    {usuario.estado === 'ACTIVO' && (
                      <>
                        <button
                          onClick={() => bajaTemporal(usuario.id)}
                          disabled={actionLoading === usuario.id}
                        >
                          Baja Temporal
                        </button>
                        <button
                          onClick={() => desactivar(usuario.id)}
                          disabled={actionLoading === usuario.id}
                        >
                          Desactivar
                        </button>
                      </>
                    )}

                    {usuario.estado !== 'ACTIVO' && (
                      <button
                        onClick={() => reactivar(usuario.id)}
                        disabled={actionLoading === usuario.id}
                      >
                        Reactivar
                      </button>
                    )}

                    {user?.rol_tag === 'DIOS' && (
                      <button
                        onClick={() => eliminar(usuario.id, usuario.nombre)}
                        disabled={actionLoading === usuario.id}
                        className="btn-danger"
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-row">No hay usuarios</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modales */}
      {modalCrear && (
        <ModalCrearUsuario
          onClose={() => setModalCrear(false)}
          onSuccess={fetchUsuarios}
        />
      )}
      {modalEditar && (
        <ModalEditarUsuario
          usuario={modalEditar}
          onClose={() => setModalEditar(null)}
          onSuccess={fetchUsuarios}
        />
      )}
      {modalCodigo && (
        <ModalCambiarCodigo
          usuario={modalCodigo}
          onClose={() => setModalCodigo(null)}
          onSuccess={fetchUsuarios}
        />
      )}
    </div>
  );
}
