import mongoose from "mongoose";
import { CleaningTask, Employee, Room, RoomLog, User, 
    EquipmentInstall, InstallDetail, EquipmentTicket, EquipmentImport, 
    GoodTicket, GoodImport, Incident, 
} from "../models/index.js";
import { pushNotificationToUsers, pushNotification } from "../services/notificationService.js";

// Lấy danh sách housekeeper rảnh
export const getAvailableHousekeepers = async (req, res) => {
    try {
        // Tìm tất cả nhân viên dọn dẹp
        const housekeepers = await Employee.find({ 
            position: "housekeeper",
            status: "working"
        })
        .populate("user_id", "email system_role avatar")
        .select("full_name phone_number user_id");

        // Tìm các công việc dọn dẹp đang xử lý (pending hoặc in_progress)
        // Chỉ tính những task đã được gán (handled_by không null) và chưa completed/confirmed
        const activeTasks = await CleaningTask.find({
            handled_by: { $exists: true, $ne: null },
            status: { $in: ["pending", "in_progress"] }
        }).select("handled_by");

        // Lấy danh sách employee_id đang bận
        const busyEmployeeIds = new Set(
            activeTasks.map(task => task.handled_by?.toString()).filter(Boolean)
        );

        // Lọc ra những nhân viên rảnh
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

        res.status(200).json({
            success: true,
            count: availableHousekeepers.length,
            housekeepers: availableHousekeepers
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Lỗi server", 
            error: error.message 
        });
    }
};

// Gán nhân viên dọn dẹp
export const assignCleaningTask = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { room_log_id, handled_by } = req.body;

        if (!room_log_id || !handled_by) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Thiếu thông tin room_log_id hoặc handled_by"
            });
        }

        // Tìm cleaning task
        const task = await CleaningTask.findOne({ room_log_id }).session(session);
        if (!task) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy công việc dọn dẹp"
            });
        }

        // Kiểm tra xem task đã có handled_by chưa
        const hasHandledBy = task.handled_by && 
            (typeof task.handled_by === 'object' ? task.handled_by._id : task.handled_by);
        
        // Nếu đã có handled_by và đang thay đổi
        if (hasHandledBy && task.handled_by.toString() !== handled_by) {
            // Chỉ cho phép thay đổi nếu task chưa bắt đầu (status = pending)
            if (task.status !== "pending") {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: "Không thể thay đổi nhân viên khi công việc đã bắt đầu"
                });
            }
        }
        
        // Nếu đã có handled_by và status không phải pending, không cho phép gán lại
        if (hasHandledBy && task.status !== "pending") {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Công việc đã được gán và đang xử lý"
            });
        }

        // Validate nhân viên
        const housekeeper = await Employee.findOne({
            _id: handled_by,
            position: "housekeeper",
            status: "working"
        }).session(session);

        if (!housekeeper) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Nhân viên dọn dẹp không hợp lệ"
            });
        }

        // Kiểm tra nhân viên có rảnh không
        const activeTask = await CleaningTask.findOne({
            handled_by: handled_by,
            status: { $in: ["pending", "in_progress"] },
            _id: { $ne: task._id }
        }).session(session);

        if (activeTask) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Nhân viên này đang có công việc đang xử lý"
            });
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

        const room = await Room.findById(task.room_id).populate("room_category_id", "name");
        try {
            // gửi thông báo cho admin
            const allAdmins = await User.find({ system_role: "manager", isBanned: { $ne: true } });
            const adminIds = allAdmins.map(u => u._id);
            if (allAdmins.length > 0) {
                await pushNotificationToUsers(
                    adminIds,
                    "Công việc dọn dẹp mới",
                    `Nhân viên ${housekeeper.full_name} đã được chỉ định dọn dẹp phòng ${room.room_number}${room.room_category_id ? ` (${room.room_category_id.name})` : ''}`,
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
                    `Bạn được gán dọn dẹp phòng ${room.room_number}${room.room_category_id ? ` (${room.room_category_id.name})` : ''}`,
                    "room",
                    "CleaningTask",
                    task._id,
                    "unread"
                );
            }
        } catch (notifError) {
            console.error("Error sending notification:", notifError);
        }

        res.status(200).json({
            success: true,
            message: "Gán nhân viên thành công",
            data: task
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({
            success: false,
            message: "Lỗi server: " + error.message
        });
    } finally {
        session.endSession();
    }
};

