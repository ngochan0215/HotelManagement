import React, { useEffect, useState } from "react";
import { serviceApi } from "../../api/serviceApi.js";
import {
  FiCheckCircle, FiPlus, FiClock, FiTruck, FiUser, FiEye, FiEdit, FiXCircle,
  FiChevronLeft, FiChevronRight
} from "react-icons/fi";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import AddImportTicketModal from "../components/addImportTicketModal.jsx";
import AddServiceUsageModal from "../components/addServiceUsageModal.jsx";
import ServiceUsageDetailModal from "../components/serviceUsageDetailModal.jsx";
import UpdateServiceUsageModal from "../components/updateServiceUsageModal.jsx";

export default function ServiceTicketTab() {
  const { user } = useAuth();
  const [imports, setImports] = useState([]);
  const [usages, setUsages] = useState([]);
  const [loading, setLoading] = useState(false);

  const [usagePage, setUsagePage] = useState(1);
  const [importPage, setImportPage] = useState(1);
  const itemsPerPage = 5;

  const [showImportModal, setShowImportModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedUsageId, setSelectedUsageId] = useState(null);
  const [editingUsageId, setEditingUsageId] = useState(null);

  const isManager = (user?.role || localStorage.getItem("role") || "").toLowerCase() === "manager";

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const promises = [serviceApi.getAllServiceUsage()];
      if (isManager) {
          promises.push(serviceApi.getAllGoodTickets());
      }

      const results = await Promise.all(promises);
      const resUsage = results[0];

      setUsages(resUsage.data || []);

      if (isManager && results[1]) {
          const resImport = results[1];
          setImports(resImport.tickets_details || resImport.tickets || []);
      }

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const indexOfLastUsage = usagePage * itemsPerPage;
  const indexOfFirstUsage = indexOfLastUsage - itemsPerPage;
  const currentUsages = usages.slice(indexOfFirstUsage, indexOfLastUsage);
  const totalUsagePages = Math.ceil(usages.length / itemsPerPage);

  const indexOfLastImport = importPage * itemsPerPage;
  const indexOfFirstImport = indexOfLastImport - itemsPerPage;
  const currentImports = imports.slice(indexOfFirstImport, indexOfLastImport);
  const totalImportPages = Math.ceil(imports.length / itemsPerPage);

  const renderPagination = (currentPage, totalPages, setPage) => {
    if (totalPages <= 1) return null;

    const pages = [];
    const delta = 2;
    const left = currentPage - delta;
    const right = currentPage + delta;
    const range = [];
    const rangeWithDots = [];

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= left && i <= right)) {
            range.push(i);
        }
    }

    let l;
    for (let i of range) {
        if (l) {
            if (i - l === 2) rangeWithDots.push(l + 1);
            else if (i - l !== 1) rangeWithDots.push('...');
        }
        rangeWithDots.push(i);
        l = i;
    }

    return (
        <div className="flex gap-2">
            <button
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <FiChevronLeft />
            </button>
            {rangeWithDots.map((page, index) => (
                page === '...' ? (
                    <span key={`dots-${index}`} className="px-2 py-1 text-gray-400 self-center">...</span>
                ) : (
                    <button
                        key={page}
                        onClick={() => setPage(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-bold transition ${
                            currentPage === page
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                            : "border hover:bg-gray-50 text-gray-600"
                        }`}
                    >
                        {page}
                    </button>
                )
            ))}
            <button
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <FiChevronRight />
            </button>
        </div>
    );
  };

  // --- ACTIONS ---
  const handleConfirmImport = async (id) => {
    if (!window.confirm("Xác nhận nhập kho? Số lượng tồn kho sẽ được cập nhật.")) return;
    try {
      await serviceApi.confirmGoodTicket(id);
      alert("Đã nhập kho thành công!");
      fetchTickets();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    }
  };

  const handleConfirmUsage = async (id) => {
      if (!window.confirm("Xác nhận toàn bộ phiếu sử dụng dịch vụ?")) return;
      try {
          await serviceApi.confirmServiceUsage(id);
          alert("Đã xác nhận phiếu sử dụng dịch vụ!");
          fetchTickets();
      } catch (err) {
          alert("Lỗi: " + (err.response?.data?.message || err.message));
      }
  };

  const handleCancelUsage = async (id) => {
      if (!window.confirm("Hủy toàn bộ phiếu sử dụng dịch vụ?")) return;
      try {
          await serviceApi.cancelServiceUsage(id);
          alert("Đã hủy phiếu sử dụng dịch vụ!");
          fetchTickets();
      } catch (err) {
          alert("Lỗi: " + (err.response?.data?.message || err.message));
      }
  };

  const renderStatus = (status) => {
    const config = {
      pending: { label: "Đang chờ đến ngày nhập", class: "bg-blue-100 text-blue-700 border border-blue-200" },
      waiting_confirm: { label: "Đã đến ngày - Chờ xác nhận nhập", class: "bg-yellow-100 text-yellow-800 font-bold border border-yellow-300" },
      completed: { label: "Hoàn thành", class: "bg-green-100 text-green-700 border border-green-200" },
      expired: { label: "Đã hết hạn", class: "bg-red-100 text-red-700 border border-red-200" },
      cancelled: { label: "Đã hủy", class: "bg-red-100 text-red-700 border border-red-200" },
    };
    const s = config[status] || config.pending;
    return <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${s.class}`}>{s.label}</span>;
  };

  const renderUsageStatus = (status) => {
    const config = {
      pending: { label: "Chờ ngày sử dụng", class: "bg-blue-100 text-blue-700 border border-blue-200" },
      waiting_confirm: { label: "Xác nhận hoàn thành", class: "bg-yellow-100 text-yellow-800 font-bold border border-yellow-300" },
      completed: { label: "Hoàn thành", class: "bg-green-100 text-green-700 border border-green-200" },
      expired: { label: "Đã hết hạn", class: "bg-red-100 text-red-700 border border-red-200" },
      cancelled: { label: "Đã hủy", class: "bg-red-100 text-red-700 border border-red-200" },
    };
    const s = config[status] || config.pending;
    return <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${s.class}`}>{s.label}</span>;
  };

  return (
    <div className="space-y-8 pb-10 animate-fade-in relative">

      {showImportModal && isManager && <AddImportTicketModal onClose={() => setShowImportModal(false)} onSuccess={fetchTickets} />}
      {showUsageModal && <AddServiceUsageModal onClose={() => setShowUsageModal(false)} onSuccess={fetchTickets} />}
      {selectedUsageId && <ServiceUsageDetailModal usageId={selectedUsageId} onClose={() => setSelectedUsageId(null)} />}
      {editingUsageId && <UpdateServiceUsageModal usageId={editingUsageId} onClose={() => setEditingUsageId(null)} onSuccess={fetchTickets} />}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                 Lịch sử sử dụng dịch vụ
            </h2>
            <button
                onClick={() => setShowUsageModal(true)}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-orange-700 shadow-sm"
            >
                <FiPlus /> Thêm dịch vụ
            </button>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 uppercase text-xs text-gray-600 border-b">
                    <tr>
                        <th className="px-4 py-3">Khách hàng</th>
                        <th className="px-4 py-3">Phòng / Booking</th>
                        <th className="px-4 py-3">Người tạo</th>
                        <th className="px-4 py-3 text-right">Tổng tiền</th>
                        <th className="px-4 py-3 text-center">Trạng thái</th>
                        <th className="px-4 py-3 text-center">Hành động</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {currentUsages.map((item) => (
                        <tr key={item._id} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-3 font-bold text-gray-800">
                                <div className="flex items-center gap-2">
                                <FiUser className="text-gray-400"/>
                                {item.customer_id?.full_name || "Khách lẻ"}
                                </div>
                            </td>

                            <td className="px-4 py-3 text-gray-600">
                                {item.booking_id ? (
                                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                                    Theo Booking
                                </span>
                                ) : "Vãng lai"}
                            </td>

                            <td className="px-4 py-3">
                                {item.employee_id?.full_name || "System"}
                            </td>

                            <td className="px-4 py-3 text-right font-medium text-indigo-600">
                                {item.total_fee?.toLocaleString()} đ
                            </td>

                            <td className="px-4 py-3 text-center">
                                {renderUsageStatus(item.status)}
                            </td>

                            <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setSelectedUsageId(item._id)}
                                        className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-blue-700 shadow-sm"
                                        title="Xem chi tiết"
                                    >
                                        <FiEye /> Chi tiết
                                    </button>
                                    {item.status === "pending" && (
                                        <>
                                            <button
                                                onClick={() => setEditingUsageId(item._id)}
                                                className="inline-flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-indigo-700 shadow-sm"
                                                title="Cập nhật phiếu"
                                            >
                                                <FiEdit /> Cập nhật
                                            </button>
                                            <button
                                                onClick={() => handleCancelUsage(item._id)}
                                                className="inline-flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-red-700 shadow-sm"
                                                title="Hủy phiếu"
                                            >
                                                <FiXCircle /> Hủy
                                            </button>
                                        </>
                                    )}
                                    {item.status === "waiting_confirm" && (
                                        <>
                                            <button
                                                onClick={() => handleConfirmUsage(item._id)}
                                                className="inline-flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-green-700 shadow-sm"
                                                title="Xác nhận phiếu"
                                            >
                                                <FiCheckCircle /> Xác nhận
                                            </button>
                                            <button
                                                onClick={() => handleCancelUsage(item._id)}
                                                className="inline-flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-red-700 shadow-sm"
                                                title="Hủy phiếu"
                                            >
                                                <FiXCircle /> Hủy
                                            </button>
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                    {usages.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-gray-400 italic">Chưa có dữ liệu sử dụng dịch vụ</td></tr>}
                </tbody>
            </table>
        </div>

        {usages.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2">
                <div className="text-sm text-gray-500">
                    Hiển thị <b>{indexOfFirstUsage + 1}</b> - <b>{Math.min(indexOfLastUsage, usages.length)}</b> trong tổng <b>{usages.length}</b>
                </div>
                {renderPagination(usagePage, totalUsagePages, setUsagePage)}
            </div>
        )}
      </div>

      {isManager && (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                 Quản lý Nhập Kho
            </h2>
            <button
                onClick={() => setShowImportModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 shadow-sm"
            >
                <FiPlus /> Tạo phiếu nhập
            </button>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 uppercase text-xs text-gray-600 border-b">
                    <tr>
                        <th className="px-4 py-3">Mã phiếu</th>
                        <th className="px-4 py-3">Ngày nhập</th>
                        <th className="px-4 py-3">Chi tiết nhập</th>
                        <th className="px-4 py-3 text-center">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Hành động</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {currentImports.map((item) => (
                        <tr key={item._id} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-3 font-mono text-xs font-bold text-gray-500">
                                #{item._id.slice(-6).toUpperCase()}
                            </td>
                            <td className="px-4 py-3">
                                {new Date(item.import_date).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 max-w-[300px]">
                                {item.details && item.details.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {item.details.map((d, idx) => (
                                            <span key={idx} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                                                {d.service_id?.name} (x{d.import_quantity})
                                            </span>
                                        ))}
                                    </div>
                                ) : "---"}
                            </td>
                            <td className="px-4 py-3 text-center">{renderStatus(item.status)}</td>
                            <td className="px-4 py-3 text-right">
                                {item.status === 'waiting_confirm' ? (
                                    <button
                                        onClick={() => handleConfirmImport(item._id)}
                                        className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-blue-700 shadow-sm ml-auto"
                                        title="Xác nhận nhập kho"
                                    >
                                        <FiCheckCircle /> Nhập kho
                                    </button>
                                ) : item.status === 'completed' ? (
                                    <span className="text-gray-300 text-xs italic">---</span>
                                ) : item.status === 'expired' || item.status === 'cancelled' ? (
                                    <span className="text-red-300 text-xs italic">Đã hết hạn</span>
                                ) : (
                                    <span className="text-gray-300 text-xs italic">Chưa đến ngày nhập</span>
                                )}
                            </td>
                        </tr>
                    ))}
                     {imports.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-gray-400 italic">Chưa có phiếu nhập hàng</td></tr>}
                </tbody>
            </table>
        </div>

        {imports.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2">
                <div className="text-sm text-gray-500">
                    Hiển thị <b>{indexOfFirstImport + 1}</b> - <b>{Math.min(indexOfLastImport, imports.length)}</b> trong tổng <b>{imports.length}</b>
                </div>
                {renderPagination(importPage, totalImportPages, setImportPage)}
            </div>
        )}
      </div>
      )}
    </div>
  );
}