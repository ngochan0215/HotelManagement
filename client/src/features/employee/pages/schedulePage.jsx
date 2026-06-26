import React, { useEffect, useMemo, useState } from "react";
import { parse, format, parseISO, subDays } from "date-fns";
import {
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiEdit,
  FiFilter,
  FiLoader,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTrash2,
  FiUsers,
  FiX,
} from "react-icons/fi";

import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import ConfirmModal from "../../../components/confirmModal.jsx";
import Toast from "../../../components/toast.jsx";
import { employeeApi } from "../../api/employeeApi.js";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import { getAuthIdentity, isAdminRole } from "../../auth/utils/roleRedirect.js";

const EMPLOYEE_POSITIONS = ["receptionist", "technician", "customer_service", "housekeeper", "accountant", "it"];

const DAY_LABELS = {
  monday: "Thứ 2",
  tuesday: "Thứ 3",
  wednesday: "Thứ 4",
  thursday: "Thứ 5",
  friday: "Thứ 6",
  saturday: "Thứ 7",
  sunday: "Chủ nhật",
};

const SHIFT_LABELS = {
  morning: "Ca sáng",
  afternoon: "Ca chiều",
  night: "Ca tối",
};

const ROLE_LABELS = {
  receptionist: "Lễ tân",
  technician: "Kỹ thuật",
  customer_service: "CSKH",
  housekeeper: "Buồng phòng",
  manager: "Quản lý",
  accountant: "Kế toán",
  it: "IT",
};

const SHIFT_FORM_DEFAULT = {
  work_day: "monday",
  shift_type: "morning",
  begin_time: "08:00",
  end_time: "12:00",
  required_staff: {
    receptionist: 1,
    technician: 0,
    customer_service: 0,
    housekeeper: 0,
    manager: 0,
    accountant: 0,
    it: 0,
  },
};

const makeIsoDate = (date = new Date()) => new Date(date).toISOString().slice(0, 10);

const tomorrowIsoDate = () => makeIsoDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const fmtDate = (value) => {
  const date = safeDate(value);
  return date ? format(date, "dd/MM/yyyy") : "--";
};

const fmtDateTime = (value) => {
  const date = safeDate(value);
  return date ? format(date, "dd/MM/yyyy HH:mm") : "--";
};

