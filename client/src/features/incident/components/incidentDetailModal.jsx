import React, { useEffect, useState } from "react";
import { FiX, FiCheckCircle } from "react-icons/fi";
import { incidentApi } from "../../api/incidentApi.js";
import { employeeApi } from "../../api/employeeApi.js";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import CreateCompensationModal from "./createCompensationModal.jsx";

export default function IncidentDetailModal({ incident, onClose, onUpdated }) {
  const { user } = useAuth();

  const incidentAssigneeId = incident.assignee_info?.assignee_id || "";

  const [department, setDepartment] = useState(incident?.department || "");
  const [assignee, setAssignee] = useState(incidentAssigneeId ? incidentAssigneeId.toString() : "");
  const [severityAdmin, setSeverityAdmin] = useState(incident?.severity_admin || incident?.severity_user);
  const [status, setStatus] = useState(incident?.status || 'new');
  const [processingNote, setProcessingNote] = useState(incident?.processing_note || "");

  const [employees, setEmployees] = useState([]);
  const [currentEmployeeId, setCurrentEmployeeId] = useState(null);
  const [showCompensation, setShowCompensation] = useState(false);

  const isManager = user?.role === "manager" || user?.role === "admin";

  useEffect(() => {
    employeeApi.getAllEmployees().then(res => {
        const all = res?.employees || res?.data || [];

        const myEmp = all.find(e => {
            const uid = typeof e.user_id === 'object' ? e.user_id._id : e.user_id;
            return String(uid) === String(user?.userId || user?._id);
        });
        if (myEmp) setCurrentEmployeeId(myEmp._id);
        if (department) {
            setEmployees(all.filter(e => e.position === department));
        } else {
            setEmployees(all);
        }
    }).catch(() => setEmployees([]));
  }, [department, user]);

  const isAssignee = String(incidentAssigneeId) === String(currentEmployeeId);

  const POSITIONS = [
    { id: "manager", label: "Quản lý" },
    { id: "receptionist", label: "Lễ tân" },
    { id: "housekeeper", label: "Buồng phòng" },
    { id: "technician", label: "Kỹ thuật / Bảo trì" },
    { id: "customer_service", label: "CSKH" },
    { id: "security", label: "An ninh" },
    { id: "it", label: "IT / Hệ thống" },
  ];

  const getRoleLabel = (roleId) => POSITIONS.find(p => p.id === roleId)?.label || roleId;

  const getReporterName = () => {
    if (incident.reporter_name) return incident.reporter_name;
    if (incident.reporter_id && typeof incident.reporter_id === 'object') {
        return incident.reporter_id.full_name || incident.reporter_id.username || incident.reporter_id.email;
    }
    return "Ẩn danh / Admin";
  };

  const handleAssigneeChange = (empId) => {
    setAssignee(empId);
  };

  const handleUpdate = async (nextStatus = null) => {
    try {
      const statusToSave = nextStatus || status;
      const payload = {
        department,
        assignee,
        severity_admin: severityAdmin,
        status: statusToSave,
        processing_note: processingNote,
        timeline_push: {
          at: new Date().toISOString(),
          by: user?.full_name || user?.username || "User",
          action: isManager ? "manager_update" : "employee_update",
          note: `Cập nhật trạng thái: ${statusToSave}`
        }
      };

      await incidentApi.updateIncident(incident._id, payload);
      alert("Cập nhật thành công!");
      onUpdated?.();
      onClose();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    }
  };

  const handleAssign = async () => {
    if (!assignee) return alert("Vui lòng chọn người xử lý");
    try {
        await incidentApi.assignIncident(incident._id, {
            assignee_id: assignee,
            note: processingNote,
        });
        alert("Đã phân công xử lý sự cố");
        onUpdated?.();
        onClose();
    } catch (err) {
        alert(err.response?.data?.message || "Lỗi phân công");
    }
  };

  const handleResolve = async () => {
    if(!processingNote) return alert("Vui lòng nhập kết quả xử lý vào ghi chú.");
    if(!window.confirm("Xác nhận đã khắc phục xong sự cố?")) return;

    try {
        await incidentApi.resolveIncident(incident._id, { note: processingNote });
        alert("Đã báo cáo hoàn thành!");
        onUpdated?.();
        onClose();
    } catch (err) {
        alert("Lỗi: " + (err.response?.data?.message || err.message));
    }
  };

  const handleClose = async () => {
      if(!window.confirm("Xác nhận đóng sự cố này?")) return;
      try {
          await incidentApi.closeIncident(incident._id, { note: processingNote });
          alert("Đã đóng hồ sơ thành công!");
          onUpdated?.();
          onClose();
      } catch (err) {
          alert("Lỗi: " + (err.response?.data?.message || err.message));
      }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">Xử lý Sự cố</h3>
            <div className="text-xs text-gray-500 mt-1">
                Trạng thái: <span className="font-mono font-bold text-indigo-600 uppercase">{status}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition"><FiX size={20}/></button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Thông tin sự cố */}
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-sm space-y-3">
             <div className="flex justify-between">
                <span className="font-bold text-blue-800">Người báo: {getReporterName()}</span>
                <span className="text-gray-500 text-xs">{new Date(incident.occured_at).toLocaleString("vi-VN")}</span>
             </div>
             <div className="flex gap-2 text-xs">
                <span className="font-bold text-gray-500 uppercase">Nguyên nhân:</span>
                <span className={`font-bold uppercase ${incident.caused_by !== 'other' ? 'text-red-600' : 'text-gray-700'}`}>
                    {incident.caused_by === 'customer' ? 'Khách hàng' : incident.caused_by === 'employee' ? 'Nhân viên' : 'Khách quan'}
                    {incident.causer_name && ` - ${incident.causer_name}`}
                </span>
             </div>
             <p className="bg-white p-3 rounded border border-blue-100 italic text-gray-700">"{incident.description}"</p>
          </div>

          <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                  <h4 className="font-bold text-gray-800 text-sm uppercase">Thông tin xử lý</h4>
              </div>

              {isManager ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Bộ phận</label>
                          <select
                              value={department}
                              onChange={e => { setDepartment(e.target.value); setAssignee(""); }}
                              className="w-full border rounded p-2 text-sm"
                              disabled={status === 'closed'}
                          >
                              <option value="">-- Chọn bộ phận --</option>
                              {POSITIONS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Người thực hiện</label>
                          <select
                              value={assignee}
                              onChange={e => handleAssigneeChange(e.target.value)}
                              className="w-full border rounded p-2 text-sm"
                              disabled={!department || status === 'closed'}
                          >
                              <option value="">-- Chọn nhân viên --</option>
                              {employees.map(e => (
                                  <option key={e._id.toString()} value={e._id.toString()}>
                                      {e.full_name} ({getRoleLabel(e.position)})
                                  </option>
                              ))}
                          </select>
                      </div>
                  </div>
              ) : (
                  <div className="bg-gray-50 p-3 rounded border text-sm">
                      Người xử lý: <b>{
                        employees.find(e => String(e._id) === String(incidentAssigneeId))?.full_name ||
                        incident.assignee_info?.assignee_name ||
                        "Chưa phân công"
                      }</b>
                  </div>
              )}

              <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Ghi chú / Kết quả</label>
                  <textarea
                      value={processingNote}
                      onChange={e => setProcessingNote(e.target.value)}
                      className="w-full border rounded p-2 min-h-[80px] text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      disabled={status === 'closed' || (!isManager && !isAssignee)}
                      placeholder={isAssignee ? "Nhập kết quả xử lý..." : "Ghi chú..."}
                  />
              </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
            <button onClick={onClose} className="px-4 py-2 rounded text-gray-600 font-bold hover:bg-white text-sm border border-gray-200">
                Thoát
            </button>

            {/* QUẢN LÝ */}
            {isManager && status !== 'closed' && (
                <>
                    {incident.caused_by !== 'other' && (
                        <button
                            onClick={() => setShowCompensation(true)}
                            className="px-4 py-2 rounded bg-orange-100 text-orange-700 font-bold hover:bg-orange-200 text-sm border border-orange-200"
                        >
                           Tạo Đền Bù
                        </button>
                    )}

                    <button
                      onClick={() => {
                        if (status === "new" && assignee) {
                          handleAssign();
                        } else {
                          handleUpdate();
                        }
                      }}
                      className="px-5 py-2 rounded bg-indigo-600 text-white font-bold hover:bg-indigo-700 text-sm shadow-sm"
                    >
                      Lưu thay đổi
                    </button>

                    {(status === 'resolved' || status === 'fixed') && (
                        <button
                            onClick={handleClose}
                            className="px-5 py-2 rounded bg-gray-900 text-white font-bold hover:bg-black text-sm shadow-sm flex items-center gap-2"
                        >
                             Duyệt & Đóng Hồ Sơ
                        </button>
                    )}
                </>
            )}

            {/* NHÂN VIÊN ĐƯỢC PHÂN CÔNG */}
            {!isManager && isAssignee && (status === 'in_progress' || status === 'new') && (
                <button
                    onClick={handleResolve}
                    className="px-5 py-2 rounded bg-green-600 text-white font-bold hover:bg-green-700 text-sm shadow-sm flex items-center gap-2"
                >
                     <FiCheckCircle/> Báo cáo Xong
                </button>
            )}

            {status === 'closed' && (
                <span className="px-4 py-2 bg-gray-200 text-gray-500 rounded text-sm font-bold cursor-not-allowed">
                     Hồ sơ đã đóng
                </span>
            )}
        </div>
      </div>

      {showCompensation && (
        <CreateCompensationModal
            incident={incident}
            onClose={() => setShowCompensation(false)}
            onSuccess={() => {
                onClose();
                onUpdated?.();
            }}
        />
      )}
    </div>
  );
}