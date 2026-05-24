import mongoose from "mongoose";
import { ROOM_EVENTS } from "../../../shared/events/roomEvents.js";
import { EQUIPMENT_EVENTS } from "../../../shared/events/equipmentEvents.js";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";
import { CUSTOMER_EVENTS } from "../../../shared/events/customerEvents.js";
import { cache, makeCacheKey } from "../../../shared/utils/cache.js";

const MAX_DAYS = 30;

export class IncidentService {
    constructor({ Incident, IncidentLog, CompensateTicket, eventBus }) {
        this.Incident = Incident;
        this.CompensateTicket = CompensateTicket;
        this.IncidentLog = IncidentLog;
        this.eventBus = eventBus;
    }

    // helper

    getEmployeeByUserId = async (employeeUserId) => {
        const reply = await this.eventBus.safeRequest(
            EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
            { employee_user_id: employeeUserId }
        );

        if (!reply.success)
            throw new Error(reply.message || "Không tìm thấy nhân viên.");
        
        return reply.employee;
    };
 
    getEmployeeById = async (employeeId) => {
        const reply = await this.eventBus.safeRequest(
            EMPLOYEE_EVENTS.CHECK_EXISTS,
            { employee_id: employeeId }
        );

        if (!reply.success)
            throw new Error(reply.message || "Không tìm thấy nhân viên.");
        
        return reply.employee;
    };

    getUserById = async (userId) => {
        const replyUser = await this.eventBus.safeRequest(
            USER_EVENTS.GET_USER_INFO,
            { userId }
        );
        if (!replyUser.success) 
            throw new Error(replyUser.message || "Không tìm thấy người dùng.");
        
        return replyUser.user;
    };

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

