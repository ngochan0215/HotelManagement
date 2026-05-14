import React, { useState, useEffect, useMemo } from "react";
import {
  FiEdit, FiTrash2, FiX, FiSearch, FiFilter, FiList, FiChevronDown,
  FiChevronLeft, FiChevronRight
} from "react-icons/fi";
import { equipmentApi } from "../../api/equipmentApi.js";
import ConfirmModal from "../../../components/confirmModal.jsx";
import { StatusPill } from "../../../components/ui/label.jsx";
import Pagination from "../../../components/pagination.jsx";

const STATUS_MAP = {
  "in-stock": { label: "Trong kho", color: "gray", icon: "info" },
  "installing": { label: "Đang lắp", color: "blue", icon: "wait" },
  "removing": { label: "Đang tháo", color: "orange", icon: "wait" },
  "in-use": { label: "Đang dùng", color: "indigo", icon: "success" },
  "maintenance": { label: "Bảo trì", color: "yellow", icon: "warning" },
  "lost": { label: "Thất lạc", color: "red", icon: "error" },
  "disposed": { label: "Đã hủy", color: "red", icon: "error" }
};

const ALLOWED_UPDATE_STATUSES = ["maintenance", "lost", "disposed", "removing"];

export default function EquipmentListTab() {
  const [equipments, setEquipments] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const [editingItem, setEditingItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({ status: "", note: "", room_id: "" });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, sortOrder]);

  const loadData = async () => {
    try {
      const res = await equipmentApi.getAllEquipments({ limit: 9999 });
      setEquipments((res && Array.isArray(res.data)) ? res.data : []);
    } catch (error) { console.error(error); }
  };

  const filteredEquipments = useMemo(() => {
    let result = [...equipments];

    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        result = result.filter(item => {
            const name = item.category_id?.name?.toLowerCase() || "";
            const code = (item.code || item._id.slice(-6)).toLowerCase();
            const room = item.room_info?.room_number?.toString().toLowerCase() || "";
            return name.includes(lowerTerm) || code.includes(lowerTerm) || room.includes(lowerTerm);
        });
    }

    if (filterStatus !== 'all') {
        result = result.filter(item => item.status === filterStatus);
    }

    result.sort((a, b) => {
        if (sortOrder === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        if (sortOrder === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        if (sortOrder === 'a-z') return (a.category_id?.name || "").localeCompare(b.category_id?.name || "");
        return 0;
    });

    return result;
  }, [equipments, searchTerm, filterStatus, sortOrder]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentEquipments = filteredEquipments.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredEquipments.length / itemsPerPage);

  const handlePageChange = (page) => setCurrentPage(page);

  const renderPaginationButtons = () => {
    const pages = [];
    if (totalPages <= 1) return null;

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
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return (
      <div className="flex gap-2">
        <button
            onClick={() => handlePageChange(currentPage - 1)}
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
                onClick={() => handlePageChange(page)}
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
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <FiChevronRight />
        </button>
      </div>
    );
  };
  // -------------------------

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      if (['lost', 'disposed', 'in-stock'].includes(payload.status)) {
          payload.room_id = null;
      }

      await equipmentApi.updateEquipment(editingItem._id, payload);
      setIsModalOpen(false);
      loadData();
      alert("Cập nhật thành công!");
    } catch (error) {
      alert("Lỗi: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async () => {
    try {
      await equipmentApi.deleteEquipment(confirmDelete.id);
      loadData();
      setConfirmDelete({ open: false, id: null });
      alert("Đã xóa thiết bị thành công.");
    } catch (error) {
      alert("Lỗi xóa: " + (error.response?.data?.message || error.message));
      setConfirmDelete({ open: false, id: null });
    }
  };

  const openEdit = (item) => {
      setEditingItem(item);
      setFormData({
          status: item.status,
          room_id: item.room_id?.toString() || "",
          note: item.note || ""
      });
      setIsModalOpen(true);
  };

  return (
    <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-t-0 border-gray-100">

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex bg-gray-100 p-1 rounded-lg w-fit overflow-x-auto no-scrollbar">
            <button onClick={() => setFilterStatus('all')} className={`px-4 py-1.5 rounded-md text-sm font-bold capitalize transition-all whitespace-nowrap ${filterStatus === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Tất cả</button>
            {Object.keys(STATUS_MAP).map(key => (
                <button key={key} onClick={() => setFilterStatus(key)} className={`px-4 py-1.5 rounded-md text-sm font-bold capitalize transition-all whitespace-nowrap ${filterStatus === key ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{STATUS_MAP[key].label}</button>
            ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-4 justify-between">
            <div className="relative w-full lg:w-96">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input type="text" placeholder="Tìm tên, mã TB, số phòng..." className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-0 transition"
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1">
                <div className="relative min-w-[180px]">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FiList className="text-gray-500" size={16} /></div>
                    <select className="appearance-none w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-0 cursor-pointer hover:border-indigo-300 transition shadow-sm"
                        value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                        <option value="newest">Mới nhất</option>
                        <option value="oldest">Cũ nhất</option>
                        <option value="a-z">Tên: A - Z</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"><FiChevronDown className="text-gray-400" size={16} /></div>
                </div>
            </div>
        </div>
      </div>

      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-gray-500 text-xs uppercase font-semibold border-b border-gray-100 bg-gray-50/50">
              <th className="py-3 pl-4">Mã TB</th>
              <th className="py-3">Tên thiết bị</th>
              <th className="py-3">Vị trí</th>
              <th className="py-3">Trạng thái</th>
              <th className="py-3">Ghi chú</th>
              <th className="py-3 text-right pr-4">Hành động</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {currentEquipments.length === 0 ?
                <tr><td colSpan="6" className="text-center py-12 text-gray-400"><div className="flex flex-col items-center gap-2"><FiSearch size={24} className="opacity-50"/><span>Không tìm thấy thiết bị nào.</span></div></td></tr>
                :

                currentEquipments.map((item) => {
                    const st = STATUS_MAP[item.status] || STATUS_MAP["in-stock"];
                    const displayId = item.code ? item.code : item._id.slice(-6).toUpperCase();

                    return (
                    <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-4 pl-4 font-mono font-bold text-gray-500 text-xs">#{displayId}</td>
                        <td className="py-4 font-medium text-gray-900">{item.category_id?.name || "---"}</td>
                        <td className="py-4 text-gray-600">
                            {item.room_info ? <span className="flex items-center gap-1 font-bold text-indigo-600">P.{item.room_info.room_number || "..."}</span> : <span className="text-gray-400 italic">Kho</span>}
                        </td>
                        <td className="py-4"><StatusPill label={st.label} color={st.color} iconType={st.icon} /></td>
                        <td className="py-4 text-gray-500 truncate max-w-xs text-xs">{item.note}</td>
                        <td className="py-4 text-right pr-4">
                            <button onClick={() => openEdit(item)} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded text-xs mr-2 font-medium">Sửa</button>
                            <button onClick={() => setConfirmDelete({ open: true, id: item._id })} className="text-gray-400 hover:text-red-500"><FiTrash2 size={16}/></button>
                        </td>
                    </tr>
                    );
                })
            }
          </tbody>
        </table>
      </div>

      {filteredEquipments.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
                <div className="text-sm text-gray-500">
                    Hiển thị <b>{indexOfFirstItem + 1}</b> - <b>{Math.min(indexOfLastItem, filteredEquipments.length)}</b> trong tổng <b>{filteredEquipments.length}</b>
                </div>
                {renderPaginationButtons()}
            </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[400px] shadow-2xl">
            <div className="flex justify-between mb-4">
                <h3 className="font-bold text-lg">Cập nhật trạng thái</h3>
                <button onClick={() => setIsModalOpen(false)}><FiX size={24}/></button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Trạng thái xử lý</label>
                    <select className="w-full border rounded-lg p-2.5 bg-white outline-none focus:border-indigo-500"
                        value={formData.status}
                        onChange={e => setFormData({...formData, status: e.target.value})}>
                        {!ALLOWED_UPDATE_STATUSES.includes(formData.status) && (
                           <option value={formData.status} disabled>
                                {STATUS_MAP[formData.status]?.label || formData.status}
                           </option>
                        )}
                        {ALLOWED_UPDATE_STATUSES.map(k => (
                            <option key={k} value={k}>{STATUS_MAP[k].label}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Ghi chú</label>
                    <textarea className="w-full border rounded-lg p-2.5 outline-none focus:border-indigo-500" rows="3"
                        value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} />
                </div>

                <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold hover:bg-indigo-700">Lưu thay đổi</button>
            </form>
          </div>
        </div>
      )}

      {confirmDelete.open && (
        <ConfirmModal
            open={confirmDelete.open} title="Xóa thiết bị" message="Xác nhận xóa thiết bị này khỏi hệ thống?"
            confirmText="Xóa" cancelText="Hủy"
            onConfirm={handleDelete}
            onCancel={() => setConfirmDelete({ open: false, id: null })}
        />
      )}
    </div>
  );
}