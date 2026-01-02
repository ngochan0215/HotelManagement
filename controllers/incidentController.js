import { Incident, Room, User } from "../models/index.js";
import mongoose from "mongoose";

const MAX_DAYS = 30;

const allowedStatusFlow = {
  reported: ["fixing"],
  fixing: ["fixed"],
  fixed: ["closed"],
  closed: [],
};

const isValidStatusTransition = (current, next) => {
  return allowedStatusFlow[current]?.includes(next);
};

//---- INCIDENT ----//
export const reportIncident = async (req, res) => {
    try {
        const { room_id, booking_id, causer_id, reporter_id, caused_by, description, type, severity, occured_at } = req.body;
        //const reporter_id = req.user.userId;
        
        if (!room_id || !reporter_id || !description || !type || !caused_by || !severity || !occured_at) {
            return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
        }

        if (room_id) {
            const room = await Room.findById(room_id);
            if (!room) {
                return res.status(404).json({ message: "Phòng không tồn tại." });
            }
        }

        if (booking_id) {
            const booking = await Room.findById(booking_id);
            if (!booking) {
                return res.status(404).json({ message: "Đơn đặt phòng không tồn tại." });
            }
        }

        if (causer_id) {
            const causer = await User.findById(causer_id);
            if (!causer) {
                return res.status(404).json({ message: "Người gây ra sự cố không tồn tại." });
            }
        }

        const reporter = await User.findById(reporter_id);
        if (!reporter) {
            return res.status(404).json({ message: "Người báo cáo không tồn tại." });
        }

        if (caused_by !== "other" && !causer_id) {
            return res.status(400).json({ message: "Cần xác định người gây ra sự cố." });
        }

        const validTypes = ["equipment", "technical", "facility", "service", "safety", "other"];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ message: "Loại sự cố không hợp lệ." });
        }

        const validSeverity = ["low", "medium", "high", "critical"];
        if (!validSeverity.includes(severity)) {
            return res.status(400).json({ message: "Mức độ nghiêm trọng không hợp lệ." });
        }

        const validCauseby = ["employee", "customer", "other"];
        if (!validCauseby.includes(caused_by)) {
            return res.status(400).json({ message: "Loại người gây ra sự cố không hợp lệ." });
        }

        const occuredDate = new Date(occured_at);
        if (isNaN(occuredDate.getTime())) {
            return res.status(400).json({ message: "Thời điểm xảy ra sự cố không hợp lệ." });
        }

        if (occuredDate > new Date()) {
            return res.status(400).json({ message: "Thời điểm xảy ra sự cố không được ở tương lai." });
        }

        const diffDays = (Date.now() - occuredDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > MAX_DAYS) {
        return res.status(400).json({ message: "Sự cố đã xảy ra quá 30 ngày, không thể báo cáo." });
        }

        const incident = await Incident.create({
            room_id: room_id || null,
            reporter_id,
            causer_id: causer_id || null,
            booking_id: booking_id || null,
            description,
            type,
            caused_by,
            severity,
            occured_at,
            status: "reported",
            compensation_status: "none",
        });

        await incident.save();

        return res.status(201).json({
            message: "Thêm sự cố thành công.",
            data: incident,
        });
    } catch (err) {
        return res.status(500).json({ message: "SERVER ERROR: " + err.message || "Lỗi khi tạo sự cố."});
    }
};

