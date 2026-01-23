import { payOSpayment } from '../config/payos.js';
import  { Transaction, Receipt, Booking, Customer }  from '../models/index.js';
import { updateCustomerPoints } from '../controllers/customerController.js';
import { confirmBookingInternal } from '../services/bookingService.js';
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

// Tạo payment link PayOS và lưu transaction tương ứng
export const createPayment = async (transaction, userId) => {
    console.log("Creating PayOS payment for transaction:", transaction);
    // tạo orderCode cho PayOS và cho transaction nội bộ
    const bookingCode = Date.now();

    const amount = Number(transaction.amount || 0);
    if (!amount || Number.isNaN(amount)) {
        throw new Error("Invalid amount for PayOS payment");
    }

    const description = transaction.description ||
        `Tiền cọc đơn có ID: #${transaction.booking_id.toString().slice(-6) || bookingCode}`;

    // chuẩn hóa items, nếu FE không gửi thì tạo 1 item mặc định
    const rawItems = Array.isArray(transaction.items) ? transaction.items : [];

    const items = (rawItems.length ? rawItems : [{
        name: transaction.item_name || description,
        quantity: 1,
        price: amount,
    }]).map(item => ({
        name: item.name || `Booking ${item.bookingId || ''}`.trim(),
        quantity: item.quantity || 1,
        price: Number(item.price || amount),
    }));

    // Lấy base URL từ environment hoặc dùng default
    const baseUrl = process.env.FRONTEND_URL || process.env.API_BASE_URL || 'http://localhost:5173';
    
    const paymentData = {
        orderCode: bookingCode,
        amount,
        description,
        items,
        cancelUrl: `${baseUrl}/payment/cancel?orderCode=${bookingCode}`,
        returnUrl: `${baseUrl}/payment/success?orderCode=${bookingCode}`,
        expiredAt: Math.floor(Date.now() / 1000) + (15 * 60), // 15 phút thay vì 5 phút
    };

    // tạo bản ghi transaction trước
    const newTransaction = await Transaction.create({
        user_id: userId,
        booking_id: transaction.booking_id || transaction.bookingId || undefined,
        receipt_id: transaction.receipt_id || transaction.receiptId || undefined,
        booking_code: bookingCode,
        amount,
        description,
        type: 'payment',
        status: 'pending',
    });

    const payOSResponse = await payOSpayment.paymentRequests.create(paymentData);

    // trích data hữu ích và cập nhật lại transaction
    const data = payOSResponse?.data || payOSResponse;

    try {
        if (data?.id) {
            newTransaction.payos_payment_id = data.id;
        }
        newTransaction.raw_response = payOSResponse;

        await newTransaction.save();
    } catch (err) {
        console.error("Không thể cập nhật thông tin PayOS vào transaction:", err);
    }

    // trả về object dùng cho FE (chứa checkoutUrl, orderCode, id,...)
    return data;
}

export const getPaymentLinkDetail = async (bookingId) => {
    const getPaymentDetail = await payOSpayment.paymentRequests.get(bookingId);
    return getPaymentDetail;
}

export const getpaymentDetail = async (bookingId) => {
    // bookingId có thể là booking_code (Number) hoặc booking_id (ObjectId)
    let transaction = null;
    
    if (!isNaN(bookingId)) {
        // Nếu là số, tìm bằng booking_code hoặc order_code
        transaction = await Transaction.findOne({ 
            $or: [
                { booking_code: Number(bookingId) },
                { order_code: Number(bookingId) }
            ]
        })
        .populate('booking_id')
        .populate('receipt_id')
        .populate('user_id');
    } else {
        // Nếu là ObjectId, tìm bằng booking_id
        transaction = await Transaction.findOne({ booking_id: bookingId })
            .populate('booking_id')
            .populate('receipt_id')
            .populate('user_id');
    }
    
    return transaction;
}

export const payOut = async (payoutData, userId) => {
    // NOTE: Payout functionality requires separate PayOS payout client
    // Currently commented out as payOSpayout is not configured
    // Uncomment and configure payOSpayout in config/payos.js if needed
    
    const rand = Date.now();
    const referenceId = `payout_${rand}`;
    const transaction = await Transaction.create({
        user_id: userId,
        booking_code: rand,
        order_code: rand,
        amount: payoutData.amount,
        description: payoutData.description,
        status: 'pending',
        type: 'payout',
        reference_id: referenceId,
    });
    
    // TODO: Uncomment when payOSpayout is configured
    // try{
    //     const payoutBatch = await payOSpayout.payouts.batch.create({
    //     referenceId,
    //     category: ['salary'],
    //     validateDestination: true,
    //     payouts: [
    //         {
    //             referenceId: `${referenceId}_1`,
    //             amount: payoutData.amount,
    //             description: payoutData.description,
    //             toBin: payoutData.toBin,
    //             toAccountNumber: payoutData.toAccountNumber,
    //         }
    //     ],
    // });
    // }
    // catch (error){
    //     console.error('Error creating payout batch:', error);
    //     throw error;
    // }
    
    return referenceId;
}

