import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { Employee, User, Customer, Booking, BookingDetail, Room } from "../models/index.js";
import { defaultAvatars } from "../config/avatars.js";

export const setRole = async (req, res) => {
    try {
        const { userId, newRole } = req.body;

        if (!userId || !newRole) {
            return res.status(400).json({ message: "Thiếu userId hoặc newRole." });
        }

        if (!["employee", "customer"].includes(newRole)) {
            return res.status(400).json({ message: "Role không hợp lệ." });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy user." });
        }

        if (user.system_role === newRole) {
            return res.status(400).json({ message: `User đã là ${newRole}.` });
        }

        user.system_role = newRole;
        await user.save();

        // const notification = await Notification.create({
        //     user_id: user._id,
        //     title: "Thay đổi quyền",
        //     content: `Quyền hệ thống của bạn đã được đổi thành ${newRole}.`
        // });

        // emitToUser(req.app.get("io"), user._id.toString(), "user:role_updated", {
        //     notification,
        // });

        return res.status(200).json({
            message: `Đã nâng quyền user thành ${newRole}.`,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Lỗi server." });
    }
};

//---- QUY ĐỊNHH ----//
export const setRule = async (req, res) => {
}

// trả về lịch phòng
export const getCalendarRooms = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: "Thiếu ngày cần xem lịch." });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // lấy danh sách phòng
    const rooms = await Room.find()
      .select("room_number category_id")
      .populate("category_id", "category_name")
      .lean();

    // lấy booking detail
    const bookingDetails = await BookingDetail.find({
      expected_checkin: { $lte: endOfDay },
      expected_checkout: { $gte: startOfDay }
    })
      .populate({
        path: "booking_id",
        select: "status customer_id",
        populate: {
          path: "customer_id",
          select: "full_name"
        }
      })
      .populate("room_id", "room_number")
      .lean();

    // map thành event cho calendar
    const events = bookingDetails.map(detail => ({
      id: detail._id,
      booking_id: detail.booking_id?._id,
      room_id: detail.room_id?._id,
      title: detail.booking_id?.customer_id?.full_name || "Guest",
      start: detail.expected_checkin,
      end: detail.expected_checkout,
      status: detail.booking_id?.status
    }));

    return res.json({
      rooms,
      events
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Không thể tải lịch phòng."
    });
  }
};