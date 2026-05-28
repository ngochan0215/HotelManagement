import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import attractionRoute from "./routes/attractionRoute.js";
import { connectDB } from "../../shared/config/database.js";
import { container } from "./containers/container.js";
import { startSyncJob } from "./jobs/syncJob.js";

dotenv.config();

const startServer = async () => {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use((req, res, next) => {
        console.log("Attraction-Service received:", req.method, req.url);
        next();
    });

    await connectDB(process.env.DB_URL);

    await container.init();

    startSyncJob(container.syncService);

    app.use(attractionRoute);

    const PORT = process.env.PORT || 3013;
    app.listen(PORT, () => {
        console.log(`Attraction-Service running on ${PORT}`);
    });
};

startServer().catch(err => {
    console.error("Failed to start Attraction-Service:", err);
    process.exit(1);
});
