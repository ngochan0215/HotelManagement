import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cleaningRoute from "./routes/cleaningRoute.js";
import { connectDB } from "../../shared/config/database.js";
import { container } from "./containers/container.js";

dotenv.config();

const startServer = async () => {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use((req, res, next) => {
        console.log("Cleaning-Service received:", req.method, req.url);
        next();
    });

    await connectDB(process.env.DB_URL);

    await container.init();

    app.use(cleaningRoute);

    const PORT = process.env.PORT || 3011;
    app.listen(PORT, () => {
        console.log(`Cleaning-Service running on ${PORT}`);
    });
};

startServer().catch(err => {
    console.error("Failed to start Cleaning-Service:", err);
    process.exit(1);
});