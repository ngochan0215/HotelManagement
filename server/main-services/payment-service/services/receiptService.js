import mongoose from "mongoose";
import { BOOKING_EVENTS } from "../../../shared/events/bookingEvents.js";
import * as helpers from "./paymentHelpers.js";
import { cache, makeCacheKey } from "../../../shared/utils/cache.js";

export class ReceiptService {
    constructor({ Receipt, Transaction, eventBus, sendNotification, sendNotificationsToUsers }) {
        this.Receipt = Receipt;
        this.Transaction = Transaction;
        this.eventBus = eventBus;
        this.sendNotification = sendNotification;
        this.sendNotificationsToUsers = sendNotificationsToUsers;
    }

    findCustomerById = (customerId) => helpers.findCustomerById(this.eventBus, customerId);
    
    findEmployeeByUserId = (employeeUserId) => helpers.findEmployeeByUserId(this.eventBus, employeeUserId);
    
    findEmployeeById = (employeeId) => helpers.findEmployeeById(this.eventBus, employeeId);
    
    findAdminsByIds = async () => {
        const { managerUserIds } = await helpers.findManagersByIds(this.eventBus);
        return managerUserIds || [];
    };
    
    findPendingCompensationTickets = (bookingId) => helpers.findPendingCompensationTickets(this.eventBus, bookingId);
    
    findBookingById = (bookingId) => helpers.findBookingById(this.eventBus, bookingId);
    
    populateBookingPeople = (bookings) => helpers.populateBookingPeople(this.eventBus, bookings);
    
    enrichReceipts = (receipts) => helpers.enrichReceipts(this.eventBus, receipts);

    // main business logic

    createReceiptFromBooking = async (data) => {
        const {
            booking_id, employee_id, discount_id, discount_snapshot,
            base_room_fee, total_fee, deposit_amount, final_amount,
            amount_due, payment, status, note
        } = data;

        const existing = await this.Receipt.findOne({ booking_id });
        if (existing) return existing;

        const receipt = await this.Receipt.create({
            booking_id,
            employee_id,
            discount_id: discount_id || null,
            discount_snapshot: discount_snapshot || null,
            base_room_fee,
            total_fee,
            deposit_amount,
            final_amount,
            amount_due,
            payment,
            status: status || "pending",
            note: note || "",
        });

        await cache.delByPattern("receipt:list:*");
        return receipt;
    };

    updateReceiptAfterCheckout = async (booking_id) => {
        try {
            const receipt = await this.Receipt.findOne({ booking_id });
        
            if (!receipt) {
                throw new Error(`Không tìm thấy hóa đơn cho booking ${booking_id}. Có thể booking chưa có hóa đơn.`);
            }
        
            if (receipt.status === "paid" || receipt.status === "cancelled") {
                throw new Error(`Hóa đơn ${receipt._id} đã ở trạng thái ${receipt.status}, không thể cập nhật.`);
                return receipt;
            }
        
            // find service-usage ticket of this booking
            let serviceFee = 0;
            let serviceUsageId = null;
            // const serviceUsages = session
            // ? await ServiceUsage.find({
            //     booking_id,
            //     status: "completed",
            //     }).session(session)
            // : await ServiceUsage.find({
            //     booking_id,
            //     status: "completed",
            //     });
        
            // if (serviceUsages && serviceUsages.length > 0) {
            //     serviceFee = serviceUsages.reduce((sum, usage) => sum + (usage.total_fee || 0), 0);
            //     serviceUsageId = serviceUsages[serviceUsages.length - 1]._id;
            // }
        
            // find all compensation tickets of this booking
            let compensateFee = 0;
            let compensateTicketId = null;

            const compensationTickets = await this.findPendingCompensationTickets(booking_id);
            if (compensationTickets && compensationTickets.length > 0) {
                compensateFee = compensationTickets.reduce((sum, comp) => sum + (comp.total_fee || 0), 0);
                compensateTicketId = compensationTickets[compensationTickets.length - 1]._id;
            }
        
            // recalculate finalAmount and amount_due
            const totalFee = receipt.total_fee;
            const depositAmount = receipt.deposit_amount;
            const finalAmount = totalFee + (serviceFee ?? receipt.service_fee) + compensateFee;
            
            let amountPaid = 0;
            if (receipt.status === "half-paid") {
                amountPaid = depositAmount;
            } else if (receipt.status === "paid") {
                amountPaid = finalAmount;
            }
            const amountDue = Math.max(finalAmount - amountPaid, 0);
        
            // update receipt
            receipt.service_usage_id = serviceUsageId;
            receipt.compensate_ticket_id = compensateTicketId;
            receipt.service_fee = serviceFee ?? receipt.service_fee;
            receipt.compensate_fee = compensateFee;
            receipt.final_amount = finalAmount;
            receipt.amount_due = amountDue;
        
            // update note for changes
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
        
            await receipt.save();
            await cache.del(`receipt:one:${receipt._id}`);
            return receipt;

        } catch (error) {
            console.log("Error in updating receipt after checking out booking:", error);
            throw error;
        }
    };
    
