import mongoose from "mongoose";
import { ROOM_EVENTS } from "../../../shared/events/roomEvents.js";

export class EquipmentService {
    constructor({ Equipment, EquipmentCategory, EquipmentLog, eventBus }) {
        this.Equipment = Equipment;
        this.EquipmentCategory = EquipmentCategory;
        this.EquipmentLog = EquipmentLog;
        this.eventBus = eventBus;
    }   

    // category

    createEquipmentCategory = async (data) => {
        try {
            const { warehouse, type, name, description, unit, price } = data;

            if (!warehouse || !name || !price || !description || !unit ) {
                throw new Error("Yêu cầu nhập đầy đủ tất cả thông tin!");
            }

            if (typeof name !== "string" || typeof description !== "string" || typeof unit !== "string") {
                throw new Error("Tên, mô tả và đơn vị phải là chuỗi.");
            }

            if (isNaN(price) || Number(price) <= 0) {
                throw new Error("price phải là số lớn hơn 0");
            }

            if (name.length < 5 || name.length > 100) {
                throw new Error("Tên danh mục phải từ 10 đến 100 ký tự");
            }

            const validWarehouse = ["housekeeping", "fb", "technical"];
            if (!validWarehouse.includes(warehouse)) {
                throw new Error("Kho lưu trữ không hợp lệ.");
            }

            const existing = await this.EquipmentCategory.findOne({ name });
            if (existing) {
                throw new Error("Tên danh mục đã tồn tại.");
            }

            const equipmentCategory = await this.EquipmentCategory.create({ 
                warehouse, name, description, unit, price,
                type: type || "single"
            });

            return equipmentCategory;
        } catch (err) {
            console.log("Error in creating equipment category: ", err.message);
            throw err;
        }
    };

    getAllEquipmentCategories = async (query = {}) => {
        try {
            const { min_price, max_price, min_storage, max_storage, 
                page = 1, limit = 10, sort_by = "created_at", order = "desc"
            } = query;

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

            const currentPage = Math.max(Number(page), 1);
            const pageSize = Math.max(Number(limit), 1);
            const skip = (currentPage - 1) * pageSize;
            const sort = {
                [sort_by]: order === "asc" ? 1 : -1
            };

            const [categories, total] = await Promise.all([
                this.EquipmentCategory.find(filter)
                    .select("-__v -created_at -updated_at")
                    .sort(sort)
                    .skip(skip)
                    .limit(pageSize)
                    .lean(),

                this.EquipmentCategory.countDocuments(filter)
            ]);

            return {
                total, 
                categories,
                pagination: {
                    total,
                    page: currentPage,
                    limit: pageSize,
                    total_pages: Math.ceil(total / pageSize),
                    has_next: currentPage * pageSize < total,
                    has_prev: currentPage > 1
                }
            };

        } catch (err) {
            console.log("Error in getting all equipment categories: ", err.message);
            throw err;
        }
    };

    getEquipmentCategoryById = async (categoryId) => {
        try {
            const category = await this.EquipmentCategory.findById(categoryId)
                .select("-created_at -updated_at -__v");

            if (!category) {
                throw new Error("Không tìm thấy danh mục thiết bị.");
            }
            
            return category;

        } catch (err) {
            console.log("Error in getting specific equipment category: ", err.message);
            throw err;
        }
    };

    getEquipmentCategoriesByIds = async (categoryIds) => {
        try {
            const categories = await this.EquipmentCategory.find({ _id: { $in: categoryIds } })
                .select("-created_at -updated_at -__v");

            if (categories.length === 0) {
                throw new Error("Không tìm thấy danh mục thiết bị.");
            }

            return categories;

        } catch (err) {
            console.log("Error in getting specific equipment categories: ", err.message);
            throw err;
        }
    };

