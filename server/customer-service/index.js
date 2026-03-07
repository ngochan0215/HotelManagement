import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import customerRoutes from "./routes/customerRoute.js"
import { connectDB } from "../shared/config/database.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log("Customer-Service received:", req.method, req.url);
    next();
});

app.use("/", customerRoutes);

const PORT = process.env.PORT || 3002;
connectDB(process.env.DB_URI);

app.listen(process.env.PORT, () => {
    console.log(`Customer-Service running on ${process.env.PORT}`);
});