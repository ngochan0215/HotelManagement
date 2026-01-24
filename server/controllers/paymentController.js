import { createPayment, payOut, getPaymentLinkDetail, paymentSucceeded, 
    paymentFailed, getpaymentDetail, payoutDetail, payoutDetailList,
    cashOutForEmployee, getCashoutInfo, availableCashout,
} from '../services/payosService.js';
import { Employee, EmployeeEarning } from "../models/index.js";

export const createPaymentLink = async (req, res) => {
    try {
        const { userId } = req.params;
        const transaction = req.body;

        const paymentLinkData = await createPayment(transaction, userId);

        return res.status(200).json({
            success: true,
            data: paymentLinkData,
        });
    }
    catch (error) {
        console.error('Lỗi khi tạo liên kết thanh toán:', error);
        res.status(500).json({ 
            success: false,
            error: 'Lỗi khi tạo liên kết thanh toán ' + error.message
        });
    }
};

export const getLinkDetail = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const paymentDetail = await getPaymentLinkDetail(paymentId);
        
        // Chỉ trích xuất các dữ liệu cần thiết
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
        console.error('Lỗi khi lấy chi tiết thanh toán:', error);
        res.status(500).json({ 
            success: false,
            error: 'Lỗi khi lấy chi tiết thanh toán' 
        });
    }
}

export const initiatePayout = async (req, res) => {
    try {
        const { userId } = req.params;
        const payoutData = req.body;
        await payOut(payoutData, userId);
        res.status(200).json({ message: 'Payout initiated successfully' });
    }
    catch (error) {
        console.error('Lỗi khi thực hiện payout:', error);
        res.status(500).json({ error: 'Lỗi khi thực hiện payout' });
    }
};

export const getPaymentTransactionDetail = async (req, res) => {
    try {
        const { bookingId } = req.params;
        // bookingId có thể là booking_code (Number) hoặc booking_id (ObjectId)
        let transactionDetail = null;
        
        if (!isNaN(bookingId)) {
            // Nếu là số, tìm bằng booking_code
            transactionDetail = await getpaymentDetail(Number(bookingId));
        } else {
            // Nếu là ObjectId, tìm bằng booking_id
            const { Transaction } = await import('../models/index.js');
            transactionDetail = await Transaction.findOne({ booking_id: bookingId })
                .populate('booking_id')
                .populate('receipt_id')
                .populate('user_id');
        }
        
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
        console.error('Lỗi khi lấy chi tiết giao dịch:', error);
        res.status(500).json({ 
            success: false,
            error: 'Lỗi khi lấy chi tiết giao dịch' 
        });
    }
}

export const updateSuccessfulTransaction = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const result = await paymentSucceeded(bookingId);
        
        res.status(200).json({ 
            success: true,
            message: 'Cập nhật giao dịch thành công',
            data: result
        });
    }
    catch (error) {
        console.error('Lỗi khi cập nhật giao dịch thành công:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || 'Lỗi khi cập nhật giao dịch thành công' 
        });
    }
}

export const updateFailedTransaction = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const result = await paymentFailed(bookingId);
        
        res.status(200).json({ 
            success: true,
            message: 'Cập nhật giao dịch thất bại',
            data: result
        });
    }
    catch (error) {
        console.error('Lỗi khi cập nhật giao dịch thất bại:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || 'Lỗi khi cập nhật giao dịch thất bại' 
        });
    }
}

export const payoutStatusDetailList = async (req, res) => {
    try {
        const payouts = await payoutDetailList();
        
        // Tìm payout cụ thể nếu có payoutId
        let result = payouts;
        if (Array.isArray(payouts)) {
            result = payouts;
        }
        
        res.status(200).json({ 
            success: true,
            data: result 
        });
    }
    catch (error) {
        console.error('Lỗi khi lấy chi tiết trạng thái payout:', error);
        res.status(500).json({ 
            success: false,
            error: 'Lỗi khi lấy chi tiết trạng thái payout' 
        });
    }
}

