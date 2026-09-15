import { Router } from "express";
import { approveAdminAppointment, listAdminAppointments } from "../controllers/adminAppointment.controller.js";
import { requireAuthenticatedAdmin, requireCsrfToken } from "../middleware/adminAuth.js";

const router = Router();

router.get("/appointments", requireAuthenticatedAdmin, listAdminAppointments);
router.post(
  "/appointments/:appointmentRef/approve",
  requireAuthenticatedAdmin,
  requireCsrfToken,
  approveAdminAppointment
);

export default router;
