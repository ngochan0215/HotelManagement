import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import http from "http"; 
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import { startImportTicketJob, startInstallTicketJob, startGoodTicketJob, startCustomerTierJob,
    startServiceUsageJob, startCancelCheckinLateBookingJob, startCancelPendingBookingJob 
} from "./config/importTicket.job.js";

import authRoute from "./routes/authRoutes.js";
import userRoute from "./routes/userRoutes.js";
import managerRoute from "./routes/managerRoutes.js";
import employeeRoute from "./routes/employeeRoutes.js";
import customerRoute from "./routes/customerRoutes.js";
import incidentRoute from "./routes/incidentRoutes.js";
import receiptRoute from "./routes/receiptRoutes.js";

import serviceRoute from  "./routes/serviceRoutes.js";
import discountRoute from "./routes/discountRoutes.js";
import roomRoute from "./routes/roomRoutes.js";
import roomCategoryRoute from "./routes/roomCategoryRoutes.js";
import equipmentRoute from "./routes/equipmentRoutes.js";
import bookingRoute from "./routes/bookingRoutes.js";
import statisticRoute from "./routes/statisticsRoutes.js";
import qrRoute from "./routes/qrRoutes.js";

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
app.use("/manager", managerRoute);
app.use("/employee", employeeRoute);
app.use("/customer", customerRoute);
app.use("/receipt", receiptRoute);
app.use("/statistics", statisticRoute);
app.use("/service", serviceRoute);
app.use("/discount", discountRoute);
app.use("/room", roomRoute);
app.use("/room-category", roomCategoryRoute);
app.use("/equipment", equipmentRoute);
app.use("/booking", bookingRoute);
app.use("/incident", incidentRoute);
app.use("/qr", qrRoute);
app.use("/avatars", express.static("avatars"));

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// app.use(express.static(path.join(__dirname, "../client/dist")));

// app.get("*", (req, res) => {
//   res.sendFile(
//     path.join(__dirname, "../client/dist/index.html")
//   );
// });

startImportTicketJob();
startInstallTicketJob();
startGoodTicketJob();
startServiceUsageJob();
startCancelPendingBookingJob();
startCancelCheckinLateBookingJob();
startCustomerTierJob();

app.set("io", io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { 
    console.log(` Server đang chạy tại http://localhost:${PORT}`);
});