const express = require("express");
const router = express.Router();
const { authMiddleware, applicantOnlyMiddleware, adminMiddleware, backofficeMiddleware, superAdminMiddleware } = require("../../middleware/authMiddleware");
const {
  createTicketBooking,
  prepareStripeTicketBookingPayment,
  finalizeStripeTicketBookingPayment,
  getTicketBookingSettings,
  updateTicketBookingSettings,
  getMyTicketBookings,
  getAllTicketBookings,
  startTicketBookingPayment,
  confirmStripeTicketBookingPayment,
  updateTicketBookingStatus,
  checkFlightAvailability,
} = require("../../controller/ticketBookingController/ticketBookingController");

router.get("/settings", authMiddleware, getTicketBookingSettings);
router.get("/my", applicantOnlyMiddleware, getMyTicketBookings);
router.post("/", applicantOnlyMiddleware, createTicketBooking);
router.post("/stripe/prepare", applicantOnlyMiddleware, prepareStripeTicketBookingPayment);
router.post("/stripe/finalize", applicantOnlyMiddleware, finalizeStripeTicketBookingPayment);
router.post("/:id/start-payment", applicantOnlyMiddleware, startTicketBookingPayment);
router.get("/:id/stripe/confirm", applicantOnlyMiddleware, confirmStripeTicketBookingPayment);
router.get("/all", backofficeMiddleware, getAllTicketBookings);
router.put("/:id/status", backofficeMiddleware, updateTicketBookingStatus);
router.put("/settings", adminMiddleware, updateTicketBookingSettings);
router.get("/flight-availability", superAdminMiddleware, checkFlightAvailability);

module.exports = router;
