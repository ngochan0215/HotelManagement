import mongoose from "mongoose";

export class CompensateService {
    constructor({ CompensateTicket, CompensateDetail, Incident, IncidentLog, Employee, 
        User, Receipt, Equipment, EquipmentCategory, EquipmentLog, resolveUserFullName }) 
    {
        this.CompensateTicket = CompensateTicket;
        this.CompensateDetail = CompensateDetail;
        this.Incident = Incident;
        this.Employee = Employee;
        this.IncidentLog = IncidentLog;
        this.User = User;
        this.Receipt = Receipt;
        this.Equipment = Equipment;
        this.EquipmentCategory = EquipmentCategory;
        this.EquipmentLog = EquipmentLog;
        this.resolveUserFullName = resolveUserFullName;
    }

    async createCompensateTicket (userId, incidentId, data) {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();

            const { payer_type, payer_id, compensation_details, note } = data;
            const actor = await this.Employee.findOne({ user_id: userId });
        
            if ( !payer_type || !compensation_details ) {
                throw new Error("Yêu cầu nhập đầy đủ thông tin (payer_type, compensation_details).");
            }
        
            const incident = await this.Incident.findById(incidentId).session(session);
            if (!incident) {
                throw new Error("Sự cố không tồn tại.");
            }
        
            if (!payer_id) payer_id = incident.causer_id;
        
            if (incident.compensation_status !== "none") {
                throw new Error("Sự cố đã có phiếu đền bù.");
            }
        
            const existedTicket = await this.CompensateTicket.findOne({ incidentId }).session(session);
        
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
                    equipment_id: item.equipment_id, resolution: item.resolution, 
                    handled_by: req.user.employee_id, note: `Sự cố ${incident._id}`
                });
            }
        
            // thêm phiếu đền bù
            const ticket = await this.CompensateTicket.create([{
                incident_id: incident._id,
                booking_id: incident.booking_id || null,
                payer_type,
                payer_id: payer_id || null,
                note: note || "",
                compensation_details: details,
                total_fee: totalFee,
                status: "pending"
            }], { session });
        
            const detailDocs = details.map(item => ({
                ticket_id: ticket[0]._id,
                equipment_id: item.equipment_id || null,
                broken_state: item.broken_state,
                resolution: item.resolution,
                penalty_fee: item.penalty_fee,
            }));
        
            await this.CompensateDetail.insertMany(detailDocs, { session });
        
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
            await incident.save({ session });

            await session.commitTransaction();
            return ticket[0];

        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            session.endSession();
        }
    };
    
    async createCompensateTicketOther (incidentId, userId, data) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { payer_type, payer_id, total_fee, note } = data;
            const actor = await Employee.findOne({ user_id: userId });
    
            if ( !payer_type || !total_fee ) {
            throw new Error("Yêu cầu nhập đầy đủ thông tin.");
            }
        
            const incident = await this.Incident.findById(incidentId).session(session);
            if (!incident) {
                throw new Error("Sự cố không tồn tại.");
            }
        
            if (!payer_id) payer_id = incident.causer_id;
        
            if (incident.compensation_status !== "none") {
                throw new Error("Sự cố đã có phiếu đền bù.");
            }
        
            const existedTicket = await this.CompensateTicket.findOne({ incident_id }).session(session);
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
        
            const ticket = await this.CompensateTicket.create([{
                incident_id: incident._id,
                booking_id: incident.booking_id || null,
                payer_type,
                payer_id: payer_id || null,
                note: note || "",
                total_fee: total_fee,
                status: "pending"
            }], { session });
        
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
        
            // cập nhật tình trạng sự cố
            incident.compensation_status = "pending";
            await incident.save({ session });
            await session.commitTransaction();
            return ticket[0];

        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            session.endSession();
        }
    };
    
    async getAllCompensateTickets (query = {}) {
        try {
            const { status, incident_id } = query;
            const filter = {};
            if (status) filter.status = status;
            if (incident_id) filter.incident_id = incident_id;
    
            const compensations = await this.CompensateTicket.find(filter)
                .select("-__v -updated_at")
                .populate({
                    path: "incident_id", select: "-__v -updated_at -created_at",
                    populate: [
                    { path: "room_id", select: "room_number _id" },
                    { path: "reporter_id", select: "system_role" },
                    { path: "causer_id", select: "system_role" },
                    ],
                })
                .populate({
                    path: "compensation_details.equipment_id",
                    select: "condition status",
                    populate: {
                    path: "category_id",
                    select: "name price",
                    },
                })
                .sort({ created_at: -1 });
    
            const result = [];
            for (const ticket of compensations) {
                const incident = ticket.incident_id;
                let reporter_name = null; let causer_name = null;
                if (incident?.reporter_id) {
                    const reporterProfile = await this.resolveUserFullName(incident.reporter_id);
                    reporter_name = reporterProfile?.full_name || null;
                }
                if (incident?.causer_id) {
                    const causerProfile = await this.resolveUserFullName(incident.causer_id);
                    causer_name = causerProfile?.full_name || null;
                }
    
                // Kiểm tra xem ticket có trong receipt chưa thanh toán không
                let isInReceipt = false;
                let receiptStatus = null;
                if (ticket.booking_id) {
                    const receipt = await this.Receipt.findOne({
                        booking_id: ticket.booking_id,
                        compensate_ticket_id: ticket._id
                    }).select("status");
                
                    if (receipt) {
                        isInReceipt = true;
                        receiptStatus = receipt.status;
                    } else {
                        // Nếu không tìm thấy bằng compensate_ticket_id, tìm bằng booking_id và compensate_fee > 0
                        const receiptByBooking = await this.Receipt.findOne({
                            booking_id: ticket.booking_id,
                            compensate_fee: { $gt: 0 },
                            status: { $in: ["pending", "half-paid"] }
                        }).select("status");
                        
                        if (receiptByBooking) {
                            isInReceipt = true;
                            receiptStatus = receiptByBooking.status;
                        }
                    }
                }
    
                result.push({
                    ...ticket.toObject(),
                    incident: incident
                    ? {
                        reporter_name,
                        causer_name,
                    }
                    : null,
                    is_in_receipt: isInReceipt,
                    receipt_status: receiptStatus,
                });
            }

            return result;
    
        } catch (error) { 
            console.log(error);
            throw error;
        }
    };
    
    async getCompensateTicketById (ticketId) {
        try {
            const compensation = await this.CompensateTicket.findById(ticketId)
                .select("-__v")
                .populate({
                    path: "incident_id", select: "-__v -updated_at -created_at",
                    populate: [
                    { path: "room_id", select: "room_number" },
                    { path: "reporter_id", select: "system_role" },
                    { path: "causer_id", select: "system_role" },
                    ],
                })
                .populate({
                    path: "compensation_details.equipment_id",
                    populate: {
                    path: "category_id",
                    select: "name price",
                    },
                });
        
            if (!compensation)
                throw new Error("Không tìm thấy phiếu đền bù.");
        
            const incident = compensation.incident_id;
            let reporter_name = null; let causer_name = null;
            
            if (incident?.reporter_id) {
                const reporterProfile = await this.resolveUserFullName(incident.reporter_id);
                reporter_name = reporterProfile?.full_name || null;
            }
            if (incident?.causer_id) {
                const causerProfile = await this.resolveUserFullName(incident.causer_id);
                causer_name = causerProfile?.full_name || null;
            }
        
            return {
                data: {
                    ...compensation.toObject(),
                    incident: incident
                    ? {
                        reporter_name,
                        causer_name,
                    }
                    : null,
                },
            };
        } catch (error) {
            console.log(error);
            throw error;
        }
    };
    
    async updateCompensateTicket (ticketId, updates) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const ticket = await this.CompensateTicket.findById(ticketId).session(session);
            if (!ticket) {
                throw new Error("Không tìm thấy phiếu đền bù.");
            }
        
            if (ticket.status !== "pending") 
                throw new Error("Chỉ có thể cập nhật phiếu đền bù khi đang ở trạng thái pending.");
        
            // chặn các field không được phép update
            const forbiddenFields = ["incident_id", "status", "paid_at", "created_at"];
        
            for (const field of forbiddenFields) {
                if (field in updates) 
                    throw new Error(`Không được phép cập nhật trường ${field}.`);
            }
        
            if (ticket.incident_id) {
                const incident = await this.Incident.findById(ticket.incident_id).session(session);
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
        
            // Update handler (nhân viên xử lý)
            if (updates.handled_by) {
                const handler = await this.User.findById(updates.handled_by);
                if (!handler) {
                    throw new Error("Nhân viên xử lý không tồn tại.");
                }
            }
        
            Object.assign(ticket, updates);
            await ticket.save({ session });
            await session.commitTransaction();
            return ticket;

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.log(error);
            throw error;
        }
    };
    
    async confirmCompensationPaid (userId, ticketId, note) {
        const session = await mongoose.startSession();
        session.startTransaction();
        
        try {
            const actor = await this.Employee.findOne({ user_id: userId });
        
            const ticket = await this.CompensateTicket.findById(ticketId).session(session).populate("incident_id");
            if (!ticket) 
                throw new Error("Không tìm thấy phiếu đền bù.");
            if (ticket.status !== "pending")
                throw new Error("Chỉ có thể xác nhận thanh toán cho phiếu đền bù đang ở trạng thái pending.");
        
            const incident = await this.Incident.findById(ticket.incident_id).session(session);
            if (!incident) 
                throw new Error("Không tìm thấy sự cố liên quan.");
        
            ticket.status = "paid";
            await ticket.save({ session });
        
            const oldStatus = incident.status;
            incident.status = "closed";
            incident.compensation_status = "done";
            incident.closed_at = new Date();
            await incident.save({ session });
        
            await this.IncidentLog.create({
                incident_id: incident._id, action: "compensation_paid_closed", from_status: oldStatus, to_status: "closed",
                actor_id: actor._id, actor_name: actor.full_name, actor_role: actor.position, 
                note: note || "Xác nhận đã thanh toán và đóng sự cố."
            });
        
            await this.reevaluateRoomStatus(ticket.room_id);
        
            await session.commitTransaction();
            return { success: true };

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.log(error);
            throw error;
        }
    };

    async buildCompensationDetails (detailsInput, incident) {
        let totalFee = 0;
        const details = [];
        const room_id = incident.room_id;
    
        for (const item of detailsInput) {
            const equipment = await this.Equipment.findById(item.equipment_id);
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
    };

    async calculatePenaltyFee ({ equipment_id, broken_state, resolution }) {
        const equipment = await this.Equipment.findById(equipment_id);
        if (!equipment) throw new Error("Thiết bị không tồn tại.");
        
        const category = await this.EquipmentCategory.findById(equipment.category_id);
        if (!category) throw new Error("Danh mục thiết bị không tồn tại.");
        
        const originalPrice = category.price;
        const rateTable = {
            scratched: { repair: 0.1, discard: 0.3 },
            cracked: { repair: 0.3, discard: 0.5 },
            broken: { repair: 0.5, discard: 0.8 },
            lost: { discard: 1.2 },
            unusable: { discard: 0.8 }
        };
        const rate = rateTable[broken_state]?.[resolution] ?? 0;
        return { penalty_fee: Math.round(originalPrice * rate), price: originalPrice };
    };
    
    async updateEquipmentByResolution ({ equipment_id, resolution, handled_by = null, note = "", session = null }) {
        const now = new Date();
        const equipment = await this.Equipment.findById(equipment_id).session(session);
        if (!equipment) 
            throw new Error("Thiết bị không tồn tại.");
        
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
        
        await this.EquipmentLog.findOneAndUpdate(
            { equipment_id, end_time: null }, 
            { end_time: now }
        ).session(session);

        await this.EquipmentLog.create({
            room_id: equipment.room_id || null, equipment_id, condition: newCondition, status: newStatus,
            start_time: now, end_time: null, note: note || `Update theo sự cố và phiếu đền bù: ${resolution}`, handled_by,
        });
        
        equipment.condition = newCondition;
        equipment.status = newStatus;
        await equipment.save({ session });

        return { equipment_id, condition: newCondition, status: newStatus };
    };
}