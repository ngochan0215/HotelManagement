import mongoose from "mongoose";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";

export class EquipmentImportService {
    constructor({ Equipment, EquipmentCategory, EquipmentLog, ImportTicket, ImportDetail, eventBus }) {
        this.Equipment = Equipment;
        this.EquipmentCategory = EquipmentCategory;
        this.EquipmentLog = EquipmentLog;
        this.ImportTicket = ImportTicket;
        this.ImportDetail = ImportDetail;
        this.eventBus = eventBus;
    }

    validateImportItems = async (items) => {
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
    
        const count = await this.EquipmentCategory.countDocuments({
            _id: { $in: categoryIds },
        });
    
        if (count !== categoryIds.length) {
            throw new Error("Có category_id không tồn tại trong hệ thống");
        }
    };

    createEquipmentTicket = async (employeeUserId, data) => {
        try {
            const { import_date, total_fee, items } = data;
            let employee;

            if (!employeeUserId || !import_date)
                throw new Error("Yêu cầu nhập thông tin đầy đủ.");

            if (employeeUserId) {
                const reply = await this.eventBus.safeRequest(
                    EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
                    { employee_user_id: employeeUserId }
                );

                if (!reply.success)
                    throw new Error(reply.message || "Không tìm thấy nhân viên.");

                employee = reply.employee;
            }

            const existing = await this.ImportTicket.findOne({ import_date });
            if (existing)
                throw new Error("Có một phiếu nhập trùng ngày nhập, bạn có thể tìm kiếm và thêm thiết bị nhập ở phiếu đó.");

            const importDate = new Date(import_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            importDate.setHours(0, 0, 0, 0);

            if (importDate < today) {
                throw new Error("Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại.");
            }

            const status = importDate.getTime() === today.getTime() ? "waiting_confirm" : "pending";

            const ticket = await this.ImportTicket.create({ 
                employee_id: employee._id, 
                import_date, status, total_fee 
            });

            await this.validateImportItems(items);

            const importDetails = items.map((item) => ({
                ticket_id: ticket._id,
                category_id: item.category_id,
                import_price: item.import_price,
                import_quantity: item.import_quantity,
            }));

            await this.ImportDetail.insertMany(importDetails);

            return ticket;

        } catch (err) {
            console.log("Error in creating import equipment ticket: ", err.message);
            throw err;
        }
    };

    getAllEquipmentTickets = async (query = {}) => {
        try {
            const { employee_id, min_import_date, max_import_date, status } = query;
            let filter = {};

            if (employee_id) {
                const reply = await this.eventBus.safeRequest(
                    EMPLOYEE_EVENTS.CHECK_EXISTS,
                    { employee_id }
                );

                if (!reply.success)
                    throw new Error(reply.message || "Không tìm thấy nhân viên.");

                filter.employee_id = employee_id;
            }

            if (min_import_date || max_import_date) {
                filter.import_date = {};
                if (min_import_date) filter.import_date.$gte = new Date(min_import_date);
                if (max_import_date) filter.import_date.$lte = new Date(max_import_date);
            }

            if (status) filter.status = status;

            const tickets = await this.ImportTicket.find(filter)
                .sort({ import_date: -1 })
                .select("-__v -updated_at -created_at")
                .lean();

            const employeeIds = [...new Set(
                tickets
                    .map(t => t.employee_id?.toString())
                    .filter(Boolean)
            )];

            let employeeMap = {};

            if (employeeIds.length > 0) {
                const reply = await this.eventBus.safeRequest(
                    EMPLOYEE_EVENTS.GET_INFO,
                    { employee_ids: employeeIds }
                );
                if (!reply.success) 
                    throw new Error(reply.message);

                for (const emp of reply.employees) {
                    employeeMap[emp._id.toString()] = emp;
                }
            }

            const ticketIds = tickets.map(t => t._id);

            const imports = await this.ImportDetail.find({ ticket_id: { $in: ticketIds } })
                .populate("category_id", "name")
                .select("-__v -updated_at -created_at")
                .lean();

            const importMap = {};
            for (const item of imports) {
                const key = item.ticket_id.toString();
                if (!importMap[key]) 
                    importMap[key] = [];

                importMap[key].push(item);
            }

            const result = tickets.map(ticket => ({
                ...ticket,
                employee_info: employeeMap[ticket.employee_id?.toString()] || null,
                import_details: importMap[ticket._id.toString()] || [],
            }));

            return { total_tickets: result.length, tickets: result };

        } catch (err) {
            console.log("Error in getting all import equipment tickets: ", err.message);
            throw err;
        }
    };

    getEquipmentTicketById = async (ticketId) => {
        try {
            const ticket = await this.ImportTicket.findById(ticketId).select("-__v -updated_at -created_at");
            if (!ticket)
                throw new Error("Không tìm thấy phiếu nhập thiết bị.");

            const imports = await this.ImportDetail.find({ ticket_id: ticketId })
                .populate("category_id", "name unit price -_id")
                .select("-__v -created_at -updated_at -ticket_id");

            return { ticket, ticket_details: imports };

        } catch (err) {
            console.log("Error in getting specific import equipment ticket: ", err.message);
            throw err;
        }
    };

    updateEquipmentTicket = async (ticketId, updateData) => {
        try {
            const { import_date, total_fee, items } = updateData;

            if (!mongoose.Types.ObjectId.isValid(ticketId)) {
                throw new Error("ID phiếu nhập không hợp lệ");
            }

            const ticket = await this.ImportTicket.findById(ticketId);
            if (!ticket) {
                throw new Error("Không tìm thấy phiếu nhập");
            }

            if (ticket.status !== "pending") {
                throw new Error("Chỉ được sửa phiếu nhập ở trạng thái pending");
            }

            const today = new Date();
            today.setHours(0,0,0,0);

            const ticketDate = new Date(ticket.import_date);
            ticketDate.setHours(0,0,0,0);

            if (ticketDate <= today) {
                throw new Error("Không thể sửa khi đã đến hoặc qua ngày nhập thiết bị");
            }

            if (!items || !Array.isArray(items) || items.length === 0) {
                throw new Error("Phiếu nhập phải có ít nhất một chi tiết");
            }

            await this.validateImportItems(items);

            if (import_date) {
                const importDate = new Date(import_date);
                importDate.setHours(0, 0, 0, 0);

                if (importDate < today) {
                    throw new Error("Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại.");
                }

                if (importDate.getTime() === today.getTime())
                    ticket.status = "waiting_confirm"

                ticket.import_date = import_date;
                await ticket.save();
            }

            if (total_fee) ticket.total_fee = total_fee;

            await this.ImportDetail.deleteMany({ ticket_id: ticket._id });

            const importDetails = items.map(item => ({
                ticket_id: ticket._id,
                category_id: item.category_id,
                import_price: item.import_price,
                import_quantity: item.import_quantity,
            }));

            await this.ImportDetail.insertMany(importDetails);

            return { success: true };

        } catch (err) {
            console.log("Error in updating import equipment ticket: ", err.message);
            throw err;
        }
    };

    deleteEquipmentTicket = async (ticketId, force) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(ticketId)) {
                throw new Error("ID phiếu nhập thiết bị không hợp lệ!");
            }

