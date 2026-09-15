import "./config/env.js";
import app, { configureSessionMiddleware } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { configureDnsServers } from "./config/dns.js";

const PORT = process.env.PORT || 5000;
const DB_NAME = process.env.MONGODB_DB_NAME || "campuscare";

let server;

async function startServer() {
  try {
    configureDnsServers();
    await connectDatabase({ dbName: DB_NAME });
    configureSessionMiddleware();

    server = app.listen(PORT, () => {
      console.log(`CampusCare API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down CampusCare API.`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    console.error("Server shutdown failed.");
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();
