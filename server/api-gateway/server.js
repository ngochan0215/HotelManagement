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
  "/users",
  createProxyMiddleware({
    target: "http://auth-service:3001",
    changeOrigin: true
  })
);

app.use(
  "/customers",
  createProxyMiddleware({
    target: "http://customer-service:3002",
    changeOrigin: true
  })
);

app.use(
  "/employees",
  createProxyMiddleware({
    target: "http://employee-service:3003",
    changeOrigin: true
  })
);

app.use(
  "/equipments",
  createProxyMiddleware({
    target: "http://equipment-service:3004",
    changeOrigin: true
  })
);

app.use(
  "/rooms",
  createProxyMiddleware({
    target: "http://room-service:3005",
    changeOrigin: true
  })
);

app.use(
  "/discounts",
  createProxyMiddleware({
    target: "http://discount-service:3006",
    changeOrigin: true
  })
);

app.use(
  "/notifications",
  createProxyMiddleware({
    target: "http://notification-service:3007",
    changeOrigin: true
  })
);

app.use(
  "/incidents",
  createProxyMiddleware({
    target: "http://incident-service:3008",
    changeOrigin: true
  })
);

app.use(
  "/bookings",
  createProxyMiddleware({
    target: "http://booking-service:3009",
    changeOrigin: true
  })
);

app.use(
  "/payments",
  createProxyMiddleware({
    target: "http://payment-service:3010",
    changeOrigin: true
  })
);

app.use(
  "/cleaning-tasks",
  createProxyMiddleware({
    target: "http://cleaning-service:3011",
    changeOrigin: true
  })
);

app.use(
  "/services",
  createProxyMiddleware({
    target: "http://service-service:3012",
    changeOrigin: true
  })
);

app.use(
  "/attractions",
  createProxyMiddleware({
    target: "http://attraction-service:3013",
    changeOrigin: true
  })
);

app.use(
  "/chat",
  createProxyMiddleware({
    target: "http://chat-service:3014",
    changeOrigin: true,
    // Forward WebSocket upgrades so Socket.io works through the gateway
    ws: true,
  })
);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API Gateway running on ${PORT}`);
});