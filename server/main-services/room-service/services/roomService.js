import mongoose from "mongoose";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";
import { EQUIPMENT_EVENTS } from "../../../shared/events/equipmentEvents.js";
import { BOOKING_EVENTS } from "../../../shared/events/bookingEvents.js";
import { cache, makeCacheKey } from "../../../shared/utils/cache.js";

export class RoomService {
    constructor({ Room, RoomCategory, RoomLog, DefaultEquipment, eventBus }) {
        this.Room = Room;
        this.RoomCategory = RoomCategory;
        this.RoomLog = RoomLog;
        this.DefaultEquipment = DefaultEquipment;
        this.eventBus = eventBus;
    }

    // ROOM CATEGORY
    parseEquipmentList = (default_equipments) => {
        let equipmentList = [];
        
        if (typeof default_equipments === "string") {
            equipmentList = JSON.parse(default_equipments);
        } else if (Array.isArray(default_equipments)) {
            equipmentList = default_equipments;
        } else {
            throw new Error("Danh sách thiết bị mặc định không hợp lệ");
        }
        
        if (!equipmentList || equipmentList.length === 0) {
            throw new Error("Vui lòng chọn ít nhất một thiết bị mặc định");
        }
        
        return equipmentList;
    };
        
    createRoomCategoryService = async (data, files) => {
        try {
            const { category_name, description, max_adults, max_children, 
                default_equipments, price } = data;
    
            if (!category_name || !description || !max_adults || !price) {
                throw new Error("Vui lòng nhập đầy đủ thông tin bắt buộc!");
            }
            
            const existing = await this.RoomCategory.findOne({ category_name });
            if (existing) throw new Error("Tên loại phòng đã tồn tại!");
            
            const equipmentList = this.parseEquipmentList(default_equipments);
            
            let images = [];
            if (files?.length > 0) {
                images = files.map((f) => f.path);
            }
            
            const roomCategory = await this.RoomCategory.create({
                category_name,
                description,
                max_adults,
                max_children,
                price,
                images
            });
            
            const items = equipmentList.map(eq => ({
                category_id: roomCategory._id,
                equipment_category_id: eq.equipment_category_id,
                quantity: eq.quantity
            }));
            
            if (items.length) {
                await this.DefaultEquipment.insertMany(items);
            }

            await cache.delByPattern("room:categories:*");

            return { roomCategory, items };
        } catch (err) {
            console.log("Error in createRoomCategoryService:", err);
            throw err;
        }

    };
    
    updateRoomCategoryService = async (id, data, files) => {
        try {
            const category = await this.RoomCategory.findById(id);

            if (!category) 
                throw new Error("Không tìm thấy loại phòng");
            
            const { category_name, description, max_adults, max_children, default_equipments, price } = data;
            
            const existing = await this.RoomCategory.findOne({
                category_name,
                _id: { $ne: id }
            });
            
            if (existing) 
                throw new Error("Tên loại phòng đã tồn tại!");
            
            Object.assign(category, {
                category_name: category_name ?? category.category_name,
                description: description ?? category.description,
                max_adults: max_adults ?? category.max_adults,
                max_children: max_children ?? category.max_children,
                price: price ?? category.price
            });
            
            await category.save();
            
            if (default_equipments) {
                const equipmentList = this.parseEquipmentList(default_equipments);
            
                await this.DefaultEquipment.deleteMany({ category_id: id });
            
                const items = equipmentList.map(eq => ({
                    category_id: id,
                    equipment_category_id: eq.equipment_category_id,
                    quantity: eq.quantity
                }));
            
                await this.DefaultEquipment.insertMany(items);
            }
            
            if (files?.length > 0) {
                category.images = files.map(f => f.path);
                await category.save();
            }

            await Promise.all([
                cache.del(`room:category:${id}`),
                cache.delByPattern("room:categories:*"),
                cache.delByPattern("room:rooms:*"),
                cache.delByPattern("room:available:*"),
            ]);

            return category;
        } catch (err) {
            console.log("Error in updateRoomCategoryService:", err);
            throw err;
        }
    };
    
    deleteRoomCategoryService = async (id, force) => {
        try {   
            const category = await this.RoomCategory.findById(id);
            if (!category) 
                throw new Error("Không tìm thấy loại phòng!");
            
            const relatedRoomCount = await this.Room.countDocuments({ category_id: id });
            
            if (relatedRoomCount > 0 && !force) {
                return {    
                    needConfirm: true,
                    roomCount: relatedRoomCount
                };
            }
            
            if (force) {
                await this.Room.deleteMany({ category_id: id });
            }
            
            await this.RoomCategory.findByIdAndDelete(id);
            await this.DefaultEquipment.deleteMany({ category_id: id });

            await Promise.all([
                cache.del(`room:category:${id}`),
                cache.delByPattern("room:categories:*"),
                cache.delByPattern("room:rooms:*"),
                cache.delByPattern("room:available:*"),
            ]);

            return { success: true };
        } catch (err) {
            console.log("Error in deleteRoomCategoryService:", err);
            throw err;
        }
    };
    