export const payoutDetailList = async () => {
    // NOTE: Payout functionality requires separate PayOS payout client
    // Currently returns empty array as payOSpayout is not configured
    try {
        // TODO: Uncomment when payOSpayout is configured
        // const payoutList = await payOSpayout.payouts.list();
        const payoutList = null;
        if (payoutList && typeof payoutList === 'object') {
            if (payoutList.data && Array.isArray(payoutList.data.payouts)) {
                return payoutList.data.payouts.map(payout => {
                    try {
                        return {
                            id: payout?.id || null,
                            referenceId: payout?.referenceId || null,
                            approvalState: payout?.approvalState || null,
                            createdAt: payout?.createdAt || null,
                            transactions: Array.isArray(payout?.transactions) 
                                ? payout.transactions.map(txn => ({
                                    id: txn?.id || null,
                                    referenceId: txn?.referenceId || null,
                                    amount: txn?.amount || 0,
                                    description: txn?.description || null,
                                    toBin: txn?.toBin || null,
                                    toAccountNumber: txn?.toAccountNumber || null,
                                    toAccountName: txn?.toAccountName || null,
                                    state: txn?.state || null
                                }))
                                : []
                        };
                    } catch (mapError) {
                        console.error('Error mapping payout:', mapError);
                        return null;
                    }
                }).filter(p => p !== null);
            }
        
            return JSON.parse(JSON.stringify(payoutList, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (key === '_client' || key === 'webhooks') return undefined;
                }
                return value;
            }));
        }
        
        return [];
    } catch (error) {
        console.error('Error in payoutDetail:', error);
        return [];
    }
}

export const payoutDetail = async (referenceId) => {
    // NOTE: Payout functionality requires separate PayOS payout client
    // Currently returns empty array as payOSpayout is not configured
    try {
        // TODO: Uncomment when payOSpayout is configured
        // const payoutInfo = await payOSpayout.payouts.list({ 
        //     referenceId : referenceId });
        const payoutInfo = null;
        try {
            if (typeof payoutInfo === 'object') {
                if (payoutInfo.data && Array.isArray(payoutInfo.data.payouts)) {
                    return payoutInfo.data.payouts.map(payout => {
                        try {
                            return {
                                id: payout?.id || null,
                                referenceId: payout?.referenceId || null,
                                approvalState: payout?.approvalState || null,
                                createdAt: payout?.createdAt || null,
                                transactions: Array.isArray(payout?.transactions) 
                                    ? payout.transactions.map(txn => ({
                                        id: txn?.id || null,
                                        referenceId: txn?.referenceId || null,
                                        amount: txn?.amount || 0,
                                        description: txn?.description || null,
                                        toBin: txn?.toBin || null,
                                        toAccountNumber: txn?.toAccountNumber || null,
                                        toAccountName: txn?.toAccountName || null,
                                        state: txn?.state || null
                                    }))
                                    : []
                            };
                        } catch (mapError) {
                            console.error('Error mapping payout:', mapError);
                            return null;
                        }
                    }).filter(p => p !== null);
                }
                
                return JSON.parse(JSON.stringify(payoutInfo, (key, value) => {
                    if (typeof value === 'object' && value !== null) {
                        if (key === '_client' || key === 'webhooks') return undefined;
                    }
                    return value;
                }));
            }
            
            return [];
        } catch (error) {
            console.error('Error in payoutDetail:', error);
            return [];
        }
    } catch (error) {
        console.error('Error fetching payout detail:', error);
        return [];
    }
}

