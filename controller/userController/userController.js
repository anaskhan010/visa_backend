const userModel = require("../../model/userModel/userModel");
const emailService = require("../../config/emailService");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const registerUser = async (req, res) => {
  const {
    first_name,
    last_name,
    email,
    phone,
    password,
    roleId,
  } = req.body;
  try {
    if (!first_name || !last_name || !email || !phone || !password || !roleId) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }
    const hashPassword = await bcrypt.hash(password, 10);
    const result = await userModel.registerUser(
      first_name,
      last_name,
      email,
      phone,
      hashPassword,
      roleId
    );

    // Generate verification link with proper URL encoding
    const baseUrl = process.env.FRONTEND_URL;
    const verificationLink = `${baseUrl}/#/verify-email?token=${encodeURIComponent(result.verificationToken)}`;

    console.log(`[REGISTER] Generated verification link: ${verificationLink}`);
    console.log(`[REGISTER] Token from model: ${result.verificationToken}`);

    // Send verification email
    try {
      await emailService.sendVerificationEmail(
        result.email,
        result.verificationToken,
        verificationLink
      );
      console.log(`Verification email sent to ${result.email}`);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError.message);
      // Don't fail the registration if email fails, but notify user
      return res.status(201).json({
        success: true,
        message: "User registered successfully, but verification email could not be sent. Please try resending.",
        data: result,
        emailError: true,
      });
    }

    return res.status(201).json({
      success: true,
      message: "User registered successfully. Please check your email to verify your account.",
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    console.log(`[VERIFY] Received token: ${token}`);
    console.log(`[VERIFY] Token length: ${token.length}`);

    const result = await userModel.verifyEmailToken(token);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        userId: result.userId,
        email: result.email,
      },
    });
  } catch (error) {
    console.log(`[VERIFY] Error caught: ${error.message}`);
    
    if (error.message === "Verification token has expired") {
      return res.status(410).json({
        success: false,
        message: "Verification link has expired. Please request a new one.",
      });
    }

    if (error.message === "Email is already verified") {
      return res.status(200).json({
        success: true,
        message: "Your email is already verified! You can now sign in to your account.",
        isAlreadyVerified: true,
      });
    }

    if (error.message === "Invalid verification token") {
      return res.status(400).json({
        success: false,
        message: "Invalid verification token. This link may have expired or already been used.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const resendVerificationEmail = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const result = await userModel.resendVerificationToken(email);

    // Generate verification link with proper URL encoding
    const baseUrl = process.env.FRONTEND_URL;
    const verificationLink = `${baseUrl}/verify-email?token=${encodeURIComponent(result.verificationToken)}`;

    console.log(`[RESEND] Generated verification link: ${verificationLink}`);
    console.log(`[RESEND] Token from model: ${result.verificationToken}`);

    // Send verification email
    try {
      await emailService.sendVerificationEmail(
        result.email,
        result.verificationToken,
        verificationLink
      );
      console.log(`Verification email resent to ${result.email}`);
    } catch (emailError) {
      console.error("Failed to resend verification email:", emailError.message);
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email",
        error: emailError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Verification email has been resent. Please check your email.",
    });
  } catch (error) {
    console.log(`[RESEND] Error caught: ${error.message}`);
    
    if (error.message === "Email is already verified") {
      return res.status(200).json({
        success: true,
        message: "Your email is already verified! You can now sign in to your account.",
        isAlreadyVerified: true,
      });
    }

    if (error.message === "User not found") {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    
    const user = await userModel.loginUser(email);

   
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      console.log(`[LOGIN] Invalid password for: ${email}`);
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        roleId : user.role_id,
        roleName: user.role_name
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "24h" }
    );

    console.log(`[LOGIN] User logged in successfully: ${email}`);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        roleId : user.role_id,
        roleName: user.role_name,
        token,
      },
    });
  } catch (error) {
    console.log(`[LOGIN] Error: ${error.message}`);

    if (error.message === "User not found") {
      return res.status(404).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (error.message === "Email not verified") {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in",
      });
    }

    if (error.message === "Account is inactive") {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const sendForgotPasswordOtp = async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();

  try {
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await userModel.findUserByEmailForPasswordReset(email);
    const otp = `${Math.floor(1000 + Math.random() * 9000)}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await userModel.createPasswordResetOtp(user.id, otp, expiresAt);
    await emailService.sendPasswordResetOtpEmail(user.email, user.first_name, otp);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email address",
    });
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json({
        success: false,
        message: "No account found with this email address",
      });
    }

    if (error.message === "Account is inactive") {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
      error: error.message,
    });
  }
};

const verifyForgotPasswordOtp = async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const otp = req.body.otp?.trim();

  try {
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    if (!/^\d{4}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "OTP must be 4 digits",
      });
    }

    const verifiedOtp = await userModel.verifyPasswordResetOtp(email, otp);
    const resetToken = jwt.sign(
      {
        userId: verifiedOtp.userId,
        email: verifiedOtp.email,
        otpId: verifiedOtp.otpId,
        purpose: "password-reset",
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "10m" }
    );

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      data: {
        resetToken,
      },
    });
  } catch (error) {
    if (error.message === "Invalid OTP") {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (error.message === "OTP has expired") {
      return res.status(410).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    if (error.message === "OTP already used") {
      return res.status(400).json({
        success: false,
        message: "OTP has already been used. Please request a new one.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      error: error.message,
    });
  }
};

const resetForgotPassword = async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const { newPassword, confirmPassword, resetToken } = req.body;

  try {
    if (!email || !newPassword || !confirmPassword || !resetToken) {
      return res.status(400).json({
        success: false,
        message: "Email, reset token, and passwords are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const decoded = jwt.verify(
      resetToken,
      process.env.JWT_SECRET || "your-secret-key"
    );

    if (decoded.purpose !== "password-reset" || decoded.email !== email) {
      return res.status(401).json({
        success: false,
        message: "Invalid reset session",
      });
    }

    const hashPassword = await bcrypt.hash(newPassword, 10);

    await userModel.resetPasswordWithVerifiedOtp(
      decoded.userId,
      decoded.otpId,
      hashPassword
    );

    return res.status(200).json({
      success: true,
      message: "Password updated successfully. Please login with your new password.",
    });
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Reset session has expired. Please verify OTP again.",
      });
    }

    if (error.message === "Invalid reset request") {
      return res.status(400).json({
        success: false,
        message: "Invalid reset request",
      });
    }

    if (error.message === "OTP not verified") {
      return res.status(400).json({
        success: false,
        message: "Please verify your OTP before updating the password",
      });
    }

    if (error.message === "OTP has expired") {
      return res.status(410).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    if (error.message === "OTP already used") {
      return res.status(400).json({
        success: false,
        message: "OTP has already been used. Please request a new one.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update password",
      error: error.message,
    });
  }
};


const createSystemUser = async (req,res) => {
  const {first_name,
    last_name,
    email,
    phone,
    password,
    roleId} = req.body;

 if (!first_name || !last_name || !email || !phone || !password || !roleId) {
  return res.status(400).json({
    success: false,
    message: "All required fields must be provided",
  });
 }

 const hashPassword = await bcrypt.hash(password, 10);
 const email_verified = 1;

 try {
  const data = await userModel.createSystemUsers(first_name,
    last_name,
    email,
    phone,
    hashPassword,
    email_verified,
    roleId);
    return res.status(201).json({
      success: true,
      message: "System user created successfully",
      data,
    });
 } catch (error) {
  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      message: "Email already exists",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    error: error.message,
  });
  
 }

  }

const getSystemUsers = async (req, res) => {
  try {
    const users = await userModel.getSystemUsers();

    return res.status(200).json({
      success: true,
      message: "System users fetched successfully",
      data: users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const deleteSystemUser = async (req, res) => {
  const { userId } = req.params;

  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (Number(req.user?.userId) === Number(userId)) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const deletedUser = await userModel.deleteSystemUser(userId);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
      data: deletedUser,
    });
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const updateSystemUser = async (req, res) => {
  const { userId } = req.params;
  const {
    first_name,
    last_name,
    email,
    phone,
    password,
    roleId,
  } = req.body;

  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (!first_name || !last_name || !email || !phone || !roleId) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const updatedUser = await userModel.updateSystemUser({
      userId,
      first_name,
      last_name,
      email,
      phone,
      passwordHash,
      roleId,
    });

    return res.status(200).json({
      success: true,
      message: "System user updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


module.exports = {
    registerUser,
    verifyEmail,
    resendVerificationEmail,
    loginUser,
    sendForgotPasswordOtp,
    verifyForgotPasswordOtp,
    resetForgotPassword,
    createSystemUser,
    getSystemUsers,
    deleteSystemUser,
    updateSystemUser
}
