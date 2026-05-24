import React, { useEffect, useState } from "react";
import { FiClock, FiPlus, FiUser, FiMapPin, FiArrowRight, FiFilter, 
  FiCheckCircle, FiAlertCircle, FiLoader, FiCheckSquare, FiArchive, FiTool } 
from "react-icons/fi";

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

const statusLabel = {
  new: "Mới tạo",
  in_progress: "Đang xử lý",
  resolved: "Chờ duyệt",
  closed: "Hoàn thành",
};

export default function IncidentListTab() {
  const { user } = useAuth();

  // xác định role của user
  const roleRaw = user?.system_role || user?.role || user?.data?.system_role || "";
  const userRole = String(roleRaw).toLowerCase();
  const isManager = userRole === "manager" || userRole === "admin";

  // khởi tạo state, mặc định tab đầu tiên sẽ là "new" cho manager, "my_assign" cho employee
  const [activeTab, setActiveTab] = useState(isManager ? "new" : "my_assign");

  const [incidents, setIncidents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);

  // Reset tab khi đổi user
  useEffect(() => {
    setActiveTab(isManager ? "new" : "my_assign");
  }, [isManager]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = isManager ? { status: activeTab } : {};

      if (isManager) {
      const [incidentRes, empRes] = await Promise.all([
        incidentApi.getAllIncidents(params),
        employeeApi.getAllEmployees(),
      ]);

      setIncidents(Array.isArray(incidentRes) ? incidentRes : incidentRes?.data ?? []);
      setEmployees(empRes?.employees || empRes?.data || []);

      } else {
        const [incidentRes, profileRes] = await Promise.all([
          incidentApi.getAllIncidents(params),
          employeeApi.getProfile(),
        ]);

        setIncidents(Array.isArray(incidentRes) ? incidentRes : incidentRes?.data ?? []);
        const ownProfile = profileRes?.employee ?? profileRes;
        setEmployees(ownProfile ? [ownProfile] : []);
      }
    } catch (e) {
      console.error(e);
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  };

  // chạy lại khi đổi tab hoặc đổi quyền
  useEffect(() => { fetchData(); }, [activeTab, isManager]);

  const currentEmployee = employees.find(e => {
      const uid = typeof e.user_id === 'object' ? e.user_id._id : e.user_id;
      return String(uid) === String(user?.userId || user?._id);
  });
  const currentEmployeeId = currentEmployee?._id;
  const currentUserId = user?.userId || user?._id;

  const getDisplayedIncidents = () => {
    if (isManager) return incidents;

    return incidents.filter(item => {
      if (activeTab === 'my_assign') {
          const assignId = item.assignee_info?.assignee_id;
          return String(assignId) === String(currentEmployeeId);
      }
      if (activeTab === 'my_report') {
          const repId = item.reporter_id?._id || item.reporter_id;
          return String(repId) === String(currentUserId);
      }
      if (activeTab === 'my_cause') {
          const causeId = item.causer_id?._id || item.causer_id;
          return String(causeId) === String(currentUserId);
      }
      return true;
    });
  };

  const displayedList = getDisplayedIncidents();

  // Helper hiển thị tên
  const getReporterDisplay = (item) => {
    let name = item.reporter_name || "N/A";
    const reporterObj = item.reporter_id;
    let reporterIdStr = "";
    if (reporterObj) reporterIdStr = typeof reporterObj === 'object' ? reporterObj._id.toString() : String(reporterObj);

    const foundEmployee = employees.find(e => {
        const empUserIdStr = typeof e.user_id === 'object' ? e.user_id._id?.toString() : String(e.user_id);
        return empUserIdStr === reporterIdStr;
    });

    let roleCode = "employee";
    if (foundEmployee && foundEmployee.position) roleCode = foundEmployee.position;
    else if (typeof reporterObj === 'object' && reporterObj.system_role) roleCode = reporterObj.system_role;

    const roleMap = {
        manager: "Quản lý", admin: "Admin", receptionist: "Lễ tân", housekeeper: "Buồng phòng",
        technician: "Kỹ thuật", security: "An ninh", it: "IT", employee: "Nhân viên", customer: "Khách"
    };
    return { name, role: roleMap[roleCode] || roleCode };
  };

  const TabButton = ({ id, label, icon: Icon, colorClass }) => (
    <button
        onClick={() => setActiveTab(id)}
        className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-2 transition whitespace-nowrap
        ${activeTab === id ? `bg-white shadow-sm ${colorClass}` : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
    >
        <Icon size={14} /> {label}
    </button>
  );

  return (
    <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-t-0 border-gray-100 space-y-4">

      {/* --- HEADER CHỨA TABS --- */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto max-w-full no-scrollbar">

            {/* LOGIC HIỂN THỊ TAB DỰA TRÊN ROLE */}
            {isManager ? (
                // VIEW CỦA MANAGER: Lọc theo quy trình
                <>
                    <TabButton id="new" label="Mới" icon={FiAlertCircle} colorClass="text-red-600" />
                    <TabButton id="in_progress" label="Đang xử lý" icon={FiLoader} colorClass="text-blue-600" />
                    <TabButton id="resolved" label="Chờ duyệt" icon={FiCheckSquare} colorClass="text-green-600" />
                    <TabButton id="closed" label="Hoàn thành" icon={FiArchive} colorClass="text-gray-800" />
                </>
            ) : (
                // VIEW CỦA EMPLOYEE: Lọc theo trách nhiệm
                <>
                    <TabButton id="my_assign" label="Tôi xử lý" icon={FiTool} colorClass="text-green-600" />
                    <TabButton id="my_report" label="Tôi báo cáo" icon={FiAlertCircle} colorClass="text-blue-600" />
                    <TabButton id="my_cause" label="Tôi gây ra" icon={FiUser} colorClass="text-red-600" />
                </>
            )}

        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition shadow-red-200 shadow-lg whitespace-nowrap"
        >
          <FiPlus /> Báo cáo sự cố
        </button>
      </div>

      {/* --- GRID HIỂN THỊ DANH SÁCH --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
            <div className="col-span-2 py-10 text-center text-gray-400">Đang tải dữ liệu...</div>
        ) : (
            displayedList.map(item => {
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
                            {item.room_id ? `Phòng ${item.room_info.room_number}` : "Khu vực chung"}
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
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded uppercase">
                            {/* Hiển thị label tương ứng với Status */}
                            {statusLabel[item.status] || item.status}
                        </span>

                        <button
                            onClick={() => setSelected(item)}
                            className="text-xs bg-white border border-gray-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-gray-600 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition"
                        >
                            Chi tiết <FiArrowRight/>
                        </button>
                    </div>
                </div>
                );
            })
        )}

        {!loading && displayedList.length === 0 && (
          <div className="col-span-2 text-center py-10 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <FiAlertCircle className="mx-auto text-gray-300 mb-2" size={24}/>
            Không tìm thấy sự cố nào.
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