const fmtTime = (value) => {
  if (!value) return "--";
  return String(value).slice(0, 5);
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const readApiData = (result) => result?.data ?? result ?? null;

const getStatusMeta = (status) => {
  const value = normalizeText(status);
  if (value === "approved" || value === "active") return { label: "Đã duyệt", tone: "emerald" };
  if (value === "pending") return { label: "Chờ duyệt", tone: "amber" };
  if (value === "rejected") return { label: "Từ chối", tone: "rose" };
  if (value === "cancelled" || value === "canceled") return { label: "Đã hủy", tone: "slate" };
  if (value === "present") return { label: "Có mặt", tone: "emerald" };
  if (value === "late") return { label: "Đi trễ", tone: "amber" };
  if (value === "absent") return { label: "Vắng", tone: "rose" };
  if (value === "on_leave") return { label: "Nghỉ phép", tone: "blue" };
  if (value === "early_leave") return { label: "Về sớm", tone: "orange" };
  return { label: status || "--", tone: "slate" };
};

const toneClasses = {
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
};

function Badge({ label, tone = "slate" }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClasses[tone] || toneClasses.slate}`}>
      {label}
    </span>
  );
}

function flattenMySchedule(payload) {
  const rows = [];
  const byWeek = payload?.by_week || {};
  Object.values(byWeek).forEach((week) => {
    Object.entries(week?.by_weekday || {}).forEach(([work_day, schedules]) => {
      (schedules || []).forEach((schedule) => {
        rows.push({ ...schedule, work_day });
      });
    });
  });
  return rows.sort((a, b) => {
    const diff = new Date(a.work_date) - new Date(b.work_date);
    if (diff !== 0) return diff;
    return String(a.begin_time || "").localeCompare(String(b.begin_time || ""));
  });
}

function flattenManagerSchedules(payload) {
  const rows = [];
  (payload?.employees || []).forEach((employee) => {
    const schedules = Array.isArray(employee?.schedules)
      ? employee.schedules
      : Object.values(employee?.by_weekday || {}).flat();
    (schedules || []).forEach((schedule) => {
      rows.push({
        ...schedule,
        employee_info: employee,
      });
    });
  });
  return rows.sort((a, b) => {
    const diff = new Date(a.work_date) - new Date(b.work_date);
    if (diff !== 0) return diff;
    return String(a.begin_time || "").localeCompare(String(b.begin_time || ""));
  });
}

function flattenPendingRequests(payload) {
  return Array.isArray(payload?.requests) ? payload.requests : [];
}

function groupAvailableShifts(payload) {
  const grouped = payload?.by_weekday || {};
  return Object.entries(grouped).reduce((acc, [day, value]) => {
    acc[day] = {
      date: value?.date,
      disabled: value?.disabled,
      reason: value?.reason,
      shifts: Array.isArray(value?.shifts) ? value.shifts : [],
    };
    return acc;
  }, {});
}

function RejectReasonModal({ open, title, onCancel, onConfirm, loading }) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600">Vui lòng nhập lý do từ chối hợp đồng này.</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          placeholder="Lý do từ chối..."
        />
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={loading || !note.trim()}
            onClick={() => onConfirm(note.trim())}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Đang xử lý..." : "Từ chối"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const { user } = useAuth();
  const { role, position } = getAuthIdentity(user);
  const showManagerView = isAdminRole(role);
  const canEditShifts = normalizeText(role) === "admin";

  const initialTab = showManagerView ? "manager-schedules" : "my-schedule";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  const [mySchedulePayload, setMySchedulePayload] = useState(null);
  const [availableShiftPayload, setAvailableShiftPayload] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [managerSchedulesPayload, setManagerSchedulesPayload] = useState(null);
  const [pendingRequestsPayload, setPendingRequestsPayload] = useState(null);
  const [shiftsPayload, setShiftsPayload] = useState(null);
  const [employeeOptions, setEmployeeOptions] = useState([]);

  const [myScheduleDate, setMyScheduleDate] = useState(makeIsoDate());
  const [myScheduleStatus, setMyScheduleStatus] = useState("all");
  const [myScheduleShiftType, setMyScheduleShiftType] = useState("all");
  const [availableDate, setAvailableDate] = useState(tomorrowIsoDate());
  const [managerWorkDate, setManagerWorkDate] = useState(makeIsoDate());
  const [managerEmployeeId, setManagerEmployeeId] = useState("all");
  const [managerStatus, setManagerStatus] = useState("all");
  const [managerContractStatus, setManagerContractStatus] = useState("all");
  const [managerShiftDay, setManagerShiftDay] = useState("all");
  const [managerShiftType, setManagerShiftType] = useState("all");
  const [pendingRoleFilter, setPendingRoleFilter] = useState("all");
  const [attendanceStart, setAttendanceStart] = useState(makeIsoDate(subDays(new Date(), 29)));
  const [attendanceEnd, setAttendanceEnd] = useState(makeIsoDate());

  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [shiftForm, setShiftForm] = useState(SHIFT_FORM_DEFAULT);
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, title: "", message: "", onConfirm: null });
  const [shiftConfirmState, setShiftConfirmState] = useState({ open: false, shift: null });
  const [rejectState, setRejectState] = useState({ open: false, contract: null, loading: false });
  const [registeringShiftId, setRegisteringShiftId] = useState("");
  const [cancellingScheduleId, setCancellingScheduleId] = useState("");
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  const loadManagerData = async () => {
    setLoading(true);
    setError("");
    try {
      const scheduleQuery = {
        ...(managerEmployeeId !== "all" ? { employee_id: managerEmployeeId } : {}),
        ...(managerWorkDate ? { work_date: managerWorkDate } : {}),
        ...(managerStatus !== "all" ? { status: managerStatus } : {}),
        ...(managerContractStatus !== "all" ? { contract_status: managerContractStatus } : {}),
        ...(managerShiftDay !== "all" ? { work_day: managerShiftDay } : {}),
        ...(managerShiftType !== "all" ? { shift_type: managerShiftType } : {}),
        raw: "true",
      };

      const [schedulesRes, pendingRes, shiftsRes, employeesRes] = await Promise.all([
        employeeApi.getAllSchedules(scheduleQuery),
        employeeApi.getPendingScheduleRequests(pendingRoleFilter !== "all" ? { role: pendingRoleFilter } : {}),
        employeeApi.getAllShifts({
          ...(managerShiftDay !== "all" ? { work_day: managerShiftDay } : {}),
          ...(managerShiftType !== "all" ? { shift_type: managerShiftType } : {}),
        }),
        employeeApi.getAllEmployees(),
      ]);

      setManagerSchedulesPayload(readApiData(schedulesRes));
      setPendingRequestsPayload(readApiData(pendingRes));
      setShiftsPayload(readApiData(shiftsRes));
      setEmployeeOptions(Array.isArray(employeesRes?.employees) ? employeesRes.employees : []);
      setError("");
    } catch (err) {
      setError(err.message || "Không thể tải lịch làm việc. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeeData = async () => {
    setLoading(true);
    setError("");
    try {
      const scheduleQuery = {
        ...(myScheduleDate ? { work_date: myScheduleDate } : {}),
        ...(myScheduleStatus !== "all" ? { status: myScheduleStatus } : {}),
        ...(myScheduleShiftType !== "all" ? { shift_type: myScheduleShiftType } : {}),
      };

      const [myScheduleRes, availableShiftRes, attendanceRes] = await Promise.all([
        employeeApi.getMySchedule(scheduleQuery),
        employeeApi.getAvailableShifts(availableDate ? { work_date: availableDate } : {}),
        employeeApi.getMyAttendanceSummary({
        start_date: attendanceStart,
        end_date: attendanceEnd,
        }),
      ]);

      setMySchedulePayload(readApiData(myScheduleRes));
      setAvailableShiftPayload(readApiData(availableShiftRes));
      setAttendanceSummary(readApiData(attendanceRes));
      setError("");
    } catch (err) {
      setError(err.message || "Không thể tải lịch làm việc. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showManagerView) {
      void loadManagerData();
    } else {
      void loadEmployeeData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showManagerView,
    managerWorkDate,
    managerEmployeeId,
    managerStatus,
    managerContractStatus,
    managerShiftDay,
    managerShiftType,
    pendingRoleFilter,
    myScheduleDate,
    myScheduleStatus,
    myScheduleShiftType,
    availableDate,
    attendanceStart,
    attendanceEnd,
  ]);

  const myRows = useMemo(() => flattenMySchedule(mySchedulePayload), [mySchedulePayload]);
  const managerRows = useMemo(() => flattenManagerSchedules(managerSchedulesPayload), [managerSchedulesPayload]);
  const pendingRequests = useMemo(() => flattenPendingRequests(pendingRequestsPayload), [pendingRequestsPayload]);
  const availableShifts = useMemo(() => groupAvailableShifts(availableShiftPayload), [availableShiftPayload]);
  const shiftRows = useMemo(() => Array.isArray(shiftsPayload?.shifts) ? shiftsPayload.shifts : shiftsPayload?.data?.shifts || [], [shiftsPayload]);

  const openShiftModal = (shift = null) => {
    if (shift && !canEditShifts) {
      showToast("Bạn không có quyền sửa ca làm.", "error");
      return;
    }

    setEditingShift(shift);
    setShiftForm(shift ? {
      work_day: shift.work_day || "monday",
      shift_type: shift.shift_type || "morning",
      begin_time: shift.begin_time || "08:00",
      end_time: shift.end_time || "12:00",
      required_staff: {
        receptionist: Number(shift.required_staff?.receptionist || 0),
        technician: Number(shift.required_staff?.technician || 0),
        customer_service: Number(shift.required_staff?.customer_service || 0),
        housekeeper: Number(shift.required_staff?.housekeeper || 0),
        manager: Number(shift.required_staff?.manager || 0),
        accountant: Number(shift.required_staff?.accountant || 0),
        it: Number(shift.required_staff?.it || 0),
      },
    } : SHIFT_FORM_DEFAULT);
    setShiftModalOpen(true);
  };

  const closeShiftModal = () => {
    if (shiftSubmitting) return;
    setShiftModalOpen(false);
    setEditingShift(null);
    setShiftForm(SHIFT_FORM_DEFAULT);
  };

  const handleSaveShift = async (event) => {
    event.preventDefault();
    if (!canEditShifts) {
      showToast("Bạn không có quyền thao tác ca làm.", "error");
      return;
    }

    setShiftSubmitting(true);
    try {
      const payload = {
        ...shiftForm,
        required_staff: Object.fromEntries(
          Object.entries(shiftForm.required_staff || {}).map(([key, value]) => [key, Number(value || 0)]),
        ),
      };

      if (editingShift?._id) {
        await employeeApi.updateShift(editingShift._id, payload);
        showToast("Đã cập nhật ca làm.", "success");
      } else {
        await employeeApi.createShift(payload);
        showToast("Đã tạo ca làm mới.", "success");
      }
      setShiftModalOpen(false);
      setEditingShift(null);
      await loadManagerData();
    } catch (err) {
      showToast(err.message || "Không thể lưu ca làm.", "error");
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleDeleteShift = (shift) => {
    if (!canEditShifts) {
      showToast("Bạn không có quyền xóa ca làm.", "error");
      return;
    }
    setShiftConfirmState({ open: true, shift });
  };

  const confirmDeleteShift = async () => {
    const shift = shiftConfirmState.shift;
    if (!shift?._id) return;

    try {
      await employeeApi.deleteShift(shift._id);
      showToast("Đã xóa ca làm.", "success");
      setShiftConfirmState({ open: false, shift: null });
      await loadManagerData();
    } catch (err) {
      showToast(err.message || "Không thể xóa ca làm.", "error");
    }
  };

  const registerAvailableShift = async (shift, workDate) => {
    if (!shift?._id) return;
    setRegisteringShiftId(String(shift._id));
    try {
      console.log("work date: ", workDate);
      const parsedDate = parse(workDate, "dd/MM/yyyy", new Date());
      await employeeApi.registerSchedule({
        shifts: [
          {
            shift_id: shift._id,
            work_date: format(parsedDate, "yyyy-MM-dd"),
          },
        ],
        repeat: false,
      });
      showToast("Đã đăng ký ca làm.", "success");
      await loadEmployeeData();
    } catch (err) {
      showToast(err.message || "Không thể đăng ký ca làm.", "error");
    } finally {
      setRegisteringShiftId("");
    }
  };

  const cancelMySchedule = (schedule) => {
    if (!schedule?._id) return;
    setConfirmState({
      open: true,
      title: "Hủy ca làm?",
      message: `Bạn có chắc muốn hủy ca ${DAY_LABELS[schedule.work_day] || schedule.work_day} ngày ${fmtDate(schedule.work_date)} không?`,
      onConfirm: async () => {
        setCancellingScheduleId(String(schedule._id));
        try {
          await employeeApi.deleteSchedule(schedule._id);
          showToast("Đã hủy ca làm.", "success");
          setConfirmState((prev) => ({ ...prev, open: false }));
          await loadEmployeeData();
        } catch (err) {
          showToast(err.message || "Không thể hủy ca làm.", "error");
        } finally {
          setCancellingScheduleId("");
        }
      },
    });
  };

  const handleApproveContract = (contract) => {
    if (!contract?.contract?._id) return;
    setConfirmState({
      open: true,
      title: "Duyệt lịch làm việc?",
      message: `Bạn muốn duyệt hợp đồng lịch của ${contract.employee_info?.full_name || "nhân viên"}?`,
      onConfirm: async () => {
        try {
          await employeeApi.updateScheduleContractStatus(contract.contract._id, { status: "approved" });
          showToast("Đã duyệt lịch làm việc.", "success");
          setConfirmState((prev) => ({ ...prev, open: false }));
          await loadManagerData();
        } catch (err) {
          showToast(err.message || "Không thể duyệt lịch làm việc.", "error");
        }
      },
    });
  };

  const handleRejectContract = (contract) => {
    setRejectState({ open: true, contract, loading: false });
  };

  const confirmRejectContract = async (note) => {
    if (!rejectState.contract?.contract?._id) return;
    setRejectState((prev) => ({ ...prev, loading: true }));
    try {
      await employeeApi.updateScheduleContractStatus(rejectState.contract.contract._id, {
        status: "rejected",
        note,
      });
      showToast("Đã từ chối lịch làm việc.", "success");
      setRejectState({ open: false, contract: null, loading: false });
      await loadManagerData();
    } catch (err) {
      showToast(err.message || "Không thể từ chối lịch làm việc.", "error");
      setRejectState((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleCheckIn = async (schedule) => {
    if (!schedule?._id) return;
    try {
      await employeeApi.checkInShift(schedule._id);
      showToast("Đã check-in ca làm.", "success");
      await loadEmployeeData();
    } catch (err) {
      showToast(err.message || "Không thể check-in.", "error");
    }
  };

  const handleCheckOut = async () => {
    try {
      await employeeApi.checkOutShift();
      showToast("Đã check-out ca làm.", "success");
      await loadEmployeeData();
    } catch (err) {
      showToast(err.message || "Không thể check-out.", "error");
    }
  };

  const tabs = showManagerView
    ? [
        { key: "manager-schedules", label: "Lịch toàn bộ" },
        { key: "pending", label: "Chờ duyệt" },
        { key: "shifts", label: "Ca làm" },
      ]
    : [
        { key: "my-schedule", label: "Lịch của tôi" },
        { key: "available-shifts", label: "Ca khả dụng" },
        { key: "attendance", label: "Chấm công" },
      ];

  const todaySchedule = useMemo(() => {
    const today = makeIsoDate();
    return myRows.find((row) => makeIsoDate(row.work_date) === today && ["pending", "approved"].includes(normalizeText(row.status)));
  }, [myRows]);

  const employeeSummary = attendanceSummary || {};

  return (
    <div className="flex min-h-screen bg-[#F3F4F6] font-sans text-gray-800">
      <Sidebar />
      <div className="ml-[270px] flex-1">
        <Topbar />

        <div className="mx-auto max-w-7xl space-y-6 p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-gray-200 pb-4 md:flex-row md:items-end">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                <FiCalendar /> Lịch làm việc
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {showManagerView
                  ? "Quản lý ca làm, lịch tổng và các yêu cầu chờ duyệt."
                  : "Xem lịch cá nhân, đăng ký ca khả dụng và theo dõi chấm công."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => (showManagerView ? loadManagerData() : loadEmployeeData())}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <FiRefreshCw /> Tải lại
            </button>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab.key
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
              <FiLoader className="mx-auto animate-spin text-5xl text-indigo-600" />
              <p className="mt-3 text-sm text-gray-500">Đang tải lịch làm việc...</p>
            </div>
          ) : null}

          {!loading && !error && (
            <>
              {!showManagerView && activeTab === "my-schedule" && (
                <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="grid flex-1 gap-4 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Ngày xem</label>
                        <input
                          type="date"
                          value={myScheduleDate}
                          onChange={(e) => setMyScheduleDate(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Trạng thái</label>
                        <select
                          value={myScheduleStatus}
                          onChange={(e) => setMyScheduleStatus(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                        >
                          <option value="all">Tất cả</option>
                          <option value="pending">Chờ duyệt</option>
                          <option value="approved">Đã duyệt</option>
                          <option value="cancelled">Đã hủy</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Loại ca</label>
                        <select
                          value={myScheduleShiftType}
                          onChange={(e) => setMyScheduleShiftType(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                        >
                          <option value="all">Tất cả</option>
                          <option value="morning">Ca sáng</option>
                          <option value="afternoon">Ca chiều</option>
                          <option value="night">Ca tối</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl bg-indigo-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500">Tổng ca</p>
                      <p className="mt-2 text-2xl font-bold text-indigo-900">{mySchedulePayload?.total_schedules || 0}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">Tuần</p>
                      <p className="mt-2 text-2xl font-bold text-emerald-900">{mySchedulePayload?.total_weeks || 0}</p>
                    </div>
                    <div className="rounded-2xl bg-amber-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Ngày công</p>
                      <p className="mt-2 text-2xl font-bold text-amber-900">{employeeSummary.total_work_days || 0}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Giờ công</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{employeeSummary.total_work_hours || 0}</p>
                    </div>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
                    <table className="min-w-full divide-y divide-gray-100 text-left text-sm">
                      <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Ngày</th>
                          <th className="px-4 py-3">Ca</th>
                          <th className="px-4 py-3">Giờ</th>
                          <th className="px-4 py-3">Trạng thái</th>
                          <th className="px-4 py-3">Ghi chú</th>
                          <th className="px-4 py-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {myRows.length ? myRows.map((row) => {
                          const status = getStatusMeta(row.status);
                          const canCancel = ["pending", "approved"].includes(normalizeText(row.status)) && safeDate(row.work_date) > new Date();
                          return (
                            <tr key={row._id}>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-gray-900">{fmtDate(row.work_date)}</div>
                                <div className="text-xs text-gray-500">{DAY_LABELS[row.work_day] || row.work_day || "--"}</div>
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-800">{SHIFT_LABELS[row.shift_type] || row.shift_type || "--"}</td>
                              <td className="px-4 py-3 text-gray-600">{fmtTime(row.begin_time)} - {fmtTime(row.end_time)}</td>
                              <td className="px-4 py-3"><Badge label={status.label} tone={status.tone} /></td>
                              <td className="px-4 py-3 text-gray-600">{row.note || "--"}</td>
                              <td className="px-4 py-3 text-right">
                                {canCancel ? (
                                  <button
                                    type="button"
                                    onClick={() => cancelMySchedule(row)}
                                    disabled={cancellingScheduleId === String(row._id)}
                                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                  >
                                    {cancellingScheduleId === String(row._id) ? "Đang hủy..." : "Hủy ca"}
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">--</span>
                                )}
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                              Bạn chưa có ca làm nào trong khoảng thời gian này.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {!showManagerView && activeTab === "available-shifts" && (
                <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Ca khả dụng</h2>
                      <p className="mt-1 text-sm text-gray-500">Chọn một ngày trong tương lai để xem ca còn trống.</p>
                    </div>
                    <div className="w-full max-w-xs">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Ngày</label>
                      <input
                        type="date"
                        min={tomorrowIsoDate()}
                        value={availableDate}
                        onChange={(e) => setAvailableDate(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="mt-6 space-y-5">
                    {Object.keys(availableShifts).length ? Object.entries(availableShifts).map(([day, info]) => (
                      <div key={day} className="rounded-2xl border border-gray-100 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">{DAY_LABELS[day] || day}</h3>
                            <p className="text-sm text-gray-500">{fmtDate(info.date)}</p>
                          </div>
                          {info.disabled ? <Badge label={info.reason || "Đã khóa"} tone="slate" /> : <Badge label="Còn trống" tone="emerald" />}
                        </div>
                        {info.shifts?.length ? (
                          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {info.shifts.map((shift) => {
                              const disabled = Boolean(shift.disabled);
                              const slot = shift.slot_info || {};
                              return (
                                <div key={shift._id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-gray-900">{SHIFT_LABELS[shift.shift_type] || shift.shift_type}</p>
                                      <p className="mt-1 text-sm text-gray-500">{fmtTime(shift.begin_time)} - {fmtTime(shift.end_time)}</p>
                                    </div>
                                    {disabled ? <Badge label="Không khả dụng" tone="slate" /> : <Badge label="Khả dụng" tone="emerald" />}
                                  </div>
                                  {slot.required !== undefined && (
                                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                                      <div className="rounded-xl bg-white p-2">Yêu cầu: <b>{slot.required}</b></div>
                                      <div className="rounded-xl bg-white p-2">Còn lại: <b>{slot.remaining}</b></div>
                                      <div className="rounded-xl bg-white p-2">Đã duyệt: <b>{slot.approved}</b></div>
                                      <div className="rounded-xl bg-white p-2">Chờ duyệt: <b>{slot.pending}</b></div>
                                    </div>
                                  )}
                                  {shift.reasons?.length ? (
                                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-gray-500">
                                      {shift.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                                    </ul>
                                  ) : null}
                                  <button
                                    type="button"
                                    disabled={disabled || registeringShiftId === String(shift._id)}
                                    onClick={() => registerAvailableShift(shift, fmtDate(availableDate))}
                                    className="mt-4 w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {registeringShiftId === String(shift._id) ? "Đang đăng ký..." : "Đăng ký ca"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-sm text-gray-500">
                            Không có ca khả dụng trong ngày này.
                          </div>
                        )}
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-sm text-gray-500">
                        Không có ca khả dụng. Hãy chọn ngày khác.
                      </div>
                    )}
                  </div>
                </section>
              )}

              {!showManagerView && activeTab === "attendance" && (
                <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Điểm danh</h2>
                        <p className="mt-1 text-sm text-gray-500">Xem nhanh tổng hợp chấm công gần đây.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-700">Từ ngày</label>
                          <input
                            type="date"
                            value={attendanceStart}
                            onChange={(e) => setAttendanceStart(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-700">Đến ngày</label>
                          <input
                            type="date"
                            value={attendanceEnd}
                            onChange={(e) => setAttendanceEnd(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl bg-indigo-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-500">Tổng bản ghi</p>
                        <p className="mt-2 text-2xl font-bold text-indigo-900">{employeeSummary.total_records || 0}</p>
                      </div>
                      <div className="rounded-2xl bg-emerald-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">Ngày làm</p>
                        <p className="mt-2 text-2xl font-bold text-emerald-900">{employeeSummary.total_work_days || 0}</p>
                      </div>
                      <div className="rounded-2xl bg-amber-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">Đi trễ</p>
                        <p className="mt-2 text-2xl font-bold text-amber-900">{employeeSummary.total_late_minutes || 0}p</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Về sớm</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{employeeSummary.total_early_leave_minutes || 0}p</p>
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-gray-100 p-4">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          disabled={!todaySchedule}
                          onClick={() => handleCheckIn(todaySchedule)}
                          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Check-in ca hôm nay
                        </button>
                        <button
                          type="button"
                          onClick={handleCheckOut}
                          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Check-out ca hiện tại
                        </button>
                      </div>
                      {!todaySchedule ? (
                        <p className="mt-3 text-xs text-gray-500">Không có ca hôm nay để check-in.</p>
                      ) : (
                        <p className="mt-3 text-xs text-gray-500">
                          Ca đang chọn: {DAY_LABELS[todaySchedule.work_day] || todaySchedule.work_day} · {SHIFT_LABELS[todaySchedule.shift_type] || todaySchedule.shift_type}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900">Trạng thái chấm công</h3>
                    <div className="mt-4 grid gap-3">
                      {Object.entries(employeeSummary.by_status || {}).length ? Object.entries(employeeSummary.by_status).map(([status, count]) => {
                        const meta = getStatusMeta(status);
                        return (
                          <div key={status} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                            <span className="text-sm font-medium text-gray-700">{meta.label}</span>
                            <span className="text-sm font-bold text-gray-900">{count}</span>
                          </div>
                        );
                      }) : (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                          Chưa có dữ liệu chấm công trong khoảng thời gian này.
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {showManagerView && activeTab === "manager-schedules" && (
                <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="grid gap-4 lg:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Ngày làm</label>
                      <input
                        type="date"
                        value={managerWorkDate}
                        onChange={(e) => setManagerWorkDate(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Nhân viên</label>
                      <select
                        value={managerEmployeeId}
                        onChange={(e) => setManagerEmployeeId(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                      >
                        <option value="all">Tất cả</option>
                        {employeeOptions.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {emp.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Trạng thái</label>
                      <select
                        value={managerStatus}
                        onChange={(e) => setManagerStatus(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                      >
                        <option value="all">Tất cả</option>
                        <option value="pending">Chờ duyệt</option>
                        <option value="approved">Đã duyệt</option>
                        <option value="cancelled">Đã hủy</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Hợp đồng</label>
                      <select
                        value={managerContractStatus}
                        onChange={(e) => setManagerContractStatus(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                      >
                        <option value="all">Tất cả</option>
                        <option value="pending">Chờ duyệt</option>
                        <option value="active">Đang hoạt động</option>
                        <option value="cancelled">Đã hủy</option>
                        <option value="expired">Hết hạn</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
                    <table className="min-w-full divide-y divide-gray-100 text-left text-sm">
                      <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Nhân viên</th>
                          <th className="px-4 py-3">Ngày</th>
                          <th className="px-4 py-3">Ca</th>
                          <th className="px-4 py-3">Giờ</th>
                          <th className="px-4 py-3">Trạng thái</th>
                          <th className="px-4 py-3">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {managerRows.length ? managerRows.map((row) => {
                          const status = getStatusMeta(row.status);
                          return (
                            <tr key={row._id}>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-gray-900">{row.employee_info?.full_name || "--"}</div>
                                <div className="text-xs text-gray-500">{ROLE_LABELS[row.employee_info?.role] || row.employee_info?.role || "--"}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-gray-900">{fmtDate(row.work_date)}</div>
                                <div className="text-xs text-gray-500">{DAY_LABELS[row.work_day] || row.work_day || "--"}</div>
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-800">{SHIFT_LABELS[row.shift_type] || row.shift_type || "--"}</td>
                              <td className="px-4 py-3 text-gray-600">{fmtTime(row.begin_time)} - {fmtTime(row.end_time)}</td>
                              <td className="px-4 py-3"><Badge label={status.label} tone={status.tone} /></td>
                              <td className="px-4 py-3 text-gray-600">{row.note || "--"}</td>
                            </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                              Chưa có lịch làm việc nào trong khoảng thời gian này.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {showManagerView && activeTab === "pending" && (
                <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Yêu cầu chờ duyệt</h2>
                      <p className="mt-1 text-sm text-gray-500">Duyệt hoặc từ chối lịch làm việc định kỳ của nhân viên.</p>
                    </div>
                    <div className="w-full max-w-xs">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Lọc theo vị trí</label>
                      <select
                        value={pendingRoleFilter}
                        onChange={(e) => setPendingRoleFilter(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                      >
                        <option value="all">Tất cả</option>
                        {Object.entries(ROLE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {pendingRequests.length ? pendingRequests.map((request) => (
                      <div key={request.contract?.contract_id || request.contract?._id} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-gray-900">{request.employee_info?.full_name || "Nhân viên"}</h3>
                            <p className="mt-1 text-sm text-gray-500">{ROLE_LABELS[request.employee_info?.role] || request.employee_info?.role || "--"} · {request.employee_info?.phone_number || "--"}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge label={`Hợp đồng: ${request.contract?.status || "--"}`} tone="amber" />
                              <Badge label={`Tổng ca chờ: ${request.total_pending || 0}`} tone="slate" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleApproveContract(request)}
                              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectContract(request)}
                              className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              Từ chối
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {(request.schedules || []).map((schedule) => (
                            <div key={schedule._id} className="rounded-xl bg-white p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-gray-900">{fmtDate(schedule.work_date)}</p>
                                  <p className="mt-1 text-sm text-gray-500">{DAY_LABELS[schedule.work_day] || schedule.work_day} · {SHIFT_LABELS[schedule.shift_type] || schedule.shift_type}</p>
                                </div>
                                <Badge label={schedule.begin_time ? `${fmtTime(schedule.begin_time)}-${fmtTime(schedule.end_time)}` : "Ca"} tone="blue" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-sm text-gray-500">
                        Chưa có yêu cầu lịch làm việc nào đang chờ duyệt.
                      </div>
                    )}
                  </div>
                </section>
              )}

              {showManagerView && activeTab === "shifts" && (
                <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Danh sách ca làm</h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {canEditShifts ? "Admin có thể tạo, sửa hoặc xóa ca." : "Chỉ xem danh sách ca làm."}
                      </p>
                    </div>
                    {canEditShifts ? (
                      <button
                        type="button"
                        onClick={() => openShiftModal(null)}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                      >
                        <FiPlus /> Thêm ca
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Ngày trong tuần</label>
                      <select
                        value={managerShiftDay}
                        onChange={(e) => setManagerShiftDay(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                      >
                        <option value="all">Tất cả</option>
                        {Object.entries(DAY_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Loại ca</label>
                      <select
                        value={managerShiftType}
                        onChange={(e) => setManagerShiftType(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                      >
                        <option value="all">Tất cả</option>
                        <option value="morning">Ca sáng</option>
                        <option value="afternoon">Ca chiều</option>
                        <option value="night">Ca tối</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
                    <table className="min-w-full divide-y divide-gray-100 text-left text-sm">
                      <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-4 py-3">Ngày</th>
                          <th className="px-4 py-3">Ca</th>
                          <th className="px-4 py-3">Giờ</th>
                          <th className="px-4 py-3">Yêu cầu</th>
                          <th className="px-4 py-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {shiftRows.length ? shiftRows.map((shift) => (
                          <tr key={shift._id}>
                            <td className="px-4 py-3 font-medium text-gray-900">{DAY_LABELS[shift.work_day] || shift.work_day}</td>
                            <td className="px-4 py-3 font-medium text-gray-800">{SHIFT_LABELS[shift.shift_type] || shift.shift_type}</td>
                            <td className="px-4 py-3 text-gray-600">{fmtTime(shift.begin_time)} - {fmtTime(shift.end_time)}</td>
                            <td className="px-4 py-3 text-gray-600">
                              {Object.entries(shift.required_staff || {}).map(([key, value]) => (
                                <div key={key} className="text-xs">
                                  {ROLE_LABELS[key] || key}: <b>{value}</b>
                                </div>
                              ))}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {canEditShifts ? (
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openShiftModal(shift)}
                                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteShift(shift)}
                                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                  >
                                    Xóa
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">Chỉ xem</span>
                              )}
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                              Chưa có ca làm nào. {canEditShifts ? "Bạn có thể tạo ca mới." : ""}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {shiftModalOpen ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{editingShift ? "Sửa ca làm" : "Thêm ca làm"}</h3>
                <p className="mt-1 text-sm text-gray-500">Quản lý khung giờ và số lượng yêu cầu cho từng vị trí.</p>
              </div>
              <button type="button" onClick={closeShiftModal} className="rounded-full p-1 hover:bg-gray-100">
                <FiX size={22} />
              </button>
            </div>
            <form onSubmit={handleSaveShift} className="mt-5 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Ngày trong tuần</label>
                  <select
                    value={shiftForm.work_day}
                    onChange={(e) => setShiftForm((prev) => ({ ...prev, work_day: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                  >
                    {Object.entries(DAY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Loại ca</label>
                  <select
                    value={shiftForm.shift_type}
                    onChange={(e) => setShiftForm((prev) => ({ ...prev, shift_type: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                  >
                    {Object.entries(SHIFT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Giờ bắt đầu</label>
                  <input
                    type="time"
                    value={shiftForm.begin_time}
                    onChange={(e) => setShiftForm((prev) => ({ ...prev, begin_time: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Giờ kết thúc</label>
                  <input
                    type="time"
                    value={shiftForm.end_time}
                    onChange={(e) => setShiftForm((prev) => ({ ...prev, end_time: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900">Số lượng yêu cầu theo vị trí</h4>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {Object.keys(ROLE_LABELS).map((key) => (
                    <div key={key}>
                      <label className="mb-1 block text-xs font-medium text-gray-700">{ROLE_LABELS[key]}</label>
                      <input
                        type="number"
                        min={0}
                        value={shiftForm.required_staff[key] ?? 0}
                        onChange={(e) => setShiftForm((prev) => ({
                          ...prev,
                          required_staff: {
                            ...prev.required_staff,
                            [key]: Number(e.target.value || 0),
                          },
                        }))}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={closeShiftModal}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={shiftSubmitting}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {shiftSubmitting ? "Đang lưu..." : (editingShift ? "Lưu thay đổi" : "Tạo ca")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <RejectReasonModal
        open={rejectState.open}
        loading={rejectState.loading}
        title="Từ chối lịch làm việc"
        onCancel={() => setRejectState({ open: false, contract: null, loading: false })}
        onConfirm={confirmRejectContract}
      />

      {shiftConfirmState.open ? (
        <ConfirmModal
          open={shiftConfirmState.open}
          title="Xóa ca làm?"
          message="Ca làm sẽ bị xóa khỏi hệ thống. Chỉ admin mới có thể thao tác này."
          confirmText="Xóa"
          cancelText="Hủy"
          type="danger"
          onConfirm={confirmDeleteShift}
          onCancel={() => setShiftConfirmState({ open: false, shift: null })}
        />
      ) : null}

      {confirmState.open ? (
        <ConfirmModal
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          confirmText="Đồng ý"
          cancelText="Hủy"
          type="warning"
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState((prev) => ({ ...prev, open: false }))}
        />
      ) : null}

      {toast ? (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
