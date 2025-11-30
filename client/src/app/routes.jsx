import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../features/auth/pages/loginPage.jsx';
import Dashboard from '../features/dashboard/pages/dashboard.jsx';
import { useAuth } from '../features/auth/hooks/useAuth.js';

export default function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={user ? <Dashboard /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
