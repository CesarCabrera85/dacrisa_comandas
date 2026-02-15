import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: string[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/lockscreen" replace />;
  }

  if (!allowedRoles.includes(user.rol_tag)) {
    // Redirect to their proper route
    const ROLE_ROUTES: Record<string, string> = {
      OPERARIO: '/operario',
      COLECTA: '/colecta',
      JEFE: '/jefe',
      CALIDAD: '/calidad',
      DIOS: '/dios',
      PANTALLA_TECHO: '/techo',
    };
    return <Navigate to={ROLE_ROUTES[user.rol_tag] || '/lockscreen'} replace />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
