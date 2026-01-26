import React, { useState, useEffect } from "react";
import { FiX, FiPlus, FiTrash2, FiAlertCircle } from "react-icons/fi";
import { equipmentApi } from "../../api/equipmentApi.js";
import { roomApi } from "../../api/roomApi.js";

const CONDITION_MAP = {
  new: "Mới",
  good: "Tốt",
  maintenance: "Bảo trì",
  broken: "Hỏng"
};

export default function UpdateInstallTicketModal({ ticket, onClose, onSuccess }) {
  const [mode, setMode] = useState(ticket.type || "install");
  const [rooms, setRooms] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [installDate, setInstallDate] = useState(
    ticket.install_date ? new Date(ticket.install_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [selectedRoomId, setSelectedRoomId] = useState(ticket.room_id?._id || ticket.room_id || "");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(ticket.handled_by?._id || ticket.handled_by || "");
  const [items, setItems] = useState([{ id: "", quantity: 1 }]);
  const [loading, setLoading] = useState(false);
  const [ticketDetails, setTicketDetails] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resRooms, resTech, resTicket] = await Promise.all([
          roomApi.getAllRooms(),
          equipmentApi.getAvailableTechnicians(),
          equipmentApi.getEquipmentInstallById(ticket._id)
        ]);
        setRooms(resRooms.rooms || []);
        setTechnicians(resTech.technicians || []);
        
        // Load chi tiết thiết bị hiện tại
        if (resTicket.success && resTicket.install?.install_details) {
          const details = resTicket.install.install_details;
          const equipmentMap = {};
          
          details.forEach(detail => {
            const catId = detail.equipment_id?.category_id?._id || detail.equipment_id?.category_id;
            const catName = detail.equipment_id?.category_id?.name || "Unknown";
            
            if (catId) {
              if (!equipmentMap[catId]) {
                equipmentMap[catId] = { name: catName, quantity: 0 };
              }
              equipmentMap[catId].quantity += 1;
            }
          });
          
          setTicketDetails(details);
          setItems(Object.keys(equipmentMap).map(catId => ({
            id: catId,
            quantity: equipmentMap[catId].quantity
          })));
        }
      } catch (error) { 
        console.error(error); 
      }
    };
    fetchData();
  }, [ticket._id]);

  useEffect(() => {
    const fetchData = async () => {
        setDropdownOptions([]);
        setStockMap({});

        try {
            let res;
            if (mode === 'install') {
                res = await equipmentApi.getAllEquipments({ status: 'in-stock' });
                // Chỉ lấy thiết bị khả dụng: in-stock, condition=new/good, room_id=null
                const eqs = (res.equipments || []).filter(eq => 
                    (eq.condition === 'new' || eq.condition === 'good') && 
                    !eq.room_id // room_id phải null
                );

                const map = {};
                const uniqueCats = [];
                const distinctMap = new Map();

                eqs.forEach(eq => {
                    const catId = eq.category_id?._id || eq.category_id;
                    const catName = eq.category_id?.name || "Unknown";

                    if (!distinctMap.has(catId)) {
                        distinctMap.set(catId, true);
                        uniqueCats.push({ value: catId, label: catName, type: 'category' });
                    }
                    map[catId] = (map[catId] || 0) + 1;
                });

                setDropdownOptions(uniqueCats);
                setStockMap(map);
            }

            else {
                if (!selectedRoomId) {
                    setDropdownOptions([]);
                    return;
                }

                res = await equipmentApi.getAllEquipments({
                    room_id: selectedRoomId,
                    status: 'in-use'
                });

                const eqs = res.equipments || [];

                const specificOptions = eqs.map(eq => {
                    const code = eq.code ? eq.code : eq._id.slice(-6).toUpperCase();
                    const conditionText = CONDITION_MAP[eq.condition] || eq.condition;

                    return {
                        value: eq._id,
                        label: `${eq.category_id?.name} (#${code}) - ${conditionText}`,
                        type: 'specific'
                    };
                });
                setDropdownOptions(specificOptions);
            }

        } catch (error) {
            console.error("Lỗi tải dữ liệu thiết bị:", error);
        }
    };

    fetchData();
  }, [mode, selectedRoomId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRoomId) {
        alert("Vui lòng chọn phòng.");
        return;
    }

    // Validate items nếu có
    const validItems = items.filter(item => item.id);
    if (validItems.length === 0) {
        // Cho phép cập nhật mà không thay đổi thiết bị
        const payload = {
          install_date: installDate,
          room_id: selectedRoomId,
          handled_by: selectedTechnicianId || null,
        };

        setLoading(true);
        try {
          await equipmentApi.updateInstallTicket(ticket._id, payload);
          alert("Cập nhật phiếu thành công!");
          onSuccess();
          onClose();
        } catch (error) {
          alert("Lỗi: " + (error.response?.data?.message || error.message));
        } finally {
          setLoading(false);
        }
        return;
    }

    for (const item of validItems) {
        if (!item.id) {
            alert("Vui lòng chọn thiết bị ở tất cả các dòng.");
            return;
        }
    }

    setLoading(true);
    try {
      const payloadItems = validItems.map(item => {
          if (mode === 'install') {
              return { category_id: item.id, quantity: item.quantity };
          } else {
              return { specific_equipment_id: item.id, quantity: 1 };
          }
      });

      const payload = {
        install_date: installDate,
        items: payloadItems,
        room_id: selectedRoomId,
        handled_by: selectedTechnicianId || null,
      };

      await equipmentApi.updateInstallTicket(ticket._id, payload);
      alert("Cập nhật phiếu thành công!");
      onSuccess();
      onClose();
    } catch (error) {
      alert("Lỗi: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gray-50 border-b border-gray-100">
            <div className="flex justify-between items-center px-6 py-4">
                <h3 className="font-bold text-lg text-gray-800">Cập nhật phiếu kỹ thuật</h3>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition"><FiX size={20}/></button>
            </div>

            <div className="flex px-6 pb-4 gap-4">
                <button
                    onClick={() => { setMode('install'); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all ${mode === 'install' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
                    disabled
                >
                     Lắp đặt (Kho ➝ Phòng)
                </button>
                <button
                    onClick={() => { setMode('uninstall'); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all ${mode === 'uninstall' ? 'bg-orange-600 text-white shadow-md' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
                    disabled
                >
                     Tháo dỡ (Phòng ➝ Kho)
                </button>
            </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="update-form" onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Ngày thực hiện</label>
              <input type="date" required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none"
                value={installDate} onChange={e => setInstallDate(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Phân công nhân viên kỹ thuật <span className="text-gray-400 text-xs">(Tùy chọn)</span>
              </label>
              <select 
                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none bg-white"
                value={selectedTechnicianId} 
                onChange={(e) => setSelectedTechnicianId(e.target.value)}
              >
                <option value="">-- Không phân công --</option>
                {technicians.map(tech => (
                  <option key={tech._id} value={tech._id}>
                    {tech.full_name} {tech.phone_number ? `(${tech.phone_number})` : ''}
                  </option>
                ))}
              </select>
              {technicians.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">Không có nhân viên kỹ thuật rảnh</p>
              )}
            </div>

            <div className={`p-4 rounded-xl border ${mode === 'install' ? 'bg-indigo-50 border-indigo-100' : 'bg-orange-50 border-orange-100'}`}>
                <label className={`block text-sm font-bold mb-2 flex items-center gap-2 ${mode === 'install' ? 'text-indigo-800' : 'text-orange-800'}`}>
                    {mode === 'install' ? "Chọn Phòng cần lắp thiết bị" : "Chọn Phòng cần tháo thiết bị"}
                </label>
                <select className="w-full border border-gray-300 rounded-lg p-2.5 bg-white outline-none"
                    value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)} required>
                    <option value="">-- Chọn phòng --</option>
                    {rooms.map(r => <option key={r._id} value={r._id}>Phòng {r.room_number}</option>)}
                </select>
                {mode === 'uninstall' && !selectedRoomId && <p className="text-xs text-orange-600 mt-1 italic flex items-center gap-1"><FiAlertCircle/> Vui lòng chọn phòng để tải danh sách thiết bị.</p>}
            </div>

            {(mode === 'install' || (mode === 'uninstall' && selectedRoomId)) && (
                <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-semibold text-gray-700">
                        {mode === 'install' ? 'Chọn loại thiết bị (từ Kho)' : 'Chọn thiết bị cụ thể (đang ở Phòng này)'}
                    </label>
                </div>

                {dropdownOptions.length === 0 ? (
                    <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-sm">
                        {mode === 'install' ? "Kho đang trống." : "Phòng này chưa có thiết bị nào."}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item, index) => (
                        <div key={index} className="flex gap-3 items-start">
                            <div className="flex-1">
                            <select
                                required
                                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none text-sm"
                                value={item.id}
                                onChange={e => updateItem(index, "id", e.target.value)}
                            >
                                <option value="">-- Chọn thiết bị --</option>
                                {dropdownOptions.map(opt => {
                                    const isSelectedAlready = mode === 'uninstall' && items.some((i, idx) => i.id === opt.value && idx !== index);
                                    if (isSelectedAlready) return null;

                                    return (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label} {mode === 'install' ? `(Tồn: ${stockMap[opt.value]})` : ''}
                                        </option>
                                    )
                                })}
                            </select>
                            </div>

                            <div className="w-24">
                                {mode === 'install' ? (
                                    <input
                                        type="number" min="1" max={stockMap[item.id] || 999} required
                                        className="w-full border border-gray-300 rounded-lg p-2.5 outline-none text-sm text-center"
                                        value={item.quantity} onChange={e => updateItem(index, "quantity", parseInt(e.target.value))}
                                    />
                                ) : (
                                    <div className="w-full border border-gray-200 bg-gray-100 rounded-lg p-2.5 text-sm text-center text-gray-500 font-bold cursor-not-allowed">
                                        1 cái
                                    </div>
                                )}
                            </div>

                            {items.length > 1 && (
                            <button type="button" onClick={() => removeItem(index)} className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                <FiTrash2 size={18}/>
                            </button>
                            )}
                        </div>
                        ))}
                        <button type="button" onClick={() => setItems([...items, { id: "", quantity: 1 }])}
                            className="mt-3 text-sm flex items-center gap-1 text-indigo-600 font-semibold hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 transition w-fit">
                            <FiPlus /> Thêm dòng
                        </button>
                    </div>
                )}
                </div>
            )}

          </form>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-200 transition">Hủy</button>
          <button type="submit" form="update-form" disabled={loading || (mode === 'uninstall' && !selectedRoomId)}
            className={`px-6 py-2.5 rounded-lg text-white font-bold shadow-lg transition disabled:opacity-50 ${mode === 'install' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
            {loading ? "Đang xử lý..." : "Cập nhật phiếu"}
          </button>
        </div>

      </div>
    </div>
  );
}
