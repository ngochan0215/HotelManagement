 import mongoose from "mongoose";
import { BOOKING_EVENTS } from "../../../shared/events/bookingEvents.js";
import { USER_EVENTS } from "../../../shared/events/userEvents.js";
import * as helpers from "./paymentHelpers.js";
import { cache } from "../../../shared/utils/cache.js";

export class TransactionService {
    constructor({ Receipt, Transaction, paymentGateway, eventBus,
        sendNotification, sendNotificationsToUsers }) {
        this.Receipt = Receipt;
        this.Transaction = Transaction;
        this.paymentGateway = paymentGateway;
        this.eventBus = eventBus;
        this.sendNotification = sendNotification;
        this.sendNotificationsToUsers = sendNotificationsToUsers;
    }

    // main business logic
    
    createPayment = async (transaction, userId) => {
        try {
            // create orderCode for payos and internal transaction
            const bookingCode = Date.now();
        
            const amount = Number(transaction.amount || 0);
            if (!amount || Number.isNaN(amount)) {
                throw new Error("Invalid amount for PayOS payment");
            }
        
            const description = transaction.description ||
                `Tiền cọc booking có ID: #${transaction.booking_id.toString().slice(-6) || bookingCode}`;
        
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
        
            const baseUrl = process.env.FRONTEND_URL || process.env.API_BASE_URL || 'http://localhost:5173';
            const source = (transaction.receipt_id || transaction.receiptId) ? 'receipt' : 'booking';

            const paymentData = {
                orderCode: bookingCode,
                amount,
                description,
                items,
                cancelUrl: `${baseUrl}/payment/cancel?orderCode=${bookingCode}&source=${source}`,
                returnUrl: `${baseUrl}/payment/success?orderCode=${bookingCode}&source=${source}`,
                expiredAt: Math.floor(Date.now() / 1000) + (15 * 60),
            };
        
            const newTransaction = await this.Transaction.create({
                user_id: userId,
                booking_id: transaction.booking_id || transaction.bookingId || undefined,
                receipt_id: transaction.receipt_id || transaction.receiptId || undefined,
                booking_code: bookingCode,
                amount,
                description,
                type: 'payment',
                status: 'pending',
            });
        
            const payOSResponse = await this.paymentGateway.createPaymentRequest(paymentData);
            const data = payOSResponse?.data || payOSResponse;
        
            try {
                if (data?.id) newTransaction.payos_payment_id = data.id;
                
                newTransaction.raw_response = payOSResponse;
        
                await newTransaction.save();
            } catch (err) {
                console.log("Error in updating payos information for transaction", err.message);
            }
        
            return data;

        } catch (error) {
            console.log("Error in creating payment: ", error.message);
            throw error;
        }
    }
    
    getPaymentLinkDetail = async (bookingId) => {
        try {
            const getPaymentDetail = await this.paymentGateway.getPaymentRequest(bookingId);
            return getPaymentDetail;

        } catch (error) {
            console.log("Error in getting payment link detail: ", error.message);
            throw error;
        }
    }
    
    enrichTransactionDetail = async (transaction) => {
        if (!transaction) return null;
        const t = typeof transaction.toObject === "function" ? transaction.toObject() : { ...transaction };
        const out = { ...t };

        let enrichedReceipt = null;
        if (t.receipt_id) {
            try {
                const rec = await this.Receipt.findById(t.receipt_id).lean();
                if (rec) {
                    enrichedReceipt = await helpers.enrichReceipts(this.eventBus, rec);
                    out.receipt = enrichedReceipt;
                } else {
                    out.receipt = null;
                }
            } catch {
                out.receipt = null;
            }
        }

        const tasks = [];

        if (t.user_id) {
            tasks.push(
                this.eventBus.safeRequest(USER_EVENTS.GET_USER_INFO, { userId: t.user_id })
                    .then(r => {
                        out.user = r.success && r.user ? r.user : null;
                    })
                    .catch(() => { out.user = null; })
            );
        }

        const receiptBooking = enrichedReceipt?.booking ?? null;
        const bookingFromReceipt =
            receiptBooking &&
            (!t.booking_id ||
                receiptBooking._id?.toString() === t.booking_id?.toString());

        if (bookingFromReceipt) {
            out.booking = receiptBooking;
        } else if (t.booking_id) {
            tasks.push(
                this.eventBus.safeRequest(BOOKING_EVENTS.CHECK_EXISTS_ID, { bookingId: t.booking_id })
                    .then(async (r) => {
                        if (r.success && r.booking) {
                            const b = r.booking.toObject ? r.booking.toObject() : r.booking;
                            out.booking = await helpers.populateBookingPeople(this.eventBus, b);
                        } else {
                            out.booking = null;
                        }
                    })
                    .catch(() => { out.booking = null; })
            );
        }

        await Promise.all(tasks);
        return out;
    }

