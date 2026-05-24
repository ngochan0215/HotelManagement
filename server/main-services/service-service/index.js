import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "../../shared/config/database.js";
import { container } from "./containers/container.js";
import serviceRoute from "./routes/serviceRoute.js";
import { startGoodTicketJob, startServiceUsageJob } from "./jobs/serviceTicketJob.js";

dotenv.config();

const startServer = async () => {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use((req, res, next) => {
        console.log("Service-Service received:", req.method, req.url);
        next();
    });

    await connectDB(process.env.DB_URL);
    await container.init();

    startGoodTicketJob();
    startServiceUsageJob();

    app.use(serviceRoute);

    const PORT = process.env.PORT || 3012;
    app.listen(PORT, () => {
        console.log(`Service-Service running on ${PORT}`);
    });
};

startServer().catch((err) => {
    console.error("Failed to start Service-Service:", err);
    process.exit(1);
});
