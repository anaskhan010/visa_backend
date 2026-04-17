const express = require("express");
const roleController = require("../../controller/roleController/roleController");

const router = express.Router();

// Get all roles
router.get("/all", roleController.getAllRoles);

// Get role by ID
router.get("/:roleId", roleController.getRoleById);

// Create new role
router.post("/create", roleController.createRole);

module.exports = router;