    getPaymentDetail = async (bookingId) => {
        try {
            const cacheKey = `payment:detail:${bookingId}`;
            const cached = await cache.get(cacheKey);
            if (cached) return cached;

            let transaction = null;

            if (!isNaN(bookingId)) {
                transaction = await this.Transaction.findOne({
                    $or: [
                        { booking_code: Number(bookingId) },
                        { order_code: Number(bookingId) }
                    ]
                }).lean();
            } else {
                transaction = await this.Transaction.findOne({ booking_id: bookingId }).lean();
            }

            const detail = await this.enrichTransactionDetail(transaction);
            if (detail) await cache.set(cacheKey, detail, 60);
            return detail;

        } catch (error) {
            console.log("Error in getting payment detail: ", error.message);
            throw error;
        }
    }
    
    // payOut = async (payoutData, userId) => {
    //     // NOTE: Payout functionality requires separate PayOS payout client
    //     // Currently commented out as payOSpayout is not configured
    //     // Uncomment and configure payOSpayout in config/payos.js if needed
        
    //     const rand = Date.now();
    //     const referenceId = `payout_${rand}`;
    //     const transaction = await Transaction.create({
    //         user_id: userId,
    //         booking_code: rand,
    //         order_code: rand,
    //         amount: payoutData.amount,
    //         description: payoutData.description,
    //         status: 'pending',
    //         type: 'payout',
    //         reference_id: referenceId,
    //     });
        
    //     // TODO: Uncomment when payOSpayout is configured
    //     try{
    //         const payoutBatch = await payOSpayout.payouts.batch.create({
    //         referenceId,
    //         category: ['salary'],
    //         validateDestination: true,
    //         payouts: [
    //             {
    //                 referenceId: `${referenceId}_1`,
    //                 amount: payoutData.amount,
    //                 description: payoutData.description,
    //                 toBin: payoutData.toBin,
    //                 toAccountNumber: payoutData.toAccountNumber,
    //             }
    //         ],
    //     });
    //     }
    //     catch (error){
    //         console.error('Error creating payout batch:', error);
    //         throw error;
    //     }
        
    //     return referenceId;
    // }
    
    // payoutDetailList = async () => {
    //     // NOTE: Payout functionality requires separate PayOS payout client
    //     // Currently returns empty array as payOSpayout is not configured
    //     try {
    //         // TODO: Uncomment when payOSpayout is configured
    //         const payoutList = await payOSpayout.payouts.list();
    //         //const payoutList = null;
    //         if (payoutList && typeof payoutList === 'object') {
    //             if (payoutList.data && Array.isArray(payoutList.data.payouts)) {
    //                 return payoutList.data.payouts.map(payout => {
    //                     try {
    //                         return {
    //                             id: payout?.id || null,
    //                             referenceId: payout?.referenceId || null,
    //                             approvalState: payout?.approvalState || null,
    //                             createdAt: payout?.createdAt || null,
    //                             transactions: Array.isArray(payout?.transactions) 
    //                                 ? payout.transactions.map(txn => ({
    //                                     id: txn?.id || null,
    //                                     referenceId: txn?.referenceId || null,
    //                                     amount: txn?.amount || 0,
    //                                     description: txn?.description || null,
    //                                     toBin: txn?.toBin || null,
    //                                     toAccountNumber: txn?.toAccountNumber || null,
    //                                     toAccountName: txn?.toAccountName || null,
    //                                     state: txn?.state || null
    //                                 }))
    //                                 : []
    //                         };
    //                     } catch (mapError) {
    //                         console.error('Error mapping payout:', mapError);
    //                         return null;
    //                     }
    //                 }).filter(p => p !== null);
    //             }
            
