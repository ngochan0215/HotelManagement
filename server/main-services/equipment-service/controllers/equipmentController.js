import { container } from "../containers/container.js";

export class EquipmentController {
    constructor() {
        this.equipmentService = container.equipmentService;
        this.equipmentStatisticService = container.equipmentStatisticService;
    }

    createEquipmentCategory = async (req, res) => {
        try {
            const category = await this.equipmentService.createEquipmentCategory(req.body);
            return res.status(201).json({ success: true, message: "Thêm danh mục thiết bị mới thành công", category });
    
        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    getAllEquipmentCategories = async (req, res) => {
        try {
            const {total, categories, pagination } = await this.equipmentService.getAllEquipmentCategories(req.query);
            
            return res.status(200).json({ success: true, total, categories, pagination });
    
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    getEquipmentCategoryById = async (req, res) => {
        try {
            const category = await this.equipmentService.getEquipmentCategoryById(req.params.id);

            if (!category) {
                return res.status(404).json({ success: false, message: "Không tìm thấy danh mục thiết bị." });
            }
            res.status(200).json({ success: true, category });
    
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    updateEquipmentCategory = async (req, res) => {
        try {
            const updated = await this.equipmentService.updateEquipmentCategory(req.params.id, req.body);
            return res.status(200).json({ success: true, message: "Cập nhật thành công!", category: updated });
            
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    deleteEquipmentCategory = async (req, res) => {
        try {
            const force = req.query?.force === 'true';

            await this.equipmentService.deleteEquipmentCategory(req.params.id, force);

            return res.status(200).json({ success: true, message: "Xóa danh mục thiết bị thành công!" });
    
        } catch (err) {
            res.status(err.status || 400).json({ message: err.message });
        }
    };

    syncEquipmentCategoryQuantities = async (req, res) => {
        try {
            const { total_categories, updated_categories, details } = await this.equipmentService.syncEquipmentCategoryQuantities();
        
            return res.status(200).json({
                success: true,
                message: `Đồng bộ thành công ${updatedCount} danh mục thiết bị.`,
                data: {
                    total_categories, updated_categories, details
                }
            });
        
        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getOutOfStockCategories = async (req, res) => {
        try {
            const { categories, count } = await this.equipmentService.getOutOfStockCategories();
    
            return res.status(200).json({
                success: true,
                categories, 
                count 
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    // addEquipment = async (req, res) => {
    //     // Business rule: Equipment is created only via import tickets
    //     return res.status(405).json({ success: false, message: "Thiết bị chỉ được thêm qua phiếu nhập thiết bị." });
    // };
    
    getAllEquipments = async (req, res) => {
        try {
            const { data, pagination } = await this.equipmentService.getAllEquipments(req.query);
            
            return res.status(200).json({ success: true, data, pagination });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    getEquipmentById = async (req, res) => {
        try {
            const equipment = await this.equipmentService.getEquipmentById(req.params.id);   
            return res.status(200).json({ success: true, equipment });
    
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    updateEquipment = async (req, res) => {
        try {
            const updated = await this.equipmentService.updateEquipment(req.params.id, req.user.userId, req.body);
    
            return res.status(200).json({
                success: true,
                message: "Cập nhật thiết bị thành công!",
                equipment: updated
            });
    
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    deleteEquipment = async (req, res) => {
        try {
            await this.equipmentService.deleteEquipment(req.params.id);
    
            return res.status(200).json({ success: true, message: "Xóa thiết bị thành công!" });
    
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    generateEquipmentReport = async (req, res) => {
        try {
            const { from, to } = req.query;
            const report = await this.equipmentStatisticService.generateEquipmentReport(from, to);
            
            return res.status(201).json(report);

        } catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    exportEquipmentReportExcel = async (req, res, next) => {
        try {
            const { from, to } = req.query;
            const workbook = await this.equipmentStatisticService.exportEquipmentReportExcel(from, to);
        
            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            res.setHeader(
                "Content-Disposition",
                "attachment; filename=bao_cao_khach_hang.xlsx"
            );
        
            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            next(error);
        }
    };

    exportEquipmentReportPDF = async (req, res, next) => {
        try {
            const { from, to } = req.query;
            const doc = await this.equipmentStatisticService.exportEquipmentReportPDF(from, to);

            res.setHeader("Content-Type", "application/pdf");

            res.setHeader(
                "Content-Disposition",
                `attachment; filename=bao_cao_khach_hang_${Date.now()}.pdf`
            );

            doc.pipe(res);
            
        } catch (err) {
            next(err);
        }
    };
}