export const paymentSucceeded = async (orderCode) => {
    
    // Tìm transaction bằng booking_code
    const transaction = await Transaction.findOne({ 
        booking_code: Number(orderCode)
    }).populate('booking_id').populate('receipt_id');
    
    if (!transaction) {
        throw new Error("Không tìm thấy bản ghi giao dịch.");
    }

    // Tránh update lại nhiều lần
    if (transaction.status === "completed") {
        return { transaction, receipt: transaction.receipt_id || null };
    }

    // Update transaction
    transaction.status = "completed";
    transaction.completed_at = new Date();
    await transaction.save();

    // Tìm Receipt bằng booking_id từ transaction
    let receipt = null;
    if (transaction.receipt_id) {
        receipt = await Receipt.findById(transaction.receipt_id);
    } else if (transaction.booking_id) {
        receipt = await Receipt.findOne({ booking_id: transaction.booking_id });
    }

    if (!receipt) {
        throw new Error("Không tìm thấy hóa đơn tương ứng.");
    }

    // Lấy booking để kiểm tra
    const booking = await Booking.findById(transaction.booking_id);
    if (!booking) {
        throw new Error("Không tìm thấy booking tương ứng.");
    }

    // Phân biệt full payment vs deposit
    // Nếu transaction.amount >= receipt.final_amount thì là full payment
    // Nếu transaction.amount < receipt.final_amount thì là deposit
    const isFullPayment = transaction.amount >= receipt.final_amount;
    const isDeposit = !isFullPayment && transaction.amount > 0;
    console.log(`Payment succeeded for transaction ${transaction._id}. Full payment: ${isFullPayment}, Deposit: ${isDeposit}`);
    // Nếu là deposit và booking chưa được confirm, gọi confirmBooking
    if (isDeposit && booking.status === "pending") {
        console.log("IM CALLED Confirming booking as part of deposit payment success:", booking._id);
        try {
            await confirmBookingInternal(transaction.booking_id, null, null);
        } catch (err) {
            console.error("Error confirming booking:", err);
            // Không throw error, tiếp tục xử lý receipt
        }
    }

    // Update receipt dựa trên loại thanh toán
    if (isFullPayment) {
        // Full payment: status = "paid", cộng điểm
        if (receipt.status !== "paid") {
            receipt.status = "paid";
            receipt.paid_at = new Date();
            receipt.transaction_id = transaction._id;
            await receipt.save();

            // Cộng điểm khách hàng
            const customer = await Customer.findById(booking.customer_id);
            if (customer) {
                const rewardPoints = Math.floor(receipt.final_amount / 10000);
                await updateCustomerPoints({
                    customer_id: customer._id,
                    points: rewardPoints,
                    reason: "Hoàn tất thanh toán qua PayOS"
                });

                await Customer.findByIdAndUpdate(
                    customer._id,
                    { $inc: { booking_count: 1 } }
                );
            }
        }
    } else if (isDeposit) {
        // Deposit: status = "half-paid", cập nhật amount_due
        // deposit_amount giữ nguyên (là snapshot từ booking), chỉ cập nhật amount_due
        if (receipt.status !== "paid") {
            // Tính số tiền đã thanh toán (deposit ban đầu + transaction hiện tại)
            // deposit_amount là số tiền cọc ban đầu từ booking
            // transaction.amount là số tiền vừa thanh toán
            const totalPaid = (receipt.deposit_amount || 0) + transaction.amount;
            const remainingDue = Math.max(receipt.final_amount - totalPaid, 0);
            
            receipt.status = "half-paid";
            receipt.amount_due = remainingDue;
            receipt.transaction_id = transaction._id;
            
            // Nếu đã thanh toán đủ (tổng đã trả >= final_amount), chuyển sang paid
            if (totalPaid >= receipt.final_amount) {
                receipt.status = "paid";
                receipt.paid_at = new Date();
                
                // Cộng điểm khách hàng
                const customer = await Customer.findById(booking.customer_id);
                if (customer) {
                    const rewardPoints = Math.floor(receipt.final_amount / 10000);
                    await updateCustomerPoints({
                        customer_id: customer._id,
                        points: rewardPoints,
                        reason: "Hoàn tất thanh toán qua PayOS"
                    });

                    await Customer.findByIdAndUpdate(
                        customer._id,
                        { $inc: { booking_count: 1 } }
                    );
                }
            }
            
            await receipt.save();
        }
    }

    return { transaction, receipt };
};

export const paymentFailed = async(orderCode) => {
    // Tìm transaction bằng booking_code
    const transaction = await Transaction.findOne({ 
        booking_code: Number(orderCode)
    });
    
    if (!transaction) {
        throw new Error("Không tìm thấy bản ghi giao dịch.");
    }

    // Tránh update lại nhiều lần
    if (transaction.status === "failed") {
        return { transaction, receipt: null };
    }

    // Update transaction
    transaction.status = "failed";
    transaction.failed_reason = "Payment failed via PayOS";
    await transaction.save();

    // Tìm Receipt bằng booking_id từ transaction
    let receipt = null;
    if (transaction.receipt_id) {
        receipt = await Receipt.findById(transaction.receipt_id);
    } else if (transaction.booking_id) {
        receipt = await Receipt.findOne({ booking_id: transaction.booking_id });
    }

    if (receipt) {
        // Link transaction với receipt nhưng không thay đổi status của receipt
        receipt.transaction_id = transaction._id;
        await receipt.save();
    }

    return { transaction, receipt };
}