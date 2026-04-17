const express = require("express");

const aiController = require("../../controller/aiController/aiController");
const { applicantOnlyMiddleware, backofficeMiddleware } = require("../../middleware/authMiddleware");

const router = express.Router();

router.get("/me", applicantOnlyMiddleware, aiController.getMyEligibilityAssessment);
router.post("/me/run", applicantOnlyMiddleware, aiController.runMyEligibilityAssessment);
router.delete("/me", applicantOnlyMiddleware, aiController.resetMyEligibilityAssessment);

router.get("/applicant/:userId", backofficeMiddleware, aiController.getApplicantEligibilityAssessment);
router.post("/applicant/:userId/run", backofficeMiddleware, aiController.runApplicantEligibilityAssessment);
router.delete("/applicant/:userId", backofficeMiddleware, aiController.resetApplicantEligibilityAssessment);

module.exports = router;
