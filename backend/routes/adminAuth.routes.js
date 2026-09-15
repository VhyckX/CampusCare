import { Router } from "express";
import { currentAdmin, getCsrfToken, loginAdmin, logoutAdmin } from "../controllers/adminAuth.controller.js";
import { requireAuthenticatedAdmin, requireCsrfToken } from "../middleware/adminAuth.js";

const router = Router();

router.get("/csrf-token", getCsrfToken);
router.post("/login", loginAdmin);
router.get("/me", requireAuthenticatedAdmin, currentAdmin);
router.post("/logout", requireAuthenticatedAdmin, requireCsrfToken, logoutAdmin);

export default router;
