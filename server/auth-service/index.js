import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRoutes from "../routes/authRoutes.js";
import { connectDB } from "../shared/config/database.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);

const PORT = process.env.PORT || 3001;
connectDB(process.env.DB_URI);

app.listen(process.env.PORT, () => {
    console.log(`Auth-Service running on ${process.env.PORT}`);
});