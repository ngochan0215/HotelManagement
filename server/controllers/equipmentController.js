import { Equipment, EquipmentCategory, EquipmentTicket, EquipmentImport, 
    Room, EquipmentInstall, InstallDetail, Employee, EquipmentLog, User, DefaultEquipment } from "../models/index.js";
import mongoose from "mongoose";
import { pushNotificationToUsers } from "../services/notificationService.js";

//------EQUIPMENT CATEGORY------//
export const createEquipmentCategory = async (req, res) => {
    try {
        const { name, description, unit, price } = req.body;

        if (!name || !price || !description || !unit ) {
            return res.status(400).json({ success: false, message: "Yêu cầu nhập đầy đủ tất cả thông tin!" });
        }

        if (typeof name !== "string" || typeof description !== "string" || typeof unit !== "string") {
            return res.status(400).json({
                success: false,
                message: "name, description, unit phải là chuỗi",
            });
        }

        if (isNaN(price) || Number(price) <= 0) {
            return res.status(400).json({
                success: false,
                message: "price phải là số lớn hơn 0",
            });
        }

        if (name.length < 5 || name.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Tên danh mục phải từ 10 đến 100 ký tự",
            });
        }

        const existing = await EquipmentCategory.findOne({ name });
        if (existing) {
            return res.status(400).json({ success: false, message: "Tên danh mục đã tồn tại." });
        }

        const equipmentCategory = new EquipmentCategory({ name, description, unit, price });
        await equipmentCategory.save();

        return res.status(201).json({ success: true, message: "Thêm danh mục thiết bị mới thành công", equipmentCategory });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const getAllEquipmentCategories = async (req, res) => {
    try {
        const { min_price, max_price, min_storage, max_storage } = req.query;
        let filter = {};

        if (min_price || max_price) {
            filter.price = {};
            if (min_price) filter.price.$gte = Number(min_price);
            if (max_price) filter.price.$lte = Number(max_price);
        }

        if (min_storage || max_storage) {
            filter.storage_quantity = {};
            if (min_storage) filter.storage_quantity.$gte = Number(min_storage);
            if (max_storage) filter.storage_quantity.$lte = Number(max_storage);
        }

        const categories = await EquipmentCategory.find(filter)
            .sort({ createdAt: -1 }).select("-created_at -updated_at -__v");

        return res.status(200).json({ success: true, total: categories.length, categories });

    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const getEquipmentCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await EquipmentCategory.findById(id).select("-created_at -updated_at -__v");

        if (!category) {
            return res.status(404).json({ success: false, message: "Không tìm thấy danh mục thiết bị." });
        }
        res.status(200).json({ success: true, category });

    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const updateEquipmentCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const category = await EquipmentCategory.findById(id);
        if (!category) {
            return res.status(404).json({ success: false, message: "Không tìm thấy danh mục thiết bị." });
        }

        if (updateData.name) {
            const duplicate = await EquipmentCategory.findOne({ name: updateData.name, _id: { $ne: id } });
            if (duplicate)
            return res.status(400).json({ success: false, message: "Tên danh mục thiết bị đã tồn tại!" });
        }

        const updated = await EquipmentCategory.findByIdAndUpdate(id, updateData, { new: true })
            .select("-__v -updated_at");
        return res.status(200).json({ success: true, message: "Cập nhật thành công!", category: updated });
        
    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const deleteEquipmentCategory = async (req, res) => {
    try {
        const { id } = req.params;        
        const force = req.query?.force === 'true';

        const category = await EquipmentCategory.findById(id);
        if (!category) {
            return res.status(404).json({ success: false, message: "Không tìm thấy danh mục thiết bị." });
        }

        const relatedEquipmentCount = await Equipment.countDocuments({ category_id: id });
        if (relatedEquipmentCount > 0 && !force) {
            return res.status(400).json({ success: false, message: `Loại danh mục này có ${relatedEquipmentCount} thiết bị. Dùng ?force=true để xóa tất cả các thiết bị thuộc danh mục này.` });
        }
        if (force) {
            await Equipment.deleteMany({ category_id: id });
        }

        await EquipmentCategory.findByIdAndDelete(id);
        return res.status(200).json({ success: true, message: "Xóa danh mục thiết bị thành công!" });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

//------ EQUIPMENT ------//
export const addEquipment = async (req, res) => {
    // Business rule: Equipment is created only via import tickets
    return res.status(405).json({ success: false, message: "Thiết bị chỉ được thêm qua phiếu nhập thiết bị." });
};

export const getAllEquipments = async (req, res) => {
    try {
        const { category_id, status, condition, room_id } = req.query;
        const filter = {};

        if (category_id) {
            if (!mongoose.Types.ObjectId.isValid(category_id))
                return res.status(400).json({ success: false, message: "ID danh mục không hợp lệ!" });
            filter.category_id = category_id;
        }

        if (room_id) {
            if (!mongoose.Types.ObjectId.isValid(room_id))
                return res.status(400).json({ success: false, message: "ID phòng không hợp lệ!" });
            filter.room_id = room_id;
        }

        if (status) {
            const validStatuses = ["in-stock", "in-use", "maintenance", "lost", "disposed"];
            if (!validStatuses.includes(status))
                return res.status(400).json({ success: false, message: "Trạng thái thiết bị không hợp lệ!" });
            filter.status = status;
        }

        if (condition) {
            const validConditions = ["new", "good", "maintenance", "broken"];
            if (!validConditions.includes(condition))
                return res.status(400).json({ success: false, message: "Tình trạng thiết bị không hợp lệ!" });
            filter.condition = condition;
        }

        const equipments = await Equipment.find(filter)
            .populate("category_id", "name unit price")
            .populate("room_id", "room_number room_status")
            .select("-__v -created_at -updated_at")
            .sort({ created_at: -1 });

        return res.status(200).json({ success: true, count: equipments.length, equipments });

    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const getEquipmentById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID thiết bị không hợp lệ!" });

        const equipment = await Equipment.findById(id)
            .populate("category_id", "name unit price")
            .populate("room_id", "room_number room_status")
            .select("-__v -created_at -updated_at");

        if (!equipment)
            return res.status(404).json({ success: false, message: "Không tìm thấy thiết bị." });

        return res.status(200).json({ success: true, equipment });

    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const updateEquipment = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, condition, note } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const employee = await Employee.findOne({ user_id: req.user.userId });
        if (!employee)
            return res.status(403).json({ success: false, message: "Không xác định được nhân viên." });

        const equipment = await Equipment.findById(id);
        if (!equipment)
            return res.status(404).json({ success: false, message: "Không tìm thấy thiết bị." });

        let isChanged = false;

        if (condition !== undefined) {
            const validConditions = ["good", "maintenance", "broken"];

            if (!validConditions.includes(condition))
                return res.status(400).json({ success: false, message: "Tình trạng thiết bị không hợp lệ!" });

            if ( equipment.condition === "good" && condition === "broken" && !note ) {
                return res.status(400).json({
                    success: false,
                    message: "Chuyển thiết bị từ tốt sang hỏng cần ghi chú lý do."
                });
            }

            // Chỉ cho về good khi đang maintenance
            if (equipment.condition !== "maintenance" && condition === "good") {
                return res.status(400).json({
                    success: false,
                    message: "Chỉ có thể chuyển thiết bị về tốt từ trạng thái bảo trì."
                });
            }

            if (equipment.condition !== condition) {
                equipment.condition = condition;
                isChanged = true;
            }
        }

        if (status !== undefined) {
            const allowedManualStatuses = ["lost", "maintenance", "disposed"];

            if (!allowedManualStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Không được chỉnh thủ công trạng thái này."
                });
            }
            if (!note) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng nhập lý do khi chỉnh trạng thái thiết bị."
                });
            }

            if (status === "maintenance" && equipment.condition !== "maintenance" && condition !== "maintenance") {
                return res.status(400).json({
                    success: false,
                    message: "Trạng thái và tình trạng thiết bị phải cùng lúc bảo trì."
                });
            }

            if (status === "disposed" && (equipment.condition !== "broken" || condition !== "broken")) {
                return res.status(400).json({
                    success: false,
                    message: "Nếu trạng thái thiết bị là disposed thì tình trạng phải là broken."
                });
            }

            if (equipment.status !== status) {
                equipment.status = status;
                isChanged = true;
            }
        }

        if (!isChanged)
            return res.status(400).json({ success: false, message: "Không có thay đổi nào hợp lệ." });

        if (status && status === "lost") condition = equipment.condition;

        await equipment.save();

        await EquipmentLog.findOneAndUpdate(
            {
                equipment_id: id,
                end_time: null,
            },
            {
                end_time: new Date(),
            }
        );

        await EquipmentLog.create({
            equipment_id: id,
            room_id: equipment.room_id,
            condition,
            status,
            start_time: new Date(),
            end_time: null,
            note: note || "Admin cập nhật trạng thái thiết bị thủ công.",
            handled_by: employee._id,
        });

        const updated = await Equipment.findById(id)
            .populate("category_id", "name unit price")
            .populate("room_id", "room_number room_status")
            .select("-__v -created_at -updated_at");

        return res.status(200).json({
            success: true,
            message: "Cập nhật thiết bị thành công!",
            equipment: updated
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "SERVER ERROR: " + err.message
        });
    }
};

