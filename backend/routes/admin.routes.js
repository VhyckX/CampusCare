import { Router } from "express";
import { approveAdminAppointment, listAdminAppointments, setDoctorAvailability } from "../controllers/adminAppointment.controller.js";
import { requireAuthenticatedAdmin, requireCsrfToken } from "../middleware/adminAuth.js";

const router = Router();

router.get("/appointments", requireAuthenticatedAdmin, listAdminAppointments);
router.post(
  "/appointments/:appointmentRef/approve",
  requireAuthenticatedAdmin,
  requireCsrfToken,
  approveAdminAppointment
);
router.post(
  "/doctors/:doctorIdentifier/availability",
  requireAuthenticatedAdmin,
  requireCsrfToken,
  setDoctorAvailability
);

export default router;
