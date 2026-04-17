const express = require("express");
const multer = require("multer");
const path = require("path");
const documentController = require("../../controller/documentController/documentController");
const { authMiddleware, adminMiddleware } = require("../../middleware/authMiddleware");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../../uploads")),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Only PDF, JPG, PNG, DOC files are allowed"));
  },
});

const router = express.Router();

// Applicant routes
router.get("/my", authMiddleware, documentController.getMyDocuments);
router.post("/my", authMiddleware, upload.single("file"), documentController.uploadMyDocument);
router.delete("/my/:id", authMiddleware, documentController.deleteMyDocument);

// Admin routes
router.get("/applicant/:userId", adminMiddleware, documentController.getApplicantDocuments);
router.post("/applicant/:userId", adminMiddleware, upload.single("file"), documentController.adminUploadDocument);
router.delete("/admin/:id", adminMiddleware, documentController.adminDeleteDocument);
router.put("/admin/status/:id", adminMiddleware, documentController.adminUpdateDocStatus);

module.exports = router;
