const express = require("express");
const serviceTemplateController = require("../../controller/serviceTemplateController/serviceTemplateController");
const { authMiddleware, adminMiddleware } = require("../../middleware/authMiddleware");

const router = express.Router();

router.get("/templates", authMiddleware, serviceTemplateController.getTemplates);
router.post("/generate", authMiddleware, serviceTemplateController.generateDocument);

router.post("/admin/templates", adminMiddleware, serviceTemplateController.createTemplate);
router.put("/admin/templates/:id", adminMiddleware, serviceTemplateController.updateTemplate);
router.delete("/admin/templates/:id", adminMiddleware, serviceTemplateController.archiveTemplate);

module.exports = router;
