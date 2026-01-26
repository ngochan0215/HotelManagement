// import mongoose from "mongoose";
// import { config } from "dotenv";
// import { fileURLToPath } from "url";
// import { dirname, join } from "path";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// // Load environment variables
// config({ path: join(__dirname, "../.env") });

// // Import models
// import EquipmentCategory from "../models/Equipment/EquipmentCategory.js";
// import Equipment from "../models/Equipment/Equipment.js";
// import connectDB from "../config/db.js";

// /**
//  * Đồng bộ lại storage_quantity và total_quantity cho tất cả EquipmentCategory
//  * 
//  * - total_quantity: Tổng số lượng thiết bị hiện tại (tất cả status)
//  * - storage_quantity: Số lượng thiết bị tồn kho (status="in-stock", condition in ["new", "good"], room_id=null)
//  */
// async function syncEquipmentCategoryQuantities() {
//   try {
//     connectDB();

//     // Lấy tất cả categories
//     const categories = await EquipmentCategory.find({});
//     console.log(`📦 Found ${categories.length} equipment categories`);

//     let updatedCount = 0;
//     const results = [];

//     for (const category of categories) {
//       const categoryId = category._id;

//       // Tính total_quantity: Tổng số lượng thiết bị hiện tại (tất cả status)
//       const totalQuantity = await Equipment.countDocuments({
//         category_id: categoryId
//       });

//       // Tính storage_quantity: Số lượng thiết bị tồn kho
//       // Điều kiện: status="in-stock", condition in ["new", "good"], room_id=null
//       const storageQuantity = await Equipment.countDocuments({
//         category_id: categoryId,
//         status: "in-stock",
//         condition: { $in: ["new", "good"] },
//         room_id: null
//       });

//       // Cập nhật category
//       const oldTotal = category.total_quantity || 0;
//       const oldStorage = category.storage_quantity || 0;

//       category.total_quantity = totalQuantity;
//       category.storage_quantity = storageQuantity;
//       await category.save();

//       updatedCount++;

//       // Log thay đổi nếu có
//       if (oldTotal !== totalQuantity || oldStorage !== storageQuantity) {
//         results.push({
//           category_id: categoryId,
//           category_name: category.name,
//           old_total: oldTotal,
//           new_total: totalQuantity,
//           old_storage: oldStorage,
//           new_storage: storageQuantity,
//           changed: oldTotal !== totalQuantity || oldStorage !== storageQuantity
//         });

//         console.log(`\n📊 Category: ${category.name}`);
//         console.log(`   Total: ${oldTotal} → ${totalQuantity} (${totalQuantity - oldTotal >= 0 ? '+' : ''}${totalQuantity - oldTotal})`);
//         console.log(`   Storage: ${oldStorage} → ${storageQuantity} (${storageQuantity - oldStorage >= 0 ? '+' : ''}${storageQuantity - oldStorage})`);
//       }
//     }

//     console.log(`\n✅ Sync completed! Updated ${updatedCount} categories`);
    
//     if (results.length > 0) {
//       console.log(`\n📋 Summary of changes:`);
//       results.forEach(r => {
//         if (r.changed) {
//           console.log(`   - ${r.category_name}: Total ${r.old_total}→${r.new_total}, Storage ${r.old_storage}→${r.new_storage}`);
//         }
//       });
//     } else {
//       console.log(`\n✨ All quantities are already in sync!`);
//     }

//     await mongoose.disconnect();
//     console.log("\n✅ Disconnected from MongoDB");
//     process.exit(0);

//   } catch (error) {
//     console.error("❌ Error syncing equipment category quantities:", error);
//     await mongoose.disconnect();
//     process.exit(1);
//   }
// }

// // Run the sync
// syncEquipmentCategoryQuantities();
