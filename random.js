// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import connectDB from "./config/db.js";
// import Discount from "./models/Booking/Discount.js";

// dotenv.config();

// const runMigration = async () => {
//   try {
//     connectDB();
//     console.log("MongoDB connected");

//     const result = await Discount.updateMany(
//       { stackable: { $exists: false } },
//       { $set: { stackable: true } }
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
