import mongoose from "mongoose";
import { Booking, ServiceUsage, CompensateTicket, Receipt,
  BookingDetail, Employee, Incident
 } from "../models/index.js";

export const createReceipt = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { booking_id, service_usage_id, compensate_ticket_id, payment, note = "" } = req.body;
    const employee_user_id = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(booking_id)) {
      return res.status(400).json({ message: "booking_id không hợp lệ." });
    }

    if (!["cash", "card", "bank", "e-wallet"].includes(payment)) {
      return res.status(400).json({ message: "Phương thức thanh toán không hợp lệ." });
    }

    const employee = await Employee.findOne(
      { user_id: employee_user_id }, null, { session }
    );

    if (!employee) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên." });
    }

    const booking = await Booking.findById(booking_id).session(session);
    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy booking." });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({
        message: "Chỉ được tạo hóa đơn cho booking đã hoàn thành.",
      });
    }

    const existedReceipt = await Receipt.findOne({ booking_id }).session(session);
    if (existedReceipt) {
      return res.status(400).json({
        message: "Booking này đã được tạo hóa đơn.",
      });
    }

    let serviceFee = 0;
    if (service_usage_id) {
      if (!mongoose.Types.ObjectId.isValid(service_usage_id))
        return res.status(400).json({ message: "service_usage_id không hợp lệ." });

      const serviceUsage = await ServiceUsage.findById(service_usage_id).session(session);
      if (!serviceUsage) {
        return res.status(404).json({ message: "Không tìm thấy phiếu sử dụng dịch vụ." });
      }

      if (serviceUsage.status !== "completed") {
        return res.status(400).json({
          message: "Phiếu sử dụng dịch vụ chưa hoàn tất.",
        });
      }

      const bookingId = serviceUsage._id;
      if (booking_id.toString() !== bookingId.toString()) {
        return res.status(400).json({ message: "booking_id tương ứng của phiếu dịch vụ không hợp lệ." });
      }

      serviceFee = serviceUsage.total_fee;
    }

    let compensateFee = 0;
    if (compensate_ticket_id) {
      if (!mongoose.Types.ObjectId.isValid(compensate_ticket_id)) {
        return res.status(400).json({ message: "booking_id không hợp lệ." });
      }

      const compensate = await CompensateTicket.findById(compensate_ticket_id).session(session);
      if (!compensate) {
        return res.status(404).json({ message: "Không tìm thấy phiếu bồi thường." });
      }

      if (compensate.status !== "completed") {
        return res.status(400).json({
          message: "Phiếu bồi thường chưa hoàn tất.",
        });
      }

      const incident = await Incident.findById(compensate_ticket.incident_id);
      const bookingId = incident.booking_id;

      if (booking_id.toString() !== bookingId.toString()) {
        return res.status(400).json({ message: "booking_id của phiếu đền bù tương ứng không hợp lệ." });
      }

      compensateFee = compensate.total_fee;
    }

    const totalFee = booking.total_fee;
    const depositAmount = booking.deposit || 0;

    const finalAmount = totalFee + serviceFee + compensateFee;
    const amountDue = Math.max(finalAmount - depositAmount, 0);

    const receipt = await Receipt.create(
      [
        {
          booking_id,
          employee_id: employee._id,
          service_usage_id: service_usage_id || null,
          compensate_ticket_id: compensate_ticket_id || null,

          total_fee: totalFee,
          service_fee: serviceFee,
          compensate_fee: compensateFee,
          deposit_amount: depositAmount,

          final_amount: finalAmount,
          amount_due: amountDue,

          payment,
          status: depositAmount === 0 ? "half-paid" : "pending",
          note,
        },
      ],
      { session }
    );

    if (amountDue === 0) {
      booking.status = "completed";
      await booking.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Tạo hóa đơn thành công.",
      receipt: receipt[0],
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      message: err.message || "Không thể tạo hóa đơn.",
    });
  }
};

export const getReceiptById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "receipt_id không hợp lệ." });
    }

    const receipt = await Receipt.findById(id)
      .populate({
        path: "booking_id",
        populate: {
          path: "customer_id",
          select: "full_name phone_number CCCD",
        },
      })
      .populate({
        path: "employee_id",
        populate: {
          path: "user_id",
          select: "full_name email",
        },
      })
      .populate("service_usage_id")
      .populate("compensate_ticket_id");

    if (!receipt) {
      return res.status(404).json({ message: "Không tìm thấy hóa đơn." });
    }

    return res.status(200).json({ receipt });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Không thể lấy thông tin hóa đơn.",
    });
  }
};

export const getAllReceipts = async (req, res) => {
  try {
    const {
      status,
      payment,
      booking_id,
      from_date,
      to_date,
      keyword,
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (payment) filter.payment = payment;

    if (booking_id) {
      if (!mongoose.Types.ObjectId.isValid(booking_id)) {
        return res.status(400).json({ message: "booking_id không hợp lệ." });
      }
      filter.booking_id = booking_id;
    }

    if (from_date || to_date) {
      filter.created_at = {};
      if (from_date) filter.created_at.$gte = new Date(from_date);
      if (to_date) filter.created_at.$lte = new Date(to_date);
    }

    let query = Receipt.find(filter)
      .populate({
        path: "booking_id",
        populate: {
          path: "customer_id",
          select: "full_name phone_number",
        },
      })
      .populate({
        path: "employee_id",
        populate: {
          path: "user_id",
          select: "full_name",
        },
      })
      .sort({ created_at: -1 });

    const receipts = await query;

    let result = receipts;

    // search theo tên khách
    if (keyword) {
      const lower = keyword.toLowerCase();
      result = receipts.filter(r =>
        r.booking_id?.customer_id?.full_name
          ?.toLowerCase()
          .includes(lower)
      );
    }

    return res.status(200).json({
      total: result.length,
      receipts: result,
    });

  } catch (err) {
    return res.status(500).json({
      message: err.message || "Không thể lấy danh sách hóa đơn.",
    });
  }
};

export const updateReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment } = req.body;

    const allowedStatus = ["pending", "paid", "cancelled"];
    const allowedPayment = ["cash", "card", "bank", "e-wallet"];

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({
        success: false,
        message: "ID hóa đơn không hợp lệ."
      });

    if (!allowedStatus.includes(status))
      return res.status(400).json({
        success: false,
        message: "Trạng thái không hợp lệ."
      });

    if (!allowedPayment.includes(payment))
      return res.status(400).json({
        success: false,
        message: "Phương thức thanh toán không hợp lệ."
      });

    const receipt = await Receipt.findById(id);
    if (!receipt)
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hóa đơn."
      });

    if (receipt.status === "paid") {
      return res.status(400).json({
        success: false,
        message: "Hóa đơn đã thanh toán không thể thay đổi trạng thái."
      });
    }

    if (receipt.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Hóa đơn đã hủy không thể cập nhật được nữa."
      });
    }

    if (status === "paid" && !receipt.paid_at) {
      receipt.paid_at = new Date();
    }

    if (status === "cancelled" && !receipt.cancelled_at) {
      receipt.cancelled_at = new Date();
    }

    receipt.payment = payment;
    receipt.status = status;
    await receipt.save();

    return res.status(200).json({
      success: true,
      data: invoice
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
