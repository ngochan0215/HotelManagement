
export class RoomStatisticService {
    constructor({ Room, RoomCategory, RoomLog, DefaultEquipment, eventBus }) {
        this.Room = Room;
        this.RoomCategory = RoomCategory;
        this.RoomLog = RoomLog;
        this.DefaultEquipment = DefaultEquipment;
        this.eventBus = eventBus;
    }

    // return summary count of rooms in each status and total
    getRoomStatusSummary = async () => {
        try {
            const result = await this.Room.aggregate([
                {
                    $group: {
                    _id: "$room_status",
                    count: { $sum: 1 },
                    },
                },
            ]);
        
            const summary = {
                new: 0,
                available: 0,
                booked: 0,
                occupied: 0,
                cleaning: 0,
                maintenance: 0,
                reserved: 0,
                total: 0,
            };
        
            result.forEach(item => {
                summary[item._id] = item.count;
                summary.total += item.count;
            });
        
            return { summary };
        
        } catch (error) {
            console.log("Error in getRoomStatusSummary:", error);
            throw error;
        }
    };
    
    getTopBookedRoomCategories = async (query = {}) => {
        try {
            const limit = parseInt(query.limit, 10) || 5;
        
            const result = await BookingDetail.aggregate([
            // join sang Room
            {
                $lookup: {
                from: "rooms",
                localField: "room_id",
                foreignField: "_id",
                as: "room",
                },
            },
            { $unwind: "$room" },
        
            // group theo category
            {
                $group: {
                _id: "$room.category_id",
                totalBooked: { $sum: 1 },
                },
            },
        
            // sort giảm dần
            { $sort: { totalBooked: -1 } },
        
            // limit
            { $limit: limit },
        
            // join sang RoomCategory
            {
                $lookup: {
                from: "roomcategories",
                localField: "_id",
                foreignField: "_id",
                as: "category",
                },
            },
            { $unwind: "$category" },
        
            // kết quả trả về cúi cùm
            {
                $project: {
                _id: 0,
                category_id: "$_id",
                name: "$category.category_name",
                price: "$category.price",
                totalBooked: 1,
                },
            },
            ]);
        
            return { result };
        
        } catch (error) {
            console.log(error);
            throw error;
        }
    };
    
    getLatestStatusOfAllRooms = async () => {
        return await this.RoomLog.aggregate([
            {
            $sort: {
                room_id: 1,
                start_time: -1,
            },
            },
        
            // gom theo phòng, lấy bản ghi đầu tiên
            {
            $group: {
                _id: "$room_id",
                latestStatus: { $first: "$$ROOT" },
            },
            },
        
            // trả về document gốc
            {
            $replaceRoot: { newRoot: "$latestStatus" },
            },
        
            // populate phòng
            {
            $lookup: {
                from: "rooms",
                localField: "room_id",
                foreignField: "_id",
                as: "room",
            },
            },
            {
            $unwind: {
                path: "$room",
                preserveNullAndEmptyArrays: true,
            },
            },
        ]);
    };

    async getCalendarRooms(query = {}) {
        try {
            const { date, floor, category_id } = query;
            if (!date) throw new Error("Thiếu ngày xem lịch");

            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const toIdStr = (id) => (id?._id || id)?.toString();

            // rooms
            const roomFilter = {};
            if (floor) roomFilter.floor = Number(floor);
            if (category_id) roomFilter.category_id = category_id;

            const rooms = await this.Room.find(roomFilter)
                .select("room_number category_id floor")
                .populate("category_id", "category_name")
                .lean();

            const roomIds = rooms.map(r => r._id);

            // fetch room logs
            const statusLogs = await this.RoomLog.find({
                room_id: { $in: roomIds },
                start_time: { $lte: endOfDay },
                $or: [
                    { end_time: { $gte: startOfDay } },
                    { end_time: null }
                ],
                status: { $ne: "available" }
            })
                .populate("room_id", "room_number")
                .populate("booking_id")
                .sort({ start_time: 1 })
                .lean();

            // fetch booking data from booking-service
            const reply = await this.eventBus.request(
                BOOKING_EVENTS.GET_CALENDAR_DATA,
                { 
                    roomIds, 
                    startOfDay, 
                    endOfDay 
                }
            );

            if (!reply.success) {
                throw new Error(`Không thể lấy dữ liệu booking: ${reply.message}`);
            }

            const { bookingDetails, bookings } = reply;

            // build lookup maps
            const bookingMap = Object.fromEntries(
                bookings.map(b => [b._id.toString(), b])
            );

            const bookingDetailMap = {};
            bookingDetails.forEach(detail => {
                const roomIdStr = toIdStr(detail.room_id);
                if (!bookingDetailMap[roomIdStr]) bookingDetailMap[roomIdStr] = [];
                bookingDetailMap[roomIdStr].push(detail);
            });

            // match booking to log 
            const findBookingForLog = (log) => {
                if (log.booking_id) {
                    return bookingMap[toIdStr(log.booking_id)] || null;
                }

                // cleaning/maintenance — find most recent completed booking for this room
                const details = bookingDetailMap[toIdStr(log.room_id)] || [];
                let closestBooking = null;
                let smallestGap = Infinity;

                for (const detail of details) {
                    const booking = bookingMap[toIdStr(detail.booking_id)];
                    if (!booking) continue;
                    if (["cancelled", "expired"].includes(booking.status)) continue;

                    const checkout = new Date(detail.actual_checkout || detail.expected_checkout);
                    if (!checkout) continue;

                    if (checkout <= log.start_time) {
                        const gap = log.start_time.getTime() - checkout.getTime();
                        if (gap < 24 * 60 * 60 * 1000 && gap < smallestGap) {
                            smallestGap = gap;
                            closestBooking = booking;
                        }
                    }
                }

                return closestBooking;
            };

            // build events
            const STATUS_META = {
                reserved:    "Chờ cọc",
                booked:      "Đã cọc",
                occupied:    "Đang ở",
                cleaning:    "Dọn dẹp",
                maintenance: "Bảo trì",
            };

            const events = statusLogs.map(log => {
                const booking = findBookingForLog(log);

                return {
                    _id: log._id,
                    room_id: toIdStr(log.room_id),
                    room_number: log.room_id?.room_number,
                    start: log.start_time,
                    end: log.end_time || booking?.expected_checkout || endOfDay,
                    status: log.status,
                    title: STATUS_META[log.status] || log.status,
                    note: log.note || "",
                    booking: booking ? {
                        booking_id:     booking._id,
                        booking_code:   booking._id.toString().slice(-6).toUpperCase(),
                        booking_status: booking.status,
                        customer_id:    booking.customer_id?._id,
                        customer_name:  booking.customer_id?.full_name || "Khách vãng lai",
                        customer_phone: booking.customer_id?.phone_number || "",
                        customer_cccd:  booking.customer_id?.CCCD || ""
                    } : null
                };
            });

            return { rooms, events };

        } catch (error) {
            console.error("getCalendarRooms error:", error);
            throw error;
        }
    }
}