    getAllRoomCategoriesService = async (query = {}) => {
        try {
            const { page = 1, limit = 10, keyword, sort_by = "created_at", order = "dsc",
                min_price, max_price, max_adults, max_children } = query;

            const cacheKey = makeCacheKey("room:categories", {
                page: Number(page),
                limit: Number(limit),
                keyword: keyword || null,
                sort_by,
                order,
                min_price: min_price || null,
                max_price: max_price || null,
                max_adults: max_adults || null,
                max_children: max_children || null,
            });
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const filter = {};

            if (min_price || max_price) {
                filter.price = {};
                if (min_price)
                    filter.price.$gte = Number(min_price);
                if (max_price)
                    filter.price.$lte = Number(max_price);
            }

            if (max_adults) {
                filter.max_adults = {
                    $gte: Number(max_adults)
                };
            }
            if (max_children) {
                filter.max_children = {
                    $gte: Number(max_children)
                };
            }

            if (keyword) {
                filter.category_name = {
                    $regex: keyword,
                    $options: "i"
                };
            }

            const currentPage = Math.max(Number(page), 1);
            const pageSize = Math.max(Number(limit), 1);
            const skip = (currentPage - 1) * pageSize;

            const sort = {
                [sort_by]: order === "asc" ? 1 : -1
            };

            const [categories, total] = await Promise.all([
                this.RoomCategory.find(filter)
                    .select("-__v -created_at -updated_at")
                    .sort(sort)
                    .skip(skip)
                    .limit(pageSize)
                    .lean(),

                this.RoomCategory.countDocuments(filter)
            ]);

            const categoryIds = categories.map(c => c._id);

            const allEquipments = await this.DefaultEquipment.find({
                category_id: { $in: categoryIds }
            })
            .select("-__v -created_at -updated_at")
            .lean();

            const equipmentCategoryIds = [
                ...new Set(
                    allEquipments
                        .map(e => e.equipment_category_id?.toString())
                        .filter(Boolean)
                )
            ];

            const reply = await this.eventBus.safeRequest(
                EQUIPMENT_EVENTS.GET_CATEGORIES_INFO,
                { categoryIds: equipmentCategoryIds }
            );

            const equipmentCategoryMap = {};
            const equipmentEnrichmentOk = reply.success;
            for (const ec of (reply.categories || [])) {
                equipmentCategoryMap[ec._id.toString()] = {
                    _id: ec._id,
                    name: ec.name,
                    unit: ec.unit,
                    price: ec.price
                };
            }

            const equipmentMap = {};
            for (const eq of allEquipments) {
                const categoryId = eq.category_id.toString();

                if (!equipmentMap[categoryId]) {
                    equipmentMap[categoryId] = [];
                }

                const key = eq.equipment_category_id?.toString();
                equipmentMap[categoryId].push({
                    ...eq,
                    equipment_category: key
                        ? equipmentCategoryMap[key] || null
                        : null
                });
            }

            const result = categories.map(cat => ({
                ...cat,
                default_equipments: equipmentMap[cat._id.toString()] || []
            }));

            const response = {
                data: result,
                pagination: {
                    total,
                    page: currentPage,
                    limit: pageSize,
                    total_pages: Math.ceil(total / pageSize),
                    has_next: currentPage * pageSize < total,
                    has_prev: currentPage > 1
                }
            };

            // only cache when enrichment was complete so stale null values don't persist
            if (equipmentEnrichmentOk) {
                await cache.set(cacheKey, response, 300);
            }

            return response;

        } catch (err) {
            console.log("Error in getAllRoomCategoriesService:", err);
            throw err;
        }
    };
      
