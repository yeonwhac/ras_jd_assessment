import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import authRoutes from "./routes/auth.js";
import siteRoutes from "./routes/sites.js";
import hazardRoutes from "./routes/hazards.js";
import submissionRoutes from "./routes/submissions.js";
import workerRoutes from "./routes/workers.js";
import summaryRoutes from "./routes/summary.js";

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const app = express();

// Only allow requests coming from the frontend (Next.js) origin
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());

// Health check: confirms the server and the database connection are alive (also used for monitoring after deployment)
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    console.error("Health check failed:", err.message);
    res.status(500).json({ status: "error", db: "unreachable" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/sites", siteRoutes);
app.use("/api/hazards", hazardRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/summary", summaryRoutes);

// Last resort: any error thrown inside a route ends up here and is returned as JSON
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Server error" });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
