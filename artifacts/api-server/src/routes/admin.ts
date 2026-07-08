import { Router, type IRouter } from "express";
import { z } from "zod";

const router: IRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// POST /api/admin/login
router.post("/admin/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const { username, password } = parsed.data;
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    req.log.error("ADMIN_USERNAME / ADMIN_PASSWORD not configured");
    res.status(500).json({ error: "Admin login is not configured" });
    return;
  }

  if (username === adminUsername && password === adminPassword) {
    req.session.isAdmin = true;
    res.json({ success: true });
    return;
  }

  res.status(401).json({ error: "Invalid username or password" });
});

// GET /api/admin/session
router.get("/admin/session", (req, res) => {
  res.json({ authenticated: Boolean(req.session?.isAdmin) });
});

// POST /api/admin/logout
router.post("/admin/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error(err);
      res.status(500).json({ error: "Failed to log out" });
      return;
    }
    res.clearCookie("kc_admin_sid");
    res.json({ success: true });
  });
});

export default router;
