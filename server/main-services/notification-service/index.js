import express from "express";
import cors from "cors";
import { createServer } from "http";
import { initSocket } from "./socket/initSocket.js";
import dotenv from "dotenv";
import { connectDB } from "../../shared/config/database.js";
import notificationRoute from "./routes/notificationRoute.js";
import { container } from "./containers/container.js";

dotenv.config();

const startServer = async () => {
    const app = express();
    const httpServer = createServer(app);

    app.use(cors());
    app.use(express.json());

    app.use((req, res, next) => {
        console.log("Notification-Service received:", req.method, req.url);
        next();
    });

    await connectDB(process.env.DB_URL_);
    await initSocket(httpServer);
    await container.init();

    app.use(notificationRoute);

    const PORT = process.env.PORT || 3007;
    httpServer.listen(PORT, () => {
        console.log(`Notification-Service running on ${PORT}`);
    });
}

startServer().catch(err => {
    console.error("Failed to start Notification-Service:", err);
    process.exit(1);
});