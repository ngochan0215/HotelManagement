import mongoose from "mongoose";
import { EQUIPMENT_EVENTS } from "../../../shared/events/equipmentEvents.js";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";
import { ROOM_EVENTS } from "../../../shared/events/roomEvents.js";
import { CUSTOMER_EVENTS } from "../../../shared/events/customerEvents.js";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";

export class CompensateService {
    constructor({ CompensateTicket, CompensateDetail, Incident, IncidentLog, eventBus }) 
    {
        this.CompensateTicket = CompensateTicket;
        this.CompensateDetail = CompensateDetail;
        this.Incident = Incident;
        this.IncidentLog = IncidentLog;
        this.eventBus = eventBus;
    }

    // helper

    getEmployeeByUserId = async (employeeUserId) => {
        const reply = await this.eventBus.request(
            EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
            { employee_user_id: employeeUserId }
        );

        if (!reply.success)
            throw new Error(reply.message || "Không tìm thấy nhân viên.");
        
        return reply.employee;
    };

    getEquipmentById = async (equipmentId) => {
        const reply = await this.eventBus.request(
            EQUIPMENT_EVENTS.CHECK_EXISTS,
            { equipmentId }
        );

        if (!reply.success) 
            throw new Error(reply.message || "Không tìm thấy thiết bị.");
        
        return reply.equipment;
    };

    // main business logic

    async createCompensateTicket (userId, incidentId, data) {
        try {
            const { payer_type, payer_id, compensation_details, note } = data;
            
            const actor = await this.getEmployeeByUserId(userId);
        
            if ( !payer_type || !compensation_details ) {
                throw new Error("Yêu cầu nhập đầy đủ thông tin (người bồi thường, chi tiết đền bù).");
            }
        
            const incident = await this.Incident.findById(incidentId);
            if (!incident) {
                throw new Error("Sự cố không tồn tại.");
            }
        
            if (!payer_id) payer_id = incident.causer_id;
        
            if (incident.compensation_status !== "none") {
                throw new Error("Sự cố đã có phiếu đền bù.");
            }
        
            const existedTicket = await this.CompensateTicket.findOne({ incidentId });
        
            if (existedTicket) {
                throw new Error("Sự cố này đã có phiếu đền bù.");
            }
        
            const validPayers = ["customer", "employee", "hotel"];
            if (!validPayers.includes(payer_type)) {
                throw new Error("payer_type không hợp lệ.");
            }
        
            if (payer_type !== "hotel" && !payer_id) {
                throw new Error("Cần xác định người chịu trách nhiệm chi trả.");
            }
        
            const { details, totalFee } = await this.buildCompensationDetails(compensation_details, incident);
        
            for (const item of details) {
                await this.updateEquipmentByResolution({
                    equipment_id: item.equipment_id, 
                    resolution: item.resolution, 
                    handled_by: req.user.employee_id, 
                    note: `Sự cố ${incident._id}`
                });
            }
        
            // thêm phiếu đền bù
            const ticket = await this.CompensateTicket.create({
                incident_id: incident._id,
                booking_id: incident.booking_id || null,
                payer_type,
                payer_id: payer_id || null,
                note: note || "",
                compensation_details: details,
                total_fee: totalFee,
                status: "pending"
            });
        
            const detailDocs = details.map(item => ({
                ticket_id: ticket._id,
                equipment_id: item.equipment_id || null,
                broken_state: item.broken_state,
                resolution: item.resolution,
                penalty_fee: item.penalty_fee,
            }));
        
            await this.CompensateDetail.insertMany(detailDocs);
        
            // ghi log
            await this.IncidentLog.create({
                incident_id: incident._id,
                action: "compensation_updated",
                from_status: incident.compensation_status,
                to_status: "pending",
                actor_id: actor._id,
                actor_name: actor.full_name,
                actor_role: actor.position,
                note: note || "Xác nhận tạo phiếu đền bù thành công."
            });
        
            incident.compensation_status = "pending";
            await incident.save();

            return ticket;

        } catch (err) {
            console.log("Error in creating compensate ticket: ", err.message);
            throw err;
        }
    };
    
