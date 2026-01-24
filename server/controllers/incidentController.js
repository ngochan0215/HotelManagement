import { Incident, Room, User, CompensateTicket, Equipment,
  EquipmentCategory, Employee, Customer, Booking, EquipmentLog, 
  IncidentLog, CompensateDetail
 } from "../models/index.js";
import mongoose from "mongoose";
import { reevaluateRoomStatus } from "../controllers/roomController.js";

const MAX_DAYS = 30;

// Helper functions (Giữ nguyên)
export const resolveUserFullName = async (user_id) => {
  if (!user_id) return null;
  const user = await User.findById(user_id).select("system_role");
  if (!user) throw new Error("Không tìm thấy người dùng.");
  if (user.system_role === "employee") return await Employee.findOne({ user_id }).select("full_name");
  if (user.system_role === "customer") return await Customer.findOne({ user_id }).select("full_name");
  return null;
};

export const calculatePenaltyFee = async ({ equipment_id, broken_state, resolution }) => {
  const equipment = await Equipment.findById(equipment_id);
  if (!equipment) throw new Error("Thiết bị không tồn tại.");

  const category = await EquipmentCategory.findById(equipment.category_id);
  if (!category) throw new Error("Danh mục thiết bị không tồn tại.");

  const originalPrice = category.price;
  const rateTable = {
    scratched: { repair: 0.1, discard: 0.3 },
    cracked: { repair: 0.3, discard: 0.5 },
    broken: { repair: 0.5, discard: 0.8 },
    lost: { discard: 1.2 },
    unusable: { discard: 0.8 }
  };
  const rate = rateTable[broken_state]?.[resolution] ?? 0;
  return { penalty_fee: Math.round(originalPrice * rate), price: originalPrice };
};

export const updateEquipmentByResolution = async ({ equipment_id, resolution, handled_by = null, note = "", session = null }) => {
  const now = new Date();
  const equipment = await Equipment.findById(equipment_id).session(session);
  if (!equipment) throw new Error("Thiết bị không tồn tại.");

  let newCondition, newStatus;
  switch (resolution) {
    case "repair": newCondition = "maintenance"; newStatus = "maintenance"; break;
    case "discard": newCondition = "broken"; newStatus = "disposed"; break;
    default: throw new Error("Resolution không hợp lệ.");
  }

  await EquipmentLog.findOneAndUpdate({ equipment_id, end_time: null }, { end_time: now });
  await EquipmentLog.create({
      room_id: equipment.room_id || null, equipment_id, condition: newCondition, status: newStatus,
      start_time: now, end_time: null, note: note || `Update theo sự cố và phiếu đền bù: ${resolution}`, handled_by,
  });

  equipment.condition = newCondition;
  equipment.status = newStatus;
  await equipment.save({ session });
  return { equipment_id, condition: newCondition, status: newStatus };
};

//---- INCIDENT ----//
export const createIncident = async (req, res) => {
  try {
    const { room_id, booking_id, causer_id, caused_by, description, type, severity, occured_at } = req.body;
    const reporter_id = req.user.userId;

    if (!description || !type || !caused_by || !severity || !occured_at) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
    }

    if (room_id) {
        const room = await Room.findById(room_id);
        if (!room) return res.status(404).json({ message: "Phòng không tồn tại." });
    }
    // ... (Giữ nguyên logic validate booking, causer như code cũ của bạn)

    const occuredDate = new Date(occured_at);
    const diffDays = (Date.now() - occuredDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > MAX_DAYS) return res.status(400).json({ message: "Sự cố đã xảy ra quá 30 ngày." });

    const incident = await Incident.create({
        room_id: room_id || null, reporter_id, causer_id: causer_id || null, booking_id: booking_id || null,
        description, type, caused_by, severity, occured_at, status: "new", compensation_status: "none",
    });
    await incident.save();
    return res.status(201).json({ message: "Thêm sự cố thành công.", data: incident });
  } catch (err) {
      return res.status(500).json({ message: "SERVER ERROR: " + err.message });
  }
};

