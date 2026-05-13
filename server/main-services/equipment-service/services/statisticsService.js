import mongoose from "mongoose";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import { ROOM_EVENTS } from "../../../shared/events/roomEvents.js";

import { safeForEach, parseRange, getWeekRange, getMonthRange, getRange } 
    from "../../../shared/config/excel.js";
import { ROBOTO_BOLD, ROBOTO_REGULAR } from "../../../shared/config/pdf.js";
import { formatCurrency, formatDate, addFooter, addHeader, addTable } 
    from "../../../shared/config/pdf.js";
    
export class EquipmentStatisticService {
    constructor({ Equipment, EquipmentCategory, EquipmentLog, eventBus }) {
        this.Equipment = Equipment;
        this.EquipmentCategory = EquipmentCategory;
        this.EquipmentLog = EquipmentLog;
        this.eventBus = eventBus;
    }  
    
    generateEquipmentReport = async (from, to) => {
        const { start, end } = parseRange(from, to);
    
        const [categories, equipments, latestLogs] = await Promise.all([
            this.EquipmentCategory.find().lean(),
            this.Equipment.find().lean(),
            this.EquipmentLog.aggregate([
                { $sort: { start_time: -1 } },
                { $group: { _id: "$equipment_id", status: { $first: "$status" }, condition: { $first: "$condition" } } }
            ])
        ]);
    
        const categoryMap = Object.fromEntries(categories.map(c => [c._id.toString(), c]));
        const equipmentState = Object.fromEntries(latestLogs.map(l => [l._id.toString(), l]));
    
        const summary = { total_equipment: equipments.length, in_stock: 0, in_use: 0, maintenance: 0, lost: 0, total_asset_value: 0 };
        const byCategory = {};
    
        equipments.forEach(e => {
            const cat = categoryMap[e.category_id.toString()];
            const state = equipmentState[e._id.toString()];
            summary.total_asset_value += (cat?.price || 0);
    
            if (!byCategory[e.category_id]) {
                byCategory[e.category_id] = { category_name: cat?.name || "N/A", total: 0, in_use: 0, in_stock: 0, broken: 0 };
            }
            const row = byCategory[e.category_id];
            row.total++;
    
            const status = state?.status || "in-stock";
            if (status === "in-use") { summary.in_use++; row.in_use++; }
            else if (status === "maintenance") { summary.maintenance++; }
            else { summary.in_stock++; row.in_stock++; }
            if (state?.condition === "broken") row.broken++;
        });
    
        const maintenanceLogs = await this.EquipmentLog.find({
            condition: { $in: ["maintenance", "broken"] },
            start_time: { $gte: start, $lte: end }
        }).populate({ path: "equipment_id", populate: { path: "category_id", select: "name" } }).lean();
    
        return {
            meta: { from: start, to: end },
            summary,
            by_category: Object.values(byCategory),
            maintenance_report: maintenanceLogs.map(l => ({
                equipment_id: l.equipment_id?._id || "N/A",
                category: l.equipment_id?.category_id?.name || "N/A",
                condition: l.condition,
                start_time: l.start_time
            }))
        };
    };

    exportEquipmentReportExcel = async (from, to) => {
        try {
            const report = await this.generateEquipmentReport(from, to);
            const wb = new ExcelJS.Workbook();

            const s1 = wb.addWorksheet("Tổng quan");
            if (report.summary) {
                Object.entries(report.summary).forEach(([k, v]) => {
                    s1.addRow([k, v]);
                });
            }

            const s2 = wb.addWorksheet("Danh mục thiết bị");
            s2.columns = [
                { header: "Tên danh mục", key: "category_name", width: 30 },
                { header: "Tổng số", key: "total", width: 15 },
                { header: "Đang dùng", key: "in_use", width: 15 },
                { header: "Trong kho", key: "in_stock", width: 15 },
                { header: "Số máy hỏng", key: "broken", width: 15 }
            ];
            safeForEach(report.by_category, r => s2.addRow(r));
            s2.getRow(1).font = { bold: true };

            const s3 = wb.addWorksheet("Danh sách bảo trì");
            s3.columns = [
                { header: "ID thiết bị", key: "equipment_id", width: 25 },
                { header: "Loại", key: "category", width: 25 },
                { header: "Tình trạng", key: "condition", width: 15 },
                { header: "Ngày bắt đầu", key: "start_time", width: 20 }
            ];
            safeForEach(report.maintenance_report, r => s3.addRow(r));
            s3.getRow(1).font = { bold: true };

            return wb;

        } catch (err) {
            console.error("Excel Equipment Error:", err);
            throw err;
        }
    };

    exportEquipmentReportPDF = async (from, to) => {
        try {
            const report = await this.generateEquipmentReport(from, to);
            const doc = new PDFDocument({ margin: 50, size: "A4" });
            
            // Register fonts
            doc.registerFont("Roboto-Regular", ROBOTO_REGULAR);
            doc.registerFont("Roboto-Bold", ROBOTO_BOLD);

            doc.on("pageAdded", () => {
                addFooter(doc);
            });

            // Header
            addHeader(doc, "BÁO CÁO THIẾT BỊ");
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
                { label: "Tổng thiết bị", value: report.summary?.total_equipment || 0 },
                { label: "Trong kho", value: report.summary?.in_stock || 0 },
                { label: "Đang sử dụng", value: report.summary?.in_use || 0 },
                { label: "Bảo trì", value: report.summary?.maintenance || 0 },
                { label: "Mất", value: report.summary?.lost || 0 },
                { label: "Tổng giá trị tài sản", value: formatCurrency(report.summary?.total_asset_value || 0) },
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

            // By category
            doc.addPage();
            doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("2. THEO DANH MỤC", 50, 50);
            
            const categoryData = (report.by_category || []).map((c) => ({
                category_name: c.category_name || "N/A",
                total: c.total || 0,
                in_use: c.in_use || 0,
                in_stock: c.in_stock || 0,
                broken: c.broken || 0,
            }));

            addTable(doc, categoryData, [
                { header: "Danh mục", key: "category_name", width: 180 },
                { header: "Tổng số", key: "total", width: 90, align: "center" },
                { header: "Đang dùng", key: "in_use", width: 90, align: "center" },
                { header: "Trong kho", key: "in_stock", width: 90, align: "center" },
                { header: "Hỏng", key: "broken", width: 80, align: "center" },
            ], 80, true);

            // Maintenance report
            if (report.maintenance_report && report.maintenance_report.length > 0) {
                doc.addPage();
                doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("3. DANH SÁCH BẢO TRÌ", 50, 50);
                
                const maintenanceData = report.maintenance_report.map((m) => ({
                    equipment_id: String(m.equipment_id || "N/A").slice(-8),
                    category: m.category || "N/A",
                    condition: m.condition || "N/A",
                    start_time: formatDate(m.start_time),
                }));

                addTable(doc, maintenanceData, [
                    { header: "ID Thiết bị", key: "equipment_id", width: 110, align: "center" },
                    { header: "Loại", key: "category", width: 170 },
                    { header: "Tình trạng", key: "condition", width: 110, align: "center" },
                    { header: "Ngày bắt đầu", key: "start_time", width: 120 },
                ], 80, true);
            }

            doc.end();
            return doc;

        } catch (err) {
            console.error("PDF Equipment Error:", err);
            throw err;
        }
    };
}