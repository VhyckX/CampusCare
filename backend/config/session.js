import session from "express-session";
import MongoStore from "connect-mongo";
import mongoose from "mongoose";

function parseBoolean(value) {
  return String(value || "").toLowerCase() === "true";
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (secret && secret.length >= 32) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be at least 32 characters in production.");
  }

  return "campuscare-local-development-session-secret";
}

function getSameSite() {
  const value = String(process.env.SESSION_COOKIE_SAMESITE || "lax").toLowerCase();
  return ["lax", "strict", "none"].includes(value) ? value : "lax";
}

export function createSessionMiddleware() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB must be connected before sessions are configured.");
  }

  const ttlMinutes = Number(process.env.SESSION_TTL_MINUTES || 120);
  const minimumTtlSeconds = process.env.NODE_ENV === "test" ? 1 : 60;
  const ttlSeconds = Math.max(minimumTtlSeconds, Math.floor(ttlMinutes * 60));
  const secureCookie = process.env.NODE_ENV === "production" || parseBoolean(process.env.SESSION_COOKIE_SECURE);
  const sameSite = getSameSite();

  return session({
    name: process.env.SESSION_COOKIE_NAME || "campuscare.sid",
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: MongoStore.create({
      clientPromise: Promise.resolve(mongoose.connection.getClient()),
      dbName: process.env.MONGODB_DB_NAME || "campuscare",
      collectionName: process.env.SESSION_COLLECTION_NAME || "admin_sessions",
      ttl: ttlSeconds,
      autoRemove: "native"
    }),
    cookie: {
      httpOnly: true,
      secure: secureCookie,
      sameSite,
      maxAge: ttlSeconds * 1000
    }
  });
}
