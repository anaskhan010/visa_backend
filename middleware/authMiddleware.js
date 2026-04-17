const jwt = require("jsonwebtoken");

const isAdminUser = (user) => {
  const normalizedRoleName = String(user?.roleName || "").toLowerCase().trim();
  return Number(user?.roleId) === 1 || normalizedRoleName.includes("admin");
};

const isSuperAdminUser = (user) => {
  const normalizedRoleName = String(user?.roleName || "").toLowerCase().trim();
  return Number(user?.roleId) === 1 || normalizedRoleName === "super admin";
};

const isApplicantUser = (user) => {
  const normalizedRoleName = String(user?.roleName || "").toLowerCase().trim();
  return normalizedRoleName === "applicant";
};

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No authentication token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      roleId: decoded.roleId,
      roleName: decoded.roleName,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

const adminMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }
    next();
  });
};

const superAdminMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (!isSuperAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super Admin only.",
      });
    }
    next();
  });
};

const backofficeMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (isApplicantUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }
    next();
  });
};

const applicantOnlyMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (!isApplicantUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Applicant access only.",
      });
    }
    next();
  });
};

module.exports = {
  authMiddleware,
  adminMiddleware,
  superAdminMiddleware,
  backofficeMiddleware,
  applicantOnlyMiddleware,
};
