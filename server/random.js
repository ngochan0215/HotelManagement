// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import connectDB from "./config/db.js";
// import { Receipt, Booking, EquipmentInstall, InstallDetail } from "./models/index.js";
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
//     try {
//         connectDB();
//         // 1. Lấy danh sách phiếu lắp đặt bị hủy (expired)
//         const expiredInstalls = await EquipmentInstall.find(
//             { status: "expired" },
//             { _id: 1 },
//         );

//         if (expiredInstalls.length === 0) {
//             return;
//         }

//         const installIds = expiredInstalls.map(i => i._id);

//         // 2. Xóa chi tiết tương ứng
//         const deleteResult = await InstallDetail.deleteMany(
//             {
//                 install_id: { $in: installIds },
//             },
//         );

//         console.log(
//             `[CLEANUP] Deleted ${deleteResult.deletedCount} equipment install details`
//         );
//     } catch (error) {
//         console.error("[CLEANUP] Failed to delete install details:", error);
//     }
// };

// runMigration();

