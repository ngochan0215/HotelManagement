import mongoose from "mongoose";
import { Discount } from "../models/index.js";
import { validateDate } from "../utils/validateDate.js";

export const addNewDiscount = async (req, res) => {
  try {
    const { name, description, begin_date, end_date, percentage, scope, type } = req.body;

    if (!name || !description || !begin_date || !end_date || !percentage) {
      return res.status(400).json({
        success: false,
        message: "Yêu cầu nhập đầy đủ tất cả thông tin!",
      });
    }

    const validDate = validateDate({ begin_date, end_date });
    if (!validDate.valid)
      return res.status(400).json({ success: false, message: validDate.message });

    if (percentage <= 0 || percentage > 100) {
      return res.status(400).json({ success: false, message: "Phần trăm khuyến mãi phải nằm trong khoảng từ 1% đến 100%." });
    }

    const existing = await Discount.findOne({ name });
    if (existing) {
      return res.status(400).json({ success: false, message: "Tên khuyến mãi đã tồn tại." });
    }

    const validScope = ["booking", "room", "service", "customer"];
    if (!validScope.includes(scope)) {
      return res.status(400).json({ message: "Phạm vi khuyến mãi không hợp lệ." });
    }

    const validType = ["seasonal", "first_booking", "loyalty", "promo_code"];
    if (!validType.includes(type)) {
      return res.status(400).json({ message: "Loại khuyến mãi không hợp lệ." });
    }

    const discount = new Discount({ name, description, begin_date: validDate.begin, end_date: validDate.end, percentage, scope, type });
    await discount.save();

    return res.status(201).json({ success: true, message: "Thêm khuyến mãi mới thành công", discount });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
  }
};

export const getAllDiscounts = async (req, res) => {
  try {
    const { type, scope, min_percentage, max_percentage, status } = req.query;
    let filter = {};

    if (status === "active") {
      filter.begin_date = { $lte: now };
      filter.end_date = { $gte: now };
    }
    if (status === "expired") {
      filter.end_date = { $lt: now };
    }

    if (min_percentage || max_percentage) {
      filter.percentage = {};
      if (min_percentage) filter.percentage.$gte = new Number(min_percentage);
      if (max_percentage) filter.percentage.$lte = new Number(max_percentage);
    }

    if (scope) filter.scope = scope;
    if (type) filter.type = type;

    const discounts = await Discount.find(filter)
      .select("-__v -created_at -updated_at")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, totals: discounts.length, discounts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
  }
};

export const getDiscountById = async (req, res) => {
  try {
    const { id } = req.params;
    const discount = await Discount.findById(id).select("-__v");

    if (!discount)
      return res.status(404).json({ success: false, message: "Không tìm thấy khuyến mãi!" });

    return res.status(200).json({ success: true, discount });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
  }
};

export const deleteDiscount = async (req, res) => {
  try {
    const { id } = req.params;

    const discount = await Discount.findById(id);
    if (!discount)
      return res.status(404).json({ success: false, message: "Không tìm thấy khuyến mãi để xóa!" });

    if (discount.status === "active") {
      return res.status(404).json({ success: false, message: "Không được xóa khuyến mãi đang có hiệu lực!" });
    }

    const now = new Date();
    if (discount.begin_date <= now && discount.end_date >= now) {
      return res.status(400).json({
        message: "Không thể xóa khuyến mãi đang có hiệu lực!",
      });
    }

    await Discount.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: "Xóa khuyến mãi thành công!"});

  } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
  }
};

export const updateDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, begin_date, end_date, percentage, type, scope } = req.body;

    const discount = await Discount.findById(id).select("-__v");
    if (!discount)
      return res.status(404).json({ success: false, message: "Không tìm thấy khuyến mãi!" });

    if (discount.status === "active") {
      return res.status(404).json({ success: false, message: "Không được cập nhật khuyến mãi đang có hiệu lực!" });
    }

    const now = new Date();
    if (discount.begin_date <= now && discount.end_date >= now) {
      return res.status(400).json({
        message: "Không thể cập nhật khuyến mãi đang có hiệu lực!",
      });
    }

    // validate thông tin mới
    if (begin_date || end_date) {
      const validDate = validateDate({ begin_date, end_date });
      if (!validDate.valid)
        return res.status(400).json({ success: false, message: validDate.message });

      discount.begin_date = validDate.begin;
      discount.end_date = validDate.end;
    }

    if (name && name !== discount.name) {
      const existing = await Discount.findOne({ name, _id: { $ne: id } });
      if (existing)
          return res.status(400).json({ success: false, message: "Tên khuyến mãi đã tồn tại." });
      discount.name = name;
    }

    if (description) discount.description = description;

    if (typeof percentage !== "undefined") {
      if (percentage < 0 || percentage > 100)
        return res.status(400).json({ success: false, message: "Phần trăm giảm giá phải từ 0 đến 100" });
      discount.percentage = percentage;
    }

    if (scope) {
      const validScope = ["booking", "room", "service", "customer"];
      if (!validScope.includes(scope)) {
        return res.status(400).json({ message: "Phạm vi khuyến mãi không hợp lệ." });
      }
      discount.scope = scope;
    }

    if (type) {
      const validType = ["seasonal", "first_booking", "loyalty", "promo_code"];
      if (!validType.includes(type)) {
        return res.status(400).json({ message: "Loại khuyến mãi không hợp lệ." });
      }
      discount.type = type;
    }

    await discount.save();
    return res.status(200).json({ success: true, message: "Cập nhật khuyến mãi thành công!", discount });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
  }
};

