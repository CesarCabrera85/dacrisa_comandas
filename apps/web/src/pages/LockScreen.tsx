import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ROLE_ROUTES: Record<string, string> = {
  OPERARIO: '/operario',
  COLECTA: '/colecta',
  JEFE: '/jefe',
  CALIDAD: '/calidad',
  DIOS: '/dios',
  PANTALLA_TECHO: '/techo',
};

function LockScreen() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, error } = useAuth();
  const navigate = useNavigate();

  const handleKeyPress = (digit: string) => {
    if (code.length < 8) {
      setCode(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setCode(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setCode('');
  };

  const handleSubmit = async () => {
    if (code.length === 0) return;
    
    setIsLoading(true);
    const success = await login(code);
    setIsLoading(false);
    
    if (success) {
      // Get user from auth context and redirect
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        navigate(ROLE_ROUTES[data.user.rol_tag] || '/lockscreen');
      }
    } else {
      setCode('');
    }
  };

  const NumpadButton = ({ value, onClick, className = '' }: { value: string; onClick: () => void; className?: string }) => (
    <button
      onClick={onClick}
      className={`w-20 h-20 text-2xl font-bold rounded-xl bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white transition-all shadow-lg ${className}`}
    >
      {value}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">DACRISA</h1>
        <h2 className="text-xl text-blue-300">Sistema de Comandas</h2>
      </div>

      <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl">
        {/* Code display */}
        <div className="mb-6">
          <div className="bg-gray-900 rounded-xl p-4 min-w-[280px] text-center">
            <div className="text-3xl font-mono tracking-widest text-white h-10">
              {code.split('').map(() => '•').join(' ') || <span className="text-gray-600">- - - -</span>}
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-center">
            {error}
          </div>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
            <NumpadButton
              key={digit}
              value={digit}
              onClick={() => handleKeyPress(digit)}
            />
          ))}
          <NumpadButton value="C" onClick={handleClear} className="bg-yellow-700 hover:bg-yellow-600" />
          <NumpadButton value="0" onClick={() => handleKeyPress('0')} />
          <NumpadButton value="⌫" onClick={handleBackspace} className="bg-orange-700 hover:bg-orange-600" />
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={code.length === 0 || isLoading}
          className="w-full py-4 text-xl font-bold rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-all shadow-lg"
        >
          {isLoading ? 'Verificando...' : 'Entrar'}
        </button>
      </div>

      <p className="mt-8 text-gray-500 text-sm">
        Ingrese su código de acceso
      </p>
    </div>
  );
}

export default LockScreen;