export const deleteEquipment = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const equipment = await Equipment.findById(id);
        if (!equipment)
            return res.status(404).json({ success: false, message: "Không tìm thấy thiết bị." });

        if (equipment.status === "in-use" || equipment.status === "maintenance") {
            return res.status(400).json({ success: false, message: `Không thể xóa thiết bị đang ở trạng thái "${equipment.status}".` });
        }

        await Equipment.findByIdAndDelete(id);

        return res.status(200).json({ success: true, message: "Xóa thiết bị thành công!" });

    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

// hàm xác thực thông tin các chi tiếu phiếu nhập thiết bị
const validateImportItems = async (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Phiếu nhập phải có ít nhất một danh mục thiết bị.");
    }

    const seenCategoryIds = new Set();

    items.forEach((item, index) => {
        if (!item.category_id) {
            throw new Error(`Dòng ${index + 1}: Thiếu category_id`);
        }

        if (!mongoose.Types.ObjectId.isValid(item.category_id)) {
            throw new Error(`Dòng ${index + 1}: category_id không hợp lệ`);
        }

        if (seenCategoryIds.has(item.category_id.toString())) {
            throw new Error(
                `Dòng ${index + 1}: Danh mục thiết bị đã bị trùng trong phiếu nhập`
            );
        }
        seenCategoryIds.add(item.category_id.toString());

        if (
            item.import_quantity === undefined ||
            !Number.isInteger(item.import_quantity) ||
            item.import_quantity <= 0
        ) {
            throw new Error(`Dòng ${index + 1}: Số lượng nhập phải là số nguyên > 0`);
        }

        if (
            item.import_price === undefined ||
            typeof item.import_price !== "number" ||
            item.import_price <= 0
        ) {
            throw new Error(`Dòng ${index + 1}: Đơn giá nhập phải > 0`);
        }
    });

    const categoryIds = [...seenCategoryIds];

    const count = await EquipmentCategory.countDocuments({
        _id: { $in: categoryIds },
    });

    if (count !== categoryIds.length) {
        throw new Error("Có category_id không tồn tại trong hệ thống");
    }
};

//------ EQUIPMENT TICKET (PHIẾU NHẬP THIẾT BỊ)------//
export const createEquipmentTicket = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const employee_id = req.user.userId;
        const { import_date, total_fee, items } = req.body;

        if (!employee_id || !import_date)
            return res.status(400).json({ success: false, message: "Yêu cầu nhập thông tin đầy đủ." });

        const employee = await Employee.findOne({ user_id: employee_id }).session(session);
        if (!employee) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Không tìm thấy nhân viên." });
        }

        const existing = await EquipmentTicket.findOne({ import_date }).session(session);
        if (existing)
            return res.status(400).json({ success: false, message: "Có một phiếu nhập trùng ngày nhập, bạn có thể tìm kiếm và thêm thiết bị nhập ở phiếu đó." });

        const importDate = new Date(import_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        importDate.setHours(0, 0, 0, 0);

        if (importDate < today) {
            return res.status(400).json({
                success: false,
                message: "Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại."
            });
        }

        const status = importDate.getTime() === today.getTime()
                ? "waiting_confirm" : "pending";

        // tạo phiếu nhập thiết bị
        const employeeId = employee._id;
        const ticket = await EquipmentTicket.create(
            [ { employee_id: employeeId, import_date, status, total_fee },],
            { session });

        const ticketId = ticket[0]._id;

        // tạo từng chi tiết phiếu nhập
        await validateImportItems(items);

        const importDetails = items.map((item) => ({
            ticket_id: ticketId,
            category_id: item.category_id,
            import_price: item.import_price,
            import_quantity: item.import_quantity,
        }));

        await EquipmentImport.insertMany(importDetails, { session });

        await session.commitTransaction();
        session.endSession();

        return res.status(201).json({ success: true, message: "Tạo phiếu nhập thành công!", ticket_id: ticketId });

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ success: false, message: "ERROR: " + err.message });
    }
};

