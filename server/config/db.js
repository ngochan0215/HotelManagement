import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tìm .env file: thử trong server/ trước, sau đó thử parent directory
dotenv.config({ path: join(__dirname, "../.env") });
if (!process.env.DB_URI) {
  dotenv.config({ path: join(__dirname, "../../.env") });
}

const connectDB = async () => {
    try {
        const mongoURI = process.env.DB_URI;
        if (!mongoURI) {
            throw new Error("Lỗi kết nối: biến môi trường DB_URI không được tìm thấy");
        }

        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log("Kết nối MongoDB thành công");
    } catch (error) {
        console.error("Lỗi kết nối MongoDB:", error.message);
        process.exit(1);
    }
};

export default connectDB;
