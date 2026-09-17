import { Router } from "express";
import { approveAdminAppointment, cancelAdminAppointment, completeAdminAppointment, listAdminAppointments, setDoctorAvailability } from "../controllers/adminAppointment.controller.js";
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
  "/appointments/:appointmentRef/cancel",
  requireAuthenticatedAdmin,
  requireCsrfToken,
  cancelAdminAppointment
);
router.post(
  "/appointments/:appointmentRef/complete",
  requireAuthenticatedAdmin,
  requireCsrfToken,
  completeAdminAppointment
);
router.post(
  "/doctors/:doctorIdentifier/availability",
  requireAuthenticatedAdmin,
  requireCsrfToken,
  setDoctorAvailability
);

export default router;
