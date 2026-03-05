import * as roomService from "../services/roomCategoryService.js";


export const createRoomCategory = async (req, res) => {
  try {
    const result = await roomService.createRoomCategoryService(req.body, req.files);
    res.json({ success: true, message: "Thêm danh mục phòng thành công", ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};


export const updateRoomCategory = async (req, res) => {
  try {
    const category = await roomService.updateRoomCategoryService(
      req.params.id,
      req.body,
      req.files
    );
    res.json({ message: "Cập nhật danh mục phòng thành công", category });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};


export const deleteRoomCategory = async (req, res) => {
  try {
    const result = await roomService.deleteRoomCategoryService(
      req.params.id,
      req.query.force === "true"
    );

    if (result?.needConfirm) {
      return res.status(409).json({
        code: "CATEGORY_HAS_ROOMS",
        roomCount: result.roomCount
      });
    }

    res.json({ message: "Xóa thành công" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};


export const getAllRoomCategories = async (req, res) => {
  try {
    const data = await roomService.getAllRoomCategoriesService();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


export const getRoomCategoryById = async (req, res) => {
  try {
    const data = await roomService.getRoomCategoryByIdService(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};


export const getDefaultEquipmentsByCategory = async (req, res) => {
  try {
    const data = await roomService.getDefaultEquipmentsService(req.params.category_id);

    res.json({
      success: true,
      count: data.length,
      default_equipments: data
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};


export const getAvailableRoomCategories = async (req, res) => {
  try {
    const data = await roomService.getAvailableRoomCategoriesService(req.query);
    res.json(data);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};