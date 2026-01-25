// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import { fileURLToPath } from "url";
// import { dirname, join } from "path";
// import { Room, RoomLog, RoomStatusLog } from "../models/index.js";
// import connectDB from "../config/db.js";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// // Load .env file
// dotenv.config({ path: join(__dirname, "../../.env") });

// /**
//  * Script migration: Cập nhật tất cả phòng (trừ 6 phòng được chỉ định và phòng mới tạo) về trạng thái available
//  * Phòng không đụng: 203, 202, 401, 404, 302, 501
//  */
// const migrateRoomsToAvailable = async () => {
//   try {
//     await connectDB();
//     console.log("Đã kết nối database");

//     const now = new Date();
//     const excludedRoomNumbers = ["203", "202", "401", "404", "302", "501"];

//     // Tìm tất cả phòng trừ 6 phòng được chỉ định và trừ phòng mới tạo (status = "new")
//     const rooms = await Room.find({
//       room_number: { $nin: excludedRoomNumbers },
//       room_status: "available"
//     });

//     console.log(`Tìm thấy ${rooms.length} phòng cần cập nhật`);

//     if (rooms.length === 0) {
//       console.log("Không có phòng nào cần cập nhật");
//       await mongoose.connection.close();
//       process.exit(0);
//     }

//     let successCount = 0;
//     let errorCount = 0;

//     for (const room of rooms) {
//       try {
//         const session = await mongoose.startSession();
//         session.startTransaction();

//         try {
//           // 1. Cập nhật room.room_status thành "available"
//           room.start_time = null;
//           room.end_time = null;
//           await room.save({ session });

//           // 2. Đóng tất cả log cũ (nếu có) - RoomLog (bảng chính)
//         //   await RoomLog.updateMany(
//         //     {
//         //       room_id: room._id,
//         //       end_time: null
//         //     },
//         //     { $set: { end_time: now } },
//         //     { session }
//         //   );

//         //   // 3. Đóng tất cả log cũ (nếu có) - RoomStatusLog (bảng dự phòng)
//         //   await RoomStatusLog.updateMany(
//         //     {
//         //       room_id: room._id,
//         //       end_time: null
//         //     },
//         //     { $set: { end_time: now } },
//         //     { session }
//         //   );

//         //   // 4. Tạo log available mới - RoomLog (bảng chính)
//         //   await RoomLog.create(
//         //     [{
//         //       room_id: room._id,
//         //       status: "available",
//         //       start_time: now,
//         //       end_time: null,
//         //       note: "Migration: Cập nhật phòng về trạng thái available",
//         //       handled_by: null
//         //     }],
//         //     { session }
//         //   );

//         //   // 5. Tạo log available mới - RoomStatusLog (bảng dự phòng)
//         //   await RoomStatusLog.create(
//         //     [{
//         //       room_id: room._id,
//         //       status: "available",
//         //       start_time: now,
//         //       end_time: null,
//         //       note: "Migration: Cập nhật phòng về trạng thái available",
//         //       handled_by: null
//         //     }],
//         //     { session }
//         //   );

//           await session.commitTransaction();
//           session.endSession();

//           successCount++;
//           console.log(`✓ Đã cập nhật phòng ${room.room_number} (${room._id})`);
//         } catch (error) {
//           await session.abortTransaction();
//           session.endSession();
//           throw error;
//         }
//       } catch (error) {
//         errorCount++;
//         console.error(`✗ Lỗi khi cập nhật phòng ${room.room_number} (${room._id}):`, error.message);
//       }
//     }

//     console.log("\n=== KẾT QUẢ MIGRATION ===");
//     console.log(`Tổng số phòng: ${rooms.length}`);
//     console.log(`Thành công: ${successCount}`);
//     console.log(`Lỗi: ${errorCount}`);
//     console.log("========================");

//     await mongoose.connection.close();
//     process.exit(0);
//   } catch (error) {
//     console.error("Lỗi migration:", error);
//     await mongoose.connection.close();
//     process.exit(1);
//   }
// };

// // Chạy migration
// migrateRoomsToAvailable();
