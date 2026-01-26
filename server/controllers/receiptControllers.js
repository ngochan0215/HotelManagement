import mongoose from "mongoose";
import { Booking, ServiceUsage, CompensateTicket, Receipt,
  BookingDetail, Employee, Incident, Customer, User, Discount
} from "../models/index.js";
import { updateCustomerPoints } from "./customerController.js";
import { pushNotificationToUsers } from "../services/notificationService.js";

/**
 * Cập nhật hóa đơn sau khi checkout để thêm các phí dịch vụ và đền bù
 * @param {ObjectId} booking_id - ID của booking
 * @param {Object} session - MongoDB session
 * @returns {Object} - Receipt đã được cập nhật
 */
export const updateReceiptAfterCheckout = async (booking_id, session = null) => {
  try {
    // Tìm hóa đơn đã tồn tại cho booking này
    const receipt = session 
      ? await Receipt.findOne({ booking_id }).session(session)
      : await Receipt.findOne({ booking_id });

    if (!receipt) {
      console.warn(`Không tìm thấy hóa đơn cho booking ${booking_id}. Có thể booking chưa có hóa đơn.`);
      return null;
    }

    // Nếu hóa đơn đã thanh toán hoặc đã hủy, không cập nhật
    if (receipt.status === "paid" || receipt.status === "cancelled") {
      console.warn(`Hóa đơn ${receipt._id} đã ở trạng thái ${receipt.status}, không thể cập nhật.`);
      return receipt;
    }

    // Tìm TẤT CẢ ServiceUsage đã hoàn thành cho booking này (một booking có thể có nhiều phiếu)
    let serviceFee = 0;
    let serviceUsageId = null;
    const serviceUsages = session
      ? await ServiceUsage.find({
          booking_id,
          status: "completed",
        }).session(session)
      : await ServiceUsage.find({
          booking_id,
          status: "completed",
        });

    if (serviceUsages && serviceUsages.length > 0) {
      // Tính tổng fee từ tất cả các phiếu sử dụng dịch vụ
      serviceFee = serviceUsages.reduce((sum, usage) => sum + (usage.total_fee || 0), 0);
      // Lưu ID của phiếu mới nhất (hoặc có thể lưu ID đầu tiên)
      serviceUsageId = serviceUsages[serviceUsages.length - 1]._id;
    }

    // Tìm TẤT CẢ CompensateTicket pending cho booking này (một booking có thể có nhiều phiếu)
    let compensateFee = 0;
    let compensateTicketId = null;
    const compensates = session
      ? await CompensateTicket.find({
          booking_id,
          status: "pending", // Tìm các phiếu đang pending để gộp vào hóa đơn
        }).session(session)
      : await CompensateTicket.find({
          booking_id,
          status: "pending",
        });

    if (compensates && compensates.length > 0) {
      // Tính tổng fee từ tất cả các phiếu đền bù
      compensateFee = compensates.reduce((sum, comp) => sum + (comp.total_fee || 0), 0);
      // Lưu ID của phiếu mới nhất (hoặc có thể lưu ID đầu tiên)
      compensateTicketId = compensates[compensates.length - 1]._id;
    }

    // Tính lại final_amount và amount_due
    const totalFee = receipt.total_fee; // Giữ nguyên total_fee từ booking
    const depositAmount = receipt.deposit_amount; // Giữ nguyên deposit_amount
    const finalAmount = totalFee + serviceFee + compensateFee;
    
    // Tính lại amount_due dựa trên số tiền đã trả
    // Nếu status là "half-paid", có nghĩa là đã trả deposit (hoặc một phần)
    // Nếu status là "pending", chưa trả gì
    // Nếu status là "paid", đã trả đủ (không nên vào đây vì đã check ở trên)
    let amountPaid = 0;
    if (receipt.status === "half-paid") {
      // Đã trả deposit, nhưng có thể đã trả thêm qua PayOS
      // Kiểm tra xem có transaction_id không (đã thanh toán qua PayOS)
      if (receipt.transaction_id) {
        // Nếu có transaction, có thể đã trả thêm, nhưng để đơn giản, chỉ tính deposit
        // Logic phức tạp hơn sẽ được xử lý trong payosService
        amountPaid = depositAmount;
      } else {
        amountPaid = depositAmount;
      }
    } else if (receipt.status === "paid") {
      // Đã trả đủ, không cần tính lại
      amountPaid = finalAmount;
    }
    
    const amountDue = Math.max(finalAmount - amountPaid, 0);

    // Cập nhật hóa đơn
    receipt.service_usage_id = serviceUsageId;
    receipt.compensate_ticket_id = compensateTicketId;
    receipt.service_fee = serviceFee;
    receipt.compensate_fee = compensateFee;
    receipt.final_amount = finalAmount;
    receipt.amount_due = amountDue;

    // Cập nhật note nếu có thay đổi
    if (serviceFee > 0 || compensateFee > 0) {
      const additionalFees = [];
      if (serviceFee > 0) additionalFees.push(`Phí dịch vụ: ${serviceFee.toLocaleString()}đ`);
      if (compensateFee > 0) additionalFees.push(`Phí đền bù: ${compensateFee.toLocaleString()}đ`);
      
      const existingNote = receipt.note || "";
      const newNote = existingNote 
        ? `${existingNote}. Đã cập nhật sau checkout: ${additionalFees.join(", ")}`
        : `Đã cập nhật sau checkout: ${additionalFees.join(", ")}`;
      receipt.note = newNote;
    }

    if (session) {
      await receipt.save({ session });
    } else {
      await receipt.save();
    }

    return receipt;
  } catch (error) {
    console.error("Lỗi khi cập nhật hóa đơn sau checkout:", error);
    throw error;
  }
};

