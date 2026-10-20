import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import notesRouter from "./routes/notes.js";
import usersRouter from "./routes/users.js";
import attachmentsRouter from "./routes/attachments.js";
import { verifyFirebase } from "./middleware/verifyFirebase.js";

dotenv.config();
const app = express();
const port = Number(process.env.PORT) || 5002;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientOrigins = (process.env.CLIENT_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173").split(",").map(s => s.trim()).filter(Boolean);

app.use(cors({ origin: clientOrigins }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads"), { fallthrough: false }));
app.get("/api/health", (_req, res) => res.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" }));
app.use("/api/notes", notesRouter);
app.use("/api/users", usersRouter);
app.use("/api/attachments", verifyFirebase, attachmentsRouter);
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server." });
});

async function start() {
  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI. Copy .env.example to .env and configure it.");
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");
    app.listen(port, () => console.log(`Notes API running at http://localhost:${port}`));
  } catch (error) {
    console.error("Could not connect to MongoDB:", error.message);
    process.exit(1);
  }
}
start();
