import express from "express";
import cors from "cors";
import { createServer } from "http";
import dotenv from "dotenv";
import { connectDB } from "../../shared/config/database.js";
import { container } from "./containers/container.js";
import { initSocket } from "./socket/initSocket.js";
import chatRoute from "./routes/chatRoute.js";

dotenv.config();

const startServer = async () => {
    const app = express();
    const httpServer = createServer(app);

    app.use(cors());
    app.use(express.json());

    app.use((req, res, next) => {
        console.log("Chat-service received:", req.method, req.url);
        next();
    });

    await connectDB(process.env.DB_URL);
    await container.init();
    await initSocket(httpServer, container.chatService, container.botService);

    app.use(chatRoute);

    const PORT = process.env.PORT || 3014;
    httpServer.listen(PORT, () => {
        console.log(`Chat-Service running on ${PORT}`);
    });
};

startServer().catch(err => {
    console.error("Failed to start Chat-Service:", err);
    process.exit(1);
});
