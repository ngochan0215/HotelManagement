import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "../../shared/config/database.js";
import { container } from "./containers/container.js";

import bookingRoute from "./routes/bookingRoute.js";
import reviewRoute from "./routes/reviewRoute.js";
import statisticRoute from "./routes/statisticRoute.js";

import {
    startCancelPendingBookingJob,
    startCancelCheckinLateBookingJob,
    startCheckinReminderJob,
    startCheckoutReminderJob,
    startDepositDeadlineReminderJob,
    startCheckinTimeReminderJob,
} from "./jobs/bookingJob.js";

dotenv.config();

const startServer = async () => {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use((req, res, next) => {
        console.log("Booking-Service received:", req.method, req.url);
        next();
    });

    await connectDB(process.env.DB_URL);
    await container.init();
    
    // cron job
    startCancelPendingBookingJob();
    startCancelCheckinLateBookingJob();
    startCheckinReminderJob();
    startCheckoutReminderJob();
    startDepositDeadlineReminderJob();
    startCheckinTimeReminderJob();

    app.use("/reviews", reviewRoute);
    app.use("/statistics", statisticRoute);
    app.use(bookingRoute);

    const PORT = process.env.PORT || 3009;
    app.listen(PORT, () => {
        console.log(`Booking-Service running on ${PORT}`);
    });
}

startServer().catch(err => {
    console.error("Failed to start Booking-Service:", err);
    process.exit(1);
});