    createReceipt = async (employeeUserId, data) => {
        try {
            const { booking_id, payment, note = "" } = data;

            if (!mongoose.Types.ObjectId.isValid(booking_id)) {
                throw new Error("ID Đặt phòng không hợp lệ.");
            }
        
            if (!["cash", "bank"].includes(payment)) {
                throw new Error("Phương thức thanh toán không hợp lệ. Chỉ chấp nhận tiền mặt hoặc chuyển khoản.");
            }

            const [employee, booking] = await Promise.all([
                this.findEmployeeByUserId(employeeUserId),
                this.findBookingById(booking_id),
            ]);

            let discountSnapshot = null;
            let discountId = null;
        
            const existedReceipt = await this.Receipt.findOne({ booking_id });
            if (existedReceipt) {
                try {
                    discountSnapshot = existedReceipt.discount_snapshot;
                    discountId = existedReceipt.discount_id;

                    const updatedReceipt = await this.updateReceiptAfterCheckout(booking_id);
                    
                    if (payment) existedReceipt.payment = payment;
                    if (note) existedReceipt.note = note;

                    await existedReceipt.save();
                    return updatedReceipt ?? existedReceipt;

                } catch (updateError) {
                    console.log("Error in updating existed receipt: ", updateError.message);
                    throw updateError;
                }
            }
        
            // find all service-usage tickets of this booking
            let serviceFee = 0;
            let serviceUsageId = null;
        
            // const serviceUsages = await ServiceUsage.find({
            // booking_id,
            // status: "completed",
            // }).session(session);
        
            // if (serviceUsages && serviceUsages.length > 0) {
            //     serviceFee = serviceUsages.reduce((sum, usage) => sum + (usage.total_fee || 0), 0);
            //     serviceUsageId = serviceUsages[serviceUsages.length - 1]._id;
            // }
        
            // find all compensation tickets of this booking
            let compensateFee = 0;
            let compensateTicketId = null;

            const compensations = await this.findPendingCompensationTickets(booking_id);
            if (compensations && compensations.length > 0) {
                compensateFee = compensations.reduce((sum, comp) => sum + (comp.total_fee || 0), 0);
                compensateTicketId = compensations[compensations.length - 1]._id;
            }
        
            const totalFee = booking.total_fee;
            const depositAmount = booking.deposit || 0;
        
            // calculate original room fee
            const replyDetails = await this.eventBus.safeRequest(
                BOOKING_EVENTS.GET_DETAILS_BOOKING_ID,
                { bookingId: booking_id }
            );
            if (!replyDetails.success)
                throw new Error(replyDetails.message || "Không lấy được chi tiết đặt phòng.");
            
            const bookingDetails = replyDetails.details;
            const baseRoomFee = bookingDetails.reduce((sum, detail) => {
                const d1 = new Date(detail.expected_checkin);
                const d2 = new Date(detail.expected_checkout);
                const day1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
                const day2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
                const nights = Math.max(Math.round((day2 - day1) / (1000 * 60 * 60 * 24)), 1);
                return sum + (detail.base_fee * nights);
            }, 0);
        
            const finalAmount = totalFee + serviceFee + compensateFee;
            const amountDue = Math.max(finalAmount - depositAmount, 0);
        
            const receipt = await this.Receipt.create({
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
            });

            await cache.delByPattern("receipt:list:*");
            return receipt;

        } catch (err) {
            console.log("Error in creating receipt: ", err.message);
            throw err;
        }
    };
    
