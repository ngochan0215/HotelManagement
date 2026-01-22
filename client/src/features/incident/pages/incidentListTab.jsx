import React, { useEffect, useState } from "react";
import { FiClock, FiPlus, FiUser, FiMapPin, FiArrowRight, FiBriefcase } from "react-icons/fi";
import { incidentApi } from "../../api/incidentApi.js";
import { employeeApi } from "../../api/employeeApi.js";
import CreateIncidentForm from "../components/createIncidentForm.jsx";
import IncidentDetailModal from "../components/incidentDetailModal.jsx";
import { useAuth } from "../../auth/hooks/authContext.jsx";

const severityStyle = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

const statusStyle = {
  new: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-600",
  resolved: "bg-green-100 text-green-600",
  closed: "bg-gray-800 text-white",
};

const statusLabel = {
  new: "Mới tạo",
  in_progress: "Đang xử lý",
  resolved: "Đã khắc phục",
  closed: "Đã đóng",
};

export default function IncidentListTab() {
  const [incidents, setIncidents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [incidentRes, empRes] = await Promise.all([
        incidentApi.getAllIncidents(),
        employeeApi.getAllEmployees()
      ]);

      setIncidents(Array.isArray(incidentRes) ? incidentRes : incidentRes?.data ?? []);
      setEmployees(empRes?.employees || empRes?.data || []);
    } catch (e) {
      console.error(e);
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  const getReporterDisplay = (item) => {
    let name = item.reporter_name || "Admin";
    const reporterObj = item.reporter_id;
    let reporterIdStr = "";

    if (reporterObj) {
        reporterIdStr = typeof reporterObj === 'object' ? reporterObj._id.toString() : String(reporterObj);
    }

    // 2. Tìm trong danh sách nhân viên (Chuẩn hóa ID về String để so sánh)
    const foundEmployee = employees.find(e => {
        // e.user_id có thể là string hoặc object
        const empUserIdStr = typeof e.user_id === 'object' ? e.user_id._id?.toString() : String(e.user_id);
        return empUserIdStr === reporterIdStr;
    });

    let roleCode = "employee";

    if (foundEmployee && foundEmployee.position) {
        roleCode = foundEmployee.position;
    } else {
        if (typeof reporterObj === 'object' && reporterObj.system_role) {
            roleCode = reporterObj.system_role;
        } else if (item.reporter_role) {
            roleCode = item.reporter_role;
        }
    }

    const roleMap = {
        manager: "Quản lý",
        admin: "Quản trị viên",
        receptionist: "Lễ tân",
        housekeeper: "Buồng phòng",
        technician: "Kỹ thuật",
        security: "An ninh",
        it: "IT",
        accountant: "Kế toán",
        customer_service: "CSKH",
        employee: "Nhân viên",
        customer: "Khách hàng"
    };

    return {
        name,
        role: roleMap[roleCode] || roleCode
    };
  };

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
        {incidents.map(item => {
            const reporter = getReporterDisplay(item);

            return (
              <div
                key={item._id}
                className="p-5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                    <div className="flex justify-between mb-2">
                        <span className={`text-[10px] uppercase font-black px-2 py-1 rounded border ${severityStyle[item.severity]}`}>
                            {item.severity}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                            <FiClock /> {new Date(item.occured_at).toLocaleDateString("vi-VN")}
                        </span>
                    </div>

                    <h3 className="font-bold text-gray-900 flex items-center gap-1 mb-2">
                        <FiMapPin className="text-gray-400" size={14}/>
                        {item.room_id ? `Phòng ${item.room_id.room_number}` : "Khu vực chung"}
                    </h3>

                    <div className="flex items-center gap-2 mb-3 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <div className="bg-white p-1.5 rounded-full border border-gray-200 text-indigo-500">
                            <FiUser size={14}/>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Người báo cáo</span>
                            <div className="text-xs font-bold text-gray-800 flex items-center gap-1">
                                {reporter.name}
                                <span className="text-gray-300 mx-1">|</span>
                                <span className="text-indigo-600 font-extrabold">{reporter.role}</span>
                            </div>
                        </div>
                    </div>

                    <p className="text-sm text-gray-500 line-clamp-2 mb-4 italic pl-1 border-l-2 border-gray-100">
                        "{item.description}"
                    </p>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-50 mt-auto">
                  <span className={`text-[11px] font-bold px-2 py-1 rounded capitalize ${statusStyle[item.status] || "bg-gray-100"}`}>
                      {statusLabel[item.status] || item.status}
                  </span>

                  <button
                    onClick={() => setSelected(item)}
                    className="text-xs bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition"
                  >
                    Chi tiết <FiArrowRight/>
                  </button>
                </div>
              </div>
            );
        })}

        {!loading && incidents.length === 0 && (
          <div className="col-span-2 text-center py-10 text-gray-400 italic">
            Chưa có sự cố nào được ghi nhận.
          </div>
        )}
      </div>

      {showCreate && (
        <CreateIncidentForm onClose={() => setShowCreate(false)} onSuccess={fetchData} />
      )}

      {selected && (
        <IncidentDetailModal
           incident={selected}
           onClose={() => setSelected(null)}
           onUpdated={fetchData}
         />
      )}
    </div>
  );
}