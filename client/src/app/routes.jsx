import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/authContext.jsx';
import LoginPage from '../features/auth/pages/loginPage.jsx';
import Dashboard from '../features/dashboard/pages/dashboard.jsx';
import RoomCalendar from '../features/booking/pages/roomCalendar.jsx';
import RoomPage from '../features/room/pages/RoomPage.jsx';
import BookingList from '../features/booking/pages/bookingList.jsx';
import CustomerPage from '../features/customer/pages/customerPage.jsx';
import EmployeePage from '../features/employee/pages/EmployeePage.jsx';
import EquipmentPage from '../features/equipment/pages/equipmentPage.jsx';
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

      <Route
        path="/booking-management"
        element={user ? <BookingList /> : <Navigate to="/login" replace />}
      />

      <Route
        path="/customers"
        element={user ? <CustomerPage /> : <Navigate to="/login" replace />}
      />

      <Route
        path="/employees"
        element={user ? <EmployeePage /> : <Navigate to="/login" replace />}
      />

    <Route
      path="/equipment"
      element={user ? <EquipmentPage /> : <Navigate to="/login" replace />}
    />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}