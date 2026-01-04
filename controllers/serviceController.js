import { Service, ServiceCategory, GoodImport, GoodTicket, 
  Employee, Booking, ServiceUsage, UsageDetail, Customer } from "../models/index.js";
import mongoose from "mongoose";
import { FOOD_CATEGORY_ID } from "../constants/cancellationReason.js";

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
		const { category_id, status, min_quantity, max_quantity,
      min_price, max_price, page = 1, limit = 50 } = req.query;
		const filter = {};

    if (category_id) {
      const category = await ServiceCategory.findById(category_id);
      if (!category) 
        return res.status(404).json({ success: false, message: "Không tìm thấy danh mục dịch vụ." });

      filter.category_id = category_id;
    }

    if (status) filter.status = status;

    if (min_price || max_price) {
        filter.price = {};
        if (min_price) filter.price.$gte = new Date(min_price);
        if (max_price) filter.price.$lte = new Date(max_price);
    }

    if (min_quantity || max_quantity) {
        filter.storage_quantity = {};
        if (min_quantity) filter.storage_quantity.$gte = new Date(min_quantity);
        if (max_quantity) filter.storage_quantity.$lte = new Date(max_quantity);
    }

		const skip = (Number(page) - 1) * Number(limit);
		const services = await Service.find(filter).select("-created_at -updated_at -__v").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();

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

    if (price !== undefined) {
      const parsedPrice = Number(price);

      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: "Đơn giá dịch vụ phải là số lớn hơn 0.",
        });
      }
    }

    // if (storage_quantity && ( typeof storage_quantity !== "number" || storage_quantity <= 0 )) {
    //   return res.status(400).json({ success: false, message: "Số lượng dịch vụ phải là số nguyên lớn hơn 0." });
    // }

		if (name) service.name = name;
		if (description) service.description = description;
		if (unit) service.unit = unit;
    if (price) service.price = price;
    //if (storage_quantity) service.storage_quantity = storage_quantity;

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
    const employeeId = employee._id;
    const ticket = await GoodTicket.create( [{ employee_id: employeeId, import_date }], { session });

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
      
      filter.employee_id = employee._id;
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
export const createServiceUsage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { booking_id, customer_id, services } = req.body;

    // validate cơ bản
    if (!booking_id || !customer_id || !Array.isArray(services) || services.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Yêu cầu nhập đầy đủ thông tin." });
    }

    if (!mongoose.Types.ObjectId.isValid(booking_id) || !mongoose.Types.ObjectId.isValid(customer_id)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "booking_id hoặc customer_id không hợp lệ." });
    }

    const booking = await Booking.findById(booking_id).session(session);
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Không tìm thấy booking." });
    }

    if (!["confirmed", "in_progress"].includes(booking.status)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Trạng thái Booking hiện tại không cho phép sử dụng dịch vụ." });
    }

    const customer = await Customer.findById(customer_id).session(session);
    if (!customer) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: "Không tìm thấy khách hàng." });
    }

    if (booking.customer_id.toString() !== customer_id) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Khách hàng không thuộc booking này." });
    }

    const serviceIds = services.map((s) => s.service_id);
    const dbServices = await Service.find({ _id: { $in: serviceIds }, status: "active" }).session(session);

    if (dbServices.length !== services.length) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: "Một hoặc nhiều dịch vụ không tồn tại hoặc không hoạt động." });
    }

    const serviceMap = {};
    dbServices.forEach((s) => { serviceMap[s._id.toString()] = s; });

    // tạo phiếu sử dụng dịch vụ
    const serviceUsage = await ServiceUsage.create(
      [{
        booking_id,
        customer_id,
        employee_id: req.user.userId,
        total_fee: 0,
      }], { session }
    );

    let totalUsageFee = 0;

    for (let i = 0; i < services.length; i++) {
      const item = services[i];

      if (!item.service_id || !mongoose.Types.ObjectId.isValid(item.service_id)) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: `service_id không hợp lệ tại phần tử thứ ${i + 1}.` });
      }
      const service = await Service.findById(item.service_id);
      const isFoodService = service.category_id.toString() === FOOD_CATEGORY_ID;

      if (!item.quantity || item.quantity < 1) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: `quantity phải >= 1 tại phần tử thứ ${i + 1}.` });
      }

      // if (!isFoodService && (item.use_from || item.finish_at)) {
      //   if (isNaN(new Date(item.use_from).getTime()) || isNaN(new Date(item.use_from).getTime())) {
      //     await session.abortTransaction();
      //     return res.status(400).json({ success: false, message: `use_from hoặc finish_at không hợp lệ tại phần tử thứ ${i + 1}.` });
      //   }

      //   if (new Date(item.use_from) < new Date()) {
      //     await session.abortTransaction();
      //     return res.status(400).json({ success: false, message: `use_from không được ở trong quá khứ tại phần tử thứ ${i + 1}.` });
      //   }

      //   if (new Date(item.use_from) >= new Date(item.finish_at)) {
      //     await session.abortTransaction();
      //     return res.status(400).json({ success: false, message: `use_from phải nhỏ hơn finish_at tại phần tử thứ ${i + 1}.` });
      //   }
      // }
    }

    const usageDetailsData = services.map((item) => {
      const service = serviceMap[item.service_id.toString()];
      const itemTotal = item.quantity * service.price;
      totalUsageFee += itemTotal;

      return {
        ticket_id: serviceUsage[0]._id,
        service_id: item.service_id,
        quantity: item.quantity,
        use_from: item.use_from ? new Date(item.use_from) : new Date(),
        finish_at: item.finish_at ? new Date(item.finish_at) : null,
        current_price: service.price,
        total_fee: itemTotal,
        status: "waiting_confirm",
      };
    });

    await UsageDetail.insertMany(usageDetailsData, { session });
    serviceUsage[0].total_fee = totalUsageFee;
    await serviceUsage[0].save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Tạo phiếu sử dụng dịch vụ thành công.",
      data: {
        service_usage: serviceUsage[0],
        usage_details: usageDetailsData,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ success: false, message: "SERVER ERROR: " + error.message });
  } finally {
    session.endSession();
  }
};

