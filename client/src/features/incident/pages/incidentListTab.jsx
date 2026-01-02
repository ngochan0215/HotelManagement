import React, { useEffect, useState } from "react";
import { FiAlertCircle, FiClock, FiCheckCircle, FiPlus } from "react-icons/fi";
import { incidentApi } from "../../api/incidentApi";

export default function IncidentListTab() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);

  const severityStyle = {
    critical: "bg-red-100 text-red-700 border-red-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    low: "bg-blue-100 text-blue-700 border-blue-200",
  };

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await incidentApi.getAllIncidents();
      setIncidents(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIncidents(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 transition shadow-lg shadow-red-100">
          <FiPlus /> Báo cáo sự cố mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {incidents.map((item) => (
          <div key={item._id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-start mb-3">
              <span className={`text-[10px] uppercase font-black px-2 py-1 rounded border ${severityStyle[item.severity]}`}>
                {item.severity}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <FiClock /> {new Date(item.occured_at).toLocaleDateString('vi-VN')}
              </span>
            </div>

            <h4 className="font-bold text-gray-800 mb-1">
              {item.room_id ? `Phòng ${item.room_id.room_number}` : "Khu vực chung"}
            </h4>
            <p className="text-sm text-gray-500 mb-4 line-clamp-2">{item.description}</p>

            <div className="flex justify-between items-center pt-4 border-t border-gray-50">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase font-bold">Trạng thái</span>
                <span className="text-sm font-bold text-indigo-600 capitalize">{item.status}</span>
              </div>
              <button className="text-xs bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg font-medium transition">
                Chi tiết
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}