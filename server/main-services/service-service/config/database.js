import mongoose from "mongoose";

export const connectDB = async (uri) => {
  try {
    if (!uri) {
      throw new Error("DATABASE CONNECTION ERROR: URI VARIABLE IS NOT FOUND.");
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("MONGODB CONNECTED");
  } catch (error) {
    console.error("DATABSE CONNECTION ERROR:", error.message);
    throw error;
  }
};