    async createCompensateTicketOther (incidentId, userId, data) {
        try {
            const { payer_type, payer_id, total_fee, note } = data;

            const actor = await this.getEmployeeByUserId(userId);
    
            if ( !payer_type || !total_fee ) {
                throw new Error("Yêu cầu nhập đầy đủ thông tin.");
            }
        
            const incident = await this.Incident.findById(incidentId);
            if (!incident) {
                throw new Error("Sự cố không tồn tại.");
            }
        
            if (!payer_id) payer_id = incident.causer_id;
        
            if (incident.compensation_status !== "none") {
                throw new Error("Sự cố đã có phiếu đền bù.");
            }
        
            const existedTicket = await this.CompensateTicket.findOne({ incident_id: incidentId });
            if (existedTicket) {
                throw new Error("Sự cố này đã có phiếu đền bù.");
            }
        
            const validPayers = ["customer", "employee", "hotel"];
            if (!validPayers.includes(payer_type)) {
                throw new Error("payer_type không hợp lệ.");
            }
        
            if (payer_type !== "hotel" && !payer_id) {
                throw new Error("Cần xác định người chịu trách nhiệm chi trả.");
            }
        
            const ticket = await this.CompensateTicket.create({
                incident_id: incident._id,
                booking_id: incident.booking_id || null,
                payer_type,
                payer_id: payer_id || null,
                note: note || "",
                total_fee: total_fee,
                status: "pending"
            });
        
            await this.IncidentLog.create({
                incident_id: incident._id,
                action: "compensation_updated",
                from_status: incident.compensation_status,
                to_status: "pending",
                actor_id: actor._id,
                actor_name: actor.full_name,
                actor_role: actor.position,
                note: note || "Xác nhận tạo phiếu đền bù thành công."
            });
        
            incident.compensation_status = "pending";
            await incident.save();
            
            return ticket;

        } catch (err) {
            console.log("Error in creating compensation ticket for other: ", err.message);
            throw err;
        }
    };
    
    async getAllCompensateTickets (query = {}) {
        try {
            const { status, incident_id } = query;
            const filter = {};

            if (status) 
                filter.status = status;
            if (incident_id) 
                filter.incident_id = incident_id;
    
            const compensations = await this.CompensateTicket.find(filter)
                .select("-__v -updated_at")
                .populate({
                    path: "incident_id", select: "-__v -updated_at -created_at",
                })
                .populate({
                    path: "compensation_details.equipment_id",
                    select: "condition status",
                    // populate: {
                    // path: "category_id",
                    // select: "name price",
                    // },
                })
                .sort({ created_at: -1 }).lean();
    
            const incidents = compensations.map(t => t.incident_id).filter(Boolean);

            const populatedIncidents = await this.populateRoom(incidents);
            const finalIncidents = await this.populateReporterAndCauser(populatedIncidents);
            
            // Map incident_id -> populated incident
            const incidentMap = {};
            for (const inc of finalIncidents) {
                incidentMap[inc._id.toString()] = inc;
            }

            // Check receipt song song cho tất cả tickets
            const receiptChecks = await Promise.all(
                compensations.map(async (ticket) => {
                    if (!ticket.booking_id) 
                        return { 
                            isInReceipt: false, 
                            receiptStatus: null 
                        };

                    // const receipt = await this.Receipt.findOne({
                    //     booking_id: ticket.booking_id,
                    //     compensate_ticket_id: ticket._id
                    // }).select("status").lean();

                    if (receipt) 
                        return { 
                            isInReceipt: true, 
                            receiptStatus: receipt.status 
                        };

                    // const receiptByBooking = await this.Receipt.findOne({
                    //     booking_id: ticket.booking_id,
                    //     compensate_fee: { $gt: 0 },
                    //     status: { $in: ["pending", "half-paid"] }
                    // }).select("status").lean();

                    return {
                        isInReceipt: !!receiptByBooking,
                        receiptStatus: receiptByBooking?.status || null,
                    };
                })
            );

            const result = compensations.map((ticket, i) => {
                const inc = incidentMap[ticket.incident_id?._id?.toString() || ticket.incident_id?.toString()];
                const { isInReceipt, receiptStatus } = receiptChecks[i];

                return {
                    ...ticket,
                    incident_id: inc ? {
                        ...inc,
                        reporter_name: inc.reporter_info?.full_name || null,
                        causer_name: inc.causer_info?.full_name || null,
                    } : null,
                    is_in_receipt: isInReceipt,
                    receipt_status: receiptStatus,
                };
            });

            return result;
    
        } catch (error) { 
            console.log("Error in getting all compensation tickets: ", error.message);
            throw error;
        }
    };
    