    getRoomCategoryByIdService = async (id) => {
        try {
            const cacheKey = `room:category:${id}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const category = await this.RoomCategory.findById(id)
                .select("-__v -created_at -updated_at");
            if (!category)
                throw new Error("Không tìm thấy loại phòng");

            const defaultEquipments = await this.DefaultEquipment.find({ category_id: id })
                .select("-__v -created_at -updated_at").lean();

            const equipmentCategoryIds = [
                ...new Set(
                    defaultEquipments
                        .map(e => e.equipment_category_id?.toString())
                        .filter(Boolean)
                )
            ];

            let equipmentCategoryMap = {};
            let equipmentEnrichmentOk = true;
            if (equipmentCategoryIds.length > 0) {
                const reply = await this.eventBus.safeRequest(
                    EQUIPMENT_EVENTS.GET_CATEGORIES_INFO,
                    { categoryIds: equipmentCategoryIds }
                );
                if (reply.success) {
                    for (const ec of reply.categories) {
                        equipmentCategoryMap[ec._id.toString()] = {
                            _id: ec._id,
                            name: ec.name,
                            unit: ec.unit,
                            price: ec.price
                        };
                    }
                } else {
                    equipmentEnrichmentOk = false;
                }
            }

            const enrichedEquipments = defaultEquipments.map(eq => {
                const key = eq.equipment_category_id?.toString();
                return {
                    ...eq,
                    equipment_category: key
                        ? equipmentCategoryMap[key] || null
                        : null
                };
            });

            const result = {
                ...category.toObject(),
                default_equipments: enrichedEquipments
            };

            if (equipmentEnrichmentOk) {
                await cache.set(cacheKey, result, 300);
            }
            return result;

        } catch (err) {
            console.log("Error in getRoomCategoryByIdService:", err);
            throw err;
        }
    };
    
    // get default equipment list according to categories
    getDefaultEquipmentsService = async (category_id) => {
        if (!mongoose.Types.ObjectId.isValid(category_id)) {
            throw new Error("ID loại phòng không hợp lệ!");
        }
        
        const defaultEquipments = await this.DefaultEquipment.find({ category_id })
            .select("-__v -created_at -updated_at").lean();
        
        const equipmentCategoryIds = [
                ...new Set(
                    defaultEquipments
                        .map(e => e.equipment_category_id?.toString())
                        .filter(Boolean)
                )
            ];

            let equipmentCategoryMap = {};
            if (equipmentCategoryIds.length > 0) {
                const reply = await this.eventBus.safeRequest(
                    EQUIPMENT_EVENTS.GET_CATEGORIES_INFO,
                    { categoryIds: equipmentCategoryIds }
                );
                if (reply.success) {
                    for (const ec of reply.categories) {
                        equipmentCategoryMap[ec._id.toString()] = {
                            _id: ec._id,
                            name: ec.name,
                            unit: ec.unit,
                            price: ec.price
                        };
                    }
                }
            }

            const enrichedEquipments = defaultEquipments.map(eq => {
                const key = eq.equipment_category_id?.toString();
                return {
                    ...eq,
                    equipment_category: key
                        ? equipmentCategoryMap[key] || null
                        : null
                };
            });

        return enrichedEquipments;
    };
    
    // return list of available room categories with available rooms based on search criteria.
    // capacity (adults/children) is NOT filtered here — it is validated at booking creation.
    // this lets customers pick multiple rooms that combine to cover their group size.
    getAvailableRoomCategoriesService = async (query = {}) => {
        try {
            const { checkin, checkout, adults, children, minPrice, maxPrice } = query;

            if (!checkin || !checkout) {
                throw new Error("Phải điền thời gian nhận và trả phòng.");
            }

            const cacheKey = makeCacheKey("room:available", {
                checkin: checkin || null,
                checkout: checkout || null,
                adults: adults || null,
                children: children || null,
                minPrice: minPrice || null,
                maxPrice: maxPrice || null,
            });
            const cachedAvail = await cache.get(cacheKey);
            if (cachedAvail) return cachedAvail;

            const start = new Date(checkin);
            const end = new Date(checkout);

            if (start >= end) throw new Error("Ngày trả phòng phải sau ngày nhận phòng.");
            if (adults && (isNaN(Number(adults)) || Number(adults) < 1))
                throw new Error("Số lượng người lớn không hợp lệ.");
            if (children && (isNaN(Number(children)) || Number(children) < 0))
                throw new Error("Số lượng trẻ em không hợp lệ.");

            // --- Step 1: collect busy room IDs from booking details ---
            const replyActiveBookings = await this.eventBus.safeRequest(
                BOOKING_EVENTS.GET_ACTIVE_BOOKINGS, {}
            );
            if (!replyActiveBookings.success) throw new Error(replyActiveBookings.message);

            const activeBookingIds = replyActiveBookings.activeBookings.map(b => b._id);
            const busyFromBookings = new Set();

            if (activeBookingIds.length > 0) {
                const replyDetails = await this.eventBus.safeRequest(
                    BOOKING_EVENTS.GET_DETAILS_BOOKING_IDS,
                    { bookingIds: activeBookingIds, start, end }
                );
                if (!replyDetails.success) throw new Error(replyDetails.message);
                replyDetails.details.forEach(d => busyFromBookings.add(d.room_id.toString()));
            }

            // --- Step 2: collect busy room IDs from room logs (single query) ---
            const busyLogs = await this.RoomLog.find({
                status: { $in: ["booked", "occupied", "reserved"] },
                start_time: { $lt: end },
                $or: [{ end_time: { $gt: start } }, { end_time: null }],
            }).select("room_id").lean();

            const allBusyIds = new Set([
                ...busyFromBookings,
                ...busyLogs.map(l => l.room_id.toString()),
            ]);

            // --- Step 3: candidate rooms — exclude permanently unavailable statuses ---
            const candidateRooms = await this.Room.find({
                _id: { $nin: [...allBusyIds] },
                room_status: { $nin: ["maintenance", "new"] },
            }).select("_id category_id room_number room_status").lean();

            if (candidateRooms.length === 0) {
                await cache.set(cacheKey, [], 60);
                return [];
            }

            const candidateIds = candidateRooms.map(r => r._id);

            // --- Step 4: batch-check remaining conflict logs for all candidates (one query) ---
            const conflictLogs = await this.RoomLog.find({
                room_id: { $in: candidateIds },
                status: { $in: ["booked", "occupied", "reserved", "maintenance"] },
                start_time: { $lt: end },
                $or: [{ end_time: { $gt: start } }, { end_time: null }],
            }).select("room_id").lean();

            const conflictingIds = new Set(conflictLogs.map(l => l.room_id.toString()));

            // --- Step 5: batch-check latest cleaning log for cleaning-status rooms ---
            const cleaningCandidates = candidateRooms.filter(
                r => r.room_status === "cleaning" && !conflictingIds.has(r._id.toString())
            );
            const cleaningEndMap = new Map();

            if (cleaningCandidates.length > 0) {
                const cleaningIds = cleaningCandidates.map(r => r._id);
                const latestCleaningLogs = await this.RoomLog.aggregate([
                    { $match: { room_id: { $in: cleaningIds }, status: "cleaning" } },
                    { $sort: { start_time: -1 } },
                    { $group: { _id: "$room_id", end_time: { $first: "$end_time" } } },
                ]);
                latestCleaningLogs.forEach(l => cleaningEndMap.set(l._id.toString(), l.end_time));
            }

            // --- Step 6: build final available room list ---
            const availableRooms = candidateRooms.filter(room => {
                if (conflictingIds.has(room._id.toString())) return false;

                if (room.room_status === "cleaning") {
                    const endTime = cleaningEndMap.get(room._id.toString());
                    return endTime != null && new Date(endTime) <= start;
                }

                return true;
            });

            // --- Step 7: group by category ---
            const roomsByCategory = {};
            for (const room of availableRooms) {
                const catId = room.category_id.toString();
                if (!roomsByCategory[catId]) roomsByCategory[catId] = [];
                roomsByCategory[catId].push({ room_id: room._id, room_number: room.room_number });
            }

            const categoryIds = Object.keys(roomsByCategory);
            if (categoryIds.length === 0) {
                await cache.set(cacheKey, [], 60);
                return [];
            }

            // --- Step 8: fetch categories with optional price filter in DB ---
            const categoryFilter = { _id: { $in: categoryIds } };
            if (minPrice) categoryFilter.price = { ...(categoryFilter.price || {}), $gte: Number(minPrice) };
            if (maxPrice) categoryFilter.price = { ...(categoryFilter.price || {}), $lte: Number(maxPrice) };

            const categories = await this.RoomCategory.find(categoryFilter)
                .select("category_name price max_adults max_children description images average_rating")
                .lean();

            const result = categories
                .map(cat => ({
                    category_id: cat._id,
                    name: cat.category_name,
                    price: cat.price,
                    max_adults: cat.max_adults,
                    max_children: cat.max_children,
                    description: cat.description,
                    images: cat.images || [],
                    average_rating: cat.average_rating || 0,
                    available_count: roomsByCategory[cat._id.toString()]?.length || 0,
                    rooms: roomsByCategory[cat._id.toString()] || [],
                }))
                .filter(item => item.available_count > 0)
                .sort((a, b) => a.price - b.price);

            await cache.set(cacheKey, result, 60);
            return result;

        } catch (error) {
            console.log("Error in getAvailableRoomCategoriesService:", error);
            throw error;
        }
    };

    // ROOM
    createRoom = async (data) => {
        try {
            const { category_id, room_number, room_status } = data;
    
            if (!category_id || !room_number)
                throw new Error("Vui lòng nhập đầy đủ thông tin bắt buộc (loại phòng, số phòng)!");
        
            if (!mongoose.Types.ObjectId.isValid(category_id))
                throw new Error("ID loại phòng không hợp lệ!");
        
            const category = await this.RoomCategory.findById(category_id);
            if (!category)
                throw new Error("Không tìm thấy loại phòng!");
        
            const existing = await this.Room.findOne({ room_number });
            if (existing)
                throw new Error("Số phòng đã tồn tại!");
        
            const validStatuses = ["available", "maintenance", "new"];
            if (room_status && !validStatuses.includes(room_status))
                throw new Error("Chỉ được chọn trạng thái trống hoặc bảo trì khi mới tạo phòng hoặc mới (mặc định)!");
        
            const room = new this.Room({ category_id, room_number, room_status: room_status || "new" });
            await room.save();

            await Promise.all([
                cache.del("room:stats:status_summary"),
                cache.del("room:stats:latest_status"),
                cache.delByPattern("room:rooms:*"),
                cache.delByPattern("room:available:*"),
            ]);

            const populatedRoom = await this.Room.findById(room._id)
            .populate("category_id", "category_name description max_adults max_children price")
            .select("-__v -created_at -updated_at");
        
            return populatedRoom;

        } catch (err) {
            console.log("Error in createRoomService:", err);
            throw err;
        }
    };
    
    getAllRooms = async (query = {}) => {
        try {
            const { category_id, room_status, room_number, page = 1, 
                limit = 10, sort_by = "room_number", order = "asc" } = query;

            const cacheKey = makeCacheKey("room:rooms", {
                category_id: category_id || null,
                room_status: room_status || null,
                room_number: room_number || null,
                page: Number(page),
                limit: Number(limit),
                sort_by,
                order,
            });
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const filter = {};
            const now = new Date();

            if (category_id) {
                if (!mongoose.Types.ObjectId.isValid(category_id))
                    throw new Error("ID loại phòng không hợp lệ!");
                filter.category_id = category_id;
            }
        
            if (room_status) {
                const validStatuses = ["available", "booked", "occupied", "cleaning", "maintenance", "new", "reserved"];
                if (!validStatuses.includes(room_status))
                    throw new Error("Trạng thái phòng không hợp lệ!");
                filter.room_status = room_status;
            }
        
            if (room_number) {
                filter.room_number = {
                    $regex: room_number,
                    $options: "i"
                };
            }

            const currentPage = Math.max(Number(page), 1);
            const pageSize = Math.max(Number(limit), 1);
            const skip = (currentPage - 1) * pageSize;

            const sort = {
                [sort_by]: order === "asc" ? 1 : -1
            };
    
            const [rooms, total] = await Promise.all([
                this.Room.find(filter)
                    .populate(
                        "category_id",
                        "category_name description max_adults max_children price"
                    )
                    .populate({
                        path: "roomStatusLog",

                        match: {
                            start_time: { $lte: now },
                            end_time: { $gte: now },
                        },

                        select: "status start_time end_time note",
                    })
                    .select("-__v -created_at -updated_at")
                    .sort(sort)
                    .skip(skip)
                    .limit(pageSize),

                this.Room.countDocuments(filter)
            ]);

            for (const room of rooms) {
                if (!room.roomStatusLog || room.roomStatusLog.length === 0) {
                    const latestLog = await this.RoomLog.findOne({
                        room_id: room._id
                    })
                    .sort({ start_time: -1 })
                    .select("status start_time end_time note");

                    room.roomStatusLog = latestLog
                        ? [latestLog]
                        : [];
                }
            }

            const response = {
                data: rooms,

                pagination: {
                    total,
                    page: currentPage,
                    limit: pageSize,
                    total_pages: Math.ceil(total / pageSize),
                    has_next: currentPage * pageSize < total,
                    has_prev: currentPage > 1
                }
            };

            await cache.set(cacheKey, response, 60);
            return response;

        } catch (err) {
            console.log("Error in getAllRoomsService:", err);
            throw err;
        }
    };
    
    getRoomById = async (id) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw new Error("ID không hợp lệ!");

            const cacheKey = `room:room:${id}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const now = new Date();

            const room = await this.Room.findById(id)
                .populate("category_id", "category_name description max_adults max_children price")
                .populate({
                    path: "roomStatusLog",
                    match: {
                        start_time: { $lte: now },
                        $or: [
                            { end_time: { $gte: now } },
                            { end_time: null }
                        ],
                    },
                    select: "status start_time end_time note",
                })
                .select("-__v -created_at -updated_at");

            if (!room)
                throw new Error("Không tìm thấy phòng!")

            await cache.set(cacheKey, room, 60);
            return room;

        } catch (err) {
            console.log("Error in getRoomByIdService:", err);
            throw err;
        }
    };