export const getAllEquipmentTickets = async (req, res) => {
    try {
        const { employee_id, min_import_date, max_import_date, status } = req.query;
        let filter = {};

        if (employee_id) {
            const employee = await Employee.findOne({ user_id: employee_id });
            if (!employee)
                return res.status(400).json({ success: false, message: "Không tìm thấy nhân viên." });

            filter.employee_id = employee_id;
        }

        if (min_import_date || max_import_date) {
            filter.import_date = {};
            if (min_import_date) filter.import_date.$gte = new Date(min_import_date);
            if (max_import_date) filter.import_date.$lte = new Date(max_import_date);
        }

        if (status) filter.status = status;

        const tickets = await EquipmentTicket.find(filter)
            .sort({ import_date: -1 })
            .select("-__v -updated_at -created_at")
            .populate("employee_id", "full_name")
            .lean();

        const ticketIds = tickets.map(t => t._id);

        // lấy chi tiết phiếu nhập
        const imports = await EquipmentImport.find({ ticket_id: { $in: ticketIds } })
            .populate("category_id", "name")
            .select("-__v -updated_at -created_at")
            .lean();

        // group theo ticket_id
        const importMap = {};
        for (const item of imports) {
            if (!importMap[item.ticket_id]) importMap[item.ticket_id] = [];
            importMap[item.ticket_id].push(item);
        }

        const result = tickets.map(ticket => ({
            ...ticket,
            import_details: importMap[ticket._id] || [],
        }));

        return res.status(200).json({ success: true, total_tickets: result.length, tickets: result });
    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const getEquipmentTicketById = async (req, res) => {
    try {
        const { id } = req.params;

        const ticket = await EquipmentTicket.findById(id).select("-__v -updated_at -created_at");
        if (!ticket)
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập thiết bị." });

        const imports = await EquipmentImport.find({ ticket_id: id })
            .populate("category_id", "name unit price -_id")
            .select("-__v -created_at -updated_at -ticket_id");

        return res.status(200).json({ success: true, ticket: ticket, ticket_details: imports });
    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const updateEquipmentTicket = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = req.params;
        const { import_date, total_fee, items } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "ID phiếu nhập không hợp lệ" });
        }

        const ticket = await EquipmentTicket.findById(id).session(session);
        if (!ticket) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập" });
        }

        if (ticket.status !== "pending") {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "Chỉ được sửa phiếu nhập ở trạng thái pending" });
        }

        const today = new Date();
        today.setHours(0,0,0,0);

        const ticketDate = new Date(ticket.import_date);
        ticketDate.setHours(0,0,0,0);

        if (ticketDate <= today) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Không thể sửa khi đã đến hoặc qua ngày nhập thiết bị"
            });
        }

        // Validate items mới
        if (!items || !Array.isArray(items) || items.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "Phiếu nhập phải có ít nhất một chi tiết" });
        }

        await validateImportItems(items);

        if (import_date) {
            const importDate = new Date(import_date);
            importDate.setHours(0, 0, 0, 0);

            if (importDate < today) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ success: false, message: "Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại." });
            }

            if (importDate.getTime() === today.getTime())
                ticket.status = "waiting_confirm"

            ticket.import_date = import_date;
            await ticket.save({ session });
        }

        if (total_fee) ticket.total_fee = total_fee;

        // xóa chi tiết cũ
        await EquipmentImport.deleteMany(
            { ticket_id: ticket._id },
            { session }
        );

        // insert chi tiết mới
        const importDetails = items.map(item => ({
            ticket_id: ticket._id,
            category_id: item.category_id,
            import_price: item.import_price,
            import_quantity: item.import_quantity,
        }));

        await EquipmentImport.insertMany(importDetails, { session });

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            success: true,
            message: "Cập nhật phiếu nhập thiết bị thành công",
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const deleteEquipmentTicket = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const force = req.query?.force === "true";

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "ID phiếu nhập thiết bị không hợp lệ!",
      });
    }

    const ticket = await EquipmentTicket.findById(id).session(session);
    if (!ticket) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu nhập thiết bị.",
      });
    }

    if (ticket.status !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: "Chỉ được xóa phiếu nhập ở trạng thái pending.",
      });
    }

    const now = new Date();
    if (ticket.import_date && now >= new Date(ticket.import_date)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: "Không thể xóa vì đã đến hoặc qua ngày nhập thiết bị." });
    }

    const relatedImports = await EquipmentImport.find({ ticket_id: id }).session(session);

    if (relatedImports.length > 0 && !force) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Phiếu có ${relatedImports.length} chi tiết nhập. Dùng ?force=true để xóa.`,
      });
    }

    await EquipmentImport.deleteMany(
      { ticket_id: id },
      { session }
    );

    await EquipmentTicket.deleteOne(
      { _id: id },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Xóa phiếu nhập thiết bị thành công!",
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message,
    });
  }
};

//------ EQUIPMENT INSTALL TICKET (PHIẾU LẮP ĐẶT THIẾT BỊ) ------//
// Lấy danh sách nhân viên kỹ thuật rảnh (không có phiếu đang xử lý)
export const getAvailableTechnicians = async (req, res) => {
    try {
        // Tìm tất cả nhân viên kỹ thuật
        const technicians = await Employee.find({ 
            position: "technician",
            status: "working"
        })
        .populate("user_id", "email system_role avatar")
        .select("full_name phone_number user_id");

        // Tìm các phiếu đang xử lý (pending hoặc waiting_confirm)
        const activeTickets = await EquipmentInstall.find({
            handled_by: { $exists: true, $ne: null },
            status: { $in: ["pending", "waiting_confirm"] }
        }).select("handled_by");

        // Lấy danh sách employee_id đang bận
        const busyEmployeeIds = new Set(
            activeTickets.map(ticket => ticket.handled_by?.toString()).filter(Boolean)
        );

        // Lọc ra những nhân viên rảnh
        const availableTechnicians = technicians
            .filter(tech => {
                const employeeId = tech._id.toString();
                return !busyEmployeeIds.has(employeeId);
            })
            .map(tech => ({
                _id: tech._id,
                employee_id: tech._id,
                full_name: tech.full_name,
                phone_number: tech.phone_number,
                user_id: tech.user_id
            }));

        res.status(200).json({
            success: true,
            count: availableTechnicians.length,
            technicians: availableTechnicians
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Lỗi server", 
            error: error.message 
        });
    }
};

export const createInstallTicket = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { from_room_id, room_id, install_date, items, type, handled_by } = req.body;
        const employee_id = req.user.userId;

        if (!employee_id || !install_date || (!room_id && !from_room_id)) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Yêu cầu nhập thông tin đầy đủ." });
        }

        const employee = await Employee.findOne({ user_id: employee_id }).session(session);

        const selectedEquipmentIds = [];
        const sourceQuery = {};
        if (from_room_id) {
            sourceQuery.status = "in-use";
            sourceQuery.room_id = from_room_id;
        } else {
            sourceQuery.status = "in-stock";
        }

        // Lấy danh sách thiết bị đang trong phiếu lắp đặt khác (pending/assigned/waiting_confirm) để loại trừ
        const activeInstallTickets = await EquipmentInstall.find({
            status: { $in: ["pending", "assigned", "waiting_confirm"] }
        }).select("_id").session(session);
        
        const activeInstallTicketIds = activeInstallTickets.map(t => t._id);
        const busyEquipmentIds = [];
        
        if (activeInstallTicketIds.length > 0) {
            const busyDetails = await InstallDetail.find({
                install_id: { $in: activeInstallTicketIds }
            }).select("equipment_id").session(session);
            
            busyEquipmentIds.push(...busyDetails.map(d => d.equipment_id));
        }

        for (const item of items) {
            if (item.specific_equipment_id) {
                // Kiểm tra thiết bị cụ thể
                const eq = await Equipment.findOne({
                    _id: item.specific_equipment_id,
                    ...sourceQuery,
                    status: { $ne: "installing" }, // Loại trừ thiết bị đang installing
                    _id: { $nin: busyEquipmentIds } // Loại trừ thiết bị đang trong phiếu khác
                }).session(session);

                if (!eq) {
                    await session.abortTransaction();
                    return res.status(400).json({ 
                        success: false, 
                        message: `Thiết bị có ID ${item.specific_equipment_id} không khả dụng tại nguồn hoặc đang được sử dụng trong phiếu khác.` 
                    });
                }
                selectedEquipmentIds.push(eq._id);
            }
            else if (item.category_id) {
                const quantity = Number(item.quantity) || 1;
                
                // Query thiết bị với điều kiện chặt chẽ hơn
                const query = {
                    category_id: item.category_id,
                    ...sourceQuery,
                    status: { $ne: "installing" }, // Loại trừ thiết bị đang installing
                    _id: { $nin: busyEquipmentIds } // Loại trừ thiết bị đang trong phiếu khác
                };
                
                const availableEqs = await Equipment.find(query)
                    .limit(quantity)
                    .session(session);

                if (availableEqs.length < quantity) {
                    await session.abortTransaction();
                    return res.status(400).json({ 
                        success: false, 
                        message: `Không đủ số lượng cho danh mục ${item.category_id}. Có thể một số thiết bị đang được sử dụng trong phiếu khác.` 
                    });
                }

                availableEqs.forEach(e => {
                    selectedEquipmentIds.push(e._id);
                    // Thêm vào danh sách busy để tránh trùng trong cùng request
                    busyEquipmentIds.push(e._id);
                });
            }
        }

        if (selectedEquipmentIds.length === 0) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Danh sách thiết bị trống." });
        }

        // Kiểm tra lại một lần nữa để đảm bảo không có conflict (double-check)
        const existedDetail = await InstallDetail.findOne({
            equipment_id: { $in: selectedEquipmentIds },
            install_id: { $in: activeInstallTicketIds }
        }).session(session);

        if (existedDetail) {
            await session.abortTransaction();
            const install_ticket = await EquipmentInstall.findById(existedDetail.install_id).session(session);
            return res.status(400).json({ 
                success: false, 
                message: `Có thiết bị đang thuộc phiếu xử lý khác (Phiếu #${install_ticket?._id.toString().slice(-6) || 'N/A'}).` 
            });
        }

        // Validate handled_by nếu có
        let handledByEmployee = null;
        if (handled_by) {
            handledByEmployee = await Employee.findOne({ 
                _id: handled_by,
                position: "technician",
                status: "working"
            }).session(session);

            if (!handledByEmployee) {
                await session.abortTransaction();
                return res.status(400).json({ 
                    success: false, 
                    message: "Nhân viên kỹ thuật không hợp lệ hoặc không tồn tại." 
                });
            }

            // Kiểm tra nhân viên có đang bận không
            const activeTicket = await EquipmentInstall.findOne({
                handled_by: handled_by,
                status: { $in: ["pending", "assigned", "waiting_confirm"] }
            }).session(session);

            if (activeTicket) {
                await session.abortTransaction();
                return res.status(400).json({ 
                    success: false, 
                    message: "Nhân viên này đang có phiếu đang xử lý, không thể gán thêm." 
                });
            }
        }

        // Xác định status dựa trên install_date và handled_by
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const installDate = new Date(install_date);
        installDate.setHours(0, 0, 0, 0);
        const isToday = installDate.getTime() === today.getTime();
        
        let status;
        if (handled_by) {
            // Đã gán nhân viên → "assigned" (bất kể đã đến ngày hay chưa)
            status = "assigned";
        } else if (isToday) {
            // Đến ngày nhưng chưa gán nhân viên → "waiting_confirm" (cần gán ngay)
            status = "waiting_confirm";
        } else {
            // Chưa đến ngày và chưa gán nhân viên → "pending"
            status = "pending";
        }

        const [install] = await EquipmentInstall.create(
            [{
                employee_id: employee._id,
                handled_by: handled_by ? handledByEmployee._id : null,
                room_id: room_id || null,
                type: type || 'install',
                install_date,
                status,
            }],
            { session }
        );

        const details = selectedEquipmentIds.map((eid) => ({
            install_id: install._id,
            equipment_id: eid,
        }));
        await InstallDetail.insertMany(details, { session });

        await Equipment.updateMany(
            { _id: { $in: selectedEquipmentIds } },
            { status: "installing" },
            { session }
        );

        const now = new Date();
        await EquipmentLog.updateMany(
            { equipment_id: { $in: selectedEquipmentIds }, end_time: null },
            { $set: { end_time: now } },
            { session }
        );

        const noteLog = from_room_id ? "Đang làm thủ tục tháo dỡ/điều chuyển" : "Đang làm thủ tục xuất kho lắp đặt";

        const logs = selectedEquipmentIds.map((equipmentId) => ({
            equipment_id: equipmentId,
            room_id: room_id || null,
            status: "installing",
            condition: "good",
            start_time: now,
            end_time: null,
            note: noteLog,
            handled_by: employee._id,
        }));

        await EquipmentLog.insertMany(logs, { session });

        await session.commitTransaction();
        
        // Gửi thông báo
        try {
          // Gửi thông báo cho nhân viên được gán (nếu có)
          if (handledByEmployee && handledByEmployee.user_id) {
            const roomInfo = room_id ? await Room.findById(room_id).select("room_number") : null;
            const roomText = roomInfo ? ` phòng ${roomInfo.room_number}` : "";
            const typeText = type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
            
            await pushNotificationToUsers(
              [handledByEmployee.user_id],
              "Công việc mới được gán",
              `Bạn được gán phiếu ${typeText} thiết bị${roomText} #${install._id.toString().slice(-6)}`,
              "equipment",
              "EquipmentInstall",
              install._id,
              "unread"
            );
          }

          // Gửi thông báo cho admin về phiếu lắp đặt mới
          const adminUsers = await User.find({ 
            isBanned: { $ne: true },
            system_role: "manager"
          }).select("_id");
          const adminUserIds = adminUsers.map(u => u._id);
          
          if (adminUserIds.length > 0) {
            await pushNotificationToUsers(
              adminUserIds,
              "Phiếu lắp đặt mới",
              `Có phiếu lắp đặt thiết bị mới #${install._id.toString().slice(-6)} được tạo${handledByEmployee ? ` và đã gán cho ${handledByEmployee.full_name}` : ''}`,
              "system",
              "EquipmentInstall",
              install._id,
              "unread"
            );
          }
        } catch (notifError) {
          console.error("Error sending notification:", notifError);
          // Không throw error để không ảnh hưởng đến response chính
        }
        
        return res.status(201).json({ success: true, message: "Tạo phiếu thành công.", data: { install } });

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: "SERVER ERROR: " + error.message });
    } finally {
        session.endSession();
    }
};

