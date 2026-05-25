import mongoose from "mongoose";
import { FOOD_CATEGORY_ID } from "../constants/serviceConstants.js";
import * as svcHelpers from "./serviceHelpers.js";
import { cache } from "../../../shared/utils/cache.js";

export class ServiceService {
    constructor({ Service, ServiceCategory, GoodImport, GoodTicket, ServiceUsage, UsageDetail, eventBus, sendNotificationsToUsers }) {
        this.Service = Service;
        this.ServiceCategory = ServiceCategory;
        this.GoodImport = GoodImport;
        this.GoodTicket = GoodTicket;
        this.ServiceUsage = ServiceUsage;
        this.UsageDetail = UsageDetail;
        this.eventBus = eventBus;
        this.sendNotificationsToUsers = sendNotificationsToUsers;
    }

    //---- SERVICE CATEGORY ----//
    async createServiceCategory({ name, description }, files) {
        try {
            if (!name || !description)
                throw new Error("Yêu cầu nhập tên danh mục dịch vụ và mô tả.");

            if (typeof name !== "string" || !name.trim())
                throw new Error("Tên danh mục dịch vụ phải là chuỗi.");

            if (typeof description !== "string" || !description.trim())
                throw new Error("Mô tả danh mục dịch vụ phải là chuỗi.");

            const existing = await this.ServiceCategory.findOne({ name });
            if (existing) 
                throw new Error("Tên danh mục dịch vụ đã tồn tại.");

            const images = files?.length > 0 ? files.map(f => f.path) : [];
            const category = new this.ServiceCategory({ name, description, images });
            await category.save();

            await cache.delByPattern("svc_cat:all:*");
            return category;

        } catch (error) {
            console.log("Error creating service category:", error);
            throw error;
        }
    }

    async updateServiceCategory(id, { name, description }, files) {
        try {
            const category = await this.ServiceCategory.findById(id);
            if (!category) 
                throw new Error("Không tìm thấy danh mục loại dịch vụ.");

            if (name && typeof name !== "string")
                throw new Error("Tên danh mục dịch vụ phải là chuỗi.");

            if (description && typeof description !== "string")
                throw new Error("Mô tả danh mục dịch vụ phải là chuỗi.");

            const existing = await this.ServiceCategory.findOne({ name, _id: { $ne: id } });
            if (existing) 
                throw new Error("Tên danh mục dịch vụ đã tồn tại.");

            if (files?.length > 0) category.images = files.map(f => f.path);
            if (name) category.name = name;
            if (description) category.description = description;

            await category.save();

            await Promise.all([
                cache.delByPattern("svc_cat:all:*"),
                cache.del(`svc_cat:by:${id}`),
            ]);

            return category;
        } catch (error) {
            console.log("Error updating service category:", error);
            throw error;
        }
    }

    async deleteServiceCategory(id, force) {
        try {
            const category = await this.ServiceCategory.findById(id);
            if (!category) 
                throw new Error("Không tìm thấy danh mục dịch vụ.");

            const relatedServiceCount = await this.Service.countDocuments({ category_id: id });
            if (relatedServiceCount > 0 && !force)
                throw new Error(`Danh mục dịch vụ có ${relatedServiceCount} dịch vụ nhỏ kèm theo. Dùng ?force=true để xóa tất cả dịch vụ nhỏ kèm theo.`);

            if (force) await this.Service.deleteMany({ category_id: id });
            
            await this.ServiceCategory.findByIdAndDelete(id);
            
            await Promise.all([
                cache.delByPattern("svc_cat:all:*"),
                cache.del(`svc_cat:by:${id}`),
                cache.delByPattern("svc:list:*"),
            ]);
        } catch (error) {
            console.log("Error deleting service category:", error);
            throw error;
        }
    }

    async getAllServiceCategories({ page = 1, limit = 50, search } = {}) {
        try {
            const cacheKey = `svc_cat:all:${JSON.stringify([page, limit, search])}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const q = {};
            if (search) q.name = { $regex: search, $options: "i" };
            const skip = (Number(page) - 1) * Number(limit);

            const [categories, total] = await Promise.all([
                this.ServiceCategory.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
                this.ServiceCategory.countDocuments(q),
            ]);

            const result = { categories, total, page: Number(page), limit: Number(limit) };
            await cache.set(cacheKey, result, 600);
            return result;
        } catch (error) {
            console.log("Error fetching service categories:", error);
            throw error;
        }
    }

    async getServicesByCategoryId(id) {
        try {
            const cacheKey = `svc_cat:by:${id}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const category = await this.ServiceCategory.findById(id).select("name description images");
            if (!category) 
                throw new Error("Không tìm thấy danh mục dịch vụ.");

            const services = await this.Service.find({ category_id: id })
                .select("-created_at -updated_at -__v")
                .sort({ created_at: -1 })
                .lean();

            const result = { category, services };
            await cache.set(cacheKey, result, 600);
            return result;

        } catch (error) {
            console.log("Error fetching services by category:", error);
            throw error;
        }
    }

