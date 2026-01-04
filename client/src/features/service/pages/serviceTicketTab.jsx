import React, { useEffect, useState } from "react";
import { serviceApi } from "../../api/serviceApi";
import { FiCheckCircle, FiPlus, FiClock, FiTruck, FiUser } from "react-icons/fi";
import AddImportTicketModal from "../components/addImportTicketModal";
import AddServiceUsageModal from "../components/addServiceUsageModal";

export default function ServiceTicketTab() {
  const [imports, setImports] = useState([]);
  const [usages, setUsages] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);

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
      pending: { label: "Đang xử lý", class: "bg-gray-100 text-gray-500 border border-gray-200" },
      waiting_confirm: { label: "Chờ duyệt", class: "bg-yellow-100 text-yellow-800 font-bold border border-yellow-300" },
      completed: { label: "Hoàn thành", class: "bg-green-100 text-green-700 border border-green-200" },
      cancelled: { label: "Đã hủy", class: "bg-red-100 text-red-700 border border-red-200" },
    };
    const s = config[status] || config.pending;
    return <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${s.class}`}>{s.label}</span>;
  };

  return (
    <div className="space-y-8 pb-10 animate-fade-in relative">

      {showImportModal && <AddImportTicketModal onClose={() => setShowImportModal(false)} onSuccess={fetchTickets} />}
      {showUsageModal && <AddServiceUsageModal onClose={() => setShowUsageModal(false)} onSuccess={fetchTickets} />}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                <FiClock className="text-orange-500" /> Lịch sử Sử dụng Dịch vụ
            </h2>
            <button
                onClick={() => setShowUsageModal(true)}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-orange-700 shadow-sm"
            >
                <FiPlus /> Thêm dịch vụ
            </button>
        </div>

        <div className="overflow-x-auto">
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
                    {usages.map((item) => (
                        // <tr key={item._id} className="hover:bg-gray-50 transition">
                        //     <td className="px-4 py-3 font-bold text-gray-800">
                        //         <div className="flex items-center gap-2">
                        //             <FiUser className="text-gray-400"/>
                        //             {item.customer_id?.full_name || "Khách lẻ"}
                        //         </div>
                        //     </td>
                        //     <td className="px-4 py-3 text-gray-600">
                        //         {item.booking_id ? (
                        //             <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                        //                 Theo Booking
                        //             </span>
                        //         ) : "Vãng lai"}
                        //     </td>
                        //     <td className="px-4 py-3">{item.employee_id?.full_name || "System"}</td>
                        //     <td className="px-4 py-3 text-right font-medium text-indigo-600">
                        //         {item.total_fee?.toLocaleString()} đ
                        //     </td>
                        //     <td className="px-4 py-3 text-center">{renderStatus(item.status)}</td>
                        // </tr>
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
                                {renderStatus(item.status)}
                            </td>

                            <td className="px-4 py-3 text-right">
                                {item.status === "waiting_confirm" ? (
                                <div className="flex justify-end gap-2">
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
                                    Hủy
                                    </button>
                                </div>
                                ) : (
                                <span className="text-gray-300 text-xs italic">---</span>
                                )}
                            </td>
                        </tr>
                    ))}
                    {usages.length === 0 && <tr><td colSpan="5" className="text-center py-8 text-gray-400 italic">Chưa có dữ liệu sử dụng dịch vụ</td></tr>}
                </tbody>
            </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                <FiTruck className="text-blue-500" /> Quản lý Nhập Kho
            </h2>
            <button
                onClick={() => setShowImportModal(true)}
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
                                                {d.service_id?.name} (x{d.import_quantity})
                                            </span>
                                        ))}
                                    </div>
                                ) : "---"}
                            </td>
                            <td className="px-4 py-3 text-center">{renderStatus(item.status)}</td>
                            <td className="px-4 py-3 text-right">
                                {item.status === 'waiting_confirm' || item.status === 'pending' ? (
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