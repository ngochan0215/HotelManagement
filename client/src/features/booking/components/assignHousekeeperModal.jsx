import React, { useState, useEffect } from "react";
import { FiX, FiUser } from "react-icons/fi";
import { bookingApi } from "../../api/bookingApi.js";

export default function AssignHousekeeperModal({ cleaningData, onClose, onSuccess }) {
  const [housekeepers, setHousekeepers] = useState([]);
  const [selectedHousekeeper, setSelectedHousekeeper] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchHousekeepers = async () => {
      try {
        const res = await bookingApi.getAvailableHousekeepers();
        setHousekeepers(res.housekeepers || []);
      } catch (error) {
        console.error("Error fetching housekeepers:", error);
        alert("Lỗi khi tải danh sách nhân viên: " + (error.response?.data?.message || error.message));
      } finally {
        setFetching(false);
      }
    };
    fetchHousekeepers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHousekeeper) {
      alert("Vui lòng chọn nhân viên dọn dẹp");
      return;
    }

    setLoading(true);
    try {
      // Nếu chưa có room_log_id, tìm lại
      let room_log_id = cleaningData.room_log_id;
      if (!room_log_id) {
        const res = await bookingApi.getCleaningTaskByRoom({
          room_id: cleaningData.room_id,
          booking_id: cleaningData.booking_id
        });
        room_log_id = res.room_log_id;
      }
      
      if (!room_log_id) {
        alert("Không tìm thấy thông tin room log. Vui lòng thử lại.");
        setLoading(false);
        return;
      }
      
      await bookingApi.assignCleaningTask({
        room_log_id: room_log_id,
        handled_by: selectedHousekeeper
      });
      alert("Gán nhân viên thành công!");
      onSuccess();
      onClose();
    } catch (error) {
      alert("Lỗi: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-lg text-gray-800">Gán nhân viên dọn dẹp</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
            <FiX size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              Phòng <span className="font-semibold text-gray-900">#{cleaningData.room_number}</span> cần được dọn dẹp sau khi checkout.
            </p>
            <p className="text-xs text-gray-500">Vui lòng chọn nhân viên dọn dẹp để gán công việc.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Chọn nhân viên dọn dẹp
              </label>
              {fetching ? (
                <div className="text-center py-4 text-gray-500">Đang tải...</div>
              ) : housekeepers.length === 0 ? (
                <div className="text-center py-4 text-orange-500 bg-orange-50 rounded-lg border border-orange-200">
                  Không có nhân viên dọn dẹp rảnh
                </div>
              ) : (
                <select
                  className="w-full border border-gray-300 rounded-lg p-2.5 outline-none bg-white"
                  value={selectedHousekeeper}
                  onChange={(e) => setSelectedHousekeeper(e.target.value)}
                  required
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {housekeepers.map(hk => (
                    <option key={hk._id} value={hk._id}>
                      {hk.full_name} {hk.phone_number ? `(${hk.phone_number})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
              >
                Bỏ qua
              </button>
              <button
                type="submit"
                disabled={loading || fetching || housekeepers.length === 0}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Đang gán..." : "Gán công việc"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
