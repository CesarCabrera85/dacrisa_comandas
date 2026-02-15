import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function LogoutButton() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/lockscreen');
  };

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
    >
      Cerrar Sesión
    </button>
  );
}

export default LogoutButton;
