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

app.use(
  "/auth",
  createProxyMiddleware({
    target: "http://auth-service:3001",
    changeOrigin: true
  })
);

app.use(
  "/customer",
  createProxyMiddleware({
    target: "http://customer-service:3002",
    changeOrigin: true
  })
);

app.use(
  "/bookings",
  createProxyMiddleware({
    target: "http://localhost:3003",
    changeOrigin: true
  })
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API Gateway running on ${PORT}`);
});