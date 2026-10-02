import bcrypt from "bcryptjs";
import { pool } from "../src/db.js";

// Mock site data
const sites = [
  { name: "Maple Street", address: null },
  { name: "Harbor View", address: null },
  { name: "Oak Ridge", address: null },
];

// Test user data
const users = [
  { email: "admin@ras.test", password: "Admin123!", role: "admin", firstName: "Dana", lastName: "Admin" },
  { email: "framer1@ras.test", password: "Framer123!", role: "framer", firstName: "Sam", lastName: "Carter" },
  { email: "framer2@ras.test", password: "Framer123!", role: "framer", firstName: "Jordan", lastName: "Lee" },
];

// Skip if already seeded
for (const s of sites) {
  await pool.query(
    "INSERT INTO sites (site_name, address) VALUES ($1, $2) ON CONFLICT (site_name) DO NOTHING",
    [s.name, s.address]
  );
}

for (const u of users) {
  const passwordHash = await bcrypt.hash(u.password, 10);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, role, first_name, last_name)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING`,
    [u.email, passwordHash, u.role, u.firstName, u.lastName]
  );
  console.log(`${u.email}: ${result.rowCount ? "created" : "already exists"}`);
}

await pool.end();
console.log("Seed finished.");
