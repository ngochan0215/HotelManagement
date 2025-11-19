import { Shift } from "../models/index.js";

export const createShift = async (req, res) => {
  try {
    const { work_day, shift_type, begin_time, end_time } = req.body;

    if (!work_day || !shift_type || !begin_time || !end_time) {
            return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc!" });
        }

    // Prevent duplicate shift (same day + type)
    const existing = await Shift.findOne({ work_day, shift_type });
    if (existing)
      return res.status(400).json({ success: false, message: "Đã tồn tại loại ca làm này trong cùng ngày." });

    const shift = await Shift.create({ work_day, shift_type, begin_time, end_time });

    res.status(201).json({ success: true, message: "Thêm ca làm thành công", data: shift });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllShifts = async (req, res) => {
  try {
    // sort by weekday order
    const weekdayOrder = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

    const shifts = await Shift.find().lean();

    // Sort in custom weekday + shift order
    const ordered = shifts.sort((a, b) => {
      const dayDiff = weekdayOrder.indexOf(a.work_day) - weekdayOrder.indexOf(b.work_day);
      if (dayDiff !== 0) return dayDiff;
      return a.shift_type.localeCompare(b.shift_type);
    });

    res.status(200).json({ success: true, count: ordered.length, shifts: ordered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getShiftById = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift)
      return res.status(404).json({ success: false, message: "Không tìm thấy ca làm việc." });

    res.status(200).json({ success: true, shift_info: shift });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateShift = async (req, res) => {
  try {
    const { work_day, shift_type, begin_time, end_time } = req.body;

    // Optional: check for duplicate (if day/type changed)
    const duplicate = await Shift.findOne({
      _id: { $ne: req.params.id },
      work_day,
      shift_type,
    });
    if (duplicate)
      return res.status(400).json({ success: false, message: "Shift for this day and type already exists." });

    const shift = await Shift.findByIdAndUpdate(
      req.params.id,
      { work_day, shift_type, begin_time, end_time },
      { new: true }
    );

    if (!shift)
      return res.status(404).json({ success: false, message: "Không tìm thấy ca làm việc" });

    res.status(200).json({ success: true, message: "Cập nhật thông tin ca làm thành công.", data: shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteShift = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift)
      return res.status(404).json({ success: false, message: "Không tìm thấy ca làm việc" });

    await shift.deleteOne();
    res.status(200).json({ success: true, message: "Xóa ca làm thành công." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