    //---- SERVICE ----//
    async createService({ category_id, name, description, unit, price }, files) {
        try {
            if (!category_id || !name || !price || !description)
                throw new Error("Yêu cầu nhập đầy đủ thông tin.");

            if (typeof name !== "string" || typeof description !== "string")
                throw new Error("Tên và mô tả dịch vụ phải là chuỗi.");

            if (price <= 0)
                throw new Error("Đơn giá dịch vụ phải là số nguyên lớn hơn 0.");

            const category = await this.ServiceCategory.findById(category_id);
            if (!category) 
                throw new Error("Không tìm thấy danh mục dịch vụ.");

            const existing = await this.Service.findOne({ category_id, name });
            if (existing) 
                throw new Error("Đã tồn tại dịch vụ có cùng tên cho danh mục dịch vụ này.");

            const images = files?.length > 0 ? files.map(f => f.path) : [];
            const service = new this.Service({ category_id, name, description, unit, price, images });
            
            await service.save();
            await Promise.all([
                cache.delByPattern("svc:list:*"),
                cache.del(`svc_cat:by:${category_id}`),
            ]);
            return service;

        } catch (error) {
            console.log("Error creating service:", error);  
            throw error;
        }
    }

    async getServiceById(id) {
        try {
             const cacheKey = `svc:one:${id}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const service = await this.Service.findById(id).lean();
            if (!service) throw new Error("Không tìm thấy dịch vụ tương ứng.");

            await cache.set(cacheKey, service, 600);
            return service;
        } catch (error) {
            console.log("Error fetching service by ID:", error);
            throw error;
        }
    }

    async getAllServices({ category_id, status, min_quantity, max_quantity, min_price, max_price, page = 1, limit = 50 } = {}) {
        try {
            const cacheKey = `svc:list:${JSON.stringify([category_id, status, min_quantity, max_quantity, min_price, max_price, page, limit])}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const filter = {};

            if (category_id) {
                const category = await this.ServiceCategory.findById(category_id);
                if (!category) throw new Error("Không tìm thấy danh mục dịch vụ.");
                filter.category_id = category_id;
            }
            if (status) filter.status = status;
            if (min_price || max_price) {
                filter.price = {};
                if (min_price) filter.price.$gte = Number(min_price);
                if (max_price) filter.price.$lte = Number(max_price);
            }
            if (min_quantity || max_quantity) {
                filter.storage_quantity = {};
                if (min_quantity) filter.storage_quantity.$gte = Number(min_quantity);
                if (max_quantity) filter.storage_quantity.$lte = Number(max_quantity);
            }

            const skip = (Number(page) - 1) * Number(limit);
            const result = await this.Service.find(filter)
                .select("-created_at -updated_at -__v")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean();

            await cache.set(cacheKey, result, 600);
            return result;
        } catch (error) {
            console.log("Error fetching all services:", error);
            throw error;
        }
    }

    async updateService(id, { name, description, unit, price }, files) {
        try {
            const service = await this.Service.findById(id);
            if (!service) 
                throw new Error("Không tìm thấy dịch vụ.");

            if (name && typeof name !== "string")
                throw new Error("Tên dịch vụ phải là chuỗi.");

            if (description && typeof description !== "string")
                throw new Error("Mô tả dịch vụ phải là chuỗi.");

            if (price !== undefined) {
                const parsedPrice = Number(price);
                if (!Number.isFinite(parsedPrice) || parsedPrice <= 0)
                    throw new Error("Đơn giá dịch vụ phải là số lớn hơn 0.");
            }

            if (name) service.name = name;
            if (description) service.description = description;
            if (unit) service.unit = unit;
            if (price) service.price = price;
            if (files?.length > 0) service.images = files.map(f => f.path);

            await service.save();
            await Promise.all([
                cache.del(`svc:one:${id}`),
                cache.delByPattern("svc:list:*"),
                cache.del(`svc_cat:by:${service.category_id}`),
            ]);
            return service;
        } catch (error) {
            console.log("Error updating service:", error);
            throw error;
        }
    }

    async deleteService(id) {
        try {
            const service = await this.Service.findByIdAndDelete(id);
            if (!service) throw new Error("Không tìm thấy dịch vụ.");
            await Promise.all([
                cache.del(`svc:one:${id}`),
                cache.delByPattern("svc:list:*"),
                cache.del(`svc_cat:by:${service.category_id}`),
            ]);
        } catch (error) {
            console.log("Error deleting service:", error);
            throw error;
        }
    }

