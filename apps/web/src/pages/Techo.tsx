import LogoutButton from '../components/LogoutButton';

function Techo() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-700 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Pantalla Techo - Monitoreo</h1>
            <p className="text-gray-300">Vista de solo lectura</p>
          </div>
          <LogoutButton />
        </div>

        <div className="bg-white/10 backdrop-blur rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">📺</div>
          <h2 className="text-2xl font-semibold text-white mb-2">Monitor de Planta</h2>
          <p className="text-gray-300">Aquí se mostrará el estado de todas las rutas y operarios en tiempo real.</p>
        </div>
      </div>
    </div>
  );
}

export default Techo;
