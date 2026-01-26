import React, { useEffect, useState } from "react";
import { equipmentApi } from "../../api/equipmentApi.js";
import { FiX, FiPlus, FiTrash2, FiSave, FiAlertCircle } from "react-icons/fi";

export default function AddImportTicketModal({ ticket, onClose, onSuccess }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const isUpdateMode = !!ticket;

  const [formData, setFormData] = useState({
    import_date: new Date().toISOString().split("T")[0],
    items: [{ category_id: "", import_price: 0, import_quantity: 1 }]
  });

  const UNIT_MAP = { item: "Cái", box: "Bộ" };
  const formatUnit = (unit) => UNIT_MAP[unit] || unit || "Cái";

  useEffect(() => {
    const fetchCats = async () => {
        try {
            const res = await equipmentApi.getAllCategories();
            setCategories(res.categories || []);
        } catch (e) { console.error(e); }
    };
    fetchCats();
  }, []);

  // Load dữ liệu ticket nếu là update mode
  useEffect(() => {
    if (ticket) {
      setFormData({
        import_date: ticket.import_date ? new Date(ticket.import_date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        items: ticket.import_details?.map(detail => ({
          category_id: detail.category_id?._id || detail.category_id || "",
          import_price: detail.import_price || 0,
          import_quantity: detail.import_quantity || 1
        })) || [{ category_id: "", import_price: 0, import_quantity: 1 }]
      });
    }
  }, [ticket]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const handleCategoryChange = (index, categoryId) => {
    const category = categories.find(c => c._id === categoryId);

    const newItems = [...formData.items];
    newItems[index] = {
        ...newItems[index],
        category_id: categoryId,
        import_price: category?.price || 0
    };

    setFormData({ ...formData, items: newItems });
    };


  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { category_id: "", import_price: 0, import_quantity: 1 }]
    });
  };

  const removeItem = (index) => {
    if (formData.items.length === 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (Number(item.import_price) * Number(item.import_quantity)), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        if (formData.items.some(i => !i.category_id)) {
            alert("Vui lòng chọn loại thiết bị cho tất cả các dòng!");
            setLoading(false);
            return;
        }

        const payload = {
            ...formData,
            total_fee: calculateTotal(),
            items: formData.items.map(i => ({
                ...i,
                import_price: Number(i.import_price),
                import_quantity: Number(i.import_quantity)
            }))
        };

        if (isUpdateMode) {
          await equipmentApi.updateImportTicket(ticket._id, payload);
        } else {
          await equipmentApi.createImportTicket(payload);
        }
        onSuccess();
        onClose();
    } catch (err) {
        alert("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
            <div>
                <h2 className="text-xl font-bold text-gray-800">{isUpdateMode ? "Cập nhật Phiếu Nhập Kho" : "Tạo Phiếu Nhập Kho Mới"}</h2>
                <p className="text-sm text-gray-500">{isUpdateMode ? "Cập nhật thông tin phiếu nhập thiết bị" : "Nhập thông tin thiết bị mua mới từ nhà cung cấp"}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><FiX size={20}/></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
            <form id="import-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày nhập hàng</label>
                    <input
                        type="date"
                        className="border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-1/3"
                        value={formData.import_date}
                        onChange={(e) => setFormData({...formData, import_date: e.target.value})}
                        required
                    />
                </div>

                <div>
                    <div className="flex justify-between items-end mb-2">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <FiAlertCircle className="text-blue-500"/> Chi tiết hàng hóa
                        </label>
                        <button type="button" onClick={addItem} className="text-sm text-blue-600 font-semibold hover:bg-blue-50 px-3 py-1 rounded transition-colors flex items-center gap-1">
                            <FiPlus /> Thêm dòng
                        </button>
                    </div>

                    <div className="border rounded-lg overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-600 font-semibold">
                                <tr>
                                    <th className="px-4 py-3 w-[10%]">STT</th>
                                    <th className="px-4 py-3 w-[40%]">Loại thiết bị</th>
                                    <th className="px-4 py-3 w-[20%]">Đơn giá (VNĐ)</th>
                                    <th className="px-4 py-3 w-[15%]">Số lượng</th>
                                    <th className="px-4 py-3 w-[15%] text-center">Xóa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {formData.items.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-center text-gray-500">{index + 1}</td>
                                        <td className="px-4 py-2">
                                            {/* <select
                                                className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={item.category_id}
                                                onChange={(e) => handleItemChange(index, "category_id", e.target.value)}
                                                required
                                            >
                                                <option value="">-- Chọn thiết bị --</option>
                                                {categories.map(c => (
                                                    <option key={c._id} value={c._id}>{c.name} ({formatUnit(c.unit)})</option>
                                                ))}
                                            </select> */}
                                            <select
  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
  value={item.category_id}
  onChange={(e) => handleCategoryChange(index, e.target.value)}
  required
>
  <option value="">-- Chọn thiết bị --</option>
  {categories.map(c => (
    <option key={c._id} value={c._id}>
      {c.name} ({formatUnit(c.unit)})
    </option>
  ))}
</select>

                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number" min="0" placeholder="0"
                                                className="w-full border rounded p-2 text-right"
                                                value={item.import_price}
                                                onChange={(e) => handleItemChange(index, "import_price", e.target.value)}
                                                required
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number" min="1" placeholder="1"
                                                className="w-full border rounded p-2 text-center font-bold"
                                                value={item.import_quantity}
                                                onChange={(e) => handleItemChange(index, "import_quantity", e.target.value)}
                                                required
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            {formData.items.length > 1 && (
                                                <button type="button" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 p-2">
                                                    <FiTrash2 size={16}/>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 font-bold text-gray-700">
                                <tr>
                                    <td colSpan="2" className="px-4 py-3 text-right">Tổng cộng dự kiến:</td>
                                    <td className="px-4 py-3 text-right text-blue-600">
                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(calculateTotal())}
                                    </td>
                                    <td colSpan="2"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </form>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
            <button onClick={onClose} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">Hủy bỏ</button>
            <button
                type="submit" form="import-form" disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-200"
            >
                {loading ? "Đang xử lý..." : <><FiSave /> {isUpdateMode ? "Cập nhật Phiếu" : "Tạo Phiếu Nhập"}</>}
            </button>
        </div>
      </div>
    </div>
  );
}