    //             return JSON.parse(JSON.stringify(payoutList, (key, value) => {
    //                 if (typeof value === 'object' && value !== null) {
    //                     if (key === '_client' || key === 'webhooks') return undefined;
    //                 }
    //                 return value;
    //             }));
    //         }
            
    //         return [];
    //     } catch (error) {
    //         console.error('Error in payoutDetail:', error);
    //         return [];
    //     }
    // }
    
    // payoutDetail = async (referenceId) => {
    //     // NOTE: Payout functionality requires separate PayOS payout client
    //     // Currently returns empty array as payOSpayout is not configured
    //     try {
    //         // TODO: Uncomment when payOSpayout is configured
    //         const payoutInfo = await payOSpayout.payouts.list({ 
    //             referenceId : referenceId });
    //         //const payoutInfo = null;
    //         try {
    //             if (typeof payoutInfo === 'object') {
    //                 if (payoutInfo.data && Array.isArray(payoutInfo.data.payouts)) {
    //                     return payoutInfo.data.payouts.map(payout => {
    //                         try {
    //                             return {
    //                                 id: payout?.id || null,
    //                                 referenceId: payout?.referenceId || null,
    //                                 approvalState: payout?.approvalState || null,
    //                                 createdAt: payout?.createdAt || null,
    //                                 transactions: Array.isArray(payout?.transactions) 
    //                                     ? payout.transactions.map(txn => ({
    //                                         id: txn?.id || null,
    //                                         referenceId: txn?.referenceId || null,
    //                                         amount: txn?.amount || 0,
    //                                         description: txn?.description || null,
    //                                         toBin: txn?.toBin || null,
    //                                         toAccountNumber: txn?.toAccountNumber || null,
    //                                         toAccountName: txn?.toAccountName || null,
    //                                         state: txn?.state || null
    //                                     }))
    //                                     : []
    //                             };
    //                         } catch (mapError) {
    //                             console.error('Error mapping payout:', mapError);
    //                             return null;
    //                         }
    //                     }).filter(p => p !== null);
    //                 }
                    
    //                 return JSON.parse(JSON.stringify(payoutInfo, (key, value) => {
    //                     if (typeof value === 'object' && value !== null) {
    //                         if (key === '_client' || key === 'webhooks') return undefined;
    //                     }
    //                     return value;
    //                 }));
    //             }
                
    //             return [];
    //         } catch (error) {
    //             console.error('Error in payoutDetail:', error);
    //             return [];
    //         }
    //     } catch (error) {
    //         console.error('Error fetching payout detail:', error);
    //         return [];
    //     }
    // }
    
