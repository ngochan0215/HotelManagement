import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import Service from "./models/Service/Service.js";

dotenv.config();

const runMigration = async () => {
  try {
    connectDB();
    console.log("MongoDB connected");

    const result = await Service.updateMany(
      { storage_quantity: { $exists: false } },
      { $set: { storage_quantity: 0 } }
    );

    console.log(`Migration done. Updated ${result.modifiedCount} services`);
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB disconnected");
    process.exit(0);
  }
};

runMigration();