export const getAllServiceUsage = async (req, res) => {
  try {
    const { employee_id, customer_id, booking_id, status } = req.query;

    const filter = {};

    if (employee_id) {
      if (!mongoose.Types.ObjectId.isValid(employee_id)) {
        return res.status(400).json({
          success: false,
          message: "employee_id không hợp lệ",
        });
      }
      filter.employee_id = employee_id;
    }

    if (customer_id) {
      if (!mongoose.Types.ObjectId.isValid(customer_id)) {
        return res.status(400).json({
          success: false,
          message: "customer_id không hợp lệ",
        });
      }
      filter.customer_id = customer_id;
    }

    if (booking_id) {
      if (!mongoose.Types.ObjectId.isValid(booking_id)) {
        return res.status(400).json({
          success: false,
          message: "booking_id không hợp lệ",
        });
      }
      filter.booking_id = booking_id;
    }

    if (status) {
      filter.status = status;
    }

    const serviceUsages = await ServiceUsage.find(filter)
      .select("-__v -created_at -updated_at")
      .populate("booking_id", "status")
      .populate("customer_id", "full_name phone")
      .populate("employee_id", "full_name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: serviceUsages.length,
      data: serviceUsages,
    });
  } catch (error) {
    console.error("getAllServiceUsage error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR",
    });
  }
};

