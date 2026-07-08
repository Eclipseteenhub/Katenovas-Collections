import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session?.isAdmin) {
    next();
    return;
  }
  res.status(401).json({ error: "Admin authentication required" });
}
