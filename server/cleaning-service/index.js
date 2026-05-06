import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cleaningRoute from "./routes/cleaningRoute.js";
import { connectDB } from "/shared/config/database.js";
import { container } from "./containers/container.js";

dotenv.config();

const startServer = async () => {
    const app = express();

    app.use(cors());
    app.use(express.json());

    await connectDB(process.env.DB_URL);
    await container.init();

    app.use(cleaningRoute);

    const PORT = process.env.PORT || 3004;
    app.listen(PORT, () => {
        console.log(`Cleaning-Service running on ${PORT}`);
    });
};

startServer().catch(err => {
    process.exit(1);
});