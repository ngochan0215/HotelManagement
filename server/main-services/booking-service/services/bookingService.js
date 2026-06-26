import mongoose from "mongoose";
import { CUSTOMER_EVENTS } from "../../../shared/events/customerEvents.js";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";
import { ROOM_EVENTS } from "../../../shared/events/roomEvents.js";
import { SERVICE_EVENTS } from "../../../shared/events/serviceEvents.js";
import { PAYMENT_EVENTS } from "../../../shared/events/paymentEvents.js";
import { INCIDENT_EVENTS } from "../../../shared/events/incidentEvents.js";
import { DISCOUNT_EVENTS } from "../../../shared/events/discountEvents.js";
import { CLEANING_EVENTS } from "../../../shared/events/cleaningEvents.js";
import { CANCELLATION_REASON_LABELS } from "../constants/cancellationReason.js";
import { cache, makeCacheKey } from "../../../shared/utils/cache.js";

export class BookingService {
    constructor({ Booking, BookingDetail, BookingStatusLog, BookingCancellation,
        eventBus, sendNotification, sendNotificationsToUsers }) {
        this.Booking = Booking;
        this.BookingDetail = BookingDetail;
        this.BookingStatusLog = BookingStatusLog;
        this.BookingCancellation = BookingCancellation;
        this.eventBus = eventBus;
        this.sendNotification = sendNotification;
        this.sendNotificationsToUsers = sendNotificationsToUsers;
    }
    
    // 1 đêm = 14:00 ngày N đến 12:00 ngày N+1 (chu kỳ chuẩn khách sạn)
    // Số đêm = số ngày lịch giữa ngày check-in và ngày check-out (bỏ giờ)
    calcNights = (expected_checkin, expected_checkout) => {
        const d1 = new Date(expected_checkin);
        const d2 = new Date(expected_checkout);
        const day1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
        const day2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
        const nights = Math.round((day2 - day1) / (1000 * 60 * 60 * 24));

        if (nights <= 0) {
            throw new Error("Thời gian checkout phải lớn hơn checkin");
        }

        return nights;
    };

    calculateBookingStatus = (details) => {
        if (details.every(d => d.status === "cancelled")) {
            return "cancelled";
        }

        if (details.every(d =>
            ["checked_out", "cancelled"].includes(d.status)
        )) {
            return "completed";
        }

        if (details.some(d => d.status === "checked_in")) {
            return "in_progress";
        }

        return "confirmed";
    };

