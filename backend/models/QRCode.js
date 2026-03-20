const mongoose = require("mongoose");

const QRCodeSchema = new mongoose.Schema({
  text: { type: String, required: true },
  size: { type: Number },
  foregroundColor: { type: String },
  backgroundColor: { type: String },
  errorCorrectionLevel: { type: String },
  hasLogo: { type: Boolean, default: false },
  roundLogo: { type: Boolean, default: false },
  logoSize: { type: Number, default: 50 },
  logoPath: { type: String },
  imagePath: { type: String }, // relative URL/path to stored QR image
  createdAt: { type: Date, default: Date.now },
  userId: { type: String },
});

module.exports = mongoose.model("QRCode", QRCodeSchema);

