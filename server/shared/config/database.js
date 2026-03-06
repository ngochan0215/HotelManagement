import mongoose from "mongoose";
// import { fileURLToPath } from "url";
// import { dirname, join } from "path";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// // Tìm .env file: thử trong server/ trước, sau đó thử parent directory
// dotenv.config({ path: join(__dirname, "../.env") });
// if (!process.env.DB_URI) {
//   dotenv.config({ path: join(__dirname, "../../.env") });
// }

export const connectDB = async (uri) => {
    try {
        if (!uri) 
            throw new Error("DATABASE CONNECTION ERROR: URI VARIABLE IS NOT FOUND.");

        await mongoose.connect(uri);

        console.log("MongoDB connected");

    } catch (error) {
        console.error("DATABSE CONNECTION ERROR: " + error.message);
        process.exit(1);
    }
};