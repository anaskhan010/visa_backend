const db = require("../../config/Connection");
const supportSystemModel = require("../../model/supportSystemModel/supportSystemModel");
const { sendEmail } = require("../../config/emailService");

const isBackofficeUser = (user) => {
  const normalizedRoleName = String(user?.roleName || "").toLowerCase().trim();
  return normalizedRoleName !== "applicant";
};

const allowedStatuses = ["open", "in_progress", "resolved", "closed"];

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildMessagePayload = (req, text) => ({
  id: `msg_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
  sender_id: req.user.userId,
  sender_name: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
  sender_role: isBackofficeUser(req.user) ? "Support Team" : "Applicant",
  text,
  created_at: new Date().toISOString(),
});

const getSuperAdminUsers = async () => {
  const connection = await db.getConnection();

  try {
    const [admins] = await connection.query(
      `SELECT u.id, u.first_name, u.last_name, u.email
       FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       WHERE ur.role_id = 1`
    );

    return admins;
  } finally {
    connection.release();
  }
};

const sendNewTicketEmailToSuperAdmins = async (ticket) => {
  try {
    const admins = await getSuperAdminUsers();

    if (!admins.length) {
      return;
    }

    const firstMessage = ticket.messages?.[0]?.text || "No message provided";
    const subject = `New Support Ticket - ${ticket.ticket_no}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1b4a9c 0%, #2563eb 100%); padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">New Support Ticket Created</h1>
        </div>
        <div style="background: #f8fafc; padding: 28px; border-radius: 0 0 12px 12px;">
          <p style="font-size: 15px; color: #334155;">A new applicant support ticket has been created.</p>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden;">
            <tr><td style="padding: 12px; font-weight: bold; color: #1b4a9c; border-bottom: 1px solid #e2e8f0;">Ticket No</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(ticket.ticket_no)}</td></tr>
            <tr><td style="padding: 12px; font-weight: bold; color: #1b4a9c; border-bottom: 1px solid #e2e8f0;">Subject</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(ticket.subject)}</td></tr>
            <tr><td style="padding: 12px; font-weight: bold; color: #1b4a9c; border-bottom: 1px solid #e2e8f0;">Category</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(ticket.category)}</td></tr>
            <tr><td style="padding: 12px; font-weight: bold; color: #1b4a9c; border-bottom: 1px solid #e2e8f0;">Applicant</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(ticket.applicant_name)}</td></tr>
            <tr><td style="padding: 12px; font-weight: bold; color: #1b4a9c; border-bottom: 1px solid #e2e8f0;">Email</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(ticket.applicant_email)}</td></tr>
            <tr><td style="padding: 12px; font-weight: bold; color: #1b4a9c; vertical-align: top;">Message</td><td style="padding: 12px; white-space: pre-wrap;">${escapeHtml(firstMessage)}</td></tr>
          </table>
          <p style="margin-top: 18px; color: #64748b;">Please log in to the admin panel to respond to the applicant.</p>
        </div>
      </div>
    `;

    await Promise.all(
      admins
        .filter((admin) => admin.email)
        .map((admin) =>
          sendEmail({
            to: admin.email,
            subject,
            htmlBody,
          })
        )
    );
  } catch (error) {
    console.error("Failed to send new support ticket email to super admin:", error.message);
  }
};

const sendResolvedTicketEmailToApplicant = async (ticket) => {
  try {
    if (!ticket?.applicant_email) {
      return;
    }

    const subject = `Your Support Ticket Has Been Resolved - ${ticket.ticket_no}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: full; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Support Ticket Resolved</h1>
        </div>
        <div style="background: #f8fafc; padding: 28px; border-radius: 0 0 12px 12px;">
          <p style="font-size: 15px; color: #334155;">Dear ${escapeHtml(ticket.applicant_name)},</p>
          <p style="font-size: 15px; color: #334155;">Your support ticket has been marked as resolved by the Support Team.</p>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden;">
            <tr><td style="padding: 12px; font-weight: bold; color: #059669; border-bottom: 1px solid #e2e8f0;">Ticket No</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(ticket.ticket_no)}</td></tr>
            <tr><td style="padding: 12px; font-weight: bold; color: #059669; border-bottom: 1px solid #e2e8f0;">Subject</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(ticket.subject)}</td></tr>
            <tr><td style="padding: 12px; font-weight: bold; color: #059669;">Category</td><td style="padding: 12px;">${escapeHtml(ticket.category)}</td></tr>
          </table>
          <p style="margin-top: 18px; color: #64748b;">Please log in to your dashboard if you want to review the ticket conversation.</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: ticket.applicant_email,
      subject,
      htmlBody,
    });
  } catch (error) {
    console.error("Failed to send resolved support ticket email to applicant:", error.message);
  }
};

