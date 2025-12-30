import { Service, ServiceCategory, GoodImport, GoodTicket, 
  Employee, Booking, ServiceUsage, UsageDetail, Customer } from "../models/index.js";
import mongoose from "mongoose";

//---- SERVICE CATEGORY ----//
export const createServiceCategory = async (req, res) => {
	try {
		const { name, description } = req.body;

		if (!name || !description) 
      return res.status(400).json({ success: false, message: "Yêu cầu nhập tên danh mục dịch vụ và mô tả." });

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "Tên danh mục dịch vụ phải là chuỗi." });
    }

    if (typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ success: false, message: "Mô tả danh mục dịch vụ phải là chuỗi." });
    }

		const existing = await ServiceCategory.findOne({ name });
		if (existing) 
      return res.status(400).json({ success: false, message: "Tên danh mục dịch vụ đã tồn tại." });
    
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map((file) => file.path); 
    }  

		const category = new ServiceCategory({ name, description, images });
		await category.save();

		return res.status(201).json({ success: true, message: "Tạo danh mục dịch vụ mới thành công", 
      service_category: category });

	} catch (err) {
		console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

export const updateServiceCategory = async (req, res) => {
	try {
		const { id } = req.params;
		const { name, description } = req.body;

		const category = await ServiceCategory.findById(id);
		if (!category) 
      return res.status(404).json({ success: false, message: "Không tìm thấy danh mục loại dịch vụ." });

    if (name && typeof name !== "string") {
      return res.status(400).json({ success: false, message: "Tên danh mục dịch vụ phải là chuỗi." });
    }

    if (description && typeof description !== "string") {
      return res.status(400).json({ success: false, message: "Mô tả danh mục dịch vụ phải là chuỗi." });
    }

    const existing = await ServiceCategory.findOne({ name, _id: { $ne: id } });
		if (existing) 
      return res.status(400).json({ success: false, message: "Tên danh mục dịch vụ đã tồn tại." });

    if (req.files && req.files.length > 0) {
      category.images = req.files.map(file => file.path);
    }

    if (name) category.name = name;
    if (description) category.description = description;

		await category.save();
		return res.status(200).json({ success: true, message: "Cập nhật danh mục dịch vụ thành công!", category });

	} catch (err) {
		console.error(err);
	    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

export const deleteServiceCategory = async (req, res) => {
	try {
		const { id } = req.params;
		const force = req.query?.force === 'true';

		const category = await ServiceCategory.findById(id);
		if (!category) 
      return res.status(404).json({ success: false, message: "Không tìm thấy danh mục dịch vụ." });

		const relatedServiceCount = await Service.countDocuments({ category_id: id });
		if (relatedServiceCount > 0 && !force) {
			return res.status(400).json({ success: false, message: `Danh mục dịch vụ có ${relatedServiceCount} dịch vụ nhỏ kèm theo. Dùng ?force=true để xóa tất cả dịch vụ nhỏ kèm theo.` });
		}

		if (force) {
			await Service.deleteMany({ category_id: id });
		}
		await ServiceCategory.findByIdAndDelete(id);

		return res.status(200).json({ success: true, message: "Xóa danh mục dịch vụ thành công." });

	} catch (err) {
		console.error(err);
	    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

export const getAllServiceCategories = async (req, res) => {
	try {
		const { page = 1, limit = 50, search } = req.query;
		const q = {};
		if (search) {
			q.name = { $regex: search, $options: 'i' };
		}

		const skip = (Number(page) - 1) * Number(limit);

		const categories = await ServiceCategory.find(q)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(Number(limit))
			.lean();

		const total = await ServiceCategory.countDocuments(q);

		return res.status(200).json({
			success: true,
			total,
			page: Number(page),
			limit: Number(limit),
			categories
		});

	} catch (err) {
		console.error(err);
		return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

export const getServicesByCategoryId = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await ServiceCategory.findById(id).select("name description images");
    if (!category)
      return res.status(404).json({ success: false, message: "Không tìm thấy danh mục dịch vụ." });

    const services = await Service.find({ category_id: id }).select("-created_at -updated_at -__v").sort({ created_at: -1 }).lean();

    return res.status(200).json({
      success: true,
      category,
      total: services.length,
      services,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
  }
};

//---- SERVICE ----//
export const createService = async (req, res) => {
	try {
		const { category_id, name, description, unit, price } = req.body;

		if (!category_id || !name || !price || !description) 
      return res.status(400).json({ success: false, message: "Yêu cầu nhập đầy đủ thông tin." });

    if (typeof name !== "string" || typeof description !== "string") {
      return res.status(400).json({ success: false, message: "Tên và mô tả dịch vụ phải là chuỗi." });
    }

    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({ success: false, message: "Đơn giá dịch vụ phải là số nguyên lớn hơn 0." });
    }

		const category = await ServiceCategory.findById(category_id);
		if (!category) 
      return res.status(404).json({ success: false, message: "Không tìm thấy danh mục dịch vụ." });

		const existing = await Service.findOne({ category_id, name });
		if (existing) 
      return res.status(400).json({ success: false, message: "Đã tồn tại dịch vụ có cùng tên cho danh mục dịch vụ này." });

    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map((file) => file.path); 
    } 

		const service = new Service({ category_id, name, description, unit, price, images });
		await service.save();

		return res.status(201).json({ success: true, service });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

export const getServiceById = async (req, res) => {
	try {
		const { id } = req.params;
		const service = await Service.findById(id).lean();
		if (!service) 
      return res.status(404).json({ success: false, message: "Không tìm thấy dịch vụ tương ứng." });

		return res.status(200).json({ success: true, service });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

export const getAllServices = async (req, res) => {
	try {
		const { category_id, page = 1, limit = 50 } = req.query;
		const q = {};

    if (category_id) {
      const category = await ServiceCategory.findById(category_id);
      if (!category) 
        return res.status(404).json({ success: false, message: "Không tìm thấy danh mục dịch vụ." });

      q.category_id = category_id;
    }

		const skip = (Number(page) - 1) * Number(limit);
		const services = await Service.find(q).select("-created_at -updated_at -__v").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();

		return res.status(200).json({ success: true, services });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

export const updateService = async (req, res) => {
	try {
		const { id } = req.params;
		const { name, description, unit, price } = req.body;

		const service = await Service.findById(id);
		if (!service) 
      return res.status(404).json({ success: false, message: "Không tìm thấy dịch vụ." });

    if (name && typeof name !== "string") {
      return res.status(400).json({ success: false, message: "Tên dịch vụ phải là chuỗi." });
    }

    if (description && typeof description !== "string") {
      return res.status(400).json({ success: false, message: "Mô tả dịch vụ phải là chuỗi." });
    }

    if (price && ( typeof price !== "number" || price <= 0 )) {
      return res.status(400).json({ success: false, message: "Đơn giá dịch vụ phải là số nguyên lớn hơn 0." });
    }

		if (name) service.name = name;
		if (description) service.description = description;
		if (unit) service.unit = unit;
    if (price) service.price = price;

    if (req.files && req.files.length > 0) {
      service.images = req.files.map(file => file.path);
    }

		await service.save();
		return res.status(200).json({ success: true, service });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

export const deleteService = async (req, res) => {
	try {
		const { id } = req.params;

		const service = await Service.findByIdAndDelete(id);
		if (!service) 
      return res.status(404).json({ success: false, message: "Không tìm thấy dịch vụ." });

		return res.status(200).json({ success: true, message: "Xóa dịch vụ thành công." });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

//---- GOOD TICKET ----//
export const createGoodTicket = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { import_date, goods_list } = req.body;
    const employee_id = req.user.userId;
    console.log("EMPLOYEE_ID: ", employee_id);

    if (!employee_id || !import_date || !Array.isArray(goods_list)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin." });
    }

    const employee = await Employee.findOne({ user_id: employee_id });
    if (!employee) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Không tìm thấy nhân viên." });
    }

    const existing = await GoodTicket.findOne({ import_date, status: "pending" });
    if (existing)
      return res.status(400).json({ success: false, message: "Có một phiếu đang chờ nhập trùng ngày nhập, bạn có thể tìm kiếm và thêm sản phẩm ở phiếu đó." });

    const importDate = new Date(import_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (importDate < today) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại." });
    }

    if (goods_list.length == 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Không có sản phẩm nào được chọn để nhập. Vui lòng xem lại!" });
    }

    const serviceIds = [];
    for (const item of goods_list) {
      if ( !item.service_id || !mongoose.Types.ObjectId.isValid(item.service_id)) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "service_id không hợp lệ." });
      }

      if (typeof item.import_price !== "number" || item.import_price <= 0) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Đơn giá nhập phải là số nguyên lớn hơn 0." });
      }

      if (!Number.isInteger(item.import_quantity) || item.import_quantity <= 0) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Số lượng nhập phải là số nguyên lớn hơn 0." });
      }

      serviceIds.push(item.service_id.toString());
    }

    if (new Set(serviceIds).size !== serviceIds.length) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Danh sách sản phẩm nhập bị trùng." });
    }

    const services = await Service.find({ _id: { $in: serviceIds } }).session(session);

    if (services.length !== serviceIds.length) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Có sản phẩm không tồn tại trong hệ thống." });
    }

    // tạo phiếu nhập sản phẩm trước
    const ticket = await GoodTicket.create( [{ employee_id, import_date }], { session });

    // thêm chi tiết nhập
    const detailDocs = goods_list.map((item) => ({
      ticket_id: ticket[0]._id,
      service_id: item.service_id,
      import_price: item.import_price,
      import_quantity: item.import_quantity,
    }));

    await GoodImport.insertMany(detailDocs, { session });

    await session.commitTransaction();
    return res.status(201).json({
      success: true,
      message: "Tạo phiếu nhập sản phẩm thành công.",
      data: {
        ticket: ticket[0],
        total_items: detailDocs.length,
      },
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

export const getAllGoodTickets = async (req, res) => {
  try {
    const { employee_id, min_import_date, max_import_date, status } = req.query;
    let filter = {};

    if (employee_id) {
      const employee = await Employee.findOne({ user_id: employee_id });
      if (!employee) 
        return res.status(400).json({ success: false, message: "Không tìm thấy nhân viên." });
      
      filter.employee_id = employee_id;
    }

    if (min_import_date || max_import_date) {
      filter.import_date = {};
      if (min_import_date) filter.import_date.$gte = new Date(min_import_date);
      if (max_import_date) filter.import_date.$lte = new Date(max_import_date);
    }

    if (status) filter.status = status;
    
    const tickets = await GoodTicket.find(filter)
      .populate("employee_id", "full_name")
      .sort({ import_date: -1 })
      .select("-__v -created_at -updated_at");

    // Attach details for each ticket
    const ticketsWithDetails = await Promise.all(
      tickets.map(async (t) => {
        const details = await GoodImport.find({ ticket_id: t._id })
          .populate("service_id", "name")
          .select("-__v -created_at -updated_at -ticket_id");
        return { ...t.toObject(), details };
      })
    );

    res.status(200).json({ success: true, total_tickets: tickets.length, tickets_details: ticketsWithDetails });

  } catch (error) {
    res.status(500).json({ success: false, message: "SERVER ERROR: " + error.message });
  }
};

export const getGoodTicketById = async (req, res) => {
  try {
    const ticket = await GoodTicket.findById(req.params.id)
      .select("-__v -created_at -updated_at")
      .populate("employee_id", "full_name");

    if (!ticket)
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập." });

    const details = await GoodImport.find({ ticket_id: ticket._id })
      .populate("service_id", "name price")
      .select("-__v -created_at -updated_at -ticket_id");

    res.status(200).json({
      success: true,
      data: { ...ticket.toObject(), details },
	});

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateGoodTicket = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { import_date, goods_list } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "ID phiếu nhập không hợp lệ." });
    }

    const ticket = await GoodTicket.findById(id).session(session);
    if (!ticket) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập sản phẩm." });
    }

    if (ticket.status !== "pending") {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Chỉ được sửa phiếu nhập ở trạng thái pending" });
    }

    const now = new Date();
    if (ticket.import_date && now >= new Date(ticket.import_date)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Không thể chỉnh sửa vì đã đến hoặc qua ngày nhập." });
    }

    if (import_date) {
      const importDate = new Date(import_date);
      if (importDate < new Date(now.toDateString())) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Ngày nhập không hợp lệ!" });
      }
      ticket.import_date = importDate;
    }

    await ticket.save({ session });

    if (goods_list) {
      const serviceIds = [];
      for (const item of goods_list) {
        if ( !item.service_id || !mongoose.Types.ObjectId.isValid(item.service_id)) {
          await session.abortTransaction();
          return res.status(400).json({ success: false, message: "service_id không hợp lệ." });
        }

        if (typeof item.import_price !== "number" || item.import_price <= 0) {
          await session.abortTransaction();
          return res.status(400).json({ success: false, message: "Đơn giá nhập phải là số nguyên lớn hơn 0." });
        }

        if (!Number.isInteger(item.import_quantity) || item.import_quantity <= 0) {
          await session.abortTransaction();
          return res.status(400).json({ success: false, message: "Số lượng nhập phải là số nguyên lớn hơn 0." });
        }

        serviceIds.push(item.service_id.toString());
      }

      if (new Set(serviceIds).size !== serviceIds.length) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Danh sách sản phẩm nhập bị trùng." });
      }

      const services = await Service.find({ _id: { $in: serviceIds } }).session(session);

      if (services.length !== serviceIds.length) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: "Có sản phẩm không tồn tại trong hệ thống." });
      }

      await GoodImport.deleteMany({ ticket_id: ticket._id }, { session });

      const detailDocs = goods_list.map(item => ({
        ticket_id: ticket._id,
        service_id: item.service_id,
        import_price: item.import_price,
        import_quantity: item.import_quantity,
      }));

      await GoodImport.insertMany(detailDocs, { session });
    }

    await session.commitTransaction();
    res.status(200).json({ success: true, message: "Cập nhật phiếu nhập thành công.", data: ticket });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

export const deleteGoodTicket = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const force = req.query?.force === 'true';

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "ID phiếu nhập không hợp lệ!" });
    }

    const ticket = await GoodTicket.findById(id).session(session);
    if (!ticket) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập sản phẩm." });
    }

    const now = new Date();
    if (ticket.import_date && now >= new Date(ticket.import_date)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Không thể xóa vì đã đến hoặc qua ngày nhập." });
    }

    if (ticket.status !== "pending") {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Chỉ được xóa phiếu nhập ở trạng thái pending." });
    }

    const relatedImports = await GoodImport.find({ ticket_id: id }).session(session);
    if (relatedImports.length > 0 && !force) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: `Phiếu có ${relatedImports.length} sản phẩm nhập. Dùng ?force=true để xóa toàn bộ phiếu và chi tiết nhập.` });
    }

    await GoodImport.deleteMany({ ticket_id: ticket._id }, { session });
    await ticket.deleteOne({ session });

    await session.commitTransaction();
    res.status(200).json({ success: true, message: "Đã xóa phiếu nhập sản phẩm." });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

