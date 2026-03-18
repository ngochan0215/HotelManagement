import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import employeeRoute from "./routes/employeeRoute.js";
import { connectDB } from "../shared/config/database.js";
import { container } from "./containers/container.js";

dotenv.config();

const startServer = async () => {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use((req, res, next) => {
        console.log("Employee-Service received:", req.method, req.url);
        next();
    });

    // connect database first
    await connectDB(process.env.DB_URL);

    // initialize dependencies (RabbitMQ, event subscriptions)
    await container.init();

    app.use(employeeRoute);

    const PORT = process.env.PORT || 3003;

    app.listen(PORT, () => {
        console.log(`Employee-Service running on ${PORT}`);
    });
};

startServer().catch(err => {
    console.error("Failed to start Employee-Service:", err);
    process.exit(1);
});