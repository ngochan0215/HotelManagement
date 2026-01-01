import { Incident, Room, User } from "../models/index.js";
import mongoose from "mongoose";

const MAX_DAYS = 30;

//---- INCIDENT ----//
export const reportIncident = async (req, res) => {
    try {
        const { room_id, causer_id, reporter_id, caused_by, description, type, severity, occured_at } = req.body;

        if (!room_id || !reporter_id || !description || !type || !caused_by || !severity || !occured_at) {
            return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
        }

        const room = await Room.findById(room_id);
        if (!room) {
            return res.status(404).json({ message: "Phòng không tồn tại." });
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

        const incident = new Incident({
            room_id,
            causer_id,
            reporter_id,
            caused_by,  
            description,
            type,
            severity,
            occured_at: new Date(occured_at),
            status: "reported",
            compensation_status: "none"
        });

        await incident.save();

        return res.status(201).json({
            message: "Thêm sự cố thành công.",
            data: incident,
        });
    } catch (err) {
        return res.status(400).json({ message: err.message || "Lỗi khi tạo sự cố."});
    }
};

export const updateIncident = async (req, res) => {
    try {
        const { description, type, severity, fixed_date, finish_date } = req.body;

        if (!room_id || !description || !type || !caused_by || !severity || !occured_at) {
            return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
        }

        const room = await Room.findById(room_id);
        if (!room) {
            return res.status(404).json({ message: "Phòng không tồn tại." });
        }

        const user = await User.findById(caused_user);
        if (!user) {
            return res.status(404).json({ message: "Người dùng gây ra sự cố không tồn tại." });
        }

        const incident = new Incident({
            room_id,
            caused_user,
            caused_by,  
            description,
            type,
            severity,
            occured_at: new Date(occured_at),
            fixed_date: fixed_date ? new Date(fixed_date) : null,
            finish_date: finish_date ? new Date(finish_date) : null,
        });

        return res.status(201).json({
            message: "Thêm sự cố thành công.",
            data: incident,
        });
    } catch (err) {
        return res.status(400).json({ message: err.message || "Lỗi khi tạo sự cố."});
    }
};

export const getAllIncidents = async (req, res) => {
    try {
        const { room_id, caused_user, caused_by, description, type, severity, occured_at, fixed_date, finish_date } = req.body;

        if (!room_id || !description || !type || !caused_by || !severity || !occured_at) {
            return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
        }

        const room = await Room.findById(room_id);
        if (!room) {
            return res.status(404).json({ message: "Phòng không tồn tại." });
        }

        const user = await User.findById(caused_user);
        if (!user) {
            return res.status(404).json({ message: "Người dùng gây ra sự cố không tồn tại." });
        }

        const incident = new Incident({
            room_id,
            caused_user,
            caused_by,  
            description,
            type,
            severity,
            occured_at: new Date(occured_at),
            fixed_date: fixed_date ? new Date(fixed_date) : null,
            finish_date: finish_date ? new Date(finish_date) : null,
        });

        return res.status(201).json({
            message: "Thêm sự cố thành công.",
            data: incident,
        });
    } catch (err) {
        return res.status(400).json({ message: err.message || "Lỗi khi tạo sự cố."});
    }
};

export const getIncidentById = async (req, res) => {
    try {
        const { room_id, caused_user, caused_by, description, type, severity, occured_at, fixed_date, finish_date } = req.body;

        if (!room_id || !description || !type || !caused_by || !severity || !occured_at) {
            return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
        }

        const room = await Room.findById(room_id);
        if (!room) {
            return res.status(404).json({ message: "Phòng không tồn tại." });
        }

        const user = await User.findById(caused_user);
        if (!user) {
            return res.status(404).json({ message: "Người dùng gây ra sự cố không tồn tại." });
        }

        const incident = new Incident({
            room_id,
            caused_user,
            caused_by,  
            description,
            type,
            severity,
            occured_at: new Date(occured_at),
            fixed_date: fixed_date ? new Date(fixed_date) : null,
            finish_date: finish_date ? new Date(finish_date) : null,
        });

        return res.status(201).json({
            message: "Thêm sự cố thành công.",
            data: incident,
        });
    } catch (err) {
        return res.status(400).json({ message: err.message || "Lỗi khi tạo sự cố."});
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