// update thông tin cơ bản
export const updateIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const actor = await Employee.findOne({ user_id: req.user.userId });

    const incident = await Incident.findById(id);
    if (!incident) return res.status(404).json({ message: "Không tìm thấy sự cố." });
    if (incident.status === "closed") return res.status(400).json({ message: "Sự cố đã đóng, không thể sửa." });
    if (incident.status !== "new") return res.status(400).json({ message: "Chỉ sửa được khi trạng thái là new." });

    if (updates.room_id) incident.room_id = updates.room_id;
    if (updates.booking_id) incident.booking_id = updates.booking_id;
    if (updates.causer_id) incident.causer_id = updates.causer_id;
    if (updates.type) incident.type = updates.type;
    if (updates.severity) incident.severity = updates.severity;
    if (updates.caused_by) incident.caused_by = updates.caused_by;

    await incident.save();

    await IncidentLog.create({
      incident_id: incident._id, action: "updated", from_status: incident.status, to_status: null,
      actor_id: actor._id, actor_name: actor.full_name, actor_role: actor.position, note: "Cập nhật thông tin sự cố"
    });
    return res.status(200).json({ message: "Cập nhật sự cố thành công.", data: incident });
  } catch (error) {
    return res.status(500).json({ message: "SERVER ERROR: " + error.message });
  }
};

export const assignIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignee_id, note } = req.body;
    const actor_id = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(assignee_id) || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ" });
    }

    const incident = await Incident.findById(id);
    if (!incident) return res.status(404).json({ success: false, message: "Không tìm thấy sự cố" });
    if (["resolved", "closed"].includes(incident.status)) {
      return res.status(400).json({ success: false, message: "Không thể phân công sự cố đã xử lý xong" });
    }

    const assignee = await Employee.findById(assignee_id);
    const actor = await Employee.findOne({ user_id: actor_id });
    if (!assignee || !actor) return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên." });

    const prevStatus = incident.status;

    // cập nhật incident
    incident.assignee_info = {
      assignee_id: assignee._id, assignee_name: assignee.full_name, assignee_role: assignee.position, assigned_at: new Date(),
    };
    incident.status = "in_progress";
    await incident.save();

    // ghi log
    await IncidentLog.create({
      incident_id: incident._id, action: "assigned", from_status: prevStatus, to_status: "in_progress",
      actor_id: actor._id, actor_name: actor.full_name, actor_role: actor.position, note: note || "Phân công xử lý sự cố",
    });

    return res.json({ success: true, message: "Phân công xử lý sự cố thành công", data: incident });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// xác nhận hoàn thành, nhân viên thực hiện hoặc quản lý xác nhận đều được
export const resolveIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    const actor = await Employee.findOne({ user_id: userId });

    if (!note) return res.status(400).json({ message: "Thiếu ghi chú xử lý." });

    const incident = await Incident.findById(id);
    if (!incident) return res.status(404).json({ message: "Không tìm thấy sự cố." });

    if (incident.status !== "in_progress") {
      return res.status(400).json({ message: "Sự cố chưa được phân công hoặc đã đóng." });
    }

    if (user.system_role === "employee") {
      const assignee_id = incident.assignee_info?.assignee_id;
      if (!assignee_id || assignee_id.toString() !== actor._id.toString()) {
        return res.status(403).json({ message: "Bạn không được phân công xử lý sự cố này." });
      }
    }

    const oldStatus = incident.status;

    incident.status = "resolved";
    incident.resolved_at = new Date();
    await incident.save();

    // ghi log
    await IncidentLog.create({
      incident_id: incident._id,
      action: "resolved",
      from_status: oldStatus,
      to_status: "resolved",
      actor_id: actor._id,
      actor_name: actor.full_name,
      actor_role: actor.position,
      note: note || "Nhân viên xác nhận đã xử lý xong."
    });

    res.json({ success: true, message: "Đã xác nhận xử lý xong.", data: incident });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Lỗi server" });
  }
};

