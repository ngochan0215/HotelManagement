import React, { useEffect, useState, useMemo } from "react";
import { equipmentApi } from "../../api/equipmentApi.js";
import {
  FiCheckCircle, FiPlus, FiArrowRight, FiArrowLeft, FiEdit, FiEye, FiTrash2,
  FiChevronLeft, FiChevronRight
} from "react-icons/fi";
import AddInstallTicketModal from "../components/addInstallTicketModal.jsx";
import AddImportTicketModal from "../components/addImportTicketModal.jsx";
import UpdateInstallTicketModal from "../components/updateInstallTicketModal.jsx";
import InstallTicketDetailModal from "../components/installTicketDetailModal.jsx";
import ImportTicketDetailModal from "../components/importTicketDetailModal.jsx";
import Pagination from "../../../components/pagination.jsx";

export default function EquipmentTicketTab() {
  const [imports, setImports] = useState([]);
  const [installs, setInstalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showUpdateImportModal, setShowUpdateImportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImportDetailModal, setShowImportDetailModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedImportTicket, setSelectedImportTicket] = useState(null);
  
  // Pagination states
  const [installsPage, setInstallsPage] = useState(1);
  const [importsPage, setImportsPage] = useState(1);
  const itemsPerPage = 5;
  
  // Filter states
  const [installsFilterStatus, setInstallsFilterStatus] = useState("all");
  const [importsFilterStatus, setImportsFilterStatus] = useState("all");

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const [resImport, resInstall] = await Promise.all([
        equipmentApi.getAllImportTickets(),
        equipmentApi.getAllInstallTickets()
      ]);

      console.log("install tickets: ", resInstall);
      console.log("import tickets: ", resImport);

      setImports(resImport.tickets || []);
      setInstalls(resInstall.installs || []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => { fetchTickets(); }, []);

  const indexOfLastInstall = installsPage * itemsPerPage;
  const indexOfFirstInstall = indexOfLastInstall - itemsPerPage;
  const currentInstalls = installs.slice(indexOfFirstInstall, indexOfLastInstall);
  const totalInstallPages = Math.ceil(installs.length / itemsPerPage);

  const indexOfLastImport = importsPage * itemsPerPage;
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
                <FiChevronRight/>
            </button>
        </div>
    );
  };

  const handleConfirmImport = async (id) => {
    if (!window.confirm("Xác nhận nhập kho?")) return;
    try {
      await equipmentApi.confirmImportTicket(id);
      alert("Thành công!"); fetchTickets();
    } catch (err) { alert("Lỗi: " + err.message); }
  };

  const handleDeleteImport = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy phiếu nhập này?")) return;
    try {
      await equipmentApi.deleteImportTicket(id);
      alert("Đã hủy phiếu nhập thành công!"); 
      fetchTickets();
    } catch (err) { 
      alert("Lỗi: " + (err.response?.data?.message || err.message)); 
    }
  };

  // Kiểm tra xem có thể cập nhật/hủy phiếu nhập không (chưa đến ngày nhập)
  const canUpdateOrDeleteImport = (ticket) => {
    if (ticket.status === 'completed' || ticket.status === 'expired') {
      return false;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const importDate = new Date(ticket.import_date);
    importDate.setHours(0, 0, 0, 0);
    
    // Chỉ cho phép update/delete nếu chưa đến ngày nhập
    return importDate > today;
  };

  const handleConfirmInstall = async (id) => {
    if (!window.confirm("Xác nhận hoàn tất phiếu này?")) return;
    try {
      await equipmentApi.confirmInstallTicket(id);
      alert("Thành công!"); 
      fetchTickets();
    } catch (err) 
    { 
        alert("Lỗi: " + err.message); 
    }
  };

  const handleDeleteInstall = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy phiếu này?")) return;
    try {
      await equipmentApi.deleteInstallTicket(id);
      alert("Đã hủy phiếu thành công!"); 
      fetchTickets();
    } catch (err) { 
      alert("Lỗi: " + (err.response?.data?.message || err.message)); 
    }
  };

  // Kiểm tra xem có thể cập nhật phiếu không (trước ngày lắp đặt/tháo dỡ)
  const canUpdateTicket = (ticket) => {
    // Nếu đã completed hoặc expired → không cho cập nhật
    if (ticket.status === 'completed' || ticket.status === 'expired') {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const installDate = new Date(ticket.install_date);
    installDate.setHours(0, 0, 0, 0);
    
    // Chỉ cho phép cập nhật nếu chưa đến ngày lắp đặt/tháo dỡ
    return installDate > today;
  };

  // Kiểm tra xem có thể hủy phiếu không
  const canCancelTicket = (ticket) => {
    // Nếu đã completed hoặc expired → không cho hủy
    if (ticket.status === 'completed' || ticket.status === 'expired') {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const installDate = new Date(ticket.install_date);
    installDate.setHours(0, 0, 0, 0);
    
    const isToday = installDate.getTime() === today.getTime();
    
    // Nếu phiếu không phải hôm nay → cho hủy (dù có gán nhân viên hay không)
    if (!isToday) {
      return true;
    }
    
    // Nếu phiếu hôm nay → chỉ cho hủy nếu chưa started_at (nhân viên chưa nhận việc)
    if (isToday && !ticket.started_at) {
      return true;
    }
    
    return false;
  };

  const isInstallType = (ticket) => {
      if (ticket.type === 'install') return true;
      if (ticket.type === 'uninstall') return false;
      return !!ticket.room_id;
  };

  const renderStatus = (status, completed_at) => {
    const config = {
      pending: { label: "Chờ xử lý", class: "bg-gray-100 text-gray-500" },
      assigned: { label: "Đã phân việc", class: "bg-orange-50 text-orage-700" },
      waiting_confirm: { 
        label: completed_at ? "Chờ admin xác nhận" : "Đang thực hiện", 
        class: completed_at 
          ? "bg-yellow-100 text-yellow-800 animate-pulse border border-yellow-300" 
          : "bg-blue-100 text-blue-800" 
      },
      completed: { label: "Hoàn tất", class: "bg-green-100 text-green-700" },
      expired: { label: "Đã hủy", class: "bg-red-100 text-red-700" },
    };
    const s = config[status] || config.pending;
    return <span className={`px-2 py-1 rounded text-xs font-medium ${s.class}`}>{s.label}</span>;
  };

  const renderImportTicketStatus = (status, completed_at) => {
    const config = {
      pending: { label: "Chờ đến ngày nhập", class: "bg-gray-100 text-gray-500" },
      waiting_confirm: { label: "Chờ admin xác nhận", class: "bg-yellow-100 text-yellow-800" },
      completed: { label: "Hoàn tất", class: "bg-green-100 text-green-700" },
      expired: { label: "Hết hạn", class: "bg-red-100 text-red-700" },
    };
    const s = config[status] || config.pending;
    return <span className={`px-2 py-1 rounded text-xs font-medium ${s.class}`}>{s.label}</span>;
  };

  // Filter and pagination calculations
  const filteredInstalls = useMemo(() => {
    if (installsFilterStatus === "all") return installs;
    return installs.filter(item => {
      if (installsFilterStatus === "waiting_confirm") {
        return item.status === "waiting_confirm";
      }
      return item.status === installsFilterStatus;
    });
  }, [installs, installsFilterStatus]);

  const filteredImports = useMemo(() => {
    if (importsFilterStatus === "all") return imports;
    return imports.filter(item => item.status === importsFilterStatus);
  }, [imports, importsFilterStatus]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setInstallsPage(1);
  }, [installsFilterStatus]);

  useEffect(() => {
    setImportsPage(1);
  }, [importsFilterStatus]);

  const installsPagination = useMemo(() => {
    const totalPages = Math.ceil(filteredInstalls.length / itemsPerPage);
    const startIndex = (installsPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedInstalls = filteredInstalls.slice(startIndex, endIndex);
    
    return {
      data: paginatedInstalls,
      currentPage: installsPage,
      totalPages: totalPages || 1,
      totalItems: filteredInstalls.length
    };
  }, [filteredInstalls, installsPage, itemsPerPage]);

  const importsPagination = useMemo(() => {
    const totalPages = Math.ceil(filteredImports.length / itemsPerPage);
    const startIndex = (importsPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedImports = filteredImports.slice(startIndex, endIndex);
    
    return {
      data: paginatedImports,
      currentPage: importsPage,
      totalPages: totalPages || 1,
      totalItems: filteredImports.length
    };
  }, [filteredImports, importsPage, itemsPerPage]);

  return (
    <div className="space-y-8 pb-10 animate-fade-in relative">
      {showInstallModal && <AddInstallTicketModal onClose={() => setShowInstallModal(false)} onSuccess={fetchTickets} />}
      {showImportModal && <AddImportTicketModal onClose={() => setShowImportModal(false)} onSuccess={fetchTickets} />}
      {showUpdateModal && selectedTicket && (
        <UpdateInstallTicketModal 
          ticket={selectedTicket}
          onClose={() => {
            setShowUpdateModal(false);
            setSelectedTicket(null);
          }} 
          onSuccess={fetchTickets} 
        />
      )}
      {showDetailModal && selectedTicket && (
        <InstallTicketDetailModal 
          ticket={selectedTicket}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedTicket(null);
          }} 
        />
      )}
      {showImportDetailModal && selectedImportTicket && (
        <ImportTicketDetailModal 
          ticket={selectedImportTicket}
          onClose={() => {
            setShowImportDetailModal(false);
            setSelectedImportTicket(null);
          }} 
        />
      )}
      {showUpdateImportModal && selectedImportTicket && (
        <AddImportTicketModal 
          ticket={selectedImportTicket}
          onClose={() => {
            setShowUpdateImportModal(false);
            setSelectedImportTicket(null);
          }} 
          onSuccess={fetchTickets}
        />
      )}
      {showUpdateImportModal && selectedImportTicket && (
        <AddImportTicketModal 
          ticket={selectedImportTicket}
          onClose={() => {
            setShowUpdateImportModal(false);
            setSelectedImportTicket(null);
          }} 
          onSuccess={fetchTickets}
        />
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">Quản lý Lắp Đặt & Tháo Dỡ</h2>
              <button onClick={() => setShowInstallModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-indigo-700">
                  <FiPlus /> Tạo phiếu
              </button>
          </div>
          
          {/* Filter buttons */}
          <div className="flex flex-wrap gap-2 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
              <button 
                  onClick={() => setInstallsFilterStatus("all")} 
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                      installsFilterStatus === "all" 
                          ? "bg-white text-indigo-600 shadow-sm" 
                          : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                  Tất cả
              </button>
              <button 
                  onClick={() => setInstallsFilterStatus("pending")} 
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                      installsFilterStatus === "pending" 
                          ? "bg-white text-indigo-600 shadow-sm" 
                          : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                  Chờ xử lý
              </button>
              <button 
                  onClick={() => setInstallsFilterStatus("assigned")} 
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                      installsFilterStatus === "assigned" 
                          ? "bg-white text-indigo-600 shadow-sm" 
                          : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                  Đã phân việc
              </button>
              <button 
                  onClick={() => setInstallsFilterStatus("waiting_confirm")} 
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                      installsFilterStatus === "waiting_confirm" 
                          ? "bg-white text-indigo-600 shadow-sm" 
                          : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                  Đang thực hiện / Chờ xác nhận
              </button>
              <button 
                  onClick={() => setInstallsFilterStatus("completed")} 
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                      installsFilterStatus === "completed" 
                          ? "bg-white text-indigo-600 shadow-sm" 
                          : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                  Hoàn tất
              </button>
              <button 
                  onClick={() => setInstallsFilterStatus("expired")} 
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                      installsFilterStatus === "expired" 
                          ? "bg-white text-indigo-600 shadow-sm" 
                          : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                  Đã hủy
              </button>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 uppercase text-xs text-gray-600 border-b">
                      <tr>
                          <th className="px-4 py-3">Loại phiếu</th>
                          <th className="px-4 py-3">Phòng</th>
                          <th className="px-4 py-3">Ngày dự kiến</th>
                          <th className="px-4 py-3">Nhân viên được gán</th>
                          <th className="px-4 py-3 text-center">Trạng thái</th>
                          <th className="px-4 py-3 text-right">Hành động</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {installsPagination.data.map((item) => {
                          const isInstall = isInstallType(item);
                          const roomDisplay = item.room_id ? `P.${item.room_info?.room_number}` : "---";

                          return (
                          <tr key={item._id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                  {isInstall ? (
                                      <span className="inline-flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-xs font-bold border border-indigo-100">
                                          <FiArrowRight/> Lắp đặt
                                      </span>
                                  ) : (
                                      <span className="inline-flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded text-xs font-bold border border-orange-100">
                                          <FiArrowLeft/> Tháo dỡ
                                      </span>
                                  )}
                              </td>

                              <td className="px-4 py-3 text-base">
                                  <span className={`font-bold ${isInstall ? 'text-indigo-700' : 'text-orange-700'}`}>
                                      {roomDisplay}
                                  </span>
                              </td>

                              <td className="px-4 py-3">{new Date(item.install_date).toLocaleDateString('vi-VN')}</td>
                              <td className="px-4 py-3">
                                {item.handled_by ? (
                                  <span className="text-sm font-medium text-gray-900">
                                    {item.handler_info.full_name || 'N/A'}
                                  </span>
                                ) : (
                                  <span className="text-sm text-gray-400 italic">Chưa phân công</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">{renderStatus(item.status, item.completed_at)}</td>
                              <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                      <button 
                                          onClick={() => {
                                              setSelectedTicket(item);
                                              setShowDetailModal(true);
                                          }}
                                          className="text-blue-600 hover:text-blue-800 font-bold text-xs border border-blue-200 px-2 py-1 rounded hover:bg-blue-50 transition flex items-center gap-1"
                                      >
                                          <FiEye className="w-3 h-3" />
                                          Chi tiết
                                      </button>
                                      
                                      {canUpdateTicket(item) && (
                                          <button 
                                              onClick={() => {
                                                  setSelectedTicket(item);
                                                  setShowUpdateModal(true);
                                              }}
                                              className="text-indigo-600 hover:text-indigo-800 font-bold text-xs border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-50 transition flex items-center gap-1"
                                          >
                                              <FiEdit className="w-3 h-3" />
                                              Cập nhật
                                          </button>
                                      )}
                                      
                                      {item.status === 'waiting_confirm' && item.completed_at && (
                                          <button 
                                              onClick={() => handleConfirmInstall(item._id)} 
                                              className="text-green-600 hover:text-green-800 font-bold text-xs border border-green-200 px-2 py-1 rounded hover:bg-green-50 transition"
                                          >
                                              Xác nhận
                                          </button>
                                      )}
                                      
                                      {canCancelTicket(item) && (
                                          <button 
                                              onClick={() => handleDeleteInstall(item._id)} 
                                              className="text-red-600 hover:text-red-800 font-bold text-xs border border-red-200 px-2 py-1 rounded hover:bg-red-50 transition flex items-center gap-1"
                                          >
                                              <FiTrash2 className="w-3 h-3" />
                                              Hủy
                                          </button>
                                      )}
                                  </div>
                              </td>
                          </tr>
                      )})}
                      {filteredInstalls.length === 0 && <tr><td colSpan="6" className="text-center py-6 text-gray-400">Chưa có dữ liệu</td></tr>}
                  </tbody>
              </table>
          </div>
          {filteredInstalls.length > itemsPerPage && (
            <Pagination
              currentPage={installsPagination.currentPage}
              totalPages={installsPagination.totalPages}
              totalItems={installsPagination.totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setInstallsPage}
            />
          )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">Lịch sử Nhập Kho</h2>
            <button onClick={() => setShowImportModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700">
                <FiPlus /> Tạo phiếu nhập
            </button>
        </div>
        
        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
            <button 
                onClick={() => setImportsFilterStatus("all")} 
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                    importsFilterStatus === "all" 
                        ? "bg-white text-indigo-600 shadow-sm" 
                        : "text-gray-500 hover:text-gray-700"
                }`}
            >
                Tất cả
            </button>
            <button 
                onClick={() => setImportsFilterStatus("pending")} 
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                    importsFilterStatus === "pending" 
                        ? "bg-white text-indigo-600 shadow-sm" 
                        : "text-gray-500 hover:text-gray-700"
                }`}
            >
                Chờ xử lý
            </button>
            <button 
                onClick={() => setImportsFilterStatus("waiting_confirm")} 
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                    importsFilterStatus === "waiting_confirm" 
                        ? "bg-white text-indigo-600 shadow-sm" 
                        : "text-gray-500 hover:text-gray-700"
                }`}
            >
                Chờ xác nhận
            </button>
            <button 
                onClick={() => setImportsFilterStatus("completed")} 
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                    importsFilterStatus === "completed" 
                        ? "bg-white text-indigo-600 shadow-sm" 
                        : "text-gray-500 hover:text-gray-700"
                }`}
            >
                Hoàn tất
            </button>
            <button 
                onClick={() => setImportsFilterStatus("expired")} 
                className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                    importsFilterStatus === "expired" 
                        ? "bg-white text-indigo-600 shadow-sm" 
                        : "text-gray-500 hover:text-gray-700"
                }`}
            >
                Đã hủy
            </button>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 uppercase text-xs text-gray-600 border-b">
                    <tr>
                        <th className="px-4 py-3">Mã phiếu</th>
                        <th className="px-4 py-3">Ngày nhập</th>
                        <th className="px-4 py-3">Chi tiết</th>
                        <th className="px-4 py-3 text-center">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Hành động</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {importsPagination.data.map((item) => (
                        <tr key={item._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs">#{item._id.slice(-6).toUpperCase()}</td>
                            <td className="px-4 py-3">{new Date(item.import_date).toLocaleDateString('vi-VN')}</td>
                            <td className="px-4 py-3 text-xs max-w-[200px] truncate">
                                {item.import_details?.map(d => `${d.category_id?.name} (x${d.import_quantity})`).join(", ")}
                            </td>
                            <td className="px-4 py-3 text-center">{renderImportTicketStatus(item.status)}</td>
                            <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button 
                                        onClick={() => {
                                            setSelectedImportTicket(item);
                                            setShowImportDetailModal(true);
                                        }}
                                        className="text-blue-600 hover:text-blue-800 font-bold text-xs border border-blue-200 px-2 py-1 rounded hover:bg-blue-50 transition flex items-center gap-1"
                                    >
                                        <FiEye className="w-3 h-3" />
                                        Chi tiết
                                    </button>
                                    {item.status === 'waiting_confirm' && (
                                        <button onClick={() => handleConfirmImport(item._id)} className="text-green-600 hover:text-green-800 font-bold text-xs border border-green-200 px-2 py-1 rounded hover:bg-green-50">
                                            Nhập kho
                                        </button>
                                    )}
                                    
                                    {canUpdateOrDeleteImport(item) && (
                                        <>
                                            <button 
                                                onClick={() => {
                                                    setSelectedImportTicket(item);
                                                    setShowUpdateImportModal(true);
                                                }}
                                                className="text-indigo-600 hover:text-indigo-800 font-bold text-xs border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-50 transition flex items-center gap-1"
                                            >
                                                <FiEdit className="w-3 h-3" />
                                                Cập nhật
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteImport(item._id)} 
                                                className="text-red-600 hover:text-red-800 font-bold text-xs border border-red-200 px-2 py-1 rounded hover:bg-red-50 transition flex items-center gap-1"
                                            >
                                                <FiTrash2 className="w-3 h-3" />
                                                Hủy
                                            </button>
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredImports.length === 0 && <tr><td colSpan="5" className="text-center py-6 text-gray-400">Chưa có dữ liệu</td></tr>}
                </tbody>
            </table>
        </div>
        {filteredImports.length > itemsPerPage && (
          <Pagination
            currentPage={importsPagination.currentPage}
            totalPages={importsPagination.totalPages}
            totalItems={importsPagination.totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setImportsPage}
          />
        )}
      </div>
    </div>
  );
}