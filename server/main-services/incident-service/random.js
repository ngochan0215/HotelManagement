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
//   "compensatedetails"
// );

// // model cho DB mới
// const NewImportTicket = newConn.model(
//   "NewEquipmentLog",
//   new mongoose.Schema({}, { strict: false }),
//   "compensatedetails"
// );

// // lấy data
// const data = await OldImportTicket.find();

// const newData = data.map(x => ({
//     _id: x._id,
//     ticket_id: x.ticket_id,
//     equipment_id: x.equipment_id,
//     broken_state: x.broken_state,
//     resolution: x.resolution,
//     penalty_fee: x.penalty_fee,
//     created_at: x.created_at,
//     updated_at: x.updated_at
// }));

// await NewImportTicket.insertMany(newData);

// console.log("done");

// process.exit();