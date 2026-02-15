import { useAuth } from '../context/AuthContext';
import LogoutButton from '../components/LogoutButton';

function Operario() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Vista Operario</h1>
            <p className="text-green-200">Bienvenido, {user?.nombre}</p>
          </div>
          <LogoutButton />
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">👷</div>
          <h2 className="text-2xl font-semibold text-white mb-2">Panel de Operario</h2>
          <p className="text-green-200">Aquí se mostrarán las comandas asignadas y pendientes de impresión.</p>
        </div>
      </div>
    </div>
  );
}

export default Operario;
