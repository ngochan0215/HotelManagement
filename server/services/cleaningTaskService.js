import mongoose from "mongoose";
import { CleaningTask, Employee, Room, RoomLog, User, 
    EquipmentInstall, InstallDetail, EquipmentTicket, EquipmentImport, 
    GoodTicket, GoodImport, Incident, 
} from "../models/index.js";
import { pushNotificationToUsers, pushNotification } from "../services/notificationService.js";

// return available housekeepers list
export const getAvailableHousekeepersService = async () => {
    const housekeepers = await Employee.find({ 
        position: "housekeeper",
        status: "working"
    })
    .populate("user_id", "email system_role avatar")
    .select("full_name phone_number user_id");

    // find active cleaning tasks that are pending or in_progress
    // only consider tasks that have been assigned (handled_by not null)
    const activeTasks = await CleaningTask.find({
        handled_by: { $exists: true, $ne: null },
        status: { $in: ["pending", "in_progress"] }
    }).select("handled_by");

    // busy housekeepers
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
};

// assign cleaning task to housekeeper
export const assignCleaningTaskService = async (room_log_id, handled_by) => {
    if (!room_log_id || !handled_by)
        throw new Error("Thiếu room_log_id hoặc handled_by");

    const session = await mongoose.startSession();
    
    try {
        session.startTransaction();

        // Tìm cleaning task
        const task = await CleaningTask.findOne({ room_log_id }).session(session);
        if (!task)
            throw new Error("Không tìm thấy công việc dọn dẹp.");

        // Kiểm tra xem task đã có handled_by chưa
        const hasHandledBy = task.handled_by && 
            (typeof task.handled_by === 'object' ? task.handled_by._id : task.handled_by);
        
        // Nếu đã có handled_by và đang thay đổi
        if (hasHandledBy && task.handled_by.toString() !== handled_by) {
            // Chỉ cho phép thay đổi nếu task chưa bắt đầu (status = pending)
            if (task.status !== "pending") {
                throw new Error("Không thể thay đổi nhân viên khi công việc đã bắt đầu");
            }
        }
        
        // Nếu đã có handled_by và status không phải pending, không cho phép gán lại
        if (hasHandledBy && task.status !== "pending") {
            throw new Error("Công việc đã được gán và đang xử lý");
        }

        // Validate nhân viên
        const housekeeper = await Employee.findOne({
            _id: handled_by,
            position: "housekeeper",
            status: "working"
        }).session(session);

        if (!housekeeper) {
            throw new Error("Nhân viên dọn dẹp không hợp lệ");
        }

        // Kiểm tra nhân viên có rảnh không
        const activeTask = await CleaningTask.findOne({
            handled_by: handled_by,
            status: { $in: ["pending", "in_progress"] },
            _id: { $ne: task._id }
        }).session(session);

        if (activeTask) {
            throw new Error("Nhân viên này đang có công việc đang xử lý");
        }

        // Cập nhật task và room log
        task.handled_by = housekeeper._id;
        task.status = "pending"; // Vẫn là pending cho đến khi nhân viên bắt đầu
        
        await task.save({ session });

        // Cập nhật RoomLog
        await RoomLog.findByIdAndUpdate(
            room_log_id,
            { handled_by: housekeeper._id },
            { session }
        );

        await session.commitTransaction();

        //Gửi thông báo 
        try {
            const room = await Room.findById(task.room_id).populate("category_id", "name");
            const roomNumber = room?.room_number || "N/A";
            const roomCategoryName = room?.category_id?.name || "";
            const roomInfo = roomCategoryName ? `${roomNumber} (${roomCategoryName})` : roomNumber;

            // gửi thông báo cho admin
            const allAdmins = await User.find({ system_role: "manager", isBanned: { $ne: true } });
            const adminIds = allAdmins.map(u => u._id);
            if (adminIds.length > 0) {
                await pushNotificationToUsers(
                    adminIds,
                    "Công việc dọn dẹp mới",
                    `Nhân viên ${housekeeper.full_name} đã được chỉ định dọn dẹp phòng ${roomInfo}`,
                    "room",
                    "CleaningTask",
                    task._id,
                    "unread"
                );
            }

            // gửi thông báo cho nhân viên
            if (housekeeper.user_id) {
                await pushNotification(
                    housekeeper.user_id,
                    "Công việc dọn dẹp mới",
                    `Bạn được gán dọn dẹp phòng ${roomInfo}`,
                    "room",
                    "CleaningTask",
                    task._id,
                    "unread"
                );
            }
        } catch (notifError) {
            console.error("Error sending notification:", notifError);
        }

        return task;

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// housekeeper start cleaning task 
export const startCleaningTaskService = async (taskId, userId) => {
    const session = await mongoose.startSession();
    
    try {
        // Tìm employee từ user
        const employee = await Employee.findOne({ user_id: userId }).session(session);
        if (!employee) {
            throw new Error("Không tìm thấy thông tin nhân viên");
        }

        const task = await CleaningTask.findById(taskId).session(session);
        if (!task) {
            throw new Error("Không tìm thấy công việc");
        }

        const room = await Room.findById(task.room_id).populate("category_id", "name");
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
        await task.save({ session });

        await session.commitTransaction();

        // Gửi thông báo cho admin (không ảnh hưởng đến transaction)
        try {
            const roomNumber = room?.room_number || "N/A";
            const roomCategoryName = room?.category_id?.name || "";
            const roomInfo = roomCategoryName ? `${roomNumber} (${roomCategoryName})` : roomNumber;

            const admins = await User.find({ system_role: "manager", isBanned: { $ne: true } });
            const adminIds = admins.map(a => a._id);
            
            if (adminIds.length > 0) {
                await pushNotificationToUsers(
                    adminIds,
                    "Công việc dọn dẹp đã được bắt đầu",
                    `Phòng ${roomNumber} đã được nhân viên ${employee.full_name} xác nhận bắt đầu làm.`,
                    "room",
                    "CleaningTask",
                    task._id,
                    "unread"
                );
            }

            // gửi thông báo cho nhân viên
            if (employee.user_id) {
                await pushNotification(
                    employee.user_id,
                    "Công việc dọn dẹp đã bắt đầu",
                    `Bạn đã xác nhận bắt đầu dọn dẹp phòng ${roomInfo}`,
                    "room",
                    "CleaningTask",
                    task._id,
                    "unread"
                );
            }
        } catch (notifError) {
            console.error("Error sending notification:", notifError);
            // Không throw error để không ảnh hưởng đến response
        }

        return task;

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// housekeeper complete cleaning task
export const completeCleaningTaskService = async (taskId, userId) => {
    const session = await mongoose.startSession();
    
    try {
        const employee = await Employee.findOne({ user_id: userId }).session(session);
        if (!employee) {
            throw new Error("Không tìm thấy thông tin nhân viên");
        }

        const task = await CleaningTask.findById(taskId)
            .populate("room_id", "room_number")
            .session(session);
        
        if (!task) {
            throw new Error("Không tìm thấy công việc");
        }

        if (task.handled_by?.toString() !== employee._id.toString()) {
            throw new Error("Bạn không được gán công việc này");
        }

        if (task.status !== "in_progress") {
            throw new Error("Công việc chưa được bắt đầu");
        }

        task.status = "completed";
        task.completed_at = new Date();
        await task.save({ session });

        await session.commitTransaction();

        // Gửi thông báo cho admin (không ảnh hưởng đến transaction)
        try {
            const room = await Room.findById(task.room_id).populate("category_id", "name");
            const roomNumber = room?.room_number || task.room_id?.room_number || "N/A";
            const roomCategoryName = room?.category_id?.name || "";
            const roomInfo = roomCategoryName ? `${roomNumber} (${roomCategoryName})` : roomNumber;

            const admins = await User.find({ system_role: "manager", isBanned: { $ne: true } });
            const adminIds = admins.map(a => a._id);
            
            if (adminIds.length > 0) {
                await pushNotificationToUsers(
                    adminIds,
                    "Công việc dọn dẹp đã hoàn thành",
                    `Phòng ${roomNumber} đã được dọn dẹp xong. Vui lòng xác nhận.`,
                    "room",
                    "CleaningTask",
                    task._id,
                    "unread"
                );
            }

            // gửi thông báo cho nhân viên
            if (employee.user_id) {
                await pushNotification(
                    employee.user_id,
                    "Công việc dọn dẹp đã hoàn thành",
                    `Bạn đã xác nhận hoàn thành việc dọn dẹp phòng ${roomInfo}`,
                    "room",
                    "CleaningTask",
                    task._id,
                    "unread"
                );
            }
        } catch (notifError) {
            console.error("Error sending notification:", notifError);
            // Không throw error để không ảnh hưởng đến response
        }

        return task;

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// admin confirm cleaning task completion
export const confirmCleaningTaskService = async (taskId, userId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { id } = taskId;

        const task = await CleaningTask.findById(id)
            .populate("room_id", "room_number room_status")
            .populate("room_log_id")
            .session(session);
        
        if (!task) {
            throw new Error("Không tìm thấy công việc");
        }

        if (task.status !== "completed") {
            throw new Error("Công việc chưa được hoàn thành bởi nhân viên");
        }

        if (!task.completed_at) {
            throw new Error("Công việc chưa được hoàn thành bởi nhân viên");
        }

        // Cập nhật task
        task.status = "confirmed";
        task.confirmed_at = new Date();
        await task.save({ session });

        // Đóng RoomLog cleaning
        const now = new Date();
        const roomId = task.room_id._id || task.room_id;
        const roomLogId = task.room_log_id._id || task.room_log_id;
        
        await RoomLog.findByIdAndUpdate(
            roomLogId,
            { end_time: now },
            { session }
        );

        // Tạo RoomLog available mới
        await RoomLog.create(
            [{
                room_id: roomId,
                status: "available",
                start_time: now,
                end_time: null,
                note: `Phòng đã được dọn dẹp và sẵn sàng`,
            }],
            { session }
        );

        // Cập nhật room status
        await Room.findByIdAndUpdate(
            roomId,
            { room_status: "available" },
            { session }
        );

        await session.commitTransaction();

        // Gửi thông báo cho admin (không ảnh hưởng đến transaction)
        try {
            const roomId = task.room_id._id || task.room_id;
            const room = await Room.findById(roomId).populate("category_id", "name");
            const roomNumber = room?.room_number || task.room_id?.room_number || "N/A";
            const roomCategoryName = room?.category_id?.name || "";
            const roomInfo = roomCategoryName ? `${roomNumber} (${roomCategoryName})` : roomNumber;

            const admins = await User.find({ system_role: "manager", isBanned: { $ne: true } });
            const adminIds = admins.map(a => a._id);
            
            if (adminIds.length > 0) {
                await pushNotificationToUsers(
                    adminIds,
                    "Công việc dọn dẹp đã xác nhận hoàn thành",
                    `Phòng ${roomNumber} đã được xác nhận hoàn thành dọn dẹp.`,
                    "room",
                    "CleaningTask",
                    task._id,
                    "unread"
                );
            }

            // gửi thông báo cho nhân viên
            const employee = await Employee.findById(task.handled_by);
            if (employee && employee.user_id) {
                await pushNotification(
                    employee.user_id,
                    "Công việc dọn dẹp đã hoàn thành",
                    `Công việc dọn dẹp phòng ${roomInfo} đã được xác nhận hoàn thành.`,
                    "room",
                    "CleaningTask",
                    task._id,
                    "unread"
                );
            }
        } catch (notifError) {
            console.error("Error sending notification:", notifError);
            // Không throw error để không ảnh hưởng đến response
        }

        return task;

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

// return all tasks
export const getAllTasksService = async (query = {}) => {
    try {
        const { type, status } = query;
        console.log("getAllTasksService query:", query);
        console.log("getAllTasksService type:", type, "status:", status);
        // type: 'cleaning' | 'install' | 'equipment_import' | 'product_import' | 'incident' | 'all'

        const tasks = [];

        // Cleaning tasks
        if (!type || type === 'all' || type === 'cleaning') {
            const cleaningTasks = await CleaningTask.find(status ? { status } : {})
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

// return cleaning task by room_id or booking_id
export const getCleaningTaskByRoomService = async (query = {}) => {
    try {
        const { room_id, booking_id } = query;
        if (!room_id && !booking_id) {
            throw new Error("Cần cung cấp room_id hoặc booking_id");
        }
        
        const filter = {};
        if (room_id) filter.room_id = room_id;
        if (booking_id) filter.booking_id = booking_id;
        
        const task = await CleaningTask.findOne(filter)
            .populate("room_id", "room_number category_id")
            .populate("handled_by", "full_name phone_number")
            .populate("room_log_id")
            .sort({ created_at: -1 });
        
        // Nếu không có task, tìm room_log_id từ RoomLog
        let room_log_id = null;
        if (!task && room_id) {
            const roomLog = await RoomLog.findOne({
                room_id: room_id,
                status: "cleaning",
                booking_id: booking_id || { $exists: true }
            })
            .sort({ created_at: -1 });
            
            if (roomLog) {
                room_log_id = roomLog._id;
            }
        } else if (task && task.room_log_id) {
            room_log_id = task.room_log_id._id || task.room_log_id;
        }

        return { task, room_log_id };
        
    } catch (error) {
        console.error("getCleaningTaskByRoom Error:", error);
        throw error;
    }
};

// return my cleaning tasks (housekeeper)
export const getMyCleaningTasksService = async (userId) => {
    try {
        const employee = await Employee.findOne({ user_id: userId });
        if (!employee) {
            throw new Error("Không tìm thấy thông tin nhân viên");
        }
        
        const tasks = await CleaningTask.find({ handled_by: employee._id })
            .populate("room_id", "room_number category_id")
            .populate("booking_id", "_id")
            .sort({ created_at: -1 });
        
        return tasks;
        
    } catch (error) {
        console.error("getMyCleaningTasks Error:", error);
        throw error;
    }
};