export const getServiceUsageById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "service_usage_id không hợp lệ",
      });
    }

    const serviceUsage = await ServiceUsage.findById(id)
      .select("-__v -created_at -updated_at")
      .populate("booking_id", "status")
      .populate("customer_id", "full_name phone")
      .populate("employee_id", "full_name");

    if (!serviceUsage) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu sử dụng dịch vụ",
      });
    }

    const usageDetails = await UsageDetail.find({ ticket_id: serviceUsage._id })
      .select("-__v -created_at -updated_at -ticket_id")
      .populate("service_id", "name price unit")
      .sort({ use_from: 1 });

    return res.status(200).json({
      success: true,
      data: {
        service_usage: serviceUsage,
        usage_details: usageDetails,
      },
    });
  } catch (error) {
    console.error("getServiceUsageById error:", error);
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR",
    });
  }
};

export const deleteServiceUsage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
  const force = req.query?.force === 'true';

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "ID phiếu sử dụng dịch vụ không hợp lệ",
      });
    }

    const serviceUsage = await ServiceUsage.findById(id).session(session);

    if (!serviceUsage) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu sử dụng dịch vụ",
      });
    }

    if (serviceUsage.status !== "pending") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Chỉ được xóa phiếu sử dụng dịch vụ khi trạng thái là pending",
      });
    }

    const relatedDetails = await UsageDetail.find({ ticket_id: id }).session(session);
    if (relatedDetails.length > 0 && !force) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: `Phiếu có ${relatedDetails.length} dịch vụ sử dụng. Dùng ?force=true để xóa toàn bộ phiếu sử dụng dịch vụ.` });
    }

    // Xóa toàn bộ usage detail
    await UsageDetail.deleteMany(
      { ticket_id: serviceUsage._id },
      { session }
    );

    // Xóa phiếu
    await ServiceUsage.deleteOne(
      { _id: serviceUsage._id },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Xóa phiếu sử dụng dịch vụ thành công",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("deleteServiceUsage error:", error);

    return res.status(500).json({
      success: false,
      message: "SERVER ERROR",
    });
  }
};

export const updateServiceUsage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { services } = req.body;

    const serviceUsage = await ServiceUsage.findById(id).session(session);
    if (!serviceUsage) {
      throw new Error("Không tìm thấy phiếu sử dụng dịch vụ.");
    }

    if (serviceUsage.status !== "pending") {
      throw new Error("Chỉ được cập nhật phiếu sử dụng dịch vụ khi trạng thái là pending.");
    }

    if (!Array.isArray(services) || services.length === 0) {
      throw new Error("Danh sách dịch vụ không hợp lệ.");
    }

    // validate service_id
    const serviceIds = services.map((s) => s.service_id);
    const dbServices = await Service.find({
      _id: { $in: serviceIds },
      status: "active",
    }).session(session);

    if (dbServices.length !== services.length) {
      throw new Error("Một hoặc nhiều dịch vụ không tồn tại hoặc không hoạt động.");
    }

    const serviceMap = Object.fromEntries(
      dbServices.map((s) => [s._id.toString(), s])
    );

    let totalUsageFee = 0;

    const usageDetailsData = services.map((item, index) => {
      if (!mongoose.Types.ObjectId.isValid(item.service_id)) {
        throw new Error(`service_id không hợp lệ tại phần tử ${index + 1}`);
      }

      if (!item.quantity || item.quantity < 1) {
        throw new Error(`quantity phải >= 1 tại phần tử ${index + 1}`);
      }

      if (item.use_from && item.finish_at) {
        const from = new Date(item.use_from);
        const to = new Date(item.finish_at);

        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
          throw new Error(`use_from hoặc finish_at không hợp lệ tại phần tử ${index + 1}`);
        }

        if (from >= to) {
          throw new Error(`use_from phải nhỏ hơn finish_at tại phần tử ${index + 1}`);
        }
      }

      const service = serviceMap[item.service_id.toString()];
      const itemTotal = item.quantity * service.price;
      totalUsageFee += itemTotal;

      return {
        ticket_id: serviceUsage._id,
        service_id: item.service_id,
        quantity: item.quantity,
        use_from: item.use_from ? new Date(item.use_from) : null,
        finish_at: item.finish_at ? new Date(item.finish_at) : null,
        current_price: service.price,
        total_fee: itemTotal,
        status: item.use_from ? "pending" : "waiting_confirm",
      };
    });

    await UsageDetail.deleteMany({ ticket_id: id }, { session });
    await UsageDetail.insertMany(usageDetailsData, { session });

    serviceUsage.total_fee = totalUsageFee;
    await serviceUsage.save({ session });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Cập nhật phiếu sử dụng dịch vụ thành công.",
      data: {
        service_usage: serviceUsage,
        usage_details: usageDetailsData,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  } finally {
    session.endSession();
  }
};

