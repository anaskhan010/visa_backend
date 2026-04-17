const express = require("express");
const router = express.Router();
const { authMiddleware, backofficeMiddleware } = require("../../middleware/authMiddleware");
const {
  getSupportTickets,
  getSupportTicketById,
  createSupportTicket,
  replyToSupportTicket,
  updateSupportTicketStatus,
  deleteSupportMessage,
  deleteSupportTicket,
} = require("../../controller/supportSystemController/supportSystemController");

router.get("/tickets", authMiddleware, getSupportTickets);
router.get("/tickets/:id", authMiddleware, getSupportTicketById);
router.post("/tickets", authMiddleware, createSupportTicket);
router.post("/tickets/:id/messages", authMiddleware, replyToSupportTicket);

router.put("/tickets/:id/status", backofficeMiddleware, updateSupportTicketStatus);
router.delete("/tickets/:id/messages/:messageId", backofficeMiddleware, deleteSupportMessage);
router.delete("/tickets/:id", backofficeMiddleware, deleteSupportTicket);

module.exports = router;