        const replyUsers = await this.eventBus.safeRequest(
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
                const reply = await this.eventBus.safeRequest(
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
                const reply = await this.eventBus.safeRequest(
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
            const reply = await this.eventBus.safeRequest(
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

    // main business logic

    async createIncident(reporterId, data) {
        try {
            const { room_id, booking_id, causer_id, caused_by, description, 
                type, severity, occured_at, equipment_ids } = data;
            const reporter_id = reporterId;

            if (!description || !type || !caused_by || !severity || !occured_at) {
                throw new Error("Thiếu thông tin bắt buộc.");
            }

            if (room_id) {
                const reply = await this.eventBus.safeRequest(
                    ROOM_EVENTS.CHECK_EXISTS,
                    { room_id }
                );
                if (!reply.success) 
                    throw new Error(reply.message || "Phòng không tồn tại.");
            }

            if (equipment_ids && Array.isArray(equipment_ids) && equipment_ids.length > 0) {
                const reply = await this.eventBus.safeRequest(
                    EQUIPMENT_EVENTS.CHECK_EQUIPMENTS_EXISTS,
                    { equipmentIds: equipment_ids }
                );

                if (!reply.success) {
                    throw new Error(reply.message || "Thiết bị bị sự cố không hợp lệ.");
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
            await Promise.all([
                cache.delByPattern("incident:list:*"),
                cache.delByPattern("incident:tasks:*"),
            ]);
            return incident;

        } catch (err) {
            console.log("Error in creating new incident: ", err.message);
            throw err;
        }
    };

    async updateIncident(incidentId, updates, actorId) {
        try {
            const incident = await this.Incident.findById(incidentId);
            if (!incident) 
                throw new Error("Không tìm thấy sự cố.");
            
            if (incident.status === "closed") 
                throw new Error("Không thể cập nhật sự cố đã đóng.");

            const actor = await this.getEmployeeByUserId(actorId);

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
                    const assignee = await this.getEmployeeById(updates.assignee);
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
            await Promise.all([
                cache.del(`incident:one:${incidentId}`),
                cache.delByPattern("incident:list:*"),
                cache.delByPattern("incident:tasks:*"),
            ]);

            await this.IncidentLog.create({
                incident_id: incident._id,
                action: "updated",
                from_status: incident.status, 
                to_status: updates.status || null,
                actor_id: actor._id, 
                actor_name: actor.full_name, 
                actor_role: actor.position, 
                note: updates.processing_note ? "Cập nhật ghi chú xử lý" : "Cập nhật thông tin sự cố"
            });

            return incident;

        } catch (error) {
            console.log("Error in updating incident: ", error.message);
            throw error;
        }
    };

    async assignIncident(actorId, incidentId, assigneeId, note) {
        try {
            if (!mongoose.Types.ObjectId.isValid(assigneeId) || !mongoose.Types.ObjectId.isValid(incidentId)) {
                throw new Error("ID không hợp lệ");
            }

            const incident = await this.Incident.findById(incidentId);
            if (!incident) 
                throw new Error("Không tìm thấy sự cố");
            
            if (["resolved", "closed"].includes(incident.status)) {
                throw new Error("Không thể phân công sự cố đã xử lý xong");
            }

            const [assignee, actor] = await Promise.all([
                this.getEmployeeById(assigneeId),
                this.getEmployeeByUserId(actorId),
            ]);

            const prevStatus = incident.status;
            incident.assignee_info = {
                assignee_id: assignee._id, 
                assignee_name: assignee.full_name, 
                assignee_role: assignee.position, 
                assigned_at: new Date(),
            };

            incident.status = "in_progress";
            if (note) incident.processing_note = note;
            await incident.save();
            await Promise.all([
                cache.del(`incident:one:${incidentId}`),
                cache.delByPattern("incident:list:*"),
                cache.delByPattern("incident:tasks:*"),
            ]);

            // ghi log
            await this.IncidentLog.create({
                incident_id: incident._id,
                action: "assigned",
                from_status: prevStatus, 
                to_status: "in_progress",
                actor_id: actor._id, 
                actor_name: actor.full_name, 
                actor_role: actor.position, 
                note: note || "Phân công xử lý sự cố",
            });

            return incident;

        } catch (error) {
            console.log("Error in assigning employee for incident: ", error.message);
            throw error;
        }
    };

    async resolveIncident(userId, incidentId, data) {
        try {
            const { note } = data;

            if (!note) throw new Error("Thiếu ghi chú xử lý.");

            const [user, actor, incident] = await Promise.all([
                this.getUserById(userId),
                this.getEmployeeByUserId(userId),
                this.Incident.findById(incidentId),
            ]);
            if (!incident)
                throw new Error("Không tìm thấy sự cố.");

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
            await Promise.all([
                cache.del(`incident:one:${incidentId}`),
                cache.delByPattern("incident:list:*"),
                cache.delByPattern("incident:tasks:*"),
            ]);

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
            console.log("Error in resolving incident: ", err.message);
            throw err;
        }
    };

    async closedIncident(userId, incidentId, data) {
        try {
            const { note } = data;
            const actor = await this.getEmployeeByUserId(userId);

            if (!note) throw new Error("Thiếu ghi chú xử lý.");

            const incident = await this.Incident.findById(incidentId);
            if (!incident) 
                throw new Error("Không tìm thấy sự cố.");

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
            await Promise.all([
                cache.del(`incident:one:${incidentId}`),
                cache.delByPattern("incident:list:*"),
                cache.delByPattern("incident:tasks:*"),
            ]);

            // if (incident.room_id) 
            //     await this.reevaluateRoomStatus(incident.room_id);

            await this.IncidentLog.create({
                incident_id: incident._id, 
                action: "closed", 
                from_status: oldStatus, 
                to_status: "closed",
                actor_id: actor._id, 
                actor_name: actor.full_name, 
                actor_role: actor.position, 
                note: note || "Đóng hồ sơ sự cố."
            });

            return { success: true };
        } catch (err) {
            console.log("Error in closing incident: ", err.message);
            throw err;
        }
    };

    async getAllIncidents(userId, query = {}) {
        try {
            const cacheKey = makeCacheKey("incident:list", { userId, ...query });
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const { status, severity, compensation_status, room_id, type, caused_by, booking_id } = query;

            const [user, employee] = await Promise.all([
                this.getUserById(userId),
                this.getEmployeeByUserId(userId),
            ]);

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
                .sort({ created_at: -1 }).lean();

            const populatedIncidents = await this.populateReporterAndCauser(incidents);
            const finalIncidents = await this.populateRoom(populatedIncidents);

            const incidentIds = finalIncidents.map(inc => inc._id);
            const compensateTickets = await this.CompensateTicket.find({ incident_id: { $in: incidentIds } })
                .select("incident_id _id").lean();

            const compensateMap = {};
            compensateTickets.forEach(ticket => {
                compensateMap[ticket.incident_id.toString()] = ticket._id;
            });

            const result = finalIncidents.map(incident => {
                const incidentId = incident._id.toString();
                return {
                    ...incident,
                    reporter_name: incident.reporter_info?.full_name || null,
                    causer_name: incident.causer_info?.full_name || null,
                    has_compensate_ticket: !!compensateMap[incidentId],
                    compensate_ticket_id: compensateMap[incidentId] || null,
                };
            });

            await cache.set(cacheKey, result, 60);
            return result;

        } catch (error) {
            console.log("Error in getting all incidents: ", error.message);
            throw error;
        }
    };

    async getAllIncidentsForTasks(query = {}) {
        try {
            const cacheKey = makeCacheKey("incident:tasks", query);
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const { status, severity, type, caused_by } = query;
            const filter = {};
            if (status) filter.status = status;
            if (severity) filter.severity = severity;
            if (type) filter.type = type;
            if (caused_by) filter.caused_by = caused_by;

            const incidents = await this.Incident.find(filter)
                .sort({ created_at: -1 }).lean();

            const roomIds = [...new Set(incidents.map(i => i.room_id?.toString()).filter(Boolean))];
            const reporterIds = [...new Set(incidents.map(i => i.reporter_id?.toString()).filter(Boolean))];
            const assigneeIds = [...new Set(
                incidents.map(i => i.assignee_info?.assignee_id?.toString()).filter(Boolean)
            )];

            const [roomReply, reporterReply, assigneeReply] = await Promise.all([
                roomIds.length ? this.eventBus.safeRequest(ROOM_EVENTS.GET_ROOMS_INFO, { room_ids: roomIds }) : Promise.resolve({ success: false }),
                reporterIds.length ? this.eventBus.safeRequest(USER_EVENTS.GET_USERS_INFO, { userIds: reporterIds }) : Promise.resolve({ success: false }),
                assigneeIds.length ? this.eventBus.safeRequest(EMPLOYEE_EVENTS.GET_INFO, { employee_ids: assigneeIds }) : Promise.resolve({ success: false }),
            ]);

            const roomMap = {};
            if (roomReply.success) {
                for (const room of roomReply.rooms) {
                    roomMap[room._id.toString()] = { _id: room._id, room_number: room.room_number };
                }
            }

            const reporterMap = {};
            if (reporterReply.success) {
                for (const user of reporterReply.users) {
                    reporterMap[user._id.toString()] = { _id: user._id, email: user.email };
                }
            }

            const assigneeMap = {};
            if (assigneeReply.success) {
                for (const emp of assigneeReply.employees) {
                    assigneeMap[emp._id.toString()] = { _id: emp._id, full_name: emp.full_name, phone_number: emp.phone_number };
                }
            }

            const result = incidents.map(incident => {
                const roomId = incident.room_id?.toString();
                const reporterId = incident.reporter_id?.toString();
                const assigneeId = incident.assignee_info?.assignee_id?.toString();

                return {
                    ...incident,
                    room_id: roomId ? (roomMap[roomId] || incident.room_id) : null,
                    reporter_id: reporterId ? (reporterMap[reporterId] || incident.reporter_id) : null,
                    assignee_info: incident.assignee_info ? {
                        ...incident.assignee_info,
                        assignee_id: assigneeId ? (assigneeMap[assigneeId] || incident.assignee_info.assignee_id) : null,
                    } : null,
                };
            });

            await cache.set(cacheKey, result, 60);
            return result;

        } catch (error) {
            console.log("Error in getAllIncidentsForTasks: ", error.message);
            throw error;
        }
    };

    async getIncidentById(incidentId) {
        try {
            const cacheKey = `incident:one:${incidentId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const incident = await this.Incident.findById(incidentId)
                .select("-__v").lean();
                // .populate("booking_id")

            if (!incident) {
                throw new Error("Không tìm thấy sự cố.");
            }

            const populatedIncident = await this.populateRoom(incident);
            const finalIncident = await this.populateReporterAndCauser(populatedIncident);
            console.log("FINAL INCIDENT: ", finalIncident);
            const compensateTicket = await this.CompensateTicket.findOne({ incident_id: incidentId }).select("_id status");

            const response = {
                data: {
                    ...finalIncident,
                    reporter_name: finalIncident.reporter_info?.full_name || null,
                    causer_name: finalIncident.causer_info?.full_name || null,
                    has_compensate_ticket: !!compensateTicket,
                    compensate_ticket_id: compensateTicket?._id || null,
                }
            };
            await cache.set(cacheKey, response, 60);
            return response;

        } catch (error) {
            console.log("Error in getting incident by id: ", error.message);
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
            await Promise.all([
                cache.del(`incident:one:${incidentId}`),
                cache.delByPattern("incident:list:*"),
                cache.delByPattern("incident:tasks:*"),
            ]);

            return { success: true };
        } catch (error) {
            console.log("Error in deleting incident: ", error.message);
            throw error;
        }
    };
}