    async getCompensateTicketById (ticketId) {
        try {
            const compensation = await this.CompensateTicket.findById(ticketId)
                .select("-__v")
                .populate({
                    path: "incident_id", select: "-__v -updated_at -created_at",
                    // populate: [
                    // { path: "room_id", select: "room_number" },
                    // { path: "reporter_id", select: "system_role" },
                    // { path: "causer_id", select: "system_role" },
                    // ],
                })
                .populate({
                    path: "compensation_details.equipment_id",
                    // populate: {
                    // path: "category_id",
                    // select: "name price",
                    // },
                })
                .lean();
        
            if (!compensation)
                throw new Error("Không tìm thấy phiếu đền bù.");
        
            const incident = compensation.incident_id;
            let finalIncident = null;

            if (incident) {
                const withRoom = await this.populateRoom(incident);
                const withAll = await this.populateReporterAndCauser(withRoom);
                finalIncident = {
                    ...withAll,
                    reporter_name: withAll.reporter_info?.full_name || null,
                    causer_name: withAll.causer_info?.full_name || null,
                };
            }

            return {
                data: {
                    ...compensation,
                    incident_id: finalIncident,
                },
            };

        } catch (error) {
            console.log("Error in getting compensate ticket: ", error.message);
            throw error;
        }
    };
    
    async updateCompensateTicket (ticketId, updates) {
        try {
            const ticket = await this.CompensateTicket.findById(ticketId);
            if (!ticket) {
                throw new Error("Không tìm thấy phiếu đền bù.");
            }
        
            if (ticket.status !== "pending") 
                throw new Error("Chỉ có thể cập nhật phiếu đền bù khi đang ở trạng thái pending.");
        
            const forbiddenFields = ["incident_id", "status", "paid_at", "created_at"];
        
            for (const field of forbiddenFields) {
                if (field in updates) 
                    throw new Error(`Không được phép cập nhật trường ${field}.`);
            }
        
            if (ticket.incident_id) {
                const incident = await this.Incident.findById(ticket.incident_id);
                if (!incident) {
                    throw new Error("Sự cố liên quan không tồn tại.");
                }
            
                if (incident.status === "closed") {
                    throw new Error("Không thể cập nhật phiếu đền bù khi sự cố đã đóng.");
                }
            }
        
            if (updates.items) {
                if (!Array.isArray(updates.items) || updates.items.length === 0)
                    throw new Error("Thông tin item bồi thường không hợp lệ.");
            
                let totalAmount = 0;
                for (const item of updates.items) {
                    if (!item.name || item.amount == null || item.amount < 0) {
                        throw new Error("Thông tin item bồi thường không hợp lệ.");
                    }
                    totalAmount += item.amount;
                }
                updates.total_amount = totalAmount;
            }
        
            if (updates.total_amount != null && updates.total_amount < 0) {
                throw new Error("Tổng tiền bồi thường không hợp lệ.");
            }
        
            if (updates.handled_by) {
                const reply = await this.eventBus.request(
                    USER_EVENTS.GET_USER_INFO,
                    { userId: updates.handled_by }
                );
                if (!reply.found) {
                    throw new Error("Nhân viên xử lý không tồn tại.");
                }
            }
        
            Object.assign(ticket, updates);
            await ticket.save();

            return ticket;

        } catch (error) {
            console.log("Error in updating compensation ticket: ", error.message);
            throw error;
        }
    };
    
