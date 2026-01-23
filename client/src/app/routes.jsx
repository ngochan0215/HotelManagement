import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/authContext.jsx';
import LoginPage from '../features/auth/pages/loginPage.jsx';
import Dashboard from '../features/dashboard/pages/dashboard.jsx';
import RoomCalendar from '../features/booking/pages/roomCalendar.jsx';
import RoomPage from '../features/room/pages/roomPage.jsx';
import BookingList from '../features/booking/pages/bookingList.jsx';
import CustomerPage from '../features/customer/pages/customerPage.jsx';
import EmployeePage from '../features/employee/pages/employeePage.jsx';
import EquipmentPage from '../features/equipment/pages/equipmentPage.jsx';
import ServicePage from '../features/service/pages/servicePage.jsx';
import IncidentPage from '../features/incident/pages/incidentPage.jsx';
import DiscountPage from '../features/discount/pages/discountPage.jsx';
import ReceiptPage from '../features/receipt/pages/receiptListPage.jsx';
import StatisticsPage from '../features/statistics/pages/statisticsPage.jsx';
import QrScannerPage from '../features/qr/pages/qrScannerPage.jsx';
import PaymentResultPage from '../features/payment/pages/paymentResultPage.jsx';

export default function AppRoutes() {
  const { user, isLoading } = useAuth();

  // Đợi auth state được restore từ localStorage trước khi render routes
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />

      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

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

    <Route
          path="/service"
          element={user ? <ServicePage /> : <Navigate to="/login" replace />}
    />

    <Route
              path="/incidents"
              element={user ? <IncidentPage /> : <Navigate to="/login" replace />}
        />

        <Route
              path="/promotions"
              element={user ? <DiscountPage /> : <Navigate to="/login" replace />}
        />

        <Route
              path="/invoices"
              element={user ? <ReceiptPage /> : <Navigate to="/login" replace />}
        />

        <Route
              path="/reports"
              element={user ? <StatisticsPage /> : <Navigate to="/login" replace />}
        />

        <Route
              path="/qr-scanner"
              element={user ? <QrScannerPage /> : <Navigate to="/login" replace />}
        />

        <Route
              path="/payment/success"
              element={user ? <PaymentResultPage /> : <Navigate to="/login" replace />}
        />

        <Route
              path="/payment/cancel"
              element={user ? <PaymentResultPage /> : <Navigate to="/login" replace />}
        />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}