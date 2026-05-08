import { container } from "../containers/container.js";

export class TransactionController {
    constructor() {
        this.transactionService = container.transactionService;
    }

    createPaymentLink = async (req, res) => {
        try {
            const { userId } = req.params;
            const transaction = req.body;
    
            const paymentLinkData = await this.transactionService.createPayment(transaction, userId);
    
            return res.status(200).json({
                success: true,
                data: paymentLinkData,
            });
        }
        catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    getLinkDetail = async (req, res) => {
        try {
            const { paymentId } = req.params;
            const paymentDetail = await this.transactionService.getPaymentLinkDetail(paymentId);
            
            let cleanedData = {};
            if (paymentDetail && typeof paymentDetail === 'object') {
                const data = paymentDetail.data || paymentDetail;
                cleanedData = {
                    id: data?.id || null,
                    orderCode: data?.orderCode || null,
                    amount: data?.amount || 0,
                    amountPaid: data?.amountPaid || 0,
                    amountRemaining: data?.amountRemaining || 0,
                    status: data?.status || null,
                    createdAt: data?.createdAt || null,
                    transactions: Array.isArray(data?.transactions) ? data.transactions : []
                };
            }
            
            res.status(200).json({ 
                success: true,
                data: cleanedData 
            });
        }
        catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    }
    
    initiatePayout = async (req, res) => {
        try {
            const { userId } = req.params;
            const payoutData = req.body;

            await this.transactionService.payOut(payoutData, userId);
            res.status(200).json({ message: 'Payout initiated successfully' });
        }
        catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };
    
    getPaymentTransactionDetail = async (req, res) => {
        try {
            const { bookingId } = req.params;            
            const transactionDetail = await this.transactionService.getPaymentDetail(Number(bookingId));
            
            if (!transactionDetail) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Không tìm thấy giao dịch' 
                });
            }
            
