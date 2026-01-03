import { Equipment, EquipmentCategory, EquipmentTicket, EquipmentImport, 
    Room, EquipmentInstall, InstallDetail, Employee, EquipmentLog } from "../models/index.js";
import mongoose from "mongoose";

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

        // const equipments = await Equipment.aggregate([
        //     { $match: filter },
        //     {
        //         $lookup: {
        //             from: "equipmentcategories",
        //             localField: "category_id",
        //             foreignField: "_id",
        //             as: "category"
        //         }
        //     },
        //     { $unwind: "$category" },

        //     {
        //         $group: {
        //             _id: "$category._id",
        //             category: {
        //                 $first: {
        //                     _id: "$category._id",
        //                     name: "$category.name",
        //                     unit: "$category.unit",
        //                     price: "$category.price"
        //                 }
        //             },
        //             equipments: {
        //                 $push: {
        //                     _id: "$_id",
        //                     code: "$code",
        //                     status: "$status",
        //                     condition: "$condition",
        //                     created_at: "$created_at"
        //                 }
        //             },
        //             total: { $sum: 1 }
        //         }
        //     },

        //     { $sort: { "category.name": 1 } }
        // ]);

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
        const { room_id, status, condition, note } = req.body;
        const employee = await Employee.findOne({ user_id: req.user.userId });

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const equipment = await Equipment.findById(id);
        if (!equipment)
            return res.status(404).json({ success: false, message: "Không tìm thấy thiết bị." });

        if (room_id !== undefined) {
            if (room_id === null || room_id === "") {
                equipment.room_id = null; // unassign
            } else {
                if (!mongoose.Types.ObjectId.isValid(room_id))
                    return res.status(400).json({ success: false, message: "ID phòng không hợp lệ!" });

                const room = await Room.findById(room_id);
                if (!room)
                    return res.status(404).json({ success: false, message: "Không tìm thấy phòng để gán thiết bị." });

                equipment.room_id = room_id;
            }
        }

        if (status) {
            const validStatuses = ["in-stock", "in-use", "maintenance", "lost", "disposed"];
            if (!validStatuses.includes(status))
                return res.status(400).json({ success: false, message: "Trạng thái thiết bị không hợp lệ!" });
            
            equipment.status = status;
        }

        if (condition) {
            const validConditions = ["new", "good", "maintenance", "broken"];
            if (!validConditions.includes(condition))
                return res.status(400).json({ success: false, message: "Tình trạng thiết bị không hợp lệ!" });

            equipment.condition = condition;
        }

        if (note) equipment.note = note;

        await equipment.save();

        // đóng log cũ (nếu có)
        await EquipmentLog.findOneAndUpdate(
            {
                equipment_id: id,
                end_time: null,
            },
            {
                end_time: new Date(),
            }
        );
    
        // tạo log mới
        await EquipmentLog.create(
            {
                room_id: equipment.room_id || null,
                equipment_id: id,
                condition,
                status,
                start_time: new Date(),
                end_time: null,
                note: note ||  `Update trạng thái thiết bị: ${status}`,
                handled_by: employee._id,
            },
        );

        const updated = await Equipment.findById(id)
            .populate("category_id", "name unit price")
            .populate("room_id", "room_number room_status")
            .select("-__v -created_at -updated_at");

        return res.status(200).json({ success: true, message: "Cập nhật thiết bị thành công!", equipment: updated });

    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
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

