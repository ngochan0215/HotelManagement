import mongoose from "mongoose";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import { Jimp } from "jimp";
import jsQR from "jsqr";

import { cache, makeCacheKey } from "../../../shared/utils/cache.js";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";
import { BOOKING_EVENTS } from "../../../shared/events/bookingEvents.js";

import { safeForEach, parseRange, getWeekRange, getMonthRange, getRange } 
    from "../../../shared/config/excel.js";
import { ROBOTO_BOLD, ROBOTO_REGULAR } from "../../../shared/config/pdf.js";
import { formatCurrency, formatDate, addFooter, addHeader, addTable } 
    from "../../../shared/config/pdf.js";

const CCCD_REGEX = /^[0-9]{12}$/;
const PHONE_REGEX = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

export class CustomerService {
    constructor({ Customer, PointsLog, eventBus }) {
        this.Customer = Customer;
        this.PointsLog = PointsLog;
        this.eventBus = eventBus;
    }

    getAllCustomers = async (query = {}) => {
        try {
            const cacheKey = makeCacheKey("customer:list", query);
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const { loyalty, min_points, max_points, min_booking_count, max_booking_count, status } = query;
            let filter = {};

            if (loyalty) filter.loyalty = loyalty;
            if (status) filter.status = status;

            if (min_points || max_points) {
                filter.points = {};
                if (min_points) filter.points.$gte = Number(min_points);
                if (max_points) filter.points.$lte = Number(max_points);
            }

            if (min_booking_count || max_booking_count) {
                filter.booking_count = {};
                if (min_booking_count) filter.booking_count.$gte = Number(min_booking_count);
                if (max_booking_count) filter.booking_count.$lte = Number(max_booking_count);
            }

            const customers = await this.Customer
                .find(filter)
                .select("-updated_at -created_at -__v")
                .lean();

            if (!customers.length) {
                await cache.set(cacheKey, { total: 0, customers: [] }, 300);
                return { total: 0, customers: [] };
            }

            const userIds = customers.map(c => c.user_id);

            // Check per-user info cache first; only call event bus for uncached users
            const userInfoMap = {};
            const uncachedIds = [];
            for (const uid of userIds) {
                const hit = await cache.get(`user:info:${uid}`);
                if (hit) {
                    userInfoMap[uid.toString()] = hit;
                } else {
                    uncachedIds.push(uid);
                }
            }

            let userEnrichmentOk = true;
            if (uncachedIds.length > 0) {
                const reply = await this.eventBus.safeRequest(USER_EVENTS.GET_USERS_INFO, { userIds: uncachedIds });
                if (reply.success) {
                    await Promise.all(reply.users.map(async u => {
                        const info = { email: u.email, system_role: u.system_role, avatar: u.avatar, isBanned: u.isBanned };
                        await cache.set(`user:info:${u._id}`, info, 60);
                        userInfoMap[u._id.toString()] = info;
                    }));
                } else {
                    userEnrichmentOk = false;
                }
            }

            const result = customers.map(customer => ({
                ...customer,
                user: userInfoMap[customer.user_id.toString()] || null,
            }));

            const listResponse = { total: result.length, customers: result };
            if (userEnrichmentOk) {
                await cache.set(cacheKey, listResponse, 300);
            }
            return listResponse;

        } catch (error) {
            console.log("Error fetching customers:", error);
            throw error;
        }
    };

    getCustomerById = async (customerId) => {
        const cacheKey = `customer:one:${customerId}`;
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        const customer = await this.Customer.findById(customerId)
            .select("-__v -created_at -updated_at -createdAt -updatedAt")
            .lean();

        if (!customer) {
            throw new Error("Không tìm thấy khách hàng.");
        }

        const reply = await this.eventBus.safeRequest(USER_EVENTS.GET_USER_INFO, { userId: customer.user_id });
        if (reply.success) {
            customer.user = {
                email: reply.user.email,
                system_role: reply.user.system_role,
                avatar: reply.user.avatar,
                isBanned: reply.user.isBanned
            };
            await cache.set(cacheKey, customer, 300);
        } else {
            customer.user = null;
        }

        return customer;
    };

