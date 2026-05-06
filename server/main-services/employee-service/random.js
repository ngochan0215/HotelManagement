// import mongoose from "../../shared/config/mongoose.js";
// import dotenv from "dotenv";
// dotenv.config();

// console.log(process.env.OLD_DB_URL);
// console.log(process.env.NEW_DB_URL);

// const oldConn = await mongoose.createConnection(process.env.OLD_DB_URL);
// const newConn = await mongoose.createConnection(process.env.NEW_DB_URL);

// // model cho DB cũ
// const OldSchedule = oldConn.model(
//   "schedules",
//   new mongoose.Schema({}, { strict: false }),
//   "schedules"
// );

// // model cho DB mới
// const NewSchedule = newConn.model(
//   "Schedule",
//   new mongoose.Schema({}, { strict: false }),
//   "schedules"
// );

// // lấy data
// const data = await OldSchedule.find();

// const newData = data.map(x => ({
//   _id: x._id,

//   contract_id: x.contract_id,
//   employee_id: x.employee_id,
//   shift_id: x.shift_id,

//   work_date: x.work_date,

//   role: x.role,

//   status: x.status,

//   note: x.note,

//   created_at: x.created_at,
//   updated_at: x.updated_at
// }));

// await NewSchedule.insertMany(newData);

// console.log("done");

// process.exit();