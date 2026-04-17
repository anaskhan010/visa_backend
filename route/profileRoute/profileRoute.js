const express = require("express");
const profileController = require("../../controller/profileController/profileController");
const { authMiddleware, adminMiddleware, backofficeMiddleware } = require("../../middleware/authMiddleware");

const router = express.Router();

router.get("/complete", authMiddleware, profileController.getCompleteProfile);
router.put("/personal-info", authMiddleware, profileController.updatePersonalInfo);

router.post("/passport", authMiddleware, profileController.addPassport);
router.delete("/passport/:id", authMiddleware, profileController.deletePassport);

router.post("/education", authMiddleware, profileController.addEducation);
router.delete("/education/:id", authMiddleware, profileController.deleteEducation);

router.post("/family-member", authMiddleware, profileController.addFamilyMember);
router.delete("/family-member/:id", authMiddleware, profileController.deleteFamilyMember);

router.post("/finance", authMiddleware, profileController.addFinance);
router.delete("/finance/:id", authMiddleware, profileController.deleteFinance);

router.get("/admin-stats", adminMiddleware, profileController.getAdminStats);
router.get("/all-applicants", backofficeMiddleware, profileController.getAllApplicants);
router.get("/applicant/:userId", backofficeMiddleware, profileController.getApplicantProfile);

router.post("/admin/passport/:userId", backofficeMiddleware, profileController.adminAddPassport);
router.delete("/admin/passport/:id", backofficeMiddleware, profileController.adminDeletePassport);

router.post("/admin/education/:userId", backofficeMiddleware, profileController.adminAddEducation);
router.delete("/admin/education/:id", backofficeMiddleware, profileController.adminDeleteEducation);

router.post("/admin/family-member/:userId", backofficeMiddleware, profileController.adminAddFamilyMember);
router.delete("/admin/family-member/:id", backofficeMiddleware, profileController.adminDeleteFamilyMember);

router.post("/admin/finance/:userId", backofficeMiddleware, profileController.adminAddFinance);
router.delete("/admin/finance/:id", backofficeMiddleware, profileController.adminDeleteFinance);

module.exports = router;
