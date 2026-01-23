import { createPayment, payOut, getPaymentLinkDetail, paymentSucceeded, 
    paymentFailed, getpaymentDetail, payoutDetail, payoutDetailList
} from '../services/payosService.js'

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
            error: 'Lỗi khi tạo liên kết thanh toán' 
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
        const { orderId } = req.params;
        const transactionDetail = await getpaymentDetail(orderId);
        res.status(200).json({ transactionDetail });
    }
    catch (error) {
        console.error('Lỗi khi lấy chi tiết giao dịch:', error);
        res.status(500).json({ error: 'Lỗi khi lấy chi tiết giao dịch' });
    }
}

export const updateSuccessfulTransaction = async (req, res) => {
    try {
        const { orderId } = req.params;
        const updatedTransaction = await paymentSucceeded(orderId);
        res.status(200).json({ updatedTransaction });
    }
    catch (error) {
        console.error('Lỗi khi cập nhật giao dịch thành công:', error);
        res.status(500).json({ error: 'Lỗi khi cập nhật giao dịch thành công' });
    }
}

export const updateFailedTransaction = async (req, res) => {
    try {
        const { orderId } = req.params;
        const updatedTransaction = await paymentFailed(orderId);
        res.status(200).json({ updatedTransaction });
    }
    catch (error) {
        console.error('Lỗi khi cập nhật giao dịch thất bại:', error);
        res.status(500).json({ error: 'Lỗi khi cập nhật giao dịch thất bại' });
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