export const createReceipt = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { booking_id, payment, note = "" } = req.body;
    const employee_user_id = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(booking_id)) {
      return res.status(400).json({ message: "booking_id không hợp lệ." });
    }

    if (!["cash", "bank"].includes(payment)) {
      return res.status(400).json({ message: "Phương thức thanh toán không hợp lệ. Chỉ chấp nhận tiền mặt hoặc chuyển khoản." });
    }

    const employee = await Employee.findOne(
      { user_id: employee_user_id },
      null,
      { session }
    );

    if (!employee) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên." });
    }

    const booking = await Booking.findById(booking_id).session(session);
    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy booking." });
    }

    // Cho phép tạo hóa đơn cho booking ở bất kỳ trạng thái nào (pending, confirmed, in_progress, completed)
    // Không cần check status === "completed" nữa

    // Kiểm tra xem đã có hóa đơn chưa
    // Nếu có, có thể là hóa đơn đã được tạo tự động khi tạo booking
    // Trong trường hợp này, nên cập nhật hóa đơn thay vì tạo mới
    const existedReceipt = await Receipt.findOne({ booking_id }).session(session);
    if (existedReceipt) {
      // Nếu hóa đơn đã tồn tại, cập nhật thay vì tạo mới
      // Điều này đảm bảo tính nhất quán với logic mới (hóa đơn được tạo khi booking)
      try {
        const updatedReceipt = await updateReceiptAfterCheckout(booking_id, session);
        
        // Cập nhật payment và note nếu có
        if (payment) {
          existedReceipt.payment = payment;
        }
        if (note) {
          existedReceipt.note = note;
        }
        await existedReceipt.save({ session });

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
          message: "Cập nhật hóa đơn thành công.",
          receipt: updatedReceipt || existedReceipt,
        });
      } catch (updateError) {
        console.error("Lỗi khi cập nhật hóa đơn:", updateError);
        // Nếu lỗi, vẫn trả về lỗi như cũ
        return res.status(400).json({
          message: "Booking này đã được tạo hóa đơn và không thể cập nhật.",
        });
      }
    }

    // Tìm TẤT CẢ ServiceUsage đã hoàn thành cho booking này (một booking có thể có nhiều phiếu)
    let serviceFee = 0;
    let serviceUsageId = null;

    const serviceUsages = await ServiceUsage.find({
      booking_id,
      status: "completed",
    }).session(session);

    if (serviceUsages && serviceUsages.length > 0) {
      // Tính tổng fee từ tất cả các phiếu sử dụng dịch vụ
      serviceFee = serviceUsages.reduce((sum, usage) => sum + (usage.total_fee || 0), 0);
      // Lưu ID của phiếu mới nhất
      serviceUsageId = serviceUsages[serviceUsages.length - 1]._id;
    }

    // Tìm TẤT CẢ CompensateTicket pending cho booking này (một booking có thể có nhiều phiếu)
    let compensateFee = 0;
    let compensateTicketId = null;

    const compensates = await CompensateTicket.find({
      booking_id,
      status: "pending", // Tìm các phiếu đang pending để gộp vào hóa đơn
    }).session(session);

    if (compensates && compensates.length > 0) {
      // Tính tổng fee từ tất cả các phiếu đền bù
      compensateFee = compensates.reduce((sum, comp) => sum + (comp.total_fee || 0), 0);
      // Lưu ID của phiếu mới nhất
      compensateTicketId = compensates[compensates.length - 1]._id;
    }

    const totalFee = booking.total_fee;
    const depositAmount = booking.deposit || 0;

    // Tính base_room_fee từ BookingDetail (tiền phòng gốc trước khi trừ discount)
    const bookingDetails = await BookingDetail.find({ booking_id }).session(session);
    const baseRoomFee = bookingDetails.reduce((sum, detail) => {
      const nights = Math.ceil((new Date(detail.expected_checkout) - new Date(detail.expected_checkin)) / (1000 * 60 * 60 * 24));
      return sum + (detail.base_fee * nights);
    }, 0);

    // Lấy discount_snapshot từ receipt hiện có (nếu đã tạo từ booking)
    let discountSnapshot = null;
    let discountId = null;
    
    // Kiểm tra xem đã có receipt nào cho booking này chưa (thường là receipt được tạo tự động khi tạo booking)
    const existingReceipt = await Receipt.findOne({ booking_id }).session(session);
    if (existingReceipt && existingReceipt.discount_snapshot) {
      discountSnapshot = existingReceipt.discount_snapshot;
      discountId = existingReceipt.discount_id;
    }

    const finalAmount = totalFee + serviceFee + compensateFee;
    const amountDue = Math.max(finalAmount - depositAmount, 0);

    const receipt = await Receipt.create(
      [
        {
          booking_id,
          employee_id: employee._id,
          discount_id: discountId,
          discount_snapshot: discountSnapshot,
          service_usage_id: serviceUsageId,
          compensate_ticket_id: compensateTicketId,

          base_room_fee: baseRoomFee,
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

    const allowedStatus = ["pending", "paid", "half-paid", "cancelled"];
    const allowedPayment = ["cash", "bank"];

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
      
      const booking = await Booking.findById(receipt.booking_id);
      if (booking) {
        // cộng điểm khách vì hoàn thành xong booking
        await updateCustomerPoints({
          customer_id: booking.customer_id,
          points: Math.floor(receipt.final_amount / 10000),
          reason: "Hoàn tất thanh toán hóa đơn"
        });

        await Customer.findOneAndUpdate(
          { _id: booking.customer_id },
          { $inc: { booking_count: 1 } }
        );
      }

      // Tự động cập nhật compensation tickets thành "paid" nếu có trong hóa đơn
      if (receipt.compensate_ticket_id || receipt.compensate_fee > 0) {
        try {
          // Tìm tất cả compensation tickets pending của booking này
          const compensateTickets = await CompensateTicket.find({
            booking_id: receipt.booking_id,
            status: "pending"
          });

          // Cập nhật tất cả thành "paid"
          for (const ticket of compensateTickets) {
            ticket.status = "paid";
            ticket.paid_at = new Date();
            await ticket.save();

            // Cập nhật incident liên quan
            const incident = await Incident.findById(ticket.incident_id);
            if (incident && incident.compensation_status === "pending") {
              incident.compensation_status = "done";
              if (incident.status !== "closed") {
                incident.status = "closed";
                incident.closed_at = new Date();
              }
              await incident.save();
            }
          }
        } catch (compError) {
          console.error("Error updating compensation tickets:", compError);
          // Không throw error để không ảnh hưởng đến update receipt
        }
      }
    }

    if (status === "cancelled" && !receipt.cancelled_at) {
      receipt.cancelled_at = new Date();
    }

    receipt.payment = payment;
    receipt.status = status;
    await receipt.save();

    // Gửi thông báo về thay đổi trạng thái hóa đơn
    try {
      // Populate để lấy thông tin booking, customer, employee
      const populatedReceipt = await Receipt.findById(id)
        .populate({
          path: "booking_id",
          populate: [
            {
              path: "customer_id",
              select: "user_id full_name"
            },
            {
              path: "handled_by",
              select: "user_id full_name"
            }
          ]
        })
        .populate({
          path: "employee_id",
          select: "user_id full_name"
        });

      if (!populatedReceipt || !populatedReceipt.booking_id) {
        throw new Error("Không thể lấy thông tin booking từ receipt");
      }

      const booking = populatedReceipt.booking_id;
      const customer = booking.customer_id;
      const receiptEmployee = populatedReceipt.employee_id;
      
      const statusLabels = {
        pending: "Đang chờ thanh toán",
        paid: "Đã thanh toán",
        "half-paid": "Đã thanh toán một phần",
        cancelled: "Đã hủy"
      };

      const receiptIdShort = id.toString().slice(-6);
      const statusLabel = statusLabels[status] || status;
      const message = `Hóa đơn #${receiptIdShort} đã chuyển sang trạng thái "${statusLabel}"`;

      // 1. Gửi thông báo cho toàn bộ admin
      const adminUsers = await User.find({ 
        isBanned: { $ne: true },
        system_role: "manager"
      }).select("_id");
      const adminUserIds = adminUsers.map(u => u._id);
      
      if (adminUserIds.length > 0) {
        await pushNotificationToUsers(
          adminUserIds,
          "Thay đổi trạng thái hóa đơn",
          message,
          "booking",
          "Order",
          id,
          "unread"
        );
      }

      // 2. Gửi thông báo cho nhân viên phụ trách hóa đơn (employee_id trong receipt)
      if (receiptEmployee && receiptEmployee.user_id) {
        await pushNotificationToUsers(
          [receiptEmployee.user_id],
          "Thay đổi trạng thái hóa đơn",
          message,
          "booking",
          "Order",
          id,
          "unread"
        );
      }

      // 3. Gửi thông báo cho nhân viên phụ trách booking (nếu có handled_by trong booking)
      const bookingEmployee = booking.handled_by;
      if (bookingEmployee && bookingEmployee.user_id) {
        // Chỉ gửi nếu không phải cùng nhân viên với receipt employee
        if (!receiptEmployee || bookingEmployee.user_id.toString() !== receiptEmployee.user_id.toString()) {
          await pushNotificationToUsers(
            [bookingEmployee.user_id],
            "Thay đổi trạng thái hóa đơn",
            message,
            "booking",
            "Order",
            id,
            "unread"
          );
        }
      }

      // 4. Gửi thông báo cho khách hàng có booking
      if (customer && customer.user_id) {
        await pushNotificationToUsers(
          [customer.user_id],
          "Thay đổi trạng thái hóa đơn",
          message,
          "booking",
          "Order",
          id,
          "unread"
        );
      }
    } catch (notifError) {
      console.error("Error sending notification:", notifError);
      // Không throw error để không ảnh hưởng đến response chính
    }

    return res.status(200).json({
      success: true,
      data: receipt
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Cập nhật hóa đơn sau checkout để refresh compensation và service fees
export const refreshReceiptAfterCheckout = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "receipt_id không hợp lệ." });
    }

    const receipt = await Receipt.findById(id);
    if (!receipt) {
      return res.status(404).json({ message: "Không tìm thấy hóa đơn." });
    }

    // Nếu hóa đơn đã thanh toán hoặc đã hủy, không cho phép cập nhật
    if (receipt.status === "paid" || receipt.status === "cancelled") {
      return res.status(400).json({ 
        message: `Hóa đơn đã ở trạng thái "${receipt.status}", không thể cập nhật.` 
      });
    }

    // Gọi hàm updateReceiptAfterCheckout để refresh
    const updatedReceipt = await updateReceiptAfterCheckout(receipt.booking_id);

    if (!updatedReceipt) {
      return res.status(404).json({ 
        message: "Không tìm thấy hóa đơn để cập nhật." 
      });
    }

    return res.status(200).json({
      message: "Cập nhật hóa đơn thành công.",
      receipt: updatedReceipt
    });
  } catch (error) {
    console.error("Error refreshing receipt:", error);
    return res.status(500).json({
      message: error.message || "Không thể cập nhật hóa đơn."
    });
  }
};

