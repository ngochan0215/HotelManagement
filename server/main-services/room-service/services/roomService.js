import mongoose from "mongoose";
import { EMPLOYEE_EVENTS } from "../../../shared/events/employeeEvents.js";
import { EQUIPMENT_EVENTS } from "../../../shared/events/equipmentEvents.js";

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
            const { category_name, description, max_adults, max_children, default_equipments, price } = data;
    
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
            
            return { success: true };
        } catch (err) {
            console.log("Error in deleteRoomCategoryService:", err);
            throw err;
        }
    };
    
    getAllRoomCategoriesService = async () => {
        try {
            const categories = await this.RoomCategory.find()
                .select("-__v -created_at -updated_at");;
            const allEquipments = await this.DefaultEquipment.find()
                .select("-__v -created_at -updated_at").lean();
            
            const equipmentCategoryIds = [
                ...new Set(
                    allEquipments
                        .map(e => e.equipment_category_id?.toString())
                        .filter(Boolean)
                )
            ];

            const reply = await this.eventBus.request(
                EQUIPMENT_EVENTS.GET_CATEGORIES_INFO,
                { categoryIds: equipmentCategoryIds }
            );

            const equipmentCategoryMap = {};
            for (const ec of reply.categories) {
                equipmentCategoryMap[ec._id.toString()] = {
                        _id: ec._id,
                        name: ec.name,
                        unit: ec.unit,
                        price: ec.price
                    };
            }

            const result = categories.map(cat => {
                const equipments = allEquipments
                    .filter(e => e.category_id.toString() === cat._id.toString())
                    .map(eq => {
                        const key = eq.equipment_category_id?.toString();

                        return {
                            ...eq,
                            equipment_category: key
                                ? equipmentCategoryMap[key] || null
                                : null
                        };
                    });

                return {
                    ...cat.toObject(),
                    default_equipments: equipments
                };
            });

            return result;
        } catch (err) {
            console.log("Error in getAllRoomCategoriesService:", err);
            throw err;
        }
    };
      
    getRoomCategoryByIdService = async (id) => {
        try {
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
            if (equipmentCategoryIds.length > 0) {
                const reply = await this.eventBus.request(
                    EQUIPMENT_EVENTS.GET_CATEGORIES_INFO,
                    { categoryIds: equipmentCategoryIds }
                );
                for (const ec of reply.categories) {
                    equipmentCategoryMap[ec._id.toString()] = {
                        _id: ec._id,
                        name: ec.name,
                        unit: ec.unit,
                        price: ec.price
                    };
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

            return {
                ...category.toObject(),
                default_equipments: enrichedEquipments
            };

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
                const reply = await this.eventBus.request(
                    EQUIPMENT_EVENTS.GET_CATEGORIES_INFO,
                    { categoryIds: equipmentCategoryIds }
                );
                for (const ec of reply.categories) {
                    equipmentCategoryMap[ec._id.toString()] = {
                        _id: ec._id,
                        name: ec.name,
                        unit: ec.unit,
                        price: ec.price
                    };
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
    
    // return list of available room categories with available rooms based on search criteria
    // getAvailableRoomCategoriesService = async (query) => {
    //     const { checkin, checkout, adults, children, minPrice, maxPrice } = query;
    
    //     if (!checkin || !checkout) {
    //         throw new Error("Phải điền thời gian nhận và trả phòng.");
    //     }
    
    //     const start = new Date(checkin);
    //     const end = new Date(checkout);
    
    //     if (start >= end) {
    //         throw new Error("Ngày trả phòng phải sau ngày nhận phòng.");
    //     }
    
    //     if (adults && (isNaN(Number(adults)) || Number(adults) < 1)) {
    //         throw new Error("Số lượng người lớn không hợp lệ.");
    //     }
    
    //     if (children && (isNaN(Number(children)) || Number(children) < 0)) {
    //         throw new Error("Số lượng trẻ em không hợp lệ.");
    //     }
    
    //     // get active bookings 
    //     const activeBookings = await Booking.find({
    //         status: { $in: ["pending", "confirmed", "in_progress"] },
    //     }).select("_id");
    
    //     const activeBookingIds = activeBookings.map((b) => b._id);
    
    //     // get busy rooms from both bookings and room logs
    //     const busyBookingDetails = await BookingDetail.find({
    //         booking_id: { $in: activeBookingIds },
    //         status: { $ne: "cancelled" },
    //         expected_checkin: { $lt: end },
    //         expected_checkout: { $gt: start },
    //     }).select("room_id");
    
    //     const busyRoomIdsFromBookings = [
    //         ...new Set(busyBookingDetails.map((b) => b.room_id.toString())),
    //     ];
    
    //     const busyRoomLogs = await RoomLog.find({
    //         status: { $in: ["booked", "occupied", "reserved"] },
    //         start_time: { $lt: end },
    //         $or: [{ end_time: { $gt: start } }, { end_time: null }],
    //     }).select("room_id");
    
    //     const busyRoomIdsFromLogs = [
    //         ...new Set(busyRoomLogs.map((log) => log.room_id.toString())),
    //     ];
    
    //     const allBusyRoomIds = [
    //         ...new Set([...busyRoomIdsFromBookings, ...busyRoomIdsFromLogs]),
    //     ];
    
    //     // get all rooms that are not in busyRoomIds and not in maintenance/new status
    //     const allRooms = await Room.find({
    //         _id: { $nin: allBusyRoomIds },
    //     }).select("_id category_id room_number room_status");
    
    //     const availableRooms = [];
    
    //     for (const room of allRooms) {
    //         const conflictingLog = await RoomLog.findOne({
    //         room_id: room._id,
    //         status: { $in: ["booked", "occupied", "reserved", "maintenance"] },
    //         start_time: { $lt: end },
    //         $or: [{ end_time: { $gt: start } }, { end_time: null }],
    //         });
    
    //         if (!conflictingLog && !["maintenance", "new"].includes(room.room_status)) {
    //         if (room.room_status === "cleaning") {
    //             const cleaningLog = await RoomLog.findOne({
    //             room_id: room._id,
    //             status: "cleaning",
    //             start_time: { $lte: start },
    //             $or: [
    //                 { end_time: { $lte: start } }, 
    //                 { end_time: null }
    //             ],
    //             }).sort({ start_time: -1 });
    
    //             // Nếu có log cleaning và sẽ kết thúc trước check-in, phòng có thể sử dụng
    //             if (
    //             !cleaningLog ||
    //             (cleaningLog.end_time && cleaningLog.end_time <= start)
    //             ) {
    //             availableRooms.push(room);
    //             }
    //         } else {
    //             availableRooms.push(room);
    //         }
    //         }
    //     }
    
    //     const roomsByCategory = {};
    
    //     for (const room of availableRooms) {
    //         const categoryId = room.category_id.toString();
    
    //         if (!roomsByCategory[categoryId]) {
    //         roomsByCategory[categoryId] = [];
    //         }
    
    //         roomsByCategory[categoryId].push({
    //         room_id: room._id,
    //         room_number: room.room_number,
    //         });
    //     }
    
    //     const categoryIds = Object.keys(roomsByCategory);
    //     const categories = await RoomCategory.find({
    //         _id: { $in: categoryIds },
    //     });
    
    //     let result = categories
    //         .filter((cat) => {
    //             if (adults && cat.max_adults < Number(adults)) return false;
    //             if (children && cat.max_children < Number(children)) return false;
    //             if (minPrice && cat.price < Number(minPrice)) return false;
    //             if (maxPrice && cat.price > Number(maxPrice)) return false;
    //             return true;
    //         })
    //         .map((cat) => ({
    //             category_id: cat._id,
    //             name: cat.category_name,
    //             price: cat.price,
    //             adults: cat.max_adults,
    //             children: cat.max_children,
    //             description: cat.description,
    //             availableRooms:
    //                 roomsByCategory[cat._id.toString()]?.length || 0,
    //             rooms: roomsByCategory[cat._id.toString()] || [],
    //         }))
    //         .filter((item) => item.availableRooms > 0)
    //         .sort((a, b) => a.price - b.price);
    
    //     return result;
    // };

    // ROOM
    // only get one room by id
    getRoomById = async (id) => {
        if (!mongoose.Types.ObjectId.isValid(id))
            throw new Error("ID không hợp lệ!");
    
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
            .select("-__v")
    
        if (!room)
            throw new Error("Không tìm thấy phòng!")
    
        return room;
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
            const { category_id, room_status, room_number } = query;
            const filter = {};
        
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
                filter.room_number = parseInt(room_number);
            }
        
            const now = new Date();
        
            const rooms = await this.Room.find(filter)
                .populate("category_id", "category_name description max_adults max_children price")
                .populate({
                        path: "roomStatusLog",
                        match: {
                            start_time: { $lte: now },
                            end_time: { $gte: now },
                        },
                    //options: { sort: { start_time: -1 }, limit: 1 },
                    select: "status start_time end_time note",
                })
                .select("-__v -created_at -updated_at")
                .sort({ room_number: 1 });
        
            for (const room of rooms) {
                if (!room.roomStatusLog) {
                    const latestLog = await this.RoomLog.findOne({ room_id: room._id })
                        .sort({ start_time: -1 })
                        .select("status start_time end_time note");
                    if (latestLog) {
                        room.roomStatusLog = latestLog;
                    }
                }
            }
        
            return { count: rooms.length, rooms };

        } catch (err) {
            console.log("Error in getAllRoomsService:", err);
            throw err;
        }
    };
    
    getRoomById = async (id) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw new Error("ID không hợp lệ!");
        
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
        
            return room;

        } catch (err) {
            console.log("Error in getRoomByIdService:", err);
            throw err;
        }
    };
    
    updateRoom = async (data, roomId, userId) => {
        try {
            const { category_id, room_number, room_status, start_time, end_time, note } = data;
            const now = new Date();
        
            if (!mongoose.Types.ObjectId.isValid(roomId))
                throw new Error("ID phòng không hợp lệ!");
        
            const reply = await this.eventBus.request(
                EMPLOYEE_EVENTS.CHECK_EXISTS_USERID,
                { employee_user_id: userId }
            );
            if (!reply.found) {
                throw new Error("Không tìm thấy nhân viên tương ứng với user ID!");
            }
            const employee = reply.employee;
        
            const room = await this.Room.findById(roomId);
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

            // Populate roomStatusLog (virtual field tham chiếu RoomLog) để frontend có thể hiển thị
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
            
            // Nếu roomStatusLog không có (không có log active), lấy log mới nhất từ RoomLog
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
    
    // return summary count of rooms in each status and total
    getRoomStatusSummary = async () => {
        try {
            const result = await this.Room.aggregate([
                {
                    $group: {
                    _id: "$room_status",
                    count: { $sum: 1 },
                    },
                },
            ]);
        
            const summary = {
                new: 0,
                available: 0,
                booked: 0,
                occupied: 0,
                cleaning: 0,
                maintenance: 0,
                reserved: 0,
                total: 0,
            };
        
            result.forEach(item => {
                summary[item._id] = item.count;
                summary.total += item.count;
            });
        
            return { summary };
        
        } catch (error) {
            console.log("Error in getRoomStatusSummary:", error);
            throw error;
        }
    };
    
    // getTopBookedRoomCategories = async (query = {}) => {
    //     try {
    //         const limit = parseInt(query.limit, 10) || 5;
        
    //         const result = await BookingDetail.aggregate([
    //         // join sang Room
    //         {
    //             $lookup: {
    //             from: "rooms",
    //             localField: "room_id",
    //             foreignField: "_id",
    //             as: "room",
    //             },
    //         },
    //         { $unwind: "$room" },
        
    //         // group theo category
    //         {
    //             $group: {
    //             _id: "$room.category_id",
    //             totalBooked: { $sum: 1 },
    //             },
    //         },
        
    //         // sort giảm dần
    //         { $sort: { totalBooked: -1 } },
        
    //         // limit
    //         { $limit: limit },
        
    //         // join sang RoomCategory
    //         {
    //             $lookup: {
    //             from: "roomcategories",
    //             localField: "_id",
    //             foreignField: "_id",
    //             as: "category",
    //             },
    //         },
    //         { $unwind: "$category" },
        
    //         // kết quả trả về cúi cùm
    //         {
    //             $project: {
    //             _id: 0,
    //             category_id: "$_id",
    //             name: "$category.category_name",
    //             price: "$category.price",
    //             totalBooked: 1,
    //             },
    //         },
    //         ]);
        
    //         return { result };
        
    //     } catch (error) {
    //         console.log(error);
    //         throw error;
    //     }
    // };
    
    getLatestStatusOfAllRooms = async () => {
        return await this.RoomLog.aggregate([
            {
            $sort: {
                room_id: 1,
                start_time: -1,
            },
            },
        
            // gom theo phòng, lấy bản ghi đầu tiên
            {
            $group: {
                _id: "$room_id",
                latestStatus: { $first: "$$ROOT" },
            },
            },
        
            // trả về document gốc
            {
            $replaceRoot: { newRoot: "$latestStatus" },
            },
        
            // populate phòng
            {
            $lookup: {
                from: "rooms",
                localField: "room_id",
                foreignField: "_id",
                as: "room",
            },
            },
            {
            $unwind: {
                path: "$room",
                preserveNullAndEmptyArrays: true,
            },
            },
        ]);
    };
    
    // getRoomEquipments = async (roomId) => {
    //     try {
    //         const equipments = await Equipment.find({
    //         room_id: roomId,
    //         status: { $in: ["in-use", "maintenance"] }
    //         })
    //         .populate({
    //             path: "category_id",
    //             select: "name price"
    //         })
    //         .select("category_id condition status note");
        
    //         return { equipments };
        
    //     } catch (err) {
    //         console.error(err);
    //         throw err;
    //     }
    // };
    
    // update tình trạng phòng dựa trên status+condition của thiết bị
    
    // reevaluateRoomStatus = async (room_id) => {
    //     try {
    //         if (!room_id) return;
    
    //         const equipments = await this.Equipment.find({ room_id })
    //             .populate("category_id", "is_critical");
            
    //         const hasCriticalProblem = equipments.some((eq) => {
    //             if (!eq.category_id?.is_critical) return false;
            
    //             return (
    //             ["maintenance", "broken"].includes(eq.condition) ||
    //             ["maintenance", "disposed", "lost"].includes(eq.status)
    //             );
    //         });
            
    //         const status = hasCriticalProblem ? "maintenance" : "available";
    //         await this.Room.findByIdAndUpdate(room_id, { status });
            
    //         await this.RoomLog.create({
    //             room_id: room_id,
    //             status,
    //             start_time: new Date(),
    //             end_time: null,
    //             note: "Update status phòng theo sự cố + phiếu đền bù",
    //             handled_by: null,
    //         });
            
    //         return { success: true };

    //     } catch (err) {
    //         console.log("Error in reevaluateRoomStatus:", err);
    //         throw err;
    //     }
    // };

    // Update existing RoomLog entries matching a filter
    
    updateRoomLog = async (filter, updateData, options = {}) => {
        try {
            const result = await this.RoomLog.updateMany(filter, { $set: updateData }, options);
            return result;
        } catch (err) {
            console.log("Error in updateRoomLog:", err);
            throw err;
        }
    };

    // Insert one or many RoomLog entries
    // Pass a single object or an array of objects
    insertRoomLog = async (data, options = {}) => {
        try {
            const isArray = Array.isArray(data);
            const result = isArray
                ? await this.RoomLog.insertMany(data, options)
                : await this.RoomLog.create([data], options);
            return result;
        } catch (err) {
            console.log("Error in insertRoomLog:", err);
            throw err;
        }
    };

    // Find RoomLog entries by a given condition
    // opts: { sort, limit, select, lean }
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
            return result;
        } catch (err) {
            console.log("Error in updateRoomInternal:", err);
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
}