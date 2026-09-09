import mongoose from "mongoose";

function collectErrorDetails(error) {
  const details = [];
  const seen = new Set();
  const queue = [error];

  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    details.push({
      name: current.name,
      code: current.code,
      message: current.message
    });

    if (current.cause) queue.push(current.cause);

    if (current.reason?.servers instanceof Map) {
      current.reason.servers.forEach((server) => {
        if (server?.error) queue.push(server.error);
      });
    }

    if (current.errors && typeof current.errors === "object") {
      Object.values(current.errors).forEach((nestedError) => queue.push(nestedError));
    }
  }

  return details;
}

function getPrimaryErrorName(details) {
  const named = details.find((detail) => detail.name);
  return named ? named.name : "UnknownError";
}

function isSafeStringCode(code) {
  return typeof code === "string" && /^(ERR_[A-Z0-9_]+|CERT_[A-Z0-9_]+|[A-Z]+[A-Z0-9_]+)$/.test(code);
}

function getSafeCode(details) {
  const coded = details.find((detail) => typeof detail.code === "number" || isSafeStringCode(detail.code));
  return coded ? coded.code : "none";
}

function getDiagnosticCategory(details, mongoUri) {
  const text = details.map((detail) => {
    return [detail.name, detail.code, detail.message].filter(Boolean).join(" ");
  }).join(" ").toLowerCase();

  if (!mongoUri || text.includes("mongoparseerror") || text.includes("invalid scheme") || text.includes("invalid connection string") || text.includes("uri malformed")) {
    return "malformed URI";
  }

  if (text.includes("authentication failed") || text.includes("bad auth") || text.includes("auth failed") || text.includes("code 8000")) {
    return "authentication";
  }

  if (text.includes("not authorized") || text.includes("unauthorized")) {
    return "permissions";
  }

  if (text.includes("enotfound") || text.includes("enodata") || text.includes("eai_again") || text.includes("querysrv") || text.includes("getaddrinfo")) {
    return "DNS";
  }

  if (text.includes("tls") || text.includes("ssl") || text.includes("certificate")) {
    return "TLS";
  }

  if (text.includes("etimedout") || text.includes("econnrefused") || text.includes("econnreset") || text.includes("serverselectionerror") || text.includes("timed out") || text.includes("server selection")) {
    return "network/timeout";
  }

  return "unknown";
}

function getSanitizedExplanation(category) {
  const explanations = {
    "malformed URI": "Check that the MongoDB connection string is complete and correctly formatted.",
    authentication: "Check the Atlas database username and password.",
    permissions: "Check the Atlas database user's permissions.",
    DNS: "Check DNS resolution for the MongoDB Atlas hostname.",
    TLS: "Check local certificate, TLS, system time, antivirus, proxy, or network inspection settings.",
    "network/timeout": "Check internet access, Atlas network access, firewall, and connection timeout.",
    unknown: "Check the backend environment and MongoDB Atlas connection settings."
  };

  return explanations[category] || explanations.unknown;
}

export async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MongoDB connection failed. Category: malformed URI. Code: none.");
  }

  try {
    await mongoose.connect(mongoUri, {
      dbName: "campuscare",
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 10000
    });

    console.log("MongoDB connected");
  } catch (error) {
    const details = collectErrorDetails(error);
    const category = getDiagnosticCategory(details, mongoUri);
    const errorName = getPrimaryErrorName(details);
    const safeCode = getSafeCode(details);
    const explanation = getSanitizedExplanation(category);
    throw new Error("MongoDB connection failed. Error: " + errorName + ". Category: " + category + ". Code: " + safeCode + ". " + explanation);
  }
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}
