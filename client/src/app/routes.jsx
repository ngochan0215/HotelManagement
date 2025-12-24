import RoomCalendar from '../features/booking/pages/roomCalendar.jsx';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../features/auth/pages/loginPage.jsx';
import Dashboard from '../features/dashboard/pages/dashboard.jsx';
import RoomPage from '../features/room/pages/RoomPage.jsx';
import { useAuth } from '../features/auth/hooks/authContext.jsx';
import MainLayout from "../core/layout/mainLayout.jsx";

export default function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />

      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/dashboard"
        element={user ? <Dashboard /> : <Navigate to="/login" replace />}
      />

      <Route
        path="/room-calendar"
        element={user ? <RoomCalendar /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/room-types"
        element={user ? <RoomPage /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}