    paymentSucceeded = async (orderCode) => {
        try {
            let transaction = await this.Transaction.findOne({ 
                booking_code: Number(orderCode)
            });
            
            if (!transaction) {
                throw new Error("Không tìm thấy bản ghi giao dịch.");
            }
        
            if (transaction.status === "completed") {
                const receiptDoc = transaction.receipt_id
                    ? await this.Receipt.findById(transaction.receipt_id).lean()
                    : null;
                const enriched = await this.enrichTransactionDetail(transaction);
                return { 
                    transaction: enriched, 
                    receipt: receiptDoc
                };
            }
        
            transaction.status = "completed";
            transaction.completed_at = new Date();
            await transaction.save();
        
            // find receipt
            let receipt = null;
            if (transaction.receipt_id) {
                receipt = await this.Receipt.findById(transaction.receipt_id);
            } else if (transaction.booking_id) {
                receipt = await this.Receipt.findOne({ booking_id: transaction.booking_id });
            }
        
            if (!receipt) {
                throw new Error("Không tìm thấy hóa đơn tương ứng.");
            }
        
            // find booking
            let booking = null;
            if (transaction.booking_id) {
                const reply = await this.eventBus.safeRequest(
                    BOOKING_EVENTS.CHECK_EXISTS_ID,
                    { bookingId: transaction.booking_id }
                );
                if (!reply.success)
                    throw new Error(reply.message);

                booking = reply.booking;
            }
        
            // clarify which type of payment, deposit for reservation for existed receipt
            const isDepositPayment = receipt.status === "pending" && receipt.deposit_amount > 0 && booking && booking.status === "pending";
            const isFullPayment = transaction.amount >= receipt.amount_due;
            const isPartialPayment = !isFullPayment && transaction.amount > 0 && transaction.amount < receipt.amount_due;
                
            // if deposit then request to booking-service to confirm reservation
            if (isDepositPayment && booking && booking.status === "pending") {
                try {
                    const confirmReply = await this.eventBus.safeRequest(
                        BOOKING_EVENTS.CONFIRM_FROM_PAYMENT,
                        { bookingId: transaction.booking_id, employeeId: null }
                    );
                    if (!confirmReply.success) {
                        console.log("confirmBookingFromPayment:", confirmReply.message);
                    }
                } catch (err) {
                    console.log("Error in confirming booking internal (payment-service):", err.message);
                }
            }
        
            // calculate the total amount already paid
            const totalPaid = (receipt.deposit_amount || 0) + transaction.amount;
            const remainingDue = Math.max(receipt.final_amount - totalPaid, 0);
        
            // Update receipt base on the type of payment
            if (isFullPayment || totalPaid >= receipt.final_amount) {
                
                if (receipt.status !== "paid") {
                    receipt.status = "paid";
                    receipt.payment = "bank";
                    receipt.paid_at = new Date();
                    receipt.transaction_id = transaction._id;
                    receipt.amount_due = 0; 
                    await receipt.save();
        
                    // Cộng điểm khách hàng (nếu có booking)
                    // if (booking) {
                    //     const customer = await Customer.findById(booking.customer_id);
                    //     if (customer) {
                    //         const rewardPoints = Math.max(
                    //             0,
                    //             Math.floor(receipt.final_amount / 10000)
                    //         );
        
                    //         // await updateCustomerPoints({
                    //         //     customer_id: customer._id,
                    //         //     points: rewardPoints,
                    //         //     reason: "Hoàn tất thanh toán qua PayOS"
                    //         // });
        
                    //         await Customer.findByIdAndUpdate(
                    //             customer._id,
                    //             { $inc: { booking_count: 1 } }
                    //         );
                    //     }
                    // }
        
                    // also automatically update compensation tickets
                    if (receipt.compensate_ticket_id || receipt.compensate_fee > 0) {
                        const compensateTickets = await helpers.findPendingCompensationTickets(this.eventBus, receipt.booking_id);

                        for (const ticket of compensateTickets) {
                            ticket.status = "paid";
                            ticket.paid_at = new Date();
                            await ticket.save();

                            // const incident = await Incident.findById(ticket.incident_id);
                            // if (incident && incident.compensation_status === "pending") {
                            //     incident.compensation_status = "done";
                            //     if (incident.status !== "closed") {
                            //         incident.status = "closed";
                            //         incident.closed_at = new Date();
                            //     }
                            //     await incident.save();
                            // }
                        }
                    }
                }
            } else if (isPartialPayment || (isDepositPayment && totalPaid < receipt.final_amount)) {
                receipt.status = "half-paid";
                receipt.payment = "bank";
                receipt.amount_due = remainingDue;
                receipt.transaction_id = transaction._id;
                await receipt.save();
            }
        
            const enrichedTxn = await this.enrichTransactionDetail(transaction);
            await Promise.all([
                cache.delByPattern("payment:detail:*"),
                receipt ? cache.del(`receipt:one:${receipt._id}`) : Promise.resolve(),
                cache.delByPattern("receipt:list:*"),
            ]);
            return { transaction: enrichedTxn, receipt };
        } catch (error) {
            console.log("Error in processing payment as succeeded: ", error.message);
            throw error;
        }
    };
    