    // get many rooms by ids (but not all)
    getRoomsByIds = async (ids) => {
        if (!Array.isArray(ids) || ids.length === 0)
            throw new Error("Danh sách ID không hợp lệ!");
    
        const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validIds.length === 0) {
            throw new Error("Không có ID hợp lệ!");
        }

        const now = new Date();
    
        const rooms = await this.Room.find({ _id: { $in: validIds } })
            .populate("category_id", "category_name description max_adults max_children price")
            .populate({
                path: "roomStatusLog",
                match: {
                    start_time: { $lte: now },
                    $or: [
                        { end_time: { $gte: now } },
                        { end_time: null }
                    ],
                },
                select: "status start_time end_time note",
            })
            .select("-__v")
            .lean();
    
        if (!rooms)
            throw new Error("Không tìm thấy phòng!")
    
        return rooms;
    };
    
    updateRoom = async (data, roomId, userId) => {
        try {
            const { category_id, room_number, room_status, start_time, end_time, note } = data;
            const now = new Date();
        
            if (!mongoose.Types.ObjectId.isValid(roomId))
                throw new Error("ID phòng không hợp lệ!");
        
            const [reply, room] = await Promise.all([
                this.eventBus.safeRequest(EMPLOYEE_EVENTS.CHECK_EXISTS_USERID, { employee_user_id: userId }),
                this.Room.findById(roomId),
            ]);
            if (!reply.success) {
                throw new Error(reply.message || "Không tìm thấy nhân viên tương ứng với user ID!");
            }
            const employee = reply.employee;
            if (!room)
                throw new Error("Không tìm thấy phòng!");
        
            if (category_id) {
                if (!mongoose.Types.ObjectId.isValid(category_id))
                    throw new Error("ID loại phòng không hợp lệ!");
            
                const category = await this.RoomCategory.findById(category_id);
                if (!category) 
                    throw new Error("Không tìm thấy loại phòng!");
            
                room.category_id = category_id;
            }
        
            if (room_number !== undefined) {
                const existing = await this.Room.findOne({
                    room_number,
                    _id: { $ne: roomId },
                });
        
                if (existing) 
                    throw new Error("Số phòng đã tồn tại!");

                room.room_number = room_number;
            }
        
            if (room_status) {
                const ALLOWED = ["maintenance", "cleaning", "available", "new"];
        
                if (!ALLOWED.includes(room_status)) {
                    throw new Error(`Chỉ được chỉnh: ${ALLOWED.join(", ")}`);
                }
        
                const activeLog = await this.RoomLog.findOne({
                    room_id: roomId,
                    start_time: { $lte: now },
                    $or: [{ end_time: null }, { end_time: { $gte: now } } ],
                }).sort({ start_time: -1 });
        
                const currentStatus = activeLog?.status || room.room_status || "new";
        
                if (currentStatus === "occupied")
                    throw new Error("Phòng đang có khách!");
        
                if (currentStatus === "new" && !["available", "maintenance", "cleaning"].includes(room_status)) {
                    throw new Error("Phòng mới chỉ có thể chuyển sang trạng thái: Trống, Bảo trì hoặc Dọn dẹp!");
                }
        
                if (room_status !== "available") {
                    if (!start_time)
                        throw new Error("Bắt buộc có thời gian bắt đầu!");
        
                    if (end_time && new Date(end_time) <= new Date(start_time))
                        throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu!");
                } else {
                    // const bookingExists = await Booking.exists({
                    //     room_id: roomId,
                    //     status: { $in: ["confirmed", "in_progress"] },
                    //     check_in: { $lte: now },
                    //     check_out: { $gte: now },
                    // });
        
                    // if (bookingExists) {
                    //     throw new Error("Phòng đang có booking hiệu lực, không thể chuyển sang available!");
                    // }
                }
        
                await this.RoomLog.updateMany(
                    { room_id: roomId, end_time: null },
                    { $set: { end_time: now } }
                );
        
                await this.RoomLog.create(
                    [{
                        room_id: roomId,
                        status: room_status,
                        start_time: start_time ? new Date(start_time) : now,
                        end_time: end_time ? new Date(end_time) : null,
                        note: note || "",
                        handled_by: employee?._id || null,
                    }],
                );
            
                room.room_status = room_status;
            }
        
            await room.save();

            await Promise.all([
                cache.del(`room:room:${roomId}`),
                cache.del("room:stats:status_summary"),
                cache.del("room:stats:latest_status"),
                cache.delByPattern("room:rooms:*"),
                cache.delByPattern("room:available:*"),
            ]);

            // Re-populate the room with category and latest status log for the response
            const nowForPopulate = new Date();
            const updatedRoom = await this.Room.findById(roomId)
                .populate("category_id", "category_name description max_adults max_children price")
                .populate({
                    path: "roomStatusLog",
                    match: {
                        start_time: { $lte: nowForPopulate },
                        $or: [
                        { end_time: { $gte: nowForPopulate } },
                        { end_time: null }
                        ],
                    },
                    select: "status start_time end_time note",
                })
                .select("-__v -created_at -updated_at");
            
            if (!updatedRoom.roomStatusLog) {
                const latestLog = await this.RoomLog.findOne({ room_id: roomId })
                .sort({ start_time: -1 })
                .select("status start_time end_time note");
                if (latestLog) {
                    updatedRoom.roomStatusLog = latestLog;
                }
            }
        
            return updatedRoom;

        } catch (err) {
            console.log("Error in updateRoomService:", err);
            throw err;
        }
    };
    
    deleteRoom = async (roomId) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(roomId))
                throw new Error("ID không hợp lệ!");
        
            const room = await this.Room.findById(roomId);
            if (!room)
                throw new Error("Không tìm thấy phòng!");
        
            const bannedStatuses = ["booked", "occupied", "reserved"];
            if (bannedStatuses.includes(room.room_status)) {
                throw new Error("Không thể xóa phòng đang ở trạng thái `Đang ở/Đang đặt/Đang giữ`!");
            }
        
            await this.Room.findByIdAndDelete(roomId);

            await Promise.all([
                cache.del(`room:room:${roomId}`),
                cache.del("room:stats:status_summary"),
                cache.del("room:stats:latest_status"),
                cache.delByPattern("room:rooms:*"),
                cache.delByPattern("room:available:*"),
            ]);

            return { success: true };

        } catch (err) {
            console.log("Error in deleteRoomService:", err);
            throw err;
        }
    };
    
    completeCleaning = async (roomId, userId) => {
        try {
            const now = new Date();
            const room = await this.Room.findById(roomId);
            if (!room) {
                throw new Error("Không tìm thấy phòng.");
            }
        
            if (room.room_status !== "cleaning") {
                throw new Error("Phòng không ở trạng thái đang dọn.");
            }
        
            await this.RoomLog.updateMany(
                {
                    room_id: roomId,
                    status: "cleaning",
                    end_time: null,
                },
                { $set: { end_time: now } }
            );
        
            await this.RoomLog.create(
                [{
                    room_id: roomId,
                    status: "available",
                    start_time: now,
                    end_time: null,
                    note: "Housekeeper xác nhận dọn xong",
                    handled_by: userId || null,
                }]
            );
        
            room.room_status = "available";
            await room.save();

            await Promise.all([
                cache.del(`room:room:${roomId}`),
                cache.del("room:stats:status_summary"),
                cache.del("room:stats:latest_status"),
                cache.delByPattern("room:rooms:*"),
                cache.delByPattern("room:available:*"),
            ]);

            return { success: true };

        } catch (error) {
            console.log("Error in completeCleaning:", error);
            throw error;
        }
    };
    
    completeMaintenance = async (roomId, userId) => {
        try {
            const now = new Date();

            const room = await this.Room.findById(roomId);
            if (!room) {
                throw new Error("Không tìm thấy phòng.");
            }
        
            if (room.room_status !== "maintenance") {
                throw new Error("Phòng không ở trạng thái bảo trì.");
            }
        
            await this.RoomLog.updateMany(
                {
                    room_id: roomId,
                    status: "maintenance",
                    end_time: null,
                },
                { $set: { end_time: now } }
            );
        
            await this.RoomLog.create(
                [{
                    room_id: roomId,
                    status: "available",
                    start_time: now,
                    end_time: null,
                    note: "Kỹ thuật xác nhận bảo trì xong",
                    handled_by: userId || null,
                }]
            );
        
            room.room_status = "available";
            await room.save();

            await Promise.all([
                cache.del(`room:room:${roomId}`),
                cache.del("room:stats:status_summary"),
                cache.del("room:stats:latest_status"),
                cache.delByPattern("room:rooms:*"),
                cache.delByPattern("room:available:*"),
            ]);

            return { success: true };

        } catch (error) {
            console.log("Error in completeMaintenance:", error);
            throw error;
        }
    };
    
    // Group all rooms by category (including categories with zero rooms)
    getRoomsByCategory = async (query = {}) => {
        try {
            const { room_status } = query;
    
            const validStatuses = ["available", "booked", "occupied", "cleaning", "maintenance", "new"];
            if (room_status && !validStatuses.includes(room_status)) {
                throw new Error("Trạng thái phòng không hợp lệ!");
            }
    
            const pipeline = [
                {
                    $lookup: {
                        from: "rooms",
                        localField: "_id",
                        foreignField: "category_id",
                        as: "rooms",
                    },
                },
                // Optional filter rooms by status if provided
                ...(room_status
                    ? [
                        {
                            $addFields: {
                                rooms: {
                                    $filter: {
                                        input: "$rooms",
                                        as: "r",
                                        cond: { $eq: ["$$r.room_status", room_status] },
                                    },
                                },
                            },
                        },
                    ]
                    : []),
                {
                    $addFields: {
                    room_count: { $size: "$rooms" },
                    available_count: {
                        $size: {
                        $filter: {
                            input: "$rooms",
                            as: "r",
                            cond: { $eq: ["$$r.room_status", "available"] },
                        },
                        },
                    },
                    booked_count: {
                        $size: {
                        $filter: {
                            input: "$rooms",
                            as: "r",
                            cond: { $eq: ["$$r.room_status", "booked"] },
                        },
                        },
                    },
                    occupied_count: {
                        $size: {
                        $filter: {
                            input: "$rooms",
                            as: "r",
                            cond: { $eq: ["$$r.room_status", "occupied"] },
                        },
                        },
                    },
                    cleaning_count: {
                        $size: {
                        $filter: {
                            input: "$rooms",
                            as: "r",
                            cond: { $eq: ["$$r.room_status", "cleaning"] },
                        },
                        },
                    },
                    maintenance_count: {
                        $size: {
                        $filter: {
                            input: "$rooms",
                            as: "r",
                            cond: { $eq: ["$$r.room_status", "maintenance"] },
                        },
                        },
                    },
                    },
                },
                {
                    $project: {
                        __v: 0,
                        created_at: 0,
                        updated_at: 0,
                        max_adults: 0,
                        max_children: 0,
                        default_equipment: 0,
                        "rooms.__v": 0,
                        "rooms.category_id": 0,
                        "rooms.created_at": 0,
                        "rooms.updated_at": 0
                    },
                },
                { $sort: { price: 1, category_name: 1 } },
            ];
    
            const categoriesWithRooms = await this.RoomCategory.aggregate(pipeline);
    
            return categoriesWithRooms;
    
        } catch (err) {
            console.error(err);
            throw err;
        }
    };
    
    reevaluateRoomStatus = async (room_id) => {
        try {
            if (!room_id) return;
    
            const equipments = await this.Equipment.find({ room_id })
                .populate("category_id", "is_critical");
            
            const hasCriticalProblem = equipments.some((eq) => {
                if (!eq.category_id?.is_critical) return false;
            
                return (
                ["maintenance", "broken"].includes(eq.condition) ||
                ["maintenance", "disposed", "lost"].includes(eq.status)
                );
            });
            
            const status = hasCriticalProblem ? "maintenance" : "available";
            await this.Room.findByIdAndUpdate(room_id, { status });
            
            await this.RoomLog.create({
                room_id: room_id,
                status,
                start_time: new Date(),
                end_time: null,
                note: "Update status phòng theo sự cố + phiếu đền bù",
                handled_by: null,
            });
            
            return { success: true };

        } catch (err) {
            console.log("Error in reevaluateRoomStatus:", err);
            throw err;
        }
    };

    // updateRoomInternal = async ({ room_id, status, start_time, end_time, note, handled_by }) => {
    //     try {
    //         const now = new Date();

    //         const room = await this.Room.findById(room_id);
    //         if (!room)
    //             throw new Error(`Không tìm thấy phòng: ${room_id}`);

    //         await this.updateRoomLog(
    //             { room_id, end_time: null },
    //             { end_time: now }
    //         );

    //         await this.insertRoomLog({
    //             room_id,
    //             status,
    //             start_time: start_time ? new Date(start_time) : now,
    //             end_time: end_time ? new Date(end_time) : null,
    //             note: note || "",
    //             handled_by: handled_by || null,
    //         });

    //         room.room_status = status;
    //         await room.save();

    //         return { success: true, room_id, status };

    //     } catch (err) {
    //         console.log("Error in updateRoomStatusInternal:", err);
    //         throw err;
    //     }
    // };
    
    // communication
    
    async getCategoryIdsByRoomIds (roomIds) {
        const rooms = await this.Room.find(
            { _id: { $in: roomIds } },
            { category_id: 1 }
        );

        const categoryIds = [
            ...new Set(rooms.map((r) => r.category_id.toString()))
        ];

        return categoryIds;
    }

    async updateRoomCategoryRating(categoryId, updateData) {
        try {
            const { average_rating, review_count } = updateData;

            const updated = await this.RoomCategory.findByIdAndUpdate(categoryId,
                {
                    average_rating: Math.round(average_rating * 10) / 10,
                    review_count: review_count,
                },
                { new: true, runValidators: true }
            );

            await Promise.all([
                cache.delByPattern("room:categories:*"),
                cache.delByPattern("room:rooms:*"),
            ]);

            return updated;

        } catch (error) {
            throw error;
        }
    }

    updateRoomLog = async (filter, updateData, options = {}) => {
        try {
            const result = await this.RoomLog.updateMany(filter, { $set: updateData }, options);
            return result;
        } catch (err) {
            console.log("Error in updateRoomLog:", err);
            throw err;
        }
    };

    insertRoomLog = async (data, options = {}) => {
        try {
            const isArray = Array.isArray(data);
            const result = isArray
                ? await this.RoomLog.insertMany(data, options)
                : await this.RoomLog.create([data], options);

            await cache.delByPattern("room:available:*");

            return result;
        } catch (err) {
            console.log("Error in insertRoomLog:", err);
            throw err;
        }
    };

    findRoomLogs = async (filter = {}, opts = {}) => {
        try {
            const {
                sort = { start_time: -1 },
                limit = 0,
                select = "-__v",
                lean = false,
            } = opts;

            let query = this.RoomLog.find(filter).sort(sort).select(select);

            if (limit > 0) query = query.limit(limit);
            if (lean) query = query.lean();

            return await query;
            
        } catch (err) {
            console.log("Error in findRoomLogs:", err);
            throw err;
        }
    };

    updateRoomInternal = async (filter, updateData, options = {}) => {
        try {
            const result = await this.Room.updateMany(filter, { $set: updateData }, options);
            await Promise.all([
                cache.delByPattern("room:rooms:*"),
                cache.delByPattern("room:room:*"),
                cache.delByPattern("room:available:*"),
            ]);
            return result;
        } catch (err) {
            console.log("Error in updateRoomInternal:", err);
            throw err;
        }
    };

    getDefaultEquipmentsByRoomCategory = async (categoryId) => {
        const defaultEquipments = await this.DefaultEquipment.find({
            category_id: categoryId
        })
        .select("equipment_category_id quantity")
        .lean();

        return defaultEquipments;
    };

}