import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import http from "http"; 
import { Server } from "socket.io";
import connectDB from "./config/db.js";

import authRoute from "./routes/authRoutes.js";
import userRoute from "./routes/userRoutes.js";
import adminRoute from "./routes/adminRoutes.js";
import serviceRoute from  "./routes/serviceRoutes.js";
import discountRoute from "./routes/discountRoutes.js";
import roomRoute from "./routes/roomRoutes.js";
import equipmentRoute from "./routes/equipmentRoutes.js";

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
app.use("/user", userRoute);
app.use("/admin", adminRoute);
app.use("/service-category", serviceRoute);
app.use("/discount", discountRoute);
app.use("/room", roomRoute);
app.use("/equipment", equipmentRoute);

app.set("io", io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { 
    console.log(` Server đang chạy tại http://localhost:${PORT}`);
});