export const confirmGoodTicket = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const confirmerId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "ID phiếu nhập không hợp lệ." });
    }

    const ticket = await GoodTicket.findById(id).session(session);
    if (!ticket) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập." });
    }

    if (ticket.status !== "waiting_confirm") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Chỉ được xác nhận phiếu ở trạng thái waiting_confirm.",
      });
    }

    const imports = await GoodImport.find({ ticket_id: ticket._id }).session(session);
    if (imports.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Phiếu nhập chưa có sản phẩm nào.",
      });
    }

    // cập nhật tồn kho từng service
    for (const item of imports) {
      const service = await Service.findById(item.service_id).session(session);

      if (!service) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Có sản phẩm không tồn tại trong hệ thống.",
        });
      }

      service.storage_quantity = (service.storage_quantity || 0) + item.import_quantity;

      await service.save({ session });
    }

    ticket.status = "completed";
    ticket.confirmed_by = confirmerId;
    ticket.confirmed_at = new Date();

    await ticket.save({ session });

    await session.commitTransaction();
    res.status(200).json({
      success: true,
      message: "Xác nhận nhập kho thành công.",
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

//---- SERVICE USAGE ----//
// export const createServiceUsage = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { booking_id, customer_id, services } = req.body;

//     // validate cơ bản
//     if (!booking_id || !customer_id || !Array.isArray(services)) {
//       await session.abortTransaction();
//       return res.status(400).json({ success: false, message: "Yêu cầu nhập đầy đủ thông tin." });
//     }

//     if (!mongoose.Types.ObjectId.isValid(booking_id) || !mongoose.Types.ObjectId.isValid(customer_id)) {
//       await session.abortTransaction();
//       return res.status(400).json({ success: false, message: "booking_id hoặc customer_id không hợp lệ." });
//     }

//     if (services.length === 0) {
//       await session.abortTransaction();
//       return res.status(400).json({ success: false, message: "Danh sách dịch vụ không được rỗng." });
//     }

//     const booking = await Booking.findById(booking_id).session(session);
//     if (!booking) {
//       await session.abortTransaction();
//       return res.status(404).json({ success: false, message: "Không tìm thấy booking." });
//     }

//     if (!["confirmed", "in_progress"].includes(booking.status)) {
//       await session.abortTransaction();
//       return res.status(400).json({ success: false, message: "Trạng thái Booking hiện tại không cho phép sử dụng dịch vụ." });
//     }

//     const customer = await Customer.findById(customer_id).session(session);
//     if (!customer) {
//       await session.abortTransaction();
//       return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng." });
//     }

//     if (booking.customer_id.toString() !== customer_id) {
//       await session.abortTransaction();
//       return res.status(400).json({ success: false, message: "Khách hàng không thuộc booking này." });
//     }

//     const existingUsage = await ServiceUsage.findOne({ booking_id, status: { $in: ["pending", "confirmed"] } }).session(session);
//     if (existingUsage) {
//       await session.abortTransaction();
//       return res.status(409).json({ success: false, message: "Booking này đã có phiếu sử dụng dịch vụ đang mở, có thể cân nhắc thêm dịch vụ vào phiếu đó.", data: existingUsage });
//     }

//     // validate danh sách dịch vụ
//     const serviceIds = services.map((s) => s.service_id);

//     const dbServices = await Service.find({ _id: { $in: serviceIds }, status: "active" }).session(session);

//     if (dbServices.length !== services.length) {
//       await session.abortTransaction();
//       return res.status(400).json({ success: false, message: "Một hoặc nhiều dịch vụ không tồn tại hoặc không hoạt động." });
//     }

//     const serviceMap = {};
//     dbServices.forEach((s) => { serviceMap[s._id.toString()] = s; });

//     // tạo phiếu sử dụng dịch vụ
//     const serviceUsage = await ServiceUsage.create(
//       [{
//           booking_id,
//           customer_id,
//           total_fee: 0,
//         }], { session }
//     );

//     let totalUsageFee = 0;

//     for (let i = 0; i < services.length; i++) {
//       const item = services[i];

//       if (!item.service_id) {
//         await session.abortTransaction();
//         return res.status(400).json({ success: false, message: `Thiếu service_id tại phần tử thứ ${i + 1}.` });
//       }

//       if (!mongoose.Types.ObjectId.isValid(item.service_id)) {
//         await session.abortTransaction();
//         return res.status(400).json({ success: false, message: `service_id không hợp lệ tại phần tử thứ ${i + 1}.` });
//       }

//       if (!item.quantity || item.quantity < 1) {
//         await session.abortTransaction();
//         return res.status(400).json({ success: false, message: `quantity phải >= 1 tại phần tử thứ ${i + 1}.` });
//       }

//       if (!item.use_from || isNaN(new Date(item.use_from).getTime())) {
//         await session.abortTransaction();
//         return res.status(400).json({ success: false, message: `use_from không hợp lệ tại phần tử thứ ${i + 1}.` });
//       }

//       if (!item.finish_at || isNaN(new Date(item.finish_at).getTime())) {
//         await session.abortTransaction();
//         return res.status(400).json({ success: false, message: `finish_at không hợp lệ tại phần tử thứ ${i + 1}.` });
//       }

//       if (new Date(item.use_from) >= new Date(item.finish_at)) {
//         await session.abortTransaction();
//         return res.status(400).json({ success: false, message: `use_from phải nhỏ hơn finish_at tại phần tử thứ ${i + 1}.` });
//       }

//       const itemTotal = item.quantity * service.price;
//       totalUsageFee += itemTotal;
//     }

//     const usageDetailsData = services.map((item) => ({
//       ticket_id: serviceUsage[0]._id,
//       service_id: item.service_id,
//       quantity: item.quantity,
//       use_from: new Date(item.use_from),
//       finish_at: new Date(item.finish_at),
//       current_price: serviceMap[item.service_id].price,
//       total_fee: 0,
//       status: "pending",
//     }));


//     await UsageDetail.insertMany(usageDetailsData, { session });

//     await session.commitTransaction();
//     session.endSession();

//     return res.status(201).json({
//       success: true,
//       message: "Tạo phiếu sử dụng dịch vụ thành công.",
//       data: {
//         service_usage: serviceUsage[0],
//         usage_details: usageDetailsData,
//       },
//     });

//   } catch (error) {
//     await session.abortTransaction();
//     return res.status(500).json({ success: false, message: "SERVER ERROR: " + error.message });
//   } finally {
//     session.endSession();
//   }
// };
export const createServiceUsage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { booking_id, customer_id, services } = req.body;

    /* ================= VALIDATE INPUT ================= */
    if (
      !booking_id ||
      !customer_id ||
      !Array.isArray(services) ||
      services.length === 0
    ) {
      throw { status: 400, message: "Yêu cầu nhập đầy đủ thông tin." };
    }

    if (
      !mongoose.Types.ObjectId.isValid(booking_id) ||
      !mongoose.Types.ObjectId.isValid(customer_id)
    ) {
      throw { status: 400, message: "booking_id hoặc customer_id không hợp lệ." };
    }

    /* ================= CHECK BOOKING ================= */
    const booking = await Booking.findById(booking_id).session(session);
    if (!booking) {
      throw { status: 404, message: "Không tìm thấy booking." };
    }

    if (!["confirmed", "in_progress"].includes(booking.status)) {
      throw {
        status: 400,
        message: "Trạng thái booking không cho phép sử dụng dịch vụ.",
      };
    }

    if (booking.customer_id.toString() !== customer_id) {
      throw {
        status: 400,
        message: "Khách hàng không thuộc booking này.",
      };
    }

    /* ================= CHECK CUSTOMER ================= */
    const customer = await Customer.findById(customer_id).session(session);
    if (!customer) {
      throw { status: 404, message: "Không tìm thấy khách hàng." };
    }

    /* ================= CHECK EXISTING USAGE ================= */
    const existingUsage = await ServiceUsage.findOne({
      booking_id,
      status: { $in: ["pending", "confirmed"] },
    }).session(session);

    if (existingUsage) {
      throw {
        status: 409,
        message:
          "Booking đã có phiếu sử dụng dịch vụ đang mở, hãy thêm dịch vụ vào phiếu đó.",
        data: existingUsage,
      };
    }

    /* ================= VALIDATE SERVICES ================= */
    const serviceIds = services.map((s) => {
      if (!s.service_id || !mongoose.Types.ObjectId.isValid(s.service_id)) {
        throw { status: 400, message: "service_id không hợp lệ." };
      }
      return s.service_id;
    });

    const dbServices = await Service.find({
      _id: { $in: serviceIds },
      status: "active",
    }).session(session);

    if (dbServices.length !== services.length) {
      throw {
        status: 400,
        message: "Một hoặc nhiều dịch vụ không tồn tại hoặc không hoạt động.",
      };
    }

    const serviceMap = {};
    dbServices.forEach((s) => {
      serviceMap[s._id.toString()] = s;
    });

    /* ================= CREATE SERVICE USAGE ================= */
    const [serviceUsage] = await ServiceUsage.create(
      [
        {
          booking_id,
          customer_id,
          total_fee: 0,
          status: "pending",
        },
      ],
      { session }
    );

    let totalUsageFee = 0;

    const usageDetailsData = services.map((item, index) => {
      const service = serviceMap[item.service_id.toString()];

      if (!item.quantity || item.quantity < 1) {
        throw {
          status: 400,
          message: `quantity phải >= 1 tại phần tử thứ ${index + 1}.`,
        };
      }

      const useFrom = new Date(item.use_from);
      const finishAt = new Date(item.finish_at);

      if (isNaN(useFrom) || isNaN(finishAt)) {
        throw {
          status: 400,
          message: `use_from hoặc finish_at không hợp lệ tại phần tử thứ ${
            index + 1
          }.`,
        };
      }

      if (useFrom >= finishAt) {
        throw {
          status: 400,
          message: `use_from phải nhỏ hơn finish_at tại phần tử thứ ${
            index + 1
          }.`,
        };
      }

      const itemTotal = item.quantity * service.price;
      totalUsageFee += itemTotal;

      return {
        ticket_id: serviceUsage._id,
        service_id: service._id,
        quantity: item.quantity,
        use_from: useFrom,
        finish_at: finishAt,
        current_price: service.price,
        total_fee: itemTotal,
        status: "pending",
      };
    });

    await UsageDetail.insertMany(usageDetailsData, { session });

    /* ================= UPDATE TOTAL FEE ================= */
    serviceUsage.total_fee = totalUsageFee;
    await serviceUsage.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Tạo phiếu sử dụng dịch vụ thành công.",
      data: {
        service_usage: serviceUsage,
        usage_details: usageDetailsData,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("createServiceUsage error:", error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Lỗi server.",
      data: error.data || null,
    });
  }
};


