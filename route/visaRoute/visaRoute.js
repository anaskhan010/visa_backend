const express = require("express");
const visaController = require("../../controller/visaController/visaController");
const { authMiddleware, backofficeMiddleware, applicantOnlyMiddleware } = require("../../middleware/authMiddleware");

const router = express.Router();

// Public - any logged in user can browse visas
router.get("/countries", authMiddleware, visaController.getAllCountries);
router.get("/country/:country", authMiddleware, visaController.getVisasByCountry);
router.get("/detail/:id", authMiddleware, visaController.getVisaDetail);
router.get("/application-readiness/:id", applicantOnlyMiddleware, visaController.getApplicationReadiness);

// Applicant - apply & view own applications
router.post("/apply", applicantOnlyMiddleware, visaController.applyForVisa);
router.get("/my-applications", applicantOnlyMiddleware, visaController.getMyApplications);

// Backoffice - full CRUD on visas
router.post("/create", backofficeMiddleware, visaController.createVisa);
router.put("/update/:id", backofficeMiddleware, visaController.updateVisa);
router.delete("/delete/:id", backofficeMiddleware, visaController.deleteVisa);

// Backoffice - manage all applications
router.get("/all-applications", backofficeMiddleware, visaController.getAllApplications);
router.put("/application-status/:id", backofficeMiddleware, visaController.updateApplicationStatus);
router.delete("/application/:id", backofficeMiddleware, visaController.deleteApplication);

module.exports = router;