const getSupportTickets = async (req, res) => {
  try {
    const tickets = await supportSystemModel.getSupportTickets({
      userId: req.user.userId,
      isAdmin: isBackofficeUser(req.user),
      status: req.query.status,
    });

    return res.status(200).json({
      success: true,
      data: tickets,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getSupportTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await supportSystemModel.getSupportTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found",
      });
    }

    if (!isBackofficeUser(req.user) && Number(ticket.user_id) !== Number(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: "You can only access your own support tickets",
      });
    }

    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const createSupportTicket = async (req, res) => {
  try {
    const { subject, category, message } = req.body;

    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject and message are required",
      });
    }

    const initialMessage = buildMessagePayload(req, message.trim());

    const result = await supportSystemModel.createSupportTicket({
      userId: req.user.userId,
      subject: subject.trim(),
      category: category?.trim() || "General",
      messages: [initialMessage],
    });

    const ticket = await supportSystemModel.getSupportTicketById(result.id);
    await sendNewTicketEmailToSuperAdmins(ticket);

    return res.status(201).json({
      success: true,
      message: "Support ticket created successfully",
      data: ticket,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const replyToSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const ticket = await supportSystemModel.getSupportTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found",
      });
    }

    if (!isBackofficeUser(req.user) && Number(ticket.user_id) !== Number(req.user.userId)) {
      return res.status(403).json({
        success: false,
        message: "You can only reply to your own support tickets",
      });
    }

    await supportSystemModel.appendSupportMessage(
      id,
      buildMessagePayload(req, message.trim())
    );

    if (isBackofficeUser(req.user) && ticket.status === "open") {
      await supportSystemModel.updateSupportTicketStatus(id, "in_progress");
    }

    const updatedTicket = await supportSystemModel.getSupportTicketById(id);

    return res.status(200).json({
      success: true,
      message: "Reply sent successfully",
      data: updatedTicket,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateSupportTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status selected",
      });
    }

    const ticket = await supportSystemModel.getSupportTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found",
      });
    }

    const shouldNotifyApplicant = ticket.status !== "resolved" && status === "resolved";

    await supportSystemModel.updateSupportTicketStatus(id, status);

    const updatedTicket = await supportSystemModel.getSupportTicketById(id);

    if (shouldNotifyApplicant) {
      await sendResolvedTicketEmailToApplicant(updatedTicket);
    }

    return res.status(200).json({
      success: true,
      message: "Support ticket status updated successfully",
      data: updatedTicket,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteSupportMessage = async (req, res) => {
  try {
    const { id, messageId } = req.params;

    const ticket = await supportSystemModel.getSupportTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found",
      });
    }

    const result = await supportSystemModel.deleteSupportMessage(id, messageId);

    if (!result.deleted) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    const updatedTicket = await supportSystemModel.getSupportTicketById(id);

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully",
      data: updatedTicket,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await supportSystemModel.getSupportTicketById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found",
      });
    }

    await supportSystemModel.deleteSupportTicket(id);

    return res.status(200).json({
      success: true,
      message: "Support ticket deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getSupportTickets,
  getSupportTicketById,
  createSupportTicket,
  replyToSupportTicket,
  updateSupportTicketStatus,
  deleteSupportMessage,
  deleteSupportTicket,
};
