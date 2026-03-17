// Basic Express server setup for QR generator backend

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const QRCode = require("qrcode");
const sharp = require("sharp");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const QRCodeModel = require("./models/QRCode");

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB (use env var if provided, otherwise local)
const mongoUri =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/qr-generator";

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("[MongoDB] Connected to", mongoUri);
  })
  .catch((err) => {
    console.error("[MongoDB] Connection error:", err);
  });

// CORS: в dev разрешаем запросы с фронтенда на localhost:3000
app.use(
  cors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Логирование всех запросов с кодом ответа и временем
app.use((req, res, next) => {
  const start = Date.now();
  const origin = req.headers.origin || "unknown";

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${
        req.originalUrl
      } - ${res.statusCode} - ${duration}ms - Origin: ${origin}`
    );
  });

  next();
});

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

// Serve generated QR images (and optional logos) from /uploads
const uploadsDir = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));

// Configure multer for logo uploads (in-memory storage)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/png",
    "image/jpg",
    "image/jpeg",
    "image/svg+xml",
  ];

  if (!file) {
    return cb(new Error("No file provided"), false);
  }

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      new Error("Only image files (png, jpg, jpeg, svg) are allowed"),
      false
    );
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter,
});

const isValidHex = (color) => {
  if (typeof color !== "string") return false;
  const hexRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  return hexRegex.test(color.trim());
};

// QR generation with optional logo and roundLogo
app.post("/api/generate-qr", upload.single("logo"), async (req, res) => {
  console.log("[/api/generate-qr] Incoming request");

  console.log("[/api/generate-qr] Body:", req.body);
  if (req.file) {
    console.log("[/api/generate-qr] File:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
  } else {
    console.log("[/api/generate-qr] No logo file uploaded.");
  }

  try {
    const {
      text,
      size,
      foregroundColor,
      backgroundColor,
      errorCorrectionLevel,
      roundLogo,
      format,
    } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      console.warn("[/api/generate-qr] Validation failed: empty text");
      return res.status(400).json({
        message: "Parameter 'text' is required and cannot be empty.",
      });
    }

    let qrSize = 300;
    if (size !== undefined) {
      const parsedSize = Number(size);
      if (
        Number.isNaN(parsedSize) ||
        !Number.isFinite(parsedSize) ||
        parsedSize < 100 ||
        parsedSize > 1000
      ) {
        console.warn("[/api/generate-qr] Validation failed: invalid size", {
          size,
        });
        return res.status(400).json({
          message:
            "Parameter 'size' must be a number between 100 and 1000 (pixels).",
        });
      }
      qrSize = parsedSize;
    }

    let fgColor = foregroundColor || "#000000";
    let bgColor = backgroundColor || "#FFFFFF";

    if (foregroundColor && !isValidHex(foregroundColor)) {
      console.warn(
        "[/api/generate-qr] Validation failed: invalid foregroundColor",
        { foregroundColor }
      );
      return res.status(400).json({
        message:
          "Parameter 'foregroundColor' must be a valid HEX color (e.g. #000, #FF0000).",
      });
    }

    if (backgroundColor && !isValidHex(backgroundColor)) {
      console.warn(
        "[/api/generate-qr] Validation failed: invalid backgroundColor",
        { backgroundColor }
      );
      return res.status(400).json({
        message:
          "Parameter 'backgroundColor' must be a valid HEX color (e.g. #FFF, #FFFFFF).",
      });
    }

    const ecLevel = errorCorrectionLevel || "M";

    // output format: png (default) or svg
    const outFormat =
      typeof format === "string" && format.toLowerCase() === "svg"
        ? "svg"
        : "png";

    const shouldRoundLogo =
      typeof roundLogo === "string"
        ? roundLogo.toLowerCase() === "true"
        : !!roundLogo;

    console.log("[/api/generate-qr] Parsed params:", {
      textPreview: text.slice(0, 80),
      qrSize,
      fgColor,
      bgColor,
      ecLevel,
      roundLogo: shouldRoundLogo,
      format: outFormat,
    });

    // SVG: генерируем векторный QR, логотип пока НЕ накладываем
    if (outFormat === "svg") {
      try {
        const svgString = await QRCode.toString(text, {
          type: "svg",
          width: qrSize,
          margin: 1,
          color: {
            dark: fgColor,
            light: bgColor,
          },
          errorCorrectionLevel: ecLevel,
        });

        await fs.promises.mkdir(uploadsDir, { recursive: true });
        const fileName = `qr_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}.svg`;
        const fullPath = path.join(uploadsDir, fileName);
        await fs.promises.writeFile(fullPath, svgString, "utf8");
        const imagePath = `/uploads/${fileName}`;

        console.log("[/api/generate-qr] SVG saved at:", imagePath);

        try {
          const record = await QRCodeModel.create({
            text: text.trim(),
            size: qrSize,
            foregroundColor: fgColor,
            backgroundColor: bgColor,
            errorCorrectionLevel: ecLevel,
            hasLogo: false, // SVG без логотипа
            logoPath: null,
            imagePath,
            createdAt: new Date(),
            userId: null,
          });
          res.setHeader("X-QR-Id", record._id.toString());
        } catch (dbError) {
          console.error(
            "[/api/generate-qr] Failed to save SVG record in MongoDB:",
            dbError
          );
          res.setHeader("X-QR-Error", "DB_SAVE_FAILED");
        }

        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("X-QR-Image-Path", imagePath);
        return res.send(svgString);
      } catch (svgError) {
        console.error("[/api/generate-qr] QRCode.toString SVG error:", svgError);
        return res.status(500).json({
          message: "Failed to generate SVG QR code.",
          error: svgError.message,
        });
      }
    }

    // PNG ветка (с поддержкой логотипа)
    let qrBuffer;
    try {
      qrBuffer = await QRCode.toBuffer(text, {
        width: qrSize,
        margin: 1,
        color: {
          dark: fgColor,
          light: bgColor,
        },
        errorCorrectionLevel: ecLevel,
        type: "png",
      });
      console.log(
        "[/api/generate-qr] QR code generated, buffer length:",
        qrBuffer.length
      );
    } catch (qrError) {
      console.error("[/api/generate-qr] QRCode.toBuffer error:", qrError);
      return res.status(500).json({
        message: "Failed to generate QR code image.",
        error: qrError.message,
      });
    }

    let finalBuffer = qrBuffer;
    let logoPath = null;

    if (req.file && req.file.buffer) {
      try {
        console.log("[/api/generate-qr] Processing logo with sharp...");

        const logoSize = 50;
        let logoImage = sharp(req.file.buffer).resize(logoSize, logoSize, {
          fit: "inside",
          withoutEnlargement: true,
        });

        let logoPng;

        if (shouldRoundLogo) {
          try {
            const logoMetadata = await logoImage.metadata();
            const metaWidth = logoMetadata.width || logoSize;
            const metaHeight = logoMetadata.height || logoSize;
            const maskSize = Math.max(
              2,
              Math.min(metaWidth, metaHeight, logoSize)
            );

            const circleSvg = `<svg width="${maskSize}" height="${maskSize}"><circle cx="${
              maskSize / 2
            }" cy="${maskSize / 2}" r="${maskSize / 2}" fill="white"/></svg>`;

            const baseLogoPng = await logoImage.png().toBuffer();
            logoPng = await sharp(baseLogoPng)
              .composite([
                {
                  input: Buffer.from(circleSvg),
                  blend: "dest-in",
                },
              ])
              .png()
              .toBuffer();

            console.log(
              "[/api/generate-qr] Round logo applied, buffer length:",
              logoPng.length
            );
          } catch (roundError) {
            console.warn(
              "[/api/generate-qr] Failed to apply round mask, fallback to rectangular logo:",
              roundError
            );
            logoPng = await logoImage.png().toBuffer();
          }
        } else {
          logoPng = await logoImage.png().toBuffer();
        }

        finalBuffer = await sharp(qrBuffer)
          .composite([
            {
              input: logoPng,
              gravity: "centre",
            },
          ])
          .png()
          .toBuffer();

        const logoFileName = `logo_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}.png`;
        await fs.promises.mkdir(uploadsDir, { recursive: true });
        const logoFullPath = path.join(uploadsDir, logoFileName);
        await fs.promises.writeFile(logoFullPath, logoPng);
        logoPath = `/uploads/${logoFileName}`;

        console.log("[/api/generate-qr] Logo saved at:", logoPath);
      } catch (logoError) {
        console.error(
          "[/api/generate-qr] Error while processing logo with sharp:",
          logoError
        );
        finalBuffer = qrBuffer;
      }
    }

    let imagePath;
    try {
      await fs.promises.mkdir(uploadsDir, { recursive: true });
      const qrFileName = `qr_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}.png`;
      const qrFullPath = path.join(uploadsDir, qrFileName);
      await fs.promises.writeFile(qrFullPath, finalBuffer);
      imagePath = `/uploads/${qrFileName}`;
      console.log("[/api/generate-qr] QR image saved at:", imagePath);
    } catch (fsError) {
      console.error("[/api/generate-qr] Failed to save QR image:", fsError);
      return res.status(500).json({
        message: "Failed to persist QR image on server.",
        error: fsError.message,
      });
    }

    try {
      const record = await QRCodeModel.create({
        text: text.trim(),
        size: qrSize,
        foregroundColor: fgColor,
        backgroundColor: bgColor,
        errorCorrectionLevel: ecLevel,
        hasLogo: !!req.file,
        logoPath,
        imagePath,
        createdAt: new Date(),
        userId: null,
      });

      console.log("[/api/generate-qr] Record saved with id:", record._id);
      res.setHeader("X-QR-Id", record._id.toString());
    } catch (dbError) {
      console.error("[/api/generate-qr] Failed to save record in MongoDB:", dbError);
      res.setHeader("X-QR-Error", "DB_SAVE_FAILED");
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("X-QR-Image-Path", imagePath);
    return res.send(finalBuffer);
  } catch (error) {
    console.error("[/api/generate-qr] Unhandled error:", error);
    return res.status(500).json({
      message: "Internal server error while generating QR code.",
      error: error.message,
    });
  }
});

// Simple test endpoint
app.get("/api/test", (req, res) => {
  res.json({ ok: true, message: "QR Generator API is reachable." });
});

// Basic health check endpoint for /
app.get("/", (req, res) => {
  res.send("QR Generator Backend is running");
});

// Start server
app.listen(PORT, () => {
  console.log(`QR Generator backend listening on port ${PORT}`);
});
