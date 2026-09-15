import bcrypt from "bcrypt";
import ClinicAdmin from "../models/clinicAdmin.model.js";
import { issueCsrfToken } from "../middleware/adminAuth.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const loginAttempts = new Map();
const loginWindowMs = 15 * 60 * 1000;
const loginMaxAttempts = 5;

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLoginInput(body) {
  return {
    email: asTrimmedString(body.email).toLowerCase(),
    password: typeof body.password === "string" ? body.password : ""
  };
}

function validateLoginInput(input) {
  if (!input.email || input.email.length > 120 || !emailPattern.test(input.email)) {
    throw new ApiError(400, "A valid email and password are required.");
  }

  if (!input.password || input.password.length > 128) {
    throw new ApiError(400, "A valid email and password are required.");
  }
}

function checkLoginRateLimit(req, email) {
  const key = `${req.ip || req.socket?.remoteAddress || "unknown"}:${email}`;
  const now = Date.now();
  const current = loginAttempts.get(key);

  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + loginWindowMs });
    return;
  }

  if (current.count >= loginMaxAttempts) {
    throw new ApiError(429, "Too many login attempts. Please wait before trying again.");
  }

  current.count += 1;
}

function clearLoginRateLimit(req, email) {
  const key = `${req.ip || req.socket?.remoteAddress || "unknown"}:${email}`;
  loginAttempts.delete(key);
}

function publicAdminSession(admin) {
  return {
    accountId: String(admin._id),
    name: admin.name,
    email: admin.email
  };
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function getCsrfToken(req, res) {
  res.set("Cache-Control", "no-store");

  res.status(200).json({
    success: true,
    data: {
      csrfToken: issueCsrfToken(req)
    }
  });
}

export async function loginAdmin(req, res, next) {
  res.set("Cache-Control", "no-store");

  try {
    const input = normalizeLoginInput(req.body || {});
    validateLoginInput(input);
    checkLoginRateLimit(req, input.email);

    const admin = await ClinicAdmin.findOne({ email: input.email, active: true })
      .select("+passwordHash name email active")
      .maxTimeMS(8000);

    const passwordMatches = admin ? await bcrypt.compare(input.password, admin.passwordHash) : false;

    if (!admin || !passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    await regenerateSession(req);

    req.session.adminAccountId = String(admin._id);
    req.session.csrfToken = issueCsrfToken(req);

    admin.lastLoginAt = new Date();
    await Promise.all([admin.save(), saveSession(req)]);
    clearLoginRateLimit(req, input.email);

    res.status(200).json({
      success: true,
      message: "Clinic admin logged in successfully.",
      data: {
        admin: publicAdminSession(admin),
        csrfToken: req.session.csrfToken
      }
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    next(error);
  }
}

export function currentAdmin(req, res) {
  res.set("Cache-Control", "no-store");

  res.status(200).json({
    success: true,
    data: {
      admin: req.authenticatedAdmin
    }
  });
}

export async function logoutAdmin(req, res, next) {
  res.set("Cache-Control", "no-store");

  try {
    await destroySession(req);
    res.clearCookie(process.env.SESSION_COOKIE_NAME || "campuscare.sid");
    res.status(200).json({
      success: true,
      message: "Clinic admin logged out successfully."
    });
  } catch (error) {
    next(error);
  }
}
