import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "../../shared/config/database.js";
import { container } from "./containers/container.js";
import roomRoute from "./routes/roomRoute.js";
import roomCategoryRoute from "./routes/roomCategoryRoute.js";
import { startFixRoomLogsJob, startSyncRoomStatusJob } from "./jobs/roomJob.js";

dotenv.config();

const startServer = async () => {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use((req, res, next) => {
        console.log("Room-Service received:", req.method, req.url);
        next();
    });

    // connect database first
    await connectDB(process.env.DB_URL);

    // initialize dependencies (RabbitMQ, event subscriptions)
    await container.init();
    // startSyncRoomStatusJob();
    // startFixRoomLogsJob();

    app.use(roomRoute);
    app.use("/category", roomCategoryRoute);

    const PORT = process.env.PORT || 3005;

    app.listen(PORT, () => {
        console.log(`Room-Service running on ${PORT}`);
    });
};

startServer().catch(err => {
    console.error("Failed to start Room-Service:", err);
    process.exit(1);
});