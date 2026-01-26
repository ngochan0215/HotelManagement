import { payOSpayment, payOSpayout } from '../config/payos.js';
import  { Transaction, Receipt, Booking, Customer, Employee, User, 
    PayoutEmployee, EmployeeEarning, CompensateTicket, Incident
}  from '../models/index.js';
import mongoose from 'mongoose';
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
    try{
        const payoutBatch = await payOSpayout.payouts.batch.create({
        referenceId,
        category: ['salary'],
        validateDestination: true,
        payouts: [
            {
                referenceId: `${referenceId}_1`,
                amount: payoutData.amount,
                description: payoutData.description,
                toBin: payoutData.toBin,
                toAccountNumber: payoutData.toAccountNumber,
            }
        ],
    });
    }
    catch (error){
        console.error('Error creating payout batch:', error);
        throw error;
    }
    
    return referenceId;
}

export const payoutDetailList = async () => {
    // NOTE: Payout functionality requires separate PayOS payout client
    // Currently returns empty array as payOSpayout is not configured
    try {
        // TODO: Uncomment when payOSpayout is configured
        const payoutList = await payOSpayout.payouts.list();
        //const payoutList = null;
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
        const payoutInfo = await payOSpayout.payouts.list({ 
            referenceId : referenceId });
        //const payoutInfo = null;
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

    // Tìm Receipt bằng receipt_id hoặc booking_id từ transaction
    let receipt = null;
    if (transaction.receipt_id) {
        receipt = await Receipt.findById(transaction.receipt_id);
    } else if (transaction.booking_id) {
        receipt = await Receipt.findOne({ booking_id: transaction.booking_id });
    }

    if (!receipt) {
        throw new Error("Không tìm thấy hóa đơn tương ứng.");
    }

    // Lấy booking để kiểm tra (nếu có)
    let booking = null;
    if (transaction.booking_id) {
        booking = await Booking.findById(transaction.booking_id);
    }

    // Phân biệt các trường hợp thanh toán:
    // 1. Thanh toán tiền cọc cho booking mới (receipt.status = "pending", deposit_amount > 0, booking.status = "pending")
    // 2. Thanh toán phần còn lại hoặc đầy đủ cho receipt đã có (receipt.status = "pending" hoặc "half-paid")
    
    const isDepositPayment = receipt.status === "pending" && receipt.deposit_amount > 0 && booking && booking.status === "pending";
    const isFullPayment = transaction.amount >= receipt.amount_due;
    const isPartialPayment = !isFullPayment && transaction.amount > 0 && transaction.amount < receipt.amount_due;
    
    console.log(`Payment succeeded for transaction ${transaction._id}. Receipt status: ${receipt.status}, Deposit: ${isDepositPayment}, Full: ${isFullPayment}, Partial: ${isPartialPayment}`);

    // Nếu là tiền cọc cho booking mới và booking chưa được confirm, gọi confirmBooking
    if (isDepositPayment && booking && booking.status === "pending") {
        console.log("Confirming booking as part of deposit payment success:", booking._id);
        try {
            await confirmBookingInternal(transaction.booking_id, null, null);
            // Refresh booking sau khi confirm
            booking = await Booking.findById(transaction.booking_id);
        } catch (err) {
            console.error("Error confirming booking:", err);
            // Không throw error, tiếp tục xử lý receipt
        }
    }

    // Tính tổng số tiền đã thanh toán
    // deposit_amount là số tiền cọc ban đầu (đã được trừ vào amount_due khi tạo receipt)
    // transaction.amount là số tiền vừa thanh toán qua PayOS
    // Tổng đã trả = deposit_amount + transaction.amount
    const totalPaid = (receipt.deposit_amount || 0) + transaction.amount;
    const remainingDue = Math.max(receipt.final_amount - totalPaid, 0);

    // Update receipt dựa trên loại thanh toán
    if (isFullPayment || totalPaid >= receipt.final_amount) {
        // Thanh toán đầy đủ: status = "paid", cộng điểm
        if (receipt.status !== "paid") {
            receipt.status = "paid";
            receipt.payment = "bank"; // Đánh dấu là thanh toán qua PayOS
            receipt.paid_at = new Date();
            receipt.transaction_id = transaction._id;
            receipt.amount_due = 0; // Đã thanh toán đủ
            await receipt.save();

            // Cộng điểm khách hàng (nếu có booking)
            if (booking) {
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

            // Tự động cập nhật compensation tickets thành "paid" nếu có trong hóa đơn
            if (receipt.compensate_ticket_id || receipt.compensate_fee > 0) {
                try {
                    // Tìm tất cả compensation tickets pending của booking này
                    const compensateTickets = await CompensateTicket.find({
                        booking_id: receipt.booking_id,
                        status: "pending"
                    });

                    // Cập nhật tất cả thành "paid"
                    for (const ticket of compensateTickets) {
                        ticket.status = "paid";
                        ticket.paid_at = new Date();
                        await ticket.save();

                        // Cập nhật incident liên quan
                        const incident = await Incident.findById(ticket.incident_id);
                        if (incident && incident.compensation_status === "pending") {
                            incident.compensation_status = "done";
                            if (incident.status !== "closed") {
                                incident.status = "closed";
                                incident.closed_at = new Date();
                            }
                            await incident.save();
                        }
                    }
                } catch (compError) {
                    console.error("Error updating compensation tickets:", compError);
                    // Không throw error để không ảnh hưởng đến payment flow
                }
            }
        }
    } else if (isPartialPayment || (isDepositPayment && totalPaid < receipt.final_amount)) {
        // Thanh toán một phần hoặc tiền cọc: status = "half-paid", cập nhật amount_due
        receipt.status = "half-paid";
        receipt.payment = "bank"; // Đánh dấu là thanh toán qua PayOS
        receipt.amount_due = remainingDue;
        receipt.transaction_id = transaction._id;
        
        await receipt.save();
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

export async function cashOutForEmployee(userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    let payoutIds = []; // Declare outside try block for error handling

    try {
        const employee = await Employee.findOne({ user_id: userId }).session(session);
        if (!employee) {
            throw new Error("Employee not found");
        }
        const user = await User.findById(userId).session(session);
        if (!user) {
            throw new Error("User not found");
        }
        const employeeId = employee._id;

        // Tự động tạo payout batch từ available earnings nếu chưa có pending payout
        let payoutBill = await PayoutEmployee.find({
            status: "pending",
            employee_id: employeeId
        }).session(session);

        console.log("Pending payout bills for employee:", payoutBill);

        // Nếu không có pending payout, tạo batch mới từ available earnings
        if (!payoutBill.length) {
            const availableEarnings = await EmployeeEarning.find({
                employee_id: employeeId,
                status: 'available',
                payout_id: { $exists: false }
            }).session(session).sort({ completed_at: 1 });

            if (!availableEarnings.length) {
                await session.abortTransaction();
                throw new Error("Không có tiền lương để rút");
            }

            const totalAmount = availableEarnings.reduce((sum, earning) => sum + earning.earning_amount, 0);
            console.log("Total available earnings amount:", totalAmount);

            const completedDates = availableEarnings.map(e => new Date(e.completed_at));
            const periodStart = new Date(Math.min(...completedDates));
            const periodEnd = new Date(Math.max(...completedDates));

            const newPayoutBatch = await PayoutEmployee.create([{
                employee_id: employeeId,
                earning_ids: availableEarnings.map(e => e._id),
                total_amount: totalAmount,
                period_start: periodStart,
                period_end: periodEnd,
                status: 'pending'
            }], { session });

            await EmployeeEarning.updateMany(
                { _id: { $in: availableEarnings.map(e => e._id) } },
                { payout_id: newPayoutBatch[0]._id }
            ).session(session);

            payoutBill = newPayoutBatch;
        }

        console.log("Calculating total payout amount for employee...", payoutBill);
        const amount = payoutBill.reduce((sum, bill) => {
            // console.log("Processing payout bill:", bill);
            // console.log("Bill amount:", bill.total_amount);
            const amount = Number(bill.total_amount) || 0; 
            return sum + Math.round(amount); // Math.round chỉ nhận 1 tham số
        }, 0);

        console.log("Total payout amount for employee:", amount);
        if (amount <= 0) {
            await session.abortTransaction();
            throw new Error("Số tiền payout không hợp lệ");
        }

        console.log("Thực hiện thanh toán cho employee:", user.full_name, "số tiền:", amount);
        const payoutPayload = {
            amount: amount,
            description: `HotelManagement thanh toán lương`,
            toBin: employee.BIN,
            toAccountNumber: employee.account_number
        };

        // Update payout status to processing before making payment
        payoutIds = payoutBill.map(bill => bill._id);
        await PayoutEmployee.updateMany(
            { _id: { $in: payoutIds } },
            { status: 'processing' }
        ).session(session);

        await session.commitTransaction();
        session.endSession();

        let orderCode;
        let orderCodeFromResult;
        try {
            orderCode = await payOut(payoutPayload, userId);
            orderCodeFromResult = orderCode.split('_')[1];
        } catch (payOutError) {
            // Revert payout status back to pending if payOut fails
            console.log(payOutError);
            await PayoutEmployee.updateMany(
                { _id: { $in: payoutIds } },
                { status: 'pending' }
            );
            console.error("PayOut error details:", {
                message: payOutError.message,
                status: payOutError.status,
                code: payOutError.code,
                response: payOutError.response?.data,
                stack: payOutError.stack
            });
            throw new Error(`Lỗi khi tạo yêu cầu thanh toán trong tasker.service: ${payOutError.message}`);
        }

        const start = Date.now();
        let state = 'PROCESSING';

        let lastError = null;
        while (Date.now() - start < 30000 && state === 'PROCESSING') {
            let result;

            try {
                result = await payoutDetail(orderCode);
                console.log('Payout detail:', result);
            } catch (err) {
                lastError = err;
                await sleep(5000);
                continue;
            }

            const payoutState = result?._data?.[0]?.transactions?.[0]?.state;
            console.log('Payout state:', payoutState);
            if (!payoutState) {
                lastError = new Error('Không lấy được trạng thái payout');
                await sleep(5000);
                continue;
            }

            if (payoutState === 'SUCCEEDED' || payoutState === 'COMPLETED') {
                await Transaction.updateOne(
                    { order_code: orderCodeFromResult, user_id: userId },
                    { status: 'completed' }
                );

                // Update PayoutTasker status to completed
                await PayoutEmployee.updateMany(
                    { _id: { $in: payoutIds } },
                    { status: 'completed', processed_at: new Date() }
                );

                // Update all related EmployeeEarning records to 'paid' status
                const completedPayouts = await PayoutEmployee.find({
                    _id: { $in: payoutIds },
                    status: 'completed'
                }).select('earning_ids');

                const allEarningIds = completedPayouts.flatMap(payout => payout.earning_ids);
                if (allEarningIds.length > 0) {
                    await EmployeeEarning.updateMany(
                        { _id: { $in: allEarningIds } },
                        { status: 'paid' }
                    );
                }

                state = 'SUCCEEDED';
                return true; 
            }

            if (payoutState === 'FAILED') {
                await Transaction.updateOne(
                    { order_code: orderCodeFromResult, user_id: userId },
                    { status: 'failed' }
                );

                // Revert payout status back to pending on failure
                await PayoutEmployee.updateMany(
                    { _id: { $in: payoutIds } },
                    { status: 'pending' }
                );

                state = 'FAILED';
                throw new Error('Payout failed');
            }

            await sleep(5000);
        }

        if (state === 'PROCESSING') {
            await Transaction.updateOne({
                order_code: orderCodeFromResult,
                user_id: userId
            }, {
                status: 'failed'
            });

            // Revert payout status back to pending on timeout
            await PayoutEmployee.updateMany(
                { _id: { $in: payoutIds } },
                { status: 'pending' }
            );

            throw new Error('Payout processing timeout');
        }
        if (lastError) {
            // Revert payout status back to pending if there's an error
            if (payoutIds && payoutIds.length > 0) {
                await PayoutEmployee.updateMany(
                    { _id: { $in: payoutIds } },
                    { status: 'pending' }
                );
            }
            throw lastError;
        }
    } catch (error) {
        // Revert payout status back to pending if error occurs after transaction commit
        if (payoutIds && payoutIds.length > 0) {
            try {
                const currentPayouts = await PayoutEmployee.find({
                    _id: { $in: payoutIds },
                    status: 'processing'
                });
                if (currentPayouts.length > 0) {
                    await PayoutEmployee.updateMany(
                        { _id: { $in: payoutIds }, status: 'processing' },
                        { status: 'pending' }
                    );
                }
            } catch (revertError) {
                console.error('Error reverting payout status:', revertError);
            }
        }

        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        throw new Error(error.message);
    }
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

export const getCashoutInfo = async (userId, timespan = 'day') => {
    try {
        const employee = await Employee.findOne({ user_id: userId });
        if (!employee) {
            throw new Error('Employee not found');
        }
        const employeeId = employee._id;

        let startDate;
        const now = new Date();
        if (timespan === 'day') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        }
        else if (timespan === 'week') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        }
        else if (timespan === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        }
        else if (timespan === 'all') {
            const bills = await PayoutEmployee.find({
                employee_id: employeeId
            });
            return bills.reduce((sum, bill) => sum + bill.total_amount, 0);
        }
        else {
            throw new Error('Invalid timespan');
        }
        const bills = await PayoutEmployee.find({
            employee_id: employeeId,
            created_at: { $gte: startDate }
        });
        return bills.reduce((sum, bill) => sum + bill.total_amount, 0);
    }
    catch (error) {
        throw new Error(error.message);
    }
};

export const availableCashout = async (userId) => {
  try {
        const employee = await Employee.findOne({ user_id: userId });
        if (!employee) {
            throw new Error('Employee not found');
        }
        const employeeId = employee._id;

        // Get available earnings that haven't been included in any payout yet
        const availableEarnings = await EmployeeEarning.find({
            employee_id: employeeId,
            status: 'available',
            payout_id: { $exists: false }
        });

        console.log("AVAILABLE EARNINGS:", availableEarnings);

        // Only include pending payouts (exclude processing ones as they are in progress)
        const pendingPayouts = await PayoutEmployee.find({
            employee_id: employeeId,
            status: 'pending'
        });

        console.log("PENDING PAYOUTS:", pendingPayouts);

        const availableAmount = availableEarnings.reduce((sum, earning) => {
            const amount = Number(earning.earning_amount) || 0;
            return sum + amount;
        }, 0);

        // 2. Tính Pending Amount: Sửa Math.round và ép kiểu Number
        const pendingAmount = pendingPayouts.reduce((sum, bill) => {
            const amount = Number(bill.total_amount) || 0; 
            return sum + Math.round(amount); // Math.round chỉ nhận 1 tham số
        }, 0);

        console.log("AVAILABLE AMOUNT:", availableAmount);
        console.log("PENDING AMOUNT:", pendingAmount);
        console.log("TOTAL CASHOUT AMOUNT:", availableAmount + pendingAmount);
        return availableAmount + pendingAmount;
    }
    catch (error) {
        throw new Error(error.message);
    }
};