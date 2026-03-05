import mongoose from "mongoose";

const MAX_DAYS = 30;

export class IncidentService {
  constructor({ Incident, Room, Equipment, User, Employee, CompensateTicket, IncidentLog, resolveUserFullName, reevaluateRoomStatus }) {
    this.Incident = Incident;
    this.Room = Room;
    this.Equipment = Equipment;
    this.User = User;
    this.Employee = Employee;
    this.CompensateTicket = CompensateTicket;
    this.IncidentLog = IncidentLog;
    this.resolveUserFullName = resolveUserFullName;
    this.reevaluateRoomStatus = reevaluateRoomStatus;
  }

    async createIncident(reporterId, data) {
        try {
            const { room_id, booking_id, causer_id, caused_by, description, type, severity, occured_at, equipment_ids } = data;
            const reporter_id = reporterId;

            if (!description || !type || !caused_by || !severity || !occured_at) {
                throw new Error("Thiếu thông tin bắt buộc.");
            }

            if (room_id) {
                const room = await this.Room.findById(room_id);
                if (!room) throw new Error("Phòng không tồn tại.");
            }

            if (equipment_ids && Array.isArray(equipment_ids) && equipment_ids.length > 0) {
                for (const eqId of equipment_ids) {
                    if (!mongoose.Types.ObjectId.isValid(eqId)) {
                        throw new Error(`Equipment ID không hợp lệ: ${eqId}`);
                    }
                    const equipment = await this.Equipment.findById(eqId);
                    if (!equipment) {
                        throw new Error(`Không tìm thấy thiết bị với ID: ${eqId}`);
                    }
                }
            }

            const occuredDate = new Date(occured_at);
            const diffDays = (Date.now() - occuredDate.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays > MAX_DAYS) 
                throw new Error("Sự cố đã xảy ra quá 30 ngày.");

            const incident = await this.Incident.create({
                room_id: room_id || null, 
                reporter_id, 
                causer_id: causer_id || null, 
                booking_id: booking_id || null,
                equipment_ids: equipment_ids && Array.isArray(equipment_ids) ? equipment_ids : [],
                description, 
                type, 
                caused_by, 
                severity, 
                occured_at, 
                status: "new", 
                compensation_status: "none",
            });

            await incident.save();
            return incident;

        } catch (err) {
            console.log(err);
            throw err;
        }
    };

    async updateIncident(incidentId, updates, actorId) {
        try {
            const incident = await this.Incident.findById(incidentId);
            if (!incident) throw new Error("Không tìm thấy sự cố.");
            
            if (incident.status === "closed") 
                throw new Error("Không thể cập nhật sự cố đã đóng.");

            const actor = await this.Employee.findOne({ user_id: actorId });
            if (!actor) throw new Error("Người thực hiện không tồn tại.");

            if (updates.processing_note !== undefined) {
                incident.processing_note = updates.processing_note;
            }

            if (incident.status === "new") {
                if (updates.room_id) incident.room_id = updates.room_id;
                if (updates.booking_id) incident.booking_id = updates.booking_id;
                if (updates.causer_id) incident.causer_id = updates.causer_id;
                if (updates.type) incident.type = updates.type;
                if (updates.severity) incident.severity = updates.severity;
                if (updates.caused_by) incident.caused_by = updates.caused_by;
                if (updates.status) incident.status = updates.status;
            } else {
            // Cho phép update status và assignee khi không phải "new"
            if (updates.status) incident.status = updates.status;
                if (updates.assignee && updates.department) {
                    const assignee = await this.Employee.findById(updates.assignee);
                    if (assignee) {
                        incident.assignee_info = {
                            assignee_id: assignee._id,
                            assignee_name: assignee.full_name,
                            assignee_department: updates.department,
                            assigned_at: incident.assignee_info?.assigned_at || new Date(),
                        };
                    }
                }
            }

            await incident.save();

            await this.IncidentLog.create({
                incident_id: incident._id, action: "updated", from_status: incident.status, to_status: updates.status || null,
                actor_id: actor._id, actor_name: actor.full_name, actor_role: actor.position, 
                note: updates.processing_note ? "Cập nhật ghi chú xử lý" : "Cập nhật thông tin sự cố"
            });

            return incident;

        } catch (error) {
            console.log(error);
            throw error;
        }
    };

