import { container } from "../containers/container.js";

export class BookingStatisticController {
    constructor() {
        this.bookingStatisticService = container.bookingStatisticService;
    }

    getCancellationReasonStats = async (req, res) => {
        try {
            const result = await this.bookingStatisticService.getCancellationReasonStats(req.query);
            
            return res.status(200).json(result);

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    generateBookingReport = async (req, res) => {
        try {
            const { from, to } = req.query;

            const report = await this.bookingStatisticService.generateBookingReport(from, to);

            return res.status(201).json(report);

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getWeeklyRevenue = async (req, res) => {
        try {
            const result = await this.bookingStatisticService.getWeeklyRevenue();
            
            return res.status(200).json({ success: true, ...result });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getWeeklyBookings = async (req, res) => {
        try {
            const result = await this.bookingStatisticService.getWeeklyBookings();
            
            return res.status(200).json({ success: true, ...result });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getMonthlyBookings = async (req, res) => {
        try {
            const result = await this.bookingStatisticService.getMonthlyBookings();
            
            return res.status(200).json({ success: true, result });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    exportBookingReportPDF = async (req, res, next) => {
        try {
            const { from, to } = req.query;

            const doc = await this.bookingStatisticService.exportBookingReportPDF(from, to);

            res.setHeader("Content-Type", "application/pdf");

            res.setHeader(
                "Content-Disposition",
                `attachment; filename=bao_cao_dat_phong_${Date.now()}.pdf`
            );

            doc.pipe(res);

        } catch (err) {
            next(err);
        }
    };

    exportBookingReportExcel = async (req, res, next) => {
        try {
            const { from, to } = req.query;

            const workbook = await this.bookingStatisticService.exportBookingReportExcel(from, to);
        
            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );

            res.setHeader(
                "Content-Disposition",
                "attachment; filename=bao_cao_dat_phong.xlsx"
            );
        
            await workbook.xlsx.write(res);
            res.end();

        } catch (err) {
            next(err);
        }
    };
}