// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import connectDB from "./config/db.js";
// import { Receipt, Booking } from "./models/index.js";
// import { fileURLToPath } from "url";
// import { dirname, join } from "path";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// // Tìm .env file: thử trong server/ trước, sau đó thử parent directory
// dotenv.config({ path: join(__dirname, "../.env") });
// if (!process.env.DB_URI) {
//   dotenv.config({ path: join(__dirname, "../../.env") });
// }

// const runMigration = async () => {
//   try {
//     connectDB();
//     console.log("MongoDB connected");

//     const cancelledBookings = await Booking.find(
//       {
//         status: { $in: ["cancelled", "expired"] },
//       },
//       { _id: 1 },
//     );

//     if (cancelledBookings.length === 0) {
//       return;
//     }

//     const bookingIds = cancelledBookings.map(b => b._id);

//     // 2. Update receipt tương ứng (chưa bị cancelled)
//     const result = await Receipt.updateMany(
//       {
//         booking_id: { $in: bookingIds },
//         status: { $ne: "cancelled" },
//       },
//       {
//         $set: {
//           status: "cancelled",
//           cancelled_at: new Date(),
//           note: "Tự động hủy do booking đã bị hủy",
//         },
//       },
//     );

//     console.log(
//       `[SYNC] Cancelled ${result.modifiedCount} receipts from cancelled bookings`
//     );
//   } catch (err) {
//     console.error("Migration failed:", err);
//   } finally {
//     await mongoose.disconnect();
//     console.log("MongoDB disconnected");
//     process.exit(0);
//   }
// };

// runMigration();