    async confirmCompensationPaid (userId, ticketId, note) { 
        try {
            const actor = await this.getEmployeeByUserId(userId);
        
            const ticket = await this.CompensateTicket.findById(ticketId).populate("incident_id");
            if (!ticket) 
                throw new Error("Không tìm thấy phiếu đền bù.");

            if (ticket.status !== "pending")
                throw new Error("Chỉ có thể xác nhận thanh toán cho phiếu đền bù đang ở trạng thái pending.");
        
            const incident = await this.Incident.findById(ticket.incident_id);
            if (!incident) 
                throw new Error("Không tìm thấy sự cố liên quan.");
        
            ticket.status = "paid";
            await ticket.save();
        
            const oldStatus = incident.status;
            incident.status = "closed";
            incident.compensation_status = "done";
            incident.closed_at = new Date();
            await incident.save();
        
            await this.IncidentLog.create({
                incident_id: incident._id, 
                action: "compensation_paid_closed", 
                from_status: oldStatus, 
                to_status: "closed",
                actor_id: actor._id, 
                actor_name: actor.full_name, 
                actor_role: actor.position, 
                note: note || "Xác nhận đã thanh toán và đóng sự cố."
            });
        
            // await this.reevaluateRoomStatus(ticket.room_id);
        
            return { success: true };

        } catch (error) {
            console.log("Error in confirming compensation paid: ", error.message);
            throw error;
        }
    };

    async buildCompensationDetails (detailsInput, incident) {
        try {
            let totalFee = 0;
            const details = [];
            const room_id = incident.room_id;
        
            for (const item of detailsInput) {
                const equipment = await this.getEquipmentById(item.equipment_id);

                if (equipment.room_id.toString() !== room_id.toString()) {
                    throw new Error("Đây không phải thiết bị của phòng!");
                }
        
                const validState = ["scratched", "cracked", "broken", "lost", "unusable"];
                if (!validState.includes(item.broken_state)) {
                    throw new Error("Tình trạng hư hỏng không hợp lệ!");
                }
        
                const { penalty_fee } = await this.calculatePenaltyFee({
                    equipment_id: item.equipment_id, 
                    broken_state: item.broken_state, 
                    resolution: item.resolution
                });

                totalFee += penalty_fee;
                details.push({ 
                    equipment_id: item.equipment_id, 
                    broken_state: item.broken_state, 
                    resolution: item.resolution, penalty_fee 
                });
            }

            return { details, totalFee };

        } catch (error) {
            console.log("Error in building compensation ticket details: ", error.message);
            throw error;
        }
    };

    async calculatePenaltyFee ({ equipment_id, broken_state, resolution }) {
        try {
            const equipment = await this.getEquipmentById(equipment_id);

            const categoryReply = await this.eventBus.request(
                EQUIPMENT_EVENTS.GET_CATEGORY_INFO,
                { categoryId: equipment.category_id }
            );
            if (!categoryReply.success) 
                throw new Error(categoryReply.message);
            const category = categoryReply.category;
            
            const originalPrice = category.price;
            const rateTable = {
                scratched: { repair: 0.1, discard: 0.3 },
                cracked: { repair: 0.3, discard: 0.5 },
                broken: { repair: 0.5, discard: 0.8 },
                lost: { discard: 1.2 },
                unusable: { discard: 0.8 }
            };

            const rate = rateTable[broken_state]?.[resolution] ?? 0;

            return { 
                penalty_fee: Math.round(originalPrice * rate), 
                price: originalPrice 
            };

        } catch (error) {
            console.log("Error in calculating penalty fee for compensation ticket: ", error.message);
            throw error;
        }
    }
    
