import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "../../shared/config/database.js";
import { container } from "./containers/container.js";
import equipmentRoute from "./routes/equipmentRoute.js";
import equipmentImportRoute from "./routes/equipmentImportRoute.js";
import equipmentInstallRoute from "./routes/equipmentInstallRoute.js";
import { startImportTicketJob, startInstallTicketJob } from "./jobs/ticketJob.js";

dotenv.config();

const startServer = async () => {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use((req, res, next) => {
        console.log("Equipment-Service received:", req.method, req.url);
        next();
    });

    // connect database first
    await connectDB(process.env.DB_URL);

    // initialize dependencies (RabbitMQ, event subscriptions)
    await container.init();
    startImportTicketJob();
    startInstallTicketJob();

    app.use(equipmentRoute);
    app.use("/tickets", equipmentImportRoute);
    app.use("/tickets", equipmentInstallRoute);

    const PORT = process.env.PORT || 3004;

    app.listen(PORT, () => {
        console.log(`Equipment-Service running on ${PORT}`);
    });
};

startServer().catch(err => {
    console.error("Failed to start Equipment-Service:", err);
    process.exit(1);
});