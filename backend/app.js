import express from "express";
import healthRoutes from "./routes/health.routes.js";

const app = express();

app.use(express.json({ limit: "100kb" }));

app.use("/api/health", healthRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: "Something went wrong on the server"
  });
});

export default app;
