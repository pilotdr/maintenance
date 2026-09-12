import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { query, pool } from "../src/db.js";
dotenv.config();

async function main() {
  if (process.env.SEED_DEMO !== "true") return;
  const email = (process.env.DEMO_EMAIL || "demo@drhome.ae").toLowerCase();
  const password = process.env.DEMO_PASSWORD || "ChangeMe123!";
  const hash = await bcrypt.hash(password, 12);
  const c = await query<any>(
    `INSERT INTO customers (email,password_hash,first_name,last_name,phone)
     VALUES ($1,$2,'Demo','Customer','0555662007')
     ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id`, [email, hash]
  );
  const customerId = c.rows[0].id;
  let p = await query<any>(`SELECT id FROM properties WHERE customer_id=$1 AND name='Opal Tower - Marina' LIMIT 1`, [customerId]);
  if (!p.rows[0]) {
    p = await query<any>(
      `INSERT INTO properties (customer_id,name,property_type,area,city,address_line,hero_image_url)
       VALUES ($1,'Opal Tower - Marina','Apartment','Dubai Marina','Dubai','Opal Tower, Dubai Marina','opal-tower-marina.jpg') RETURNING id`, [customerId]
    );
  }
  const propertyId = p.rows[0].id;
  let m = await query<any>(`SELECT id FROM maintenance_plans WHERE property_id=$1 AND title='AC Maintenance' LIMIT 1`, [propertyId]);
  if (!m.rows[0]) {
    m = await query<any>(
      `INSERT INTO maintenance_plans (property_id,title,description,interval_months,status,next_due_date)
       VALUES ($1,'AC Maintenance','Preventive AC Service',6,'confirmed','2026-09-23') RETURNING id`, [propertyId]
    );
  }
  const planId = m.rows[0].id;
  const a = await query(`SELECT 1 FROM appointments WHERE customer_id=$1 AND property_id=$2 AND scheduled_date='2026-09-23'`, [customerId,propertyId]);
  if (!a.rowCount) {
    await query(
      `INSERT INTO appointments (customer_id,property_id,maintenance_plan_id,service_type,scheduled_date,time_from,time_to,status,notes)
       VALUES ($1,$2,$3,'AC Maintenance','2026-09-23','10:00','12:00','confirmed','Demo appointment')`, [customerId,propertyId,planId]
    );
  }
  console.log(`Seed complete. Login: ${email}`);
}
main().finally(()=>pool.end());