    confirmBookingInternal = async (booking_id, employee_id = null) => {
        try {
            const booking = await this.Booking.findById(booking_id);
            if (!booking) {
                throw new Error("Không tìm thấy dữ liệu đặt phòng.");
            }

            if (booking.status !== "pending") {
                throw new Error("Trạng thái đặt phòng không hợp lệ.");
            }

            const bookingDetails = await this.BookingDetail.find({ booking_id });
            if (bookingDetails.length === 0) {
                throw new Error("Booking không có phòng nào.");
            }

            for (const bd of bookingDetails) {
                const replyLogs = await this.eventBus.safeRequest(
                    ROOM_EVENTS.FIND_ROOM_LOGS,
                    {
                        filter: {
                            room_id: bd.room_id,
                            status: { $in: ["booked", "occupied"] },
                            start_time: { $lt: bd.expected_checkout },
                            $or: [
                                { end_time: null },
                                { end_time: { $gt: bd.expected_checkin } }
                            ]
                        },
                        opts: { limit: 1 }
                    }
                );

                if(replyLogs.roomLogs?.length > 0) {
                    const replyRoom = await this.eventBus.safeRequest(
                        ROOM_EVENTS.CHECK_EXISTS,
                        { room_id: bd.room_id }
                    );
                    if (!replyRoom.found) 
                        throw new Error("Không tìm thấy phòng.");
                    
                    throw new Error( `Phòng ${replyRoom.room.room_number} đã được giữ hoặc đang có khách 
                        trong khoảng ${bd.expected_checkin.toISOString()} - ${bd.expected_checkout.toISOString()}`);
                }
            }

            const roomIds = bookingDetails.map(bd => bd.room_id);

            const replyUpdateRoom = await this.eventBus.safeRequest(
                ROOM_EVENTS.UPDATE_ROOM_INFO,
                { 
                    filter: {
                        _id: { $in: roomIds },
                    },
                    updateData: { 
                        start_time: booking.expected_checkin,
                        end_time: booking.expected_checkout, 
                    }
                }
            );
            if (!replyUpdateRoom.success) throw new Error(replyUpdateRoom.message);

            const replyUpdateLog = await this.eventBus.safeRequest(
                ROOM_EVENTS.UPDATE_ROOM_LOG,
                { 
                    filter: {
                        room_id: { $in: roomIds },
                        status: "reserved",
                        end_time: booking.expected_checkout
                    },
                    updateData: { end_time: new Date() }
                }
            );
            if (!replyUpdateLog.success) throw new Error(replyUpdateLog.message);

            const roomLogs = bookingDetails.map(bd => ({
                booking_id: bd.booking_id,
                room_id: bd.room_id,
                status: "booked",
                start_time: bd.expected_checkin,
                end_time: bd.expected_checkout,
                expected_end_time: bd.expected_checkout,
                note: `Phòng được giữ vì booking ${bd.booking_id} đã được cọc.`,
                handled_by: booking.handled_by,
            }));
            const replyInsertLog = await this.eventBus.safeRequest(
                ROOM_EVENTS.INSERT_ROOM_LOG,
                { data: roomLogs }
            );
            if (!replyInsertLog.success) throw new Error(replyInsertLog.message);
            

            booking.status = "confirmed";
            await booking.save();

            await this.BookingStatusLog.findOneAndUpdate(
                { booking_id, end_time: null },
                { end_time: new Date() }
            );

            await this.BookingStatusLog.create({
                booking_id,
                status: "confirmed",
                start_time: booking.expected_checkin,
                end_time: booking.expected_checkout,
                expected_end_time: booking.expected_checkout,
                handled_by: employee_id || booking.handled_by,
                note: "Khách đã đặt cọc giữ chỗ đặt phòng.",
            });

            await this.BookingDetail.updateMany(
                {
                    room_id: { $in: roomIds },
                    booking_id: booking_id,
                    status: "reserved"
                },
                { $set: { status: "confirmed" } },
            );

            console.log(`FUCK YOU: Booking ${booking_id} đã được xác nhận thành công.`);
            await Promise.all([
                cache.del(`booking:one:${booking_id}`),
                cache.delByPattern("booking:list:*"),
            ]);

            // fire-and-forget notifications (do not block response)
            Promise.all([
                this.findManagersByIds(),
                this.findEmployeeById(booking.handled_by),
                this.findCustomerById(booking.customer_id),
            ]).then(([{ managerUserIds }, employee, customer]) => {
                const notifPromises = [];
                if (managerUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Booking đã xác nhận thanh toán tiền cọc",
                        content: `Booking có ID: #${booking._id.toString().slice(-6)} từ khách hàng ${customer.full_name || 'N/A'} đã xác nhận đặt cọc thành công.`,
                        type: "booking", kind: "Booking", refId: booking._id
                    }));
                }
                if (customer?.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: customer.user_id,
                        title: "Booking đặt cọc thành công",
                        content: `Bạn đã đặt cọc booking có ID: #${booking._id.toString().slice(-6)} thành công! Hãy để ý ngày giờ checkin nhé.`,
                        type: "booking", kind: "Booking", refId: booking._id
                    }));
                }
                if (employee?.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: employee.user_id,
                        title: "Booking đặt cọc thành công",
                        content: `Booking có ID: #${booking._id.toString().slice(-6)} từ khách hàng ${customer.full_name || 'N/A'} đã xác nhận đặt cọc thành công.`,
                        type: "booking", kind: "Booking", refId: booking._id
                    }));
                }
                return Promise.all(notifPromises);
            }).catch(err => console.error("[confirmBooking] Notification error (non-fatal):", err.message));

            return booking;

        } catch (error) {
            console.log("Error in confirming booking internal: ", error.message);
            throw error;
        }
    };

    populateCustomerAndEmployee= async (bookings) => {
        const isArray = Array.isArray(bookings);
        const list = isArray ? bookings : [bookings];

        const customerIds = [...new Set(list.map(i => i.customer_id?.toString()).filter(Boolean))];
        const employeeIds = [...new Set(list.map(i => i.handled_by?.toString()).filter(Boolean))];


        if (customerIds.length === 0 && employeeIds.length === 0)
            return isArray ? list : list[0];

        const [employeeMap, customerMap] = await Promise.all([
            // Employee
            (async () => {
                const map = {};
                if (employeeIds.length === 0) return map;
                const reply = await this.eventBus.safeRequest(
                    EMPLOYEE_EVENTS.GET_INFO,
                    { employee_ids: employeeIds }
                );
                for (const emp of (reply.employees || [])) {
                    const key = emp._id?.toString();
                    map[key] = {
                        full_name: emp.full_name,
                        position: emp.position,
                        phone_number: emp.phone_number
                    };
                }
                return map;
            })(),

            // Customer
            (async () => {
                const map = {};
                if (customerIds.length === 0) return map;
                const reply = await this.eventBus.safeRequest(
                    CUSTOMER_EVENTS.GET_INFOS_IDS,
                    { customerIds: customerIds }
                );
                for (const cus of (reply.customers || [])) {
                    const key = cus._id?.toString();
                    map[key] = {
                        full_name: cus.full_name,
                        CCCD: cus.CCCD,
                        phone_number: cus.phone_number
                    };
                }
                return map;
            })(),
        ]);

        const results = list.map(booking => ({
            ...booking,
            customer_info: customerMap[booking.customer_id?.toString()] ?? null,
            handler_employee_info: employeeMap[booking.handled_by?.toString()] ?? null,
        }));

        return isArray ? results : results[0];
    };

    populateRoom = async (bookingDetails) => {
        const isArray = Array.isArray(bookingDetails);
        const list = isArray ? bookingDetails : [bookingDetails];

        const roomIds = [...new Set(
            list
                .map(e => e.room_id?.toString())
                .filter(Boolean)
        )];

        let roomMap = {};

        if (roomIds.length > 0) {
            const reply = await this.eventBus.safeRequest(
                ROOM_EVENTS.GET_ROOMS_INFO,
                { room_ids: roomIds }
            );

            for (const room of (reply.rooms || [])) {
                roomMap[room._id.toString()] = {
                    _id: room._id,
                    room_number: room.room_number,
                    room_status: room.room_status,
                    category: room.category_id ? {
                        id: room.category_id._id,
                        name: room.category_id.category_name,
                        price: room.category_id.price,
                        capacity: room.category_id.capacity,
                        description: room.category_id.description,
                    } : null,
                };
            }
        }

        const results = list.map(details => ({
            ...details,
            room_info: roomMap[details.room_id?.toString()] || null
        }));

        return isArray ? results : results[0];
    };

    findCustomerById = async (customerId) => {
        const replyCustomer = await this.eventBus.safeRequest(
            CUSTOMER_EVENTS.CHECK_EXISTS,
            { customerId }
        );

        if (!replyCustomer.success)
            throw new Error(replyCustomer.message);

        const customer = replyCustomer.customer;
        return customer;
    }

    findEmployeeByUserId = async (employeeUserId) => {
        const replyEmployee = await this.eventBus.safeRequest(
            EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
            { employee_user_id: employeeUserId }
        );

        if (!replyEmployee.found) throw new Error("Không tìm thấy nhân viên thực hiện.");

        const employee = replyEmployee.employee;
        return employee;
    }

    findEmployeeById = async (employeeId) => {
        const replyEmployee = await this.eventBus.safeRequest(
            EMPLOYEE_EVENTS.CHECK_EXISTS,
            { employee_id: employeeId }
        );

        if (!replyEmployee.found) throw new Error("Không tìm thấy nhân viên thực hiện.");

        const employee = replyEmployee.employee;
        return employee;
    }

    findManagersByIds = async () => {
        const replyManager = await this.eventBus.safeRequest(
            USER_EVENTS.GET_MANAGERS
        );

        let managerUsers, managerUserIds;
        if (replyManager.success) {
            managerUsers = replyManager.managers;
            managerUserIds = managerUsers.map(u => u._id);
        }

        return { managerUsers, managerUserIds };
    }

    // main business logic
    createBooking = async (employeeUserId, data) => {
        try {
            const { customer_id, adults, children, deposit, 
            total_fee, rooms, expected_checkin, expected_checkout, discount_id } = data;

            // validation
            if (!customer_id || adults === undefined || children === undefined || deposit === undefined || total_fee === undefined ) {
                throw new Error("Phải điền đầy đủ các thông tin bắt buộc!");
            }
            if (!mongoose.Types.ObjectId.isValid(customer_id)){
                throw new Error("ID Khách hàng không hợp lệ!");
            }

            const [customer, employee] = await Promise.all([
                this.findCustomerById(customer_id),
                this.findEmployeeByUserId(employeeUserId),
            ]);

            if (!Array.isArray(rooms) || rooms.length === 0) {
                throw new Error("Phải đặt ít nhất một phòng!");
            }

            if ( !expected_checkin || !expected_checkout) {
                throw new Error("Phải điền đầy đủ thông tin check-in, check-out dự kiến.");
            }

            if ( new Date(expected_checkout) < new Date(expected_checkin) ) {
                throw new Error("Ngày check-out dự kiến phải sau ngày check-in dự kiến.");
            }

            if ( new Date(expected_checkout) < new Date() ) {
                throw new Error("Ngày check-out dự kiến không được trong quá khứ.");
            }

            if ( new Date(expected_checkin) < new Date() ) {
                throw new Error("Ngày check-in dự kiến không được trong quá khứ.");
            }

            for (const room of rooms) {
                if ( !room.room_id || !mongoose.Types.ObjectId.isValid(room.room_id)) {
                    throw new Error("ID Phòng không hợp lệ.");
                } 

                const replyRoom = await this.eventBus.safeRequest(
                    ROOM_EVENTS.CHECK_EXISTS,
                    { room_id: room.room_id }
                );
                if (!replyRoom.found)
                    throw new Error(`Không tìm thấy phòng ${replyRoom.room.room_number}.`);

                if(replyRoom.room.room_status !== "available") {
                    throw new Error(`Phòng ${replyRoom.room.room_number} đang không trống.`);
                }
            }

            const baseRoomFee = rooms.reduce((sum, r) => {
                const nights = this.calcNights(expected_checkin, expected_checkout);
                return sum + (r.base_fee * nights);
            }, 0);

            let discount = null;
            let discountSnapshot = null;
            let discountAmount = 0;
            if (discount_id) {
                if (!mongoose.Types.ObjectId.isValid(discount_id)) {
                    throw new Error("ID Khuyến mãi không hợp lệ");
                }

                const replyDiscount = await this.eventBus.safeRequest(
                    DISCOUNT_EVENTS.CHECK_EXISTS,
                    { discountId: discount_id }
                );
                if (!replyDiscount.found)
                    throw new Error("Không tìm thấy khuyến mãi.");

                discount = replyDiscount.discount;
                if (!discount.is_active) {
                    throw new Error("Khuyến mãi không còn hiệu lực.");
                }

                const now = new Date();
                if (now < discount.begin_date || now > discount.end_date) {
                    throw new Error("Khuyến mãi không còn trong thời gian hiệu lực.");
                }

                if (discount.discount.type === "PERCENT") {
                    discountAmount = Math.round(baseRoomFee * discount.discount.value / 100);
                    if (discount.discount.max_discount && discountAmount > discount.discount.max_discount) {
                        discountAmount = discount.discount.max_discount;
                    }
                } else {
                    discountAmount = discount.discount.value;
                }

                discountSnapshot = {
                    code: discount.code,
                    name: discount.name,
                    description: discount.description || "",
                    discount_amount: discountAmount
                };
            }

            const handled_by = employee._id;
            const isScheduled = new Date(expected_checkin) > new Date();
            const isImmediate = deposit === 0;
            let initialStatus = isImmediate ? "in_progress" : "pending";

            const booking = await this.Booking.create({
                customer_id,
                handled_by: employee._id,
                adults,
                children,
                deposit,
                total_fee,
                expected_checkin,
                expected_checkout,
                status: initialStatus,
                isScheduled
            });

            // create the booking details then insert
            const detailStatus = isImmediate ? "checked_in" : "reserved";
            const bookingDetails = rooms.map(room => ({
                booking_id: booking._id,
                room_id: room.room_id,
                expected_checkin: expected_checkin,
                expected_checkout: expected_checkout,
                base_fee: room.base_fee,
                status: detailStatus,
            }));
            await this.BookingDetail.insertMany(bookingDetails);

            // log booking status
            const statusNote = isImmediate 
                ? (initialStatus === "in_progress" 
                    ? "Đơn đặt phòng được tạo thành công, đã check-in tự động (đặt liền)" 
                    : "Đơn đặt phòng được tạo thành công, đã xác nhận (đặt liền, chờ check-in)")
                : "Đơn đặt phòng được tạo thành công, đang chờ đặt cọc";
            
            await this.BookingStatusLog.create({
                booking_id: booking._id,
                status: initialStatus,
                start_time: expected_checkin,
                expected_end_time: expected_checkout,
                handled_by: handled_by,
                note: statusNote,
            });

            const roomIds = bookingDetails.map(bd => bd.room_id);
            const shortenId = booking._id.toString().slice(-6);

            const replyUpdateRoom = await this.eventBus.safeRequest(
                ROOM_EVENTS.UPDATE_ROOM_INFO,
                {
                    filter: { _id: { $in: roomIds } },
                    updateData: {
                        start_time: isImmediate && initialStatus === "in_progress" ? new Date() : expected_checkin,
                        end_time: expected_checkout,
                    }
                }
            );
            if (!replyUpdateRoom.success) throw new Error(replyUpdateRoom.message);

            const roomLogs = bookingDetails.map(bd => ({
                booking_id: bd.booking_id,
                room_id: bd.room_id,
                status: isImmediate && initialStatus === "in_progress" ? "occupied" : "reserved",
                start_time: isImmediate && initialStatus === "in_progress" ? new Date() : bd.expected_checkin,
                expected_end_time: bd.expected_checkout,
                end_time: bd.expected_checkout,
                note: isImmediate ? 
                    `Phòng được xác nhận (đặt liền) bởi booking #${shortenId}`
                    : `Phòng được giữ chỗ bởi: ${shortenId} trong vòng 1 tiếng kể từ khi đặt`,
                handled_by: booking.handled_by || null,
            }));
            const replyInsertLog = await this.eventBus.safeRequest(
                ROOM_EVENTS.INSERT_ROOM_LOG, 
                {
                    data: roomLogs
                }
            );
            if (!replyInsertLog.success) throw new Error(replyInsertLog.message);

            //-- receipt region --//
            const totalFee = booking.total_fee;
            const depositAmount = booking.deposit || 0;
            const finalAmount = totalFee;
            const amountDue = Math.max(finalAmount - depositAmount, 0);

            const paymentMethod = depositAmount === 0 ? "unknown" : "bank";

            const replyReceipt = await this.eventBus.safeRequest(
                PAYMENT_EVENTS.CREATE_RECEIPT,
                {
                    booking_id: booking._id,
                    employee_id: employee._id,
                    discount_id: discount_id || null,
                    discount_snapshot: discountSnapshot,
                    base_room_fee: baseRoomFee,
                    total_fee: totalFee,
                    deposit_amount: depositAmount,
                    final_amount: finalAmount,
                    amount_due: amountDue,
                    payment: paymentMethod,
                    status: "pending",
                    note: isImmediate ? "Hóa đơn tạo tự động khi đặt liền (không cần cọc)" : "Hóa đơn tạo tự động, chờ thanh toán cọc",
                }
            );
            if (!replyReceipt.success) throw new Error(replyReceipt.message);

            console.log("Booking created successfully.");
            await cache.delByPattern("booking:list:*");

            // fire-and-forget notifications
            Promise.all([
                this.findManagersByIds(),
                this.eventBus.safeRequest(EMPLOYEE_EVENTS.GET_RECEPTIONISTS, {}),
            ]).then(([{ managerUserIds }, replyReceptionists]) => {
                const receptionistsUserIds = replyReceptionists.found
                    ? replyReceptionists.receptionists.employees.map(e => e.user_id)
                    : [];
                const notifPromises = [];
                if (managerUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Đơn đặt phòng mới",
                        content: `Có booking mới với ID: #${shortenId} từ khách hàng ${customer.full_name || 'N/A'}`,
                        type: "booking", kind: "Booking", refId: booking._id
                    }));
                }
                if (customer?.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: customer.user_id,
                        title: "Booking mới",
                        content: `Bạn đã đặt booking mới có ID: #${shortenId} thành công! Vui lòng thanh toán tiền cọc nếu đặt trước nhe.`,
                        type: "booking", kind: "Booking", refId: booking._id
                    }));
                }
                if (receptionistsUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: receptionistsUserIds,
                        title: "Booking mới",
                        content: `Có booking mới với ID: #${shortenId} từ khách hàng ${customer.full_name || "N/A"}`,
                        type: "booking", kind: "Booking", refId: booking._id
                    }));
                }
                return Promise.all(notifPromises);
            }).catch(err => console.error("[createBooking] Notification error (non-fatal):", err.message));

            return booking;

        } catch (error) {
            console.log("Error in creating booking: ", error.message);
            throw error;
        }
    };

    confirmBooking = async (bookingId, employeeId) => {
        try {
            const booking = await this.confirmBookingInternal(bookingId, employeeId);
            return booking;
        } catch (error) {
            console.log("Error in confirming booking: ", error.log);
            throw error;
        }
    };

    getAllBookings = async (query = {}) => {
        try {
            const cacheKey = makeCacheKey("booking:list", query);
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const { isScheduled, status } = query;
            const filter = {};

            if (isScheduled) filter.isScheduled = isScheduled;
            if (status) filter.status = status;

            const bookings = await this.Booking.find(filter)
                .sort({ created_at: -1 })
                .select("-__v")
                .lean();

            if (bookings.length === 0) {
                const emptyResponse = { total: 0, bookings: [] };
                await cache.set(cacheKey, emptyResponse, 60);
                return emptyResponse;
            }

            const bookingIds = bookings.map(b => b._id);

            const [populatedBookings, bookingDetails] = await Promise.all([
                this.populateCustomerAndEmployee(bookings),
                this.BookingDetail.find({ booking_id: { $in: bookingIds } })
                    .select("-created_at -updated_at -__v")
                    .lean(),
            ]);

            const populatedDetails = await this.populateRoom(bookingDetails);

            const bookingDetailMap = {};
            populatedDetails.forEach(detail => {
                const key = detail.booking_id.toString();

                if (!bookingDetailMap[key]) 
                    bookingDetailMap[key] = [];

                bookingDetailMap[key].push(detail);
            });

            const result = populatedBookings.map(booking => ({
                ...booking,
                rooms: bookingDetailMap[booking._id.toString()] || []
            }));

            const response = { total: populatedBookings.length, bookings: result };
            await cache.set(cacheKey, response, 60);
            return response;

        } catch (error) {
            console.log("Error in getting all bookings: ", error.message);
            throw error;
        }
    };

    getBookingDetail = async (bookingId) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(bookingId)) {
                throw new Error("Booking ID không hợp lệ.");
            }

            const cacheKey = `booking:one:${bookingId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const [booking, bookingDetails] = await Promise.all([
                this.Booking.findById(bookingId).lean(),
                this.BookingDetail.find({ booking_id: bookingId }).lean()
            ]);

            if (!booking) {
                throw new Error("Không tìm thấy booking.");
            }

            const [populatedBooking, populatedDetails] = await Promise.all([
                this.populateCustomerAndEmployee(booking),
                this.populateRoom(bookingDetails)
            ]);

            const rooms = populatedDetails.map((item) => ({
                room_id: item.room_info?._id,
                room_number: item.room_info?.room_number,
                room_status: item.room_info?.room_status,
                category: item.room_info?.category ?? null,
                expected_checkin: item.expected_checkin,
                expected_checkout: item.expected_checkout,
                base_fee: item.base_fee,
                status: item.status,
            }));

            const detailResponse = { booking: populatedBooking, rooms };
            await cache.set(cacheKey, detailResponse, 60);
            return detailResponse;

        } catch (error) {
            console.log("Error in getting booking detail: ", error.log);
            throw error;
        }
    };

    updateBookingStatus = async (userId, bookingId, query = {}) => {
        try {
            const { status } = query;
            const allowedStatuses = ["pending", "confirmed", "checked_in", "checked_out", "cancelled", "expired"];

            if (!allowedStatuses.includes(status)) {
                throw new Error("Trạng thái đặt phòng không hợp lệ.");
            }

            const booking = await this.Booking.findById(bookingId);
            if (!booking) {
                throw new Error("Không tìm thấy dữ liệu đặt phòng.");
            }

            const currentStatus = booking.status;
            const transitionRules = {
                pending: ["confirmed", "cancelled", "expired"],
                confirmed: ["checked_in", "cancelled"],
                checked_in: ["checked_out"],
                checked_out: [],
                cancelled: [],
                expired: [],
            };

            if (!transitionRules[currentStatus].includes(status)) {
                throw new Error(`Không thể chuyển từ '${currentStatus}' sang '${status}'.`);
            }

            const bookingDetails = await this.BookingDetail.find({ bookingId });
            const now = new Date();
            const roomIds = bookingDetails.map(bd => bd.room_id);
            const shortenId = booking._id.toString().slice(-6);

            const hasConflict = async (roomId, start, end, statuses) => {
                const replyFindLogs = await this.eventBus.safeRequest(
                    ROOM_EVENTS.FIND_ROOM_LOGS,
                    {
                        filter: {
                            room_id: roomId,
                            status: { $in: statuses },
                            start_time: { $lt: end },
                            end_time: { $gt: start },
                        },
                        opts: { limit: 1 }
                    }
                );
                return replyFindLogs.roomLogs;
            };

            await this.BookingStatusLog.findOneAndUpdate(
                {
                    bookingId,
                    end_time: null,
                },
                {
                    $set: { end_time: now },
                },
            );

            switch (status) {
                case "cancelled":
                
                case "expired":
                    for (const bd of bookingDetails) {
                        const replyUpdateLog = await this.eventBus.safeRequest(
                            ROOM_EVENTS.UPDATE_ROOM_LOG, 
                            {
                                filter: {
                                    room_id: bd.room_id._id,
                                    start_time: { $lte: now },
                                    $or: [
                                        { end_time: { $gte: now } },
                                        { end_time: null }
                                    ]
                                },
                                updateData: { end_time: now }
                            }
                        );
                        if (!replyUpdateLog.success) throw new Error(replyUpdateLog.message);
                    }

                    const availableRoomLogs = bookingDetails.map(bd => ({
                        room_id: bd.room_id._id,
                        status: "available",
                        start_time: now,
                        end_time: null,
                        note: `Booking có ID: #${shortenId} chuyển sang trạng thái ${status}, phòng được giải phóng`,
                        handled_by: userId || null,
                    }));
                    const replyInsertLog = await this.eventBus.safeRequest(
                        ROOM_EVENTS.INSERT_ROOM_LOG, {
                        data: availableRoomLogs
                    });
                    if (!replyInsertLog.success) throw new Error(replyInsertLog.message);

                    break;
                
                case "confirmed": {
                    for (const bd of bookingDetails) {
                        const conflict = await hasConflict(
                            bd.room_id._id,
                            bd.expected_checkin,
                            bd.expected_checkout,
                            ["booked", "occupied", "maintenance"]
                        );

                        if (conflict) {
                            throw new Error(`Phòng ${bd.room_id.room_number} đã có lịch`);
                        }

                        const roomLog = {
                            booking_id: booking._id,
                            room_id: bd.room_id._id,
                            status: "booked",
                            start_time: bd.expected_checkin,
                            end_time: bd.expected_checkout,
                            expected_end_time: bd.expected_checkout,
                            note: `Booking với ID: #${shortenId} đã được xác nhận đặt cọc.`,
                            handled_by: booking.handled_by || userId || null,
                        };
                        const replyInsertLog = await this.eventBus.safeRequest(
                            ROOM_EVENTS.INSERT_ROOM_LOG, {
                            data: roomLog
                        });
                        if (!replyInsertLog.success) throw new Error(replyInsertLog.message);
                    }
                    break;
                }
                
                case "checked_in": {
                    for (const bd of bookingDetails) {
                        const conflict = await hasConflict(
                            bd.room_id._id,
                            now,
                            bd.expected_checkout,
                            ["occupied"]
                        );
                        if (conflict) {
                            throw new Error(`Phòng ${bd.room_id.room_number} đang được sử dụng`);
                        }

                        const replyUpdateLog = await this.eventBus.safeRequest(
                            ROOM_EVENTS.UPDATE_ROOM_LOG, 
                            {
                                filter: {
                                    room_id: bd.room_id._id,
                                    start_time: { $lte: now },
                                    $or: [
                                        { end_time: { $gte: now } },
                                        { end_time: null }
                                    ],
                                    status: { $in: ["booked", "reserved"] }
                                },
                                updateData: { end_time: now }
                            }
                        );
                        if (!replyUpdateLog.success) throw new Error(replyUpdateLog.message);

                        const roomLog = {
                            booking_id: booking._id,
                            room_id: bd.room_id._id,
                            status: "occupied",
                            start_time: now,
                            end_time: bd.expected_checkout,
                            expected_end_time: bd.expected_checkout,
                            note: `Booking với ID: #${shortenId} đã xác nhận check-in.`,
                            handled_by: booking.handled_by || userId || null,
                        };
                        const replyInsertLog = await this.eventBus.safeRequest(
                            ROOM_EVENTS.INSERT_ROOM_LOG, {
                            data: roomLog
                        });
                        if (!replyInsertLog.success) throw new Error(replyInsertLog.message);
                    }

                    break;
                }

                case "checked_out": {
                    for (const bd of bookingDetails) {
                        const replyUpdateLog = await this.eventBus.safeRequest(
                            ROOM_EVENTS.UPDATE_ROOM_LOG, 
                            {
                                filter: {
                                    room_id: bd.room_id._id,
                                    status: "occupied",
                                    start_time: { $lte: now },
                                    $or: [
                                        { end_time: { $gte: now } },
                                        { end_time: null }
                                    ]
                                },
                                updateData: { end_time: now }
                            }
                        );
                        if (!replyUpdateLog.success) throw new Error(replyUpdateLog.message);

                        const cleaningEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);
                        const roomLog = {
                            booking_id: booking._id,
                            room_id: bd.room_id._id,
                            status: "cleaning",
                            start_time: now,
                            end_time: cleaningEnd,
                            expected_end_time: cleaningEnd,
                            note: `Cleaning after checkout booking ID: #${shortenId}`,
                            handled_by: null,
                        };
                        const replyInsertLog = await this.eventBus.safeRequest(
                            ROOM_EVENTS.INSERT_ROOM_LOG, {
                            data: roomLog
                        });
                        if (!replyInsertLog.success) throw new Error(replyInsertLog.message);
                    }
                    break;
                }
            }

            const lastLog = await this.BookingStatusLog.findOne({ bookingId, end_time: null });
            if (lastLog?.status === status) {
                throw new Error("Booking đã ở trạng thái này");
            }

            await this.BookingStatusLog.create({
                booking_id: bookingId,
                status,
                start_time: now,
                end_time: null,
                note: `Booking chuyển sang trạng thái ${status}`,
                handled_by: userId || null,
            });

            booking.status = status;
            await booking.save();

            await Promise.all([
                cache.del(`booking:one:${bookingId}`),
                cache.delByPattern("booking:list:*"),
            ]);

            // fire-and-forget notifications
            const statusLabels = {
                pending: "Đang chờ", confirmed: "Đã xác nhận", checked_in: "Đã check-in",
                checked_out: "Đã check-out", cancelled: "Đã hủy", expired: "Đã hết hạn"
            };
            const statusLabel = statusLabels[status] || status;
            Promise.all([
                this.findManagersByIds(),
                this.findEmployeeById(booking.handled_by),
                this.findCustomerById(booking.customer_id),
            ]).then(([{ managerUserIds }, employee, customer]) => {
                const notifPromises = [];
                if (managerUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Booking đã thay đổi trạng thái",
                        content: `Booking #${shortenId} đã chuyển sang trạng thái "${statusLabel}"`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                if (customer?.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: customer.user_id,
                        title: "Booking đã thay đổi trạng thái",
                        content: `Booking #${shortenId} đã chuyển sang trạng thái "${statusLabel}"`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                if (employee?.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: employee.user_id,
                        title: "Booking đã thay đổi trạng thái",
                        content: `Booking #${shortenId} đã chuyển sang trạng thái "${statusLabel}"`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                return Promise.all(notifPromises);
            }).catch(err => console.error("[updateBookingStatus] Notification error (non-fatal):", err.message));

            return { success: true };

        } catch (error) {
            console.log("Error while updating booking status: ", error.message);
            throw error;
        }
    };
    
    addRoomsToBooking = async (bookingId, data) => {
        try {
            const { rooms, expected_checkin, expected_checkout } = data;

            const booking = await this.Booking.findById(bookingId);
            if (!booking)
                throw new Error("Không tìm thấy dữ liệu đặt phòng.");

            if (!["pending", "confirmed"].includes(booking.status))
                throw new Error("Không thể đặt thêm phòng.");

            if (new Date() >= new Date(booking.expected_checkin))
                throw new Error("Không thể thêm phòng sau ngày check-in.");

            if (!Array.isArray(rooms) || rooms.length === 0)
                throw new Error("Danh sách phòng không hợp lệ.");

            const bookingDetails = [];

            for (const room of rooms) {
                const replyRoom = await this.eventBus.safeRequest(
                    ROOM_EVENTS.CHECK_EXISTS,
                    { room_id: room.room_id }
                );
                if (!replyRoom.found) {
                    throw new Error(`Không tìm thấy phòng ${room.room_number}`);
                }

                bookingDetails.push({
                    booking_id: booking._id,
                    room_id: room.room_id,
                    expected_checkin: room.expected_checkin,
                    expected_checkout: room.expected_checkout,
                    base_fee: room.base_fee,
                    status: "reserved",
                });
            }
            await this.BookingDetail.insertMany(bookingDetails);

            booking.expected_checkin = new Date(
                Math.min(booking.expected_checkin, ...rooms.map(r => new Date(r.expected_checkin)))
            );
            booking.expected_checkout = new Date(
                Math.max(booking.expected_checkout, ...rooms.map(r => new Date(r.expected_checkout)))
            );

            await booking.save();
            await Promise.all([
                cache.del(`booking:one:${bookingId}`),
                cache.delByPattern("booking:list:*"),
            ]);
            return { success: true };

        } catch (err) {
            console.log("Error in updating booking (add rooms): ", err.message);
            throw err;
        }
    };

    // checkin one room (one booking detail) of booking
    checkinBookingDetail = async (userId, bookingId, detailId) => {
        try {
            const now = new Date();

            const booking = await this.Booking.findById(bookingId).lean();
            if (!booking) {
                throw new Error("Không tìm thấy booking.");
            }

            const detail = await this.BookingDetail.findOne({
                _id: detailId,
                booking_id: bookingId,
            });

            if (!detail) {
                throw new Error("Không tìm thấy phòng trong booking.");
            }

            if (!["reserved", "confirmed"].includes(detail.status)) {
                throw new Error(`Phòng đang ở trạng thái '${detail.status}', không thể check-in.`);
            }

            const replyRoom = await this.eventBus.safeRequest(
                ROOM_EVENTS.CHECK_EXISTS,
                { room_id: detail.room_id }
            );
            if (!replyRoom.found) {
                throw new Error(`Không tìm thấy phòng ${detail.room_id}`);
            }
            const room = replyRoom.room;

            // find conflict room logs, close old logs and insert new one
            const conflictLog = await this.eventBus.safeRequest(
                ROOM_EVENTS.FIND_ROOM_LOGS,
                {
                    filter: {
                        room_id: detail.room_id,
                        start_time: { $lt: detail.expected_checkout },
                        end_time: { $gt: now },
                        status: { $in: ["occupied", "maintenance", "cleaning"] },
                        $or: [
                            { end_time: null },
                            { end_time: { $gt: detail.expected_checkin } }
                        ]
                    },
                    opts: { limit: 1 }
                }
            );
            if (conflictLog) {
                throw new Error("Phòng đang không trong trạng thái có thể checkin trong khoảng thời gian này.");
            }

            const replyUpdateLog = await this.eventBus.safeRequest(
                ROOM_EVENTS.UPDATE_ROOM_LOG, 
                {
                    filter: {
                        room_id: detail.room_id,
                        status: "booked",
                        end_time: detail.expected_checkout,
                    },
                    updateData: { end_time: now }
                }
            );
            if (!replyUpdateLog.success) throw new Error(replyUpdateLog.message);

            const roomLogs = {
                booking_id: booking._id,
                room_id: detail.room_id,
                status: "occupied",
                start_time: now,
                end_time: detail.expected_checkout,
                expected_end_time: detail.expected_checkout,
                note: `Phòng đã được checkin theo booking ${booking._id}`,
                handled_by: booking.handled_by || null,
            };
            const replyInsertLog = await this.eventBus.safeRequest(
                ROOM_EVENTS.INSERT_ROOM_LOG, {
                data: roomLogs
            });
            if (!replyInsertLog.success) throw new Error(replyInsertLog.message);

            detail.status = "checked_in";
            detail.actual_checkin = now;
            await detail.save();

            const replyUpdateRoom = await this.eventBus.safeRequest(
                ROOM_EVENTS.UPDATE_ROOM_INFO, 
                {
                    filter: { _id: detail.room_id },
                    updateData: { 
                        room_status: "occupied",
                        start_time: now,
                        end_time: detail.expected_checkout, 
                    }
                }
            );
            if (!replyUpdateRoom.success) throw new Error(replyUpdateRoom.message);

            const allDetails = await this.BookingDetail.find({ booking_id: bookingId });
            const shortenId = booking._id.toString().slice(-6);
            
            booking.status = this.calculateBookingStatus(allDetails);
            await booking.save();

            await this.BookingStatusLog.create({
                booking_id: bookingId,
                status: booking.status,
                start_time: new Date(),
                end_time: null,
                note: `Booking với ID: #${shortenId} chuyển sang trạng thái ${booking.status}`,
                handled_by: userId || null,
            });

            await Promise.all([
                cache.del(`booking:one:${bookingId}`),
                cache.delByPattern("booking:list:*"),
            ]);

            // fire-and-forget notifications
            Promise.all([
                this.findManagersByIds(),
                this.findEmployeeById(booking.handled_by),
                this.findCustomerById(booking.customer_id),
            ]).then(([{ managerUserIds }, employee, customer]) => {
                const notifPromises = [];
                if (managerUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Booking đã xác nhận check-in",
                        content: `Phòng ${room.room_number} thuộc booking với ID: #${shortenId} từ khách hàng ${customer.full_name || 'N/A'} đã xác nhận checkin.`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                if (customer?.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: customer.user_id,
                        title: "Bạn đã check-in thành công",
                        content: `Bạn đã checkin phòng ${room.room_number} thuộc booking #${shortenId} thành công! Chúc bạn có những trải nghiệm tuyệt vời.`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                if (employee?.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: employee.user_id,
                        title: "Booking check-in thành công",
                        content: `Phòng ${room.room_number} thuộc booking #${shortenId} từ khách hàng ${customer.full_name || 'N/A'} đã xác nhận checkin.`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                return Promise.all(notifPromises);
            }).catch(err => console.error("[checkinBooking] Notification error (non-fatal):", err.message));

            return { success: true };

        } catch (error) {
            console.log("Error in checkin booking detail: ", error.message);
            throw error;
        }
    };

    checkoutBookingDetail = async (userId, bookingId, detailId) => {
        try {
            const now = new Date();

            const booking = await this.Booking.findById(bookingId);
            if (!booking) {
                throw new Error("Không tìm thấy booking.");
            }

            const detail = await this.BookingDetail.findOne({
                _id: detailId,
                booking_id: bookingId,
            });

            if (!detail) {
                throw new Error("Không tìm thấy phòng trong booking.");
            }

            if (detail.status !== "checked_in") {
                throw new Error(`Phòng đang ở trạng thái '${detail.status}', không thể checkout.`);
            }

            const replyRoom = await this.eventBus.safeRequest(
                ROOM_EVENTS.CHECK_EXISTS,
                { room_id: detail.room_id }
            );
            if (!replyRoom.found) {
                throw new Error(`Không tìm thấy phòng ${detail.room_id}`);
            }
            const room = replyRoom.room;
            const shortenId = booking._id.toString().slice(-6);

            // close old logs and insert new ones (cleaning task)
            const replyUpdateLog = await this.eventBus.safeRequest(
                ROOM_EVENTS.UPDATE_ROOM_LOG, 
                {
                    filter: {
                        room_id: detail.room_id,
                        status: "occupied",
                        end_time: { $gt: now },
                    },
                    updateData: { end_time: now }
                }
            );
            if (!replyUpdateLog.success) throw new Error(replyUpdateLog.message);

            const cleaningDuration = 2 * 60 * 60 * 1000;
            const cleaningEndTime = new Date(now.getTime() + cleaningDuration);

            const roomLog = {
                booking_id: detail.booking_id,
                room_id: detail.room_id,
                status: "cleaning",
                start_time: now,
                end_time: cleaningEndTime,
                expected_end_time: cleaningEndTime,
                note: `Phòng đã được checkout theo booking ${booking._id}, chuyển sang dọn dẹp.`,
                handled_by: null, 
            };

            const replyInsertLog = await this.eventBus.safeRequest(
                ROOM_EVENTS.INSERT_ROOM_LOG, {
                data: roomLog
            });
            if (!replyInsertLog.success) throw new Error(replyInsertLog.message);

            const replyCleaningTask = await this.eventBus.safeRequest(
                CLEANING_EVENTS.CREATE_TASK,
                {
                    room_id: detail.room_id,
                    room_log_id: Array.isArray(replyInsertLog.roomLogs) ? replyInsertLog.roomLogs[0]?._id : replyInsertLog.roomLogs?._id,
                    booking_id: bookingId,
                    note: `Dọn dẹp phòng sau checkout booking #${shortenId}`,
                }
            );
            if (!replyCleaningTask.success) 
                console.error(`[CHECKOUT] Tạo cleaning task thất bại: ${replyCleaningTask.message}`);

            detail.status = "checked_out";
            detail.actual_checkout = now;
            await detail.save();

            const replyUpdateRoom = await this.eventBus.safeRequest(
                ROOM_EVENTS.UPDATE_ROOM_INFO, 
                {
                    filter: { _id: detail.room_id },
                    updateData: { 
                        room_status: "cleaning",
                        start_time: now,
                        end_time: cleaningEndTime, 
                    }
                }
            );
            if (!replyUpdateRoom.success) throw new Error(replyUpdateRoom.message);

            const allDetails = await this.BookingDetail.find({ booking_id: bookingId });
            booking.status = this.calculateBookingStatus(allDetails);
            await booking.save();

            await this.BookingStatusLog.findOneAndUpdate(
                {
                    booking_id: bookingId,
                    end_time: null,
                },
                {
                    $set: { end_time: now },
                },
            );

            await this.BookingStatusLog.create({
                booking_id: bookingId,
                status: booking.status,
                start_time: now,
                end_time: null,
                note: `Booking chuyển sang trạng thái ${booking.status}`,
                handled_by: userId || null,
            });

            // try {
            //     await updateReceiptAfterCheckout(bookingId, session);
            // } catch (receiptError) {
            //     console.error("Lỗi khi cập nhật hóa đơn sau checkout:", receiptError);
            // }

            await Promise.all([
                cache.del(`booking:one:${bookingId}`),
                cache.delByPattern("booking:list:*"),
            ]);

            // fire-and-forget notifications
            Promise.all([
                this.findManagersByIds(),
                this.findEmployeeById(booking.handled_by),
                this.findCustomerById(booking.customer_id),
            ]).then(([{ managerUserIds }, employee, customer]) => {
                const notifPromises = [];
                if (managerUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Booking đã xác nhận check-out",
                        content: `Phòng ${room.room_number} thuộc booking với ID: #${shortenId} từ khách hàng ${customer.full_name || 'N/A'} đã xác nhận checkout. Hãy kiểm tra hóa đơn và dọn dẹp phòng.`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                if (customer?.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: customer.user_id,
                        title: "Bạn đã check-out thành công",
                        content: `Bạn đã checkout phòng ${room.room_number} thuộc booking #${shortenId} thành công! Cảm ơn bạn đã lựa chọn dịch vụ của chúng tôi.`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                if (employee?.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: employee.user_id,
                        title: "Booking check-out thành công",
                        content: `Phòng ${room.room_number} thuộc booking #${shortenId} từ khách hàng ${customer.full_name || 'N/A'} đã xác nhận check-out. Hãy kiểm tra hóa đơn và dọn dẹp phòng.`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                return Promise.all(notifPromises);
            }).catch(err => console.error("[checkoutBooking] Notification error (non-fatal):", err.message));

            return {
                room_log_id: Array.isArray(replyInsertLog.roomLogs) ? replyInsertLog.roomLogs[0]?._id : replyInsertLog.roomLogs?._id,
                room_id: detail.room_id,
                room_number: room.room_number,
                booking_id: bookingId,
            };

        } catch (error) {
            console.log("Error in checkout booking detail: ", error.message);
            throw error;
        }
    };

    cancelBookingDetail = async (userId, bookingId, detailId, reason, userRole) => {
        try {
            const now = new Date();
            
            const booking = await this.Booking.findById(bookingId);
            if (!booking) {
                throw new Error("Không tìm thấy booking.");
            }

            if (!["pending", "confirmed"].includes(booking.status)) {
                throw new Error("Không thể hủy phòng trong booking này.");
            }

            const detail = await this.BookingDetail.findOne({
                _id: detailId,
                booking_id: bookingId,
            });
            if (!detail) {
                throw new Error("Không tìm thấy phòng trong booking.");
            }

            if (detail.status === "cancelled") {
                throw new Error("Phòng này đã bị hủy trước đó.");
            }

            if (now >= new Date(detail.expected_checkin)) {
                throw new Error("Không thể hủy phòng sau ngày check-in.");
            }

            detail.status = "cancelled";
            detail.cancelled_at = now;
            detail.cancellation_reason = reason;
            await detail.save();

            const replyUpdateLog = await this.eventBus.safeRequest(
                ROOM_EVENTS.UPDATE_ROOM_LOG, 
                {
                    filter: {
                        room_id: detail.room_id,
                        start_time: { $lte: now },
                        $or: [
                            { end_time: { $gte: now } },
                            { end_time: null }
                        ]
                    },
                    updateData: { end_time: now }
                }
            );
            if (!replyUpdateLog.success) throw new Error(replyUpdateLog.message);

            const roomLog = {
                room_id: detail.room_id,
                status: "available",
                start_time: now,
                end_time: null,
                note: "Hủy phòng khỏi booking",
                handled_by: userId || null,
            };

            const replyInsertLog = await this.eventBus.safeRequest(
                ROOM_EVENTS.INSERT_ROOM_LOG, {
                data: roomLog
            });
            if (!replyInsertLog.success) throw new Error(replyInsertLog.message);

            await this.BookingCancellation.create({
                booking_id: booking._id,
                room_id: detail.room_id,
                user_id: userId,
                cancelled_by: userRole === "customer" ? "customer" : "employee",
                cancelled_by_user: userId,
                booking_status: booking.status,
                cancelled_at: now,
                reason,
            });

            const allDetails = await this.BookingDetail.find({ booking_id: bookingId });
            const new_status = this.calculateBookingStatus(allDetails);
            if (new_status !== booking.status) {
                booking.status = new_status;
                await booking.save();

                await this.BookingStatusLog.findOneAndUpdate(
                    {
                        booking_id: bookingId,
                        end_time: null,
                    },
                    {
                        $set: { end_time: now },
                    },
                );

                await this.BookingStatusLog.create({
                    booking_id: bookingId,
                    status: booking.status,
                    start_time: now,
                    end_time: null,
                    note: `Booking chuyển sang trạng thái ${booking.status}`,
                    handled_by: userId || null,
                });
            }

            await Promise.all([
                cache.del(`booking:one:${bookingId}`),
                cache.delByPattern("booking:list:*"),
            ]);
            return { success: true };

        } catch (error) {
            console.log("Error in cancel booking detail: ", error.message);
            throw error;
        }
    };

    cancelBooking = async (userId, bookingId, reason, userRole) => {
        try {
            const booking = await this.Booking.findById(bookingId);
            if (!booking)
                throw new Error("Không tìm thấy booking.");

            const status = booking.status;

            if (!["pending", "confirmed"].includes(booking.status))
                throw new Error("Không thể hủy booking này.");

            if (new Date() >= new Date(booking.expected_checkin))
                throw new Error("Không thể hủy booking sau ngày check-in.");

            booking.status = "cancelled";
            await booking.save();

            const shortenId = bookingId.toString().slice(-6);
            const now = new Date();

            await this.BookingStatusLog.findOneAndUpdate(
                {
                    booking_id: bookingId,
                    end_time: null,
                },
                {
                    $set: { end_time: now },
                },
            );

            await this.BookingStatusLog.create({
                booking_id: bookingId,
                status: booking.status,
                start_time: now,
                end_time: null,
                note: `Booking #${shortenId} đã bị hủy, chuyển sang trạng thái cancelled`,
                handled_by: userId || null,
            });

            const details = await this.BookingDetail.find({ booking_id: bookingId });
            const roomIds = details.map(bd => bd.room_id);
            
            const replyUpdateLog = await this.eventBus.safeRequest(
                ROOM_EVENTS.UPDATE_ROOM_LOG, 
                {
                    filter: {
                        room_id: { $in: roomIds },
                        start_time: { $lte: now },
                        $or: [
                            { end_time: { $gte: now } },
                            { end_time: null }
                        ]
                    },
                    updateData: { end_time: now }
                }
            );
            if (!replyUpdateLog.success) throw new Error(replyUpdateLog.message);

            const availableRoomLogs = details.map(bd => {
                return {
                    room_id: bd.room_id,
                    status: "available",
                    start_time: now,
                    end_time: null,
                    note: `Phòng được giải phóng sau khi booking #${shortenId} bị hủy.`,
                    handled_by: userId || null,
                };
            });
            const replyInsertLog = await this.eventBus.safeRequest(
                ROOM_EVENTS.INSERT_ROOM_LOG, {
                data: availableRoomLogs
            });
            if (!replyInsertLog.success) throw new Error(replyInsertLog.message);

           const replyUpdateRoom = await this.eventBus.safeRequest(
                ROOM_EVENTS.UPDATE_ROOM_INFO, 
                {
                    filter: { _id: { $in: roomIds } },
                    updateData: { 
                        start_time: now,
                        end_time: now, 
                    }
                }
            );
            if (!replyUpdateRoom.success) throw new Error(replyUpdateRoom.message);

            for (const d of details) {
                d.status = "cancelled";
                d.cancelled_at = now;
                d.cancellation_reason = reason;
                await d.save();

                await this.BookingCancellation.create({
                    booking_id: booking._id,
                    room_id: d.room_id,
                    user_id: userId,
                    cancelled_by: userRole === "customer" ? "customer" : "employee",
                    reason,
                    booking_status: status
                });
            }

            // trừ điểm khách vì đã hủy
            const replyPoints = await this.eventBus.safeRequest(
                CUSTOMER_EVENTS.UPDATE_POINTS,
                { customer_id: booking.customer_id, points: -20, reason: "Trừ 20 điểm vì hủy booking" }
            );
            if (!replyPoints.success) console.warn(`[CANCEL] Trừ điểm khách thất bại: ${replyPoints.message}`);

            // hủy luôn hóa đơn
            // await Receipt.updateMany(
            // {
            //     booking_id: booking._id
            // },
            // { $set: { status: "cancelled" } },
            // { session }
            // );

            try {
                const [{ managerUsers, managerUserIds }, employee, customer] = await Promise.all([
                    this.findManagersByIds(),
                    this.findEmployeeById(booking.handled_by),
                    this.findCustomerById(booking.customer_id),
                ]);

                const cancelId = booking._id.toString().slice(-6);
                const notifPromises = [];
                if (managerUsers.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Booking đã bị hủy",
                        content: `Booking có ID: #${cancelId} từ khách hàng ${customer.full_name || 'N/A'} đã xác nhận hủy.`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                if (customer?.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: customer.user_id,
                        title: "Booking đã bị hủy",
                        content: `Bạn đã hủy booking có ID: #${cancelId}. Tiền cọc của bạn sẽ không được hoàn lại!`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                if (employee?.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: employee.user_id,
                        title: "Booking đã bị hủy",
                        content: `Booking có ID: #${cancelId} từ khách hàng ${customer.full_name || 'N/A'} đã xác nhận hủy.`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                await Promise.all(notifPromises);

            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            await Promise.all([
                cache.del(`booking:one:${bookingId}`),
                cache.delByPattern("booking:list:*"),
            ]);
            return { success: true };

        } catch (err) {
            console.log("Error while cancelling booking: ", err.message);
            throw err;
        }
    };

    findCustomerByUserId = async (userId) => {
        const reply = await this.eventBus.safeRequest(
            CUSTOMER_EVENTS.CHECK_EXISTS_USERID,
            { customer_user_id: userId }
        );
        if (!reply.found) {
            const err = new Error("Không tìm thấy hồ sơ khách hàng.");
            err.status = 404;
            throw err;
        }
        return reply.customer;
    };

    // customer management 
    
    getMyBookings = async (userId, query = {}) => {
        try {
            const { status, page = 1, limit = 10 } = query;

            const customer = await this.findCustomerByUserId(userId);

            const filter = { customer_id: customer._id };
            if (status) filter.status = status;

            const skip = (Number(page) - 1) * Number(limit);

            const [total, bookings] = await Promise.all([
                this.Booking.countDocuments(filter),
                this.Booking.find(filter)
                    .sort({ created_at: -1 })
                    .skip(skip)
                    .limit(Number(limit))
                    .select("-__v")
                    .lean(),
            ]);

            if (bookings.length === 0) {
                return { total, page: Number(page), limit: Number(limit), bookings: [] };
            }

            const bookingIds = bookings.map(b => b._id);
            const bookingDetails = await this.BookingDetail.find({ booking_id: { $in: bookingIds } })
                .select("-created_at -updated_at -__v")
                .lean();

            const populatedDetails = await this.populateRoom(bookingDetails);

            const bookingDetailMap = {};
            populatedDetails.forEach(detail => {
                const key = detail.booking_id.toString();
                if (!bookingDetailMap[key]) bookingDetailMap[key] = [];
                bookingDetailMap[key].push(detail);
            });

            const result = bookings.map(booking => ({
                ...booking,
                rooms: bookingDetailMap[booking._id.toString()] || [],
            }));

            return { total, page: Number(page), limit: Number(limit), bookings: result };

        } catch (error) {
            console.log("Error in getMyBookings:", error.message);
            throw error;
        }
    };

    getMyBookingDetail = async (userId, bookingId) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(bookingId)) {
                throw new Error("Booking ID không hợp lệ.");
            }

            const customer = await this.findCustomerByUserId(userId);

            const [booking, bookingDetails] = await Promise.all([
                this.Booking.findById(bookingId).select("-__v").lean(),
                this.BookingDetail.find({ booking_id: bookingId })
                    .select("-__v")
                    .lean(),
            ]);

            if (!booking) {
                throw new Error("Không tìm thấy booking.");
            }

            if (booking.customer_id.toString() !== customer._id.toString()) {
                const err = new Error("Bạn không có quyền xem booking này.");
                err.status = 403;
                throw err;
            }

            const populatedDetails = await this.populateRoom(bookingDetails);

            const rooms = populatedDetails.map(item => ({
                detail_id: item._id,
                room_id: item.room_info?._id,
                room_number: item.room_info?.room_number,
                room_status: item.room_info?.room_status,
                category: item.room_info?.category ?? null,
                expected_checkin: item.expected_checkin,
                expected_checkout: item.expected_checkout,
                actual_checkin: item.actual_checkin,
                actual_checkout: item.actual_checkout,
                base_fee: item.base_fee,
                extra_fee: item.extra_fee,
                status: item.status,
                note: item.note,
                cancellation_reason: item.cancellation_reason,
            }));

            const [serviceReply, paymentReply, incidentReply] = await Promise.all([
                this.eventBus.safeRequest(SERVICE_EVENTS.GET_COMPLETED_BY_BOOKING, { bookingId }),
                this.eventBus.safeRequest(PAYMENT_EVENTS.GET_RECEIPT_BY_BOOKING, { booking_id: bookingId }),
                this.eventBus.safeRequest(INCIDENT_EVENTS.GET_ALL_INCIDENTS_INTERNAL, { booking_id: bookingId }),
            ]);

            const serviceUsages = serviceReply.success ? serviceReply.usages || [] : [];
            const receipts = [];
            if (paymentReply.success) {
                if (paymentReply.receipt) receipts.push(paymentReply.receipt);
                if (paymentReply.receiptByBooking) receipts.push(paymentReply.receiptByBooking);
                if (Array.isArray(paymentReply.receipts)) receipts.push(...paymentReply.receipts);
            }
            const incidents = incidentReply.success ? incidentReply.incidents || [] : [];

            return { booking, rooms, serviceUsages, receipts, incidents };

        } catch (error) {
            console.log("Error in getMyBookingDetail:", error.message);
            throw error;
        }
    };

    createCustomerBooking = async (userId, data) => {
        try {
            const { expected_checkin, expected_checkout, adults, children, rooms, voucher_code } = data;

            if (!expected_checkin || !expected_checkout || adults === undefined || children === undefined) {
                throw new Error("Phải điền đầy đủ thông tin bắt buộc.");
            }
            if (!Array.isArray(rooms) || rooms.length === 0) {
                throw new Error("Phải chọn ít nhất một phòng.");
            }

            const checkin = new Date(expected_checkin);
            const checkout = new Date(expected_checkout);
            const now = new Date();

            if (checkin <= now) throw new Error("Ngày check-in phải là ngày trong tương lai.");
            if (checkout <= checkin) throw new Error("Ngày check-out phải sau ngày check-in.");

            const customer = await this.findCustomerByUserId(userId);

            for (const room of rooms) {
                if (!room.room_id || !mongoose.Types.ObjectId.isValid(room.room_id)) {
                    throw new Error("ID phòng không hợp lệ.");
                }
            }

            const roomIds = rooms.map(r => r.room_id);

            // batch fetch room info (price + capacity)
            const replyRooms = await this.eventBus.safeRequest(ROOM_EVENTS.GET_ROOMS_INFO, { room_ids: roomIds });
            if (!replyRooms.rooms || replyRooms.rooms.length !== roomIds.length) {
                throw new Error("Một hoặc nhiều phòng không tồn tại.");
            }

            const roomInfoMap = {};
            for (const room of replyRooms.rooms) {
                roomInfoMap[room._id.toString()] = room;
            }

            // validate combined capacity
            let totalMaxAdults = 0;
            let totalMaxChildren = 0;
            for (const roomId of roomIds) {
                const room = roomInfoMap[roomId];
                totalMaxAdults += room.category_id?.max_adults || 0;
                totalMaxChildren += room.category_id?.max_children || 0;
            }
            if (Number(adults) > totalMaxAdults) {
                throw new Error(`Số người lớn (${adults}) vượt quá sức chứa của các phòng đã chọn (${totalMaxAdults}).`);
            }
            if (Number(children) > totalMaxChildren) {
                throw new Error(`Số trẻ em (${children}) vượt quá sức chứa của các phòng đã chọn (${totalMaxChildren}).`);
            }

            // batch conflict check via room logs
            const replyBusyLogs = await this.eventBus.safeRequest(ROOM_EVENTS.FIND_ROOM_LOGS, {
                filter: {
                    room_id: { $in: roomIds },
                    status: { $in: ["booked", "occupied", "reserved", "maintenance"] },
                    start_time: { $lt: checkout },
                    $or: [{ end_time: { $gt: checkin } }, { end_time: null }],
                },
                opts: { limit: roomIds.length * 5 },
            });
            if (replyBusyLogs.roomLogs?.length > 0) {
                const busyRoomIdStr = replyBusyLogs.roomLogs[0].room_id?.toString();
                const busyRoom = roomInfoMap[busyRoomIdStr];
                throw new Error(`Phòng ${busyRoom?.room_number || busyRoomIdStr} không còn trống trong khoảng thời gian đã chọn.`);
            }

            // calculate base fee
            const nights = this.calcNights(expected_checkin, expected_checkout);
            let baseRoomFee = 0;
            const roomDetailInfos = [];
            for (const roomId of roomIds) {
                const room = roomInfoMap[roomId];
                const pricePerNight = room.category_id?.price || 0;
                const roomFee = pricePerNight * nights;
                baseRoomFee += roomFee;
                roomDetailInfos.push({ room_id: roomId, base_fee: roomFee });
            }

            // auto-apply best discount
            let discountSnapshot = null;
            let discountAmount = 0;
            const replyDiscounts = await this.eventBus.safeRequest(DISCOUNT_EVENTS.GET_ACTIVE_DISCOUNTS, {
                orderValue: baseRoomFee,
            });
            const bestDiscount = replyDiscounts.discounts?.[0] || null;
            if (bestDiscount) {
                discountAmount = bestDiscount.savings;
                discountSnapshot = {
                    discount_id: bestDiscount.id,
                    name: bestDiscount.name,
                    description: bestDiscount.description || "",
                    discount_amount: discountAmount,
                };
            }

            // validate voucher if provided
            let voucherSnapshot = null;
            let voucherAmount = 0;
            if (voucher_code) {
                const orderValueAfterDiscount = Math.max(baseRoomFee - discountAmount, 0);
                const replyVoucher = await this.eventBus.safeRequest(DISCOUNT_EVENTS.VALIDATE_VOUCHER, {
                    voucherCodes: [voucher_code],
                    customerId: customer._id.toString(),
                    orderValue: orderValueAfterDiscount,
                });
                if (!replyVoucher.success) throw new Error(replyVoucher.message || "Voucher không hợp lệ.");
                const voucherInfo = replyVoucher.vouchers?.[0];
                if (!voucherInfo) throw new Error(`Voucher "${voucher_code}" không hợp lệ.`);
                voucherAmount = voucherInfo.savings;
                voucherSnapshot = {
                    voucher_id: voucherInfo.id,
                    code: voucher_code.toUpperCase(),
                    name: voucherInfo.name,
                    description: voucherInfo.description || "",
                    voucher_amount: voucherAmount,
                };
            }

            const originalFee = baseRoomFee;
            const totalFee = Math.max(baseRoomFee - discountAmount - voucherAmount, 0);
            const deposit = Math.ceil(totalFee * 0.3);

            const booking = await this.Booking.create({
                customer_id: customer._id,
                handled_by: null,
                adults,
                children,
                deposit,
                original_fee: originalFee,
                total_fee: totalFee,
                expected_checkin: checkin,
                expected_checkout: checkout,
                status: "pending",
                isScheduled: true,
                ...(discountSnapshot && { discount_snapshot: discountSnapshot }),
                ...(voucherSnapshot && { voucher_snapshot: voucherSnapshot }),
            });

            const bookingDetails = roomDetailInfos.map(r => ({
                booking_id: booking._id,
                room_id: r.room_id,
                expected_checkin: checkin,
                expected_checkout: checkout,
                base_fee: r.base_fee,
                status: "reserved",
            }));
            await this.BookingDetail.insertMany(bookingDetails);

            const shortenId = booking._id.toString().slice(-6);
            await this.BookingStatusLog.create({
                booking_id: booking._id,
                status: "pending",
                start_time: checkin,
                expected_end_time: checkout,
                handled_by: null,
                note: "Đơn đặt phòng được tạo bởi khách hàng, đang chờ thanh toán cọc.",
            });

            const replyUpdateRoom = await this.eventBus.safeRequest(ROOM_EVENTS.UPDATE_ROOM_INFO, {
                filter: { _id: { $in: roomIds } },
                updateData: { start_time: checkin, end_time: checkout },
            });
            if (!replyUpdateRoom.success) throw new Error(replyUpdateRoom.message);

            const roomLogs = bookingDetails.map(bd => ({
                booking_id: booking._id,
                room_id: bd.room_id,
                status: "reserved",
                start_time: checkin,
                end_time: checkout,
                expected_end_time: checkout,
                note: `Phòng được giữ chỗ bởi booking #${shortenId} (khách tự đặt, chờ cọc)`,
                handled_by: null,
            }));
            const replyInsertLog = await this.eventBus.safeRequest(ROOM_EVENTS.INSERT_ROOM_LOG, { data: roomLogs });
            if (!replyInsertLog.success) throw new Error(replyInsertLog.message);

            const amountDue = Math.max(totalFee - deposit, 0);
            const replyReceipt = await this.eventBus.safeRequest(PAYMENT_EVENTS.CREATE_RECEIPT, {
                booking_id: booking._id,
                employee_id: null,
                discount_id: discountSnapshot?.discount_id || null,
                discount_snapshot: discountSnapshot,
                base_room_fee: originalFee,
                total_fee: totalFee,
                deposit_amount: deposit,
                final_amount: totalFee,
                amount_due: amountDue,
                payment: "bank",
                status: "pending",
                note: "Hóa đơn tạo tự động khi khách tự đặt phòng, chờ thanh toán cọc.",
            });
            if (!replyReceipt.success) throw new Error(replyReceipt.message);

            if (voucher_code) {
                const replyRedeem = await this.eventBus.safeRequest(DISCOUNT_EVENTS.REDEEM_VOUCHER, {
                    voucherCodes: [voucher_code],
                    customerId: customer._id.toString(),
                    bookingId: booking._id.toString(),
                });
                if (!replyRedeem.success) {
                    console.warn(`[createCustomerBooking] Redeem voucher thất bại: ${replyRedeem.message}`);
                }
            }

            await cache.delByPattern("booking:list:*");

            Promise.all([
                this.findManagersByIds(),
                this.eventBus.safeRequest(EMPLOYEE_EVENTS.GET_RECEPTIONISTS, {}),
            ]).then(([{ managerUserIds }, replyReceptionists]) => {
                const receptionistsUserIds = replyReceptionists.found
                    ? replyReceptionists.receptionists.employees.map(e => e.user_id) : [];
                const notifPromises = [];
                if (managerUserIds?.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Đơn đặt phòng mới từ khách hàng",
                        content: `Khách hàng ${customer.full_name || "N/A"} vừa đặt phòng (Booking #${shortenId}). Chờ xác nhận thanh toán cọc.`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                if (customer?.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: customer.user_id,
                        title: "Đặt phòng thành công",
                        content: `Booking #${shortenId} đã được tạo. Vui lòng thanh toán cọc ${deposit.toLocaleString("vi-VN")}đ để hoàn tất đặt phòng.`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                if (receptionistsUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: receptionistsUserIds,
                        title: "Đơn đặt phòng mới",
                        content: `Booking #${shortenId} mới từ khách hàng ${customer.full_name || "N/A"}. Chờ xác nhận cọc.`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                return Promise.all(notifPromises);
            }).catch(err => console.error("[createCustomerBooking] Notification error:", err.message));

            return { booking, deposit };

        } catch (error) {
            console.log("Error in createCustomerBooking:", error.message);
            throw error;
        }
    };

    cancelCustomerBooking = async (userId, bookingId, reason) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(bookingId)) {
                throw new Error("Booking ID không hợp lệ.");
            }

            const customer = await this.findCustomerByUserId(userId);

            const booking = await this.Booking.findById(bookingId);
            if (!booking) throw new Error("Không tìm thấy booking.");

            if (booking.customer_id.toString() !== customer._id.toString()) {
                const err = new Error("Bạn không có quyền hủy booking này.");
                err.status = 403;
                throw err;
            }

            if (!["pending", "confirmed"].includes(booking.status)) {
                throw new Error("Không thể hủy booking ở trạng thái này.");
            }

            if (new Date() >= new Date(booking.expected_checkin)) {
                throw new Error("Không thể hủy booking sau ngày check-in.");
            }

            const now = new Date();
            const shortenId = bookingId.toString().slice(-6);

            booking.status = "cancelled";
            await booking.save();

            await this.BookingStatusLog.findOneAndUpdate(
                { booking_id: bookingId, end_time: null },
                { $set: { end_time: now } }
            );
            await this.BookingStatusLog.create({
                booking_id: bookingId,
                status: "cancelled",
                start_time: now,
                end_time: null,
                note: `Booking #${shortenId} bị hủy bởi khách hàng.`,
                handled_by: null,
            });

            const details = await this.BookingDetail.find({ booking_id: bookingId });
            const roomIds = details.map(bd => bd.room_id);

            const replyUpdateLog = await this.eventBus.safeRequest(ROOM_EVENTS.UPDATE_ROOM_LOG, {
                filter: {
                    room_id: { $in: roomIds },
                    start_time: { $lte: now },
                    $or: [{ end_time: { $gte: now } }, { end_time: null }],
                },
                updateData: { end_time: now },
            });
            if (!replyUpdateLog.success) throw new Error(replyUpdateLog.message);

            const availableRoomLogs = details.map(bd => ({
                room_id: bd.room_id,
                status: "available",
                start_time: now,
                end_time: null,
                note: `Phòng được giải phóng sau khi booking #${shortenId} bị khách hủy.`,
                handled_by: null,
            }));
            const replyInsertLog = await this.eventBus.safeRequest(ROOM_EVENTS.INSERT_ROOM_LOG, {
                data: availableRoomLogs,
            });
            if (!replyInsertLog.success) throw new Error(replyInsertLog.message);

            const replyUpdateRoom = await this.eventBus.safeRequest(ROOM_EVENTS.UPDATE_ROOM_INFO, {
                filter: { _id: { $in: roomIds } },
                updateData: { start_time: now, end_time: now },
            });
            if (!replyUpdateRoom.success) throw new Error(replyUpdateRoom.message);

            for (const d of details) {
                d.status = "cancelled";
                d.cancelled_at = now;
                d.cancellation_reason = reason;
                await d.save();

                await this.BookingCancellation.create({
                    booking_id: booking._id,
                    room_id: d.room_id,
                    user_id: userId,
                    cancelled_by: "customer",
                    reason,
                    booking_status: booking.status,
                });
            }

            // deduct points for cancellation
            const replyPoints = await this.eventBus.safeRequest(CUSTOMER_EVENTS.UPDATE_POINTS, {
                customer_id: customer._id,
                points: -20,
                reason: "Trừ 20 điểm vì hủy booking",
            });
            if (!replyPoints.success) console.warn(`[cancelCustomerBooking] Trừ điểm thất bại: ${replyPoints.message}`);

            // release voucher lock if any
            const voucherCode = booking.voucher_snapshot?.code;
            if (voucherCode) {
                const replyRelease = await this.eventBus.safeRequest(DISCOUNT_EVENTS.RELEASE_VOUCHER, {
                    voucherCodes: [voucherCode],
                    customerId: customer._id.toString(),
                    bookingId: bookingId.toString(),
                });
                if (!replyRelease.success) {
                    console.warn(`[cancelCustomerBooking] Release voucher thất bại: ${replyRelease.message}`);
                }
            }

            await Promise.all([
                cache.del(`booking:one:${bookingId}`),
                cache.delByPattern("booking:list:*"),
            ]);

            Promise.all([this.findManagersByIds()]).then(([{ managerUserIds }]) => {
                const notifPromises = [];
                if (managerUserIds?.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Booking bị khách hủy",
                        content: `Khách hàng ${customer.full_name || "N/A"} đã hủy booking #${shortenId}.`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                if (customer?.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: customer.user_id,
                        title: "Đã hủy đặt phòng",
                        content: `Booking #${shortenId} đã được hủy thành công. Tiền cọc sẽ không được hoàn lại.`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                return Promise.all(notifPromises);
            }).catch(err => console.error("[cancelCustomerBooking] Notification error:", err.message));

            return { success: true };

        } catch (error) {
            console.log("Error in cancelCustomerBooking:", error.message);
            throw error;
        }
    };

    cancelCustomerBookingDetail = async (userId, bookingId, detailId, reason) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(bookingId) || !mongoose.Types.ObjectId.isValid(detailId)) {
                throw new Error("ID không hợp lệ.");
            }

            const customer = await this.findCustomerByUserId(userId);

            const booking = await this.Booking.findById(bookingId);
            if (!booking) throw new Error("Không tìm thấy booking.");

            if (booking.customer_id.toString() !== customer._id.toString()) {
                const err = new Error("Bạn không có quyền thao tác trên booking này.");
                err.status = 403;
                throw err;
            }

            if (!["pending", "confirmed"].includes(booking.status)) {
                throw new Error("Không thể hủy phòng trong booking ở trạng thái này.");
            }

            const detail = await this.BookingDetail.findOne({ _id: detailId, booking_id: bookingId });
            if (!detail) throw new Error("Không tìm thấy phòng trong booking.");

            if (detail.status === "cancelled") throw new Error("Phòng này đã bị hủy trước đó.");

            const now = new Date();
            if (now >= new Date(detail.expected_checkin)) {
                throw new Error("Không thể hủy phòng sau ngày check-in.");
            }

            detail.status = "cancelled";
            detail.cancelled_at = now;
            detail.cancellation_reason = reason;
            await detail.save();

            const replyUpdateLog = await this.eventBus.safeRequest(ROOM_EVENTS.UPDATE_ROOM_LOG, {
                filter: {
                    room_id: detail.room_id,
                    start_time: { $lte: now },
                    $or: [{ end_time: { $gte: now } }, { end_time: null }],
                },
                updateData: { end_time: now },
            });
            if (!replyUpdateLog.success) throw new Error(replyUpdateLog.message);

            const replyInsertLog = await this.eventBus.safeRequest(ROOM_EVENTS.INSERT_ROOM_LOG, {
                data: {
                    room_id: detail.room_id,
                    status: "available",
                    start_time: now,
                    end_time: null,
                    note: `Phòng được giải phóng sau khi khách hủy 1 phòng từ booking #${bookingId.toString().slice(-6)}.`,
                    handled_by: null,
                },
            });
            if (!replyInsertLog.success) throw new Error(replyInsertLog.message);

            await this.BookingCancellation.create({
                booking_id: booking._id,
                room_id: detail.room_id,
                user_id: userId,
                cancelled_by: "customer",
                reason,
                booking_status: booking.status,
            });

            // check if all rooms are now cancelled — if so, escalate to full booking cancel
            const allDetails = await this.BookingDetail.find({ booking_id: bookingId });
            const allCancelled = allDetails.every(d => d.status === "cancelled");

            if (allCancelled) {
                // reuse cancelCustomerBooking for the voucher release + points deduction + full status update
                booking.status = "pending"; // reset so cancelCustomerBooking's guard passes
                await booking.save();
                return this.cancelCustomerBooking(userId, bookingId, reason);
            }

            // partial cancel: just update booking status if it changed
            const newStatus = this.calculateBookingStatus(allDetails);
            if (newStatus !== booking.status) {
                booking.status = newStatus;
                await booking.save();

                await this.BookingStatusLog.findOneAndUpdate(
                    { booking_id: bookingId, end_time: null },
                    { $set: { end_time: now } }
                );
                await this.BookingStatusLog.create({
                    booking_id: bookingId,
                    status: newStatus,
                    start_time: now,
                    end_time: null,
                    note: `Booking chuyển sang trạng thái ${newStatus} sau khi khách hủy một phòng.`,
                    handled_by: null,
                });
            }

            await Promise.all([
                cache.del(`booking:one:${bookingId}`),
                cache.delByPattern("booking:list:*"),
            ]);

            // fire-and-forget: notify managers
            this.findManagersByIds().then(({ managerUserIds }) => {
                const notifPromises = [];
                const shortenId = bookingId.toString().slice(-6);
                if (managerUserIds?.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Khách hủy một phòng trong booking",
                        content: `Khách hàng ${customer.full_name || "N/A"} đã hủy 1 phòng trong booking #${shortenId}.`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                if (customer?.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: customer.user_id,
                        title: "Đã hủy phòng thành công",
                        content: `Bạn đã hủy 1 phòng trong booking #${shortenId} thành công.`,
                        type: "booking", kind: "Booking", refId: booking._id,
                    }));
                }
                return Promise.all(notifPromises);
            }).catch(err => console.error("[cancelCustomerBookingDetail] Notification error:", err.message));

            return { success: true };

        } catch (error) {
            console.log("Error in cancelCustomerBookingDetail:", error.message);
            throw error;
        }
    };

    // communication

    findBookingById = async (bookingId) => {
        const booking = await this.Booking.findById(bookingId);
        return booking;
    }

    findBookingsByIds = async (bookingIds) => {
        if (!bookingIds?.length) return [];
        return this.Booking.find({ _id: { $in: bookingIds } }).lean();
    }

    findBookingDetailsByBookingId = async (bookingId) => {
        const details = await this.BookingDetail.find({ booking_id: bookingId });
        return details;
    }

    findBookingDetailsByBookingIds = async (activeBookingIds, start, end) => {
        const busyBookingDetails = await this.BookingDetail.find({
            booking_id: { $in: activeBookingIds },
            status: { $ne: "cancelled" },
            expected_checkin: { $lt: end },
            expected_checkout: { $gt: start },
        }).select("room_id");

        return busyBookingDetails;
    }

    getActiveBookings = async () => {
        const activeBookings = await this.Booking.find({
            status: { $in: ["pending", "confirmed", "in_progress"] },
        }).select("_id");

        return activeBookings;
    }

    getCalendarData = async (roomIds, startOfDay, endOfDay) => {
        try {
            const bookingDetails = await this.BookingDetail.find({
                room_id: { $in: roomIds },
                $or: [
                    { expected_checkin: { $lte: endOfDay }, expected_checkout: { $gte: startOfDay } },
                    { actual_checkin: { $lte: endOfDay }, actual_checkout: { $gte: startOfDay } }
                ]
            }).lean();

            const bookingIds = [...new Set(bookingDetails.map(d => d.booking_id?.toString()).filter(Boolean))];

            const rawBookings = await this.Booking.find({
                _id: { $in: bookingIds },
                status: { $nin: ["cancelled", "expired"] }
            }).lean();

            const bookings = await this.populateCustomerAndEmployee(rawBookings);

            return {
                bookingDetails,
                bookings
            };

        } catch (err) {
            console.error("Error handling GET_CALENDAR_DATA:", err);
            throw err;
        }
    };

    getLogsForCustomerReport = async (bookingIds) => {
        const statusLogs = await this.BookingStatusLog.aggregate([
            { $match: { booking_id: { $in: bookingIds } } },
            { $sort: { start_time: -1 } },
            {
                $group: {
                    _id: "$booking_id",
                    status: { $first: "$status" }
                }
            }
        ]);

        return statusLogs;
    }

    getBookingsForCustomerReport = async (start, end) => {
        const bookings = await this.Booking.find({
            created_at: { $gte: start, $lte: end }
        }).lean();

        return bookings;
    }

    getTopBookedRoomCategories = async (query = {}) => {
        try {
            const limit = Math.min(Math.max(parseInt(query.limit, 10) || 5, 1), 10);

            // BookingDetail only stores room_id, so first count bookings per room
            // (excluding cancelled), then resolve rooms → categories via room-service.
            const perRoom = await this.BookingDetail.aggregate([
                { $match: { status: { $ne: "cancelled" } } },
                { $group: { _id: "$room_id", totalBooked: { $sum: 1 } } },
            ]);

            if (perRoom.length === 0) return { result: [] };

            const roomIds = perRoom.map(r => r._id);
            const reply = await this.eventBus.safeRequest(
                ROOM_EVENTS.GET_ROOMS_INFO, { room_ids: roomIds }
            );
            if (!reply?.success) throw new Error(reply?.message || "Không lấy được thông tin phòng.");

            // room_id → { category_id, category_name }
            const roomToCategory = new Map();
            for (const room of (reply.rooms || [])) {
                const cat = room.category_id; // populated { _id, category_name, ... }
                if (cat?._id) {
                    roomToCategory.set(room._id.toString(), {
                        category_id: cat._id.toString(),
                        category_name: cat.category_name,
                    });
                }
            }

            // Aggregate per-room counts up to the category level
            const byCategory = new Map();
            for (const { _id: roomId, totalBooked } of perRoom) {
                const cat = roomToCategory.get(roomId.toString());
                if (!cat) continue; // room no longer exists / unresolved
                const entry = byCategory.get(cat.category_id) ?? {
                    category_id: cat.category_id,
                    category_name: cat.category_name,
                    totalBooked: 0,
                };
                entry.totalBooked += totalBooked;
                byCategory.set(cat.category_id, entry);
            }

            const result = [...byCategory.values()]
                .sort((a, b) => b.totalBooked - a.totalBooked)
                .slice(0, limit);

            return { result }; // [{ category_id, category_name, totalBooked }]

        } catch (error) {
            console.log("Error in getTopBookedRoomCategories:", error);
            throw error;
        }
    };
}