import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// --- Validate required secrets before the app starts ---
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: JWT_SECRET is not set. Refusing to start in production.");
    process.exit(1);
  }
  process.env.JWT_SECRET = "dev-only-insecure-secret-change-me";
  console.warn(
    "JWT_SECRET not set; using an insecure development default. Do NOT use this in production.",
  );
}

const app = express();

const authRoutes = (await import("./routes/auth.js")).default;
const taskRoutes = (await import("./routes/tasks.js")).default;

// Security
app.use(helmet());
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://localhost:3000",
].filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) {
        return callback(null, true);
      }
      callback(new Error('CORS policy: Origin not allowed'));
    },
    credentials: true,
  }),
);
app.use(express.json());

// Health/readiness endpoints. Registered before the rate limiter so
// Kubernetes probes are never throttled. Liveness = process is up;
// readiness = MongoDB connection is established.
app.get(["/health", "/api/health"], (req, res) => {
  res.status(200).json({ status: "ok" });
});
app.get(["/ready", "/api/ready"], (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? "ready" : "not-ready",
    db: connected ? "connected" : "disconnected",
  });
});

// Rate limiting: a broad global cap plus a stricter cap on auth endpoints
// to slow down brute-force attempts.
const limiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 1000 });
app.use("/api/", limiter);
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth", authLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai-task-platform";
if (!process.env.MONGO_URI) {
  console.warn('MONGO_URI not set. Using default local MongoDB URL:', mongoURI);
}

// Start serving immediately so probes respond while MongoDB is still
// connecting. Readiness stays 503 until the DB is available.
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}...`));

mongoose.connection.on("connected", () => console.log("MongoDB connected"));
mongoose.connection.on("error", (err) => console.error("MongoDB error:", err.message));
mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));

const connectWithRetry = async () => {
  try {
    await mongoose.connect(mongoURI);
  } catch (err) {
    console.error("MongoDB connection failed, retrying in 5s:", err.message);
    setTimeout(connectWithRetry, 5000);
  }
};
connectWithRetry();

// Optionally run the task worker in-process. Used for single-service deploys
// (e.g. a free Render web service) where a separate worker isn't available.
// In Kubernetes we run the dedicated Python worker, so this stays off there.
if (process.env.RUN_INLINE_WORKER === "true") {
  import("./worker.js")
    .then(({ startInlineWorker }) => startInlineWorker())
    .catch((err) => console.error("Inline worker failed to start:", err.message));
}
