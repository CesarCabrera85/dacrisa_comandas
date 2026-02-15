import { useAuth } from '../context/AuthContext';
import LogoutButton from '../components/LogoutButton';

function Calidad() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-900 to-yellow-700 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Vista Calidad</h1>
            <p className="text-yellow-200">Bienvenido, {user?.nombre}</p>
          </div>
          <LogoutButton />
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-semibold text-white mb-2">Panel de Calidad</h2>
          <p className="text-yellow-200">Aquí se gestionarán horarios de turnos, catálogos y configuración.</p>
        </div>
      </div>
    </div>
  );
}

export default Calidad;
