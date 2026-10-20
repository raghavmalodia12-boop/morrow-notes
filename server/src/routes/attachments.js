import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const router = Router();
const uploadDir = path.resolve("src/uploads/notes");
fs.mkdirSync(uploadDir, { recursive: true });

const KINDS = {
  ".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image", ".gif": "image",
  ".pdf": "file", ".txt": "file", ".md": "file", ".csv": "file", ".docx": "file", ".xlsx": "file", ".pptx": "file"
};
export const MAX_ATTACHMENT = 20 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(14).toString("hex")}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: MAX_ATTACHMENT, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = Boolean(KINDS[path.extname(file.originalname).toLowerCase()]);
    cb(ok ? null : new Error("That file type isn't supported. Use an image, PDF, text, CSV, Word, Excel or PowerPoint file."), ok);
  }
});

// Authentication is applied where this router is mounted (see index.js).
router.post("/", (req, res) => {
  upload.single("file")(req, res, error => {
    if (error) {
      const tooBig = error.code === "LIMIT_FILE_SIZE";
      return res.status(tooBig ? 413 : 400).json({ message: tooBig ? "Attachments can be up to 20 MB." : error.message });
    }
    if (!req.file) return res.status(400).json({ message: "Choose a file to attach." });
    const ext = path.extname(req.file.filename).toLowerCase();
    res.status(201).json({
      url: `/uploads/notes/${req.file.filename}`,
      name: Buffer.from(req.file.originalname, "latin1").toString("utf8"),
      size: req.file.size,
      kind: KINDS[ext]
    });
  });
});

export default router;