export const confirmEquipmentImportTicket = async (req, res) => {
    const { id } = req.params;
    const adminId = req.user.userId;

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
    ticket.confirmed_at = new Date();
    await ticket.save();

    return res.json({
        success: true,
        message: "Xác nhận nhập kho thành công",
    });
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
export const createInstallTicket = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { room_id, install_date, items } = req.body;
        const employee_id = req.user.userId;
        
        if (!employee_id || !install_date || !room_id) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Yêu cầu nhập thông tin đầy đủ." });
        }

        const employee = await Employee.findOne({ user_id: employee_id }).session(session);
        if (!employee) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Không tìm thấy nhân viên." });
        }

        const room = await Room.findById(room_id).session(session);
        if (!room) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Không tìm thấy phòng." });
        }

        const existing = await EquipmentInstall.findOne({ install_date, room_id, status: "pending" }).session(session);
        if (existing) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Có một phiếu trùng ngày lắp đặt và phòng, bạn có thể tìm kiếm và thêm thiết bị ở phiếu đó." });
        }

        // validate ngày lắp đặt
        const installDate = new Date(install_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        installDate.setHours(0, 0, 0, 0);

        if (installDate < today) {
            return res.status(400).json({
                success: false,
                message: "Ngày lắp đặt không hợp lệ! Không thể nhỏ hơn ngày hiện tại."
            });
        }

        const status = installDate.getTime() === today.getTime()
                ? "waiting_confirm" : "pending";

        // validate danh sách thiết bị
        // if (!Array.isArray(equipment_list) || equipment_list.length == 0) {
        //     await session.abortTransaction();
        //     return res.status(400).json({ success: false, message: "Không có thiết bị nào được chọn để lắp đặt. Vui lòng chọn ít nhất một!" });
        // }

        // const uniqueEquipmentIds = [...new Set(equipment_list.map(String))];
        // if (uniqueEquipmentIds.length !== equipment_list.length) {
        //     await session.abortTransaction();
        //     return res.status(400).json({ success: false, message: "Danh sách thiết bị bị trùng." });
        // }
        
        // const equipments = await Equipment.find({
        //     _id: { $in: uniqueEquipmentIds },
        //     status: "in-stock",
        // }).session(session);

        // if (equipments.length !== uniqueEquipmentIds.length) {
        //     await session.abortTransaction();
        //     return res.status(400).json({ success: false, message: "Có thiết bị không tồn tại hoặc không ở trạng thái sẵn sàng (in-stock)." });
        // }

        // const existedDetail = await InstallDetail.findOne({
        //     equipment_id: { $in: uniqueEquipmentIds },
        // }).session(session);

        // if (existedDetail) {
        //     await session.abortTransaction();
        //     return res.status(400).json({ success: false, message: "Có thiết bị đang nằm trong phiếu lắp đặt khác." });
        // }

        // tạo phiếu lắp đặt
        
        const categoryIds = [];
        for (const item of items) {
            if (
                !item.category_id ||
                !mongoose.Types.ObjectId.isValid(item.category_id) ||
                !Number.isInteger(item.quantity) ||
                item.quantity <= 0
            ) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Danh sách thiết bị không hợp lệ (category_id hoặc quantity)." });
            }
            categoryIds.push(item.category_id.toString());
        }

        if (new Set(categoryIds).size !== categoryIds.length) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Danh sách loại thiết bị bị trùng.",
            });
        }

        // lấy các thiết bị tương ứng với mỗi loại
        const equipments = await Equipment.find({
            category_id: { $in: categoryIds },
            status: "in-stock",
        })
            .sort({ createdAt: 1 }) // ưu tiên thiết bị nhập trước
            .session(session);

        // group các thiết bị theo danh mục
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
                return res.status(400).json({
                    success: false,
                    message: `Tồn kho thiết bị của danh mục ${item.category_id} không đủ để lắp đặt.`,
                });
            }

            selectedEquipments.push(
                ...available.slice(0, item.quantity)
            );
        }

        const selectedEquipmentIds = selectedEquipments.map(e => e._id);

        const existedDetail = await InstallDetail.findOne({
            equipment_id: { $in: selectedEquipmentIds },
        }).session(session);

        if (existedDetail) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Có thiết bị đang thuộc phiếu lắp đặt khác.",
            });
        }
        
        const employeeId = employee._id;
        // tạo phiếu lắp đặt trước
        const [install] = await EquipmentInstall.create(
            [{ employee_id: employeeId, room_id, install_date, status }], { session });

        // tạo các chi tiết của phiếu
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

        // đóng log cũ
        await EquipmentLog.updateMany(
            {
                equipment_id: { $in: selectedEquipmentIds },
                end_time: null,
            },
            {
                $set: { end_time: now },
            },
            { session }
        );
        // thêm log mới
        const logs = selectedEquipmentIds.map((equipmentId) => ({
            equipment_id: equipmentId,
            room_id: ticket.room_id,
            status: "installing",
            condition: "new",
            start_time: now,
            end_time: null,
            note: "Thiết bị đang chờ lắp đặt",
            handled_by: ticket.employee_id || null,
        }));

        await EquipmentLog.insertMany(logs, { session });

        await session.commitTransaction();

        return res.status(201).json({
        success: true,
        message: "Tạo phiếu lắp đặt thiết bị thành công.",
        data: {
            install,
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
        .populate("employee_id", "full_name");

    res.status(200).json({ success: true, counts: installs.length, installs });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEquipmentInstallById = async (req, res) => {
  try {
    const { id } = req.params;
    const install = await EquipmentInstall.findById(id).select("-created_at -updated_at -__v");

    if (!install)
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu lắp đặt." });

    const details = await InstallDetail.find({ install_id: install._id,}).select("_id equipment_id");

    res.status(200).json({ success: true, data: { install, details } });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateEquipmentInstall = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { room_id, install_date, items } = req.body;
        const { id } = req.params;
        
        const install_ticket = await EquipmentInstall.findById(id).session(session);
        if (!install_ticket) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu lắp đặt thiết bị." });
        }

        if (room_id) {
            const room = await Room.findById(room_id).session(session);
            if (!room) {
                await session.abortTransaction();
                return res.status(400).json({ success: false, message: "Không tìm thấy phòng." });
            }
            install_ticket.room_id = room_id;
        }

        if (install_ticket.status !== "pending") {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Chỉ được chỉnh sửa phiếu ở trạng thái pending." });
        }

        const today = new Date();
        today.setHours(0,0,0,0);

        const ticketDate = new Date(install_ticket.install_date);
        ticketDate.setHours(0,0,0,0);

        if (ticketDate <= today) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Không thể sửa khi đã đến hoặc qua ngày lắp đặt thiết bị"
            });
        }

        // Validate ngày mới
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

            install_ticket.install_date = install_date;

            if (installDate.getTime() === today.getTime()) 
                install_ticket.status = "waiting_confirm"
        }

        await install_ticket.save({ session });
        
        // validate danh sách thiết bị lắp đặt
        const categoryIds = [];
        if (!Array.isArray(items) || items.length === 0) {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Danh sách thiết bị không được để trống." });
        }

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

        // lấy các thiết bị tương ứng với mỗi loại
        const equipments = await Equipment.find({
            category_id: { $in: categoryIds },
            status: "in-stock",
        }).sort({ createdAt: 1 }).session(session);

        // group các thiết bị theo danh mục
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
            room_id: ticket.room_id,
            status: "in-stock",
            condition: "new",
            start_time: now,
            end_time: null,
            note: "Thiết bị đang ở kho",
            handled_by: ticket.employee_id || null,
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
            room_id: ticket.room_id,
            status: "installing",
            condition: "new",
            start_time: now,
            end_time: null,
            note: "Thiết bị đang chờ lắp đặt",
            handled_by: ticket.employee_id || null,
        }));

        await EquipmentLog.insertMany(logs, { session });

        await session.commitTransaction();

        return res.status(201).json({
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

    if (installTicket.status !== "pending") {
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

    // check ngày lắp đặt
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const installDate = new Date(ticket.install_date);
    installDate.setHours(0, 0, 0, 0);

    if (installDate > today) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Chưa đến ngày lắp đặt, không thể xác nhận.",
      });
    }

    const details = await InstallDetail
      .find({ install_id: id })
      .session(session);

    if (details.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Phiếu lắp đặt không có thiết bị nào.",
      });
    }

    const equipmentIds = details.map(d => d.equipment_id);

    // validate thiết bị
    const equipments = await Equipment.find({
      _id: { $in: equipmentIds },
      status: { $ne: "in-use" },
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

    // cập nhật thiết bị
    await Equipment.updateMany(
      { _id: { $in: equipmentIds } },
      {
        status: "in-use",
        condition: "good",
        room_id: ticket.room_id,
        install_ticket_id: ticket._id
      },
      { session }
    );

    const logs = equipmentIds.map((equipmentId) => ({
        equipment_id: equipmentId,
        room_id: ticket.room_id,
        status: "in-use",
        condition: "good",
        start_time: new Date(),
        end_time: null,
        note: "Lắp đặt thiết bị vào phòng",
        handled_by: ticket.employee_id || null,
    }));

    await EquipmentLog.insertMany(logs, { session });

    // cập nhật phiếu
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

//------ EQUIPMENT IMPORT (each record represents a category import with quantity) ------//
// export const createEquipmentImport = async (req, res) => {
//     try {
//         const { ticket_id, category_id, import_price, import_quantity } = req.body;

//         if (!ticket_id || !category_id)
//             return res.status(400).json({ success: false, message: "Yêu cầu ticket_id và category_id" });

//         const ticket = await EquipmentTicket.findById(ticket_id);
//         if (!ticket) return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập thiết bị." });
        
//         if (ticket.status === "completed")
//             return res.status(400).json({ success: false, message: "Phiếu đã hoàn tất, không thể thêm chi tiết mới." });

//         const category = await EquipmentCategory.findById(category_id);
//         if (!category) return res.status(404).json({ success: false, message: "Không tìm thấy danh mục thiết bị." });

//         const qty = Number(import_quantity ?? 1);
//         if (!Number.isInteger(qty) || qty <= 0) {
//             return res.status(400).json({ success: false, message: "Số lượng nhập phải là số nguyên dương." });
//         }

//         const equipmentImport = new EquipmentImport({
//             ticket_id,
//             category_id,
//             import_price: import_price || 0,
//             import_quantity: qty,
//         });

//         await equipmentImport.save();

//         const now = new Date();
//         if (ticket.import_date && now == new Date(ticket.import_date)) {
//             const equipmentsToCreate = Array.from({ length: qty }, () => ({ category_id, status: "in-stock", condition: "new", import_ticket_id: ticket_id, import_date: ticket.import_date }));
//             const createdEquipments = await Equipment.insertMany(equipmentsToCreate);

//             await EquipmentCategory.updateOne({ _id: category_id }, { $inc: { storage_quantity: qty } });
//             return res.status(201).json({ success: true, import: equipmentImport, created_count: createdEquipments.length });

//         }
        
//         return res.status(201).json({ success: true, message: "Thêm chi tiết phiếu nhập thành công!", equipmentImport });

//     } catch (err) {
//         return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
//     }
// };

// export const getAllEquipmentImports = async (req, res) => {
//     try {
//         const { ticket_id, category_id } = req.query;
//         const filter = {};
//         if (ticket_id) {
//             if (!mongoose.Types.ObjectId.isValid(ticket_id))
//                 return res.status(400).json({ success: false, message: "ID phiếu không hợp lệ!" });
//             filter.ticket_id = ticket_id;
//         }
//         if (category_id) {
//             if (!mongoose.Types.ObjectId.isValid(category_id))
//                 return res.status(400).json({ success: false, message: "ID danh mục không hợp lệ!" });
//             filter.category_id = category_id;
//         }

//         const imports = await EquipmentImport.find(filter)
//             .populate("ticket_id", "employee_id import_date")
//             .populate("category_id", "name unit price")
//             .select("-__v")
//             .sort({ created_at: -1 });

//         return res.status(200).json({ success: true, count: imports.length, imports });

//     } catch (err) {
//         return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
//     }
// };

// export const getEquipmentImportById = async (req, res) => {
//     try {
//         const { id } = req.params;

//         const imp = await EquipmentImport.findById(id)
//             .populate("ticket_id", "employee_id import_date")
//             .populate("category_id", "name unit price")
//             .select("-__v");

//         if (!imp) return res.status(404).json({ success: false, message: "Không tìm thấy chi tiết nhập thiết bị." });

//         return res.status(200).json({ success: true, import: imp });
//     } catch (err) {
//         return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
//     }
// };

// export const updateEquipmentImport = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { import_price, import_quantity } = req.body;

//         const imp = await EquipmentImport.findById(id);
//         if (!imp) 
//             return res.status(404).json({ success: false, message: "Không tìm thấy chi tiết nhập thiết bị." });

//         // Lấy ngày nhập từ phiếu tương ứng
//         const ticket = await EquipmentTicket.findById(imp.ticket_id);
//         if (!ticket)
//             return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập liên kết." });

//         const now = new Date();
//         if (ticket.import_date && now >= new Date(ticket.import_date)) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Không thể chỉnh sửa vì đã đến hoặc qua ngày nhập thiết bị."
//             });
//         }

//         if (import_price !== undefined) imp.import_price = import_price;
//         if (import_quantity !== undefined) imp.import_quantity = import_quantity;

//         await imp.save();
//         return res.status(200).json({ success: true, message: "Cập nhật chi tiết nhập thành công!", import: imp });

//     } catch (err) {
//         return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
//     }
// };

// export const deleteEquipmentImport = async (req, res) => {
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         const { id } = req.params;

//         const imp = await EquipmentImport.findById(id);
//         if (!imp){
//             const session = await mongoose.startSession();
//             session.startTransaction();
//             return res.status(404).json({ success: false, message: "Không tìm thấy chi tiết nhập thiết bị." });
//         } 

//         const ticket = await EquipmentTicket.findById(imp.ticket_id).session(session);
//         if (!ticket) {
//             await session.abortTransaction();
//             session.endSession();
//             return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập liên kết." });
//         }

//         const now = new Date();
//         if (ticket.import_date && now >= new Date(ticket.import_date)) {
//             await session.abortTransaction();
//             session.endSession();
//             return res.status(400).json({
//                 success: false,
//                 message: "Không thể xóa vì đã đến hoặc qua ngày nhập thiết bị."
//             });
//         }

//         await EquipmentImport.deleteOne({ _id: id });
//         return res.status(200).json({ success: true, message: "Xóa chi tiết nhập thiết bị thành công!" });

//     } catch (err) {
//         return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
//     }
// };

// export const confirmEquipmentTicket = async (req, res) => {
//     try {
//         const { id } = req.params;

//         const ticket = await EquipmentTicket.findById(id);
//         if (!ticket)
//             return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập thiết bị." });

//         if (ticket.status === "completed") {
//             return res.status(400).json({ success: false, message: "Phiếu nhập này đã hoàn thành trước đó." });
//         }

//         const now = new Date();
//         if (ticket.import_date && now < new Date(ticket.import_date)) {
//             return res.status(400).json({ success: false, message: "Chưa đến ngày nhập, không thể xác nhận nhập kho." });
//         }

//         const imports = await EquipmentImport.find({ ticket_id: id });
//         if (imports.length === 0) {
//             return res.status(400).json({ success: false, message: "Phiếu nhập không có chi tiết thiết bị nào." });
//         }

//         for (const imp of imports) {
//             const qty = imp.import_quantity || 0;
//             if (qty <= 0) continue;

//             const category = await EquipmentCategory.findById(imp.category_id);
//             if (!category) continue;

//             // Tạo thiết bị trong kho
//             const newEquipments = [];
//             for (let i = 0; i < qty; i++) {
//                 newEquipments.push({
//                     category_id: category._id,
//                     status: "in-stock",
//                     condition: "new",
//                     import_ticket_id: ticket._id,
//                     import_date: ticket.import_date
//                 });
//             }

//             if (newEquipments.length > 0)
//                 await Equipment.insertMany(newEquipments);

//             // Cập nhật số lượng tồn kho
//             await EquipmentCategory.updateOne({ _id: category._id }, { $inc: { storage_quantity: qty } });
//         }

//         ticket.status = "completed";
//         await ticket.save();
//         return res.status(200).json({ success: true, message: "Xác nhận nhập kho thành công!", ticket });

//     } catch (err) {
//         return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
//     }
// };

// export const updateEquipmentTicket = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { import_date } = req.body;

//         const ticket = await EquipmentTicket.findById(id);
//         if (!ticket)
//             return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập thiết bị." });
        
//         const now = new Date();
//         if (ticket.import_date && now >= new Date(ticket.import_date)) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Không thể chỉnh sửa vì đã đến hoặc qua ngày nhập thiết bị."
//             });
//         }

//         if (import_date) {
//             const importDate = new Date(import_date);
//             const now = new Date();
//             if (importDate < new Date(now.toDateString())) {
//                 return res.status(400).json({ success: false, message: "Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại." });
//             }
//             ticket.import_date = importDate;
//         }

//         await ticket.save();
//         return res.status(200).json({ success: true, message: "Cập nhật phiếu nhập thành công!", ticket });

//     } catch (err) {
//         return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
//     }
// };