    paymentFailed = async(orderCode) => {
        try {
            const transaction = await this.Transaction.findOne({ 
                booking_code: Number(orderCode)
            });
            
            if (!transaction) {
                throw new Error("Không tìm thấy bản ghi giao dịch.");
            }
            if (transaction.status === "failed") {
                const enriched = await this.enrichTransactionDetail(transaction);
                return { transaction: enriched, receipt: null };
            }
        
            transaction.status = "failed";
            transaction.failed_reason = "Payment failed via PayOS";
            await transaction.save();
        
            let receipt = null;
            if (transaction.receipt_id) {
                receipt = await this.Receipt.findById(transaction.receipt_id);
            } else if (transaction.booking_id) {
                receipt = await this.Receipt.findOne({ booking_id: transaction.booking_id });
            }
        
            if (receipt) {
                receipt.transaction_id = transaction._id;
                await receipt.save();
            }
        
            const enrichedTxn = await this.enrichTransactionDetail(transaction);
            await Promise.all([
                cache.delByPattern("payment:detail:*"),
                receipt ? cache.del(`receipt:one:${receipt._id}`) : Promise.resolve(),
                cache.delByPattern("receipt:list:*"),
            ]);
            return { transaction: enrichedTxn, receipt };

        } catch (error) {
            console.log("Error in processing payment as failed: ", error.message);
            throw error;
        }
    }
    
    // async function cashOutForEmployee(userId) {
    //     const session = await mongoose.startSession();
    //     session.startTransaction();
        
    //     let payoutIds = []; // Declare outside try block for error handling
    
    //     try {
    //         const employee = await Employee.findOne({ user_id: userId }).session(session);
    //         if (!employee) {
    //             throw new Error("Employee not found");
    //         }
    //         const user = await User.findById(userId).session(session);
    //         if (!user) {
    //             throw new Error("User not found");
    //         }
    //         const employeeId = employee._id;
    
    //         // Tự động tạo payout batch từ available earnings nếu chưa có pending payout
    //         let payoutBill = await PayoutEmployee.find({
    //             status: "pending",
    //             employee_id: employeeId
    //         }).session(session);
    
    //         console.log("Pending payout bills for employee:", payoutBill);
    
    //         // Nếu không có pending payout, tạo batch mới từ available earnings
    //         if (!payoutBill.length) {
    //             const availableEarnings = await EmployeeEarning.find({
    //                 employee_id: employeeId,
    //                 status: 'available',
    //                 payout_id: { $exists: false }
    //             }).session(session).sort({ completed_at: 1 });
    
    //             if (!availableEarnings.length) {
    //                 await session.abortTransaction();
    //                 throw new Error("Không có tiền lương để rút");
    //             }
    
    //             const totalAmount = availableEarnings.reduce((sum, earning) => sum + earning.earning_amount, 0);
    //             console.log("Total available earnings amount:", totalAmount);
    
    //             const completedDates = availableEarnings.map(e => new Date(e.completed_at));
    //             const periodStart = new Date(Math.min(...completedDates));
    //             const periodEnd = new Date(Math.max(...completedDates));
    
    //             const newPayoutBatch = await PayoutEmployee.create([{
    //                 employee_id: employeeId,
    //                 earning_ids: availableEarnings.map(e => e._id),
    //                 total_amount: totalAmount,
    //                 period_start: periodStart,
    //                 period_end: periodEnd,
    //                 status: 'pending'
    //             }], { session });
    
    //             await EmployeeEarning.updateMany(
    //                 { _id: { $in: availableEarnings.map(e => e._id) } },
    //                 { payout_id: newPayoutBatch[0]._id }
    //             ).session(session);
    
    //             payoutBill = newPayoutBatch;
    //         }
    
    //         console.log("Calculating total payout amount for employee...", payoutBill);
    //         const amount = payoutBill.reduce((sum, bill) => {
    //             // console.log("Processing payout bill:", bill);
    //             // console.log("Bill amount:", bill.total_amount);
    //             const amount = Number(bill.total_amount) || 0; 
    //             return sum + Math.round(amount); // Math.round chỉ nhận 1 tham số
    //         }, 0);
    
    //         console.log("Total payout amount for employee:", amount);
    //         if (amount <= 0) {
    //             await session.abortTransaction();
    //             throw new Error("Số tiền payout không hợp lệ");
    //         }
    
    //         console.log("Thực hiện thanh toán cho employee:", user.full_name, "số tiền:", amount);
    //         const payoutPayload = {
    //             amount: amount,
    //             description: `HotelManagement thanh toán lương`,
    //             toBin: employee.BIN,
    //             toAccountNumber: employee.account_number
    //         };
    
