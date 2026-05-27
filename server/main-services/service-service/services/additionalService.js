import mongoose from "mongoose";

export class AdditionalService {
    constructor({ ServiceSlot, ServiceAsset, Service }) {
        this.ServiceSlot = ServiceSlot;
        this.ServiceAsset = ServiceAsset;
        this.Service = Service;
    }

    // asset management 

    async getAllAssets({ service_id, status } = {}) {
        try {
            const filter = {};

            if (service_id) {
                if (!mongoose.Types.ObjectId.isValid(service_id))
                    throw Object.assign(new Error("service_id không hợp lệ"), { status: 400 });

                filter.service_id = service_id;
            }
            if (status) filter.status = status;

            return this.ServiceAsset.find(filter)
                .populate("service_id", "name unit price")
                .sort({ created_at: -1 })
                .lean();
        } catch (error) {
            console.error("Error fetching assets:", error);
            throw error;
        }
    }

    async getAssetById(id) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw Object.assign(new Error("ID tài sản không hợp lệ"), { status: 400 });

            const asset = await this.ServiceAsset.findById(id)
                .populate("service_id", "name unit price")
                .lean();
            if (!asset)
                throw Object.assign(new Error("Không tìm thấy tài sản"), { status: 404 });

            return asset;
        } catch (error) {
            console.error("Error fetching asset:", error);
            throw error;
        }
    }

    async createAsset({ service_id, identifier, condition, notes, purchase_price, purchased_at }) {
        try {
            if (!service_id || !identifier)
                throw Object.assign(new Error("Yêu cầu service_id và tên định danh (identifier)"), { status: 400 });

            if (!mongoose.Types.ObjectId.isValid(service_id))
                throw Object.assign(new Error("service_id không hợp lệ"), { status: 400 });

            const svc = await this.Service.findById(service_id);
            if (!svc)
                throw Object.assign(new Error("Không tìm thấy dịch vụ"), { status: 404 });
            
            if (svc.service_type !== "rental")
                throw Object.assign(new Error("Chỉ có thể thêm tài sản cho dịch vụ loại rental"), { status: 400 });

            const existing = await this.ServiceAsset.findOne({ service_id, identifier });
            if (existing)
                throw Object.assign(new Error(`Tài sản "${identifier}" đã tồn tại cho dịch vụ này`), { status: 400 });

            return this.ServiceAsset.create({
                service_id,
                identifier,
                condition: condition || "new",
                notes: notes || "",
                purchase_price: purchase_price ? Number(purchase_price) : 0,
                purchased_at: purchased_at ? new Date(purchased_at) : null,
            });
        } catch (error) {
            console.error("Error creating asset:", error);
            throw error;
        }
    }

    async updateAsset(id, { identifier, condition, status, notes }) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw Object.assign(new Error("ID tài sản không hợp lệ"), { status: 400 });

            const asset = await this.ServiceAsset.findById(id);
            if (!asset)
                throw Object.assign(new Error("Không tìm thấy tài sản"), { status: 404 });

            if (status && asset.status === "in_use" && status !== "in_use")
                throw Object.assign(new Error("Không thể thay đổi trạng thái tài sản đang được thuê — phải hoàn trả qua luồng xác nhận"), { status: 400 });

            if (identifier !== undefined) asset.identifier = identifier;
            if (condition !== undefined) asset.condition = condition;
            if (status !== undefined) asset.status = status;
            if (notes !== undefined) asset.notes = notes;

            return asset.save();
        } catch (error) {
            console.error("Error updating asset:", error);
            throw error;
        }
    }

    async deleteAsset(id) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw Object.assign(new Error("ID tài sản không hợp lệ"), { status: 400 });

            const asset = await this.ServiceAsset.findById(id);
            if (!asset)
                throw Object.assign(new Error("Không tìm thấy tài sản"), { status: 404 });
            if (asset.status === "in_use")
                throw Object.assign(new Error("Không thể xóa tài sản đang được thuê"), { status: 400 });

            await asset.deleteOne();
        } catch (error) {
            console.error("Error deleting asset:", error);
            throw error;
        }
    }

    // Validates item, atomically marks asset as in_use, returns the UsageDetail data object.
    // Called inside createServiceUsage before UsageDetail.insertMany.
    async prepareRentalDetail(item, ticketId, svc) {
        const { asset_id, quantity, use_from, finish_at } = item;

        if (!asset_id || !mongoose.Types.ObjectId.isValid(asset_id))
            throw Object.assign(new Error(`Yêu cầu asset_id hợp lệ cho dịch vụ thuê "${svc.name}"`), { status: 400 });

        if (!use_from || !finish_at)
            throw Object.assign(new Error(`Yêu cầu use_from và finish_at cho dịch vụ thuê "${svc.name}"`), { status: 400 });

        const from = new Date(use_from);
        const to = new Date(finish_at);
        if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to)
            throw Object.assign(new Error(`Khoảng thời gian thuê không hợp lệ cho "${svc.name}"`), { status: 400 });

        // Atomic: only sets to in_use if currently available and belongs to this service
        const asset = await this.ServiceAsset.findOneAndUpdate(
            { _id: asset_id, service_id: svc._id, status: "in-stock" },
            { $set: { status: "in-use" } },
            { new: true }
        );

        if (!asset) {
            // Distinguish between not-found and not-available for a clear error
            const exists = await this.ServiceAsset.findOne({ _id: asset_id, service_id: svc._id });
            if (!exists)
                throw Object.assign(new Error(`Không tìm thấy tài sản hoặc tài sản không thuộc dịch vụ "${svc.name}"`), { status: 404 });
            
            throw Object.assign(new Error(`Tài sản "${exists.identifier}" hiện không khả dụng (${exists.status})`), { status: 400 });
        }

        const qty = Number(quantity) || 1;
        const totalFee = qty * svc.price;

        return {
            ticket_id: ticketId,
            service_id: svc._id,
            asset_id: asset._id,
            quantity: qty,
            use_from: from,
            finish_at: to,
            current_price: svc.price,
            unit: svc.unit,
            total_fee: totalFee,
            status: "waiting_confirm",
        };
    }

    // Called from confirmUsageDetail — releases the asset back.
    // Accepts optional condition/notes recorded by staff on return.
    async confirmRentalDetail(usageDetail, { condition, notes } = {}) {
        try {
            if (!usageDetail.asset_id) return;

            const asset = await this.ServiceAsset.findById(usageDetail.asset_id);
            if (!asset) return;

            // Damaged asset goes to maintenance instead of available
            asset.status = condition === "damaged" ? "maintenance" : "in-stock";
            if (condition) asset.condition = condition;
            if (notes !== undefined) asset.notes = notes;
            await asset.save();
        } catch (error) {
            console.error("Error confirming rental detail:", error);
            throw error;
        }
    }

    // Called from cancelUsageDetail — releases the asset back without condition update.
    async cancelRentalDetail(usageDetail) {
        try {
            if (!usageDetail.asset_id) return;

            await this.ServiceAsset.findByIdAndUpdate(
                usageDetail.asset_id,
                { $set: { status: "in-stock" } }
            );
        } catch (error) {
            console.error("Error cancelling rental detail:", error);
            throw error;
        }
    }

    // slot service management
    async getAllSlots({ service_id, date, status } = {}) {
        try {
            const filter = {};

            if (service_id) {
                if (!mongoose.Types.ObjectId.isValid(service_id))
                    throw Object.assign(new Error("service_id không hợp lệ"), { status: 400 });
                filter.service_id = service_id;
            }

            if (date) {
                const d = new Date(date);
                if (isNaN(d.getTime()))
                    throw Object.assign(new Error("Ngày không hợp lệ"), { status: 400 });

                d.setHours(0, 0, 0, 0);
                const nextDay = new Date(d);
                nextDay.setDate(nextDay.getDate() + 1);
                filter.date = { $gte: d, $lt: nextDay };
            }

            if (status) filter.status = status;

            return this.ServiceSlot.find(filter)
                .populate("service_id", "name price unit")
                .sort({ start_time: 1 })
                .lean();
        } catch (error) {
            console.error("Error fetching slots:", error);
            throw error;
        }
    }

    async getSlotById(id) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw Object.assign(new Error("ID slot không hợp lệ"), { status: 400 });

            const slot = await this.ServiceSlot.findById(id)
                .populate("service_id", "name price unit")
                .lean();
            if (!slot)
                throw Object.assign(new Error("Không tìm thấy slot"), { status: 404 });

            return slot;
        } catch (error) {
            console.error("Error fetching slot:", error);
            throw error;
        }
    }

    async createSlot({ service_id, date, label, start_time, end_time, max_capacity }, userId) {
        try {
            if (!service_id || !date || !label || !start_time || !max_capacity)
                throw Object.assign(new Error("Yêu cầu đầy đủ: service_id, date, label, start_time, max_capacity"), { status: 400 });

            if (!mongoose.Types.ObjectId.isValid(service_id))
                throw Object.assign(new Error("service_id không hợp lệ"), { status: 400 });

            const svc = await this.Service.findById(service_id);
            if (!svc)
                throw Object.assign(new Error("Không tìm thấy dịch vụ"), { status: 404 });
            
            if (svc.service_type !== "experience")
                throw Object.assign(new Error("Chỉ có thể tạo slot cho dịch vụ loại experience"), { status: 400 });

            const slotDate = new Date(date);
            if (isNaN(slotDate.getTime()))
                throw Object.assign(new Error("date không hợp lệ"), { status: 400 });
            slotDate.setHours(0, 0, 0, 0);

            const startDt = new Date(start_time);
            if (isNaN(startDt.getTime()))
                throw Object.assign(new Error("start_time không hợp lệ"), { status: 400 });

            const endDt = end_time ? new Date(end_time) : null;
            if (endDt && endDt <= startDt)
                throw Object.assign(new Error("end_time phải sau start_time"), { status: 400 });

            const cap = Number(max_capacity);
            if (!Number.isInteger(cap) || cap < 1)
                throw Object.assign(new Error("max_capacity phải là số nguyên >= 1"), { status: 400 });

            return this.ServiceSlot.create({
                service_id,
                date: slotDate,
                label,
                start_time: startDt,
                end_time: endDt,
                max_capacity: cap,
                booked_count: 0,
                status: "open",
                created_by: userId || null,
            });
        } catch (error) {
            console.error("Error creating slot:", error);
            throw error;
        }
    }

    async updateSlot(id, { label, max_capacity, start_time, end_time }) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw Object.assign(new Error("ID slot không hợp lệ"), { status: 400 });

            const slot = await this.ServiceSlot.findById(id);
            if (!slot)
                throw Object.assign(new Error("Không tìm thấy slot"), { status: 404 });
            if (slot.status === "closed")
                throw Object.assign(new Error("Không thể cập nhật slot đã đóng"), { status: 400 });

            if (max_capacity !== undefined) {
                const cap = Number(max_capacity);
                if (!Number.isInteger(cap) || cap < 1)
                    throw Object.assign(new Error("max_capacity phải là số nguyên >= 1"), { status: 400 });
                
                if (cap < slot.booked_count)
                    throw Object.assign(new Error(`Không thể giảm capacity xuống ${cap} — đã có ${slot.booked_count} lượt đặt`), { status: 400 });

                slot.max_capacity = cap;
                if (slot.status === "full" && cap > slot.booked_count)
                    slot.status = "open";
            }

            if (label !== undefined) slot.label = label;

            if (start_time !== undefined) {
                const startDt = new Date(start_time);
                if (isNaN(startDt.getTime()))
                    throw Object.assign(new Error("start_time không hợp lệ"), { status: 400 });
                slot.start_time = startDt;
            }

            if (end_time !== undefined) {
                slot.end_time = end_time ? new Date(end_time) : null;
            }

            return slot.save();
        } catch (error) {
            console.error("Error updating slot:", error);
            throw error;
        }
    }

    async deleteSlot(id) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw Object.assign(new Error("ID slot không hợp lệ"), { status: 400 });

            const slot = await this.ServiceSlot.findById(id);
            if (!slot)
                throw Object.assign(new Error("Không tìm thấy slot"), { status: 404 });
            if (slot.booked_count > 0)
                throw Object.assign(new Error("Không thể xóa slot đã có lượt đặt"), { status: 400 });

            await slot.deleteOne();
        } catch (error) {
            console.error("Error deleting slot:", error);
            throw error;
        }
    }

    async closeSlot(id) {
        try {
            if (!mongoose.Types.ObjectId.isValid(id))
                throw Object.assign(new Error("ID slot không hợp lệ"), { status: 400 });

            const slot = await this.ServiceSlot.findById(id);
            if (!slot)
                throw Object.assign(new Error("Không tìm thấy slot"), { status: 404 });
            if (slot.status === "closed")
                throw Object.assign(new Error("Slot đã được đóng trước đó"), { status: 400 });

            slot.status = "closed";
            return slot.save();
        } catch (error) {
            console.error("Error closing slot:", error);
            throw error;
        }
    }
    // Validates item, atomically increments booked_count, returns the UsageDetail data object.
    // Called inside createServiceUsage before UsageDetail.insertMany.
    async prepareExperienceDetail(item, ticketId, svc) {
        const { slot_id, quantity } = item;

        if (!slot_id || !mongoose.Types.ObjectId.isValid(slot_id))
            throw Object.assign(new Error(`Yêu cầu slot_id hợp lệ cho dịch vụ "${svc.name}"`), { status: 400 });

        const qty = Number(quantity);
        if (!Number.isInteger(qty) || qty < 1)
            throw Object.assign(new Error(`Số lượng không hợp lệ cho dịch vụ "${svc.name}"`), { status: 400 });

        // Read slot first to give a meaningful error if it doesn't exist / is wrong service
        const existing = await this.ServiceSlot.findOne({ _id: slot_id, service_id: svc._id });
        if (!existing)
            throw Object.assign(new Error(`Không tìm thấy slot hoặc slot không thuộc dịch vụ "${svc.name}"`), { status: 404 });
        
        if (existing.status === "closed")
            throw Object.assign(new Error(`Slot "${existing.label}" đã đóng`), { status: 400 });
        
        if (existing.status === "full")
            throw Object.assign(new Error(`Slot "${existing.label}" đã đầy`), { status: 400 });
        
        if (existing.booked_count + qty > existing.max_capacity)
            throw Object.assign(new Error(`Slot "${existing.label}" không đủ chỗ — còn ${existing.max_capacity - existing.booked_count} chỗ, yêu cầu ${qty}`), { status: 400 });

        // Atomic increment — condition guards against race conditions between the read above and now
        const updated = await this.ServiceSlot.findOneAndUpdate(
            {
                _id: slot_id,
                status: { $in: ["open"] },
                $expr: { $lte: [{ $add: ["$booked_count", qty] }, "$max_capacity"] },
            },
            { $inc: { booked_count: qty } },
            { new: true }
        );

        if (!updated)
            throw Object.assign(new Error(`Slot "${existing.label}" vừa hết chỗ, vui lòng thử lại`), { status: 409 });

        // Mark full when capacity is reached
        if (updated.booked_count >= updated.max_capacity) {
            updated.status = "full";
            await updated.save();
        }

        const totalFee = qty * svc.price;

        return {
            ticket_id: ticketId,
            service_id: svc._id,
            slot_id: updated._id,
            quantity: qty,
            use_from: updated.start_time,
            finish_at: updated.end_time,
            current_price: svc.price,
            unit: svc.unit,
            total_fee: totalFee,
            status: "waiting_confirm",
        };
    }

    // Called from cancelUsageDetail — releases booked seats back to the slot.
    async cancelExperienceDetail(usageDetail) {
        try {
            if (!usageDetail.slot_id) return;

            const updated = await this.ServiceSlot.findByIdAndUpdate(
                usageDetail.slot_id,
                { $inc: { booked_count: -usageDetail.quantity } },
                { new: true }
            );

            if (!updated) return;

            // Reopen slot if it was previously full
            if (updated.status === "full" && updated.booked_count < updated.max_capacity) {
                updated.status = "open";
                await updated.save();
            }
        } catch (error) {
            console.error("Error cancelling experience detail:", error);
            throw error;
        }
    }
}
