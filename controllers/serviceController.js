import { Service, ServiceCategory, GoodImport, GoodTicket } from "../models/index.js";

// SERVICE CATEGORY
export const createServiceCategory = async (req, res) => {
	try {
        const allowedFields = ["name", "description"];
        const receivedFields = Object.keys(req.body);

        // Kiểm tra nếu có field không hợp lệ
        const invalidFields = receivedFields.filter(
        (field) => !allowedFields.includes(field)
        );

        if (invalidFields.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Invalid fields in request: ${invalidFields.join(", ")}`,
        });
        }

		const { name, description } = req.body;
		if (!name) 
            return res.status(400).json({ success: false, message: "Service category's name is required!" });

		const existing = await ServiceCategory.findOne({ name });
		if (existing) 
            return res.status(400).json({ success: false, message: "Service category already exists." });

		const category = new ServiceCategory({ name, description });
		await category.save();

		return res.status(201).json({ success: true, service_category: category });

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
            return res.status(404).json({ success: false, message: "Service category not found." });

		if (name) category.name = name;
		if (description) category.description = description;

		await category.save();
		return res.status(200).json({ success: true, category });

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
            return res.status(404).json({ success: false, message: "Service category not found." });

		const relatedServiceCount = await Service.countDocuments({ category_id: id });
		if (relatedServiceCount > 0 && !force) {
			return res.status(400).json({ success: false, message: `Category has ${relatedServiceCount} services. Use ?force=true to delete all related services.` });
		}

		if (force) {
			await Service.deleteMany({ category_id: id });
		}
		await ServiceCategory.findByIdAndDelete(id);

		return res.status(200).json({ success: true, message: "Delete service category successfully." });

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
    const { category_id } = req.params;

    const category = await ServiceCategory.findById(category_id);
    if (!category)
      return res.status(404).json({ success: false, message: "Service category not found." });

    const services = await Service.find({ category_id }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      category: category.name,
      total: services.length,
      services,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
  }
};

// SERVICE
export const createService = async (req, res) => {
	try {
		const { category_id, name, description, unit, price } = req.body;
		if (!category_id || !name || !price) 
            return res.status(400).json({ success: false, message: "Required category_id, name and price." });

		// validate service exists
		const category = await ServiceCategory.findById(category_id);
		if (!category) 
            return res.status(404).json({ success: false, message: "Service category not found." });

		const existing = await Service.findOne({ category_id, name });
		if (existing) return res.status(400).json({ success: false, message: "Service already exists for this service category." });

		const service = new Service({ category_id, name, description, unit, price });
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
            return res.status(404).json({ success: false, message: "Service not found." });

		return res.status(200).json({ success: true, service });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

export const listAllServices = async (req, res) => {
	try {
		const { category_id, page = 1, limit = 50 } = req.query;
		const q = {};
		if (category_id) 
            q.category_id = category_id;

		const skip = (Number(page) - 1) * Number(limit);
		const services = await Service.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();

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
            return res.status(404).json({ success: false, message: "Service not found." });

		if (name) service.name = name;
		if (description) service.description = description;
		if (unit) service.unit = unit;
        if (price) service.price = price;

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
		if (!service) return res.status(404).json({ success: false, message: "Service not found." });

		return res.status(200).json({ success: true, message: "Delete service successfully." });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

//---- GOOD TICKET ----//
export const createGoodTicket = async (req, res) => {
  try {
    const { employee_id, import_date, goods_list } = req.body;

	if (!employee_id || !import_date || !goods_list) 
        return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin." });

	const existing = await GoodTicket.findOne({ import_date });
	if (existing)
		return res.status(400).json({ success: false, message: "Có một phiếu trùng ngày nhập, bạn có thể tìm kiếm và thêm sản phẩm ở phiếu đó." });

	const importDate = new Date(import_date);
	const now = new Date();
	if (importDate < new Date(now.toDateString())) {
		return res.status(400).json({ success: false, message: "Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại." });
	}

	if (!goods_list || goods_list.length == 0) {
		return res.status(400).json({ success: false, message: "Không có sản phẩm nào được chọn để nhập. Vui lòng xem lại!" });
	}

    const ticket = await GoodTicket.create({ employee_id, import_date });

    if (goods_list && goods_list.length > 0) {
      const detailDocs = goods_list.map((item) => ({
        ticket_id: ticket._id,
        category_id: item.category_id,
        import_price: item.import_price,
        import_quantity: item.import_quantity,
      }));
      await GoodImport.insertMany(detailDocs);
    }

    return res.status(201).json({ success: true, message: "Tạo phiếu nhập thành công! Phiếu đang ở trạng thái chờ nhập.", ticket });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllGoodTickets = async (req, res) => {
  try {
    const tickets = await GoodTicket.find()
      .populate("employee_id", "full_name")
      .sort({ import_date: -1 })
      .select("-__v -created_at -updated_at");

    // Attach details for each ticket
    const ticketsWithDetails = await Promise.all(
      tickets.map(async (t) => {
        const details = await GoodImport.find({ ticket_id: t._id })
          .populate("category_id", "name")
          .select("-__v -created_at -updated_at");
        return { ...t.toObject(), details };
      })
    );

    res.status(200).json({ success: true, count: ticketsWithDetails.length, tickets: ticketsWithDetails });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getGoodTicketById = async (req, res) => {
  try {
    const ticket = await GoodTicket.findById(req.params.id)
      .populate("employee_id", "full_name");

    if (!ticket)
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập." });

    const details = await GoodImport.find({ ticket_id: ticket._id })
      .populate("category_id", "name price")
      .select("-__v -created_at -updated_at");

    res.status(200).json({
      success: true,
      data: { ...ticket.toObject(), details },
	});

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateGoodTicket = async (req, res) => {
  try {
	const { id } = req.params;
    const { import_date, goods_list } = req.body;

	const ticket = await GoodTicket.findById(id);
	if (!ticket)
		return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập sản phẩm." });

	const now = new Date();
    if (ticket.import_date && now >= new Date(ticket.import_date)) {
        return res.status(400).json({
            success: false,
            message: "Không thể chỉnh sửa vì đã đến hoặc qua ngày nhập."
        });
    }

	if (import_date) {
        const importDate = new Date(import_date);
        const now = new Date();
        if (importDate < new Date(now.toDateString())) {
            return res.status(400).json({ success: false, message: "Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại." });
        }
    }

    const _ticket = await GoodTicket.findByIdAndUpdate(
      req.params.id,
      { import_date, goods_list },
      { new: true }
    );

    // If imports are provided → replace details
    if (goods_list) {
      await GoodImport.deleteMany({ ticket_id: ticket._id });
      const detailDocs = goods_list.map((item) => ({
        ticket_id: ticket._id,
        category_id: item.category_id,
        import_price: item.import_price,
        import_quantity: item.import_quantity,
      }));
      await GoodImport.insertMany(detailDocs);
    }

    res.status(200).json({ success: true, message: "Cập nhật phiếu nhập thành công.", data: _ticket });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteGoodTicket = async (req, res) => {
  try {
	const { id } = req.params;
	const force = req.query?.force === 'true';

    const ticket = await GoodTicket.findById(id);
    if (!ticket)
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập sản phẩm." });

	const now = new Date();
    if (ticket.import_date && now >= new Date(ticket.import_date)) {
        return res.status(400).json({
            success: false,
            message: "Không thể chỉnh sửa vì đã đến hoặc qua ngày nhập."
        });
    }

	const relatedImports = await GoodImport.find({ ticket_id: id }).lean();
	if (relatedImports.length > 0 && !force) {
		return res.status(400).json({ success: false, message: `Phiếu có ${relatedImports.length} sản phẩm nhập. Dùng ?force=true để xóa phiếu.` });
	}

    await GoodImport.deleteMany({ ticket_id: ticket._id });
    await ticket.deleteOne();

    res.status(200).json({ success: true, message: "Đã xóa phiếu nhập sản phẩm." });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


//---- GOOD IMPORT ----//
export const createGoodImport = async (req, res) => {
  try {
    const { ticket_id, category_id, import_price, import_quantity } = req.body;

	if (!ticket_id || !category_id || !import_price || !import_quantity ) 
        return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin." });

    const ticket = await GoodTicket.findById(ticket_id);
    if (!ticket)
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập tổng." });

	if (ticket.status === "completed")
        return res.status(400).json({ success: false, message: "Phiếu đã hoàn tất, không thể thêm sản phẩm mới." });

	const category = await ServiceCategory.findById(category_id);
	if (!category) 
		return res.status(404).json({ success: false, message: "Không tìm thấy danh mục dịch vụ (sản phẩm)." });

	const qty = Number(import_quantity ?? 1);
	if (!Number.isInteger(qty) || qty <= 0) {
		return res.status(400).json({ success: false, message: "Số lượng nhập phải là số nguyên dương." });
	}	

    const currGoodImport = await GoodImport.create({
      ticket_id,
      category_id,
      import_price,
      import_quantity,
    });

    return res.status(201).json({ success: true, message: "Thêm chi tiết phiếu nhập sản phẩm thành công!", import_shoppee });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllGoodImports = async (req, res) => {
  try {
    const { ticket_id } = req.query;
    const filter = ticket_id ? { ticket_id } : {};

    const imports = await GoodImport.find(filter)
      .populate("service_id", "name price")
      .populate("ticket_id", "import_date")
      .select("-__v -created_at -updated_at");

    res.status(200).json({ success: true, count: imports.length, imports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getGoodImportById = async (req, res) => {
  try {
    const item = await GoodImport.findById(req.params.id)
      .populate("service_id", "name price")
      .populate("ticket_id", "import_day");

    if (!item)
      return res.status(404).json({ success: false, message: "Import detail not found." });

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateGoodImport = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, import_price, import_quantity } = req.body;

    const imp = await GoodImport.findById(id);
    if (!imp) 
      return res.status(404).json({ success: false, message: "Không tìm thấy chi tiết nhập sản phẩm." });

    const ticket = await GoodTicket.findById(imp.ticket_id);
    if (!ticket)
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập liên kết." });

    const category = await ServiceCategory.findById(category_id);
    if (!category) 
      return res.status(404).json({ success: false, message: "Không tìm thấy danh mục dịch vụ (sản phẩm)." });

    const now = new Date();
    if (ticket.import_date && now >= new Date(ticket.import_date)) {
      return res.status(400).json({
          success: false,
          message: "Không thể chỉnh sửa vì đã đến hoặc qua ngày nhập sản phẩm."
      });
    }

    const item = await GoodImport.findByIdAndUpdate( id,
      { category_id, import_price, import_quantity },
      { new: true }
    );

    return res.status(200).json({ success: true, message: "Cập nhật chi tiết nhập thành công!", import: imp });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteGoodImport = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await GoodImport.findById(id);
    if (!item)
      return res.status(404).json({ success: false, message: "Không tìm thấy chi tiết nhập sản phẩm." });

    const now = new Date();
    if (ticket.import_date && now >= new Date(ticket.import_date)) {
      return res.status(400).json({
          success: false,
          message: "Không thể xóa vì đã đến hoặc qua ngày nhập sản phẩm."
      });
    }

    await item.deleteOne();
    res.status(200).json({ success: true, message: "Đã xóa chi tiết phiếu nhập sản phẩm." });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
