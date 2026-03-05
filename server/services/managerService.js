import mongoose from "mongoose";

export class ManagerService {
    constructor({ User, Room, RoomLog, Booking, BookingDetail }) {
        this.User = User;
        this.Room = Room;
        this.RoomLog = RoomLog;
        this.Booking = Booking;
        this.BookingDetail = BookingDetail;
    }

    async setRole() {
        try {
            const { userId, newRole } = req.body;
    
            if (!userId || !newRole) {
                throw new Error("Thiếu userId hoặc newRole.");
            }
    
            if (!["employee", "customer"].includes(newRole)) {
                throw new Error("Role không hợp lệ.");
            }
    
            const user = await this.User.findById(userId);
            if (!user) {
                throw new Error("Không tìm thấy user.");
            }
    
            if (user.system_role === newRole) {
                throw new Error(`User đã là ${newRole}.`);
            }
    
            user.system_role = newRole;
            await user.save();

            return { success: true };
    
            // const notification = await Notification.create({
            //     user_id: user._id,
            //     title: "Thay đổi quyền",
            //     content: `Quyền hệ thống của bạn đã được đổi thành ${newRole}.`
            // });
    
            // emitToUser(req.app.get("io"), user._id.toString(), "user:role_updated", {
            //     notification,
            // });
        } catch (err) {
            console.error(err);
            throw new Error("Lỗi server.");
        }
    };
    
    async getAllUsers(query = {}) {
      try {
        const { system_role } = req.query;
    
        const filter = {};
        if (system_role) {
          filter.system_role = system_role;
        }
    
        const users = await this.User.find(filter)
          .select("email system_role avatar")
          .sort({ created_at: -1 });

        return users;
    
      } catch (error) {
        console.log(error);
        throw new Error("Lỗi server.");
      }
    };
    
    async setRule() {
        // Implementation for setting rules
    }
    
