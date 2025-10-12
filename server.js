import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import http from "http"; 
import { Server } from "socket.io";
import connectDB from "./config/db.js";

import authRoute from "./routes/authRoutes.js";

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app); 
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use("/auth", authRoute);

app.set("io", io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { 
    console.log(` Server đang chạy tại http://localhost:${PORT}`);
});