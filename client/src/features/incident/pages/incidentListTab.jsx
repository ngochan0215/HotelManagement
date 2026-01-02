import React, { useEffect, useState } from "react";
import { FiClock, FiPlus } from "react-icons/fi";
import { incidentApi } from "../../api/incidentApi";
import CreateIncidentForm from "../components/createIncidentForm";
import IncidentDetailModal from "../components/incidentDetailModal";
import { useAuth } from "../../auth/hooks/authContext";


const severityStyle = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function IncidentListTab() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await incidentApi.getAllIncidents();
      const list = Array.isArray(res) ? res : res?.data ?? [];
      setIncidents(list);
    } catch (e) {
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIncidents(); }, []);

  return (
    <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-t-0 border-gray-100 space-y-4">

      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition shadow-red-200 shadow-lg"
        >
          <FiPlus /> Báo cáo sự cố
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {incidents.map(item => (
          <div
            key={item._id}
            className="p-5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition"
          >
            <div className="flex justify-between mb-2">
              <span className={`text-[10px] uppercase font-black px-2 py-1 rounded border ${severityStyle[item.severity]}`}>
                {item.severity}
              </span>

              <span className="text-xs text-gray-400 flex items-center gap-1">
                <FiClock /> {new Date(item.occured_at).toLocaleDateString("vi-VN")}
              </span>
            </div>

            <h3 className="font-bold text-gray-900">
              {item.room_id ? `Phòng ${item.room_id.room_number}` : "Khu vực chung"}
            </h3>

            <p className="text-sm text-gray-500 line-clamp-2 mb-3">
              {item.description}
            </p>

            <div className="flex justify-between items-center pt-3 border-t">
              <span className="text-indigo-600 font-bold text-sm capitalize">{item.status}</span>

              <button
                onClick={() => setSelected(item)}
                className="text-xs bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg font-medium"
              >
                Chi tiết
              </button>
            </div>
          </div>
        ))}

        {!loading && incidents.length === 0 && (
          <div className="col-span-2 text-center py-10 text-gray-400 italic">
            Chưa có sự cố nào.
          </div>
        )}
      </div>

      {showCreate && (
        <CreateIncidentForm onClose={() => setShowCreate(false)} onCreated={fetchIncidents} />
      )}

      {selected && (
        <IncidentDetailModal
           incident={selected}
           user={user}
           onClose={() => setSelected(null)}
           onUpdated={fetchIncidents}
         />
      )}
    </div>
  );
}
