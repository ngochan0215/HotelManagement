import React, { useEffect, useState } from "react";
import { FiX, FiCheckCircle } from "react-icons/fi";
import { incidentApi } from "../../api/incidentApi.js";
import { employeeApi } from "../../api/employeeApi.js";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import CreateCompensationModal from "./createCompensationModal.jsx";
import Toast from "../../../components/toast.jsx";
import ConfirmModal from "../../../components/confirmModal.jsx";

export default function IncidentDetailModal({ incident, onClose, onUpdated }) {
  const { user } = useAuth();
  const [incidentData, setIncidentData] = useState(incident);

  // Fetch chi tiết incident để có thông tin mới nhất về compensate_ticket
  useEffect(() => {
    if (incident?._id) {
      incidentApi.getIncidentById(incident._id)
        .then(res => {
          if (res?.data) {
            setIncidentData(res.data);
          }
        })
        .catch(err => {
          console.error("Error fetching incident details:", err);
        });
    }
  }, [incident?._id]);

  const incidentAssigneeId = incidentData?.assignee_info?.assignee_id || "";

  const [department, setDepartment] = useState(incidentData?.department || "");
  const [assignee, setAssignee] = useState(incidentAssigneeId ? incidentAssigneeId.toString() : "");
  const [severityAdmin, setSeverityAdmin] = useState(incidentData?.severity_admin || incidentData?.severity_user);
  const [status, setStatus] = useState(incidentData?.status || 'new');
  const [processingNote, setProcessingNote] = useState(incidentData?.processing_note || "");

  // Cập nhật processingNote khi incidentData thay đổi
  useEffect(() => {
    if (incidentData?.processing_note) {
      setProcessingNote(incidentData.processing_note);
    }
    if (incidentData?.department) {
      setDepartment(incidentData.department);
    }
    if (incidentData?.severity_admin || incidentData?.severity_user) {
      setSeverityAdmin(incidentData.severity_admin || incidentData.severity_user);
    }
    if (incidentData?.status) {
      setStatus(incidentData.status);
    }
    if (incidentData?.assignee_info?.assignee_id) {
      setAssignee(incidentData.assignee_info.assignee_id.toString());
    }
  }, [incidentData]);

  const [employees, setEmployees] = useState([]);
  const [currentEmployeeId, setCurrentEmployeeId] = useState(null);
  const [showCompensation, setShowCompensation] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, title: "", message: "", onConfirm: null });

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
    if (incidentData.reporter_name) return incidentData.reporter_name;
    if (incidentData.reporter_id && typeof incidentData.reporter_id === 'object') {
        return incidentData.reporter_id.full_name || incidentData.reporter_id.username || incidentData.reporter_id.email;
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

      await incidentApi.updateIncident(incidentData._id, payload);
      setToast({ message: "Cập nhật thành công!", type: "success" });
      onUpdated?.();
      onClose();
    } catch (err) {
      setToast({ message: "Lỗi: " + (err.response?.data?.message || err.message), type: "error" });
    }
  };

  const handleAssign = async () => {
    if (!assignee) {
      setToast({ message: "Vui lòng chọn người xử lý", type: "error" });
      return;
    }
    try {
        await incidentApi.assignIncident(incidentData._id, {
            assignee_id: assignee,
            note: processingNote,
        });
        setToast({ message: "Đã phân công xử lý sự cố", type: "success" });
        onUpdated?.();
        onClose();
    } catch (err) {
        setToast({ message: err.response?.data?.message || "Lỗi phân công", type: "error" });
    }
  };

  const handleResolve = async () => {
    if (!processingNote) {
      setToast({ message: "Vui lòng nhập kết quả xử lý vào ghi chú.", type: "error" });
      return;
    }
    setConfirmState({
      open: true,
      title: "Xác nhận hoàn thành",
      message: "Xác nhận đã khắc phục xong sự cố?",
      onConfirm: async () => {
        setConfirmState({ open: false, title: "", message: "", onConfirm: null });
        try {
          await incidentApi.resolveIncident(incidentData._id, { note: processingNote });
          setToast({ message: "Đã báo cáo hoàn thành!", type: "success" });
          onUpdated?.();
          onClose();
        } catch (err) {
          setToast({ message: "Lỗi: " + (err.response?.data?.message || err.message), type: "error" });
        }
      }
    });
  };

  const handleClose = async () => {
    setConfirmState({
      open: true,
      title: "Đóng hồ sơ",
      message: "Xác nhận đóng sự cố này?",
      onConfirm: async () => {
        setConfirmState({ open: false, title: "", message: "", onConfirm: null });
        try {
          await incidentApi.closeIncident(incidentData._id, { note: processingNote });
          setToast({ message: "Đã đóng hồ sơ thành công!", type: "success" });
          onUpdated?.();
          onClose();
        } catch (err) {
          setToast({ message: "Lỗi: " + (err.response?.data?.message || err.message), type: "error" });
        }
      }
    });
  };

  return (
    <>
    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    <ConfirmModal
      open={confirmState.open}
      title={confirmState.title}
      message={confirmState.message}
      onConfirm={confirmState.onConfirm}
      onCancel={() => setConfirmState({ open: false, title: "", message: "", onConfirm: null })}
    />
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
                <span className="text-gray-500 text-xs">{new Date(incidentData.occured_at).toLocaleString("vi-VN")}</span>
             </div>
             <div className="flex gap-2 text-xs">
                <span className="font-bold text-gray-500 uppercase">Nguyên nhân:</span>
                <span className={`font-bold uppercase ${incidentData.caused_by !== 'other' ? 'text-red-600' : 'text-gray-700'}`}>
                    {incidentData.caused_by === 'customer' ? 'Khách hàng' : incidentData.caused_by === 'employee' ? 'Nhân viên' : 'Khách quan'}
                    {incidentData.causer_name && ` - ${incidentData.causer_name}`}
                </span>
             </div>
             <p className="bg-white p-3 rounded border border-blue-100 italic text-gray-700">"{incidentData.description}"</p>
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
                        incidentData.assignee_info?.assignee_name ||
                        "Chưa phân công"
                      }</b>
                  </div>
              )}

              {/* Hiển thị ghi chú hiện tại của nhân viên (nếu có) - chỉ cho quản lý xem */}
              {isManager && incidentData.processing_note && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-green-700 uppercase">Ghi chú của nhân viên:</span>
                    {incidentData.assignee_info?.assignee_name && (
                      <span className="text-xs text-green-600">({incidentData.assignee_info.assignee_name})</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 bg-white p-2 rounded border border-green-100 whitespace-pre-wrap">
                    {incidentData.processing_note}
                  </div>
                </div>
              )}

              <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {isManager ? "Ghi chú / Kết quả (Có thể chỉnh sửa)" : "Ghi chú / Kết quả"}
                  </label>
                  <textarea
                      value={processingNote}
                      onChange={e => setProcessingNote(e.target.value)}
                      className="w-full border rounded p-2 min-h-[80px] text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      disabled={status === 'closed' || (!isManager && !isAssignee)}
                      placeholder={isAssignee ? "Nhập kết quả xử lý..." : isManager ? "Nhập hoặc chỉnh sửa ghi chú..." : "Ghi chú..."}
                  />
                  {!isManager && isAssignee && (
                    <div className="text-xs text-gray-500 mt-1 italic">
                      * Vui lòng nhập kết quả xử lý trước khi báo cáo hoàn thành
                    </div>
                  )}
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
                    {incidentData.caused_by !== 'other' && (
                        <button
                            onClick={() => setShowCompensation(true)}
                            disabled={incidentData.has_compensate_ticket}
                            className={`px-4 py-2 rounded font-bold text-sm border ${
                                incidentData.has_compensate_ticket
                                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                    : "bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200"
                            }`}
                            title={incidentData.has_compensate_ticket ? "Sự cố này đã có phiếu đền bù" : "Tạo phiếu đền bù"}
                        >
                           {incidentData.has_compensate_ticket ? "Đã có phiếu đền bù" : "Tạo Đền Bù"}
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
            incident={incidentData}
            onClose={() => setShowCompensation(false)}
            onSuccess={() => {
                // Refresh incident data sau khi tạo phiếu đền bù
                if (incidentData?._id) {
                  incidentApi.getIncidentById(incidentData._id)
                    .then(res => {
                      if (res?.data) {
                        setIncidentData(res.data);
                      }
                    })
                    .catch(err => console.error("Error refreshing incident:", err));
                }
                onUpdated?.();
            }}
        />
      )}
    </div>
    </>
  );
}