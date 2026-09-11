import { Router } from "express";
import { cancelAppointment, createAppointment, lookupAppointment } from "../controllers/appointment.controller.js";

const router = Router();

router.post("/cancel", cancelAppointment);
router.post("/lookup", lookupAppointment);
router.post("/", createAppointment);

export default router;