    async assignIncident(actorId, incidentId, assigneeId, note) {
        try {
            if (!mongoose.Types.ObjectId.isValid(assigneeId) || !mongoose.Types.ObjectId.isValid(incidentId)) {
                throw new Error("ID không hợp lệ");
            }

            const incident = await Incident.findById(incidentId);
            if (!incident) throw new Error("Không tìm thấy sự cố");
            
            if (["resolved", "closed"].includes(incident.status)) {
                throw new Error("Không thể phân công sự cố đã xử lý xong");
            }

            const assignee = await Employee.findById(assigneeId);
            const actor = await Employee.findOne({ user_id: actorId });
            if (!assignee || !actor) 
                throw new Error("Không tìm thấy nhân viên.");

            const prevStatus = incident.status;

            incident.assignee_info = {
                assignee_id: assignee._id, assignee_name: assignee.full_name, 
                assignee_role: assignee.position, assigned_at: new Date(),
            };
            incident.status = "in_progress";
            if (note) incident.processing_note = note; 
            await incident.save();

            // ghi log
            await this.IncidentLog.create({
                incident_id: incident._id, action: "assigned", from_status: prevStatus, to_status: "in_progress",
                actor_id: actor._id, actor_name: actor.full_name, actor_role: actor.position, 
                note: note || "Phân công xử lý sự cố",
            });

            return incident;

        } catch (error) {
            console.log(error);
            throw error;
        }
    };

