const express = require("express");
const router = express.Router();
const { applicantOnlyMiddleware, backofficeMiddleware } = require("../../middleware/authMiddleware");
const {
  getMyMeetings,
  getAllMeetings,
  checkDateAvailability,
  getBookedDates,
  scheduleMeeting,
  approveMeeting,
  rejectMeeting,
  cancelMeeting
} = require("../../controller/meetingController/meetingController");

// Applicant routes (logged-in users can only see/manage their own)
router.get("/my-meetings", applicantOnlyMiddleware, getMyMeetings);
router.post("/schedule", applicantOnlyMiddleware, scheduleMeeting);
router.delete("/cancel/:id", applicantOnlyMiddleware, cancelMeeting);

// Public routes (for calendar)
router.get("/check-availability", checkDateAvailability);
router.get("/booked-dates", getBookedDates);

// Backoffice routes (Super Admin + System Users)
router.get("/all", backofficeMiddleware, getAllMeetings);
router.put("/approve/:id", backofficeMiddleware, approveMeeting);
router.put("/reject/:id", backofficeMiddleware, rejectMeeting);

module.exports = router;
