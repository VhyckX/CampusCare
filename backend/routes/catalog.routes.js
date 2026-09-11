import { Router } from "express";
import { getDoctors, getServices } from "../controllers/catalog.controller.js";

const router = Router();

router.get("/services", getServices);
router.get("/doctors", getDoctors);

export default router;