export const getAllEquipmentInstalls = async (req, res) => {
  try {
    const { employee_id, room_id, min_install_date, max_install_date, status } = req.query;
    let filter = {};

    if (employee_id) {
        const employee = await Employee.findOne({ user_id: employee_id });
        if (!employee)
            return res.status(400).json({ success: false, message: "Không tìm thấy nhân viên." });

        filter.employee_id = employee_id;
    }

    if (room_id) {
        const room = await Room.findById(room_id);
        if (!room)
            return res.status(400).json({ success: false, message: "Không tìm thấy phòng." });

        filter.room_id = room_id;
    }

    if (min_install_date || max_install_date) {
        filter.install_date = {};
        if (min_install_date) filter.install_date.$gte = new Date(min_install_date);
        if (max_install_date) filter.install_date.$lte = new Date(max_install_date);
    }

    if (status) filter.status = status;

    const installs = await EquipmentInstall.find(filter)
        .sort({ install_date: -1 })
        .select("-created_at -updated_at -__v")
        .populate("room_id", "room_number")
        .populate("employee_id", "full_name")
        .populate("handled_by", "full_name phone_number");

    res.status(200).json({ success: true, counts: installs.length, installs });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Nhân viên xem các phiếu được gán cho mình
// Gợi ý thông minh thiết bị cần lắp đặt cho phòng
export const getSmartInstallSuggestions = async (req, res) => {
  try {
    const { room_id } = req.query;

    if (!room_id) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp room_id"
      });
    }

    // Lấy thông tin phòng
    const room = await Room.findById(room_id).populate("category_id", "_id category_name");
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phòng"
      });
    }

    if (!room.category_id) {
      return res.status(400).json({
        success: false,
        message: "Phòng này chưa có loại phòng"
      });
    }

    // Lấy danh sách thiết bị mặc định của loại phòng này
    const defaultEquipments = await DefaultEquipment.find({
      category_id: room.category_id._id
    }).populate("equipment_category_id", "name description unit");

    if (defaultEquipments.length === 0) {
      return res.status(200).json({
        success: true,
        suggestions: [],
        message: "Loại phòng này không có thiết bị mặc định"
      });
    }

    // Lấy danh sách thiết bị hiện có trong phòng (status = "in-use")
    const currentEquipments = await Equipment.find({
      room_id: room_id,
      status: "in-use"
    }).populate("category_id", "_id name");

    // Đếm số lượng từng loại thiết bị hiện có trong phòng
    const currentEquipmentCount = {};
    currentEquipments.forEach(eq => {
      const catId = eq.category_id?._id?.toString() || eq.category_id?.toString();
      if (catId) {
        currentEquipmentCount[catId] = (currentEquipmentCount[catId] || 0) + 1;
      }
    });

    // Kiểm tra số lượng thiết bị có sẵn trong kho (status = "in-stock")
    const stockEquipmentCount = {};
    const stockEquipments = await Equipment.find({
      status: "in-stock"
    }).populate("category_id", "_id name");
    
    stockEquipments.forEach(eq => {
      const catId = eq.category_id?._id?.toString() || eq.category_id?.toString();
      if (catId) {
        stockEquipmentCount[catId] = (stockEquipmentCount[catId] || 0) + 1;
      }
    });

    // So sánh với thiết bị mặc định và tạo danh sách gợi ý
    const suggestions = [];
    for (const defaultEq of defaultEquipments) {
      const equipmentCategoryId = defaultEq.equipment_category_id?._id?.toString() || defaultEq.equipment_category_id?.toString();
      const requiredQuantity = defaultEq.quantity || 0;
      const currentQuantity = currentEquipmentCount[equipmentCategoryId] || 0;
      const neededQuantity = requiredQuantity - currentQuantity;
      const availableInStock = stockEquipmentCount[equipmentCategoryId] || 0;

      // Chỉ gợi ý nếu thiếu thiết bị (neededQuantity > 0) và có sẵn trong kho
      if (neededQuantity > 0 && availableInStock > 0) {
        // Số lượng gợi ý = min(neededQuantity, availableInStock)
        const suggestedQuantity = Math.min(neededQuantity, availableInStock);
        
        suggestions.push({
          category_id: equipmentCategoryId,
          category_name: defaultEq.equipment_category_id?.name || "Unknown",
          category_description: defaultEq.equipment_category_id?.description || "",
          category_unit: defaultEq.equipment_category_id?.unit || "item",
          required_quantity: requiredQuantity,
          current_quantity: currentQuantity,
          needed_quantity: neededQuantity,
          available_in_stock: availableInStock,
          suggested_quantity: suggestedQuantity,
          reason: currentQuantity === 0 
            ? `Thiết bị chưa có trong phòng (cần ${requiredQuantity}, có ${availableInStock} trong kho)` 
            : `Thiếu ${neededQuantity} ${defaultEq.equipment_category_id?.unit || "cái"} (hiện có ${currentQuantity}/${requiredQuantity}, có ${availableInStock} trong kho)`
        });
      }
    }

    // Sắp xếp theo thứ tự ưu tiên: thiết bị chưa có trước, sau đó là thiết bị thiếu
    suggestions.sort((a, b) => {
      if (a.current_quantity === 0 && b.current_quantity > 0) return -1;
      if (a.current_quantity > 0 && b.current_quantity === 0) return 1;
      return b.needed_quantity - a.needed_quantity;
    });

    return res.status(200).json({
      success: true,
      room_id: room_id,
      room_number: room.room_number,
      room_category: room.category_id.category_name,
      suggestions: suggestions,
      total_suggestions: suggestions.length
    });

  } catch (error) {
    console.error("Error in getSmartInstallSuggestions:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server: " + error.message
    });
  }
};