    updateEquipmentCategory = async (categoryId, updateData) => {
        try {
            const category = await this.EquipmentCategory.findById(categoryId);
            if (!category) {
                throw new Error("Không tìm thấy danh mục thiết bị.");
            }

            if (updateData.name) {
                const duplicate = await this.EquipmentCategory.findOne({ name: updateData.name, _id: { $ne: categoryId } });
                if (duplicate)
                    throw new Error("Tên danh mục thiết bị đã tồn tại!");

                const name = updateData.name;
                if (name.length < 5 || name.length > 100) {
                    throw new Error("Tên danh mục phải từ 10 đến 100 ký tự");
                }
            }

            if (updateData.price) {
                if (isNaN(price) || Number(price) <= 0) {
                    throw new Error("price phải là số lớn hơn 0");
                }
            }

            if (updateData.warehouse) {
                const validWarehouse = ["housekeeping", "fb", "technical"];
                if (!validWarehouse.includes(warehouse)) {
                    throw new Error("Kho lưu trữ không hợp lệ.");
                }
            }

            const updated = await this.EquipmentCategory.findByIdAndUpdate(categoryId, updateData, { new: true })
                .select("-__v -updated_at -created_at");
            
            return updated;
            
        } catch (err) {
            console.log("Error in updating equipment category: ", err.message);
            throw err;
        }
    };

    deleteEquipmentCategory = async (categoryId, force) => {
        try {
            const category = await this.EquipmentCategory.findById(categoryId);
            if (!category) {
                throw new Error("Không tìm thấy danh mục thiết bị.");
            }

            const relatedEquipmentCount = await this.Equipment.countDocuments({ category_id: categoryId });
            if (relatedEquipmentCount > 0 && !force) {
                throw new Error(`Loại danh mục này có ${relatedEquipmentCount} thiết bị. Dùng ?force=true để xóa tất cả các thiết bị thuộc danh mục này.`);
            }
            if (force) {
                await this.Equipment.deleteMany({ category_id: categoryId });
            }

            await this.EquipmentCategory.findByIdAndDelete(categoryId);

            return { success: true };

        } catch (err) {
            console.log("Error in deleting equipment category: ", err.message );
            throw err;
        }
    };

