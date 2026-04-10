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
//   "roomcancellations"
// );

// // model cho DB mới
// const NewImportTicket = newConn.model(
//   "NewEquipmentLog",
//   new mongoose.Schema({}, { strict: false }),
//   "bookingcancellations"
// );

// // lấy data
// const data = await OldImportTicket.find();

// const newData = data.map(x => ({
//     _id: x._id,
//     booking_id: x.booking_id,
//     room_id: x.room_id,
//     cancelled_by: x.cancelled_by,
//     cancelled_by_user: x.cancelled_by_user,
//     booking_status: x.booking_status,
//     reason: x.reason,
//     cancelled_at: x.cancelled_at,
//     penalty_fee: x.penalty_fee,
//     refund_amount: x.refund_amount,
//     created_at: x.created_at,
//     updated_at: x.updated_at
// }));

// await NewImportTicket.insertMany(newData);

// console.log("done");

// process.exit();