            res.status(200).json({ 
                success: true,
                data: transactionDetail 
            });
        }
        catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    }
    
    updateSuccessfulTransaction = async (req, res) => {
        try {
            const { bookingId } = req.params;
            const result = await this.transactionService.paymentSucceeded(bookingId);
            
            res.status(200).json({ 
                success: true,
                message: 'Cập nhật giao dịch thành công',
                data: result
            });
        }
        catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    }
    
    updateFailedTransaction = async (req, res) => {
        try {
            const { bookingId } = req.params;
            const result = await this.transactionService.paymentFailed(bookingId);
            
            res.status(200).json({ 
                success: true,
                message: 'Cập nhật giao dịch thất bại',
                data: result
            });
        }
        catch (error) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    }
    
    // payoutStatusDetailList = async (req, res) => {
    //     try {
    //         const payouts = await payoutDetailList();
            
    //         // Tìm payout cụ thể nếu có payoutId
    //         let result = payouts;
    //         if (Array.isArray(payouts)) {
    //             result = payouts;
    //         }
            
    //         res.status(200).json({ 
    //             success: true,
    //             data: result 
    //         });
    //     }
    //     catch (error) {
    //         console.error('Lỗi khi lấy chi tiết trạng thái payout:', error);
    //         res.status(500).json({ 
    //             success: false,
    //             error: 'Lỗi khi lấy chi tiết trạng thái payout' 
    //         });
    //     }
    // }
    
    // payoutStatusDetail = async (req, res) => {
    //     try {
    //         const { referenceId } = req.params;
    //         console.log('Received referenceId:', referenceId);
    //         const payouts = await payoutDetail(referenceId);
    //         res.status(200).json({
    //             success: true,
    //             data: payouts
    //         });
    //     }
    //     catch (error) {
    //         console.error('Lỗi khi lấy chi tiết trạng thái payout:', error);
    //         res.status(500).json({
    //             success: false,
    //             error: 'Lỗi khi lấy chi tiết trạng thái payout'
    //         });
    //     }
    // }
    
    // cashOut = async (req, res) => {
    //     try {
    //         const userId = req.user.userId;
    //         const result = await cashOutForEmployee(userId);
    //         if (result === true) {
    //             res.status(200).json({ success: true, message: "Yêu cầu rút tiền thành công." });
    //         }
    //     }
    //     catch (error) {
    //         res.status(500).json({ success: false, message: "Yêu cầu rút tiền thất bại.", error: error.message });
    //     }
    // };
    
    // amountCashout = async (req, res) => {
    //     try {
    //         const userId = req.user.userId;
    //         const timespan = req.query.timespan;
    //         const result = await getCashoutInfo(userId, timespan);
    //         res.status(200).json({ success: true, data: result });
    //     }
    //     catch (error) {
    //         res.status(500).json({ success: false, message: "Lấy thông tin rút tiền thất bại.", error: error.message });
    //     }
    // }
    
    // availableCashoutAmount = async (req, res) => {
    //     try{
    //         const userId = req.user.userId;
    //         const result = await availableCashout(userId);
    //         res.status(200).json({ success: true, data: result });
    //     }
    //     catch (error) {
    //         res.status(500).json({ success: false, message: "Lấy số tiền có thể rút thất bại.", error: error.message });
    //     }
    // };
    
    // getEarningsHistory = async (req, res) => {
    //     try {
    //         const userId = req.user.userId;
    //         const { status, start_date, end_date, page = 1, limit = 20 } = req.query;
            
    //         const { Employee, EmployeeEarning } = await import('../models/index.js');
            
    //         const employee = await Employee.findOne({ user_id: userId });
    //         if (!employee) {
    //             return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên." });
    //         }
            
    //         const query = { employee_id: employee._id };
            
    //         if (status) {
    //             query.status = status;
    //         }
            
    //         if (start_date || end_date) {
    //             query.period_date = {};
    //             if (start_date) query.period_date.$gte = new Date(start_date);
    //             if (end_date) {
    //                 const endDate = new Date(end_date);
    //                 endDate.setHours(23, 59, 59, 999);
    //                 query.period_date.$lte = endDate;
    //             }
    //         }
            
    //         const skip = (parseInt(page) - 1) * parseInt(limit);
            
    //         const [earnings, total] = await Promise.all([
    //             EmployeeEarning.find(query)
    //                 .populate('attendance_id', 'check_in check_out work_hours status')
    //                 .populate('payout_id', 'status total_amount created_at processed_at')
    //                 .sort({ period_date: -1, created_at: -1 })
    //                 .skip(skip)
    //                 .limit(parseInt(limit)),
    //             EmployeeEarning.countDocuments(query)
    //         ]);
            
    //         const totalAmount = earnings.reduce((sum, e) => sum + e.earning_amount, 0);
            
    //         res.status(200).json({
    //             success: true,
    //             data: {
    //                 earnings,
    //                 pagination: {
    //                     page: parseInt(page),
    //                     limit: parseInt(limit),
    //                     total,
    //                     totalPages: Math.ceil(total / parseInt(limit))
    //                 },
    //                 summary: {
    //                     total_amount: totalAmount,
    //                     count: earnings.length
    //                 }
    //             }
    //         });
    //     } catch (error) {
    //         console.error("Lỗi khi lấy lịch sử thu nhập:", error);
    //         res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    //     }
    // };
    
    // getPayoutHistory = async (req, res) => {
    //     try {
    //         const userId = req.user.userId;
    //         const { status, start_date, end_date, page = 1, limit = 20 } = req.query;
            
    //         const { Employee, PayoutEmployee } = await import('../models/index.js');
            
    //         const employee = await Employee.findOne({ user_id: userId });
    //         if (!employee) {
    //             return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên." });
    //         }
            
    //         const query = { employee_id: employee._id };
            
    //         if (status) {
    //             query.status = status;
    //         }
            
    //         if (start_date || end_date) {
    //             query.created_at = {};
    //             if (start_date) query.created_at.$gte = new Date(start_date);
    //             if (end_date) {
    //                 const endDate = new Date(end_date);
    //                 endDate.setHours(23, 59, 59, 999);
    //                 query.created_at.$lte = endDate;
    //             }
    //         }
            
    //         const skip = (parseInt(page) - 1) * parseInt(limit);
            
    //         const [payouts, total] = await Promise.all([
    //             PayoutEmployee.find(query)
    //                 .populate('earning_ids', 'earning_amount work_hours period_date')
    //                 .sort({ created_at: -1 })
    //                 .skip(skip)
    //                 .limit(parseInt(limit)),
    //             PayoutEmployee.countDocuments(query)
    //         ]);
            
    //         const totalAmount = payouts.reduce((sum, p) => sum + p.total_amount, 0);
            
    //         res.status(200).json({
    //             success: true,
    //             data: {
    //                 payouts,
    //                 pagination: {
    //                     page: parseInt(page),
    //                     limit: parseInt(limit),
    //                     total,
    //                     totalPages: Math.ceil(total / parseInt(limit))
    //                 },
    //                 summary: {
    //                     total_amount: totalAmount,
    //                     count: payouts.length
    //                 }
    //             }
    //         });
    //     } catch (error) {
    //         console.error("Lỗi khi lấy lịch sử rút tiền:", error);
    //         res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    //     }
    // };
}