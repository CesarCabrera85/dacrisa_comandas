import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LockScreen from './pages/LockScreen';
import Operario from './pages/Operario';
import Colecta from './pages/Colecta';
import Jefe from './pages/Jefe';
import Calidad from './pages/Calidad';
import Dios from './pages/Dios';
import Techo from './pages/Techo';
import Usuarios from './pages/Usuarios';
import ProtectedRoute from './components/ProtectedRoute';

const ROLE_ROUTES: Record<string, string> = {
  OPERARIO: '/operario',
  COLECTA: '/colecta',
  JEFE: '/jefe',
  CALIDAD: '/calidad',
  DIOS: '/dios',
  PANTALLA_TECHO: '/techo',
};

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/lockscreen" element={
        user ? <Navigate to={ROLE_ROUTES[user.rol_tag] || '/lockscreen'} replace /> : <LockScreen />
      } />
      
      <Route path="/operario" element={
        <ProtectedRoute allowedRoles={['OPERARIO']}><Operario /></ProtectedRoute>
      } />
      
      <Route path="/colecta" element={
        <ProtectedRoute allowedRoles={['COLECTA']}><Colecta /></ProtectedRoute>
      } />
      
      <Route path="/jefe" element={
        <ProtectedRoute allowedRoles={['JEFE', 'DIOS']}><Jefe /></ProtectedRoute>
      } />
      
      <Route path="/calidad" element={
        <ProtectedRoute allowedRoles={['CALIDAD', 'DIOS']}><Calidad /></ProtectedRoute>
      } />
      
      <Route path="/dios" element={
        <ProtectedRoute allowedRoles={['DIOS']}><Dios /></ProtectedRoute>
      } />
      
      <Route path="/techo" element={
        <ProtectedRoute allowedRoles={['PANTALLA_TECHO']}><Techo /></ProtectedRoute>
      } />
      
      <Route path="/usuarios" element={
        <ProtectedRoute allowedRoles={['CALIDAD', 'DIOS']}><Usuarios /></ProtectedRoute>
      } />
      
      <Route path="*" element={
        user ? <Navigate to={ROLE_ROUTES[user.rol_tag] || '/lockscreen'} replace /> : <Navigate to="/lockscreen" replace />
      } />
    </Routes>
  );
}

export default App;
