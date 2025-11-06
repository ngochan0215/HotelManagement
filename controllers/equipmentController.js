import { Equipment, EquipmentCategory, EquipmentTicket, EquipmentImport, Room } from "../models/index.js";
import mongoose from "mongoose";

//------EQUIPMENT CATEGORY------//
export const createEquipmentCategory = async (req, res) => {
    try {
        const { name, description, unit, price } = req.body;

        if (!name || !price || !description || !unit ) {
            return res.status(400).json({ success: false, message: "Yêu cầu nhập đầy đủ tất cả thông tin!" });
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
        const categories = await EquipmentCategory.find().sort({ createdAt: -1 }).select("-created_at -updated_at -__v");
        return res.status(200).json({ success: true, categories });
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

        const updated = await EquipmentCategory.findByIdAndUpdate(id, updateData, { new: true });
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
            .select("-__v")
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
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const equipment = await Equipment.findById(id)
            .populate("category_id", "name unit price")
            .populate("room_id", "room_number room_status")
            .select("-__v");

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

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const equipment = await Equipment.findById(id);
        if (!equipment)
            return res.status(404).json({ success: false, message: "Không tìm thấy thiết bị." });

        if (room_id !== undefined) {
            if (room_id === null || room_id === "") {
                equipment.room_id = undefined; // unassign
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

        if (note !== undefined) equipment.note = note;

        await equipment.save();
        const updated = await Equipment.findById(id)
            .populate("category_id", "name unit price")
            .populate("room_id", "room_number room_status")
            .select("-__v");

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

//------ EQUIPMENT TICKET ------//
export const createEquipmentTicket = async (req, res) => {
    try {
        const { employee_id, import_date } = req.body;

        if (!employee_id || !import_date)
            return res.status(400).json({ success: false, message: "Yêu cầu nhập thông tin đầy đủ." });

        if (!mongoose.Types.ObjectId.isValid(employee_id))
            return res.status(400).json({ success: false, message: "ID nhân viên không hợp lệ!" });

        const existing = await EquipmentTicket.findOne({ import_date });
        if (existing)
            return res.status(400).json({ success: false, message: "Có một phiếu nhập trùng ngày nhập, bạn có thể tìm kiếm và thêm thiết bị nhập ở phiếu đó." });

        const importDate = new Date(import_date);
        const now = new Date();
        if (importDate < new Date(now.toDateString())) {
            return res.status(400).json({ success: false, message: "Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại." });
        }

        const ticket = new EquipmentTicket({ employee_id, import_date: importDate });
        await ticket.save();

        return res.status(201).json({ success: true, message: "Tạo phiếu nhập thành công! Phiếu đang ở trạng thái chờ nhập.", ticket });

    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const getAllEquipmentTickets = async (req, res) => {
    try {
        const tickets = await EquipmentTicket.find()
            .sort({ import_date: -1 })
            .select("-__v -updated_at");

        return res.status(200).json({ success: true, count: tickets.length, tickets });
    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const getEquipmentTicketById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const ticket = await EquipmentTicket.findById(id).select("-__v -updated_at");
        if (!ticket)
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập thiết bị." });

        // include imports
        const imports = await EquipmentImport.find({ ticket_id: id })
            .populate("category_id", "name unit price -_id")
            .select("-__v -created_at -updated_at -ticket_id");

        return res.status(200).json({ success: true, ticket, imports });
    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const updateEquipmentTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { import_date } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const ticket = await EquipmentTicket.findById(id);
        if (!ticket)
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập thiết bị." });
        
        const now = new Date();
        if (ticket.import_date && now >= new Date(ticket.import_date)) {
            return res.status(400).json({
                success: false,
                message: "Không thể chỉnh sửa vì đã đến hoặc qua ngày nhập thiết bị."
            });
        }

        if (import_date) {
            const importDate = new Date(import_date);
            const now = new Date();
            if (importDate < new Date(now.toDateString())) {
                return res.status(400).json({ success: false, message: "Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại." });
            }
            ticket.import_date = importDate;
        }

        await ticket.save();
        return res.status(200).json({ success: true, message: "Cập nhật phiếu nhập thành công!", ticket });

    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const deleteEquipmentTicket = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const force = req.query?.force === 'true';

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const ticket = await EquipmentTicket.findById(id);
        if (!ticket){
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập thiết bị." });
        }

        const now = new Date();
        if (ticket.import_date && now >= new Date(ticket.import_date)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Không thể xóa vì đã đến hoặc qua ngày nhập thiết bị."
            });
        }

        const relatedImports = await EquipmentImport.find({ ticket_id: id }).lean();
        if (relatedImports.length > 0 && !force) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: `Phiếu có ${relatedImports.length} chi tiết nhập. Dùng ?force=true để xóa phiếu nhập.` });
        }

        await EquipmentImport.deleteMany({ ticket_id: id });
        await EquipmentTicket.deleteOne({ _id: id });
        return res.status(200).json({ success: true, message: "Xóa phiếu nhập thiết bị thành công!" });

    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

//------ EQUIPMENT IMPORT (each record represents a category import with quantity) ------//
export const createEquipmentImport = async (req, res) => {
    try {
        const { ticket_id, category_id, import_price, import_quantity } = req.body;

        if (!ticket_id || !category_id)
            return res.status(400).json({ success: false, message: "Yêu cầu ticket_id và category_id" });

        if (!mongoose.Types.ObjectId.isValid(ticket_id) || !mongoose.Types.ObjectId.isValid(category_id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const ticket = await EquipmentTicket.findById(ticket_id);
        if (!ticket) return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập thiết bị." });
        
        if (ticket.status === "completed")
            return res.status(400).json({ success: false, message: "Phiếu đã hoàn tất, không thể thêm chi tiết mới." });

        const category = await EquipmentCategory.findById(category_id);
        if (!category) return res.status(404).json({ success: false, message: "Không tìm thấy danh mục thiết bị." });

        const qty = Number(import_quantity ?? 1);
        if (!Number.isInteger(qty) || qty <= 0) {
            return res.status(400).json({ success: false, message: "Số lượng nhập phải là số nguyên dương." });
        }

        const equipmentImport = new EquipmentImport({
            ticket_id,
            category_id,
            import_price: import_price || 0,
            import_quantity: qty,
        });

        await equipmentImport.save();

        const now = new Date();
        if (ticket.import_date && now == new Date(ticket.import_date)) {
            // Create N physical equipments in stock with condition new
            const equipmentsToCreate = Array.from({ length: qty }, () => ({ category_id, status: "in-stock", condition: "new" }));
            const createdEquipments = await Equipment.insertMany(equipmentsToCreate);
            // Increase storage count by quantity
            await EquipmentCategory.updateOne({ _id: category_id }, { $inc: { storage_quantity: qty } });
            return res.status(201).json({ success: true, import: equipmentImport, created_count: createdEquipments.length });
        }
        
        return res.status(201).json({ success: true, message: "Thêm chi tiết phiếu nhập thành công!", equipmentImport });

    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const getAllEquipmentImports = async (req, res) => {
    try {
        const { ticket_id, category_id } = req.query;
        const filter = {};
        if (ticket_id) {
            if (!mongoose.Types.ObjectId.isValid(ticket_id))
                return res.status(400).json({ success: false, message: "ID phiếu không hợp lệ!" });
            filter.ticket_id = ticket_id;
        }
        if (category_id) {
            if (!mongoose.Types.ObjectId.isValid(category_id))
                return res.status(400).json({ success: false, message: "ID danh mục không hợp lệ!" });
            filter.category_id = category_id;
        }

        const imports = await EquipmentImport.find(filter)
            .populate("ticket_id", "employee_id import_date")
            .populate("category_id", "name unit price")
            .select("-__v")
            .sort({ created_at: -1 });

        return res.status(200).json({ success: true, count: imports.length, imports });

    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const getEquipmentImportById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const imp = await EquipmentImport.findById(id)
            .populate("ticket_id", "employee_id import_date")
            .populate("category_id", "name unit price")
            .select("-__v");

        if (!imp) return res.status(404).json({ success: false, message: "Không tìm thấy chi tiết nhập thiết bị." });

        return res.status(200).json({ success: true, import: imp });
    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const updateEquipmentImport = async (req, res) => {
    try {
        const { id } = req.params;
        const { import_price, import_quantity } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const imp = await EquipmentImport.findById(id);
        if (!imp) return res.status(404).json({ success: false, message: "Không tìm thấy chi tiết nhập thiết bị." });

        // Lấy ngày nhập từ phiếu tương ứng
        const ticket = await EquipmentTicket.findById(imp.ticket_id);
        if (!ticket)
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập liên kết." });

        const now = new Date();
        if (ticket.import_date && now >= new Date(ticket.import_date)) {
            return res.status(400).json({
                success: false,
                message: "Không thể chỉnh sửa vì đã đến hoặc qua ngày nhập thiết bị."
            });
        }

        if (import_price !== undefined) imp.import_price = import_price;
        if (import_quantity !== undefined) imp.import_quantity = import_quantity;

        await imp.save();
        return res.status(200).json({ success: true, message: "Cập nhật chi tiết nhập thành công!", import: imp });

    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const deleteEquipmentImport = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id))
            return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

        const imp = await EquipmentImport.findById(id);
        if (!imp){
            const session = await mongoose.startSession();
            session.startTransaction();
            return res.status(404).json({ success: false, message: "Không tìm thấy chi tiết nhập thiết bị." });
        } 

        const ticket = await EquipmentTicket.findById(imp.ticket_id).session(session);
        if (!ticket) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập liên kết." });
        }

        const now = new Date();
        if (ticket.import_date && now >= new Date(ticket.import_date)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: "Không thể xóa vì đã đến hoặc qua ngày nhập thiết bị."
            });
        }

        await EquipmentImport.deleteOne({ _id: id });
        return res.status(200).json({ success: true, message: "Xóa chi tiết nhập thiết bị thành công!" });

    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};


export const confirmEquipmentTicket = async (req, res) => {
    try {
        const { id } = req.params;

        const ticket = await EquipmentTicket.findById(id);
        if (!ticket)
            return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập thiết bị." });

        if (ticket.status === "completed") {
            return res.status(400).json({ success: false, message: "Phiếu nhập này đã hoàn thành trước đó." });
        }

        const now = new Date();
        if (ticket.import_date && now < new Date(ticket.import_date)) {
            return res.status(400).json({ success: false, message: "Chưa đến ngày nhập, không thể xác nhận nhập kho." });
        }

        const imports = await EquipmentImport.find({ ticket_id: id });
        if (imports.length === 0) {
            return res.status(400).json({ success: false, message: "Phiếu nhập không có chi tiết thiết bị nào." });
        }

        for (const imp of imports) {
            const qty = imp.import_quantity || 0;
            if (qty <= 0) continue;

            const category = await EquipmentCategory.findById(imp.category_id);
            if (!category) continue;

            // Tạo thiết bị trong kho
            const newEquipments = [];
            for (let i = 0; i < qty; i++) {
                newEquipments.push({
                    category_id: category._id,
                    status: "in-stock",
                    condition: "new",
                    import_ticket_id: ticket._id,
                    import_date: ticket.import_date
                });
            }

            if (newEquipments.length > 0)
                await Equipment.insertMany(newEquipments);

            // Cập nhật số lượng tồn kho
            await EquipmentCategory.updateOne({ _id: category._id }, { $inc: { storage_quantity: qty } });
        }

        ticket.status = "completed";
        await ticket.save();
        return res.status(200).json({ success: true, message: "Xác nhận nhập kho thành công!", ticket });

    } catch (err) {
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};
