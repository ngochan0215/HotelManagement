import mongoose from "mongoose";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";
import { ROOM_EVENTS } from "../../../shared/events/roomEvents.js";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";

export class CleaningService {
    constructor({ CleaningTask, eventBus, sendNotification, sendNotificationsToUsers }) {
        this.CleaningTask = CleaningTask;
        this.eventBus = eventBus;
        this.sendNotification = sendNotification;
        this.sendNotificationsToUsers = sendNotificationsToUsers;
    }

    // helper

    findManagersByIds = async () => {
        const replyManager = await this.eventBus.request(
            USER_EVENTS.GET_MANAGERS
        );

        let managerUsers, managerUserIds;
        if (replyManager.success) {
            managerUsers = replyManager.managers;
            managerUserIds = managerUsers.map(u => u._id);
        }

        return { managerUsers, managerUserIds };
    };

    findEmployeeByUserId = async (employeeUserId) => {
        const reply = await this.eventBus.request(
            EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
            { employee_user_id: employeeUserId }
        );

        if (!reply.success) throw new Error(reply.message);
        return reply.employee;
    }

    findEmployeeById = async (employeeId) => {
        const reply = await this.eventBus.request(
            EMPLOYEE_EVENTS.CHECK_EXISTS,
            { employee_id: employeeId }
        );

        if (!reply.success) throw new Error(reply.message);
        return reply.employee;
    }

    findRoomById = async (roomId) => {
        const replyRoom = await this.eventBus.request(
            ROOM_EVENTS.CHECK_EXISTS,
            { room_id: roomId }
        );
        if (!replyRoom.success) throw new Error(replyRoom.message);
        return replyRoom.room;
    }

    // main logic

    getAvailableHousekeepers = async () => {
        try {
            const replyHousekeepers = await this.eventBus.request(
                EMPLOYEE_EVENTS.GET_AVAILABLE_HOUSEKEEPERS,
                {}
            );
            
            if (!replyHousekeepers.success) throw new Error(replyHousekeepers.message);
            const housekeepers = replyHousekeepers.housekeepers;

            const activeTasks = await this.CleaningTask.find({
                handled_by: { $exists: true, $ne: null },
                status: { $in: ["pending", "in_progress"] }
            }).select("handled_by");

            const busyEmployeeIds = new Set(
                activeTasks.map(task => task.handled_by?.toString()).filter(Boolean)
            );

            // filter free housekeepers
            const availableHousekeepers = housekeepers
                .filter(hk => {
                    const employeeId = hk._id.toString();
                    return !busyEmployeeIds.has(employeeId);
                })
                .map(hk => ({
                    _id: hk._id,
                    employee_id: hk._id,
                    full_name: hk.full_name,
                    phone_number: hk.phone_number,
                    user_id: hk.user_id
                }));

            return { count: availableHousekeepers.length, housekeepers: availableHousekeepers };

        } catch (error) {
            console.log("Error in getting available housekeepers: ", error.message);
            throw error;
        }
    };

