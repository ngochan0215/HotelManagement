import mongoose from "mongoose";
import { CUSTOMER_EVENTS } from "../../../shared/events/customerEvents.js";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";
import { ROOM_EVENTS } from "../../../shared/events/roomEvents.js";
import { DISCOUNT_EVENTS } from "../../../shared/events/discountEvents.js";

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
    
    // helper
    calcNights = (expected_checkin, expected_checkout) => {
        const diffMs = new Date(expected_checkout) - new Date(expected_checkin);

        if (diffMs <= 0) {
            throw new Error("Thời gian checkout phải lớn hơn checkin");
        }

        const diffHours = diffMs / (1000 * 60 * 60);
        const days = diffHours / 24;

        return Math.ceil(days * 100) / 100;
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
                const replyLogs = await this.eventBus.request(
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

                if(replyLogs.roomLogs) {
                    const replyRoom = await this.eventBus.request(
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

            const replyUpdateRoom = await this.eventBus.request(
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

            const replyUpdateLog = await this.eventBus.request(
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
            const replyInsertLog = await this.eventBus.request(
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

            console.log(`Booking ${booking_id} đã được xác nhận thành công.`);

            // send notifications
            try {
                // send noti for admin
                const { adminUsers, adminUserIds } = await this.findAdminsByIds();
                const employee = await this.findEmployeeById(booking.handled_by);
                const customer = await this.findCustomerById(booking.customer_id);

                if (adminUserIds.length > 0) {
                    await this.sendNotificationsToUsers({
                        userIds: adminUserIds,
                        title: "Booking đã xác nhận thanh toán tiền cọc",
                        content: `Booking có ID: #${booking._id.toString().slice(-6)} từ khách hàng ${customer.full_name || 'N/A'} đã xác nhận đặt cọc thành công.`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id
                    });
                }

                // send noti for customer
                if (customer && customer.user_id) {
                    await this.sendNotification({
                        userId: customer.user_id,
                        title: "Booking đặt cọc thành công",
                        content: `Bạn đã đặt cọc bookitng có ID: #${booking._id.toString().slice(-6)} thành công! Hãy để ý ngày giờ checkin nhé.`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id
                    });
                }

                // send noti for handled employee
                if (employee && employee.user_id) {
                    await this.sendNotification({
                        userId: employee.user_id,
                        title: "Booking đặt cọc thành công",
                        content: `Booking có ID: #${booking._id.toString().slice(-6)} từ khách hàng 
                            ${customer.full_name || 'N/A'} đã xác nhận đặt cọc thành công.`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id
                    });
                }

                console.log("Notifications sent for booking confirmation.");

            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

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
                const reply = await this.eventBus.request(
                    EMPLOYEE_EVENTS.GET_INFO,
                    { employee_ids: employeeIds }
                );
                for (const emp of reply.employees) {
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
                const reply = await this.eventBus.request(
                    CUSTOMER_EVENTS.GET_INFOS_IDS,
                    { customerIds: customerIds }
                );
                for (const cus of reply.customers) {
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
            const reply = await this.eventBus.request(
                ROOM_EVENTS.GET_ROOMS_INFO,
                { room_ids: roomIds }
            );

            for (const room of reply.rooms) {
                roomMap[room._id.toString()] = {
                    _id: room._id,
                    room_number: room.room_number,
                    room_status: room.room_status,
                    category: room.category_id ? {
                        id: room.category_id._id,
                        name: room.category_id.name,
                        price: room.category_id.price,
                        capacity: room.category_id.capacity,
                        description: room.category_id.description,
                    } : null,
                }
            }
        }

        const results = list.map(details => ({
            ...details,
            room_info: roomMap[details.room_id?.toString()] || null
        }));

        return isArray ? results : results[0];
    };

    findCustomerById = async (customerId) => {
        const replyCustomer = await this.eventBus.request(
            CUSTOMER_EVENTS.CHECK_EXISTS,
            { customerId }
        );

        if (!replyCustomer.success)
            throw new Error(replyCustomer.message);

        const customer = replyCustomer.customer;
        return customer;
    }

    findEmployeeByUserId = async (employeeUserId) => {
        const replyEmployee = await this.eventBus.request(
            EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
            { employee_user_id: employeeUserId }
        );

        if (!replyEmployee.found) throw new Error("Không tìm thấy nhân viên thực hiện.");

        const employee = replyEmployee.employee;
        return employee;
    }

    findEmployeeById = async (employeeId) => {
        const replyEmployee = await this.eventBus.request(
            EMPLOYEE_EVENTS.CHECK_EXISTS,
            { employee_id: employeeId }
        );

        if (!replyEmployee.found) throw new Error("Không tìm thấy nhân viên thực hiện.");

        const employee = replyEmployee.employee;
        return employee;
    }

    findAdminsByIds = async () => {
        const replyAdmin = await this.eventBus.request(
            USER_EVENTS.GET_ADMINS,
            { system_role: "manager" }
        );

        let adminUsers, adminUserIds;
        if (replyAdmin.success) {
            adminUsers = replyAdmin.admins;
            adminUserIds = adminUsers.map(u => u._id);
        }

        return { adminUsers, adminUserIds };
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

            const customer = await this.findCustomerById(customer_id);
            const employee = await this.findEmployeeByUserId(employeeUserId);
            console.log("EMPLOYEE: ", employee);
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

                const replyRoom = await this.eventBus.request(
                    ROOM_EVENTS.CHECK_EXISTS,
                    { room_id: room.room_id }
                );
                if (!replyRoom.found)
                    throw new Error(`Không tìm thấy phòng ${replyRoom.room.room_number}.`);

                if(replyRoom.room.room_status !== "available") {
                    throw new Error(`Phòng ${replyRoom.room.room_number} đang không trống.`);
                }
            }

            let discount = null;
            let discountSnapshot = null;
            let discountAmount = 0;
            if (discount_id) {
                if (!mongoose.Types.ObjectId.isValid(discount_id)) {
                    throw new Error("ID Khuyến mãi không hợp lệ");
                }

                const replyDiscount = await this.eventBus.request(
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

                // get discount info
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
            console.log("ID: ", employee._id);
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

            const replyUpdateRoom = await this.eventBus.request(
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
            const replyInsertLog = await this.eventBus.request(
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
            const receiptStatus = "pending";

            // calculate orignal room fee (before extracting deposit)
            const baseRoomFee = rooms.reduce((sum, r) => {
                const nights = this.calcNights(expected_checkin, expected_checkout);
                return sum + (r.base_fee * nights);
            }, 0);

            // const receipt = await Receipt.create(
            // [{
            //     booking_id: booking[0]._id,
            //     employee_id: employee._id,
            //     discount_id: discount_id || null,
            //     discount_snapshot: discountSnapshot,
            //     base_room_fee: baseRoomFee,
            //     total_fee: totalFee,
            //     deposit_amount: depositAmount,
            //     final_amount: finalAmount,
            //     amount_due: amountDue,
            //     payment: paymentMethod,
            //     status: receiptStatus,
            //     note: isImmediate ? "Hóa đơn tạo tự động khi đặt liền (không cần cọc)" : "Hóa đơn tạo tự động, chờ thanh toán cọc",
            // }],
            // { session }
            // );

            // send notifications
            try {
                const { adminUsers, adminUserIds } = await this.findAdminsByIds();

                if (adminUserIds.length > 0) {
                    await this.sendNotificationsToUsers({
                        userIds: adminUserIds,
                        title: "Đơn đặt phòng mới",
                        content: `Có booking mới với ID: #${shortenId} từ khách hàng ${customer.full_name || 'N/A'}`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id
                    });
                }

                // send noti for customer
                await this.sendNotification({
                    userId: customer.user_id,
                    title: "Booking mới",
                    content: `Bạn đã đặt booking mới có ID: #${shortenId} thành công! Vui lòng thanh toán tiền cọc nếu đặt trước nhe.`,
                    type: "booking",
                    kind: "Booking",
                    refId: booking._id
                });

                // send noti for receptionists
                const replyReceptionists = await this.eventBus.request(
                    EMPLOYEE_EVENTS.GET_RECEPTIONISTS,
                    {}
                );
                if (!replyReceptionists.found)
                    throw new Error("Không tìm thấy nhân viên lễ tân hợp lệ.");

                const receptionists = replyReceptionists.receptionists.employees;
                const receptionistsUserIds = receptionists.map(e => e.user_id);

                await this.sendNotificationsToUsers({
                    userIds: receptionistsUserIds,
                    title: "Booking mới",
                    content: `Có booking mới với ID: #${shortenId} từ khách hàng ${customer.full_name || "N/A"}`,
                    type: "booking",
                    kind: "Booking",
                    refId: booking._id
                });

            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            console.log("Booking created successfully.");
            return booking;

        } catch (error) {
            console.log("Error in creating booking: ", error.message);
            throw error;
        }
    };

    confirmBooking = async (bookingId, employeeId) => {
        try {
            console.log("Confirming booking:", bookingId, "by employee:", employeeId);          
            const booking = await this.confirmBookingInternal(bookingId, employeeId);
            console.log("Booking confirmed:", booking);

            return booking;

        } catch (error) {
            console.log("Error in confirming booking: ", error.log);
            throw error;
        }
    };

    getAllBookings = async (query = {}) => {
        try {
            const { isScheduled, status } = query;
            const filter = {};

            if (isScheduled) filter.isScheduled = isScheduled;
            if (status) filter.status = status;

            const bookings = await this.Booking.find(filter)
                .sort({ created_at: -1 })
                .select("-__v")
                .lean();

            if (bookings.length === 0) {
                return res.json([]);
            }

            const populatedBookings = await this.populateCustomerAndEmployee(bookings);
            const bookingIds = bookings.map(b => b._id);

            const bookingDetails = await this.BookingDetail.find({ booking_id: { $in: bookingIds } })
                .select("-created_at -updated_at -__v")
                .lean();

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

            return { total: populatedBookings.length, bookings: result };

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

            return { 
                booking: populatedBooking,
                rooms
            }

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
                const replyFindLogs = await this.eventBus.request(
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
                        const replyUpdateLog = await this.eventBus.request(
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
                    const replyInsertLog = await this.eventBus.request(
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
                        const replyInsertLog = await this.eventBus.request(
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

                        const replyUpdateLog = await this.eventBus.request(
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
                        const replyInsertLog = await this.eventBus.request(
                            ROOM_EVENTS.INSERT_ROOM_LOG, {
                            data: roomLog
                        });
                        if (!replyInsertLog.success) throw new Error(replyInsertLog.message);
                    }

                    break;
                }

                case "checked_out": {
                    for (const bd of bookingDetails) {
                        const replyUpdateLog = await this.eventBus.request(
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
                            note: `Cleaning after checkout booking ${booking._id}`,
                            handled_by: null,
                        };
                        const replyInsertLog = await this.eventBus.request(
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

            // send notifications
            try {
                const { adminUsers, adminUserIds } = await this.findAdminsByIds();
                const employee = await this.findEmployeeById(booking.handled_by);
                const customer = await this.findCustomerById(booking.customer_id);
                
                const statusLabels = {
                    pending: "Đang chờ",
                    confirmed: "Đã xác nhận",
                    checked_in: "Đã check-in",
                    checked_out: "Đã check-out",
                    cancelled: "Đã hủy",
                    expired: "Đã hết hạn"
                };

                if (adminUsers.length > 0) {
                    await this.sendNotificationsToUsers({
                        userIds: adminUserIds,
                        title: "Booking đã thay đổi trạng thái",
                        content: `Booking #${shortenId} đã chuyển sang trạng thái "${statusLabels[status] || status}"`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id,
                    });
                }

                if (customer && customer.user_id) {
                    await this.sendNotification({
                        userId: customer.user_id,
                        title: "Booking đã thay đổi trạng thái",
                        content: `Booking #${shortenId} đã chuyển sang trạng thái "${statusLabels[status] || status}"`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id,
                    });
                }

                if (employee && employee.user_id) {
                    await this.sendNotification({
                        userId: employee.user_id,
                        title: "Booking đã thay đổi trạng thái",
                        content: `Booking #${shortenId} đã chuyển sang trạng thái "${statusLabels[status] || status}"`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id,
                    });
                }
            
            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

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
                const replyRoom = await this.eventBus.request(
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
            return { success: true };

        } catch (err) {
            console.log("Error in updating booking (add rooms): ", err.message);
            throw err;
        }
    };

    // checkin 1 phòng trong booking
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

            const replyRoom = await this.eventBus.request(
                ROOM_EVENTS.CHECK_EXISTS,
                { room_id: detail.room_id }
            );
            if (!replyRoom.found) {
                throw new Error(`Không tìm thấy phòng ${room.room_number}`);
            }
            const room = replyRoom.room;

            // find conflict room logs, close old logs and insert new one
            const conflictLog = await this.eventBus.request(
                ROOM_EVENTS.FIND_ROOM_LOGS,
                {
                    filter: {
                        room_id: detail.room_id,
                        start_time: { $lt: detail.expected_checkout },
                        end_time: { $gt: now },
                        status: { $in: ["occupied", "maintenance", "cleaning"] },
                        $or: [
                            { end_time: null },
                            { end_time: { $gt: bd.expected_checkin } }
                        ]
                    },
                    opts: { limit: 1 }
                }
            );
            if (conflictLog) {
                throw new Error("Phòng đang không trong trạng thái có thể checkin trong khoảng thời gian này.");
            }

            const replyUpdateLog = await this.eventBus.request(
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
            const replyInsertLog = await this.eventBus.request(
                ROOM_EVENTS.INSERT_ROOM_LOG, {
                data: roomLogs
            });
            if (!replyInsertLog.success) throw new Error(replyInsertLog.message);

            detail.status = "checked_in";
            detail.actual_checkin = now;
            await detail.save();

            const replyUpdateRoom = await this.eventBus.request(
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

            // send notifications
            try {
                const { adminUsers, adminUserIds } = await this.findAdminsByIds();
                const employee = await this.findEmployeeById(booking.handled_by);
                const customer = await this.findCustomerById(booking.customer_id);

                if (adminUsers.length > 0) {
                    await this.sendNotificationsToUsers({
                        userIds: adminUserIds,
                        title: "Booking đã xác nhận check-in",
                        content: `Phòng ${room.room_number} thuộc booking với ID: #${shortenId} từ khách hàng ${customer.full_name || 'N/A'} 
                            đã xác nhận checkin.`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id,
                    });
                }

                if (customer && customer.user_id) {
                    await this.sendNotification({
                        userId: customer.user_id,
                        title: "Bạn đã check-in thành công",
                        content: `Bạn đã checkin phòng ${room.room_number} thuộc booking #${shortenId} thành công!
                            Chúc bạn có những trải nghiệm tuyệt vời.`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id
                    });
                }

                if (employee && employee.user_id) {
                    await this.sendNotification({
                        userId: employee.user_id,
                        title: "Booking check-in thành công",
                        content: `Phòng ${room.room_number} thuộc booking #${shortenId} từ khách hàng ${customer.full_name || 'N/A'} 
                            đã xác nhận checkin.`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id,
                    });
                }

            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

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

            const replyRoom = await this.eventBus.request(
                ROOM_EVENTS.CHECK_EXISTS,
                { room_id: detail.room_id }
            );
            if (!replyRoom.found) {
                throw new Error(`Không tìm thấy phòng ${room.room_number}`);
            }
            const room = replyRoom.room;

            // close old logs and insert new ones (cleaning task)
            const replyUpdateLog = await this.eventBus.request(
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

            const replyInsertLog = await this.eventBus.request(
                ROOM_EVENTS.INSERT_ROOM_LOG, {
                data: roomLog
            });
            if (!replyInsertLog.success) throw new Error(replyInsertLog.message);

            // await CleaningTask.create(
            // [{
            //     room_id: detail.room_id,
            //     room_log_id: roomLog._id,
            //     booking_id: bookingId,
            //     status: "pending",
            //     note: `Dọn dẹp phòng sau checkout booking ${booking._id}`,
            // }],
            // { session }
            // );

            detail.status = "checked_out";
            detail.actual_checkout = now;
            await detail.save();

            const replyUpdateRoom = await this.eventBus.request(
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

            try {
                const { adminUsers, adminUserIds } = await this.findAdminsByIds();
                const employee = await this.findEmployeeById(booking.handled_by);
                const customer = await this.findCustomerById(booking.customer_id);
            
                if (adminUsers.length > 0) {
                    await this.sendNotificationsToUsers({
                        userIds: adminUserIds,
                        title: "Booking đã xác nhận check-out",
                        content: `Phòng ${room.room_number} thuộc booking với ID: #${shortenId} từ khách hàng ${customer.full_name || 'N/A'} 
                            đã xác nhận checkout. Hãy kiểm tra hóa đơn và dọn dẹp phòng.`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id,
                    });
                }

                if (customer && customer.user_id) {
                    await this.sendNotification({
                        userId: customer.user_id,
                        title: "Bạn đã check-out thành công",
                        content: `Bạn đã checkout phòng ${room.room_number} thuộc booking #${shortenId} thành công!
                            Cảm ơn bạn đã lựa chọn dịch vụ của chúng tôi.`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id
                    });
                }

                if (employee && employee.user_id) {
                    await this.sendNotification({
                        userId: employee.user_id,
                        title: "Booking check-out thành công",
                        content: `Phòng ${room.room_number} thuộc booking #${shortenId} từ khách hàng ${customer.full_name || 'N/A'} 
                            đã xác nhận check-out. Hãy kiểm tra hóa đơn và dọn dẹp phòng.`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id,
                    });
                }

            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            return {
                room_log_id: replyInsertLog.roomLogs._id,
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
            
            const booking = await this.Booking.findById(bookingId).session(session);
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

            const replyUpdateLog = await this.eventBus.request(
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

            const replyInsertLog = await this.eventBus.request(
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
            const new_status = calculateBookingStatus(allDetails);
            if (new_status !== booking.status) {  
                booking.status = new_status;
                await booking.save();

                await this.BookingStatusLog.findOneAndUpdate(
                    {
                        bookingId,
                        end_time: null,
                    },
                    {
                        $set: { end_time: now },
                    },
                );

                await this.BookingStatusLog.create({
                    bookingId,
                    status: booking.status,
                    start_time: now,
                    end_time: null,
                    note: `Booking chuyển sang trạng thái ${booking.status}`,
                    handled_by: userId || null,
                });
            }

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

            const details = await this.BookingDetail.find({ booking_id: bookingId }).lean();
            const roomIds = details.map(bd => bd.room_id);
            
            const replyUpdateLog = await this.eventBus.request(
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
            const replyInsertLog = await this.eventBus.request(
                ROOM_EVENTS.INSERT_ROOM_LOG, {
                data: availableRoomLogs
            });
            if (!replyInsertLog.success) throw new Error(replyInsertLog.message);

           const replyUpdateRoom = await this.eventBus.request(
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
            // await updateCustomerPoints({
            //   customer_id: booking.customer_id,
            //   points: -20,
            //   reason: "Trừ 20 điểm vì hủy booking"
            // });

            // hủy luôn hóa đơn
            // await Receipt.updateMany(
            // {
            //     booking_id: booking._id
            // },
            // { $set: { status: "cancelled" } },
            // { session }
            // );

            try {
                const { adminUsers, adminUserIds } = await this.findAdminsByIds();
                const employee = await this.findEmployeeById(booking.handled_by);
                const customer = await this.findCustomerById(booking.customer_id);

                if (adminUsers.length > 0) {
                    await this.sendNotificationsToUsers({
                        userIds: adminUserIds,
                        title: "Booking đã bị hủy",
                        content: `Booking có ID: #${booking._id.toString().slice(-6)} từ khách hàng ${customer.full_name || 'N/A'} 
                            đã xác nhận hủy.`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id,
                    });
                }

                if (customer && customer.user_id) {
                    await this.sendNotification({
                        userId: customer.user_id,
                        title: "Booking đã bị hủy",
                        content: `Bạn đã hủy booking có ID: #${booking._id.toString().slice(-6)}. 
                            Tiền cọc của bạn sẽ không được hoàn lại!`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id
                    });
                }

                if (employee && employee.user_id) {
                    await this.sendNotification({
                        userId: employee.user_id,
                        title: "Booking đã bị hủy",
                        content: `Booking có ID: #${booking._id.toString().slice(-6)} từ khách hàng ${customer.full_name || 'N/A'} 
                            đã xác nhận hủy.`,
                        type: "booking",
                        kind: "Booking",
                        refId: booking._id,
                    });
                }

            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            return { success: true };

        } catch (err) {
            console.log("Error while cancelling booking: ", err.message);
            throw err;
        }
    };

    getCancellationReasonStats = async (query = {}) => {
        try {
            const { fromDate, toDate, cancelledBy } = query;
            const match = {};

            if (fromDate && isNaN(new Date(fromDate))) {
                throw new Error("Thời gian bắt đầu không hợp lệ.");
            }
            if (toDate && isNaN(new Date(toDate))) {
                throw new Error("Thời gian kết thúc không hợp lệ.");
            }

            if (fromDate || toDate) {
                match.cancelled_at = {};
                if (fromDate) match.cancelled_at.$gte = new Date(fromDate);
                if (toDate) match.cancelled_at.$lte = new Date(toDate);
            }

            const ALLOWED_CANCELLED_BY = ["user", "system", "admin"];
                if (cancelledBy && !ALLOWED_CANCELLED_BY.includes(cancelledBy)) {
                    throw new Error("Người thao tác Hủy phòng không hợp lệ.");
            }

            if (cancelledBy) {
                match.cancelled_by = cancelledBy;
            }

            const stats = await RoomCancellation.aggregate([
                { $match: match },
                {
                    $group: {
                    _id: "$reason",
                    total: { $sum: 1 },
                    },
                },
            ]);

            const result = Object.keys(CANCELLATION_REASON_LABELS).map(code => {
                const found = stats.find(s => s._id === code);
                return {
                    reason_code: code,
                    reason_label: CANCELLATION_REASON_LABELS[code],
                    total: found ? found.total : 0,
                };
            });

            return result;

        } catch (error) {
            console.log("Error while getting booking's cancellation reason statistics: ", error.message);
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
}