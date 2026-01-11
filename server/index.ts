import "dotenv/config";

// Suppress gramJS/telegram library logging
if (typeof window === "undefined") {
  const originalLog = console.log;
  console.log = function (...args: any[]) {
    const message = args.join(" ");
    if (
      !message.includes("[INFO]") &&
      !message.includes("gramJS") &&
      !message.includes("Running gramJS") &&
      !message.includes("Connecting to") &&
      !message.includes("Connection to") &&
      !message.includes("Using LAYER")
    ) {
      originalLog.apply(console, args);
    }
  };
}

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { registerRoutes } from "./routes";
import { addAuthTestRoutes } from "./authTest";
import { createTelegramBot } from "./telegramBot";
import { NotificationAlgorithmService } from "./notificationAlgorithm";
import { seedAdmin } from "./seedAdmin";
import { initializeDatabase } from "./initDb";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function log(message: string) {
  console.log(message);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------------------------------------------------
// App setup
// -------------------------------------------------------------------

const app = express();

// Multer config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "coverImage" || file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  }
});

// Webhooks & parsers
app.use("/api/webhook/paystack", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// File uploads
app.use("/api/admin/", upload.any());

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
  })
);

// Cache control
app.use((_req, res, next) => {
  res.header("Cache-Control", "no-cache, no-store, must-revalidate");
  res.header("Pragma", "no-cache");
  res.header("Expires", "0");
  next();
});

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;

  res.on("finish", () => {
    if (reqPath.startsWith("/api")) {
      const duration = Date.now() - start;
      log(`${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// -------------------------------------------------------------------
// Main bootstrap
// -------------------------------------------------------------------

(async () => {
  // Telegram bot (safe in production)
  const telegramBot = createTelegramBot();
  if (telegramBot) {
    await telegramBot.testConnection();
  }

  // Routes
  const server = await registerRoutes(app, upload);
  addAuthTestRoutes(app);

  // Initialize database
  try {
    await initializeDatabase();
  } catch (err) {
    console.error("❌ Failed to initialize database:", err);
  }

  // Notification service
  const { storage } = await import("./storage");
  const notificationAlgorithm = new NotificationAlgorithmService(storage);
  notificationAlgorithm.startNotificationScheduler();

  // Seed admin users
  try {
    await seedAdmin();
  } catch (err) {
    console.error("❌ Failed to seed admin users:", err);
  }

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ message: err.message || "Internal Server Error" });
  });

  // -----------------------------------------------------------------
  // Frontend handling
  // -----------------------------------------------------------------

  const distPublicPath = path.resolve(__dirname, "../dist/public");

  if (process.env.NODE_ENV === "development") {
    // Dev only: dynamic Vite import
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    // Production: serve static files
    if (fs.existsSync(distPublicPath)) {
      app.use(express.static(distPublicPath));

      app.get("*", (_req, res) => {
        res.sendFile(path.join(distPublicPath, "index.html"));
      });
    }
  }

  // -----------------------------------------------------------------
  // Start server (Render requires PORT)
  // -----------------------------------------------------------------

  const port = 5000;
  console.log(`🚀 Attempting to start server on port ${port}...`);

  server.listen(
    port,
    "0.0.0.0",
    () => {
      console.log(`✅ Server running on port ${port}`);
    }
  );
})();

// -------------------------------------------------------------------
// Serverless export
// -------------------------------------------------------------------

export async function initAppForServerless() {
  try {
    console.log("🚀 Initializing serverless app...");

    // Telegram bot (safe in production)
    const telegramBot = createTelegramBot();
    if (telegramBot) {
      try {
        await telegramBot.testConnection();
        console.log("✅ Telegram bot connected");
      } catch (err) {
        console.log("⚠️ Telegram bot connection failed (non-critical)");
      }
    }

    // Initialize database
    try {
      await initializeDatabase();
      console.log("✅ Database initialized");
    } catch (err) {
      console.error("❌ Failed to initialize database:", err);
    }

    // Register routes
    console.log("📍 Registering routes...");
    const server = await registerRoutes(app, upload);
    console.log("✅ Routes registered");

    addAuthTestRoutes(app);

    // Notification service
    try {
      const { storage } = await import("./storage");
      const notificationAlgorithm = new NotificationAlgorithmService(storage);
      notificationAlgorithm.startNotificationScheduler();
      console.log("✅ Notification service started");
    } catch (err) {
      console.error("⚠️ Notification service failed:", err);
    }

    // Seed admin users
    try {
      await seedAdmin();
      console.log("✅ Admin users seeded");
    } catch (err) {
      console.error("⚠️ Admin seed failed:", err);
    }

    // Global error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      res.status(status).json({ message: err.message || "Internal Server Error" });
    });

    console.log("✅ Serverless app initialized successfully");
    return app;
  } catch (err) {
    console.error("❌ Error initializing serverless app:", err);
    throw err;
  }
}