// Nhân viên bắt đầu công việc
export const startCleaningTask = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        // Tìm employee từ user
        const employee = await Employee.findOne({ user_id: userId }).session(session);
        if (!employee) {
            await session.abortTransaction();
            return res.status(403).json({
                success: false,
                message: "Không tìm thấy thông tin nhân viên"
            });
        }

        const task = await CleaningTask.findById(id).session(session);
        if (!task) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy công việc"
            });
        }

        const room = await Room.findById(task.room_id);
        if (!room) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy phòng"
            });
        }

        // console.log("TASK IN START CLEANING: ", task);
        // console.log("ROOM NUMBER: ", room.room_number);

        if (task.handled_by?.toString() !== employee._id.toString()) {
            await session.abortTransaction();
            return res.status(403).json({
                success: false,
                message: "Bạn không được gán công việc này"
            });
        }

        if (task.status !== "pending") {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Công việc không ở trạng thái pending"
            });
        }

        task.status = "in_progress";
        task.started_at = new Date();
        await task.save({ session });

        await session.commitTransaction();

        // Gửi thông báo cho admin
        try {
            const admins = await User.find({ system_role: "manager", isBanned: { $ne: true } });
            const adminIds = admins.map(a => a._id);
            
            if (adminIds.length > 0) {
                await pushNotificationToUsers(
                    adminIds,
                    "Công việc dọn dẹp đã được bắt đầu",
                    `Phòng ${room.room_number} đã được nhân viên ${employee.full_name} xác nhận bắt đầu làm.`,
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
                    `Bạn đã xác nhận bắt đầu dọn dẹp phòng ${room.room_number}${room.room_category_id ? ` (${room.room_category_id.name})` : ''}`,
                    "room",
                    "CleaningTask",
                    task._id,
                    "unread"
                );
            }
        } catch (notifError) {
            console.error("Error sending notification:", notifError);
        }

        res.status(200).json({
            success: true,
            message: "Đã bắt đầu công việc",
            data: task
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({
            success: false,
            message: "Lỗi server: " + error.message
        });
    } finally {
        session.endSession();
    }
};

// Nhân viên hoàn thành công việc
export const completeCleaningTask = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        const employee = await Employee.findOne({ user_id: userId }).session(session);
        if (!employee) {
            await session.abortTransaction();
            return res.status(403).json({
                success: false,
                message: "Không tìm thấy thông tin nhân viên"
            });
        }

        const task = await CleaningTask.findById(id)
            .populate("room_id", "room_number")
            .session(session);
        
        if (!task) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy công việc"
            });
        }

        if (task.handled_by?.toString() !== employee._id.toString()) {
            await session.abortTransaction();
            return res.status(403).json({
                success: false,
                message: "Bạn không được gán công việc này"
            });
        }

        if (task.status !== "in_progress") {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Công việc chưa được bắt đầu"
            });
        }

        task.status = "completed";
        task.completed_at = new Date();
        await task.save({ session });

        await session.commitTransaction();

        const room = await Room.findById(task.room_id).populate("room_category_id", "name");
        // Gửi thông báo cho admin
        try {
            const admins = await User.find({ system_role: "manager", isBanned: { $ne: true } });
            const adminIds = admins.map(a => a._id);
            
            if (adminIds.length > 0) {
                await pushNotificationToUsers(
                    adminIds,
                    "Công việc dọn dẹp đã hoàn thành",
                    `Phòng ${task.room_id.room_number} đã được dọn dẹp xong. Vui lòng xác nhận.`,
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
                    `Bạn đã xác nhận hoàn thành việc dọn dẹp phòng ${room.room_number}${room.room_category_id ? 
                        ` (${room.room_category_id.name})` : ''}`,
                    "room",
                    "CleaningTask",
                    task._id,
                    "unread"
                );
            }
        } catch (notifError) {
            console.error("Error sending notification:", notifError);
        }

        res.status(200).json({
            success: true,
            message: "Đã hoàn thành công việc. Đang chờ admin xác nhận.",
            data: task
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({
            success: false,
            message: "Lỗi server: " + error.message
        });
    } finally {
        session.endSession();
    }
};

