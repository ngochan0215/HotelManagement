import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import discountRoute from "./routes/discountRoute.js";
import voucherRoute from "./routes/voucherRoute.js";
import { connectDB } from "../../shared/config/database.js";
import { container } from "./containers/container.js";

dotenv.config();

const startServer = async () => {
    const app = express();

    app.use(cors());
    app.use(express.json());

    app.use((req, res, next) => {
        console.log("Discount-Service received:", req.method, req.url);
        next();
    });

    // connect database first
    await connectDB(process.env.DB_URL_);

    // initialize dependencies (RabbitMQ, event subscriptions)
    await container.init();

    app.use(discountRoute);
    app.use("/voucher", voucherRoute);

    const PORT = process.env.PORT || 3006;

    app.listen(PORT, () => {
        console.log(`Discount-Service running on ${PORT}`);
    });
};

startServer().catch(err => {
    console.error("Failed to start Discount-Service:", err);
    process.exit(1);
});