    //         // Update payout status to processing before making payment
    //         payoutIds = payoutBill.map(bill => bill._id);
    //         await PayoutEmployee.updateMany(
    //             { _id: { $in: payoutIds } },
    //             { status: 'processing' }
    //         ).session(session);
    
    //         await session.commitTransaction();
    //         session.endSession();
    
    //         let orderCode;
    //         let orderCodeFromResult;
    //         try {
    //             orderCode = await payOut(payoutPayload, userId);
    //             orderCodeFromResult = orderCode.split('_')[1];
    //         } catch (payOutError) {
    //             // Revert payout status back to pending if payOut fails
    //             console.log(payOutError);
    //             await PayoutEmployee.updateMany(
    //                 { _id: { $in: payoutIds } },
    //                 { status: 'pending' }
    //             );
    //             console.error("PayOut error details:", {
    //                 message: payOutError.message,
    //                 status: payOutError.status,
    //                 code: payOutError.code,
    //                 response: payOutError.response?.data,
    //                 stack: payOutError.stack
    //             });
    //             throw new Error(`Lỗi khi tạo yêu cầu thanh toán trong tasker.service: ${payOutError.message}`);
    //         }
    
    //         const start = Date.now();
    //         let state = 'PROCESSING';
    
    //         let lastError = null;
    //         while (Date.now() - start < 30000 && state === 'PROCESSING') {
    //             let result;
    
    //             try {
    //                 result = await payoutDetail(orderCode);
    //                 console.log('Payout detail:', result);
    //             } catch (err) {
    //                 lastError = err;
    //                 await sleep(5000);
    //                 continue;
    //             }
    
    //             const payoutState = result?._data?.[0]?.transactions?.[0]?.state;
    //             console.log('Payout state:', payoutState);
    //             if (!payoutState) {
    //                 lastError = new Error('Không lấy được trạng thái payout');
    //                 await sleep(5000);
    //                 continue;
    //             }
    
    //             if (payoutState === 'SUCCEEDED' || payoutState === 'COMPLETED') {
    //                 await Transaction.updateOne(
    //                     { order_code: orderCodeFromResult, user_id: userId },
    //                     { status: 'completed' }
    //                 );
    
    //                 // Update PayoutTasker status to completed
    //                 await PayoutEmployee.updateMany(
    //                     { _id: { $in: payoutIds } },
    //                     { status: 'completed', processed_at: new Date() }
    //                 );
    
    //                 // Update all related EmployeeEarning records to 'paid' status
    //                 const completedPayouts = await PayoutEmployee.find({
    //                     _id: { $in: payoutIds },
    //                     status: 'completed'
    //                 }).select('earning_ids');
    
    //                 const allEarningIds = completedPayouts.flatMap(payout => payout.earning_ids);
    //                 if (allEarningIds.length > 0) {
    //                     await EmployeeEarning.updateMany(
    //                         { _id: { $in: allEarningIds } },
    //                         { status: 'paid' }
    //                     );
    //                 }
    
    //                 state = 'SUCCEEDED';
    //                 return true; 
    //             }
    
    //             if (payoutState === 'FAILED') {
    //                 await Transaction.updateOne(
    //                     { order_code: orderCodeFromResult, user_id: userId },
    //                     { status: 'failed' }
    //                 );
    
    //                 // Revert payout status back to pending on failure
    //                 await PayoutEmployee.updateMany(
    //                     { _id: { $in: payoutIds } },
    //                     { status: 'pending' }
    //                 );
    
    //                 state = 'FAILED';
    //                 throw new Error('Payout failed');
    //             }
    
    //             await sleep(5000);
    //         }
    
    //         if (state === 'PROCESSING') {
    //             await Transaction.updateOne({
    //                 order_code: orderCodeFromResult,
    //                 user_id: userId
    //             }, {
    //                 status: 'failed'
    //             });
    
    //             // Revert payout status back to pending on timeout
    //             await PayoutEmployee.updateMany(
    //                 { _id: { $in: payoutIds } },
    //                 { status: 'pending' }
    //             );
    
