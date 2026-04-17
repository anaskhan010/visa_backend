const express = require("express");

const userController = require("../../controller/userController/userController");
const { adminMiddleware } = require("../../middleware/authMiddleware");

const router = express.Router();

router.post("/register-user", userController.registerUser);
router.get("/verify-email", userController.verifyEmail);
router.post("/resend-verification", userController.resendVerificationEmail);

router.post("/login-user", userController.loginUser)
router.post("/forgot-password/send-otp", userController.sendForgotPasswordOtp)
router.post("/forgot-password/verify-otp", userController.verifyForgotPasswordOtp)
router.post("/forgot-password/reset-password", userController.resetForgotPassword)
router.get("/system-users", adminMiddleware, userController.getSystemUsers)
router.post("/system-users", adminMiddleware, userController.createSystemUser)
router.put("/system-users/:userId", adminMiddleware, userController.updateSystemUser)
router.delete("/system-users/:userId", adminMiddleware, userController.deleteSystemUser)

module.exports = router;