export const updateIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const incident = await Incident.findById(id);
    if (!incident) {
      return res.status(404).json({ message: "Không tìm thấy sự cố." });
    }

    if (updates.reporter_id || updates.occured_at) {
        return res.status(403).json({ message: "Không được update người báo cáo và thời điểm xảy ra sự cố." });
    }

    if (updates.room_id) {
        const room = await Room.findById(updates.room_id);
        if (!room) {
            return res.status(404).json({ message: "Phòng không tồn tại." });
        }
    }

    if (updates.booking_id) {
        const booking = await Room.findById(updates.booking_id);
        if (!booking) {
            return res.status(404).json({ message: "Đơn đặt phòng không tồn tại." });
        }
    }

    if (updates.causer_id) {
        const causer = await User.findById(updates.causer_id);
        if (!causer) {
            return res.status(404).json({ message: "Người gây ra sự cố không tồn tại." });
        }
    }

    if (updates.caused_by !== "other" && !updates.causer_id) {
        return res.status(400).json({ message: "Cần xác định người gây ra sự cố." });
    }

    const validTypes = ["equipment", "technical", "facility", "service", "safety", "other"];
    if (!validTypes.includes(updates.type)) {
        return res.status(400).json({ message: "Loại sự cố không hợp lệ." });
    }

    const validSeverity = ["low", "medium", "high", "critical"];
    if (!validSeverity.includes(updates.severity)) {
        return res.status(400).json({ message: "Mức độ nghiêm trọng không hợp lệ." });
    }

    const validCauseby = ["employee", "customer", "other"];
    if (!validCauseby.includes(updates.caused_by)) {
        return res.status(400).json({ message: "Loại người gây ra sự cố không hợp lệ." });
    }

    if (updates.status) {
      if (!isValidStatusTransition(incident.status, updates.status)) {
        return res.status(400).json({
          message: `Không thể chuyển trạng thái từ ${incident.status} sang ${updates.status}`,
        });
      }

      if ( updates.status === "closed" && incident.compensation_status === "pending" ) {
        return res.status(400).json({
          message: "Chưa thể đóng sự cố khi quy trình đền bù đang diễn ra.",
        });
      }

      if (updates.status === "fixed") {
        updates.fixed_date = new Date();
      }

      if (updates.status === "closed") {
        updates.finish_date = new Date();
      }
    }

    Object.assign(incident, updates);
    await incident.save();

    return res.json({
      message: "Cập nhật sự cố thành công.",
      data: incident,
    });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAllIncidents = async (req, res) => {
  try {
    const { status, severity, compensation_status, room_id, type, caused_by } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (compensation_status) filter.compensation_status = compensation_status;
    if (room_id) filter.room_id = room_id;
    if (type) filter.type = type;
    if (caused_by) filter.caused_by = caused_by;

    const incidents = await Incident.find(filter)
      .populate("room_id", "room_number")
      .populate("reporter_id", "full_name")
      .populate("causer_id", "full_name")
      .sort({ created_at: -1 });

    return res.status(200).json({ data: incidents });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getIncidentById = async (req, res) => {
  try {
    const { id } = req.params;

    const incident = await Incident.findById(id)
        .select("-__v")
        .populate("room_id")
        .populate("reporter_id", "full_name")
        .populate("causer_id", "full_name")
        .populate("booking_id");

    if (!incident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    return res.json({ data: incident });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


//---- COMPENSATE TICKET ----//
export const createCompensateTicket = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { incidentId } = req.params;
    const { booking_id, payer_type, payer_id, note } = req.body;

    const incident = await Incident.findById(incidentId).session(session);
    if (!incident) {
      return res.status(404).json({ message: "Sự cố không tồn tại." });
    }

    // 2. Check trạng thái incident
    if (incident.status !== "fixed") {
      return res.status(400).json({
        message: "Chỉ tạo phiếu đền bù khi sự cố đã được xử lý xong."
      });
    }

    // 3. Check đã có ticket chưa
    const existedTicket = await CompensateTicket.findOne({
      incident_id: incidentId
    }).session(session);

    if (existedTicket) {
      return res.status(400).json({
        message: "Sự cố này đã có phiếu đền bù."
      });
    }

    // 4. Validate payer
    const validPayers = ["customer", "employee", "hotel"];
    if (!validPayers.includes(payer_type)) {
      return res.status(400).json({ message: "payer_type không hợp lệ." });
    }

    if (payer_type !== "hotel" && !payer_id) {
      return res.status(400).json({
        message: "Cần xác định người chịu trách nhiệm chi trả."
      });
    }

    // 5. Tạo ticket
    const ticket = await CompensateTicket.create([{
      incident_id: incidentId,
      booking_id: booking_id || null,
      payer_type,
      payer_id: payer_id || null,
      note: note || "",
      total_fee: 0,
      status: "pending"
    }], { session });

    // 6. Update incident
    incident.compensation_status = "pending";
    await incident.save({ session });

    await session.commitTransaction();

    return res.status(201).json({
      message: "Tạo phiếu đền bù thành công.",
      data: ticket[0]
    });

  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({
      message: err.message || "Lỗi khi tạo phiếu đền bù."
    });
  } finally {
    session.endSession();
  }
};