    assignCleaningTask = async (roomLogId, handledBy) => {
        try {
            if (!roomLogId || !handledBy)
                throw new Error("Thiếu room_log_id hoặc handled_by");
            
            const task = await this.CleaningTask.findOne({ room_log_id: roomLogId });
            if (!task)
                throw new Error("Không tìm thấy công việc dọn dẹp.");

            const hasHandledBy = task.handled_by && 
                (typeof task.handled_by === 'object' ? task.handled_by._id : task.handled_by);
            
            if (hasHandledBy && task.handled_by.toString() !== handled_by) {
                if (task.status !== "pending") {
                    throw new Error("Không thể thay đổi nhân viên khi công việc đã bắt đầu");
                }
            }
            
            if (hasHandledBy && task.status !== "pending") {
                throw new Error("Công việc đã được gán và đang xử lý");
            }

            const replyHousekeepers = await this.eventBus.request(
                EMPLOYEE_EVENTS.GET_AVAILABLE_HOUSEKEEPERS,
                {}
            );
            
            if (!replyHousekeepers.success) throw new Error(replyHousekeepers.message);
            const housekeepers = replyHousekeepers.housekeepers;

            const housekeeper = housekeepers.find(hk => hk._id.toString() === handledBy.toString());
            if (!housekeeper) {
                throw new Error("Nhân viên dọn dẹp không hợp lệ");
            }

            const activeTask = await this.CleaningTask.findOne({
                handled_by: handled_by,
                status: { $in: ["pending", "in_progress"] },
                _id: { $ne: task._id }
            });

            if (activeTask) {
                throw new Error("Nhân viên này đang có công việc đang xử lý");
            }

            task.handled_by = housekeeper._id;
            task.status = "pending";
            
            await task.save();

            const replyUpdateLog = await this.eventBus.request(
                ROOM_EVENTS.UPDATE_ROOM_LOG, 
                {
                    filter: { _id: roomLogId },
                    updateData: { handled_by: housekeeper._id }
                }
            );
            if (!replyUpdateLog.success) throw new Error(replyUpdateLog.message);

            try {
                const room = await this.findRoomById(task.room_id);
                const roomNumber = room?.room_number || "N/A";
                const roomCategoryName = room?.category_id?.name || "";
                const roomInfo = roomCategoryName ? `${roomNumber} (${roomCategoryName})` : roomNumber;

                const { managerUsers, managerUserIds } = await this.findManagersByIds();
                if (managerUserIds.length > 0) {
                    await this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Công việc dọn dẹp mới",
                        content: `Nhân viên ${housekeeper.full_name} đã được chỉ định dọn dẹp phòng ${roomInfo}`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    });
                }

                // gửi thông báo cho nhân viên
                if (housekeeper.user_id) {
                    await this.sendNotification({
                        userId: housekeeper.user_id,
                        title: "Công việc dọn dẹp mới",
                        content: `Bạn được gán dọn dẹp phòng ${roomInfo}`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    });
                }
            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            return task;

        } catch (error) {
            console.log("Error in assigning cleaning task: ", error.message);
            throw error;
        }
    };

    startCleaningTask = async (taskId, userId) => {        
        try {
            const employee = await this.findEmployeeByUserId(userId);
            if (!employee) {
                throw new Error("Không tìm thấy thông tin nhân viên");
            }
    
            const task = await this.CleaningTask.findById(taskId);
            if (!task) {
                throw new Error("Không tìm thấy công việc");
            }
    
            const room = await this.findRoomById(task.room_id);
            if (!room) {
                throw new Error("Không tìm thấy phòng");
            }
    
            if (task.handled_by?.toString() !== employee._id.toString()) {
                throw new Error("Bạn không được gán công việc này");
            }
    
            if (task.status !== "pending") {
                throw new Error("Công việc không ở trạng thái pending");
            }
    
            task.status = "in_progress";
            task.started_at = new Date();
            await task.save();
    
            try {
                const roomNumber = room?.room_number || "N/A";
                const roomCategoryName = room?.category_id?.name || "";
                const roomInfo = roomCategoryName ? `${roomNumber} (${roomCategoryName})` : roomNumber;
    
                const { managerUsers, managerUserIds } = await this.findManagersByIds();
                
                if (managerUserIds.length > 0) {
                    await this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Công việc dọn dẹp đã được bắt đầu",
                        content: `Phòng ${roomNumber} đã được nhân viên ${employee.full_name} xác nhận bắt đầu làm.`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    });
                }
    
                if (employee.user_id) {
                    await this.sendNotification({
                        userId: employee.user_id,
                        title: "Công việc dọn dẹp đã bắt đầu",
                        content: `Bạn đã xác nhận bắt đầu dọn dẹp phòng ${roomInfo}`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    });
                }
            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }
    
            return task;
    
        } catch (error) {
            console.log("Error in starting cleaning task service: ", error.message);
            throw error;
        }
    };
    
    completeCleaningTask = async (taskId, userId) => {        
        try {    
            const employee = await this.findEmployeeByUserId(userId);
            if (!employee) {
                throw new Error("Không tìm thấy thông tin nhân viên");
            }
    
            const task = await this.CleaningTask.findById(taskId);
            if (!task) {
                throw new Error("Không tìm thấy công việc");
            }
    
            const room = await this.findRoomById(task.room_id);
            if (!room) {
                throw new Error("Không tìm thấy phòng");
            }
    
            if (task.handled_by?.toString() !== employee._id.toString()) {
                throw new Error("Bạn không được gán công việc này");
            }
    
            if (task.status !== "in_progress") {
                throw new Error("Công việc chưa được bắt đầu");
            }
    
            task.status = "completed";
            task.completed_at = new Date();
            await task.save();

            try {
                const roomNumber = room?.room_number || "N/A";
                const roomCategoryName = room?.category_id?.name || "";
                const roomInfo = roomCategoryName ? `${roomNumber} (${roomCategoryName})` : roomNumber;
    
                const { managerUsers, managerUserIds } = await this.findManagersByIds();
                
                if (managerUserIds.length > 0) {
                    await this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Công việc dọn dẹp đã hoàn thành",
                        content: `Phòng ${roomNumber} đã được dọn dẹp xong. Vui lòng xác nhận.`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    });
                }
    
                if (employee.user_id) {
                    await this.sendNotification({
                        userId: employee.user_id,
                        title: "Công việc dọn dẹp đã hoàn thành",
                        content: `Bạn đã xác nhận hoàn thành việc dọn dẹp phòng ${roomInfo}`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    });
                }
            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }
    
            return task;
    
        } catch (error) {
            console.log("Error in completing cleaning task service: ", error.message);
            throw error;
        }
    };
    
    confirmCleaningTask = async (taskId, userId) => {  
        try {    
            const task = await this.CleaningTask.findById(taskId);
            if (!task) {
                throw new Error("Không tìm thấy công việc");
            }
    
            if (task.status !== "completed") {
                throw new Error("Công việc chưa được hoàn thành bởi nhân viên");
            }
    
            if (!task.completed_at) {
                throw new Error("Công việc chưa được hoàn thành bởi nhân viên");
            }

            const room = await this.findRoomById(task.room_id);
            if (!room) {
                throw new Error("Không tìm thấy phòng");
            }

            const employee = await this.findEmployeeByUserId(userId);
            if (!employee) {
                throw new Error("Không tìm thấy thông tin nhân viên");
            }
    
            task.status = "confirmed";
            task.confirmed_at = new Date();
            await task.save();
    
            const now = new Date();
            const roomId = task.room_id;
            const roomLogId = task.room_log_id;

            const replyUpdateLog = await this.eventBus.request(
                ROOM_EVENTS.UPDATE_ROOM_LOG, 
                {
                    filter: { _id: roomLogId },
                    updateData: { end_time: now }
                }
            );
            if (!replyUpdateLog.success) throw new Error(replyUpdateLog.message);
    
            const roomLog = {
                room_id: roomId,
                status: "available",
                start_time: now,
                end_time: null,
                note: `Phòng đã được dọn dẹp và sẵn sàng`,
            };

            const replyInsertLog = await this.eventBus.request(
                ROOM_EVENTS.INSERT_ROOM_LOG, 
                {
                    data: roomLog
                }
            );
            if (!replyInsertLog.success) throw new Error(replyInsertLog.message);
    
            const replyUpdateRoom = await this.eventBus.request(
                ROOM_EVENTS.UPDATE_ROOM_INFO, 
                {
                    filter: { _id: roomId },
                    updateData: { 
                        room_status: "available",
                        start_time: now,
                        end_time: null, 
                    }
                }
            );
            if (!replyUpdateRoom.success) throw new Error(replyUpdateRoom.message);

            try {
                const roomNumber = room?.room_number || "N/A";
                const roomCategoryName = room?.category_id?.name || "";
                const roomInfo = roomCategoryName ? `${roomNumber} (${roomCategoryName})` : roomNumber;
    
                const { managerUsers, managerUserIds } = await this.findManagersByIds();
                
                if (managerUserIds.length > 0) {
                    await this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Công việc dọn dẹp đã được xác nhận hoàn thành",
                        content: `Phòng ${roomNumber} đã được xác nhận hoàn thành dọn dẹp.`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    });
                }
    
                if (employee.user_id) {
                    await this.sendNotification({
                        userId: employee.user_id,
                        title: "Công việc dọn dẹp đã được xác nhận hoàn thành",
                        content: `Quản lý đã xác nhận hoàn thành việc dọn dẹp phòng ${roomInfo} của bạn`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    });
                }
            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }
    
            return task;
    
        } catch (error) {
            console.log("Error in confirming cleaning task service: ", error.message);
            throw error;
        }
    };
    
    getAllTasks = async (query = {}) => {
        try {
            const { type, status } = query;
            // type: 'cleaning' | 'install' | 'equipment_import' | 'product_import' | 'incident' | 'all'
    
            const tasks = [];
    
            // Cleaning tasks
            if (!type || type === 'all' || type === 'cleaning') {
                const cleaningTasks = await this.CleaningTask.find(status ? { status } : {})
                    .populate("room_id", "room_number category_id")
                    .populate("handled_by", "full_name phone_number")
                    .populate({
                        path: "booking_id",
                        select: "expected_checkin expected_checkout status", // Lấy ngày giờ
                        populate: {
                            path: "customer_id",
                            select: "full_name phone_number email" // Lấy tên khách
                        }
                    })
                    .sort({ created_at: -1 });
    
                tasks.push(...cleaningTasks.map(t => {
                    const taskObj = t.toObject();
                    return {
                        ...taskObj,
                        task_type: "cleaning",
                        booking_info: t.booking_id ? {
                            customer_name: t.booking_id.customer_id?.full_name,
                            customer_phone: t.booking_id.customer_id?.phone_number,
                            checkin: t.booking_id.expected_checkin,
                            checkout: t.booking_id.expected_checkout,
                            status: t.booking_id.status
                        } : null
                    };
                }));
            }
    
            // Equipment install tasks
            if (!type || type === 'all' || type === 'install') {
                const installTasks = await EquipmentInstall.find(status ? { status } : {})
                    .populate("room_id", "room_number")
                    .populate("handled_by", "full_name phone_number")
                    .sort({ created_at: -1 })
                    .lean();
    
                // Lấy install_details cho từng install task
                const installIds = installTasks.map(t => t._id);
                const installDetails = await InstallDetail.find({ install_id: { $in: installIds } })
                    .populate({
                        path: "equipment_id",
                        populate: { path: "category_id", select: "name description" },
                        select: "category_id condition status code"
                    })
                    .lean();
    
                // Group install_details theo install_id
                const detailsMap = {};
                installDetails.forEach(detail => {
                    const installId = detail.install_id.toString();
                    if (!detailsMap[installId]) detailsMap[installId] = [];
                    detailsMap[installId].push(detail);
                });
    
                tasks.push(...installTasks.map(t => ({
                    ...t,
                    task_type: "install",
                    install_details: detailsMap[t._id.toString()] || []
                })));
            }
    
            // Equipment import tickets
            if (!type || type === 'all' || type === 'equipment_import') {
                const equipmentTickets = await EquipmentTicket.find(status ? { status } : {})
                    .populate("employee_id", "full_name phone_number")
                    .sort({ created_at: -1 })
                    .lean();
    
                // Lấy import details cho từng ticket
                const ticketIds = equipmentTickets.map(t => t._id);
                const equipmentImports = await EquipmentImport.find({ ticket_id: { $in: ticketIds } })
                    .populate("category_id", "name description")
                    .lean();
    
                // Group imports theo ticket_id
                const importsMap = {};
                equipmentImports.forEach(imp => {
                    const ticketId = imp.ticket_id.toString();
                    if (!importsMap[ticketId]) importsMap[ticketId] = [];
                    importsMap[ticketId].push(imp);
                });
    
                tasks.push(...equipmentTickets.map(t => ({
                    ...t,
                    task_type: "equipment_import",
                    import_details: importsMap[t._id.toString()] || []
                })));
            }
    
            // Product import tickets (GoodTicket)
            if (!type || type === 'all' || type === 'product_import') {
                const goodTickets = await GoodTicket.find(status ? { status } : {})
                    .populate("employee_id", "full_name phone_number")
                    .sort({ created_at: -1 })
                    .lean();
    
                // Lấy import details cho từng ticket
                const ticketIds = goodTickets.map(t => t._id);
                const goodImports = await GoodImport.find({ ticket_id: { $in: ticketIds } })
                    .populate("service_id", "name description")
                    .lean();
    
                // Group imports theo ticket_id
                const importsMap = {};
                goodImports.forEach(imp => {
                    const ticketId = imp.ticket_id.toString();
                    if (!importsMap[ticketId]) importsMap[ticketId] = [];
                    importsMap[ticketId].push(imp);
                });
    
                tasks.push(...goodTickets.map(t => ({
                    ...t,
                    task_type: "product_import",
                    import_details: importsMap[t._id.toString()] || []
                })));
            }
    
            // Incidents
            if (!type || type === 'all' || type === 'incident') {
                const incidents = await Incident.find(status ? { status } : {})
                    .populate("room_id", "room_number")
                    .populate("reporter_id", "email")
                    .populate("causer_id", "email")
                    .populate("booking_id", "_id")
                    .populate("assignee_info.assignee_id", "full_name phone_number")
                    .sort({ created_at: -1 })
                    .lean();
    
                tasks.push(...incidents.map(t => ({
                    ...t,
                    task_type: "incident"
                })));
            }
    
            // Sắp xếp theo thời gian tạo
            tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            return tasks;
    
        } catch (error) {
            console.error("GetAllTasks Error:", error);
            throw error;
        }
    };
    
    getCleaningTaskByRoomS = async (query = {}) => {
        try {
            const { room_id, booking_id } = query;
            if (!room_id || !booking_id) {
                throw new Error("Cần cung cấp room_id hoặc booking_id");
            }
            
            const filter = {};
            if (room_id) filter.room_id = room_id;
            if (booking_id) filter.booking_id = booking_id;
            
            const task = await this.CleaningTask.findOne(filter).sort({ created_at: -1 });
            
            // Nếu không có task, tìm room_log_id từ RoomLog
            let room_log_id = null;
            if (!task && room_id) {
                const replyLog = await this.eventBus.request(
                    ROOM_EVENTS.FIND_ROOM_LOGS,
                    {
                        filter: {
                            room_id: room_id,
                            status: "cleaning",
                            booking_id: booking_id
                        },
                        opts: { 
                            sort: { created_at: -1 },
                            limit: 1
                        }
                    }
                );
                if (!replyLog.success) throw new Error(replyLog.message);
    
                if (replyLog.roomLog) {
                    room_log_id = replyLog.roomLog._id;
                }
                
            } else if (task && task.room_log_id) {
                room_log_id = task.room_log_id;
            }

            let employee = null;
            if (task?.handled_by) {
                employee = await this.findEmployeeById(task.handled_by);
            }

            return { task, room_log_id, employee };
            
        } catch (error) {
            console.error("getCleaningTaskByRoom Error:", error);
            throw error;
        }
    };
    
    getMyCleaningTasks = async (userId) => {
        try {
            const employee = await this.findEmployeeByUserId(userId);
            if (!employee) {
                throw new Error("Không tìm thấy thông tin nhân viên");
            }

            const tasks = await this.CleaningTask.find({
                handled_by: employee._id
            }).sort({ created_at: -1 });

            const roomIds = [
                ...new Set(tasks.map(task => task.room_id.toString()))
            ];

            const reply = await this.eventBus.request(
                ROOM_EVENTS.GET_ROOMS_INFO,
                { room_ids: roomIds }
            );
            if (!reply.success) throw new Error(reply.message);
            
            const rooms = reply.rooms;

            const roomMap = new Map(
                rooms.map(room => [room._id.toString(), room])
            );

            const tasksWithRoomInfo = tasks.map(task => ({
                ...task.toObject(),
                room: roomMap.get(task.room_id.toString()) || null
            }));

            return tasks;

        } catch (error) {
            console.error("getMyCleaningTasks Error:", error);
            throw error;
        }
    };
}