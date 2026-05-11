// import mongoose from "../../shared/config/mongoose.js";
// import dotenv from "dotenv";
// dotenv.config();

// console.log(process.env.OLD_URI);
// console.log(process.env.NEW_URI);

// const oldConn = await mongoose.createConnection(process.env.DB_URL_);
// const newConn = await mongoose.createConnection(process.env.DB_URL);

// // model cho DB cũ
// const OldImportTicket = oldConn.model(
//   "OldEquipmentLog",
//   new mongoose.Schema({}, { strict: false }),
//   "defaultequipments"
// );

// // model cho DB mới
// const NewImportTicket = newConn.model(
//   "NewEquipmentLog",
//   new mongoose.Schema({}, { strict: false }),
//   "defaultequipments"
// );

// // lấy data
// const data = await OldImportTicket.find();

// const newData = data.map(x => ({
//     _id: x._id,
//     category_id: x.category_id,
//     equipment_category_id: x.equipment_category_id,
//     quantity: x.quantity,
//     created_at: x.created_at,
//     updated_at: x.updated_at
// }));

// await NewImportTicket.insertMany(newData);

// console.log("done");

// process.exit();