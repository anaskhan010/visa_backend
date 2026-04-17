const express = require("express");
const pageController = require("../../controller/pageController/pageController");

const router = express.Router();

router.get("/all-pages", pageController.getAllPages);
router.get("/role-permissions/:roleId", pageController.getRolePermissions);
router.post("/assign-pages", pageController.assignPages);
router.get("/role/:roleId", pageController.getPagesByRole);

module.exports = router;
