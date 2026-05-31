import mongoose from "mongoose";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";
import { ROOM_EVENTS } from "../../../shared/events/roomEvents.js";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";
import { BOOKING_EVENTS } from "../../../shared/events/bookingEvents.js";
import { CUSTOMER_EVENTS } from "../../../shared/events/customerEvents.js";
import { EQUIPMENT_EVENTS } from "../../../shared/events/equipmentEvents.js";
import { INCIDENT_EVENTS } from "../../../shared/events/incidentEvents.js";
import { cache, makeCacheKey } from "../../../shared/utils/cache.js";

export class CleaningService {
    constructor({ CleaningTask, eventBus, sendNotification, sendNotificationsToUsers }) {
        this.CleaningTask = CleaningTask;
        this.eventBus = eventBus;
        this.sendNotification = sendNotification;
        this.sendNotificationsToUsers = sendNotificationsToUsers;
    }

    createTaskFromBooking = async ({ room_id, room_log_id, booking_id, note }) => {
        const existing = await this.CleaningTask.findOne({ room_log_id });
        if (existing) return existing;

        const task = await this.CleaningTask.create({
            room_id,
            room_log_id,
            booking_id: booking_id || null,
            status: "pending",
            note: note || "",
        });

        return task;
    };

    // helper

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
    };

    findEmployeeByUserId = async (employeeUserId) => {
        const reply = await this.eventBus.safeRequest(
            EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
            { employee_user_id: employeeUserId }
        );

        if (!reply.success) throw new Error(reply.message);
        return reply.employee;
    }

    findEmployeeById = async (employeeId) => {
        const reply = await this.eventBus.safeRequest(
            EMPLOYEE_EVENTS.CHECK_EXISTS,
            { employee_id: employeeId }
        );

        if (!reply.success) throw new Error(reply.message);
        return reply.employee;
    }

    findRoomById = async (roomId) => {
        const replyRoom = await this.eventBus.safeRequest(
            ROOM_EVENTS.CHECK_EXISTS,
            { room_id: roomId }
        );
        if (!replyRoom.success) throw new Error(replyRoom.message);
        return replyRoom.room;
    }

    invalidateTaskCaches = async (roomId = null) => {
        const ops = [
            cache.del("cleaning:housekeepers:available"),
            cache.delByPattern("cleaning:tasks:all:*"),
            cache.delByPattern("cleaning:tasks:my:*"),
        ];
        if (roomId) {
            ops.push(cache.delByPattern(`cleaning:task:room:${roomId}:*`));
        }
        await Promise.all(ops);
    };

    // main logic

    getAvailableHousekeepers = async () => {
        try {
            const cacheKey = "cleaning:housekeepers:available";
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const replyHousekeepers = await this.eventBus.safeRequest(
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

            const result = { count: availableHousekeepers.length, housekeepers: availableHousekeepers };
            await cache.set(cacheKey, result, 30);
            return result;

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
            
            if (hasHandledBy && task.handled_by.toString() !== handledBy) {
                if (task.status !== "pending") {
                    throw new Error("Không thể thay đổi nhân viên khi công việc đã bắt đầu");
                }
            }
            
            if (hasHandledBy && task.status !== "pending") {
                throw new Error("Công việc đã được gán và đang xử lý");
            }

            const replyHousekeepers = await this.eventBus.safeRequest(
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
                handled_by: handledBy,
                status: { $in: ["pending", "in_progress"] },
                _id: { $ne: task._id }
            });

            if (activeTask) {
                throw new Error("Nhân viên này đang có công việc đang xử lý");
            }

            task.handled_by = housekeeper._id;
            task.status = "pending";

            await task.save();
            await this.invalidateTaskCaches(task.room_id?.toString());

            const replyUpdateLog = await this.eventBus.safeRequest(
                ROOM_EVENTS.UPDATE_ROOM_LOG, 
                {
                    filter: { _id: roomLogId },
                    updateData: { handled_by: housekeeper._id }
                }
            );
            if (!replyUpdateLog.success) throw new Error(replyUpdateLog.message);

            try {
                const [room, { managerUsers, managerUserIds }] = await Promise.all([
                    this.findRoomById(task.room_id),
                    this.findManagersByIds(),
                ]);
                const roomNumber = room?.room_number || "N/A";
                const roomCategoryName = room?.category_id?.name || "";
                const roomInfo = roomCategoryName ? `${roomNumber} (${roomCategoryName})` : roomNumber;

                const notifPromises = [];
                if (managerUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Công việc dọn dẹp mới",
                        content: `Nhân viên ${housekeeper.full_name} đã được chỉ định dọn dẹp phòng ${roomInfo}`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    }));
                }
                if (housekeeper.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: housekeeper.user_id,
                        title: "Công việc dọn dẹp mới",
                        content: `Bạn được gán dọn dẹp phòng ${roomInfo}`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    }));
                }
                await Promise.all(notifPromises);
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
            const [employee, task] = await Promise.all([
                this.findEmployeeByUserId(userId),
                this.CleaningTask.findById(taskId),
            ]);
            if (!employee) {
                throw new Error("Không tìm thấy thông tin nhân viên");
            }
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
            await this.invalidateTaskCaches(task.room_id?.toString());

            try {
                const roomNumber = room?.room_number || "N/A";
                const roomCategoryName = room?.category_id?.name || "";
                const roomInfo = roomCategoryName ? `${roomNumber} (${roomCategoryName})` : roomNumber;

                const { managerUsers, managerUserIds } = await this.findManagersByIds();

                const notifPromises = [];
                if (managerUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Công việc dọn dẹp đã được bắt đầu",
                        content: `Phòng ${roomNumber} đã được nhân viên ${employee.full_name} xác nhận bắt đầu làm.`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    }));
                }
                if (employee.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: employee.user_id,
                        title: "Công việc dọn dẹp đã bắt đầu",
                        content: `Bạn đã xác nhận bắt đầu dọn dẹp phòng ${roomInfo}`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    }));
                }
                await Promise.all(notifPromises);
            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            return task;

        } catch (error) {
            console.log("Error in starting cleaning task service: ", error.message);
            throw error;
        }
    };
    
    completeCleaningTask = async (taskId, userId, images = []) => {
        try {
            const [employee, task] = await Promise.all([
                this.findEmployeeByUserId(userId),
                this.CleaningTask.findById(taskId),
            ]);
            if (!employee) {
                throw new Error("Không tìm thấy thông tin nhân viên");
            }
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
            if (images.length > 0) {
                task.completion_images = images;
            }
            await task.save();
            await this.invalidateTaskCaches(task.room_id?.toString());

            try {
                const roomNumber = room?.room_number || "N/A";
                const roomCategoryName = room?.category_id?.name || "";
                const roomInfo = roomCategoryName ? `${roomNumber} (${roomCategoryName})` : roomNumber;

                const { managerUsers, managerUserIds } = await this.findManagersByIds();

                const notifPromises = [];
                if (managerUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Công việc dọn dẹp đã hoàn thành",
                        content: `Phòng ${roomNumber} đã được dọn dẹp xong. Vui lòng xác nhận.`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    }));
                }
                if (employee.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: employee.user_id,
                        title: "Công việc dọn dẹp đã hoàn thành",
                        content: `Bạn đã xác nhận hoàn thành việc dọn dẹp phòng ${roomInfo}`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    }));
                }
                await Promise.all(notifPromises);
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

            const [room, employee] = await Promise.all([
                this.findRoomById(task.room_id),
                this.findEmployeeByUserId(userId),
            ]);
            if (!room) {
                throw new Error("Không tìm thấy phòng");
            }
            if (!employee) {
                throw new Error("Không tìm thấy thông tin nhân viên");
            }

            task.status = "confirmed";
            task.confirmed_at = new Date();
            await task.save();
            await this.invalidateTaskCaches(task.room_id?.toString());

            const now = new Date();
            const roomId = task.room_id;
            const roomLogId = task.room_log_id;

            const replyUpdateLog = await this.eventBus.safeRequest(
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

            const replyInsertLog = await this.eventBus.safeRequest(
                ROOM_EVENTS.INSERT_ROOM_LOG, 
                {
                    data: roomLog
                }
            );
            if (!replyInsertLog.success) throw new Error(replyInsertLog.message);
    
            const replyUpdateRoom = await this.eventBus.safeRequest(
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

                const notifPromises = [];
                if (managerUserIds.length > 0) {
                    notifPromises.push(this.sendNotificationsToUsers({
                        userIds: managerUserIds,
                        title: "Công việc dọn dẹp đã được xác nhận hoàn thành",
                        content: `Phòng ${roomNumber} đã được xác nhận hoàn thành dọn dẹp.`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    }));
                }
                if (employee.user_id) {
                    notifPromises.push(this.sendNotification({
                        userId: employee.user_id,
                        title: "Công việc dọn dẹp đã được xác nhận hoàn thành",
                        content: `Quản lý đã xác nhận hoàn thành việc dọn dẹp phòng ${roomInfo} của bạn`,
                        type: "room",
                        kind: "CleaningTask",
                        refId: task._id,
                    }));
                }
                await Promise.all(notifPromises);
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

            const cacheKey = makeCacheKey("cleaning:tasks:all", {
                type: type || null,
                status: status || null,
            });
            const cached = await cache.get(cacheKey);
            if (cached) return cached;
            const shouldFetch = (taskType) => !type || type === 'all' || type === taskType;

            const fetchCleaning = async () => {
                if (!shouldFetch('cleaning')) return [];
                const filter = status ? { status } : {};
                const cleaningRaw = await this.CleaningTask.find(filter).sort({ created_at: -1 }).lean();

                const roomIds = [...new Set(cleaningRaw.map(t => t.room_id?.toString()).filter(Boolean))];
                const employeeIds = [...new Set(cleaningRaw.map(t => t.handled_by?.toString()).filter(Boolean))];
                const bookingIds = [...new Set(cleaningRaw.map(t => t.booking_id?.toString()).filter(Boolean))];

                const [roomReply, employeeReply, bookingReply] = await Promise.all([
                    roomIds.length ? this.eventBus.safeRequest(ROOM_EVENTS.GET_ROOMS_INFO, { room_ids: roomIds }) : Promise.resolve({ success: false }),
                    employeeIds.length ? this.eventBus.safeRequest(EMPLOYEE_EVENTS.GET_INFO, { employee_ids: employeeIds }) : Promise.resolve({ success: false }),
                    bookingIds.length ? this.eventBus.safeRequest(BOOKING_EVENTS.GET_BOOKINGS_BY_IDS, { bookingIds }) : Promise.resolve({ success: false }),
                ]);

                const roomMap = {};
                if (roomReply.success) {
                    for (const room of roomReply.rooms) {
                        roomMap[room._id.toString()] = { _id: room._id, room_number: room.room_number, category_id: room.category_id };
                    }
                }

                const employeeMap = {};
                if (employeeReply.success) {
                    for (const emp of employeeReply.employees) {
                        employeeMap[emp._id.toString()] = { _id: emp._id, full_name: emp.full_name, phone_number: emp.phone_number };
                    }
                }

                const bookingMap = {};
                if (bookingReply.success) {
                    const customerIds = [...new Set(bookingReply.bookings.map(b => b.customer_id?.toString()).filter(Boolean))];
                    let customerMap = {};
                    if (customerIds.length) {
                        const replyCustomers = await this.eventBus.safeRequest(CUSTOMER_EVENTS.GET_INFOS_IDS, { customerIds });
                        if (replyCustomers.success) {
                            for (const cus of replyCustomers.customers) {
                                customerMap[cus._id.toString()] = cus;
                            }
                        }
                    }
                    for (const booking of bookingReply.bookings) {
                        const customerId = booking.customer_id?.toString();
                        bookingMap[booking._id.toString()] = {
                            ...booking,
                            customer: customerId ? (customerMap[customerId] || null) : null
                        };
                    }
                }

                return cleaningRaw.map(t => {
                    const booking = t.booking_id ? bookingMap[t.booking_id.toString()] : null;
                    return {
                        ...t,
                        task_type: "cleaning",
                        room_id: t.room_id ? (roomMap[t.room_id.toString()] || null) : null,
                        handled_by: t.handled_by ? (employeeMap[t.handled_by.toString()] || null) : null,
                        booking_info: booking ? {
                            customer_name: booking.customer?.full_name,
                            customer_phone: booking.customer?.phone_number,
                            checkin: booking.expected_checkin,
                            checkout: booking.expected_checkout,
                            status: booking.status
                        } : null
                    };
                });
            };

            const fetchInstall = async () => {
                if (!shouldFetch('install')) return [];
                try {
                    const reply = await this.eventBus.safeRequest(
                        EQUIPMENT_EVENTS.GET_ALL_INSTALL_TICKETS,
                        status ? { status } : {}
                    );
                    if (reply.success) {
                        return (reply.installs || []).map(t => ({
                            ...t,
                            task_type: "install",
                            room_id: t.room_info || null,
                            handled_by: t.handler_info || null,
                        }));
                    }
                } catch (err) {
                    console.error("Failed to fetch install tasks:", err.message);
                }
                return [];
            };

            const fetchImport = async () => {
                if (!shouldFetch('equipment_import')) return [];
                try {
                    const reply = await this.eventBus.safeRequest(
                        EQUIPMENT_EVENTS.GET_ALL_IMPORT_TICKETS,
                        status ? { status } : {}
                    );
                    if (reply.success) {
                        return (reply.tickets || []).map(t => ({
                            ...t,
                            task_type: "equipment_import",
                            employee_id: t.employee_info || null,
                            import_details: (t.import_details || []).map(d => ({
                                ...d,
                                quantity: d.import_quantity,
                                total_import_price: (d.import_price || 0) * (d.import_quantity || 0)
                            }))
                        }));
                    }
                } catch (err) {
                    console.error("Failed to fetch import tasks:", err.message);
                }
                return [];
            };

            const fetchIncident = async () => {
                if (!shouldFetch('incident')) return [];
                try {
                    const reply = await this.eventBus.safeRequest(
                        INCIDENT_EVENTS.GET_ALL_INCIDENTS_INTERNAL,
                        status ? { status } : {}
                    );
                    if (reply.success) {
                        return (reply.incidents || []).map(t => ({
                            ...t,
                            task_type: "incident",
                        }));
                    }
                } catch (err) {
                    console.error("Failed to fetch incident tasks:", err.message);
                }
                return [];
            };

            const [cleaningTasks, installTasks, importTasks, incidentTasks] = await Promise.all([
                fetchCleaning(),
                fetchInstall(),
                fetchImport(),
                fetchIncident(),
            ]);

            const tasks = [...cleaningTasks, ...installTasks, ...importTasks, ...incidentTasks];
            tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            await cache.set(cacheKey, tasks, 30);
            return tasks;

        } catch (error) {
            console.error("GetAllTasks Error:", error);
            throw error;
        }
    };
    
    getCleaningTaskByRoomS = async (query = {}) => {
        try {
            const { room_id, booking_id } = query;
            if (!room_id && !booking_id) {
                throw new Error("Cần cung cấp room_id hoặc booking_id");
            }

            const cacheKey = `cleaning:task:room:${room_id || ""}:${booking_id || ""}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;
            
            const filter = {};
            if (room_id) filter.room_id = room_id;
            if (booking_id) filter.booking_id = booking_id;
            
            const task = await this.CleaningTask.findOne(filter).sort({ created_at: -1 });
            
            // Nếu không có task, tìm room_log_id từ RoomLog
            let room_log_id = null;
            if (!task && room_id) {
                const replyLog = await this.eventBus.safeRequest(
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

            const result = { task, room_log_id, employee };
            await cache.set(cacheKey, result, 60);
            return result;

        } catch (error) {
            console.error("getCleaningTaskByRoom Error:", error);
            throw error;
        }
    };
    
    getMyCleaningTasks = async (userId) => {
        try {
            const cacheKey = `cleaning:tasks:my:${userId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

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

            const reply = await this.eventBus.safeRequest(
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

            await cache.set(cacheKey, tasksWithRoomInfo, 60);
            return tasksWithRoomInfo;

        } catch (error) {
            console.error("getMyCleaningTasks Error:", error);
            throw error;
        }
    };
}