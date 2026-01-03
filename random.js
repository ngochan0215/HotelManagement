// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import connectDB from "./config/db.js";
// import { recalcServiceUsageStatus } from "./controllers/serviceController.js";
// import { Equipment, EquipmentCategory } from "./models/index.js";
// dotenv.config();

// // run();

// const runMigration = async () => {
//   try {
//     connectDB();
//     console.log("MongoDB connected");

//     const result = await EquipmentCategory.updateMany(
//         { is_critical: { $exists: false } },
//         { $set: { is_critical: false } }
//     );

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