export const recalcServiceUsageStatus = async (ticketId) => {

  const details = await UsageDetail.find(
    { ticket_id: ticketId });

  if (!details.length) return;

  const statuses = details.map(d => d.status);
  let newStatus = "pending";

  if (statuses.every(s => s === "pending")) {
    newStatus = "pending";
  } else if (statuses.some(s => s === "waiting_confirm")) {
    newStatus = "waiting_confirm";
  } else if (statuses.every(s => s === "cancelled")) {
    newStatus = "cancelled";
  } else if (
    statuses.every(s => ["completed", "cancelled"].includes(s))
  ) {
    newStatus = "completed";
  }

  await ServiceUsage.updateOne(
    { _id: ticketId },
    { $set: { status: newStatus } }
  );
};

export const confirmServiceUsage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params; // service_usage_id
    const employeeUserId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "service_usage_id không hợp lệ",
      });
    }

    const employee = await Employee.findOne({ user_id: employeeUserId });
    if (!employee) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy nhân viên",
      });
    }

    const serviceUsage = await ServiceUsage.findById(id).session(session);
    if (!serviceUsage) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu sử dụng dịch vụ",
      });
    }

    const usageDetails = await UsageDetail.find({
      ticket_id: id,
    }).session(session);

    if (usageDetails.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Phiếu chưa có chi tiết sử dụng dịch vụ",
      });
    }

    // chỉ cho confirm nếu tất cả đang waiting_confirm
    const invalidDetail = usageDetails.find(
      (d) => d.status !== "waiting_confirm"
    );
    if (invalidDetail) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Phiếu có chi tiết không ở trạng thái waiting_confirm",
      });
    }

    // gom service để tránh query lặp
    const serviceIds = usageDetails.map((d) => d.service_id);
    const services = await Service.find({
      _id: { $in: serviceIds },
    }).session(session);

    const serviceMap = {};
    services.forEach((s) => {
      serviceMap[s._id.toString()] = s;
    });

    // kiểm tra tồn kho trước
    for (const detail of usageDetails) {
      const service = serviceMap[detail.service_id.toString()];

      if (!service) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Dịch vụ không tồn tại",
        });
      }

      if (
        service.category_id.toString() === FOOD_CATEGORY_ID &&
        service.storage_quantity < detail.quantity
      ) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Không đủ tồn kho cho dịch vụ ${service.name}`,
        });
      }
    }

    // cập nhật trạng thái + trừ kho
    for (const detail of usageDetails) {
      const service = serviceMap[detail.service_id.toString()];

      detail.status = "completed";
      detail.confirmed_at = new Date();
      detail.finish_at = new Date();
      detail.confirmed_by = employee._id;
      await detail.save({ session });

      if (service.category_id.toString() === FOOD_CATEGORY_ID) {
        await Service.updateOne(
          {
            _id: service._id,
            storage_quantity: { $gte: detail.quantity },
          },
          {
            $inc: { storage_quantity: -detail.quantity },
          },
          { session }
        );
      }
    }

    await session.commitTransaction();
    session.endSession();

    // cập nhật trạng thái phiếu
    await recalcServiceUsageStatus(serviceUsage._id);

    return res.status(200).json({
      success: true,
      message: "Xác nhận toàn bộ phiếu sử dụng dịch vụ thành công",
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + error.message,
    });
  }
};

export const cancelServiceUsage = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params; // service_usage_id
    const employeeUserId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "service_usage_id không hợp lệ",
      });
    }

    const employee = await Employee.findOne({ user_id: employeeUserId });
    if (!employee) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy nhân viên",
      });
    }

    const serviceUsage = await ServiceUsage.findById(id).session(session);
    if (!serviceUsage) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phiếu sử dụng dịch vụ",
      });
    }

    const usageDetails = await UsageDetail.find({
      ticket_id: id,
    }).session(session);

    if (usageDetails.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Phiếu chưa có chi tiết sử dụng dịch vụ",
      });
    }

    // Không cho hủy nếu có detail đã hoàn thành
    const completedDetail = usageDetails.find(
      (d) => d.status === "completed"
    );
    if (completedDetail) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Không thể hủy phiếu vì có dịch vụ đã hoàn thành",
      });
    }

    // Hủy các detail chưa hủy
    for (const detail of usageDetails) {
      if (detail.status === "cancelled") continue;

      detail.status = "cancelled";
      detail.cancelled_at = new Date();
      detail.confirmed_by = employee._id;

      await detail.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // cập nhật trạng thái phiếu
    await recalcServiceUsageStatus(serviceUsage._id);

    return res.status(200).json({
      success: true,
      message: "Hủy toàn bộ phiếu sử dụng dịch vụ thành công",
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + error.message,
    });
  }
};

export const confirmUsageDetail = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const employee_id = req.user.userId;
    const employee = await Employee.findOne({ user_id: employee_id });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "usage_detail_id không hợp lệ",
      });
    }

    const usageDetail = await UsageDetail.findById(id).session(session);
    if (!usageDetail) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy usage detail",
      });
    }

    if (usageDetail.status !== "waiting_confirm") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể xác nhận khi trạng thái là waiting_confirm",
      });
    }

    usageDetail.status = "completed";
    usageDetail.confirmed_at = new Date();
    usageDetail.confirmed_by = employee._id;

    await usageDetail.save({ session });

    // trừ kho cho những dịch vụ là vật thể
    const service = await Service.findById(usageDetail.service_id).session(session);
    const category_id = service.category_id;
    if (category_id.toString() === FOOD_CATEGORY_ID) {
      if (service.storage_quantity < usageDetail.quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Số lượng tồn kho không đủ",
        });
      }

      await Service.updateOne(
        {
          _id: service._id,
          storage_quantity: { $gte: usageDetail.quantity },
        },
        {
          $inc: { storage_quantity: -usageDetail.quantity },
        },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    // Tự cập nhật service_usage
    await recalcServiceUsageStatus(usageDetail.ticket_id);

    return res.status(200).json({
      success: true,
      message: "Xác nhận sử dụng dịch vụ thành công",
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      success: false,
      message: "SERVER ERROR",
    });
  }
};

export const cancelUsageDetail = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const employee_id = req.user.userId;
    const employee = await Employee.findOne({ user_id: employee_id });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "usage_detail_id không hợp lệ",
      });
    }

    const usageDetail = await UsageDetail.findById(id).session(session);
    if (!usageDetail) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy usage detail",
      });
    }

    if (usageDetail.status === "completed") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Không thể hủy dịch vụ đã hoàn thành",
      });
    }

    if (usageDetail.status === "cancelled") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Dịch vụ đã bị hủy trước đó",
      });
    }

    usageDetail.status = "cancelled";
    usageDetail.cancelled_at = new Date();
    usageDetail.confirmed_by = employee._id;

    await usageDetail.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Tự cập nhật service_usage
    await recalcServiceUsageStatus(usageDetail.ticket_id);

    return res.status(200).json({
      success: true,
      message: "Hủy dịch vụ thành công",
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res.status(500).json({
      success: false,
      message: "SERVER ERROR",
    });
  }
};