// Admin xác nhận hoàn thành (completeCleaning)
export const confirmCleaning = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { id } = req.params;

        const task = await CleaningTask.findById(id)
            .populate("room_id", "room_number room_status")
            .populate("room_log_id")
            .session(session);
        
        if (!task) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy công việc"
            });
        }

        if (task.status !== "completed") {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Nhân viên chưa hoàn thành công việc"
            });
        }

        if (!task.completed_at) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Nhân viên chưa hoàn thành công việc"
            });
        }

        // Cập nhật task
        task.status = "confirmed";
        task.confirmed_at = new Date();
        await task.save({ session });

        // Đóng RoomLog cleaning
        const now = new Date();
        await RoomLog.findByIdAndUpdate(
            task.room_log_id._id,
            { end_time: now },
            { session }
        );

        // Tạo RoomLog available mới
        await RoomLog.create(
            [{
                room_id: task.room_id._id,
                status: "available",
                start_time: now,
                end_time: null,
                note: `Phòng đã được dọn dẹp và sẵn sàng`,
            }],
            { session }
        );

        // Cập nhật room status
        await Room.findByIdAndUpdate(
            task.room_id._id,
            { room_status: "available" },
            { session }
        );

        await session.commitTransaction();

        const room = await Room.findById(task.room_id).populate("room_category_id", "name");
        // Gửi thông báo cho admin
        try {
            const admins = await User.find({ system_role: "manager", isBanned: { $ne: true } });
            const adminIds = admins.map(a => a._id);
            
            if (adminIds.length > 0) {
                await pushNotificationToUsers(
                    adminIds,
                    "Công việc dọn dẹp đã xác nhận hoàn thành",
                    `Phòng ${task.room_id.room_number} đã được xác nhận hoàn thành dọn dẹp.`,
                    "room",
                    "CleaningTask",
                    task._id,
                    "unread"
                );
            }

            // gửi thông báo cho nhân viên
            const employee = await Employee.findById(task.handled_by);
            if (employee.user_id) {
                await pushNotification(
                    employee.user_id,
                    "Công việc dọn dẹp đã hoàn thành",
                    `Bạn đã xác nhận hoàn thành việc dọn dẹp phòng ${room.room_number}${room.room_category_id ? 
                        ` (${room.room_category_id.name})` : ''}`,
                    "room",
                    "CleaningTask",
                    task._id,
                    "unread"
                );
            }
        } catch (notifError) {
            console.error("Error sending notification:", notifError);
        }

        res.status(200).json({
            success: true,
            message: "Xác nhận hoàn thành dọn dẹp thành công",
            data: task
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({
            success: false,
            message: "Lỗi server: " + error.message
        });
    } finally {
        session.endSession();
    }
};

// Lấy tất cả công việc (admin)
export const getAllTasks = async (req, res) => {
    try {
        const { type, status } = req.query;
        // type: 'cleaning' | 'install' | 'equipment_import' | 'product_import' | 'incident' | 'all'

        const tasks = [];

        // Cleaning tasks
        if (!type || type === 'all' || type === 'cleaning') {
            const cleaningTasks = await CleaningTask.find(status ? { status } : {})
                .populate("room_id", "room_number room_category_id")
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

        res.status(200).json({ success: true, tasks: tasks });

    } catch (error) {
        console.error("GetAllTasks Error:", error);
        res.status(500).json({ success: false, message: "Lỗi server: " + error.message });
    }
};

// Kiểm tra cleaningTask theo room_id hoặc booking_id
export const getCleaningTaskByRoom = async (req, res) => {
    try {
        const { room_id, booking_id } = req.query;
        
        if (!room_id && !booking_id) {
            return res.status(400).json({
                success: false,
                message: "Cần cung cấp room_id hoặc booking_id"
            });
        }
        
        const filter = {};
        if (room_id) filter.room_id = room_id;
        if (booking_id) filter.booking_id = booking_id;
        
        const task = await CleaningTask.findOne(filter)
            .populate("room_id", "room_number room_category_id")
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
        
        res.status(200).json({
            success: true,
            task: task,
            room_log_id: room_log_id
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi server: " + error.message
        });
    }
};

// Lấy công việc của housekeeper
export const getMyCleaningTasks = async (req, res) => {
    try {
        const userId = req.user?.userId;
        
        const employee = await Employee.findOne({ user_id: userId });
        if (!employee) {
            return res.status(403).json({
                success: false,
                message: "Không tìm thấy thông tin nhân viên"
            });
        }
        
        const tasks = await CleaningTask.find({ handled_by: employee._id })
            .populate("room_id", "room_number room_category_id")
            .populate("booking_id", "_id")
            .sort({ created_at: -1 });
        
        res.status(200).json({
            success: true,
            tasks: tasks
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Lỗi server: " + error.message
        });
    }
};
