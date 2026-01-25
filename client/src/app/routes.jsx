import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/authContext.jsx';
import LoginPage from '../features/auth/pages/loginPage.jsx';
import Dashboard from '../features/dashboard/pages/dashboard.jsx';
import RoomCalendar from '../features/booking/pages/roomCalendar.jsx';
import RoomPage from '../features/room/pages/roomPage.jsx';
import BookingList from '../features/booking/pages/bookingList.jsx';
import CustomerPage from '../features/customer/pages/customerPage.jsx';
import EmployeePage from '../features/employee/pages/employeePage.jsx';
import EarningsPage from '../features/employee/pages/earningsPage.jsx';
import EquipmentPage from '../features/equipment/pages/equipmentPage.jsx';
import TechnicianWorkPage from '../features/equipment/pages/technicianWorkPage.jsx';
import HousekeeperWorkPage from '../features/booking/pages/housekeeperWorkPage.jsx';
import AllTasksPage from '../features/booking/pages/allTasksPage.jsx';
import ServicePage from '../features/service/pages/servicePage.jsx';
import IncidentPage from '../features/incident/pages/incidentPage.jsx';
import DiscountPage from '../features/discount/pages/discountPage.jsx';
import ReceiptPage from '../features/receipt/pages/receiptListPage.jsx';
import StatisticsPage from '../features/statistics/pages/statisticsPage.jsx';
import QrScannerPage from '../features/qr/pages/qrScannerPage.jsx';
import PaymentResultPage from '../features/payment/pages/paymentResultPage.jsx';
import ProfilePage from '../features/auth/pages/profilePage.jsx';

// Component để route đến đúng trang công việc
function WorkPageRouter() {
  const position = (localStorage.getItem("position") || "").toLowerCase();

  if (position === "technician") {
    return <TechnicianWorkPage />;
  } else if (position === "housekeeper") {
    return <HousekeeperWorkPage />;
  }

  return <Navigate to="/dashboard" replace />;
}

export default function AppRoutes() {
  const { user, isLoading } = useAuth();

  const ProtectedRoute = ({ children, allowed, excludeManager = false }) => {
    const location = useLocation();
    if (!user) return <Navigate to="/login" replace />;

    const role = (user.role || localStorage.getItem("role") || "").toLowerCase();
    const position = (user.position || localStorage.getItem("position") || "").toLowerCase();

    if (excludeManager && role === 'manager') return <Navigate to="/dashboard" replace />;
    if (role === 'manager' && !excludeManager) return children;

    if (allowed && allowed.length > 0) {
      const allowedLower = allowed.map(p => p.toLowerCase());
      if (!allowedLower.includes(position)) {
        let redirectPath = "/login";
        if (position === 'receptionist') redirectPath = "/room-calendar";
        else if (position === 'technician' || position === 'housekeeper') redirectPath = "/my-work";
        else if (position === 'accountant') redirectPath = "/invoices";
        else redirectPath = "/profile";

        return <Navigate to={redirectPath} replace />;
      }
    }

    return children;
  };
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

    const getHomePath = () => {
      if (!user) return "/login";
      const position = (user.position || "").toLowerCase();
      if (user.role === 'manager') return "/dashboard";
      if (position === 'receptionist') return "/room-calendar";
      if (position === 'technician' || position === 'housekeeper') return "/my-work";
      if (position === 'accountant') return "/invoices";
      return "/profile";
    };
  return (
    <Routes>
     <Route path="/" element={<Navigate to={getHomePath()} replace />} />
           <Route path="/login" element={user ? <Navigate to={getHomePath()} replace /> : <LoginPage />} />

           <Route path="/profile" element={
             <ProtectedRoute allowed={[]}> <ProfilePage /> </ProtectedRoute>
           } />

           <Route path="/dashboard" element={
             <ProtectedRoute allowed={['manager']}> <Dashboard /> </ProtectedRoute>
           } />
      <Route path="/employees" element={
        <ProtectedRoute allowed={[]}> <EmployeePage /> </ProtectedRoute>
      } />
      <Route path="/earnings" element={
        <ProtectedRoute allowed={[]} excludeManager={true}> <EarningsPage /> </ProtectedRoute>
      } />

      {/* LỄ TÂN */}
      <Route path="/room-calendar" element={
        <ProtectedRoute allowed={['receptionist']}> <RoomCalendar /> </ProtectedRoute>
      } />
      <Route path="/booking-management" element={
        <ProtectedRoute allowed={['receptionist']}> <BookingList /> </ProtectedRoute>
      } />
      <Route path="/room-types" element={
        <ProtectedRoute allowed={['receptionist', 'housekeeper']}> <RoomPage /> </ProtectedRoute>
      } />
      <Route path="/customers" element={
        <ProtectedRoute allowed={['receptionist', 'customer_service']}> <CustomerPage /> </ProtectedRoute>
      } />
      <Route path="/qr-scanner" element={
        <ProtectedRoute allowed={['receptionist']}> <QrScannerPage /> </ProtectedRoute>
      } />

      {/* KỸ THUẬT */}
      <Route path="/equipment" element={
        <ProtectedRoute allowed={['technician']}> <EquipmentPage /> </ProtectedRoute>
      } />
      <Route path="/my-work" element={
        <ProtectedRoute allowed={['technician', 'housekeeper']}>
          <WorkPageRouter />
        </ProtectedRoute>
      } />
      <Route path="/incidents" element={
        <ProtectedRoute allowed={['technician', 'receptionist', 'housekeeper']}> <IncidentPage /> </ProtectedRoute>
      } />

      {/* DỊCH VỤ & HÓA ĐƠN */}
      <Route path="/service" element={
        <ProtectedRoute allowed={['receptionist', 'housekeeper']}> <ServicePage /> </ProtectedRoute>
      } />
      <Route path="/invoices" element={
        <ProtectedRoute allowed={['receptionist', 'accountant']}> <ReceiptPage /> </ProtectedRoute>
      } />

      {/* THỐNG KÊ */}
       <Route path="/reports" element={
        <ProtectedRoute allowed={['accountant']}> <StatisticsPage /> </ProtectedRoute>
      } />

      {/* QUẢN LÝ CÔNG VIỆC (ADMIN) */}
      <Route path="/all-tasks" element={
        <ProtectedRoute allowed={[]}> <AllTasksPage /> </ProtectedRoute>
      } />

       {/* CÁC TRANG CHUNG */}
       <Route path="/promotions" element={<ProtectedRoute allowed={['receptionist', 'customer_service']}><DiscountPage /></ProtectedRoute>} />

       <Route path="/payment/success" element={<PaymentResultPage />} />
       <Route path="/payment/cancel" element={<PaymentResultPage />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}