    async resolveIncident(userId, incidentId, note) {
        try {
            const user = await this.User.findById(userId);
            const actor = await this.Employee.findOne({ user_id: userId });

            if (!note) throw new Error("Thiếu ghi chú xử lý.");

            const incident = await this.Incident.findById(incidentId);
            if (!incident) throw new Error("Không tìm thấy sự cố.");

            if (incident.status !== "in_progress") {
                throw new Error("Sự cố chưa được phân công hoặc đã đóng.");
            }

            if (user.system_role === "employee") {
                const assignee_id = incident.assignee_info?.assignee_id;
                if (!assignee_id || assignee_id.toString() !== actor._id.toString()) {
                    throw new Error("Bạn không được phân công xử lý sự cố này.");
                }
            }

            const oldStatus = incident.status;

            incident.status = "resolved";
            incident.resolved_at = new Date();
            incident.processing_note = note; 
            await incident.save();

            await this.IncidentLog.create({
                incident_id: incident._id,
                action: "resolved",
                from_status: oldStatus,
                to_status: "resolved",
                actor_id: actor._id,
                actor_name: actor.full_name,
                actor_role: actor.position,
                note: note || "Nhân viên xác nhận đã xử lý xong."
            });

            return incident;

        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    async closedIncident(userId, incidentId, note) {
        try {
            const actor = await this.Employee.findOne({ user_id: userId });
            if (!actor) 
                throw new Error("Người thực hiện không tồn tại.");

            if (!note) throw new Error("Thiếu ghi chú xử lý.");

            const incident = await this.Incident.findById(incidentId);
            if (!incident) throw new Error("Không tìm thấy sự cố.");

            if (incident.caused_by !== "other") {
                if (incident.compensation_status !== "done") {
                    throw new Error("Chưa thể đóng sự cố khi quy trình đền bù chưa kết thúc.");
                }
            }

            if (incident.status !== "resolved") 
                throw new Error("Chỉ đóng được sự cố đã Resolved.");

            const oldStatus = incident.status;
            incident.status = "closed";
            incident.closed_at = new Date();
            if (note) incident.processing_note = note; 
            await incident.save();

            if (incident.room_id) 
                await this.reevaluateRoomStatus(incident.room_id);

            await this.IncidentLog.create({
                incident_id: incident._id, action: "closed", from_status: oldStatus, to_status: "closed",
                actor_id: actor._id, actor_name: actor.full_name, actor_role: actor.position, note: note || "Đóng hồ sơ sự cố."
            });

            return { success: true };
        } catch (err) {
            console.log(err);
            throw err;
        }
    };

    async getAllIncidents(userId, query = {}) {
        try {
            const { status, severity, compensation_status, room_id, type, caused_by } = query;
            
            const user = await this.User.findById(userId);
            const employee = await this.Employee.findOne({ user_id: userId });

            const filter = {};
            if (user.system_role !== 'manager' && user.system_role !== 'admin') {
                filter.$or = [
                    { reporter_id: userId },
                    { "assignee_info.assignee_id": employee?._id }
                ];
            }
            if (status) filter.status = status;
            if (severity) filter.severity = severity;
            if (compensation_status) filter.compensation_status = compensation_status;
            if (room_id) filter.room_id = room_id;
            if (type) filter.type = type;
            if (caused_by) filter.caused_by = caused_by;

            const incidents = await this.Incident.find(filter)
                .populate("room_id", "room_number").populate("reporter_id", "system_role").populate("causer_id", "system_role")
                .sort({ created_at: -1 });

            // Lấy tất cả incident_ids để check compensate_ticket
            const incidentIds = incidents.map(inc => inc._id);
            const compensateTickets = await this.CompensateTicket.find({ incident_id: { $in: incidentIds } })
                .select("incident_id _id")
                .lean();
            
            // Tạo map incident_id -> compensate_ticket_id
            const compensateMap = {};
            compensateTickets.forEach(ticket => {
                const incidentId = ticket.incident_id?.toString() || ticket.incident_id;
                compensateMap[incidentId] = ticket._id;
            });

            const result = [];
            for (const incident of incidents) {
                const reporterProfile = await this.resolveUserFullName(incident.reporter_id);
                const causerProfile = await this.resolveUserFullName(incident.causer_id);

                const incidentId = incident._id.toString();
                const hasCompensateTicket = !!compensateMap[incidentId];

                result.push({
                    ...incident.toObject(),
                    reporter_name: reporterProfile?.full_name || null,
                    causer_name: causerProfile?.full_name || null,
                    has_compensate_ticket: hasCompensateTicket,
                    compensate_ticket_id: compensateMap[incidentId] || null,
                });
            }

            return result;
        } catch (error) {
            console.log(error);
            throw error;
        }
    };

    async getIncidentById(incidentId) {
        try {
            const incident = await this.Incident.findById(incidentId)
                .select("-__v")
                .populate("room_id", "room_number")
                .populate("booking_id")
                .populate("reporter_id", "system_role")
                .populate("causer_id", "system_role");

            if (!incident) {
                throw new Error("Không tìm thấy sự cố.");
            }

            const reporterProfile = await this.resolveUserFullName(incident.reporter_id);
            const causerProfile = await this.resolveUserFullName(incident.causer_id);

            // Kiểm tra xem đã có phiếu đền bù chưa
            const compensateTicket = await this.CompensateTicket.findOne({ incident_id: incidentId })
                .select("_id status");

            return { 
                data: {
                    ...incident.toObject(),
                    reporter_name: reporterProfile?.full_name || null,
                    causer_name: causerProfile?.full_name || null,
                    has_compensate_ticket: !!compensateTicket,
                    compensate_ticket_id: compensateTicket?._id || null,
                }
            };

        } catch (error) {
            console.log(error);
            throw error;
        }
    };

    async deleteIncident(incidentId) {
        try {
            const incident = await this.Incident.findById(incidentId);
            if (!incident) {
                throw new Error("Không tìm thấy sự cố.");
            }

            const compensationExists = await this.CompensateTicket.exists({ incident_id: incidentId });
            if (compensationExists) {
                throw new Error("Không thể xóa sự cố vì đã có phiếu đền bù.");
            }

            await this.Incident.findByIdAndDelete(incidentId);
            await this.CompensateTicket.findOneAndDelete({ incident_id: incidentId });
            
            return { success: true };
        } catch (error) {
            console.log(error);
            throw error;
        }
    };
}