    async getCalendarRooms(query = {}) {
      try {
        const { date } = query;
        if (!date) {
          throw new Error("Thiếu ngày xem lịch");
        }
    
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
    
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
    
        const rooms = await this.Room.find()
          .select("room_number category_id floor")
          .populate("category_id", "category_name")
          .lean();
    
        const roomIds = rooms.map(r => r._id);
    
        // Lấy tất cả RoomLog có overlap với ngày được chọn hoặc nằm hoàn toàn trong ngày đó
        // Bao gồm cả log cleaning/maintenance nằm hoàn toàn trong ngày
        const statusLogs = await this.RoomLog.find({
          room_id: { $in: roomIds },
          $or: [
            // Log có overlap với ngày được chọn (bắt đầu trước và kết thúc sau hoặc trong ngày)
            {
              start_time: { $lte: endOfDay },
              $or: [
                { end_time: { $gte: startOfDay } },
                { end_time: null }
              ]
            },
            // Log nằm hoàn toàn trong ngày được chọn (cả start và end đều trong ngày)
            // Điều này đảm bảo lấy được log cleaning/maintenance nằm hoàn toàn trong ngày
            {
              start_time: { $gte: startOfDay, $lte: endOfDay },
              end_time: { $gte: startOfDay, $lte: endOfDay }
            }
          ],
          status: { $ne: "available" }
        })
          .populate("room_id", "room_number")
          .populate("booking_id")
          .sort({ start_time: 1 }) // Sắp xếp theo thời gian bắt đầu
          .lean();
    
        const bookingIdsFromLogs = statusLogs
          .map(log => {
            if (!log.booking_id) return null;
            if (typeof log.booking_id === 'object' && log.booking_id._id) {
              return log.booking_id._id;
            }
            return log.booking_id;
          })
          .filter(id => id !== null && id !== undefined);
    
        // Get BookingDetails for rooms in the date range
        const bookingDetails = await this.BookingDetail.find({
          room_id: { $in: roomIds },
          $or: [
            { expected_checkin: { $lte: endOfDay }, expected_checkout: { $gte: startOfDay } },
            { actual_checkin: { $lte: endOfDay }, actual_checkout: { $gte: startOfDay } }
          ]
        })
          .populate("booking_id")
          .lean();
    
        // Get unique booking IDs from BookingDetails
        const bookingIdsFromDetails = bookingDetails
          .map(d => {
            if (!d.booking_id) return null;
            if (typeof d.booking_id === 'object' && d.booking_id._id) {
              return d.booking_id._id;
            }
            return d.booking_id;
          })
          .filter(Boolean);
        
        // Combine all booking IDs
        const allBookingIds = [...new Set([
          ...bookingIdsFromLogs,
          ...bookingIdsFromDetails
        ].filter(Boolean))];
    
        // Fetch bookings with customer info
        const bookings = await this.Booking.find({
          _id: { $in: allBookingIds },
          status: { $nin: ["cancelled", "expired"] }
        })
          .populate("customer_id", "full_name phone_number CCCD")
          .lean();
    
        // Create a map of booking_id -> booking for quick lookup
        const bookingMap = {};
        bookings.forEach(b => {
          bookingMap[b._id.toString()] = b;
        });
    
        // Create a map of room_id -> bookingDetail for quick lookup
        const bookingDetailMap = {};
        bookingDetails.forEach(detail => {
          const roomIdStr = (detail.room_id?._id || detail.room_id).toString();
          if (!bookingDetailMap[roomIdStr]) {
            bookingDetailMap[roomIdStr] = [];
          }
          bookingDetailMap[roomIdStr].push(detail);
        });
    
        const findBookingForLog = (log) => {
          // try to use booking_id from RoomLog if available
          if (log.booking_id) {
            let bookingId;
            if (typeof log.booking_id === 'object' && log.booking_id._id) {
              bookingId = log.booking_id._id.toString();
            } else if (typeof log.booking_id === 'object') {
              bookingId = log.booking_id.toString();
            } else {
              bookingId = log.booking_id.toString();
            }
    
            const booking = bookingMap[bookingId];
            if (booking) {
              return booking;
            }
          }
    
          // Fallback: find booking by matching room and time from BookingDetails
          const roomIdStr = (log.room_id?._id || log.room_id).toString();
          const details = bookingDetailMap[roomIdStr] || [];
          
          if (details.length === 0) {
            return null;
          }
    
          // Exact time overlap match (most precise)
          for (const detail of details) {
            //console.log("DETAIL: ", detail);
            const bookingId = (detail.booking_id?._id || detail.booking_id).toString();
            const booking = bookingMap[bookingId];
            
            if (!booking) continue;
    
            const checkin = detail.actual_checkin || detail.expected_checkin;
            const checkout = detail.actual_checkout || detail.expected_checkout;
    
            if (!checkin || !checkout) continue;
    
            const checkinDate = new Date(checkin);
            const checkoutDate = new Date(checkout);
            const logEnd = log.end_time || endOfDay;
    
            // Exact overlap: booking period intersects with log period
            if (checkinDate < logEnd && checkoutDate > log.start_time) {
              return booking;
            }
          }
    
          // Match by status and time proximity
          // For "booked", "occupied", "reserved" statuses, find active bookings
          if (['booked', 'occupied', 'reserved'].includes(log.status)) {
            for (const detail of details) {
              const bookingId = (detail.booking_id?._id || detail.booking_id).toString();
              const booking = bookingMap[bookingId];
              
              if (!booking) continue;
              
              // Skip cancelled/expired bookings
              if (['cancelled', 'expired'].includes(booking.status)) continue;
    
              const checkin = detail.actual_checkin || detail.expected_checkin;
              const checkout = detail.actual_checkout || detail.expected_checkout;
    
              if (!checkin || !checkout) continue;
    
              const checkinDate = new Date(checkin);
              const checkoutDate = new Date(checkout);
              const logEnd = log.end_time || endOfDay;
              const logStart = log.start_time;
    
              // Check if log time is within or very close to booking period
              // Allow 1 hour buffer for flexibility
              const oneHour = 60 * 60 * 1000;
              const logStartWithBuffer = new Date(logStart.getTime() - oneHour);
              const logEndWithBuffer = new Date(logEnd.getTime() + oneHour);
    
              if (checkinDate <= logEndWithBuffer && checkoutDate >= logStartWithBuffer) {
                return booking;
              }
            }
          }
    
          // For cleaning/maintenance, find the most recent booking that just ended
          if (['cleaning', 'maintenance'].includes(log.status)) {
            let closestBooking = null;
            let smallestGap = Infinity;
    
            for (const detail of details) {
              const bookingId = (detail.booking_id?._id || detail.booking_id).toString();
              const booking = bookingMap[bookingId];
              
              if (!booking) continue;
              if (['cancelled', 'expired'].includes(booking.status)) continue;
    
              const checkout = detail.actual_checkout || detail.expected_checkout;
              if (!checkout) continue;
    
              const checkoutDate = new Date(checkout);
              const logStart = log.start_time;
    
              // Find booking that ended just before or at the log start time
              if (checkoutDate <= logStart) {
                const gap = logStart.getTime() - checkoutDate.getTime();
                // Prefer bookings that ended recently (within 24 hours)
                if (gap < 24 * 60 * 60 * 1000 && gap < smallestGap) {
                  smallestGap = gap;
                  closestBooking = booking;
                }
              }
            }
    
            if (closestBooking) {
              return closestBooking;
            }
          }
    
          // Find closest booking by time (fallback for any status)
          let closestBooking = null;
          let smallestTimeDiff = Infinity;
    
          for (const detail of details) {
            const bookingId = (detail.booking_id?._id || detail.booking_id).toString();
            const booking = bookingMap[bookingId];
            
            if (!booking) continue;
            if (['cancelled', 'expired'].includes(booking.status)) continue;
    
            const checkin = detail.actual_checkin || detail.expected_checkin;
            const checkout = detail.actual_checkout || detail.expected_checkout;
    
            if (!checkin || !checkout) continue;
    
            const checkinDate = new Date(checkin);
            const checkoutDate = new Date(checkout);
            const logStart = log.start_time;
            const logEnd = log.end_time || endOfDay;
    
            // Calculate time difference between log and booking period
            let timeDiff;
            if (logEnd < checkinDate) {
              // Log is before booking
              timeDiff = checkinDate.getTime() - logEnd.getTime();
            } else if (logStart > checkoutDate) {
              // Log is after booking
              timeDiff = logStart.getTime() - checkoutDate.getTime();
            } else {
              // There's some overlap (should have been caught in Strategy 1, but just in case)
              timeDiff = 0;
            }
    
            // Prefer bookings within 48 hours
            if (timeDiff < 48 * 60 * 60 * 1000 && timeDiff < smallestTimeDiff) {
              smallestTimeDiff = timeDiff;
              closestBooking = booking;
            }
          }
    
          return closestBooking;
        };
    
        const STATUS_META = {
          reserved: "Chờ cọc",
          booked: "Đã cọc",
          occupied: "Đang ở",
          cleaning: "Dọn dẹp",
          maintenance: "Bảo trì",
        };
    
        const events = statusLogs.map(log => {
          const booking = findBookingForLog(log);
    
          return {
            _id: log._id,
            room_id: log.room_id?._id,
            room_number: log.room_id?.room_number,
            start: log.start_time,
            end: log.end_time || endOfDay,
            status: log.status,
            title: STATUS_META[log.status] || log.status,
            note: log.note || "",
    
            booking: booking ? {
              booking_id: booking._id,
              booking_code: booking._id.toString().slice(-6).toUpperCase(),
              booking_status: booking.status,
              customer_id: booking.customer_id?._id,
              customer_name: booking.customer_id?.full_name || "Khách vãng lai",
              customer_phone: booking.customer_id?.phone_number || "",
              customer_cccd: booking.customer_id?.CCCD || ""
            } : null
          };
        });

        return { rooms, events };
    
      } catch (error) {
        console.error("getRoomCalendar error:", error);
        throw error;
      }
    };
}