    syncEquipmentCategoryQuantities = async () => {
        try {
            const categories = await this.EquipmentCategory.find({});
        
            const results = [];
            let updatedCount = 0;
        
            for (const category of categories) {
                const categoryId = category._id;
            
                const totalQuantity = await this.Equipment.countDocuments({
                    category_id: categoryId
                });
            
                const storageQuantity = await this.Equipment.countDocuments({
                    category_id: categoryId,
                    status: "in-stock",
                    condition: { $in: ["new", "good"] },
                    room_id: null
                });
            
                const oldTotal = category.total_quantity || 0;
                const oldStorage = category.storage_quantity || 0;
            
                category.total_quantity = totalQuantity;
                category.storage_quantity = storageQuantity;
                await category.save();
            
                updatedCount++;
            
                if (oldTotal !== totalQuantity || oldStorage !== storageQuantity) {
                    results.push({
                        category_id: categoryId,
                        category_name: category.name,
                        old_total: oldTotal,
                        new_total: totalQuantity,
                        old_storage: oldStorage,
                        new_storage: storageQuantity
                    });
                }
            }

            return { 
                total_categories: updatedCount,
                updated_categories: results.length,
                details: results
            }
        
        } catch (error) {
            console.log("Error in syncing equipment quantities: ", error.message);
            throw error;
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

    // helper
    populateRoom = async (equipments) => {
        const isArray = Array.isArray(equipments);
        const list = isArray ? equipments : [equipments];
        //console.log("LIST: ", list);
        const roomIds = [...new Set(
            list
                .map(e => e.room_id?.toString())
                .filter(Boolean)
        )];

        let roomMap = {};

        if (roomIds.length > 0) {
            const reply = await this.eventBus.request(
                ROOM_EVENTS.GET_ROOMS_INFO,
                { room_ids: roomIds }
            );
            if(!reply.success)
                throw new Error(reply.message);

            for (const room of reply.rooms) {
                roomMap[room._id.toString()] = {
                    _id: room._id,
                    room_number: room.room_number,
                    room_status: room.room_status
                }
            }
        }

        // return equipments.map(equipment => {
        //     const key = equipment.room_id?.toString();

        //     return {
        //         ...equipment,
        //         room_id: key && roomMap[key] ? roomMap[key] : null
        //     };
        // });

        const results = list.map(equipment => ({
            ...equipment,
            room_info: roomMap[equipment.room_id?.toString()] || null
        }));

        return isArray ? results : results[0];
    };

    // equipment

    getAllEquipments = async (query = {}) => {
        try {
            const { category_id, status, condition, room_id, 
                page = 1, limit = 10, sort_by = "created_at", order = "desc"
            } = query;
            const filter = {};

            if (category_id) {
                if (!mongoose.Types.ObjectId.isValid(category_id))
                    throw new Error("ID danh mục không hợp lệ!");
                filter.category_id = category_id;
            }

            if (room_id) {
                if (!mongoose.Types.ObjectId.isValid(room_id))
                    throw new Error("ID phòng không hợp lệ!");
                filter.room_id = room_id;
            }

            if (status) {
                const validStatuses = ["in-stock", "in-use", "maintenance", "lost", "disposed"];
                if (!validStatuses.includes(status))
                    throw new Error("Trạng thái thiết bị không hợp lệ!");
                filter.status = status;
            }

            if (condition) {
                const validConditions = ["new", "good", "maintenance", "broken"];
                if (!validConditions.includes(condition))
                    throw new Error("Tình trạng thiết bị không hợp lệ!");
                filter.condition = condition;
            }

            const currentPage = Math.max(Number(page), 1);
            const pageSize = Math.max(Number(limit), 1);
            const skip = (currentPage - 1) * pageSize;
            const sort = {
                [sort_by]: order === "asc" ? 1 : -1
            };

            const [equipments, total] = await Promise.all([
                this.Equipment.find(filter)
                    .populate("category_id", "name unit price")
                    .select("-__v -created_at -updated_at")
                    .sort(sort)
                    .skip(skip)
                    .limit(pageSize)
                    .lean(),

                this.Equipment.countDocuments(filter)
            ]);

            const results = await this.populateRoom(equipments);
            return {
                data: results,
                pagination: {
                    total,
                    page: currentPage,
                    limit: pageSize,
                    total_pages: Math.ceil(total / pageSize),
                    has_next: currentPage * pageSize < total,
                    has_prev: currentPage > 1
                }
            };

        } catch (err) {
            console.log("Error in getting all equipments: ", err.message );
            throw err;
        }
    };

    getEquipmentById = async (equipmentId) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(equipmentId))
                throw new Error("ID thiết bị không hợp lệ!");

            const equipment = await this.Equipment.findById(equipmentId)
                .populate("category_id", "name unit price")
                .select("-__v -created_at -updated_at")
                .lean();

            if (!equipment)
                throw new Error("Không tìm thấy thiết bị.");

            const result = await this.populateRoom(equipment);

            return result;

        } catch (err) {
            console.log("Error in getting specific equipment: ", err.message );
            throw err;
        }
    };

    updateEquipment = async (equipmentId, userId, updateData) => {
        try {
            const { status, condition, note } = updateData;

            if (!mongoose.Types.ObjectId.isValid(equipmentId))
                throw new Error("ID không hợp lệ!");

            const employee = await this.Employee.findOne({ user_id: userId });
            if (!employee)
                throw new Error("Không xác định được nhân viên.");

            const equipment = await this.Equipment.findById(equipmentId);
            if (!equipment)
                throw new Error("Không tìm thấy thiết bị.");

            let isChanged = false;

            if (condition !== undefined) {
                const validConditions = ["good", "maintenance", "broken"];

                if (!validConditions.includes(condition))
                    throw new Error("Tình trạng thiết bị không hợp lệ!");

                if ( equipment.condition === "good" && condition === "broken" && !note ) {
                    throw new Error("Chuyển thiết bị từ tốt sang hỏng cần ghi chú lý do.");
                }

                // Chỉ cho về good khi đang maintenance
                if (equipment.condition !== "maintenance" && condition === "good") {
                    throw new Error("Chỉ có thể chuyển thiết bị về tốt từ trạng thái bảo trì.");
                }

                if (equipment.condition !== condition) {
                    equipment.condition = condition;
                    isChanged = true;
                }
            }

            if (status !== undefined) {
                const allowedManualStatuses = ["lost", "maintenance", "disposed", "removing"];

                if (!allowedManualStatuses.includes(status)) {
                    throw new Error("Không được chỉnh thủ công trạng thái này.");
                }

                if (status === "maintenance" && equipment.condition !== "maintenance" && condition !== "maintenance") {
                    throw new Error ("Trạng thái và tình trạng thiết bị phải cùng lúc bảo trì.");
                }

                if (status === "disposed" && (equipment.condition !== "broken" || condition !== "broken")) {
                    throw new Error ("Nếu trạng thái thiết bị là disposed thì tình trạng phải là broken.");
                }

                if (equipment.status !== status) {
                    equipment.status = status;
                    isChanged = true;
                }
            }

            if (!isChanged)
                throw new Error ("Không có thay đổi nào hợp lệ.");

            if (status && status === "lost") condition = equipment.condition;

            await equipment.save();

            await this.EquipmentLog.findOneAndUpdate(
                {
                    equipment_id: equipmentId,
                    end_time: null,
                },
                {
                    end_time: new Date(),
                }
            );

            await this.EquipmentLog.create({
                equipment_id: equipmentId,
                room_id: equipment.room_id,
                condition,
                status,
                start_time: new Date(),
                end_time: null,
                note: note || "Admin cập nhật trạng thái thiết bị thủ công.",
                handled_by: employee._id,
            });

            const updated = await this.Equipment.findById(equipmentId)
                .populate("category_id", "name unit price")
                .select("-__v -created_at -updated_at")
                .lean();

            const result = await this.populateRoom(updated);

            return result;

        } catch (err) {
            console.log("Error in updating equipment: ", err.message );
            throw err;
        }
    };

    deleteEquipment = async (equipmentId) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(equipmentId))
                throw new Error("ID không hợp lệ!");

            const equipment = await this.Equipment.findById(equipmentId);
            if (!equipment)
                throw new Error("Không tìm thấy thiết bị.");

            if (equipment.status === "in-use" || equipment.status === "maintenance") {
                throw new Error(`Không thể xóa thiết bị đang ở trạng thái "${equipment.status}".`);
            }

            await this.Equipment.findByIdAndDelete(equipmentId);

            return { success: true };

        } catch (err) {
            console.log("Error in deleting equipment: ", err.message );
            throw err;
        }
    };

    getEquipmentsByIds = async (equipmentIds) => {
        try {
            const invalidIds = equipmentIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
            if (invalidIds.length > 0)
                throw new Error(`ID thiết bị không hợp lệ: ${invalidIds.join(", ")}`);

            const equipments = await this.Equipment.find({ _id: { $in: equipmentIds } })
                .populate("category_id", "name unit price")
                .select("-__v -created_at -updated_at")
                .lean();

            if (!equipments.length)
                throw new Error("Không tìm thấy thiết bị nào.");

            //const results = await Promise.all(equipments.map(eq => this.populateRoom(eq)));

            return equipments;

        } catch (err) {
            console.log("Error in getting equipments by ids: ", err.message);
            throw err;
        }
    };

    // communication
    async updateEquipmentLog(equipmentId, updateData = {}) {
        try {
            const now = new Date();

            const updated = await this.EquipmentLog.findOneAndUpdate(
                { 
                    equipment_id: equipmentId, 
                    end_time: null 
                },
                { 
                    ...updateData, 
                    end_time: now 
                },
                {
                    new: true
                }
            );

            return updated;
        } catch (err) {
            console.log("Error updating equipment log:", err.message);
            throw err;
        }
    }

    async createEquipmentLog({ equipment_id, room_id = null, condition, status, note, handled_by }) {
        try {
            const now = new Date();

            const log = await this.EquipmentLog.create({
                equipment_id,
                room_id,
                condition,
                status,
                start_time: now,
                end_time: null,
                note: note || null,
                handled_by,
            });

            return log;

        } catch (err) {
            console.log("Error creating equipment log:", err.message);
            throw err;
        }
    }

    async updateEquipmentInternal (equipmentId, updateData = {}) {
        try {
            const { condition, status, note, handled_by } = updateData;

            if (!mongoose.Types.ObjectId.isValid(equipmentId))
                throw new Error("ID không hợp lệ!");

            const equipment = await this.Equipment.findById(equipmentId);
            if (!equipment)
                throw new Error("Không tìm thấy thiết bị.");

            if (condition) equipment.condition = condition;
            if (status) equipment.status = status;
            await equipment.save();

            // await this.EquipmentLog.findOneAndUpdate(
            //     { equipment_id: equipmentId, end_time: null },
            //     { end_time: new Date() }
            // );

            // await this.EquipmentLog.create({
            //     equipment_id: equipmentId,
            //     room_id: equipment.room_id || null,
            //     condition: condition || equipment.condition,
            //     status: status || equipment.status,
            //     start_time: new Date(),
            //     end_time: null,
            //     note: note || `Cập nhật nội bộ`,
            //     handled_by: handled_by || null,
            // });

            return equipment;

        } catch (err) {
            console.log("Error in updateEquipmentInternal:", err.message);
            throw err;
        }
    };
}