// import mongoose from "../shared/config/mongoose.js";
// import dotenv from "dotenv";
// dotenv.config();

// console.log(process.env.OLD_URI);
// console.log(process.env.NEW_URI);

// const oldConn = await mongoose.createConnection(process.env.OLD_URI);
// const newConn = await mongoose.createConnection(process.env.NEW_URI);

// // model cho DB cũ
// const OldImportTicket = oldConn.model(
//   "OldEquipmentLog",
//   new mongoose.Schema({}, { strict: false }),
//   "equipmentlogs"
// );

// // model cho DB mới
// const NewImportTicket = newConn.model(
//   "NewEquipmentLog",
//   new mongoose.Schema({}, { strict: false }),
//   "equipmentlogs"
// );

// // lấy data
// const data = await OldImportTicket.find();

// const newData = data.map(x => ({
//     _id: x._id,
//     room_id: x.room_id,
//     handled_by: x.handled_by,
//     equipment_id: x.equipment_id,
//     condition: x.condition,
//     status: x.status,
//     note: x.note,
//     start_time: x.start_time,
//     end_time: x.end_time,
//     created_at: x.created_at,
//     updated_at: x.updated_at
// }));

// await NewImportTicket.insertMany(newData);

// console.log("done");

// process.exit();