            const ticket = await this.ImportTicket.findById(ticketId);
            if (!ticket) {
                throw new Error("Không tìm thấy phiếu nhập thiết bị.");
            }

            if (ticket.status !== "pending") {
                throw new Error("Chỉ được xóa phiếu nhập ở trạng thái pending.");
            }

            const now = new Date();
            if (ticket.import_date && now >= new Date(ticket.import_date)) {
                throw new Error("Không thể xóa vì đã đến hoặc qua ngày nhập thiết bị.");
            }

            const relatedImports = await this.ImportDetail.find({ ticket_id: ticketId });

            if (relatedImports.length > 0 && !force) {
                throw new Error(`Phiếu có ${relatedImports.length} chi tiết nhập. Dùng ?force=true để xóa.`);
            }

            await this.ImportDetail.deleteMany({ ticket_id: ticketId });

            await this.ImportTicket.deleteOne({ _id: ticketId });

            return { success: true };
        } catch (err) {
            console.log("Error in deleting import equipment ticket: ", err.message);
            throw err;
        }
    };

    confirmEquipmentImportTicket = async (ticketId, adminId) => {
        try {
            const now = new Date();
        
            const ticket = await this.ImportTicket.findById(ticketId);
            if (!ticket)
                throw new Error("Không tìm thấy phiếu nhập thiết bị.");
        
            if (ticket.status !== "waiting_confirm")
                throw new Error("Phiếu chưa đến ngày nhập kho.");
        
            const imports = await this.ImportDetail.find({ ticket_id: ticket._id });
        
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
        
                const createdEquipments = await this.Equipment.insertMany(equipments);
        
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
        
                await this.EquipmentLog.insertMany(logs);
        
                await this.EquipmentCategory.updateOne(
                    { _id: item.category_id },
                    { $inc: { storage_quantity: item.import_quantity } }
                );
            }
        
            ticket.status = "completed";
            ticket.confirmed_by = adminId;
            ticket.confirmed_at = now;
            await ticket.save();
        
            return { success: true };

        } catch (err) {
            console.log("Error in confirm import equipment ticket: ", err.message);
            throw err;
        }
    };
    
    getOutOfStockCategories = async () => {
        try {
            const outOfStockCategories = await this.EquipmentCategory.find({ storage_quantity: { $lte: 10 } })
                .select("_id name description unit price storage_quantity");

            return { categories: outOfStockCategories, count: outOfStockCategories.length };
    
        } catch (err) {
            console.log("Error in getting low-stock equipments: ", err.message);
            throw err;
        }
    };
    
    autoCreateImportTicket = async (employeeUserId, data) => {
        try {
            const { import_date, default_quantity = 10, default_price_percent = 0.8 } = data;
            let employee;
           
            if (!employeeUserId) {
                throw new Error("Yêu cầu employeeUserId.");
            }
            if (employeeUserId) {
                const reply = await this.eventBus.safeRequest(
                    EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
                    { employee_user_id: employeeUserId }
                );
                if (!reply.success)
                    throw new Error(reply.message || "Không tìm thấy nhân viên.");
            
                employee = reply.employee;
            }
    
            let items = data.items;
            let outOfStockCategories = [];
    
            if (items && Array.isArray(items) && items.length > 0) {
                await this.validateImportItems(items);

                const categoryIds = items.map(item => item.category_id);

                outOfStockCategories = await this.EquipmentCategory.find({
                    _id: { $in: categoryIds }
                });
            } else {
                outOfStockCategories = await this.EquipmentCategory.find({
                    storage_quantity: 0
                });
    
                if (outOfStockCategories.length === 0) {
                    return { ticket_id: null, items_count: 0 };
                }
    
                items = outOfStockCategories.map(category => ({
                    category_id: category._id,
                    import_quantity: default_quantity,
                    import_price: Math.round(category.price * default_price_percent)
                }));
            }
    
            if (!items || items.length === 0) {
                throw new Error("Không có thiết bị nào để tạo phiếu nhập.");
            }
    
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let importDate;
            
            if (import_date) {
                importDate = new Date(import_date);
                importDate.setHours(0, 0, 0, 0);
                if (importDate < today) {
                    throw new Error("Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại.");
                }

            } else {
                importDate = new Date(today);
                //importDate.setDate(importDate.getDate() + 1);
            }
    
            const existing = await this.ImportTicket.findOne({ import_date: importDate });
            if (existing) {
                throw new Error(`Đã có phiếu nhập cho ngày ${importDate.toISOString().split('T')[0]}. Vui lòng cập nhật phiếu đó hoặc chọn ngày khác.`);
            }
    
            const status = importDate.getTime() === today.getTime() ? "waiting_confirm" : "pending";
            const total_fee = items.reduce((sum, item) => sum + (item.import_price * item.import_quantity), 0);
    
            const ticket = await this.ImportTicket.create({ 
                employee_id: employee._id, import_date: importDate, status, total_fee
            });
    
            const ticketId = ticket._id;
    
            const importDetails = items.map((item) => ({
                ticket_id: ticketId,
                category_id: item.category_id,
                import_price: item.import_price,
                import_quantity: item.import_quantity,
            }));
    
            await this.ImportDetail.insertMany(importDetails);
    
            return { ticket_id: ticketId, items_count: items.length, import_date: importDate };
    
        } catch (err) {
            console.log("Error in auto creating import equipment ticket: ", err.message);
            throw err;
        }
    };
}