    updateCustomer = async (id, updateData) => {
        try {
            const {
                email,
                full_name,
                date_birth,
                phone_number,
                nationality,
                CCCD,
            } = updateData;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error("ID khách hàng không hợp lệ.");
            }

            const customer = await this.Customer.findById(id);
            if (!customer) {
                throw new Error("Không tìm thấy khách hàng.");
            }

            if (email !== undefined) {
                let user = null;

                const reply = await this.eventBus.safeRequest(USER_EVENTS.GET_USER_INFO, { userId: customer.user_id });
                if (reply.found) {
                    user = reply.user;
                } else {
                    throw new Error(reply.message);
                }

                if (email !== user.email) {
                    const reply = await this.eventBus.safeRequest(USER_EVENTS.CHECK_EXISTED_EMAIL, { email });
                    if (reply.found) {
                        throw new Error("Email đã tồn tại.");
                    }
                }

                const replyUpdate = await this.eventBus.safeRequest(
                    USER_EVENTS.UPDATE_USER, 
                    { 
                        userId: customer.user_id, 
                        payload: { email } 
                    }
                );
                if (!replyUpdate.success) {
                    throw new Error(replyUpdate.message);
                }
            }

            if (CCCD !== undefined) {
                if (!CCCD_REGEX.test(CCCD)) {
                    throw new Error("CCCD không hợp lệ (phải gồm 12 chữ số).");
                }

                if (CCCD !== customer.CCCD) {
                    const existCCCD = await this.Customer.findOne({ CCCD });
                    if (existCCCD) {
                        throw new Error("CCCD đã tồn tại.");
                    }
                }
            }

            if (phone_number !== undefined) {
                if (!PHONE_REGEX.test(phone_number)) {
                    throw new Error("Số điện thoại không hợp lệ.");
                }

                if (phone_number !== customer.phone_number) {
                    const existPhone = await this.Customer.findOne({ phone_number });
                    if (existPhone) {
                        throw new Error("Số điện thoại đã tồn tại.");
                    }
                }
            }

            if (full_name !== undefined) customer.full_name = full_name;
            if (date_birth !== undefined) customer.date_birth = date_birth;
            if (phone_number !== undefined) customer.phone_number = phone_number;
            if (nationality !== undefined) customer.nationality = nationality;
            if (CCCD !== undefined) customer.CCCD = CCCD;

            await customer.save();
            await Promise.all([
                cache.del(`customer:one:${id}`),
                cache.del(`customer:user:${customer.user_id}`),
                cache.delByPattern("customer:list:*"),
            ]);
            return customer;

        } catch (error) {
            console.log("Error updating customer:", error);
            throw error;
        }
    };

    banCustomer = async (id) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error("ID khách hàng không hợp lệ.");
            }

            const customer = await this.Customer.findById(id);
            if (!customer) {
                throw new Error("Không tìm thấy khách hàng.");
            }

            if (customer.status === "banned") {
                throw new Error("Tài khoản đã bị vô hiệu hóa trước đó.");
            }

            if (customer.status === "inactive") {
                throw new Error("Tài khoản này đã ngừng hoạt động.");
            }

            if (customer.status === "inactive") {
                throw new Error("Tài khoản này đã ngừng hoạt động.");
            }

            customer.status = "banned";
            await customer.save();

            const reply = await this.eventBus.safeRequest(
                USER_EVENTS.UPDATE_USER,
                {
                    userId: customer.user_id,
                    payload: { isBanned: true }
                }
            );
            if (!reply.success) {
                throw new Error(reply.message);
            }

            await Promise.all([
                cache.del(`customer:one:${id}`),
                cache.del(`customer:user:${customer.user_id}`),
                cache.delByPattern("customer:list:*"),
            ]);
            return { success: true };
        } catch (error) {
            console.log("Ban customer unsuccessfully for error: " + error.message);
            throw error;
        }
    };

    unbanCustomer = async (id) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error("ID khách hàng không hợp lệ.");
            }

            const customer = await this.Customer.findById(id);
            if (!customer) {
                throw new Error("Không tìm thấy khách hàng.");
            }

            if (customer.status === "active") {
                throw new Error("Tài khoản đang hoạt động, không cần mở khóa.");
            }

            if (customer.status === "inactive") {
                throw new Error("Tài khoản này đã ngừng hoạt động.");
            }

            customer.status = "active";
            await customer.save();

            const reply = await this.eventBus.safeRequest(
                USER_EVENTS.UPDATE_USER,
                {
                    userId: customer.user_id,
                    payload: { isBanned: false }
                }
            );
            if (!reply.success) {
                throw new Error(reply.message);
            }

            await Promise.all([
                cache.del(`customer:one:${id}`),
                cache.del(`customer:user:${customer.user_id}`),
                cache.delByPattern("customer:list:*"),
            ]);
            return { success: true };

        } catch (error) {
            console.log("Unban customer unsuccessfully for error: " + error.message);
            throw error;
        }
    };

    updateCustomerPoints = async ({ customer_id, points, reason }) => {
        try {
            if (!mongoose.Types.ObjectId.isValid(customer_id)) {
                throw new Error("customer_id không hợp lệ");
            }

            if (!Number.isInteger(points) || points === 0) {
                throw new Error("points phải là số nguyên khác 0");
            }

            if (!reason || typeof reason !== "string") {
                throw new Error("reason là bắt buộc");
            }

            const customer = await this.Customer.findById(customer_id);
            if (!customer) {
                throw new Error("Không tìm thấy customer");
            }

            const before = customer.points;
            //   if (before <= -points && points < 0) {
            //     return { before, after: 0, change: points };
            //   }
            const after = Math.max(before + points, 0); // không cho âm

            customer.points = after;
            await customer.save();

            await this.PointsLog.create({
                customer_id,
                points_change: points,
                points_before: before,
                points_after: after,
                reason,
            });

            await Promise.all([
                cache.del(`customer:one:${customer_id}`),
                cache.del(`customer:user:${customer.user_id}`),
                cache.delByPattern("customer:list:*"),
            ]);
            return { before, after, change: points };
        } catch (error) {
            console.log("Error updating customer points:", error);
            throw error;
        }
    };

    calculateMembershipTier = ({ booking_count, points }) => {
        if (booking_count >= 20 && points >= 5000) return "platinum";
        if (booking_count >= 10 && points >= 2000) return "gold";
        if (booking_count >= 5 && points >= 500) return "silver";
        return "bronze";
    };

    updateCustomerTier = async (customer_id) => {
        const customer = await this.Customer.findById(customer_id);
        if (!customer) 
            throw new Error("Không tìm thấy khách hàng.");

        const newTier = this.calculateMembershipTier({
            booking_count: customer.booking_count || 0,
            points: customer.points || 10,
        });

        if (customer.loyalty !== newTier) {
            customer.loyalty = newTier;
            await customer.save();
            await Promise.all([
                cache.del(`customer:one:${customer_id}`),
                cache.del(`customer:user:${customer.user_id}`),
                cache.delByPattern("customer:list:*"),
            ]);
        }

        return newTier;
    };

    async getCustomerByUserId (user_id) {
        const cacheKey = `customer:user:${user_id}`;
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        const customer = await this.Customer.findOne({ user_id })
            .select("-created_at -updated_at -__v -createdAt -updatedAt");

        if (customer) await cache.set(cacheKey, customer, 300);
        return customer;
    }

    async generateCustomerReport (from, to) {
        try {
            const start = new Date(from);
            const end = new Date(to);
        
            const [customers, replyBookings] = await Promise.all([
                this.Customer.find().lean(),
                this.eventBus.safeRequest(BOOKING_EVENTS.GET_BOOKINGS_CUSTOMER_REPORT, { start, end }),
            ]);
            if (!replyBookings.success) throw new Error(replyBookings.message);

            const bookings = replyBookings.bookings;
            const bookingIds = bookings.map(b => b._id);
        
            const replyLogs = await this.eventBus.safeRequest(
                BOOKING_EVENTS.GET_LOGS_CUSTOMER_REPORT,
                { bookingIds }
            );
            if (!replyLogs.success) throw new Error(replyLogs.message);

            const statusLogs = replyLogs.logs;
            const statusMap = {};
            statusLogs.forEach(s => {
                statusMap[s._id.toString()] = s.status;
            });
        
            const summary = {
                total_customers: customers.length,
                active: 0,
                inactive: 0,
                banned: 0,
                new_customers: 0,
                total_booking: bookings.length,
                total_revenue: 0
            };
        
            customers.forEach(c => {
                if (c.status === "active") summary.active++;
                else if (c.status === "inactive") summary.inactive++;
                else if (c.status === "banned") summary.banned++;
        
                if (c.created_at >= start && c.created_at <= end) {
                    summary.new_customers++;
                }
            });
        
            // map booking to customer
            const customerStats = {};
        
            bookings.forEach(b => {
                const cid = b.customer_id.toString();
                if (!customerStats[cid]) {
                    customerStats[cid] = {
                        total_booking: 0,
                        completed: 0,
                        cancelled: 0,
                        revenue: 0,
                        last_booking: b.created_at
                    };
                }
        
                const status = statusMap[b._id.toString()] || "pending";
        
                customerStats[cid].total_booking++;
                if (b.created_at > customerStats[cid].last_booking)
                    customerStats[cid].last_booking = b.created_at;
        
                if (status === "completed") {
                    customerStats[cid].completed++;
                    customerStats[cid].revenue += b.total_fee || 0;
                    summary.total_revenue += b.total_fee || 0;
                }
        
                if (status === "cancelled") {
                    customerStats[cid].cancelled++;
                }
            });
            
            // group by loyalty
            const byLoyalty = {};
            customers.forEach(c => {
                if (!byLoyalty[c.loyalty]) {
                    byLoyalty[c.loyalty] = {
                        loyalty: c.loyalty,
                        customers: 0,
                        revenue: 0
                    };
                }
        
                byLoyalty[c.loyalty].customers++;
                byLoyalty[c.loyalty].revenue += customerStats[c._id]?.revenue || 0;
            });
        
            // group by frequency
            const byFrequency = {
                one_time: 0,
                returning: 0,
                loyal: 0
            };
        
            customers.forEach(c => {
                if (c.booking_count === 1) byFrequency.one_time++;
                else if (c.booking_count >= 2 && c.booking_count <= 3) byFrequency.returning++;
                else if (c.booking_count >= 4) byFrequency.loyal++;
            });
        
            // top customers
            const topCustomers = customers
                .map(c => ({
                    customer_id: c._id,
                    full_name: c.full_name,
                    phone_number: c.phone_number,
                    booking_count: c.booking_count,
                    total_spent: customerStats[c._id]?.revenue || 0,
                    last_booking: customerStats[c._id]?.last_booking || null
                }))
                .sort((a, b) => b.total_spent - a.total_spent)
                .slice(0, 10);
            
            // track cancellation
            const cancellationReport = customers
                .map(c => {
                    const stat = customerStats[c._id];
                    if (!stat || stat.total_booking === 0) return null;
        
                    return {
                        customer_id: c._id,
                        full_name: c.full_name,
                        total_booking: stat.total_booking,
                        cancelled: stat.cancelled,
                        cancel_rate: Number(
                            ((stat.cancelled / stat.total_booking) * 100).toFixed(2)
                        )
                    };
                })
                .filter(Boolean);
        
            // group by age and nationality
            const byNationality = {};
            customers.forEach(c => {
                byNationality[c.nationality] = (byNationality[c.nationality] || 0) + 1;
            });
        
            const byAgeGroup = {
                "<18": 0,
                "18-25": 0,
                "26-35": 0,
                "36-50": 0,
                ">50": 0
            };
        
            const now = new Date();
        
            customers.forEach(c => {
                const age = Math.floor(
                    (now - new Date(c.date_birth)) / (365 * 24 * 60 * 60 * 1000)
                );
        
                if (age < 18) byAgeGroup["<18"]++;
                else if (age <= 25) byAgeGroup["18-25"]++;
                else if (age <= 35) byAgeGroup["26-35"]++;
                else if (age <= 50) byAgeGroup["36-50"]++;
                else byAgeGroup[">50"]++;
            });
        
            return {
                meta: { from, to, generated_at: new Date() },
                summary,
                by_loyalty: Object.values(byLoyalty),
                by_frequency: byFrequency,
                top_customers: topCustomers,
                cancellation_report: cancellationReport,
                by_nationality: Object.entries(byNationality).map(([k, v]) => ({
                    nationality: k,
                    customers: v
                })),
                by_age_group: Object.entries(byAgeGroup).map(([k, v]) => ({
                    age_group: k,
                    customers: v
                }))
            };
        } catch (error) {
            console.log("Error in generating customer report service: ", error.message);
            throw error;
        }
    };

    exportCustomerReportExcel = async (from, to) => {
        try {
            const report = await this.generateCustomerReport(from, to);
            const workbook = new ExcelJS.Workbook();
        
            // summary sheet
            const summarySheet = workbook.addWorksheet("Summary");
            Object.entries(report.summary).forEach(([k, v]) => {
                summarySheet.addRow([k, v]);
            });
        
            // loyalty sheet
            const loyaltySheet = workbook.addWorksheet("By Loyalty");
            loyaltySheet.columns = [
                { header: "Loyalty", key: "loyalty" },
                { header: "Customers", key: "customers" },
                { header: "Revenue", key: "revenue" }
            ];
            loyaltySheet.addRows(report.by_loyalty);
        
            // top customers
            const topSheet = workbook.addWorksheet("Top Customers");
            topSheet.columns = [
                { header: "Name", key: "full_name" },
                { header: "Phone", key: "phone_number" },
                { header: "Bookings", key: "booking_count" },
                { header: "Total Spent", key: "total_spent" },
                { header: "Last Booking", key: "last_booking" }
            ];
            topSheet.addRows(report.top_customers);
        
            // cancellation
            const cancelSheet = workbook.addWorksheet("Cancellation");
            cancelSheet.columns = [
                { header: "Name", key: "full_name" },
                { header: "Total Booking", key: "total_booking" },
                { header: "Cancelled", key: "cancelled" },
                { header: "Cancel Rate (%)", key: "cancel_rate" }
            ];
            cancelSheet.addRows(report.cancellation_report);
        
            // age
            const ageSheet = workbook.addWorksheet("Age Group");
            ageSheet.columns = [
                { header: "Age Group", key: "age_group" },
                { header: "Customers", key: "customers" }
            ];
            ageSheet.addRows(report.by_age_group);
        
            // nationality
            const nationalitySheet = workbook.addWorksheet("Nationality");
            nationalitySheet.columns = [
                { header: "Nationality", key: "nationality" },
                { header: "Customers", key: "customers" }
            ];
            nationalitySheet.addRows(report.by_nationality);
        
            return workbook;

        } catch (error) {
            console.log("Error in creating customer report excel file service: ", error.message);
            throw error;
        }
    };

    exportCustomerReportPDF = async (from, to) => {
        try {
            const report = await this.generateCustomerReport(from, to);        
            const doc = new PDFDocument({ margin: 50, size: "A4" });
            
            // Register fonts
            doc.registerFont("Roboto-Regular", ROBOTO_REGULAR);
            doc.registerFont("Roboto-Bold", ROBOTO_BOLD);
        
            doc.on("pageAdded", () => {
                addFooter(doc);
            });
                
            // Header
            addHeader(doc, "BÁO CÁO KHÁCH HÀNG");
            doc
                .font(ROBOTO_REGULAR)
                .fontSize(10)
                .fillColor("#333333")
                .text(
                    `Thời gian: ${formatDate(from)} - ${formatDate(to)}`,
                    50,
                    120,
                    { align: "center" }
                )
                .moveDown(1);
        
            // Summary
            doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("1. TỔNG QUAN", 50, 160);
            doc.fontSize(10).font(ROBOTO_REGULAR).fillColor("#000000");
            
            const summaryData = [
            { label: "Tổng khách hàng", value: report.summary?.total_customers || 0 },
            { label: "Đang hoạt động", value: report.summary?.active || 0 },
            { label: "Không hoạt động", value: report.summary?.inactive || 0 },
            { label: "Bị cấm", value: report.summary?.banned || 0 },
            { label: "Khách hàng mới", value: report.summary?.new_customers || 0 },
            { label: "Tổng booking", value: report.summary?.total_booking || 0 },
            { label: "Tổng doanh thu", value: formatCurrency(report.summary?.total_revenue || 0) },
            ];
        
            let yPos = 190;
            summaryData.forEach((item) => {
                doc
                    .font(ROBOTO_BOLD)
                    .fillColor("#1e40af")
                    .text("•", 50, yPos)
                    .font(ROBOTO_REGULAR)
                    .fillColor("#333333")
                    .text(item.label + ":", 65, yPos)
                    .font(ROBOTO_BOLD)
                    .fillColor("#000000")
                    .text(String(item.value), 250, yPos, { align: "right" });
                yPos += 22;
            });
        
            // Thêm footer vào trang đầu tiên
            addFooter(doc, 1);
        
            // Top customers
            if (report.top_customers && report.top_customers.length > 0) {
                doc.addPage();
                doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("2. TOP KHÁCH HÀNG", 50, 50);
                
                const topCustomersData = report.top_customers.map((c) => ({
                    full_name: c.full_name || "N/A",
                    phone_number: c.phone_number || "N/A",
                    booking_count: c.booking_count || 0,
                    total_spent: formatCurrency(c.total_spent || 0),
                    last_booking: formatDate(c.last_booking),
                }));
        
                addTable(doc, topCustomersData, [
                    { header: "Tên", key: "full_name", width: 140 },
                    { header: "SĐT", key: "phone_number", width: 110 },
                    { header: "Số booking", key: "booking_count", width: 90, align: "center" },
                    { header: "Tổng chi tiêu", key: "total_spent", width: 130, align: "right" },
                    { header: "Booking cuối", key: "last_booking", width: 110 },
                ], 80, true);
            }
        
            // By loyalty
            if (report.by_loyalty && report.by_loyalty.length > 0) {
                doc.addPage();
                
                doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("3. THEO LOYALTY", 50, 50);
                
                const loyaltyData = report.by_loyalty.map((l) => ({
                    loyalty: l.loyalty || "N/A",
                    customers: l.customers || 0,
                    revenue: formatCurrency(l.revenue || 0),
                }));
            
                addTable(doc, loyaltyData, [
                    { header: "Loyalty", key: "loyalty", width: 180 },
                    { header: "Số khách hàng", key: "customers", width: 130, align: "center" },
                    { header: "Doanh thu", key: "revenue", width: 160, align: "right" },
                ], 80, true);
            }
        
            // By age group
            if (report.by_age_group && report.by_age_group.length > 0) {
                doc.addPage();
                doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("4. THEO NHÓM TUỔI", 50, 50);
                
                const ageData = report.by_age_group.map((a) => ({
                    age_group: a.age_group || "N/A",
                    customers: a.customers || 0,
                }));
            
                addTable(doc, ageData, [
                    { header: "Nhóm tuổi", key: "age_group", width: 200 },
                    { header: "Số khách hàng", key: "customers", width: 200, align: "center" },
                ], 80, true);
            }
        
            doc.end();
            return doc;
            
        } catch (err) {
            console.error("PDF Customer report error:", err);
            throw err;
        }
    };

    // qr scan 
    scanQRCodeService = async (imageBuffer) => {
        if (!imageBuffer) {
            throw new Error("Vui lòng tải lên một ảnh chứa mã QR");
        }

        // Read image
        const image = await Jimp.read(imageBuffer);

        const qrImage = {
            data: new Uint8ClampedArray(image.bitmap.data),
            width: image.bitmap.width,
            height: image.bitmap.height,
        };

        const code = jsQR(qrImage.data, qrImage.width, qrImage.height);

        if (!code) {
            throw new Error( "Không tìm thấy mã QR trong ảnh. Vui lòng thử lại với ảnh rõ hơn.");
        }

        const qrData = code.data;
        let parsedData = null;

        // CCCD format
        if (qrData.includes("||") && qrData.includes("|")) {
            const [cccd, rest] = qrData.split("||");
            const parts = rest.split("|");

            if (parts.length >= 5) {
                parsedData = {
                    cccd: cccd.trim(),
                    fullName: parts[0]?.trim() || "",
                    dateOfBirth: parts[1]?.trim() || "",
                    gender: parts[2]?.trim() || "",
                    address: parts[3]?.trim() || "",
                    issueDate: parts[4]?.trim() || "",
                };
            }
        }

        if (!parsedData) {
            try { parsedData = JSON.parse(qrData); } 
            catch { parsedData = qrData; }
        }

        return {
            parsedData,
            rawData: qrData,
        };
    };

    getMyProfile = async (userId) => {
        try {
            const cacheKey = `customer:profile:${userId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            const customer = await this.Customer.findOne({ user_id: userId })
                .select("-__v -created_at -updated_at -createdAt -updatedAt")
                .lean();

            if (!customer) {
                const err = new Error("Không tìm thấy hồ sơ khách hàng.");
                err.status = 404;
                throw err;
            }

            const reply = await this.eventBus.safeRequest(USER_EVENTS.GET_USER_INFO, { userId: customer.user_id });
            if (reply.success) {
                customer.user = {
                    email: reply.user.email,
                    avatar: reply.user.avatar,
                    system_role: reply.user.system_role,
                };
            }

            await cache.set(cacheKey, customer, 300);
            return customer;
        } catch (error) {
            console.error("Error fetching my profile:", error);
            throw error;
        }
    };

    updateMyProfile = async (userId, updateData) => {
        try {
            const { full_name, date_birth, phone_number, nationality,
                bank_shortName, account_number, BIN
            } = updateData;

            const customer = await this.Customer.findOne({ user_id: userId });
            if (!customer) {
                const err = new Error("Không tìm thấy hồ sơ khách hàng.");
                err.status = 404;
                throw err;
            }

            if (phone_number !== undefined) {
                if (!PHONE_REGEX.test(phone_number)) {
                    throw new Error("Số điện thoại không hợp lệ.");
                }
                if (phone_number !== customer.phone_number) {
                    const existPhone = await this.Customer.findOne({ phone_number });
                    if (existPhone) throw new Error("Số điện thoại đã tồn tại.");
                }
            }

            if (full_name !== undefined) customer.full_name = full_name;
            if (date_birth !== undefined) customer.date_birth = date_birth;
            if (phone_number !== undefined) customer.phone_number = phone_number;
            if (nationality !== undefined) customer.nationality = nationality;
            if (bank_shortName !== undefined) customer.bank_shortName = bank_shortName;
            if (account_number !== undefined) customer.account_number = account_number;
            if (BIN !== undefined) customer.BIN = BIN;

            await customer.save();

            await Promise.all([
                cache.del(`customer:profile:${userId}`),
                cache.del(`customer:one:${customer._id}`),
                cache.del(`customer:user:${userId}`),
                cache.delByPattern("customer:list:*"),
            ]);

            return customer;
        } catch (error) {
            console.error("Error updating customer profile:", error);
            throw error;
        }
    };

    // communication

    async getCustomersByIds (ids) {
        return this.Customer.find(
            { _id: { $in: ids } }
        ).select("-created_at -updated_at -__v -createdAt -updatedAt");
    }

    async getCustomersByUserIds (customerUserIds) {
        return await this.Customer.find(
            { user_id: { $in: customerUserIds } }
        ).select("-__v -created_at -updated_at -createdAt -updatedAt").lean();
    }

    async findCustomerById (customerId) {
        const customer = await this.Customer.findById(customerId)
            .select("-__v -created_at -updated_at -createdAt -updatedAt");

        if (!customer) {
            throw new Error("Không tìm thấy khách hàng.");
        }

        return customer;
    };

    async createCustomer(userId, customer) {
        try {
            const existed = await this.Customer.findOne({ user_id: userId });
            if (existed)
                throw new Error("Đã tồn tại tài khoản khách hàng tương ứng cho người dùng.");

            const { phone_number, CCCD } = customer;

            const [existingPhone, existingCCCD] = await Promise.all([
                this.Customer.findOne({ phone_number }),
                this.Customer.findOne({ CCCD }),
            ]);
            if (existingPhone) {
                throw new Error("Số điện thoại đã tồn tại.");
            }
            if (existingCCCD) {
                throw new Error("Số căn cước công dân đã tồn tại.");
            }

            const the_customer = await this.Customer.create({
                user_id: userId,
                ...customer
            });

            await cache.delByPattern("customer:list:*");
            return the_customer;

        } catch (error) {
            console.error("Error creating customer:", error);
            throw error;
        }
        
    }

}