//---- GOOD IMPORT ----//
// export const createGoodImport = async (req, res) => {
//   try {
//     const { ticket_id, category_id, import_price, import_quantity } = req.body;

// 	if (!ticket_id || !category_id || !import_price || !import_quantity ) 
//         return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin." });

//     const ticket = await GoodTicket.findById(ticket_id);
//     if (!ticket)
//       return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập tổng." });

// 	if (ticket.status === "completed")
//         return res.status(400).json({ success: false, message: "Phiếu đã hoàn tất, không thể thêm sản phẩm mới." });

// 	const category = await ServiceCategory.findById(category_id);
// 	if (!category) 
// 		return res.status(404).json({ success: false, message: "Không tìm thấy danh mục dịch vụ (sản phẩm)." });

// 	const qty = Number(import_quantity ?? 1);
// 	if (!Number.isInteger(qty) || qty <= 0) {
// 		return res.status(400).json({ success: false, message: "Số lượng nhập phải là số nguyên dương." });
// 	}	

//     const currGoodImport = await GoodImport.create({
//       ticket_id,
//       category_id,
//       import_price,
//       import_quantity,
//     });

//     return res.status(201).json({ success: true, message: "Thêm chi tiết phiếu nhập sản phẩm thành công!", import_shoppee });

//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// export const getAllGoodImports = async (req, res) => {
//   try {
//     const { ticket_id } = req.query;
//     const filter = ticket_id ? { ticket_id } : {};