export const payoutStatusDetail = async (req, res) => {
    try {
        const { referenceId } = req.params;
        console.log('Received referenceId:', referenceId);
        const payouts = await payoutDetail(referenceId);
        res.status(200).json({
            success: true,
            data: payouts
        });
    }
    catch (error) {
        console.error('Lỗi khi lấy chi tiết trạng thái payout:', error);
        res.status(500).json({
            success: false,
            error: 'Lỗi khi lấy chi tiết trạng thái payout'
        });
    }
}

export const cashOut = async (req, res) => {
    try {
        const userId = req.userId;
        const result = await cashOutForEmployee(userId);
        if (result === true) {
            res.status(200).json({ success: true, message: "Yêu cầu rút tiền thành công." });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Yêu cầu rút tiền thất bại.", error: error.message });
    }
};

export const amountCashout = async (req, res) => {
    try {
        const userId = req.userId;
        const timespan = req.query.timespan;
        const result = await getCashoutInfo(userId, timespan);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Lấy thông tin rút tiền thất bại.", error: error.message });
    }
}

export const availableCashoutAmount = async (req, res) => {
    try{
        const userId = req.userId;
        const result = await availableCashout(userId);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Lấy số tiền có thể rút thất bại.", error: error.message });
    }
};

// Xem lịch sử thu nhập (earnings)
export const getEarningsHistory = async (req, res) => {
    try {
        const userId = req.userId;
        const { status, start_date, end_date, page = 1, limit = 20 } = req.query;
        
        const { Employee, EmployeeEarning } = await import('../models/index.js');
        
        const employee = await Employee.findOne({ user_id: userId });
        if (!employee) {
            return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên." });
        }
        
        const query = { employee_id: employee._id };
        
        if (status) {
            query.status = status;
        }
        
        if (start_date || end_date) {
            query.period_date = {};
            if (start_date) query.period_date.$gte = new Date(start_date);
            if (end_date) {
                const endDate = new Date(end_date);
                endDate.setHours(23, 59, 59, 999);
                query.period_date.$lte = endDate;
            }
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [earnings, total] = await Promise.all([
            EmployeeEarning.find(query)
                .populate('attendance_id', 'check_in check_out work_hours status')
                .populate('payout_id', 'status total_amount created_at processed_at')
                .sort({ period_date: -1, created_at: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            EmployeeEarning.countDocuments(query)
        ]);
        
        const totalAmount = earnings.reduce((sum, e) => sum + e.earning_amount, 0);
        
        res.status(200).json({
            success: true,
            data: {
                earnings,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                },
                summary: {
                    total_amount: totalAmount,
                    count: earnings.length
                }
            }
        });
    } catch (error) {
        console.error("Lỗi khi lấy lịch sử thu nhập:", error);
        res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};

// Xem lịch sử rút tiền (payouts)
export const getPayoutHistory = async (req, res) => {
    try {
        const userId = req.userId;
        const { status, start_date, end_date, page = 1, limit = 20 } = req.query;
        
        const { Employee, PayoutEmployee } = await import('../models/index.js');
        
        const employee = await Employee.findOne({ user_id: userId });
        if (!employee) {
            return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên." });
        }
        
        const query = { employee_id: employee._id };
        
        if (status) {
            query.status = status;
        }
        
        if (start_date || end_date) {
            query.created_at = {};
            if (start_date) query.created_at.$gte = new Date(start_date);
            if (end_date) {
                const endDate = new Date(end_date);
                endDate.setHours(23, 59, 59, 999);
                query.created_at.$lte = endDate;
            }
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [payouts, total] = await Promise.all([
            PayoutEmployee.find(query)
                .populate('earning_ids', 'earning_amount work_hours period_date')
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            PayoutEmployee.countDocuments(query)
        ]);
        
        const totalAmount = payouts.reduce((sum, p) => sum + p.total_amount, 0);
        
        res.status(200).json({
            success: true,
            data: {
                payouts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                },
                summary: {
                    total_amount: totalAmount,
                    count: payouts.length
                }
            }
        });
    } catch (error) {
        console.error("Lỗi khi lấy lịch sử rút tiền:", error);
        res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};