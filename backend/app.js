import express from "express";
import "./config/env.js";
import adminAuthRoutes from "./routes/adminAuth.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import catalogRoutes from "./routes/catalog.routes.js";
import healthRoutes from "./routes/health.routes.js";
import { configureDnsServers } from "./config/dns.js";
import { createSessionMiddleware } from "./config/session.js";

configureDnsServers();

const app = express();
let sessionMiddleware;

export function configureSessionMiddleware() {
  sessionMiddleware = createSessionMiddleware();
}

app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : 0);

app.use((req, res, next) => {
  const allowedOrigins = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const requestOrigin = req.get("Origin");

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.set("Access-Control-Allow-Origin", requestOrigin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type,X-CSRF-Token");
    res.set("Access-Control-Allow-Credentials", "true");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  if (!sessionMiddleware) {
    return next(new Error("Session middleware is not configured."));
  }

  return sessionMiddleware(req, res, next);
});

app.use("/api/health", healthRoutes);
app.use("/api", catalogRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/admin-auth", adminAuthRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled server error.");
  res.status(500).json({
    success: false,
    message: "Something went wrong on the server"
  });
});

export default app;
