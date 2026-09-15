import express from "express";
import "./config/env.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import adminAuthRoutes from "./routes/adminAuth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import catalogRoutes from "./routes/catalog.routes.js";
import healthRoutes from "./routes/health.routes.js";
import { createSessionMiddleware } from "./config/session.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicRoot = resolve(__dirname, "..");
const publicPages = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/appointment.html", "appointment.html"],
  ["/status.html", "status.html"],
  ["/services.html", "services.html"],
  ["/admin-login.html", "admin-login.html"],
  ["/admin-dashboard.html", "admin-dashboard.html"]
]);

const app = express();
let sessionMiddleware;

export function configureSessionMiddleware(customMiddleware) {
  sessionMiddleware = customMiddleware || createSessionMiddleware();
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
app.use("/api/admin", adminRoutes);

app.use("/css", express.static(resolve(publicRoot, "css"), {
  index: false
}));
app.use("/js", express.static(resolve(publicRoot, "js"), {
  index: false
}));
app.use("/images", express.static(resolve(publicRoot, "images"), {
  index: false
}));

app.get(Array.from(publicPages.keys()), (req, res) => {
  res.sendFile(resolve(publicRoot, publicPages.get(req.path)));
});

app.use((req, res) => {
  if (!req.path.startsWith("/api")) {
    return res.status(404).type("text/plain").send("Page not found");
  }

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
