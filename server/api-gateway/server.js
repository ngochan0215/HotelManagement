import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";

dotenv.config();

const app = express();

app.use(cors());

app.use((req, res, next) => {
  console.log("Gateway received:", req.method, req.url);
  next();
});

app.use("/auth", createProxyMiddleware({ target: "http://auth-service:3001", changeOrigin: true }));
app.use("/customer", createProxyMiddleware({ target: "http://customer-service:3002", changeOrigin: true }));
app.use("/employee", createProxyMiddleware({ target: "http://employee-service:3003", changeOrigin: true }));

const oldServerTarget = "http://host.docker.internal:5000";

const oldRoutes = [
  "/manager", "/user", "/receipt", "/statistics", "/service",
  "/discount", "/room", "/room-category", "/equipment",
  "/booking", "/incident", "/qr", "/notification"
];

oldRoutes.forEach((route) => {
  app.use(route, createProxyMiddleware({ target: oldServerTarget, changeOrigin: true }));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API Gateway running on ${PORT}`);
});