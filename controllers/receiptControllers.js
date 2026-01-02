import mongoose from "mongoose";
import { Booking, Service, Discount } from "../models/index.js";

export const createReceipt = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { booking_id, employee_id, payment, note } = req.body;

    // 1. validate
    const booking = await Booking.findById(booking_id).session(session);
    if (!booking) throw new Error("Booking không tồn tại");

    if (booking.status !== "completed") {
      throw new Error("Chỉ tạo hóa đơn khi booking đã hoàn thành");
    }

    const existed = await Receipt.exists({ booking_id });
    if (existed) throw new Error("Booking đã có hóa đơn");

    // 2. booking details
    const details = await BookingDetail.find({
      booking_id,
      status: { $ne: "cancelled" },
    }).session(session);

    const totalRoomFee = details.reduce(
      (s, d) => s + d.base_fee + (d.extra_fee || 0),
      0
    );

    // 3. services
    const services = await BookingService.find({ booking_id }).session(session);
    const serviceFee = services.reduce((s, sv) => s + sv.total_price, 0);

    // 4. compensate
    let compensateFee = 0;
    const ticket = await CompensateTicket.findOne({
      booking_id,
      status: "approved",
    }).session(session);

    if (ticket) compensateFee = ticket.total_fee;

    // 5. discounts snapshot
    const discounts = booking.pricing?.discounts || [];
    const discountTotal = discounts.reduce(
      (s, d) => s + d.applied_amount,
      0
    );

    // 6. total
    const totalAmount =
      totalRoomFee + serviceFee - discountTotal - compensateFee;

    const amountDue = Math.max(totalAmount - booking.deposit, 0);

    // 7. create receipt
    const receipt = await Receipt.create(
      [
        {
          booking_id,
          employee_id,
          discounts,
          compensate_id: ticket?._id || null,
          total_room_fee: totalRoomFee,
          service_fee: serviceFee,
          compensate_fee: compensateFee,
          total_amount: totalAmount,
          deposit_amount: booking.deposit,
          amount_due: amountDue,
          payment,
          note,
          status: amountDue === 0 ? "paid" : "pending",
          paid_at: amountDue === 0 ? new Date() : null,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json(receipt[0]);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    return res.status(400).json({ message: err.message });
  }
};