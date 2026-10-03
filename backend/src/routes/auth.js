import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// user's data to send to the front-end (except password_hash, is_active, etc.)
function toPublicUser(row) {
  return {
    id: String(row.user_id),
    email: row.email,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
  };
}

// POST /api/auth/login  { email, password } -> { token, user }
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT user_id, email, password_hash, role, first_name, last_name, is_active
       FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );
    const user = rows[0];

    // check if user exists, is active, and password matches
    const valid = user && user.is_active && (await bcrypt.compare(password, user.password_hash));
    if (!valid) {
       // message only invalid email or password is shown (to prevent account enumeration)
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Token expires in 8 hours and contains only user id, role
    const token = jwt.sign({ sub: String(user.user_id), role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "8h",
    });
    // return the token and user info
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error("Login failed:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/auth/me  (token needed) -> { user }  : if the token is valid, return the logged-in user's info
router.get("/me", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT user_id, email, role, first_name, last_name
       FROM users WHERE user_id = $1 AND is_active`,
      [req.user.id]
    );
    // if the user is not found or inactive, return 401 Unauthorized
    if (!rows[0]) return res.status(401).json({ error: "User not found or inactive" });
    // return the user's info
    res.json({ user: toPublicUser(rows[0]) });
  } catch (err) {
    console.error("/me failed:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