export const getMyInstallTickets = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status } = req.query;

    const employee = await Employee.findOne({ user_id: userId });
    if (!employee) {
      return res.status(404).json({ 
        success: false, 
        message: "Không tìm thấy nhân viên." 
      });
    }

    let filter = { handled_by: employee._id };
    if (status) {
      filter.status = status;
    }

    const installs = await EquipmentInstall.find(filter)
      .sort({ created_at: -1 })
      .select("-created_at -updated_at -__v")
      .populate("room_id", "room_number")
      .populate("employee_id", "full_name")
      .populate({
        path: "handled_by",
        select: "full_name phone_number"
      })
      .lean();

    res.status(200).json({ 
      success: true, 
      count: installs.length, 
      installs 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server", 
      error: error.message 
    });
  }
};

export const getEquipmentInstallById = async (req, res) => {
  try {
    const { id } = req.params;
    const install = await EquipmentInstall.findById(id)
      .select("-created_at -updated_at -__v")
      .populate("room_id", "room_number")
      .populate("employee_id", "full_name")
      .populate("handled_by", "full_name phone_number");

    if (!install)
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu lắp đặt." });

    // Lấy chi tiết thiết bị
    const installDetails = await InstallDetail.find({ install_id: id })
      .populate({
        path: "equipment_id",
        populate: {
          path: "category_id",
          select: "name description"
        },
        select: "category_id condition status code"
      });

    res.status(200).json({ 
      success: true, 
      install: {
        ...install.toObject(),
        install_details: installDetails
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateEquipmentInstall = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { room_id, install_date, items, handled_by } = req.body;
        const { id } = req.params;

        const install_ticket = await EquipmentInstall.findById(id).session(session);
        if (!install_ticket) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu lắp đặt thiết bị." });
        }

        // Chỉ cho phép cập nhật khi status = pending, assigned hoặc waiting_confirm (chưa bắt đầu)
        if (install_ticket.status === "completed" || install_ticket.status === "expired") {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Không thể chỉnh sửa phiếu đã hoàn tất hoặc quá hạn." });
        }

        // Nếu đã có nhân viên bắt đầu làm (started_at), không cho phép thay đổi
        if (install_ticket.started_at) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Không thể chỉnh sửa phiếu khi nhân viên đã bắt đầu công việc." });
        }

        if (room_id) {
            const room = await Room.findById(room_id).session(session);
            if (!room) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Không tìm thấy phòng." });
            }
            install_ticket.room_id = room_id;
        }

        const today = new Date();
        today.setHours(0,0,0,0);

        const ticketDate = new Date(install_ticket.install_date);
        ticketDate.setHours(0,0,0,0);

        // Chỉ kiểm tra ngày nếu đang cập nhật install_date
        if (install_date) {
            const installDate = new Date(install_date);
            installDate.setHours(0, 0, 0, 0);

            if (installDate < today) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: "Ngày lắp đặt không hợp lệ! Không thể nhỏ hơn ngày hiện tại."
                });
            }

            // Nếu đổi ngày về quá khứ hoặc hôm nay, không cho phép nếu đã qua ngày cũ
            if (ticketDate <= today && installDate.getTime() !== ticketDate.getTime()) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: "Không thể thay đổi ngày khi đã đến hoặc qua ngày lắp đặt thiết bị"
                });
            }
        } else if (ticketDate <= today) {
            // Nếu không đổi ngày nhưng đã đến/qua ngày, chỉ cho phép cập nhật handled_by
            if (handled_by === undefined) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: "Không thể sửa khi đã đến hoặc qua ngày lắp đặt thiết bị"
                });
            }
        }

        // Xử lý cập nhật handled_by
        if (handled_by !== undefined) {
            if (handled_by === null || handled_by === "") {
                // Cho phép xóa phân công
                install_ticket.handled_by = null;
            } else {
                // Validate nhân viên kỹ thuật
                const technician = await Employee.findOne({ 
                    _id: handled_by,
                    position: "technician",
                    status: "working"
                }).session(session);

                if (!technician) {
                    await session.abortTransaction();
                    return res.status(400).json({ 
                        success: false, 
                        message: "Nhân viên kỹ thuật không hợp lệ hoặc không tồn tại." 
                    });
                }

                // Nếu thay đổi nhân viên, kiểm tra nhân viên mới có rảnh không
                if (!install_ticket.handled_by || install_ticket.handled_by.toString() !== handled_by) {
                    const activeTicket = await EquipmentInstall.findOne({
                        handled_by: handled_by,
                        status: { $in: ["pending", "assigned", "waiting_confirm"] },
                        _id: { $ne: install_ticket._id }
                    }).session(session);

                    if (activeTicket) {
                        await session.abortTransaction();
                        return res.status(400).json({ 
                            success: false, 
                            message: "Nhân viên này đang có phiếu đang xử lý, không thể gán thêm." 
                        });
                    }
                }

                install_ticket.handled_by = technician._id;
            }
        }

        if (install_date) {
             install_ticket.install_date = install_date;
             
             const installDate = new Date(install_date);
             installDate.setHours(0, 0, 0, 0);
             const isToday = installDate.getTime() === today.getTime();
             
             // Cập nhật status khi thay đổi install_date (chỉ nếu chưa bắt đầu)
             if (installDate.getTime() >= today.getTime()) {
                 if (install_ticket.handled_by) {
                     install_ticket.status = "assigned"; // Đã gán nhân viên
                 } else if (isToday) {
                     install_ticket.status = "waiting_confirm"; // Đến ngày nhưng chưa gán
                 } else {
                     install_ticket.status = "pending"; // Chưa đến ngày và chưa gán
                 }
             }
             // Nếu install_date < today, giữ nguyên status (có thể là expired hoặc completed)
        }
        
        // Cập nhật status khi thay đổi handled_by (nếu chưa được xử lý ở trên)
        if (handled_by !== undefined && !install_date) {
            const installDate = new Date(install_ticket.install_date);
            installDate.setHours(0, 0, 0, 0);
            const isToday = installDate.getTime() === today.getTime();
            
            if (install_ticket.handled_by) {
                // Đã gán nhân viên → "assigned"
                install_ticket.status = "assigned";
            } else if (isToday) {
                // Chưa gán nhân viên nhưng đến ngày → "waiting_confirm"
                install_ticket.status = "waiting_confirm";
            } else {
                // Chưa gán nhân viên và chưa đến ngày → "pending"
                install_ticket.status = "pending";
            }
        }

        await install_ticket.save({ session });

        // Chỉ cập nhật thiết bị nếu có items trong request
        if (!items || !Array.isArray(items) || items.length === 0) {
            // Không cập nhật thiết bị, chỉ cập nhật thông tin khác
            await session.commitTransaction();
            
            // Gửi thông báo nếu thay đổi nhân viên
            try {
                if (handled_by !== undefined && install_ticket.handled_by) {
                    const updatedTicket = await EquipmentInstall.findById(install_ticket._id)
                        .populate("room_id", "room_number")
                        .populate("handled_by", "user_id full_name");
                    
                    if (updatedTicket.handled_by && updatedTicket.handled_by.user_id) {
                        const roomText = updatedTicket.room_id ? ` phòng ${updatedTicket.room_id.room_number}` : "";
                        const typeText = install_ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
                        
                        await pushNotificationToUsers(
                            [updatedTicket.handled_by.user_id],
                            "Công việc mới được gán",
                            `Bạn được gán phiếu ${typeText} thiết bị${roomText} #${install_ticket._id.toString().slice(-6)}`,
                            "equipment",
                            "EquipmentInstall",
                            install_ticket._id,
                            "unread"
                        );
                    }
                }
            } catch (notifError) {
                console.error("Error sending notification:", notifError);
            }

            return res.status(200).json({
                success: true,
                message: "Cập nhật phiếu lắp đặt thiết bị thành công.",
                data: {
                    install_ticket
                }
            });
        }

        const categoryIds = [];

        for (const item of items) {
             if ( !item.category_id || !mongoose.Types.ObjectId.isValid(item.category_id) || !Number.isInteger(item.quantity) || item.quantity <= 0 ) {
                 await session.abortTransaction();
                 return res.status(400).json({ success: false, message: "Danh sách thiết bị không hợp lệ (category_id hoặc quantity)." });
             }
             categoryIds.push(item.category_id.toString());
        }

        if (new Set(categoryIds).size !== categoryIds.length) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Danh sách loại thiết bị bị trùng." });
        }

        // Lấy danh sách thiết bị đang trong phiếu lắp đặt khác để loại trừ
        const activeInstallTickets = await EquipmentInstall.find({
            status: { $in: ["pending", "assigned", "waiting_confirm"] },
            _id: { $ne: install_ticket._id } // Loại trừ phiếu hiện tại
        }).select("_id").session(session);
        
        const activeInstallTicketIds = activeInstallTickets.map(t => t._id);
        const busyEquipmentIds = [];
        
        if (activeInstallTicketIds.length > 0) {
            const busyDetails = await InstallDetail.find({
                install_id: { $in: activeInstallTicketIds }
            }).select("equipment_id").session(session);
            
            busyEquipmentIds.push(...busyDetails.map(d => d.equipment_id));
        }

        const equipments = await Equipment.find({
            category_id: { $in: categoryIds },
            status: "in-stock", // Chỉ lấy thiết bị trong kho (đã loại trừ "installing")
            _id: { $nin: busyEquipmentIds } // Loại trừ thiết bị đang trong phiếu khác
        }).sort({ createdAt: 1 }).session(session);

        const equipmentMap = new Map();
        for (const eq of equipments) {
            const key = eq.category_id.toString();
            if (!equipmentMap.has(key)) equipmentMap.set(key, []);
            equipmentMap.get(key).push(eq);
        }

        const selectedEquipments = [];
        for (const item of items) {
            const available = equipmentMap.get(item.category_id.toString()) || [];

            if (available.length < item.quantity) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: `Tồn kho thiết bị của danh mục ${item.category_id} không đủ để lắp đặt.` });
            }

            selectedEquipments.push(...available.slice(0, item.quantity));
        }

        const selectedEquipmentIds = selectedEquipments.map(e => e._id);

        const existedDetail = await InstallDetail.findOne({
            equipment_id: { $in: selectedEquipmentIds },
        }).session(session);

        if (existedDetail) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Có thiết bị đang thuộc phiếu lắp đặt khác." });
        }

        const now = new Date();

        const oldDetails = await InstallDetail.find({ install_id: install_ticket._id }).session(session);
        const oldEquipmentIds = oldDetails.map(d => d.equipment_id);

        // update condition và status của các equipment cũ
        await Equipment.updateMany(
            { _id: { $in: oldEquipmentIds } },
            { status: "in-stock", condition: "new" },
            { session }
        );

        // xóa chi tiết cũ
        await InstallDetail.deleteMany(
            { install_id: install_ticket._id },
            { session }
        );

        // đóng log cũ
        await EquipmentLog.updateMany(
            {
                equipment_id: { $in: oldEquipmentIds },
                end_time: null,
            },
            { $set: { end_time: now } },
            { session }
        );
        // tạo log cho condition "new" và status "in-stock" của thiết bị cũ
        const oldEquipmentLogs = oldEquipmentIds.map((equipmentId) => ({
            equipment_id: equipmentId,
            room_id: install_ticket.room_id,
            status: "in-stock",
            condition: "new",
            start_time: now,
            end_time: null,
            note: "Thiết bị đang ở kho",
            handled_by: install_ticket.employee_id || null,
        }));

        await EquipmentLog.insertMany(oldEquipmentLogs, { session });

        // insert chi tiết mới
        const details = selectedEquipmentIds.map((eid) => ({
            install_id: install_ticket._id,
            equipment_id: eid,
        }));
        await InstallDetail.insertMany(details, { session });

        await Equipment.updateMany(
            { _id: { $in: selectedEquipmentIds } },
            { status: "installing" },
            { session }
        );

        // đóng log cũ
        await EquipmentLog.updateMany(
            {
                equipment_id: { $in: selectedEquipmentIds },
                end_time: null,
            },
            { $set: { end_time: now } },
            { session }
        );
        // thêm log mới
        const logs = selectedEquipmentIds.map((equipmentId) => ({
            equipment_id: equipmentId,
            room_id: install_ticket.room_id,
            status: "installing",
            condition: "new",
            start_time: now,
            end_time: null,
            note: "Thiết bị đang chờ lắp đặt",
            handled_by: install_ticket.employee_id || null,
        }));

        await EquipmentLog.insertMany(logs, { session });

        await session.commitTransaction();

        // Gửi thông báo nếu thay đổi nhân viên được gán
        try {
            if (handled_by !== undefined && install_ticket.handled_by) {
                const updatedTicket = await EquipmentInstall.findById(install_ticket._id)
                    .populate("room_id", "room_number")
                    .populate("handled_by", "user_id full_name");
                
                if (updatedTicket.handled_by && updatedTicket.handled_by.user_id) {
                    const roomText = updatedTicket.room_id ? ` phòng ${updatedTicket.room_id.room_number}` : "";
                    const typeText = install_ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
                    
                    await pushNotificationToUsers(
                        [updatedTicket.handled_by.user_id],
                        "Công việc mới được gán",
                        `Bạn được gán phiếu ${typeText} thiết bị${roomText} #${install_ticket._id.toString().slice(-6)}`,
                        "equipment",
                        "EquipmentInstall",
                        install_ticket._id,
                        "unread"
                    );
                }
            }
        } catch (notifError) {
            console.error("Error sending notification:", notifError);
        }

        return res.status(200).json({
        success: true,
        message: "Cập nhật phiếu lắp đặt thiết bị thành công.",
        data: {
            install_ticket,
            equipment_count: details.length,
        },
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: "SERVER ERROR: " + error.message });
    } finally {
        session.endSession();
    }
};

