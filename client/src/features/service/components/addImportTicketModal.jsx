import React, { useState, useEffect } from "react";
import { FiX, FiPlus, FiTrash2, FiSave, FiChevronDown } from "react-icons/fi";
import { serviceApi } from "../../api/serviceApi.js";
import Toast from "../../../components/toast.jsx";

export default function AddImportTicketModal({ ticket, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const isUpdateMode = !!ticket;
  const [toast, setToast] = useState(null);

  const [importDate, setImportDate] = useState(new Date().toISOString().split('T')[0]);
  const [goodsList, setGoodsList] = useState([
    { service_id: "", import_price: 0, import_quantity: 1 }
  ]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await serviceApi.getAllServices();
        setServices(res.services || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchServices();
  }, []);

  // Load dữ liệu ticket nếu là update mode
  useEffect(() => {
    if (ticket) {
      setImportDate(ticket.import_date ? new Date(ticket.import_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      setGoodsList(
        ticket.details?.map(detail => ({
          service_id: detail.service_id?._id || detail.service_id || "",
          import_price: detail.import_price || 0,
          import_quantity: detail.import_quantity || 1
        })) || [{ service_id: "", import_price: 0, import_quantity: 1 }]
      );
    }
  }, [ticket]);

  const handleAddRow = () => {
    setGoodsList([...goodsList, { service_id: "", import_price: 0, import_quantity: 1 }]);
  };

  const handleRemoveRow = (index) => {
    const newList = [...goodsList];
    newList.splice(index, 1);
    setGoodsList(newList);
  };

  const handleChangeRow = (index, field, value) => {
    const newList = [...goodsList];
    newList[index][field] = value;
    setGoodsList(newList);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (goodsList.some(item => !item.service_id || item.import_quantity <= 0 || item.import_price <= 0)) {
      setToast({ message: "Vui lòng điền đầy đủ thông tin sản phẩm, giá và số lượng > 0", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        import_date: importDate,
        goods_list: goodsList.map(item => ({
          service_id: item.service_id,
          import_price: Number(item.import_price),
          import_quantity: Number(item.import_quantity)
        }))
      };

      if (isUpdateMode) {
        await serviceApi.updateGoodTicket(ticket._id, payload);
        setToast({ message: "Cập nhật phiếu nhập thành công!", type: "success" });
      } else {
        await serviceApi.createGoodTicket(payload);
        setToast({ message: "Tạo phiếu nhập thành công!", type: "success" });
      }
      onSuccess();
      onClose();
    } catch (error) {
      setToast({ message: "Lỗi: " + (error.response?.data?.message || error.message), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-bold text-lg text-gray-800">{isUpdateMode ? "Cập nhật Phiếu Nhập Kho" : "Tạo Phiếu Nhập Kho"}</h3>
          <button onClick={onClose}><FiX size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Ngày nhập</label>
            <input
              type="date"
              required
              className="border rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={importDate}
              onChange={(e) => setImportDate(e.target.value)}
            />
          </div>

          <table className="w-full text-left border-collapse mb-4">
            <thead>
              <tr className="bg-gray-100 text-sm text-gray-600">
                <th className="p-2 border">Sản phẩm</th>
                <th className="p-2 border w-32">Đơn giá nhập</th>
                <th className="p-2 border w-24">Số lượng</th>
                <th className="p-2 border w-32">Thành tiền</th>
                <th className="p-2 border w-10"></th>
              </tr>
            </thead>
            <tbody>
              {goodsList.map((item, index) => (
                <tr key={index}>
                  <td className="p-2 border relative">
                    <div className="relative w-full">
                        <select
                        className="w-full appearance-none p-1 outline-none bg-transparent pr-6 cursor-pointer"
                        value={item.service_id}
                        onChange={(e) => handleChangeRow(index, 'service_id', e.target.value)}
                        required
                        >
                        <option value="">-- Chọn sản phẩm --</option>
                        {services.map(s => (
                            <option key={s._id} value={s._id}>{s.name} (Tồn: {s.storage_quantity})</option>
                        ))}
                        </select>
                        <FiChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14}/>
                    </div>
                  </td>
                  <td className="p-2 border">
                    <input
                      type="number" min="1"
                      className="w-full p-1 outline-none"
                      value={item.import_price}
                      onChange={(e) => handleChangeRow(index, 'import_price', e.target.value)}
                    />
                  </td>
                  <td className="p-2 border">
                    <input
                      type="number" min="1"
                      className="w-full p-1 outline-none text-center"
                      value={item.import_quantity}
                      onChange={(e) => handleChangeRow(index, 'import_quantity', e.target.value)}
                    />
                  </td>
                  <td className="p-2 border text-right font-medium">
                    {(item.import_price * item.import_quantity).toLocaleString()}
                  </td>
                  <td className="p-2 border text-center">
                    {goodsList.length > 1 && (
                      <button type="button" onClick={() => handleRemoveRow(index)} className="text-red-500 hover:text-red-700">
                        <FiTrash2 />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="button" onClick={handleAddRow} className="flex items-center gap-1 text-blue-600 font-bold hover:underline mb-4">
            <FiPlus /> Thêm dòng
          </button>

          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-700">Tổng tiền phiếu nhập:</span>
              <span className="text-2xl font-black text-indigo-600">
                {goodsList.reduce((sum, item) => sum + (Number(item.import_price || 0) * Number(item.import_quantity || 0)), 0).toLocaleString()} đ
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200">Hủy</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white font-bold hover:bg-blue-700 flex items-center gap-2">
              {loading ? "Đang lưu..." : <><FiSave /> {isUpdateMode ? "Cập nhật phiếu" : "Lưu phiếu nhập"}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}