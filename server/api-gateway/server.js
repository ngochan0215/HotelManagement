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
  "/employee",
  createProxyMiddleware({
    target: "http://employee-service:3003",
    changeOrigin: true
  })
);

app.use(
  "/equipment",
  createProxyMiddleware({
    target: "http://equipment-service:3004",
    changeOrigin: true
  })
);

app.use(
  "/room",
  createProxyMiddleware({
    target: "http://room-service:3005",
    changeOrigin: true
  })
);

app.use(
  "/discount",
  createProxyMiddleware({
    target: "http://discount-service:3006",
    changeOrigin: true
  })
);

app.use(
  "/notification",
  createProxyMiddleware({
    target: "http://notification-service:3007",
    changeOrigin: true
  })
);

app.use(
  "/incident",
  createProxyMiddleware({
    target: "http://incident-service:3008",
    changeOrigin: true
  })
);

app.use(
  "/booking",
  createProxyMiddleware({
    target: "http://booking-service:3009",
    changeOrigin: true
  })
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API Gateway running on ${PORT}`);
});