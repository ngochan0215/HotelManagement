import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "../../shared/config/database.js";
import { container } from "./containers/container.js";
import { startReceiptSyncJob } from "./jobs/receiptJob.js";

import paymentRoute from "./routes/paymentRoute.js";
import receiptRoute from "./routes/receiptRoute.js";

dotenv.config();

const startServer = async () => {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use((req, res, next) => {
        console.log("Payment-Service received:", req.method, req.url);
        next();
    });

    await connectDB(process.env.DB_URL);
    await container.init();
    startReceiptSyncJob();

    app.use(paymentRoute);
    app.use("/receipts", receiptRoute);

    const PORT = process.env.PORT || 3010;
    app.listen(PORT, () => {
        console.log(`Payment-Service running on ${PORT}`);
    });
}

startServer().catch(err => {
    console.error("Failed to start Payment-Service:", err);
    process.exit(1);
});