export const deleteEquipmentInstall = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const force = req.query?.force === "true";

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "ID phiếu lắp đặt không hợp lệ.",
      });
    }

    const installTicket = await EquipmentInstall
      .findById(id)
      .session(session);

    if (!installTicket) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu lắp đặt thiết bị.",
      });
    }

    if (!["pending", "assigned", "waiting_confirm"].includes(installTicket.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Chỉ được xóa phiếu lắp đặt ở trạng thái pending.",
      });
    }

    // Không cho xóa khi đã đến ngày lắp đặt
    // const today = new Date();
    // today.setHours(0, 0, 0, 0);

    // const installDate = new Date(installTicket.install_date);
    // installDate.setHours(0, 0, 0, 0);

    // if (installDate <= today) {
    //   await session.abortTransaction();
    //   return res.status(400).json({
    //     success: false,
    //     message: "Không thể xóa vì đã đến hoặc qua ngày lắp đặt.",
    //   });
    // }

    // Lấy chi tiết lắp đặt
    const details = await InstallDetail
      .find({ install_id: id })
      .session(session);

    if (details.length > 0 && !force) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Phiếu có ${details.length} thiết bị. Dùng ?force=true để xóa.`,
      });
    }

    const equipmentIds = details.map(d => d.equipment_id);

    // Xóa chi tiết
    await InstallDetail.deleteMany(
      { install_id: id },
      { session }
    );

    // Trả thiết bị về kho
    if (equipmentIds.length > 0) {
      await Equipment.updateMany(
        { _id: { $in: equipmentIds } },
        { status: "in-stock" },
        { session }
      );
    }

    // Xóa phiếu
    await EquipmentInstall.deleteOne(
      { _id: id },
      { session }
    );

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Đã xóa phiếu lắp đặt thiết bị thành công.",
    });

  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + error.message,
    });
  } finally {
    session.endSession();
  }
};

export const confirmEquipmentImportTicket = async (req, res) => {
    const { id } = req.params;
    const adminId = req.user.userId;
    const now = new Date();

    const ticket = await EquipmentTicket.findById(id);
    if (!ticket)
        return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập thiết bị." });

    if (ticket.status !== "waiting_confirm")
        return res.status(400).json({ success: false, message: "Phiếu chưa đến ngày nhập kho." });

    const imports = await EquipmentImport.find({ ticket_id: ticket._id });

    for (const item of imports) {
        const equipments = Array.from(
            { length: item.import_quantity },
            () => ({
                category_id: item.category_id,
                status: "in-stock",
                condition: "new",
                import_ticket_id: ticket._id
            })
        );

        const createdEquipments = await Equipment.insertMany(equipments);

        const logs = createdEquipments.map((eq) => ({
            equipment_id: eq._id,
            room_id: null,
            condition: "new",
            status: "in-stock",
            start_time: now,
            end_time: null,
            note: "Thiết bị mới nhập kho",
            handled_by: adminId
        }));

        await EquipmentLog.insertMany(logs);

        await EquipmentCategory.updateOne(
            { _id: item.category_id },
            { $inc: { storage_quantity: item.import_quantity } }
        );
    }

    ticket.status = "completed";
    ticket.confirmed_by = adminId;
    ticket.confirmed_at = now;
    await ticket.save();

    return res.json({
        success: true,
        message: "Xác nhận nhập kho thành công",
    });
};

// Lấy danh sách thiết bị hết tồn kho để preview
export const getOutOfStockCategories = async (req, res) => {
    try {
        // Tìm tất cả thiết bị có storage_quantity = 0
        const outOfStockCategories = await EquipmentCategory.find({
            storage_quantity: 0
        }).select("_id name description unit price storage_quantity");

        return res.status(200).json({
            success: true,
            categories: outOfStockCategories,
            count: outOfStockCategories.length
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: "ERROR: " + err.message });
    }
};

// Tự động tạo phiếu nhập cho thiết bị có số lượng tồn = 0
export const autoCreateImportTicket = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const employee_id = req.user.userId;
        const { import_date, default_quantity = 10, default_price_percent = 0.8 } = req.body;

        if (!employee_id) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "Yêu cầu nhập thông tin đầy đủ." });
        }

        const employee = await Employee.findOne({ user_id: employee_id }).session(session);
        if (!employee) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: "Không tìm thấy nhân viên." });
        }

        // Nếu có items từ frontend, sử dụng items đó (đã được chỉnh sửa)
        // Nếu không, tự động tìm thiết bị hết tồn kho
        let items = req.body.items;
        let outOfStockCategories = [];

        if (items && Array.isArray(items) && items.length > 0) {
            // Validate items từ frontend
            await validateImportItems(items);
            // Lấy thông tin category để tính tổng tiền
            const categoryIds = items.map(item => item.category_id);
            outOfStockCategories = await EquipmentCategory.find({
                _id: { $in: categoryIds }
            }).session(session);
        } else {
            // Tự động tìm thiết bị hết tồn kho
            outOfStockCategories = await EquipmentCategory.find({
                storage_quantity: 0
            }).session(session);

            if (outOfStockCategories.length === 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(200).json({
                    success: true,
                    message: "Không có thiết bị nào hết tồn kho.",
                    ticket_id: null,
                    items_count: 0
                });
            }

            // Tạo items mặc định
            items = outOfStockCategories.map(category => ({
                category_id: category._id,
                import_quantity: default_quantity,
                import_price: Math.round(category.price * default_price_percent)
            }));
        }

        if (!items || items.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Không có thiết bị nào để tạo phiếu nhập."
            });
        }

        // Kiểm tra ngày nhập
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let importDate;
        
        if (import_date) {
            importDate = new Date(import_date);
            importDate.setHours(0, 0, 0, 0);
            if (importDate < today) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: "Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại."
                });
            }
        } else {
            // Mặc định là ngày mai
            importDate = new Date(today);
            importDate.setDate(importDate.getDate() + 1);
        }

        // Kiểm tra xem đã có phiếu nhập cho ngày này chưa
        const existing = await EquipmentTicket.findOne({ import_date: importDate }).session(session);
        if (existing) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: `Đã có phiếu nhập cho ngày ${importDate.toISOString().split('T')[0]}. Vui lòng cập nhật phiếu đó hoặc chọn ngày khác.`
            });
        }

        const status = importDate.getTime() === today.getTime()
            ? "waiting_confirm" : "pending";

        // Tính tổng tiền
        const total_fee = items.reduce((sum, item) => sum + (item.import_price * item.import_quantity), 0);

        // Tạo phiếu nhập thiết bị
        const employeeId = employee._id;
        const ticket = await EquipmentTicket.create(
            [{ employee_id: employeeId, import_date: importDate, status, total_fee }],
            { session }
        );

        const ticketId = ticket[0]._id;

        // Tạo từng chi tiết phiếu nhập
        const importDetails = items.map((item) => ({
            ticket_id: ticketId,
            category_id: item.category_id,
            import_price: item.import_price,
            import_quantity: item.import_quantity,
        }));

        await EquipmentImport.insertMany(importDetails, { session });

        await session.commitTransaction();
        session.endSession();

        return res.status(201).json({
            success: true,
            message: `Tự động tạo phiếu nhập thành công cho ${items.length} loại thiết bị hết tồn kho!`,
            ticket_id: ticketId,
            items_count: items.length,
            import_date: importDate
        });

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return res.status(500).json({ success: false, message: "ERROR: " + err.message });
    }
};

// Nhân viên bắt đầu công việc
export const startInstallTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID phiếu lắp đặt không hợp lệ.",
      });
    }

    const employee = await Employee.findOne({ user_id: userId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy nhân viên.",
      });
    }

    const ticket = await EquipmentInstall.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu lắp đặt thiết bị.",
      });
    }

    // Kiểm tra nhân viên có được gán phiếu này không
    if (!ticket.handled_by || ticket.handled_by.toString() !== employee._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Bạn không được gán phiếu này.",
      });
    }

    // Kiểm tra trạng thái
    if (ticket.status !== "assigned" && ticket.status !== "waiting_confirm") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể bắt đầu phiếu ở trạng thái assigned hoặc waiting_confirm.",
      });
    }

    // Kiểm tra đã bắt đầu chưa
    if (ticket.started_at) {
      return res.status(400).json({
        success: false,
        message: "Phiếu này đã được bắt đầu rồi.",
      });
    }

    ticket.status = "waiting_confirm";
    ticket.started_at = new Date();
    await ticket.save();

    res.status(200).json({
      success: true,
      message: "Đã bắt đầu công việc.",
      data: {
        install_id: ticket._id,
        started_at: ticket.started_at
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + error.message,
    });
  }
};

// Nhân viên hoàn thành công việc
export const completeInstallTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID phiếu lắp đặt không hợp lệ.",
      });
    }

    const employee = await Employee.findOne({ user_id: userId });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy nhân viên.",
      });
    }

    const ticket = await EquipmentInstall.findById(id)
      .populate("room_id", "room_number")
      .populate("employee_id", "full_name");

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu lắp đặt thiết bị.",
      });
    }

    // Kiểm tra nhân viên có được gán phiếu này không
    if (!ticket.handled_by || ticket.handled_by.toString() !== employee._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Bạn không được gán phiếu này.",
      });
    }

    // Kiểm tra đã bắt đầu chưa
    if (!ticket.started_at) {
      return res.status(400).json({
        success: false,
        message: "Bạn cần bắt đầu công việc trước khi hoàn thành.",
      });
    }

    // Kiểm tra đã hoàn thành chưa
    if (ticket.completed_at) {
      return res.status(400).json({
        success: false,
        message: "Phiếu này đã được hoàn thành rồi.",
      });
    }

    //ticket.status = "completed";
    ticket.completed_at = new Date();
    await ticket.save();

    // Gửi thông báo cho admin
    try {
      const adminUsers = await User.find({ 
        isBanned: { $ne: true },
        system_role: "manager"
      }).select("_id");
      const adminUserIds = adminUsers.map(u => u._id);
      
      const roomText = ticket.room_id ? ` phòng ${ticket.room_id.room_number}` : "";
      const typeText = ticket.type === 'uninstall' ? 'tháo dỡ' : 'lắp đặt';
      
      if (adminUserIds.length > 0) {
        await pushNotificationToUsers(
          adminUserIds,
          "Công việc hoàn thành",
          `Nhân viên ${employee.full_name} đã hoàn thành phiếu ${typeText} thiết bị${roomText} #${ticket._id.toString().slice(-6)}. Vui lòng xác nhận.`,
          "equipment",
          "EquipmentInstall",
          ticket._id,
          "unread"
        );
      }
    } catch (notifError) {
      console.error("Error sending notification:", notifError);
    }

    res.status(200).json({
      success: true,
      message: "Đã hoàn thành công việc. Đang chờ admin xác nhận.",
      data: {
        install_id: ticket._id,
        completed_at: ticket.completed_at
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + error.message,
    });
  }
};

