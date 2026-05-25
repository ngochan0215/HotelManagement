import React, { useState, useEffect } from "react";
import { FiX, FiPlus, FiTrash2, FiAlertCircle, FiZap } from "react-icons/fi";
import { equipmentApi } from "../../api/equipmentApi.js";
import { roomApi } from "../../api/roomApi.js";
import Toast from "../../../components/toast.jsx";

const CONDITION_MAP = {
  new: "Mới",
  good: "Tốt",
  maintenance: "Bảo trì",
  broken: "Hỏng"
};

export default function AddInstallTicketModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState("install");
  const [rooms, setRooms] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [dropdownOptions, setDropdownOptions] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [installDate, setInstallDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [items, setItems] = useState([{ id: "", quantity: 1 }]);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchRooms = async () => {
        try {
            // Fetch tất cả phòng
            const res = await roomApi.getAllRooms();
            const allRooms = res.rooms || [];

            // Fetch danh sách phiếu lắp đặt đang active (chưa completed/expired)
            // Chỉ lấy phiếu lắp đặt (type='install'), không lấy phiếu tháo dỡ
            const installTicketsRes = await equipmentApi.getAllInstallTickets();
            const activeTickets = (installTicketsRes.installs || []).filter(ticket => 
                ticket.type === 'install' && // Chỉ lấy phiếu lắp đặt
                ticket.status !== 'completed' && 
                ticket.status !== 'expired' &&
                ticket.room_id // Chỉ lấy phiếu có room_id
            );

            // Lấy danh sách room_id đang có phiếu lắp đặt active
            const busyRoomIds = new Set(
                activeTickets
                    .map(ticket => {
                        const roomId = ticket.room_id?._id || ticket.room_id;
                        return roomId ? roomId.toString() : null;
                    })
                    .filter(id => id) // Loại bỏ null/undefined
            );

            // Filter phòng: loại bỏ những phòng đang có phiếu lắp đặt active
            const availableRooms = allRooms.filter(room => {
                const roomId = room._id?.toString() || room._id?.toString();
                return !busyRoomIds.has(roomId);
            });

            setRooms(availableRooms);
        } catch (error) { 
            console.error("Lỗi tải danh sách phòng:", error); 
        }
    };
    fetchRooms();
  }, []);

  useEffect(() => {
    const fetchTechnicians = async () => {
        try {
            const res = await equipmentApi.getAvailableTechnicians();
            console.log("AVAILABLE TECHNICIANS: ", res);
            setTechnicians(res.technicians || []);
        } catch (error) { 
            console.error("Lỗi tải danh sách nhân viên kỹ thuật:", error);
        }
    };
    fetchTechnicians();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
        setDropdownOptions([]);
        setStockMap({});

        try {
            let res;
            if (mode === 'install') {
                // Lấy toàn bộ thiết bị trong kho (không phân trang) để đảm bảo tất cả danh mục xuất hiện trong dropdown
                res = await equipmentApi.getAllEquipments({ status: 'in-stock', limit: 1000 });
                const eqs = (res.data || []).filter(eq =>
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

                // Fetch thiết bị trong phòng
                res = await equipmentApi.getAllEquipments({
                    room_id: selectedRoomId,
                    status: 'in-use'
                });

                const eqs = res.data || [];

                // Fetch danh sách phiếu tháo dỡ cùng thời điểm để loại trừ thiết bị đã có trong đó
                let busyEquipmentIds = new Set();
                try {
                    const installTicketsRes = await equipmentApi.getAllInstallTickets();
                    const allTickets = installTicketsRes.installs || [];
                    
                    // Lấy ngày được chọn (nếu có)
                    const selectedDate = installDate ? new Date(installDate) : new Date();
                    selectedDate.setHours(0, 0, 0, 0);
                    
                    // Tìm các phiếu tháo dỡ cùng thời điểm (cùng install_date)
                    const sameDateUninstallTickets = allTickets.filter(ticket => {
                        if (ticket.type !== 'uninstall') return false;
                        if (!['pending', 'assigned', 'waiting_confirm'].includes(ticket.status)) return false;
                        
                        const ticketDate = new Date(ticket.install_date);
                        ticketDate.setHours(0, 0, 0, 0);
                        return ticketDate.getTime() === selectedDate.getTime();
                    });
                    
                    // Lấy danh sách equipment_id từ các phiếu đó
                    for (const ticket of sameDateUninstallTickets) {
                        try {
                            const ticketDetailRes = await equipmentApi.getEquipmentInstallById(ticket._id);
                            if (ticketDetailRes.success && ticketDetailRes.install?.install_details) {
                                ticketDetailRes.install.install_details.forEach(detail => {
                                    const eqId = detail.equipment_id?._id || detail.equipment_id;
                                    if (eqId) {
                                        busyEquipmentIds.add(eqId.toString());
                                    }
                                });
                            }
                        } catch (err) {
                            console.error(`Error fetching ticket ${ticket._id} details:`, err);
                        }
                    }
                } catch (err) {
                    console.error("Error fetching busy equipment:", err);
                }

                // Filter thiết bị: loại trừ thiết bị có status "removing" và thiết bị đã có trong phiếu khác cùng thời điểm
                const availableEqs = eqs.filter(eq => {
                    const eqId = eq._id?.toString() || eq._id;
                    // Loại trừ thiết bị có status "removing"
                    if (eq.status === 'removing') return false;
                    // Loại trừ thiết bị đã có trong phiếu khác cùng thời điểm
                    if (busyEquipmentIds.has(eqId)) return false;
                    return true;
                });

                const specificOptions = availableEqs.map(eq => {
                    const code = eq.code ? eq.code : eq._id.slice(-6).toUpperCase();
                    const conditionText = CONDITION_MAP[eq.condition] || eq.condition;
                    
                    // Đảm bảo lấy đúng equipment_id, không phải category_id
                    const equipmentId = eq._id?.toString() || eq._id;
                    const categoryId = eq.category_id?._id?.toString() || eq.category_id?.toString() || eq.category_id;
                    const categoryName = eq.category_id?.name || "Unknown";


                    return {
                        value: equipmentId, // Đảm bảo là string - ĐÂY LÀ ID THIẾT BỊ, KHÔNG PHẢI CATEGORY_ID
                        label: `${categoryName} (#${code}) - ${conditionText}`,
                        type: 'specific',
                        equipmentId: equipmentId, // Lưu thêm để debug
                        categoryId: categoryId // Lưu để so sánh
                    };
                });
                setDropdownOptions(specificOptions);
            }

            setItems([{ id: "", quantity: 1 }]);

        } catch (error) {
            console.error("Lỗi tải dữ liệu thiết bị:", error);
        }
    };

    fetchData();
  }, [mode, selectedRoomId, installDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRoomId) {
        setToast({ message: "Vui lòng chọn phòng.", type: "error" });
        return;
    }

    for (const item of items) {
        if (!item.id) {
            setToast({ message: "Vui lòng chọn thiết bị ở tất cả các dòng.", type: "error" });
            return;
        }
    }

    setLoading(true);
    try {
      const payloadItems = items.map((item, idx) => {
          if (mode === 'install') {
              return { category_id: item.id, quantity: item.quantity };
          } else {
              // Đảm bảo item.id là equipment_id, không phải category_id
              // Kiểm tra xem item.id có trong dropdownOptions với type='specific' không
              const option = dropdownOptions.find(opt => opt.value === item.id && opt.type === 'specific');
              if (!option) {
                  console.error(`[ERROR] Item ${idx}: item.id=${item.id} không tìm thấy trong dropdownOptions`);
                  console.error(`[ERROR] Available options:`, dropdownOptions.map(opt => ({ value: opt.value, type: opt.type, label: opt.label })));
                  throw new Error(`Thiết bị được chọn không hợp lệ. Vui lòng chọn lại.`);
              }
              
              // Đảm bảo sử dụng equipmentId từ option, không phải item.id (có thể bị sai)
              const equipmentId = option.equipmentId || option.value || item.id;
              
              console.log(`[Payload] Item ${idx}: item.id=${item.id}, option.value=${option.value}, option.equipmentId=${option.equipmentId}, final equipmentId=${equipmentId}`);
              
              return { specific_equipment_id: equipmentId, quantity: 1 };
          }
      });

      // Debug log để kiểm tra payload
      if (mode === 'uninstall') {
          console.log("Uninstall payload items:", payloadItems);
          console.log("Selected room:", selectedRoomId);
          console.log("Dropdown options:", dropdownOptions);
      }

      if (mode === 'install') {
        // Tạo phiếu lắp đặt
        const payload = {
          install_date: installDate,
          items: payloadItems,
          room_id: selectedRoomId,
          from_room_id: null, // Có thể thêm sau nếu muốn điều chuyển từ phòng khác
          handled_by: selectedTechnicianId || null,
        };

        await equipmentApi.createInstallTicket(payload);
        setToast({ message: "Tạo phiếu lắp đặt thành công!", type: "success" });
      } else {
        // Tạo phiếu tháo dỡ
        const payload = {
          install_date: installDate,
          items: payloadItems,
          from_room_id: selectedRoomId,
          handled_by: selectedTechnicianId || null,
        };

        console.log("PAYLOAd IN CREATING UNINSTALL TICKET: ", payload);
        await equipmentApi.createUninstallTicket(payload);
        setToast({ message: "Tạo phiếu tháo dỡ thành công!", type: "success" });
      }

      onSuccess();
      onClose();
    } catch (error) {
      setToast({ message: "Lỗi: " + (error.response?.data?.message || error.message), type: "error" });
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

  const handleSmartSuggestions = async () => {
    if (!selectedRoomId) {
      setToast({ message: "Vui lòng chọn phòng trước!", type: "error" });
      return;
    }

    if (mode !== 'install') {
      setToast({ message: "Gợi ý thông minh chỉ áp dụng cho chế độ lắp đặt!", type: "error" });
      return;
    }

    setLoadingSuggestions(true);
    try {
      const res = await equipmentApi.getSmartInstallSuggestions(selectedRoomId);
      
      if (res.success && res.suggestions && res.suggestions.length > 0) {
        // Chuyển đổi suggestions thành items format
        const suggestedItems = res.suggestions.map(suggestion => {
          const option = dropdownOptions.find(opt => opt.value === suggestion.category_id);
          if (!option) return null;
          return {
            id: suggestion.category_id,
            quantity: suggestion.suggested_quantity
          };
        }).filter(item => item !== null);

        if (suggestedItems.length > 0) {
          setItems(suggestedItems);
          setToast({ message: `Đã gợi ý ${suggestedItems.length} loại thiết bị cần lắp đặt cho phòng ${res.room_number || ''}.`, type: "success" });
        } else {
          setToast({ message: "Không tìm thấy thiết bị gợi ý trong kho. Vui lòng kiểm tra lại.", type: "info" });
        }
      } else {
        setToast({ message: res.message || "Phòng này đã có đủ thiết bị mặc định.", type: "info" });
      }
    } catch (error) {
      console.error("Error fetching smart suggestions:", error);
      setToast({ message: "Lỗi: " + (error.response?.data?.message || error.message), type: "error" });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <>
    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gray-50 border-b border-gray-100">
            <div className="flex justify-between items-center px-6 py-4">
                <h3 className="font-bold text-lg text-gray-800">Tạo phiếu kỹ thuật</h3>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition"><FiX size={20}/></button>
            </div>

            <div className="flex px-6 pb-4 gap-4">
                <button
                    onClick={() => { setMode('install'); setSelectedRoomId(""); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all ${mode === 'install' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
                >
                     Lắp đặt (Kho ➝ Phòng)
                </button>
                <button
                    onClick={() => { setMode('uninstall'); setSelectedRoomId(""); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all ${mode === 'uninstall' ? 'bg-orange-600 text-white shadow-md' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
                >
                     Tháo dỡ (Phòng ➝ Kho)
                </button>
            </div>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="install-form" onSubmit={handleSubmit} className="space-y-6">
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
                <div className="flex items-center justify-between mb-2">
                    <label className={`block text-sm font-bold flex items-center gap-2 ${mode === 'install' ? 'text-indigo-800' : 'text-orange-800'}`}>
                        {mode === 'install' ? "Chọn Phòng cần lắp thiết bị" : "Chọn Phòng cần tháo thiết bị"}
                    </label>
                    {mode === 'install' && selectedRoomId && (
                        <button
                            type="button"
                            onClick={handleSmartSuggestions}
                            disabled={loadingSuggestions}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            title="Gợi ý thiết bị cần lắp đặt dựa trên thiết bị mặc định của loại phòng"
                        >
                            <FiZap size={14} className={loadingSuggestions ? 'animate-pulse' : ''} />
                            {loadingSuggestions ? 'Đang phân tích...' : 'GỢI Ý THÔNG MINH'}
                        </button>
                    )}
                </div>
                <select className="w-full border border-gray-300 rounded-lg p-2.5 bg-white outline-none"
                    value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)} required>
                    <option value="">-- Chọn phòng --</option>
                    {rooms.map(r => <option key={r._id} value={r._id}>Phòng {r.room_number}</option>)}
                </select>
                {mode === 'uninstall' && !selectedRoomId && <p className="text-xs text-orange-600 mt-1 italic flex items-center gap-1"><FiAlertCircle/> Vui lòng chọn phòng để tải danh sách thiết bị.</p>}
                {mode === 'install' && selectedRoomId && (
                    <p className="text-xs text-indigo-600 mt-1 italic flex items-center gap-1">
                        <FiZap size={12}/> Chọn phòng xong, nhấn "Gợi ý thông minh" để tự động điền thiết bị cần lắp đặt
                    </p>
                )}
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
                                onChange={e => {
                                    const selectedValue = e.target.value;
                                    // Đảm bảo lưu đúng equipmentId, không phải categoryId
                                    const selectedOption = dropdownOptions.find(opt => opt.value === selectedValue);
                                    if (mode === 'uninstall' && selectedOption) {
                                        // Lưu equipmentId từ option, không phải value (có thể bị sai)
                                        const equipmentId = selectedOption.equipmentId || selectedOption.value;
                                        console.log(`[Select Change] Selected value=${selectedValue}, option.equipmentId=${selectedOption.equipmentId}, final equipmentId=${equipmentId}`);
                                        updateItem(index, "id", equipmentId);
                                    } else {
                                        updateItem(index, "id", selectedValue);
                                    }
                                }}
                            >
                                <option value="">-- Chọn thiết bị --</option>
                                {dropdownOptions.map(opt => {
                                    const isSelectedAlready = mode === 'uninstall' && items.some((i, idx) => i.id === opt.value && idx !== index);
                                    if (isSelectedAlready) return null;

                                    // Đảm bảo value là equipmentId, không phải categoryId
                                    const optionValue = mode === 'uninstall' ? (opt.equipmentId || opt.value) : opt.value;

                                    return (
                                        <option key={opt.value} value={optionValue}>
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
          <button type="submit" form="install-form" disabled={loading || (mode === 'uninstall' && !selectedRoomId)}
            className={`px-6 py-2.5 rounded-lg text-white font-bold shadow-lg transition disabled:opacity-50 ${mode === 'install' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
            {loading ? "Đang xử lý..." : (mode === 'install' ? "Tạo phiếu Lắp" : "Tạo phiếu Tháo")}
          </button>
        </div>

      </div>
    </div>
    </>
  );
}