//     const imports = await GoodImport.find(filter)
//       .populate("service_id", "name price")
//       .populate("ticket_id", "import_date")
//       .select("-__v -created_at -updated_at");

//     res.status(200).json({ success: true, count: imports.length, imports });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// export const getGoodImportById = async (req, res) => {
//   try {
//     const item = await GoodImport.findById(req.params.id)
//       .populate("service_id", "name price")
//       .populate("ticket_id", "import_day");

//     if (!item)
//       return res.status(404).json({ success: false, message: "Import detail not found." });

//     res.status(200).json({ success: true, data: item });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// export const updateGoodImport = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { category_id, import_price, import_quantity } = req.body;

//     const imp = await GoodImport.findById(id);
//     if (!imp) 
//       return res.status(404).json({ success: false, message: "Không tìm thấy chi tiết nhập sản phẩm." });

//     const ticket = await GoodTicket.findById(imp.ticket_id);
//     if (!ticket)
//       return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập liên kết." });

//     const category = await ServiceCategory.findById(category_id);
//     if (!category) 
//       return res.status(404).json({ success: false, message: "Không tìm thấy danh mục dịch vụ (sản phẩm)." });

//     const now = new Date();
//     if (ticket.import_date && now >= new Date(ticket.import_date)) {
//       return res.status(400).json({
//           success: false,
//           message: "Không thể chỉnh sửa vì đã đến hoặc qua ngày nhập sản phẩm."
//       });
//     }

//     const item = await GoodImport.findByIdAndUpdate( id,
//       { category_id, import_price, import_quantity },
//       { new: true }
//     );

//     return res.status(200).json({ success: true, message: "Cập nhật chi tiết nhập thành công!", import: imp });

//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// export const deleteGoodImport = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const item = await GoodImport.findById(id);
//     if (!item)
//       return res.status(404).json({ success: false, message: "Không tìm thấy chi tiết nhập sản phẩm." });

//     const now = new Date();
//     if (ticket.import_date && now >= new Date(ticket.import_date)) {
//       return res.status(400).json({
//           success: false,
//           message: "Không thể xóa vì đã đến hoặc qua ngày nhập sản phẩm."
//       });
//     }

//     await item.deleteOne();
//     res.status(200).json({ success: true, message: "Đã xóa chi tiết phiếu nhập sản phẩm." });
    
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