export const confirmEquipmentInstall = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "ID phiếu lắp đặt không hợp lệ.",
      });
    }

    const ticket = await EquipmentInstall.findById(id).session(session);

    if (!ticket) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu lắp đặt thiết bị.",
      });
    }

    if (ticket.status !== "waiting_confirm") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể xác nhận phiếu ở trạng thái chờ xác nhận.",
      });
    }

    // Kiểm tra nhân viên đã hoàn thành chưa
    if (!ticket.completed_at) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Nhân viên chưa hoàn thành công việc. Không thể xác nhận.",
      });
    }

    // check ngày lắp đặt
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const installDate = new Date(ticket.install_date);
    installDate.setHours(0, 0, 0, 0);

    if (installDate > today) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Chưa đến ngày thực hiện, không thể xác nhận.",
      });
    }

    const details = await InstallDetail
      .find({ install_id: id })
      .session(session);

    if (details.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Phiếu không có thiết bị nào.",
      });
    }

    const equipmentIds = details.map(d => d.equipment_id);

    // validate thiết bị
    const equipments = await Equipment.find({
      _id: { $in: equipmentIds },
      status: "installing",
    }).session(session);

    if (equipments.length !== equipmentIds.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Có thiết bị không hợp lệ hoặc đã được sử dụng.",
      });
    }

    // đóng log cũ
    await EquipmentLog.updateMany(
        {
            equipment_id: { $in: equipmentIds },
            end_time: null,
        },
        {
            $set: { end_time: new Date() },
        },
        { session }
    );

    let newStatus = "in-use";
    let newRoomId = ticket.room_id;
    let logNote = "Hoàn tất lắp đặt vào phòng";

    if (ticket.type === 'uninstall') {
            newStatus = "in-stock";
            newRoomId = null;
            logNote = `Đã thu hồi về kho`;
        }

        else if (!ticket.room_id) {
            newStatus = "in-stock";
            newRoomId = null;
            logNote = "Đã thu hồi về kho";
        }

    await Equipment.updateMany(
          { _id: { $in: equipmentIds } },
          {
            status: newStatus,
            condition: "good",
            room_id: newRoomId,
            install_ticket_id: ticket._id
          },
          { session }
        );

    const logs = equipmentIds.map((equipmentId) => ({
            equipment_id: equipmentId,
            room_id: newRoomId,
            status: newStatus,
            condition: "good",
            start_time: new Date(),
            end_time: null,
            note: logNote,
            handled_by: ticket.employee_id || null,
        }));

    await EquipmentLog.insertMany(logs, { session });

    ticket.status = "completed";
    await ticket.save({ session });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Xác nhận lắp đặt thiết bị thành công.",
      data: {
        install_id: ticket._id,
        equipment_count: equipmentIds.length,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + error.message,
    });
  } finally {
    session.endSession();
  }
};