    //             throw new Error('Payout processing timeout');
    //         }
    //         if (lastError) {
    //             // Revert payout status back to pending if there's an error
    //             if (payoutIds && payoutIds.length > 0) {
    //                 await PayoutEmployee.updateMany(
    //                     { _id: { $in: payoutIds } },
    //                     { status: 'pending' }
    //                 );
    //             }
    //             throw lastError;
    //         }
    //     } catch (error) {
    //         // Revert payout status back to pending if error occurs after transaction commit
    //         if (payoutIds && payoutIds.length > 0) {
    //             try {
    //                 const currentPayouts = await PayoutEmployee.find({
    //                     _id: { $in: payoutIds },
    //                     status: 'processing'
    //                 });
    //                 if (currentPayouts.length > 0) {
    //                     await PayoutEmployee.updateMany(
    //                         { _id: { $in: payoutIds }, status: 'processing' },
    //                         { status: 'pending' }
    //                     );
    //                 }
    //             } catch (revertError) {
    //                 console.error('Error reverting payout status:', revertError);
    //             }
    //         }
    
    //         if (session.inTransaction()) {
    //             await session.abortTransaction();
    //         }
    //         session.endSession();
    //         throw new Error(error.message);
    //     }
    // }
    
    // const sleep = ms => new Promise(res => setTimeout(res, ms));
    
    // getCashoutInfo = async (userId, timespan = 'day') => {
    //     try {
    //         const employee = await Employee.findOne({ user_id: userId });
    //         if (!employee) {
    //             throw new Error('Employee not found');
    //         }
    //         const employeeId = employee._id;
    
    //         let startDate;
    //         const now = new Date();
    //         if (timespan === 'day') {
    //             startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    //         }
    //         else if (timespan === 'week') {
    //             startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    //         }
    //         else if (timespan === 'month') {
    //             startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    //         }
    //         else if (timespan === 'all') {
    //             const bills = await PayoutEmployee.find({
    //                 employee_id: employeeId
    //             });
    //             return bills.reduce((sum, bill) => sum + bill.total_amount, 0);
    //         }
    //         else {
    //             throw new Error('Invalid timespan');
    //         }
    //         const bills = await PayoutEmployee.find({
    //             employee_id: employeeId,
    //             created_at: { $gte: startDate }
    //         });
    //         return bills.reduce((sum, bill) => sum + bill.total_amount, 0);
    //     }
    //     catch (error) {
    //         throw new Error(error.message);
    //     }
    // };
    
    // availableCashout = async (userId) => {
    //   try {
    //         const employee = await Employee.findOne({ user_id: userId });
    //         if (!employee) {
    //             throw new Error('Employee not found');
    //         }
    //         const employeeId = employee._id;
    
    //         // Get available earnings that haven't been included in any payout yet
    //         const availableEarnings = await EmployeeEarning.find({
    //             employee_id: employeeId,
    //             status: 'available',
    //             payout_id: { $exists: false }
    //         });
    
    //         console.log("AVAILABLE EARNINGS:", availableEarnings);
    
    //         // Only include pending payouts (exclude processing ones as they are in progress)
    //         const pendingPayouts = await PayoutEmployee.find({
    //             employee_id: employeeId,
    //             status: 'pending'
    //         });
    
    //         console.log("PENDING PAYOUTS:", pendingPayouts);
    
    //         const availableAmount = availableEarnings.reduce((sum, earning) => {
    //             const amount = Number(earning.earning_amount) || 0;
    //             return sum + amount;
    //         }, 0);
    
    //         // 2. Tính Pending Amount: Sửa Math.round và ép kiểu Number
    //         const pendingAmount = pendingPayouts.reduce((sum, bill) => {
    //             const amount = Number(bill.total_amount) || 0; 
    //             return sum + Math.round(amount); // Math.round chỉ nhận 1 tham số
    //         }, 0);
    
    //         console.log("AVAILABLE AMOUNT:", availableAmount);
    //         console.log("PENDING AMOUNT:", pendingAmount);
    //         console.log("TOTAL CASHOUT AMOUNT:", availableAmount + pendingAmount);
    //         return availableAmount + pendingAmount;
    //     }
    //     catch (error) {
    //         throw new Error(error.message);
    //     }
    // };
}