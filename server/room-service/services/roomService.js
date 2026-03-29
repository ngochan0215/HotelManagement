import mongoose from "mongoose";

export class RoomService {
    constructor({ Room, RoomCategory, RoomLog }) {
        this.Room = Room;
        this.RoomCategory = RoomCategory;
        this.RoomLog = RoomLog;
    }

    // only get one room
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

    // get many rooms (but not all)
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
}