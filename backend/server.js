// Basic Express server setup for QR generator backend

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const QRCode = require("qrcode"); // Library for generating QR codes

const app = express();
const PORT = 5000;

// Enable CORS for all origins (development-friendly)
// This allows file:// and any http(s) origins to call the API
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Handle preflight OPTIONS requests globally
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  return res.sendStatus(204);
});

// Log all incoming requests (method, path, origin)
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} ${req.method} ${req.originalUrl} - Origin: ${
      req.headers.origin || "unknown"
    }`
  );
  next();
});

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);

// Configure multer for logo uploads (in-memory storage)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allow only image mime types
  const allowedMimeTypes = [
    "image/png",
    "image/jpg",
    "image/jpeg",
    "image/svg+xml",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (png, jpg, jpeg, svg) are allowed"), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
  },
  fileFilter,
});

// Helper to validate HEX color codes (#RGB or #RRGGBB)
// Returns true if color is a valid hex, false otherwise
const isValidHex = (color) => {
  if (typeof color !== "string") return false;
  // Accept #RGB or #RRGGBB (case-insensitive)
  const hexRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  return hexRegex.test(color.trim());
};

// Endpoint for QR generation
app.post("/api/generate-qr", upload.single("logo"), async (req, res) => {
  try {
    // Extract QR parameters from request body
    const {
      text,
      size,
      foregroundColor,
      backgroundColor,
      errorCorrectionLevel,
    } = req.body;

    // Basic validation: text is required
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({
        message: "Parameter 'text' is required and cannot be empty.",
      });
    }

    // Parse and validate size (optional)
    let qrSize = 300; // default size in pixels
    if (size !== undefined) {
      const parsedSize = Number(size);

      if (
        Number.isNaN(parsedSize) ||
        !Number.isFinite(parsedSize) ||
        parsedSize < 100 ||
        parsedSize > 1000
      ) {
        return res.status(400).json({
          message:
            "Parameter 'size' must be a number between 100 and 1000 (pixels).",
        });
      }

      qrSize = parsedSize;
    }

    // Default values for visual options
    let fgColor = foregroundColor || "#000000";
    let bgColor = backgroundColor || "#FFFFFF";

    // Validate custom HEX colors if provided
    if (foregroundColor && !isValidHex(foregroundColor)) {
      return res.status(400).json({
        message:
          "Parameter 'foregroundColor' must be a valid HEX color (e.g. #000, #FF0000).",
      });
    }

    if (backgroundColor && !isValidHex(backgroundColor)) {
      return res.status(400).json({
        message:
          "Parameter 'backgroundColor' must be a valid HEX color (e.g. #FFF, #FFFFFF).",
      });
    }

    const ecLevel = errorCorrectionLevel || "M";

    // Generate QR code as PNG buffer
    // Note: req.file (logo) is currently not used, but is available for future composition with Sharp
    const qrBuffer = await QRCode.toBuffer(text, {
      width: qrSize,
      margin: 1,
      color: {
        dark: fgColor,
        light: bgColor,
      },
      errorCorrectionLevel: ecLevel,
      type: "png",
    });

    // Return generated image as PNG
    res.setHeader("Content-Type", "image/png");
    return res.send(qrBuffer);
  } catch (error) {
    console.error("Error in /api/generate-qr:", error);
    return res.status(500).json({
      message: "Internal server error while generating QR code.",
      error: error.message,
    });
  }
});

// Basic health check endpoint
app.get("/", (req, res) => {
  res.send("QR Generator Backend is running");
});

// Start the server
app.listen(PORT, () => {
  console.log(`QR Generator backend listening on port ${PORT}`);
});

