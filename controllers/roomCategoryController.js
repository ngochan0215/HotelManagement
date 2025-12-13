import mongoose from "mongoose";
import { Room, RoomCategory, DefaultEquipment, Booking } from "../models/index.js";

export const createRoomCategory = async (req, res) => {
    try {
        const { category_name, description, max_adults, max_children, default_equipments, price } = req.body;

        if (!category_name || !description || !max_adults || !price)
            return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin bắt buộc!" });

        let equipmentList = [];
        if (typeof default_equipments === "string") {
            try {
                equipmentList = JSON.parse(default_equipments);
            } catch (e) {
                return res.status(400).json({ message: "Dữ liệu thiết bị mặc định (default_equipments) không phải là chuỗi JSON hợp lệ." });
            }
        }
        else if (Array.isArray(default_equipments)) {
            equipmentList = default_equipments;
        }
        else {
            return res.status(400).json({ message: "Danh sách thiết bị mặc định không hợp lệ" });
        }

        // Check duplicate
        const existing = await RoomCategory.findOne({ category_name });
        if (existing)
            return res.status(400).json({ success: false, message: "Tên loại phòng đã tồn tại!" });

        let images = [];
        if (req.files && req.files.length > 0) {
            images = req.files.map((file) => file.path); 
        }

        const roomCategory = new RoomCategory({
            category_name,
            description,
            max_adults,
            max_children,
            price,
            images
        });
        await roomCategory.save();

        const items = equipmentList.map(eq => ({
            category_id: roomCategory._id,
            equipment_category_id: eq.equipment_category_id,
            quantity: eq.quantity
        }));

        if (items.length > 0) {
            await DefaultEquipment.insertMany(items);
        }

        return res.status(200).json({ success: true, message: "Thêm loại phòng thành công!", RoomCategory: roomCategory, DefaultEquipment: items });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

export const updateRoomCategory = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("UPDATE REQUEST BODY:", req.body);
        const { category_name, description, max_adults, max_children, default_equipments, price } = req.body;

        const category = await RoomCategory.findById(id);
        if (!category) return res.status(404).json({ message: "Không tìm thấy loại phòng" });

        // update các thông tin cơ bản
        category.category_name = category_name ?? category.category_name;
        category.description = description ?? category.description;
        category.max_adults = max_adults ?? category.max_adults;
        category.max_children = max_children ?? category.max_children;
        category.price = price ?? category.price;

        await category.save();

        let equipmentList = [];
        if (typeof default_equipments === "string") {
            try {
                equipmentList = JSON.parse(default_equipments);
            } catch (e) {
                return res.status(400).json({ message: "Dữ liệu thiết bị mặc định (default_equipments) không phải là chuỗi JSON hợp lệ." });
            }
        }
        else if (Array.isArray(default_equipments)) {
            equipmentList = default_equipments;
        }
        else {
            return res.status(400).json({ message: "Danh sách thiết bị mặc định không hợp lệ" });
        }

        // update thiết bị mặc định
        await DefaultEquipment.deleteMany({ category_id: id });
        const items = equipmentList.map(eq => ({
            category_id: id,
            equipment_category_id: eq.equipment_category_id,
            quantity: eq.quantity
        }));
        await DefaultEquipment.insertMany(items);

        // update ảnh
        let images = [];
        if (req.files && req.files.length > 0) {
            images = req.files.map((file) => file.path); 
        }
        category.images = images.length > 0 ? images : category.images;

        res.json({ message: "Cập nhật thành công", category });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// export const updateRoomCategory = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const updateData = req.body;

//         if (!mongoose.Types.ObjectId.isValid(id))
//             return res.status(400).json({ success: false, message: "ID không hợp lệ!" });

//         const roomCategory = await RoomCategory.findById(id);
//         if (!roomCategory)
//             return res.status(404).json({ success: false, message: "Không tìm thấy loại phòng!" });

//         // Prevent duplicate name
//         if (updateData.category_name) {
//             const duplicate = await RoomCategory.findOne({ category_name: updateData.category_name, _id: { $ne: id } });
//             if (duplicate)
//             return res.status(400).json({ success: false, message: "Tên loại phòng đã tồn tại!" });
//         }

//         const updated = await RoomCategory.findByIdAndUpdate(id, updateData, { new: true });
//         return res.status(200).json({ success: true, message: "Cập nhật thành công!", roomCategory: updated });

//     } catch (err) {
//         console.error(err);
//         return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
//     }
// };

export const deleteRoomCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const force = req.query?.force === 'true';

        const deleted = await RoomCategory.findById(id);
        if (!deleted)
            return res.status(404).json({ success: false, message: "Không tìm thấy loại phòng!" });

        const relatedRoomCount = await Room.countDocuments({ category_id: id });
        if (relatedRoomCount > 0 && !force) {
            return res.status(400).json({ success: false, message: `Loại phòng này có ${relatedServiceCount} phòng. Dùng ?force=true để xóa tất cả các phòng thuộc loại phòng này.` });
        }
        if (force) {
            await Room.deleteMany({ category_id: id });
        }

        await RoomCategory.findByIdAndDelete(id);
        await DefaultEquipment.deleteMany({ category_id: id });

        return res.status(200).json({ success: true, message: "Xóa loại phòng thành công!" });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
    }
};

// export const getAllRoomCategories = async (req, res) => {
//   try {
//     const categories = await RoomCategory.find().populate("default_equipment.equipment", "name type").select("-created_at -updated_at -__v");
//     return res.status(200).json({ success: true, count: categories.length, categories });

//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
//   }
// };

export const getAllRoomCategories = async (req, res) => {
    try {
        const categories = await RoomCategory.find();

        const result = await Promise.all(
            categories.map(async cat => {
                const equipments = await DefaultEquipment.find({
                    category_id: cat._id
                }).populate("equipment_category_id", "category_name");

                return {
                    ...cat.toObject(),
                    default_equipments: equipments
                };
            })
        );

        res.json(result);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getRoomCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await RoomCategory.findById(id);
        if (!category) return res.status(404).json({ message: "Không tìm thấy loại phòng" });

        const defaultEquipments = await DefaultEquipment.find({
            category_id: id
        }).populate("equipment_category_id", "category_name");

        res.json({
            ...category.toObject(),
            default_equipments: defaultEquipments
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// thống kê các loại phòng được đặt nhiều nhất
export const getTopRoomCategories = async (req, res) => {
  try {
    const result = await Booking.aggregate([
      {
        $lookup: {
          from: "rooms",
          localField: "roomId",
          foreignField: "_id",
          as: "room"
        }
      },
      { $unwind: "$room" },
      {
        $group: {
          _id: "$room.category",
          totalBookings: { $sum: 1 }
        }
      },
      { $sort: { totalBookings: -1 } },
      { $limit: 5 }         // top x loại phòng được đặt nhiều nhất
    ]);

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// export const getRoomCategoryById = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const category = await RoomCategory.findById(id).populate("default_equipment.equipment", "name type").select("-created_at -updated_at -__v");
//     if (!category)
//       return res.status(404).json({ success: false, message: "Không tìm thấy loại phòng!" });

//     return res.status(200).json({ success: true, category });
    
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ success: false, message: "SERVER ERROR", err: err.message });
//   }
// };