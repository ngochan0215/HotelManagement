import React, { useEffect, useState } from "react";
import { serviceApi } from "../../api/serviceApi";
import { FiCheckCircle, FiPlus, FiClock, FiTruck, FiUser, FiBox } from "react-icons/fi";

export default function ServiceTicketTab() {
  const [imports, setImports] = useState([]);
  const [usages, setUsages] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const [resImport, resUsage] = await Promise.all([
        serviceApi.getAllGoodTickets(),
        serviceApi.getAllServiceUsage()
      ]);

      setImports(resImport.tickets_details || resImport.tickets || []);
      setUsages(resUsage.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

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

  const renderStatus = (status) => {
    const config = {
      pending: { label: "Chờ xử lý", class: "bg-gray-100 text-gray-500 border border-gray-200" },
      waiting_confirm: { label: "Cần duyệt", class: "bg-yellow-100 text-yellow-800 font-bold border border-yellow-300 animate-pulse" },
      completed: { label: "Hoàn thành", class: "bg-green-100 text-green-700 border border-green-200" },
      cancelled: { label: "Đã hủy", class: "bg-red-100 text-red-700 border border-red-200" },
    };
    const s = config[status] || config.pending;
    return <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${s.class}`}>{s.label}</span>;
  };

  return (
    <div className="space-y-8 pb-10 animate-fade-in relative">

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                <FiClock className="text-orange-500" /> Quản lý Sử dụng Dịch vụ
            </h2>
            <button
                className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-orange-700 shadow-sm"
            >
                <FiPlus /> Tạo phiếu dùng
            </button>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 uppercase text-xs text-gray-600 border-b">
                    <tr>
                        <th className="px-4 py-3">Khách hàng</th>
                        <th className="px-4 py-3">Booking / Phòng</th>
                        <th className="px-4 py-3">Phục vụ bởi</th>
                        <th className="px-4 py-3 text-right">Tổng tiền</th>
                        <th className="px-4 py-3 text-center">Trạng thái</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {usages.map((item) => (
                        <tr key={item._id} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-3 font-bold text-gray-800">
                                <div className="flex items-center gap-2">
                                    <FiUser className="text-gray-400"/>
                                    {item.customer_id?.full_name || "Khách lẻ"}
                                </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                                {item.booking_id ? "Theo Booking" : "Vãng lai"}
                            </td>
                            <td className="px-4 py-3">{item.employee_id?.full_name || "System"}</td>
                            <td className="px-4 py-3 text-right font-medium text-indigo-600">
                                {item.total_fee?.toLocaleString()} đ
                            </td>
                            <td className="px-4 py-3 text-center">{renderStatus(item.status)}</td>
                        </tr>
                    ))}
                    {usages.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-gray-400 italic">Chưa có dữ liệu sử dụng dịch vụ</td></tr>}
                </tbody>
            </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                <FiTruck className="text-blue-500" /> Quản lý Nhập Kho Hàng Hóa
            </h2>
            <button
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700 shadow-sm"
            >
                <FiPlus /> Tạo phiếu nhập
            </button>
        </div>

        <div className="overflow-x-auto">
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
                    {imports.map((item) => (
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
                                                <FiBox size={10}/> {d.service_id?.name} (x{d.import_quantity})
                                            </span>
                                        ))}
                                    </div>
                                ) : "---"}
                            </td>
                            <td className="px-4 py-3 text-center">{renderStatus(item.status)}</td>
                            <td className="px-4 py-3 text-right">
                                {item.status === 'pending' || item.status === 'waiting_confirm' ? (
                                    <button
                                        onClick={() => handleConfirmImport(item._id)}
                                        className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-blue-700 shadow-sm ml-auto"
                                        title="Xác nhận nhập kho"
                                    >
                                        <FiCheckCircle /> Nhập kho
                                    </button>
                                ) : (
                                    <span className="text-gray-300 text-xs italic">
                                        {item.status === 'completed' ? '---' : 'Chưa đến hạn'}
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                     {imports.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-gray-400 italic">Chưa có phiếu nhập hàng</td></tr>}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}