import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { z } from "zod";
import { pool, query } from "./db.js";
import { requireAuth } from "./auth.js";

dotenv.config();
const app = express();
const port = Number(process.env.API_PORT || 3000);
const appOrigin = process.env.APP_ORIGIN || "http://localhost:8080";
const isProd = process.env.NODE_ENV === "production";
const PgStore = connectPgSimple(session);

if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: appOrigin, credentials: true }));
app.use(rateLimit({ windowMs: 15*60*1000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }));

app.use(session({
  name: process.env.COOKIE_NAME || "drhome_sid",
  store: new PgStore({ pool, tableName: "user_sessions", createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || "dev-only-change-me",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== "false" && isProd,
    sameSite: "lax",
    maxAge: 1000*60*60*24*30
  }
}));

app.get("/health", async (_req, res) => {
  await query("SELECT 1");
  res.json({ ok: true, service: "drhome-api" });
});

const loginSchema = z.object({
  email: z.string().email().transform(v => v.trim().toLowerCase()),
  password: z.string().min(4).max(200)
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });
  const result = await query<any>(
    `SELECT id,email,password_hash,first_name,last_name,phone,is_active
     FROM customers WHERE email=$1 LIMIT 1`, [parsed.data.email]
  );
  const customer = result.rows[0];
  if (!customer || !customer.is_active || !(await bcrypt.compare(parsed.data.password, customer.password_hash))) {
    return res.status(401).json({ error: "invalid_credentials" });
  }
  req.session.customerId = customer.id;
  res.json({ customer: { id: customer.id, email: customer.email, firstName: customer.first_name, lastName: customer.last_name, phone: customer.phone }});
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: "logout_failed" });
    res.clearCookie(process.env.COOKIE_NAME || "drhome_sid");
    res.json({ ok: true });
  });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const result = await query(`SELECT id,email,first_name,last_name,phone FROM customers WHERE id=$1`, [req.session.customerId]);
  res.json({ customer: result.rows[0] });
});

app.get("/api/properties", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT p.*, COALESCE((SELECT json_agg(mp ORDER BY mp.next_due_date NULLS LAST)
      FROM maintenance_plans mp WHERE mp.property_id=p.id),'[]'::json) AS maintenance
     FROM properties p WHERE p.customer_id=$1 ORDER BY p.created_at`, [req.session.customerId]
  );
  res.json({ properties: result.rows });
});

app.get("/api/appointments", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT a.*, p.name AS property_name FROM appointments a JOIN properties p ON p.id=a.property_id
     WHERE a.customer_id=$1 ORDER BY a.scheduled_date, a.time_from NULLS LAST`, [req.session.customerId]
  );
  res.json({ appointments: result.rows });
});

const appointmentSchema = z.object({
  propertyId: z.string().uuid(),
  maintenancePlanId: z.string().uuid().nullable().optional(),
  serviceType: z.string().min(2).max(120),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeFrom: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  timeTo: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

app.post("/api/appointments", requireAuth, async (req, res) => {
  const parsed = appointmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });
  const ownership = await query(`SELECT 1 FROM properties WHERE id=$1 AND customer_id=$2`, [parsed.data.propertyId, req.session.customerId]);
  if (!ownership.rowCount) return res.status(404).json({ error: "property_not_found" });
  const result = await query(
    `INSERT INTO appointments (customer_id,property_id,maintenance_plan_id,service_type,scheduled_date,time_from,time_to,status,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'requested',$8) RETURNING *`,
    [req.session.customerId, parsed.data.propertyId, parsed.data.maintenancePlanId || null, parsed.data.serviceType,
     parsed.data.scheduledDate, parsed.data.timeFrom || null, parsed.data.timeTo || null, parsed.data.notes || null]
  );
  res.status(201).json({ appointment: result.rows[0] });
});

app.use((_req,res)=>res.status(404).json({error:"not_found"}));
app.use((err:any,_req:any,res:any,_next:any)=>{ console.error(err); res.status(500).json({error:"internal_server_error"}); });
app.listen(port, "0.0.0.0", () => console.log(`DR HOME API listening on port ${port}`));
