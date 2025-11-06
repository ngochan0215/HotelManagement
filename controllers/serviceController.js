import { Service, ServiceCategory } from "../models/index.js";

// SERVICE CATEGORY
// Create a new service category
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

// Update a service category
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

// Delete a service category. By default, prevent deletion if services exist under it.
// There will be a pop-up form to ensure MANAGER's operation.
// Pass query ?force=true to delete tasks together with service.
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

// Get all service categories (optionally paginated)
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
// Create a new service under a service category
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

// Get a single service by id
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

// List services filtered by category_id, with pagination
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

// Update a service
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

// Delete a service
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