export const markReceiptAsPaid = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { payment } = req.body;

    const employee_user_id = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "receipt_id không hợp lệ." });
    }

    if (!["cash", "bank"].includes(payment)) {
      return res.status(400).json({ message: "Phương thức thanh toán không hợp lệ. Chỉ chấp nhận tiền mặt hoặc chuyển khoản." });
    }

    const employee = await Employee.findOne(
      { user_id: employee_user_id },
      null,
      { session }
    );

    if (!employee) {
      return res.status(404).json({ message: "Không tìm thấy nhân viên." });
    }

    const receipt = await Receipt.findById(id).session(session);
    if (!receipt) {
      return res.status(404).json({ message: "Không tìm thấy hóa đơn." });
    }

    if (receipt.status === "paid") {
      return res.status(400).json({ message: "Hóa đơn đã được thanh toán." });
    }

    if (receipt.status === "cancelled") {
      return res.status(400).json({ message: "Hóa đơn đã hủy, không thể thanh toán." });
    }

    const booking = await Booking.findById(receipt.booking_id).session(session);
    if (!booking) {
      return res.status(404).json({ message: "Không tìm thấy booking." });
    }

    // cập nhật hóa đơn
    receipt.status = "paid";
    receipt.payment = payment;
    receipt.paid_at = new Date();
    // employee_id đã có sẵn trong receipt, không cần set lại

    await receipt.save({ session });

    // cộng điểm khách hàng
    const rewardPoints = Math.floor(receipt.final_amount / 10000);

    await updateCustomerPoints({
      customer_id: booking.customer_id,
      points: rewardPoints,
      reason: "Hoàn tất thanh toán hóa đơn"
    });

    await Customer.findByIdAndUpdate(
      booking.customer_id,
      { $inc: { booking_count: 1 } },
      { session }
    );

    // Tự động cập nhật compensation tickets thành "paid" nếu có trong hóa đơn
    if (receipt.compensate_ticket_id || receipt.compensate_fee > 0) {
      // Tìm tất cả compensation tickets pending của booking này
      const compensateTickets = await CompensateTicket.find({
        booking_id: receipt.booking_id,
        status: "pending"
      }).session(session);

      // Cập nhật tất cả thành "paid"
      for (const ticket of compensateTickets) {
        ticket.status = "paid";
        ticket.paid_at = new Date();
        await ticket.save({ session });

        // Cập nhật incident liên quan
        const incident = await Incident.findById(ticket.incident_id).session(session);
        if (incident && incident.compensation_status === "pending") {
          incident.compensation_status = "done";
          if (incident.status !== "closed") {
            incident.status = "closed";
            incident.closed_at = new Date();
          }
          await incident.save({ session });
        }
      }
    }

    await session.commitTransaction();

    // Gửi thông báo về thay đổi trạng thái hóa đơn
    try {
      // Populate để lấy thông tin booking, customer, employee
      const populatedReceipt = await Receipt.findById(id)
        .populate({
          path: "booking_id",
          populate: [
            {
              path: "customer_id",
              select: "user_id full_name"
            },
            {
              path: "handled_by",
              select: "user_id full_name"
            }
          ]
        })
        .populate({
          path: "employee_id",
          select: "user_id full_name"
        });

      if (!populatedReceipt || !populatedReceipt.booking_id) {
        throw new Error("Không thể lấy thông tin booking từ receipt");
      }

      const booking = populatedReceipt.booking_id;
      const customer = booking.customer_id;
      const receiptEmployee = populatedReceipt.employee_id;
      
      const receiptIdShort = id.toString().slice(-6);
      const message = `Hóa đơn #${receiptIdShort} đã chuyển sang trạng thái "Đã thanh toán"`;

      // 1. Gửi thông báo cho toàn bộ admin
      const adminUsers = await User.find({ 
        isBanned: { $ne: true },
        system_role: "manager"
      }).select("_id");
      const adminUserIds = adminUsers.map(u => u._id);
      
      if (adminUserIds.length > 0) {
        await pushNotificationToUsers(
          adminUserIds,
          "Thay đổi trạng thái hóa đơn",
          message,
          "booking",
          "Order",
          id,
          "unread"
        );
      }

      // 2. Gửi thông báo cho nhân viên phụ trách hóa đơn (employee_id trong receipt)
      if (receiptEmployee && receiptEmployee.user_id) {
        await pushNotificationToUsers(
          [receiptEmployee.user_id],
          "Thay đổi trạng thái hóa đơn",
          message,
          "booking",
          "Order",
          id,
          "unread"
        );
      }

      // 3. Gửi thông báo cho nhân viên phụ trách booking (nếu có handled_by trong booking)
      const bookingEmployee = booking.handled_by;
      if (bookingEmployee && bookingEmployee.user_id) {
        // Chỉ gửi nếu không phải cùng nhân viên với receipt employee
        if (!receiptEmployee || bookingEmployee.user_id.toString() !== receiptEmployee.user_id.toString()) {
          await pushNotificationToUsers(
            [bookingEmployee.user_id],
            "Thay đổi trạng thái hóa đơn",
            message,
            "booking",
            "Order",
            id,
            "unread"
          );
        }
      }

      // 4. Gửi thông báo cho khách hàng có booking
      if (customer && customer.user_id) {
        await pushNotificationToUsers(
          [customer.user_id],
          "Thay đổi trạng thái hóa đơn",
          message,
          "booking",
          "Order",
          id,
          "unread"
        );
      }
    } catch (notifError) {
      console.error("Error sending notification:", notifError);
      // Không throw error để không ảnh hưởng đến response chính
    }

    session.endSession();

    return res.status(200).json({
      message: "Thanh toán hóa đơn thành công.",
      receipt
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      message: error.message || "Không thể thanh toán hóa đơn."
    });
  }
};
