import { randomBytes, timingSafeEqual } from "node:crypto";
import ClinicAdmin from "../models/clinicAdmin.model.js";

export function issueCsrfToken(req) {
  const token = randomBytes(32).toString("hex");
  req.session.csrfToken = token;
  return token;
}

function safeTokenMatch(actual, expected) {
  if (!actual || !expected || actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function requireCsrfToken(req, res, next) {
  const suppliedToken = String(req.get("X-CSRF-Token") || "");
  const sessionToken = String(req.session?.csrfToken || "");

  if (!safeTokenMatch(suppliedToken, sessionToken)) {
    return res.status(403).json({
      success: false,
      message: "Invalid CSRF token."
    });
  }

  next();
}

export async function requireAuthenticatedAdmin(req, res, next) {
  res.set("Cache-Control", "no-store");

  try {
    const adminAccountId = req.session?.adminAccountId;

    if (!adminAccountId) {
      return res.status(401).json({
        success: false,
        message: "Clinic admin login is required."
      });
    }

    const admin = await ClinicAdmin.findById(adminAccountId)
      .select("name email active")
      .maxTimeMS(8000)
      .lean();

    if (!admin || !admin.active) {
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        message: "Clinic admin login is required."
      });
    }

    req.authenticatedAdmin = {
      accountId: String(admin._id),
      name: admin.name,
      email: admin.email
    };

    next();
  } catch (error) {
    next(error);
  }
}
