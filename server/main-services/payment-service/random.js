// import mongoose from "../../shared/config/mongoose.js";
// import dotenv from "dotenv";
// dotenv.config();

// console.log(process.env.DB_URL_);
// console.log(process.env.DB_URL);

// const oldConn = await mongoose.createConnection(process.env.DB_URL_);
// const newConn = await mongoose.createConnection(process.env.DB_URL);

// // model cho DB cũ
// const OldImportTicket = oldConn.model(
//   "OldEquipmentLog",
//   new mongoose.Schema({}, { strict: false }),
//   "receipts"
// );

// // model cho DB mới
// const NewImportTicket = newConn.model(
//   "NewEquipmentLog",
//   new mongoose.Schema({}, { strict: false }),
//   "receipts"
// );

// // lấy data
// const data = await OldImportTicket.find();

// const newData = data.map(x => ({
//     _id: x._id,
//     booking_id: x.booking_id,
//     transaction_id: x.transaction_id,
//     discount_id: x.discount_id,
//     discount_snapshot: x.discount_snapshot,
//     employee_id: x.employee_id,
//     service_usage_id: x.service_usage_id,
//     compensate_ticket_id: x.compensate_ticket_id,
//     base_room_fee: x.base_room_fee,
//     total_fee: x.total_fee,
//     service_fee: x.service_fee,
//     compensate_fee: x.compensate_fee,
//     deposit_amount: x.deposit_amount,
//     final_amount: x.final_amount,
//     amount_due: x.amount_due,
//     payment: x.payment,
//     status: x.status,
//     paid_at: x.paid_at,
//     cancelled_at: x.cancelled_at,
//     note: x.note,
//     created_at: x.created_at,
//     updated_at: x.updated_at
// }));

// await NewImportTicket.insertMany(newData);

// console.log("done");

// process.exit();