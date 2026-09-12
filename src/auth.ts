import type { Request, Response, NextFunction } from "express";
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.customerId) return res.status(401).json({ error: "unauthorized" });
  next();
}
