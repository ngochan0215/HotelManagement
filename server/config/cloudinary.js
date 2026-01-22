import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tìm .env file: thử trong server/ trước, sau đó thử parent directory
dotenv.config({ path: join(__dirname, "../.env") });
if (!process.env.CLOUDINARY_CLOUD_NAME) {
  dotenv.config({ path: join(__dirname, "../../.env") });
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;