    async updateEquipmentByResolution ({ equipment_id, resolution, handled_by = null, note = "" }) {
        try {
            const equipment = await this.getEquipmentById(equipment_id);
            
            let newCondition, newStatus;
            switch (resolution) {
                case "repair": 
                    newCondition = "maintenance"; 
                    newStatus = "maintenance"; 
                    break;
                case "discard": 
                    newCondition = "broken"; 
                    newStatus = "disposed"; 
                    break;
                default: 
                    throw new Error("Resolution không hợp lệ.");
            }

            const replyUpdate = await this.eventBus.request(
                EQUIPMENT_EVENTS.UPDATE_LOG,
                { equipmentId: equipment_id }
            );
            if (!replyUpdate.success) 
                throw new Error(replyUpdate.message);

            const replyCreate = await this.eventBus.request(
                EQUIPMENT_EVENTS.CREATE_LOG,
                { 
                    equipment_id,
                    room_id: equipment.room_id || null,
                    condition: newCondition,
                    status: newStatus,
                    note: note || `Update theo sự cố và phiếu đền bù: ${resolution}`,
                    handled_by,
                }
            );
            if (!replyCreate.success) throw new Error(replyCreate.message);
            
            const reply = await this.eventBus.request(
                EQUIPMENT_EVENTS.UPDATE_INTERNAL,
                { 
                    equipmentId: equipment_id,
                    updateData: {
                        condition: newCondition,
                        status: newStatus
                    }
                }
            );
            if (!reply.success) 
                throw new Error(reply.message);
            // await this.EquipmentLog.findOneAndUpdate(
            //     { equipment_id, end_time: null }, 
            //     { end_time: now }
            // ).session(session);

            // await this.EquipmentLog.create({
            //     room_id: equipment.room_id || null, equipment_id, condition: newCondition, status: newStatus,
            //     start_time: now, end_time: null, note: note || `Update theo sự cố và phiếu đền bù: ${resolution}`, handled_by,
            // });
            
            return { equipment_id, condition: newCondition, status: newStatus };

        } catch (error) {
            console.log("Error in updating equipment by resolution: ", error.message);
            throw error;
        }
    };

    // helper
    populateReporterAndCauser = async (incidents) => {
        const isArray = Array.isArray(incidents);
        const list = isArray ? incidents : [incidents];

        const allUserIds = [...new Set(
            list.flatMap(i => [
                i.reporter_id?.toString(),
                i.causer_id?.toString()
            ]).filter(Boolean)
        )];

        if (allUserIds.length === 0)
            return isArray ? list : list[0];

        const replyUsers = await this.eventBus.request(
            USER_EVENTS.GET_USERS_INFO,
            { userIds: allUserIds }
        );

        const roleMap = {};
        for (const user of replyUsers.users) {
            roleMap[user._id.toString()] = user.system_role;
        }

        const employeeIds = allUserIds.filter(id => ["employee", "manager"].includes(roleMap[id]));
        const customerIds = allUserIds.filter(id => roleMap[id] === "customer");

        const [employeeMap, customerMap] = await Promise.all([
            // Employee
            (async () => {
                const map = {};
                if (employeeIds.length === 0) return map;
                const reply = await this.eventBus.request(
                    EMPLOYEE_EVENTS.GET_INFOS_USERIDS,
                    { employee_user_ids: employeeIds }
                );
                if (!reply.success)
                    throw new Error(reply.message);

                for (const emp of reply.employees) {
                    const key = emp.user_id?.toString();
                    map[key] = {
                        full_name: emp.full_name, 
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
                    CUSTOMER_EVENTS.GET_INFOS_USERIDS,
                    { customerUserIds: customerIds }
                );
                if (!reply.success)
                    throw new Error(reply.message);

                for (const cus of reply.customers) {
                    const key = cus.user_id?.toString();
                    map[key] = {
                        full_name: cus.full_name,
                        phone_number: cus.phone_number
                    };
                }
                return map;
            })(),
        ]);

        // console.log("employeeMap keys:", Object.keys(employeeMap));
        // console.log("customerMap keys:", Object.keys(customerMap));

        const getProfile = (userId) => {
            if (!userId) 
                return null;

            const id = userId.toString();
            const role = roleMap[id];

            if (role === "employee" || role === "manager") {
                return { ...employeeMap[id], system_role: role } || null;
            }
            if (role === "customer") {
                return { ...customerMap[id], system_role: role } || null;
            }

            return null;
        };

        const results = list.map(incident => ({
            ...incident,
            reporter_info: getProfile(incident.reporter_id),
            causer_info: getProfile(incident.causer_id),
        }));

        return isArray ? results : results[0];
    };

    populateRoom = async (incidents) => {
        const isArray = Array.isArray(incidents);
        const list = isArray ? incidents : [incidents];

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
            if (!reply.success)
                throw new Error(reply.message);

            for (const room of reply.rooms) {
                roomMap[room._id.toString()] = {
                    _id: room._id,
                    room_number: room.room_number,
                    room_status: room.room_status
                }
            }
        }

        const results = list.map(incident => ({
            ...incident,
            room_info: roomMap[incident.room_id?.toString()] || null
        }));

        return isArray ? results : results[0];
    };
}