export const closedIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = req.user.userId;
    const actor = await Employee.findOne({ user_id: userId });

    if (!note) return res.status(400).json({ message: "Thiếu ghi chú xử lý." });

    const incident = await Incident.findById(id);
    if (!incident) return res.status(404).json({ message: "Không tìm thấy sự cố." });

    if (incident.caused_by !== "other") {
        if (incident.compensation_status !== "done") {
             return res.status(400).json({ message: "Chưa thể đóng sự cố khi quy trình đền bù chưa kết thúc." });
        }
    }

    if (incident.status !== "resolved") return res.status(400).json({ message: "Chỉ đóng được sự cố đã Resolved." });

    const oldStatus = incident.status;
    incident.status = "closed";
    incident.closed_at = new Date();
    await incident.save();

    if (incident.room_id) await reevaluateRoomStatus(incident.room_id);

    await IncidentLog.create({
      incident_id: incident._id, action: "closed", from_status: oldStatus, to_status: "closed",
      actor_id: actor._id, actor_name: actor.full_name, actor_role: actor.position, note: note || "Đóng hồ sơ sự cố."
    });

    res.json({ success: true, message: "Đã đóng sự cố thành công." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAllIncidents = async (req, res) => {
  try {
    const { status, severity, compensation_status, room_id, type, caused_by } = req.query;
    const userId = req.user.userId;
    const user = await User.findById(userId);
    const employee = await Employee.findOne({ user_id: userId });

    const filter = {};
    if (user.system_role !== 'manager' && user.system_role !== 'admin') {
           filter.$or = [
             { reporter_id: userId },
             { "assignee_info.assignee_id": employee?._id }
           ];
    }
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (compensation_status) filter.compensation_status = compensation_status;
    if (room_id) filter.room_id = room_id;
    if (type) filter.type = type;
    if (caused_by) filter.caused_by = caused_by;

    const incidents = await Incident.find(filter)
      .populate("room_id", "room_number").populate("reporter_id", "system_role").populate("causer_id", "system_role")
      .sort({ created_at: -1 });

    const result = [];
    for (const incident of incidents) {
      const reporterProfile = await resolveUserFullName(incident.reporter_id);
      const causerProfile = await resolveUserFullName(incident.causer_id);

      result.push({
        ...incident.toObject(),
        reporter_name: reporterProfile?.full_name || null,
        causer_name: causerProfile?.full_name || null,
      });
    }

    return res.status(200).json({ data: result });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getIncidentById = async (req, res) => {
    try {
        const { id } = req.params;

    const incident = await Incident.findById(id)
      .select("-__v")
      .populate("room_id", "room_number")
      .populate("booking_id")
      .populate("reporter_id", "system_role")
      .populate("causer_id", "system_role");

    if (!incident) {
      return res.status(404).json({ message: "Khồng tìm thấy sự cố." });
    }

        const reporterProfile = await resolveUserFullName(incident.reporter_id);
        const causerProfile = await resolveUserFullName(incident.causer_id);

        return res.status(200).json({
          data: {
            ...incident.toObject(),
            reporter_name: reporterProfile?.full_name || null,
            causer_name: causerProfile?.full_name || null,
          },
        });
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
};

export const deleteIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const incident = await Incident.findById(id);
    if (!incident) {
      return res.status(404).json({ message: "Không tìm thấy sự cố." });
    }

    const compensationExists = await CompensateTicket.exists({ incident_id: id });
    if (compensationExists) {
      return res.status(400).json({
        message: "Không thể xóa sự cố vì đã có phiếu đền bù.",
      });
    }

    await Incident.findByIdAndDelete(id);
    await CompensateTicket.findOneAndDelete({ incident_id: id });
    return res.status(200).json({ message: "Incident deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const buildCompensationDetails = async (detailsInput, incident) => {
    let totalFee = 0;
    const details = [];
    const room_id = incident.room_id;

    for (const item of detailsInput) {
      const equipment = await Equipment.findById(item.equipment_id);
    if (equipment.room_id.toString() !== room_id.toString()) {
      throw new Error("Đây không phải thiết bị của phòng!");
    }

      const validState = ["scratched", "cracked", "broken", "lost", "unusable"];
    if (!validState.includes(item.broken_state)) {
      throw new Error("Tình trạng hư hỏng không hợp lệ!");
    }

      const { penalty_fee } = await calculatePenaltyFee({
        equipment_id: item.equipment_id, broken_state: item.broken_state, resolution: item.resolution
      });
      totalFee += penalty_fee;
      details.push({ equipment_id: item.equipment_id, broken_state: item.broken_state, resolution: item.resolution, penalty_fee });
    }
    return { details, totalFee };
};

//---- COMPENSATE TICKET ----//
// hàm tạo phiếu đền bù cho sự cố có liên quan đến thiết bị
export const createCompensateTicket = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { incident_id } = req.params;
    const { payer_type, payer_id, compensation_details, note } = req.body;
    const actor = await Employee.findOne({ user_id: req.user.userId });

    if ( !payer_type || !compensation_details ) {
      return res.status(404).json({ message: "Yêu cầu nhập đầy đủ thông tin." });
    }

    const incident = await Incident.findById(incident_id).session(session);
    if (!incident) {
      return res.status(404).json({ message: "Sự cố không tồn tại." });
    }

    if (!payer_id) payer_id = incident.causer_id;

    if (incident.compensation_status !== "none") {
      return res.status(400).json({ message: "Sự cố đã có phiếu đền bù." });
    }

    const existedTicket = await CompensateTicket.findOne({ incident_id }).session(session);

    if (existedTicket) {
      return res.status(400).json({
        message: "Sự cố này đã có phiếu đền bù."
      });
    }

    const validPayers = ["customer", "employee", "hotel"];
    if (!validPayers.includes(payer_type)) {
      return res.status(400).json({ message: "payer_type không hợp lệ." });
    }

    if (payer_type !== "hotel" && !payer_id) {
      return res.status(400).json({
        message: "Cần xác định người chịu trách nhiệm chi trả."
      });
    }

    const { details, totalFee } = await buildCompensationDetails(compensation_details, incident);

    // cập nhật condition + status thiết bị
    for (const item of details) {
      await updateEquipmentByResolution({
        equipment_id: item.equipment_id, resolution: item.resolution, handled_by: req.user.employee_id, note: `Sự cố ${incident._id}`
      });
    }

    // thêm phiếu đền bù
    const ticket = await CompensateTicket.create([{
      incident_id,
      payer_type,
      payer_id: payer_id || null,
      note: note || "",
      compensation_details: details,
      total_fee: totalFee,
      status: "pending"
    }], { session });

    const detailDocs = details.map(item => ({
      ticket_id: ticket[0]._id,
      equipment_id: item.equipment_id || null,
      broken_state: item.broken_state,
      resolution: item.resolution,
      penalty_fee: item.penalty_fee,
    }));

    await CompensateDetail.insertMany(detailDocs, { session });

    // ghi log
    await IncidentLog.create({
      incident_id: incident._id,
      action: "compensation_updated",
      from_status: incident.compensation_status,
      to_status: "pending",
      actor_id: actor._id,
      actor_name: actor.full_name,
      actor_role: actor.position,
      note: note || "Xác nhận tạo phiếu đền bù thành công."
    });

    // cập nhật tình trạng sự cố
    incident.compensation_status = "pending";
    await incident.save({ session });
    await session.commitTransaction();
    return res.status(201).json({ message: "Tạo phiếu đền bù thành công.", data: ticket[0] });
  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({
      message: err.message || "Lỗi khi tạo phiếu đền bù."
    });
  } finally {
    session.endSession();
  }
};

// hàm tạo phiếu đền bù cho sự cố không liên quan đến thiết bị
export const createCompensateTickett = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { incident_id } = req.params;
      const { payer_type, payer_id, total_fee, note } = req.body;
      const actor = await Employee.findOne({ user_id: req.user.userId });

    if ( !payer_type || !total_fee ) {
      return res.status(404).json({ message: "Yêu cầu nhập đầy đủ thông tin." });
    }

      const incident = await Incident.findById(incident_id).session(session);
    if (!incident) {
      return res.status(404).json({ message: "Sự cố không tồn tại." });
    }

    if (!payer_id) payer_id = incident.causer_id;

    if (incident.compensation_status !== "none") {
      return res.status(400).json({ message: "Sự cố đã có phiếu đền bù." });
    }

    const existedTicket = await CompensateTicket.findOne({ incident_id }).session(session);

    if (existedTicket) {
      return res.status(400).json({
        message: "Sự cố này đã có phiếu đền bù."
      });
    }

    const validPayers = ["customer", "employee", "hotel"];
    if (!validPayers.includes(payer_type)) {
      return res.status(400).json({ message: "payer_type không hợp lệ." });
    }

    if (payer_type !== "hotel" && !payer_id) {
      return res.status(400).json({
        message: "Cần xác định người chịu trách nhiệm chi trả."
      });
    }

    // thêm phiếu đền bù
      const ticket = await CompensateTicket.create([{
      incident_id,
      payer_type,
      payer_id: payer_id || null,
      note: note || "",
      total_fee: total_fee,
      status: "pending"
      }], { session });

    // ghi log
      await IncidentLog.create({
      incident_id: incident._id,
      action: "compensation_updated",
      from_status: incident.compensation_status,
      to_status: "pending",
      actor_id: actor._id,
      actor_name: actor.full_name,
      actor_role: actor.position,
      note: note || "Xác nhận tạo phiếu đền bù thành công."
      });

    // cập nhật tình trạng sự cố
      incident.compensation_status = "pending";
      await incident.save({ session });
      await session.commitTransaction();
      return res.status(201).json({ message: "Tạo phiếu đền bù thành công.", data: ticket[0] });
    } catch (err) {
      await session.abortTransaction();
    return res.status(500).json({
      message: err.message || "Lỗi khi tạo phiếu đền bù."
    });
  } finally {
    session.endSession();
  }
};

export const getAllCompensateTickets = async (req, res) => {
    try {
        const { status, incident_id } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (incident_id) filter.incident_id = incident_id;

        const compensations = await CompensateTicket.find(filter)
          .select("-__v -updated_at")
      .populate({
        path: "incident_id", select: "-__v -updated_at -created_at",
        populate: [
          { path: "room_id", select: "room_number _id" },
          { path: "reporter_id", select: "system_role" },
          { path: "causer_id", select: "system_role" },
        ],
      })
      .populate({
        path: "compensation_details.equipment_id",
        select: "condition status",
        populate: {
          path: "category_id",
          select: "name price",
        },
      })
          .sort({ created_at: -1 });

        const result = [];
        for (const ticket of compensations) {
          const incident = ticket.incident_id;
          let reporter_name = null; let causer_name = null;
          if (incident?.reporter_id) {
            const reporterProfile = await resolveUserFullName(incident.reporter_id);
        reporter_name = reporterProfile?.full_name || null;
          }
          if (incident?.causer_id) {
            const causerProfile = await resolveUserFullName(incident.causer_id);
        causer_name = causerProfile?.full_name || null;
          }

      result.push({
        ...ticket.toObject(),
        incident: incident
          ? {
              reporter_name,
              causer_name,
        }
          : null,
      });
    }

        return res.status(200).json({ total: result.length, data: result });
      } catch (error) { return res.status(500).json({ message: error.message }); }
};

export const getCompensateTicketById = async (req, res) => {
    try {
        const { id } = req.params;

    const compensation = await CompensateTicket.findById(id)
      .select("-__v")
      .populate({
        path: "incident_id", select: "-__v -updated_at -created_at",
        populate: [
          { path: "room_id", select: "room_number" },
          { path: "reporter_id", select: "system_role" },
          { path: "causer_id", select: "system_role" },
        ],
      })
      .populate({
        path: "compensation_details.equipment_id",
        populate: {
          path: "category_id",
          select: "name price",
        },
      });

    if (!compensation) {
      return res.status(404).json({ message: "Không tìm thấy phiếu đền bù." });
    }

        const incident = compensation.incident_id;
        let reporter_name = null; let causer_name = null;
        if (incident?.reporter_id) {
          const reporterProfile = await resolveUserFullName(incident.reporter_id);
      reporter_name = reporterProfile?.full_name || null;
        }
        if (incident?.causer_id) {
          const causerProfile = await resolveUserFullName(incident.causer_id);
      causer_name = causerProfile?.full_name || null;
    }

    return res.status(200).json({
      data: {
        ...compensation.toObject(),
        incident: incident
          ? {
              reporter_name,
              causer_name,
        }
          : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateCompensateTicket = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const updates = req.body;
    const ticket = await CompensateTicket.findById(id).session(session);
    if (!ticket) {
      return res.status(404).json({ message: "Không tìm thấy phiếu đền bù." });
    }

    if (ticket.status !== "pending") {
      return res.status(400).json({
        message: "Không thể cập nhật phiếu đền bù khi đang trong trạng thái xử lý.",
      });
    }

    // chặn các field không được phép update
    const forbiddenFields = [
      "incident_id",
      "status",
      "paid_at",
      "created_at",
    ];

    for (const field of forbiddenFields) {
      if (field in updates) {
        return res.status(403).json({
          message: `Không được phép cập nhật trường ${field}.`,
        });
      }
    }

    if (ticket.incident_id) {
      const incident = await Incident.findById(ticket.incident_id).session(session);
      if (!incident) {
        return res.status(404).json({ message: "Sự cố liên quan không tồn tại." });
      }

      if (incident.status === "closed") {
        return res.status(400).json({
          message: "Không thể cập nhật phiếu đền bù khi sự cố đã đóng.",
        });
    }
    }

    if (updates.items) {
      if (!Array.isArray(updates.items) || updates.items.length === 0) {
        return res.status(400).json({ message: "Danh sách bồi thường không hợp lệ." });
      }

        let totalAmount = 0;
        for (const item of updates.items) {
        if (!item.name || item.amount == null || item.amount < 0) {
          return res.status(400).json({
            message: "Thông tin item bồi thường không hợp lệ.",
          });
        }

           totalAmount += item.amount;
        }
        updates.total_amount = totalAmount;
    }

    // Validate tổng tiền (nếu update trực tiếp)
    if (updates.total_amount != null && updates.total_amount < 0) {
      return res.status(400).json({
        message: "Tổng tiền bồi thường không hợp lệ.",
      });
    }

    // Update handler (nhân viên xử lý)
    if (updates.handled_by) {
      const handler = await User.findById(updates.handled_by);
      if (!handler) {
        return res.status(404).json({
          message: "Nhân viên xử lý không tồn tại.",
        });
      }
    }

    Object.assign(ticket, updates);
    await ticket.save({ session });
    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Cập nhật phiếu đền bù thành công.",
      data: ticket,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: error.message });
  }
};

// xác nhận đã bồi thường xong, có thể gọi API song song khi 
// khách hàng thanh toán hóa đơn booking
export const confirmCompensationPaid = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = req.user.userId;
    const actor = await Employee.findOne({ user_id: userId });

    const ticket = await CompensateTicket.findById(id).session(session).populate("incident_id");
    if (!ticket) { await session.abortTransaction(); return res.status(404).json({ message: "Phiếu đền bù không tồn tại." }); }
    if (ticket.status !== "pending") { await session.abortTransaction(); return res.status(400).json({ message: "Chỉ confirm được khi pending." }); }

    const incident = await Incident.findById(ticket.incident_id).session(session);
    if (!incident) { await session.abortTransaction(); return res.status(404).json({ message: "Sự cố không tồn tại." }); }

    // update compensation ticket
    ticket.status = "paid";
    await ticket.save({ session });

    // update incident
    const oldStatus = incident.status;
    incident.status = "closed";
    incident.compensation_status = "done";
    incident.closed_at = new Date();
    await incident.save({ session });

    // ghi log
    await IncidentLog.create({
      incident_id: incident._id, action: "compensation_paid_closed", from_status: oldStatus, to_status: "closed",
      actor_id: actor._id, actor_name: actor.full_name, actor_role: actor.position, note: note || "Xác nhận đã thanh toán và đóng sự cố."
    });

    await reevaluateRoomStatus(ticket.room_id);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Xác nhận bồi thường thành công.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      message: "SERVER ERROR: " + error.message,
    });
  }
};