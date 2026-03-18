import mongoose from "../config/mongoose.js";
// import { fileURLToPath } from "url";
// import { dirname, join } from "path";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// // Tìm .env file: thử trong server/ trước, sau đó thử parent directory
// dotenv.config({ path: join(__dirname, "../.env") });
// if (!process.env.DB_URI) {
//   dotenv.config({ path: join(__dirname, "../../.env") });
// }

export const connectDB = async (url) => {
    try {
        if (!url) 
            throw new Error("DATABASE CONNECTION ERROR: URI VARIABLE IS NOT FOUND.");

        await mongoose.connect(url, {
            serverSelectionTimeoutMS: 5000
        });

        console.log("MONGODB CONNECTED");
        //console.log("Mongoose connection readyState:", mongoose.connection.readyState);

    } catch (error) {
        console.error("DATABSE CONNECTION ERROR: " + error.message);
        process.exit(1);
    }
};