    //---- GOOD TICKET ----//
    async createGoodTicket({ import_date, goods_list }, userId) {
        try {
            if (!userId || !import_date || !Array.isArray(goods_list))
                throw new Error("Vui lòng nhập đầy đủ thông tin.");

            const employee = await svcHelpers.findEmployeeByUserId(this.eventBus, userId);

            const existing = await this.GoodTicket.findOne({ import_date, status: "pending" });
            if (existing)
                throw new Error("Có một phiếu đang chờ nhập trùng ngày nhập, bạn có thể tìm kiếm và thêm sản phẩm ở phiếu đó.");

            const importDate = new Date(import_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (importDate < today)
                throw new Error("Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại.");

            if (goods_list.length === 0)
                throw new Error("Không có sản phẩm nào được chọn để nhập. Vui lòng xem lại!");

            const serviceIds = [];
            for (const item of goods_list) {
                if (!item.service_id || !mongoose.Types.ObjectId.isValid(item.service_id))
                    throw new Error("service_id không hợp lệ.");

                if (typeof item.import_price !== "number" || item.import_price <= 0)
                    throw new Error("Đơn giá nhập phải là số nguyên lớn hơn 0.");

                if (!Number.isInteger(item.import_quantity) || item.import_quantity <= 0)
                    throw new Error("Số lượng nhập phải là số nguyên lớn hơn 0.");

                serviceIds.push(item.service_id.toString());
            }

            if (new Set(serviceIds).size !== serviceIds.length)
                throw new Error("Danh sách sản phẩm nhập bị trùng.");

            const services = await this.Service.find({ _id: { $in: serviceIds } });
            if (services.length !== serviceIds.length)
                throw new Error("Có sản phẩm không tồn tại trong hệ thống.");

            const isToday = importDate.getTime() === today.getTime();
            const ticket = await this.GoodTicket.create({ 
                employee_id: employee._id, 
                import_date, 
                status: isToday ? "waiting_confirm" : "pending" 
            });

            const detailDocs = goods_list.map(item => ({
                ticket_id: ticket._id,
                service_id: item.service_id,
                import_price: item.import_price,
                import_quantity: item.import_quantity,
            }));

            await this.GoodImport.insertMany(detailDocs);
            return { ticket, total_items: detailDocs.length };

        } catch (error) {
            console.error("Error creating good ticket:", error);
            throw error;
        }
    }

    async getAllGoodTickets({ employee_id, min_import_date, max_import_date, status } = {}) {
        try {
            const filter = {};

            if (employee_id) {
                const employee = await svcHelpers.findEmployeeByUserId(this.eventBus, employee_id);
                filter.employee_id = employee._id;
            }

            if (min_import_date || max_import_date) {
                filter.import_date = {};
                if (min_import_date) filter.import_date.$gte = new Date(min_import_date);
                if (max_import_date) filter.import_date.$lte = new Date(max_import_date);
            }

            if (status) filter.status = status;

            const tickets = await this.GoodTicket.find(filter)
                .populate("employee_id", "full_name")
                .sort({ import_date: -1 })
                .select("-__v -created_at -updated_at");

            return Promise.all(
                tickets.map(async (t) => {
                    const details = await this.GoodImport.find({ ticket_id: t._id })
                        .populate("service_id", "name")
                        .select("-__v -created_at -updated_at -ticket_id");
                    return { ...t.toObject(), details };
                })
            );
        } catch (error) {
            console.error("Error fetching good tickets:", error);
            throw error;
        }
    }

    async getGoodTicketById(id) {
        try {
            const ticket = await this.GoodTicket.findById(id)
                .select("-__v -created_at -updated_at")
                .populate("employee_id", "full_name");

            if (!ticket) throw new Error("Không tìm thấy phiếu nhập.");

            const details = await this.GoodImport.find({ ticket_id: ticket._id })
                .populate("service_id", "name price")
                .select("-__v -created_at -updated_at -ticket_id");

            return { ...ticket.toObject(), details };
        } catch (error) {
            console.error("Error fetching good ticket by ID:", error);
            throw error;
        }
    }

    async getOutOfStockServices() {
        try {
            return this.Service.find({
                $or: [
                    { storage_quantity: { $lte: 10 } },
                    { storage_quantity: { $exists: false } },
                    { storage_quantity: null },
                ],
            }).select("_id name description unit price storage_quantity status");

        } catch (error) {
            console.error("Error fetching out-of-stock services:", error);
            throw error;
        }
    }

    async autoCreateGoodTicket({ import_date, goods_list, default_quantity = 10, default_price_percent = 0.8 }, userId) {
        try {
            if (!userId) throw new Error("Yêu cầu nhập thông tin đầy đủ.");

            const employee = await svcHelpers.findEmployeeByUserId(this.eventBus, userId);

            let items = goods_list;

            if (items && Array.isArray(items) && items.length > 0) {
                const serviceIds = items.map(item => item.service_id);
                if ([...new Set(serviceIds)].length !== serviceIds.length)
                    throw new Error("Danh sách sản phẩm nhập bị trùng.");

                for (const item of items) {
                    if (!item.service_id || !mongoose.Types.ObjectId.isValid(item.service_id))
                        throw new Error("service_id không hợp lệ.");
                    
                    if (typeof item.import_price !== "number" || item.import_price <= 0)
                        throw new Error("Đơn giá nhập phải là số nguyên lớn hơn 0.");
                    
                    if (!Number.isInteger(item.import_quantity) || item.import_quantity <= 0)
                        throw new Error("Số lượng nhập phải là số nguyên lớn hơn 0.");
                }

                const services = await this.Service.find({ _id: { $in: serviceIds } });
                if (services.length !== serviceIds.length)
                    throw new Error("Có sản phẩm không tồn tại trong hệ thống.");
            } else {
                const outOfStock = await this.Service.find({
                    $or: [
                        { storage_quantity: { $lte: 10 } },
                        { storage_quantity: { $exists: false } },
                        { storage_quantity: null },
                    ],
                });

                if (outOfStock.length === 0) {
                    return null;
                }

                items = outOfStock.map(s => ({
                    service_id: s._id,
                    import_quantity: default_quantity,
                    import_price: Math.round(s.price * default_price_percent),
                }));
            }

            if (!items || items.length === 0)
                throw new Error("Không có sản phẩm nào để tạo phiếu nhập.");

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let importDate;

            if (import_date) {
                importDate = new Date(import_date);
                importDate.setHours(0, 0, 0, 0);
                if (importDate < today)
                    throw new Error("Ngày nhập không hợp lệ! Không thể nhỏ hơn ngày hiện tại.");
            } else {
                importDate = new Date(today);
                importDate.setDate(importDate.getDate() + 1);
            }

            const existing = await this.GoodTicket.findOne({ import_date: importDate, status: "pending" });
            if (existing)
                throw new Error(`Đã có phiếu nhập đang chờ cho ngày ${importDate.toISOString().split("T")[0]}. Vui lòng cập nhật phiếu đó hoặc chọn ngày khác.`);

            const isToday = importDate.getTime() === today.getTime();
            const ticket = await this.GoodTicket.create({ 
                employee_id: employee._id, 
                import_date: importDate, 
                status: isToday ? "pending" : "waiting_confirm" 
            });

            const detailDocs = items.map(item => ({
                ticket_id: ticket._id,
                service_id: item.service_id,
                import_price: item.import_price,
                import_quantity: item.import_quantity,
            }));

            await this.GoodImport.insertMany(detailDocs);

            return { ticket: ticket, total_items: detailDocs.length, import_date: importDate, items_count: items.length, ticket_id: ticket._id };
        } catch (error) {
            console.error("Error auto-creating good ticket:", error);
            throw error;
        }
    }

    async updateGoodTicket(id, { import_date, goods_list }) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw new Error("ID phiếu nhập không hợp lệ.");

            const ticket = await this.GoodTicket.findById(id);
            if (!ticket) 
                throw new Error("Không tìm thấy phiếu nhập sản phẩm.");

            if (ticket.status !== "pending") 
                throw new Error("Chỉ được sửa phiếu nhập ở trạng thái pending.");

            const now = new Date();
            if (ticket.import_date && now >= new Date(ticket.import_date))
                throw new Error("Không thể chỉnh sửa vì đã đến hoặc qua ngày nhập.");

            if (import_date) {
                const importDate = new Date(import_date);
                if (importDate < new Date(now.toDateString()))
                    throw new Error("Ngày nhập không hợp lệ!");
                ticket.import_date = importDate;
            }

            await ticket.save();

            if (goods_list) {
                const serviceIds = [];

                for (const item of goods_list) {
                    if (!item.service_id || !mongoose.Types.ObjectId.isValid(item.service_id))
                        throw new Error("service_id không hợp lệ.");
                    
                    if (typeof item.import_price !== "number" || item.import_price <= 0)
                        throw new Error("Đơn giá nhập phải là số nguyên lớn hơn 0.");
                    
                    if (!Number.isInteger(item.import_quantity) || item.import_quantity <= 0)
                        throw new Error("Số lượng nhập phải là số nguyên lớn hơn 0.");
                    
                    serviceIds.push(item.service_id.toString());
                }

                if (new Set(serviceIds).size !== serviceIds.length)
                    throw new Error("Danh sách sản phẩm nhập bị trùng.");

                const services = await this.Service.find({ _id: { $in: serviceIds } });
                if (services.length !== serviceIds.length)
                    throw new Error("Có sản phẩm không tồn tại trong hệ thống.");

                await this.GoodImport.deleteMany({ ticket_id: ticket._id });
                
                await this.GoodImport.insertMany(
                    goods_list.map(item => ({
                        ticket_id: ticket._id,
                        service_id: item.service_id,
                        import_price: item.import_price,
                        import_quantity: item.import_quantity,
                    }))
                );
            }

            return ticket;
        } catch (error) {
            console.error("Error updating good ticket:", error);
            throw error;
        }
    }

    async deleteGoodTicket(id, force) {
        try { 
            if (!mongoose.Types.ObjectId.isValid(id))
                throw new Error("ID phiếu nhập không hợp lệ!");

            const ticket = await this.GoodTicket.findById(id);
            if (!ticket) throw new Error("Không tìm thấy phiếu nhập sản phẩm.");

            const now = new Date();
            if (ticket.import_date && now >= new Date(ticket.import_date))
                throw new Error("Không thể xóa vì đã đến hoặc qua ngày nhập.");

            if (ticket.status !== "pending")
                throw new Error("Chỉ được xóa phiếu nhập ở trạng thái pending.");

            const relatedImports = await this.GoodImport.find({ ticket_id: id });
            if (relatedImports.length > 0 && !force)
                throw new Error(`Phiếu có ${relatedImports.length} sản phẩm nhập. Dùng ?force=true để xóa toàn bộ phiếu và chi tiết nhập.`);

            await this.GoodImport.deleteMany({ ticket_id: ticket._id });
            await ticket.deleteOne();

        } catch (error) {
            console.error("Error deleting good ticket:", error);
            throw error;
        }
    }

    async confirmGoodTicket(id, confirmerId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw new Error("ID phiếu nhập không hợp lệ.");

            const updatedServiceIds = [];

            const ticket = await this.GoodTicket.findById(id);
            if (!ticket) 
                throw new Error("Không tìm thấy phiếu nhập.");
            
            if (ticket.status !== "waiting_confirm")
                throw new Error("Chỉ được xác nhận phiếu ở trạng thái waiting_confirm.");

            const imports = await this.GoodImport.find({ ticket_id: ticket._id });
            if (imports.length === 0) 
                throw new Error("Phiếu nhập chưa có sản phẩm nào.");

            for (const item of imports) {
                const service = await this.Service.findById(item.service_id);
                if (!service) 
                    throw new Error("Có sản phẩm không tồn tại trong hệ thống.");

                service.storage_quantity = (service.storage_quantity || 0) + item.import_quantity;
                await service.save();

                updatedServiceIds.push(item.service_id.toString());
            }

            ticket.status = "completed";
            ticket.confirmed_by = confirmerId;
            ticket.confirmed_at = new Date();
            await ticket.save();

            await Promise.all([
                ...updatedServiceIds.map(sid => cache.del(`svc:one:${sid}`)),
                cache.delByPattern("svc:list:*"),
            ]);

        } catch (error) {
            console.error("Error confirming good ticket:", error);
            throw error;
        }
    }

    //---- SERVICE USAGE ----//
    async createServiceUsage({ booking_id, customer_id, services }, userId) {
        try {
            if (!booking_id || !customer_id || !Array.isArray(services) || services.length === 0)
                throw new Error("Yêu cầu nhập đầy đủ thông tin.");
            
            if (!mongoose.Types.ObjectId.isValid(booking_id) || !mongoose.Types.ObjectId.isValid(customer_id))
                throw new Error("booking_id hoặc customer_id không hợp lệ.");

            const [booking, customer] = await Promise.all([
                svcHelpers.findBookingById(this.eventBus, booking_id),
                svcHelpers.findCustomerById(this.eventBus, customer_id),
            ]);

            if (!["confirmed", "in_progress"].includes(booking.status))
                throw new Error("Trạng thái Booking hiện tại không cho phép sử dụng dịch vụ.");
            
            if (booking.customer_id.toString() !== customer_id)
                throw new Error("Khách hàng không thuộc booking này.");

            const serviceIds = services.map(s => s.service_id);
            const dbServices = await this.Service.find({ _id: { $in: serviceIds }, status: "active" });

            if (dbServices.length !== services.length)
                throw new Error("Một hoặc nhiều dịch vụ không tồn tại hoặc không hoạt động.");

            const serviceMap = {};
            dbServices.forEach(s => { serviceMap[s._id.toString()] = s; });

            for (let i = 0; i < services.length; i++) {
                if (!services[i].service_id || !mongoose.Types.ObjectId.isValid(services[i].service_id))
                    throw new Error(`service_id không hợp lệ tại phần tử thứ ${i + 1}.`);
                
                if (!services[i].quantity || services[i].quantity < 1)
                    throw new Error(`quantity phải >= 1 tại phần tử thứ ${i + 1}.`);
            }

            const serviceUsage = await this.ServiceUsage.create({ 
                booking_id, customer_id, employee_id: userId, total_fee: 0 
            });

            let totalUsageFee = 0;
            const usageDetailsData = services.map(item => {
                const svc = serviceMap[item.service_id.toString()];
                const itemTotal = item.quantity * svc.price;
                totalUsageFee += itemTotal;
                
                return {
                    ticket_id: serviceUsage._id,
                    service_id: item.service_id,
                    quantity: item.quantity,
                    use_from: item.use_from ? new Date(item.use_from) : new Date(),
                    finish_at: item.finish_at ? new Date(item.finish_at) : null,
                    current_price: svc.price,
                    total_fee: itemTotal,
                    status: "waiting_confirm",
                };
            });

            await this.UsageDetail.insertMany(usageDetailsData);

            serviceUsage.total_fee = totalUsageFee;
            await serviceUsage.save();

            await this.recalcServiceUsageStatus(serviceUsage._id);
            return { service_usage: serviceUsage, usage_details: usageDetailsData };

        } catch (error) {
            console.error("Error creating service usage:", error);
            throw error;
        }
    }

    async getAllServiceUsage({ employee_id, customer_id, booking_id, status } = {}) {
        try {
            const filter = {};

            if (employee_id) {
                if (!mongoose.Types.ObjectId.isValid(employee_id))
                    throw new Error("employee_id không hợp lệ");

                filter.employee_id = employee_id;
            }

            if (customer_id) {
                if (!mongoose.Types.ObjectId.isValid(customer_id))
                    throw new Error("customer_id không hợp lệ");
                
                filter.customer_id = customer_id;
            }
            if (booking_id) {
                if (!mongoose.Types.ObjectId.isValid(booking_id))
                    throw new Error("booking_id không hợp lệ");
                
                filter.booking_id = booking_id;
            }

            if (status) filter.status = status;

            const serviceUsages = await this.ServiceUsage.find(filter)
                .select("-__v -created_at -updated_at")
                .sort({ createdAt: -1 })
                .lean();

            return svcHelpers.enrichServiceUsages(this.eventBus, serviceUsages);
        } catch (error) {
            console.error("Error fetching service usages:", error);
            throw error;
        }
    }

    async getServiceUsageById(id) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw new Error("service_usage_id không hợp lệ");

            const serviceUsage = await this.ServiceUsage.findById(id).select("-__v -created_at -updated_at");
            if (!serviceUsage) 
                throw new Error("Không tìm thấy phiếu sử dụng dịch vụ");

            const [enriched, usageDetails] = await Promise.all([
                svcHelpers.enrichSingleServiceUsage(this.eventBus, serviceUsage),
                this.UsageDetail.find({ ticket_id: serviceUsage._id })
                    .select("-__v -created_at -updated_at -ticket_id")
                    .populate("service_id", "name price unit")
                    .sort({ use_from: 1 }),
            ]);

            return { service_usage: enriched.service_usage, usage_details: usageDetails, rooms: enriched.rooms };
        } catch (error) {
            console.error("Error fetching service usage by ID:", error);
            throw error;
        }
    }

    async deleteServiceUsage(id, force) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw new Error("ID phiếu sử dụng dịch vụ không hợp lệ");

            const serviceUsage = await this.ServiceUsage.findById(id);
            if (!serviceUsage) 
                throw new Error("Không tìm thấy phiếu sử dụng dịch vụ");
            
            if (serviceUsage.status !== "pending")
                throw new Error("Chỉ được xóa phiếu sử dụng dịch vụ khi trạng thái là pending");

            const relatedDetails = await this.UsageDetail.find({ ticket_id: id });
            if (relatedDetails.length > 0 && !force)
                throw new Error(`Phiếu có ${relatedDetails.length} dịch vụ sử dụng. Dùng ?force=true để xóa toàn bộ phiếu sử dụng dịch vụ.`);

            await this.UsageDetail.deleteMany({ ticket_id: serviceUsage._id });
            await this.ServiceUsage.deleteOne({ _id: serviceUsage._id });

        } catch (error) {
            console.error("Error deleting service usage:", error);
            throw error;
        }
    }

    async updateServiceUsage(id, { services }) {
        try {
            const serviceUsage = await this.ServiceUsage.findById(id);
            if (!serviceUsage) 
                throw new Error("Không tìm thấy phiếu sử dụng dịch vụ.");
            
            if (serviceUsage.status !== "pending")
                throw new Error("Chỉ được cập nhật phiếu sử dụng dịch vụ khi trạng thái là pending.");
            
            if (!Array.isArray(services) || services.length === 0)
                throw new Error("Danh sách dịch vụ không hợp lệ.");

            const serviceIds = services.map(s => s.service_id);
            const dbServices = await this.Service.find({ _id: { $in: serviceIds }, status: "active" });
            
            if (dbServices.length !== services.length)
                throw new Error("Một hoặc nhiều dịch vụ không tồn tại hoặc không hoạt động.");

            const serviceMap = Object.fromEntries(dbServices.map(s => [s._id.toString(), s]));

            let totalUsageFee = 0;
            const usageDetailsData = services.map((item, index) => {
                if (!mongoose.Types.ObjectId.isValid(item.service_id))
                    throw new Error(`service_id không hợp lệ tại phần tử ${index + 1}`);
                
                if (!item.quantity || item.quantity < 1)
                    throw new Error(`quantity phải >= 1 tại phần tử ${index + 1}`);
                
                if (item.use_from && item.finish_at) {
                    const from = new Date(item.use_from);
                    const to = new Date(item.finish_at);
                    if (isNaN(from.getTime()) || isNaN(to.getTime()))
                        throw new Error(`use_from hoặc finish_at không hợp lệ tại phần tử ${index + 1}`);
                    
                    if (from >= to)
                        throw new Error(`use_from phải nhỏ hơn finish_at tại phần tử ${index + 1}`);
                }

                const svc = serviceMap[item.service_id.toString()];
                const itemTotal = item.quantity * svc.price;
                totalUsageFee += itemTotal;
                
                return {
                    ticket_id: serviceUsage._id,
                    service_id: item.service_id,
                    quantity: item.quantity,
                    use_from: item.use_from ? new Date(item.use_from) : null,
                    finish_at: item.finish_at ? new Date(item.finish_at) : null,
                    current_price: svc.price,
                    total_fee: itemTotal,
                    status: item.use_from === null ? "pending" : "waiting_confirm",
                };
            });

            await this.UsageDetail.deleteMany({ ticket_id: id });
            await this.UsageDetail.insertMany(usageDetailsData);

            serviceUsage.total_fee = totalUsageFee;
            await serviceUsage.save();

            await this.recalcServiceUsageStatus(serviceUsage._id);
            return { service_usage: serviceUsage, usage_details: usageDetailsData };
        } catch (error) {
            console.error("Error updating service usage:", error);
            throw error;
        }
    }

    async recalcServiceUsageStatus(ticketId) {
        try {
            const query = this.UsageDetail.find({ ticket_id: ticketId });
            const details = await query;

            if (!details.length) return;

            const statuses = details.map(d => d.status);
            let newStatus = "pending";

            if (statuses.every(s => s === "pending")) {
                newStatus = "pending";
            } else if (statuses.some(s => s === "waiting_confirm")) {
                newStatus = "waiting_confirm";
            } else if (statuses.every(s => s === "cancelled")) {
                newStatus = "cancelled";
            } else if (statuses.every(s => ["completed", "cancelled"].includes(s))) {
                newStatus = "completed";
            }

            const updateQuery = this.ServiceUsage.updateOne({ _id: ticketId }, { $set: { status: newStatus } });
            await updateQuery;
        } catch (error) {
            console.error("Error recalculating service usage status:", error);
            throw error;
        }
    }

    async confirmServiceUsage(id, employeeUserId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw new Error("service_usage_id không hợp lệ");

            const employee = await svcHelpers.findEmployeeByUserId(this.eventBus, employeeUserId);
            const foodServiceIds = [];

            const serviceUsage = await this.ServiceUsage.findById(id);
            if (!serviceUsage) 
                throw new Error("Không tìm thấy phiếu sử dụng dịch vụ");

            const usageDetails = await this.UsageDetail.find({ ticket_id: id });
            if (usageDetails.length === 0) 
                throw new Error("Phiếu chưa có chi tiết sử dụng dịch vụ");

            const invalidDetail = usageDetails.find(d => d.status !== "waiting_confirm");
            if (invalidDetail) 
                throw new Error("Phiếu có chi tiết không ở trạng thái waiting_confirm");

            const serviceIds = usageDetails.map(d => d.service_id);
            const services = await this.Service.find({ _id: { $in: serviceIds } });
            
            const serviceMap = {};
            services.forEach(s => { serviceMap[s._id.toString()] = s; });

            for (const detail of usageDetails) {
                const svc = serviceMap[detail.service_id.toString()];
                
                if (!svc) throw new Error("Dịch vụ không tồn tại");
                
                if (svc.category_id.toString() === FOOD_CATEGORY_ID && svc.storage_quantity < detail.quantity)
                    throw new Error(`Không đủ tồn kho cho dịch vụ ${svc.name}`);
            }

            for (const detail of usageDetails) {
                const svc = serviceMap[detail.service_id.toString()];
                detail.status = "completed";
                detail.confirmed_at = new Date();
                detail.finish_at = new Date();
                detail.confirmed_by = employee._id;
                await detail.save();

                if (svc.category_id.toString() === FOOD_CATEGORY_ID) {
                    foodServiceIds.push(svc._id.toString());

                    await this.Service.updateOne(
                        { _id: svc._id, storage_quantity: { $gte: detail.quantity } },
                        { $inc: { storage_quantity: -detail.quantity } }
                    );
                }
            }

            await this.recalcServiceUsageStatus(serviceUsage._id, );

            if (foodServiceIds.length > 0) {
                await Promise.all([
                    ...foodServiceIds.map(sid => cache.del(`svc:one:${sid}`)),
                    cache.delByPattern("svc:list:*"),
                ]);
            }

        } catch (error) {
            console.error("Error confirming service usage:", error);
            throw error;
        }
    }

    async cancelServiceUsage(id, employeeUserId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw new Error("service_usage_id không hợp lệ");

            const employee = await svcHelpers.findEmployeeByUserId(this.eventBus, employeeUserId);

            const serviceUsage = await this.ServiceUsage.findById(id);
            if (!serviceUsage) 
                throw new Error("Không tìm thấy phiếu sử dụng dịch vụ");

            const usageDetails = await this.UsageDetail.find({ ticket_id: id });
            if (usageDetails.length === 0) 
                throw new Error("Phiếu chưa có chi tiết sử dụng dịch vụ");

            const completedDetail = usageDetails.find(d => d.status === "completed");
            if (completedDetail) 
                throw new Error("Không thể hủy phiếu vì có dịch vụ đã hoàn thành");

            for (const detail of usageDetails) {
                if (detail.status === "cancelled") continue;
                
                detail.status = "cancelled";
                detail.cancelled_at = new Date();
                detail.confirmed_by = employee._id;
                await detail.save();
            }

            await this.recalcServiceUsageStatus(serviceUsage._id);
        } catch (error) {
            console.error("Error cancelling service usage:", error);
            throw error;
        }
    }

    async confirmUsageDetail(id, employeeUserId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw new Error("usage_detail_id không hợp lệ");

            const employee = await svcHelpers.findEmployeeByUserId(this.eventBus, employeeUserId);

            let foodServiceId = null;
        
            const usageDetail = await this.UsageDetail.findById(id);
            if (!usageDetail) throw new Error("Không tìm thấy usage detail");

            const serviceUsage = await this.ServiceUsage.findById(usageDetail.ticket_id);
            if (usageDetail.status !== "waiting_confirm")
                throw new Error("Chỉ có thể xác nhận khi trạng thái là waiting_confirm");

            usageDetail.status = "completed";
            usageDetail.confirmed_at = new Date();
            usageDetail.confirmed_by = employee._id;
            await usageDetail.save();

            const svc = await this.Service.findById(usageDetail.service_id);
            if (svc.category_id.toString() === FOOD_CATEGORY_ID) {
                if (svc.storage_quantity < usageDetail.quantity)
                    throw new Error("Số lượng tồn kho không đủ");
                
                foodServiceId = svc._id.toString();
                await this.Service.updateOne(
                    { _id: svc._id, storage_quantity: { $gte: usageDetail.quantity } },
                    { $inc: { storage_quantity: -usageDetail.quantity } }
                );
            }

            await this.recalcServiceUsageStatus(serviceUsage._id);

            if (foodServiceId) {
                await Promise.all([
                    cache.del(`svc:one:${foodServiceId}`),
                    cache.delByPattern("svc:list:*"),
                ]);
            }
        } catch (error) {
            console.error("Error confirming usage detail:", error);
            throw error;
        }
    }

    async cancelUsageDetail(id, employeeUserId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw new Error("usage_detail_id không hợp lệ");

            const employee = await svcHelpers.findEmployeeByUserId(this.eventBus, employeeUserId);
            const serviceUsage = await this.ServiceUsage.findById(usageDetail.ticket_id);
            
            const usageDetail = await this.UsageDetail.findById(id);
            if (!usageDetail) 
                throw new Error("Không tìm thấy usage detail");

            if (usageDetail.status === "completed")
                throw new Error("Không thể hủy dịch vụ đã hoàn thành");
            if (usageDetail.status === "cancelled")
                throw new Error("Dịch vụ đã bị hủy trước đó");

            usageDetail.status = "cancelled";
            usageDetail.cancelled_at = new Date();
            usageDetail.confirmed_by = employee._id;
            await usageDetail.save();

            await this.recalcServiceUsageStatus(serviceUsage._id);

        } catch (error) {
            console.error("Error cancelling usage detail:", error);
            throw error;
        }
    }
}
