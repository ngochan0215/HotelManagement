// // import mongoose from "mongoose";
// // import dotenv from "dotenv";
// // import connectDB from "./config/db.js";
// // import { recalcServiceUsageStatus } from "./controllers/serviceController.js";
// // import { Equipment } from "./models/index.js";
// // dotenv.config();

// // // const run = async () => {
// // //   try {
// // //     await connectDB();

// // //     const ticket_id = "69548ef89c71b8ecfe5bc5df";

// // //     await recalcServiceUsageStatus(ticket_id);

// // //     console.log("DONE");
// // //     process.exit(0);
// // //   } catch (err) {
// // //     console.error(err);
// // //     process.exit(1);
// // //   }
// // // };

// // // run();

// const runMigration = async () => {
//   try {
//     connectDB();
//     console.log("MongoDB connected");

//     const result = await Equipment.updateMany(
//   { status: "installing" },
//   { $set: { status: "in-stock" } }
// );


//     console.log(`Migration done. Updated ${result.modifiedCount} services`);
//   } catch (err) {
//     console.error("Migration failed:", err);
//   } finally {
//     await mongoose.disconnect();
//     console.log("MongoDB disconnected");
//     process.exit(0);
//   }
// };

// runMigration();