    getReceiptById = async (receiptId) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(receiptId)) {
                throw new Error("ID Hoá đơn không hợp lệ.");
            }

            const cacheKey = `receipt:one:${receiptId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const receipt = await this.Receipt.findById(receiptId).lean();
            if (!receipt) {
                throw new Error("Không tìm thấy hóa đơn.");
            }

            const enriched = await this.enrichReceipts(receipt);
            await cache.set(cacheKey, enriched, 120);
            return enriched;

        } catch (err) {
            console.log("Error in getting receipt by ID: ", err.message);
            throw err;
        }
    };
    
    getAllReceipts = async (query = {}) => {
        try {
            const cacheKey = makeCacheKey("receipt:list", query);
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const { status, payment, booking_id, from_date, to_date, keyword } = query;
            const filter = {};
        
            if (status) filter.status = status;
            if (payment) filter.payment = payment;
        
            if (booking_id) {
                if (!mongoose.Types.ObjectId.isValid(booking_id)) {
                    throw new Error("ID Đơn đặt phòng không hợp lệ.");
                }
                filter.booking_id = booking_id;
            }
        
            if (from_date || to_date) {
                filter.created_at = {};
                if (from_date) filter.created_at.$gte = new Date(from_date);
                if (to_date) filter.created_at.$lte = new Date(to_date);
            }
        
            const receiptQuery = this.Receipt.find(filter)
                .sort({ created_at: -1 });
        
            const receipts = await receiptQuery.lean();
            const enriched = await this.enrichReceipts(receipts);
            let result = enriched;
        
            if (keyword) {
                const lower = keyword.toLowerCase();
                result = enriched.filter(r =>
                    r.booking?.customer_info?.full_name?.toLowerCase().includes(lower)
                );
            }

            const response = { total: result.length, receipts: result };
            await cache.set(cacheKey, response, 60);
            return response;

        } catch (err) {
            console.log("Error in getting all receipts: ", err.message);
            throw err;
        }
    };
    
    updateReceipt = async (receiptId, data) => {
        try {
            const { status, payment } = data;
        
            const allowedStatus = ["pending", "paid", "half-paid", "cancelled"];
            const allowedPayment = ["cash", "bank"];
        
            if (!mongoose.Types.ObjectId.isValid(receiptId))
                throw new Error("ID hóa đơn không hợp lệ.");
        
            if (!allowedStatus.includes(status))
                throw new Error("Trạng thái hóa đơn không hợp lệ.");
        
            if (!allowedPayment.includes(payment))
                throw new Error("Phương thức thanh toán không hợp lệ.");
        
            const receipt = await this.Receipt.findById(receiptId);
            if (!receipt)
                throw new Error("Không tìm thấy hóa đơn.");

            if (receipt.status === "paid") {
                throw new Error("Hóa đơn đã thanh toán không thể thay đổi trạng thái.");
            }

            if (receipt.status === "cancelled") {
                throw new Error("Hóa đơn đã hủy không thể cập nhật được nữa.");
            }

            const [booking, receiptEmployee, adminUserIds] = await Promise.all([
                this.findBookingById(receipt.booking_id),
                this.findEmployeeById(receipt.employee_id),
                this.findAdminsByIds(),
            ]);
            const [bookingEmployee, customer] = await Promise.all([
                this.findEmployeeById(booking.handled_by),
                this.findCustomerById(booking.customer_id),
            ]);

            if (status === "paid" && !receipt.paid_at) {
                receipt.paid_at = new Date();
            
                // if (booking) {
                //     // cộng điểm khách vì hoàn thành xong booking
                //     // await updateCustomerPoints({
                //     //   customer_id: booking.customer_id,
                //     //   points: Math.floor(receipt.final_amount / 10000),
                //     //   reason: "Hoàn tất thanh toán hóa đơn"
                //     // });
            
                //     await Customer.findOneAndUpdate(
                //     { _id: booking.customer_id },
                //     { $inc: { booking_count: 1 } }
                //    );
            }
        
            // update compensation ticket status
            if (receipt.compensate_ticket_id || receipt.compensate_fee > 0) {
                try {
                    const compensateTickets = await CompensateTicket.find({
                        booking_id: receipt.booking_id,
                        status: "pending"
                    });
            
                    for (const ticket of compensateTickets) {
                        ticket.status = "paid";
                        ticket.paid_at = new Date();
                        await ticket.save();
            
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
                    console.log("Error in updating compensation tickets:", compError.message);
                }
            }
        
            if (status === "cancelled" && !receipt.cancelled_at) {
                receipt.cancelled_at = new Date();
            }

            receipt.payment = payment;
            receipt.status = status;
            await receipt.save();

            await Promise.all([
                cache.del(`receipt:one:${receiptId}`),
                cache.delByPattern("receipt:list:*"),
            ]);

            // send notifications
            try {
                const statusLabels = {
                    pending: "Đang chờ thanh toán",
                    paid: "Đã thanh toán",
                    "half-paid": "Đã thanh toán một phần",
                    cancelled: "Đã hủy"
                };
            
                const receiptIdShort = receiptId.toString().slice(-6);
                const statusLabel = statusLabels[status] || status;
                const message = `Hóa đơn với ID #${receiptIdShort} đã chuyển sang trạng thái "${statusLabel}"`;
                    
                if (adminUserIds.length > 0) {
                    await sendNotificationToUsers({
                        userIds: adminUserIds,
                        title: "Thay đổi trạng thái hóa đơn",
                        content: message,
                        type: "booking",
                        kind: "Order",
                        refId: receiptId,
                    });
                }
            
                if (receiptEmployee && receiptEmployee.user_id) {
                    await sendNotification({
                        userId: receiptEmployee.user_id,
                        title: "Thay đổi trạng thái hóa đơn",
                        content: message,
                        type: "booking",
                        kind: "Order",
                        refId: receiptId,
                    });
                }
            
                if (bookingEmployee && bookingEmployee.user_id) {
                    if (!receiptEmployee || bookingEmployee.user_id.toString() !== receiptEmployee.user_id.toString()) {
                        await sendNotification({
                            userId: bookingEmployee.user_id,
                            title: "Thay đổi trạng thái hóa đơn",
                            content: message,
                            type: "booking",
                            kind: "Order",
                            refId: receiptId,
                        });
                    }
                }
            
                if (customer && customer.user_id) {
                    await sendNotification({
                        userId: customer.user_id,
                        title: "Thay đổi trạng thái hóa đơn",
                        content: message,
                        type: "booking",
                        kind: "Order",
                        refId: receiptId,
                    });
                }
            } catch (notifError) {
                console.log("Error sending notification:", notifError.message);
            }
        
            return receipt;
        
        } catch (error) {
            console.log("Error in updating receipt: ", error.message);
            throw error;
        }
    };
    
    getReceiptInfoByBooking = async ({ booking_id, compensate_ticket_id }) => {
        const filter = { booking_id };
        if (compensate_ticket_id) filter.compensate_ticket_id = compensate_ticket_id;

        const receipt = await this.Receipt.findOne(filter)
            .select("status compensate_fee compensate_ticket_id").lean();

        if (receipt) return { receipt, receiptByBooking: null };

        const receiptByBooking = await this.Receipt.findOne({
            booking_id,
            compensate_fee: { $gt: 0 },
            status: { $in: ["pending", "half-paid"] }
        }).select("status").lean();

        return { receipt: null, receiptByBooking: receiptByBooking || null };
    };

    refreshReceiptAfterCheckout = async (receiptId) => {
        try {        
            if (!mongoose.Types.ObjectId.isValid(receiptId))
                throw new Error("ID hóa đơn không hợp lệ.");

            const receipt = await this.Receipt.findById(receiptId).lean();
            if (!receipt)
                throw new Error("Không tìm thấy hóa đơn.");
        
            if (receipt.status === "paid") {
                throw new Error("Hóa đơn đã thanh toán không thể thay đổi trạng thái.");
            }
        
            if (receipt.status === "cancelled") {
                throw new Error("Hóa đơn đã hủy không thể cập nhật được nữa.");
            }
        
            const updatedReceipt = await this.updateReceiptAfterCheckout(receipt.booking_id);
            await Promise.all([
                cache.del(`receipt:one:${receiptId}`),
                cache.delByPattern("receipt:list:*"),
            ]);
            return updatedReceipt;

        } catch (error) {
            console.log("Error in refreshing receipt after checking out:", error.message);
            throw error;
        }
    };
    
    markReceiptAsPaid = async (employeeUserId, receiptId, payment) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(receiptId))
                throw new Error("ID hóa đơn không hợp lệ.");
        
            if (!["cash", "bank"].includes(payment)) {
                throw new Error("Phương thức thanh toán không hợp lệ. Chỉ chấp nhận tiền mặt hoặc chuyển khoản.");
            }
        
            const [employee, receipt] = await Promise.all([
                this.findEmployeeByUserId(employeeUserId),
                this.Receipt.findById(receiptId),
            ]);
            if (!employee) {
                throw new Error("Không tìm thấy nhân viên.");
            }
            if (!receipt)
                throw new Error("Không tìm thấy hóa đơn.");
        
            if (receipt.status === "paid") {
                throw new Error("Hóa đơn đã thanh toán không thể thay đổi trạng thái.");
            }
        
            if (receipt.status === "cancelled") {
                throw new Error("Hóa đơn đã hủy không thể cập nhật được nữa.");
            }
                
            receipt.status = "paid";
            receipt.payment = payment;
            receipt.paid_at = new Date();
            await receipt.save();

            await Promise.all([
                cache.del(`receipt:one:${receiptId}`),
                cache.delByPattern("receipt:list:*"),
            ]);

            const [booking, receiptEmployee] = await Promise.all([
                this.findBookingById(receipt.booking_id),
                this.findEmployeeById(receipt.employee_id),
            ]);
            const [bookingEmployee, customer] = await Promise.all([
                this.findEmployeeById(booking.handled_by),
                this.findCustomerById(booking.customer_id),
            ]);
            
            const rewardPoints = Math.floor(receipt.final_amount / 10000);
            // await updateCustomerPoints({
            //   customer_id: booking.customer_id,
            //   points: rewardPoints,
            //   reason: "Hoàn tất thanh toán hóa đơn"
            // });
        
            // await Customer.findByIdAndUpdate(
            // booking.customer_id,
            // { $inc: { booking_count: 1 } },
            // { session }
            // );
        
            // Tự động cập nhật compensation tickets thành "paid" nếu có trong hóa đơn
            if (receipt.compensate_ticket_id || receipt.compensate_fee > 0) {
                const compensations = await this.findPendingCompensationTickets(receipt.booking_id);  

                // for (const ticket of compensations) {
                //     ticket.status = "paid";
                //     ticket.paid_at = new Date();
                //     await ticket.save();
            
                //     const incident = await Incident.findById(ticket.incident_id).session(session);
                //     if (incident && incident.compensation_status === "pending") {
                //         incident.compensation_status = "done";
                //         if (incident.status !== "closed") {
                //             incident.status = "closed";
                //             incident.closed_at = new Date();
                //         }
                //         await incident.save({ session });
                //     }
            }
                
            try {
                const receiptIdShort = id.toString().slice(-6);
                const message = `Hóa đơn #${receiptIdShort} đã chuyển sang trạng thái "Đã thanh toán"`;
            
                const adminUserIds = await this.findAdminsByIds();
                if (adminUserIds.length > 0) {
                    await this.sendNotificationsToUsers({
                        userIds: adminUserIds,
                        title: "Thay đổi trạng thái hóa đơn",
                        content: message,
                        type: "booking",
                        kind: "Order",
                        refId: id,
                    });
                }
            
                if (receiptEmployee && receiptEmployee.user_id) {
                    await this.sendNotification({
                        userId: receiptEmployee.user_id,
                        title: "Thay đổi trạng thái hóa đơn",
                        content: message,
                        type: "booking",
                        kind: "Order",
                        refId: id,
                    });
                }
        
                if (bookingEmployee && bookingEmployee.user_id) {
                    if (!receiptEmployee || bookingEmployee.user_id.toString() !== receiptEmployee.user_id.toString()) {
                        await this.sendNotification({
                            userId: bookingEmployee.user_id,
                            title: "Thay đổi trạng thái hóa đơn",
                            content: message,
                            type: "booking",
                            kind: "Order",
                            refId: id,
                        });
                    }
                }
            
                if (customer && customer.user_id) {
                    await this.sendNotification({
                        userId: customer.user_id,
                        title: "Thay đổi trạng thái hóa đơn",
                        content: message,
                        type: "booking",
                        kind: "Order",
                        refId: id,
                    });
                }
            } catch (notifError) {
                console.log("Error sending notification:", notifError);
            }
        
            return receipt;
        
        } catch (error) {
            console.log("Error in marking receipt as paid: ", error.message);
            throw error;
        }
    };
}