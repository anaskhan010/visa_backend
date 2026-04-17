const db = require("../../config/Connection");

const parseMessages = (messages) => {
  if (!messages) return [];

  if (Array.isArray(messages)) {
    return messages;
  }

  try {
    const parsedMessages = JSON.parse(messages);
    return Array.isArray(parsedMessages) ? parsedMessages : [];
  } catch (error) {
    return [];
  }
};

const buildTicketSummary = (ticket) => {
  const messages = parseMessages(ticket.messages);
  const lastMessage = messages[messages.length - 1] || null;

  return {
    id: ticket.id,
    ticket_no: ticket.ticket_no,
    user_id: ticket.user_id,
    applicant_name: `${ticket.first_name || ""} ${ticket.last_name || ""}`.trim(),
    applicant_email: ticket.email,
    applicant_phone: ticket.phone,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    message_count: messages.length,
    last_message: lastMessage?.text || "",
    last_message_by: lastMessage?.sender_name || "",
    last_message_at: ticket.last_message_at,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
  };
};

const buildTicketDetail = (ticket) => ({
  id: ticket.id,
  ticket_no: ticket.ticket_no,
  user_id: ticket.user_id,
  applicant_name: `${ticket.first_name || ""} ${ticket.last_name || ""}`.trim(),
  applicant_email: ticket.email,
  applicant_phone: ticket.phone,
  subject: ticket.subject,
  category: ticket.category,
  status: ticket.status,
  messages: parseMessages(ticket.messages),
  last_message_at: ticket.last_message_at,
  created_at: ticket.created_at,
  updated_at: ticket.updated_at,
});

const createTicketNumber = () => {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const randomPart = Math.floor(1000 + Math.random() * 9000);

  return `SUP-${datePart}-${randomPart}`;
};

const createSupportTicket = async ({
  userId,
  subject,
  category,
  messages,
}) => {
  const connection = await db.getConnection();

  try {
    const ticketNo = createTicketNumber();

    const [result] = await connection.query(
      `INSERT INTO support_tickets
        (ticket_no, user_id, subject, category, status, messages, last_message_at)
       VALUES (?, ?, ?, ?, 'open', ?, NOW())`,
      [
        ticketNo,
        userId,
        subject,
        category || "General",
        JSON.stringify(messages),
      ]
    );

    return {
      id: result.insertId,
      ticket_no: ticketNo,
    };
  } finally {
    connection.release();
  }
};

const getSupportTickets = async ({ userId, isAdmin, status }) => {
  const connection = await db.getConnection();

  try {
    const queryParts = [
      `SELECT
        st.*,
        u.first_name,
        u.last_name,
        u.email,
        u.phone
      FROM support_tickets st
      JOIN users u ON st.user_id = u.id`,
    ];

    const values = [];
    const conditions = [];

    if (!isAdmin) {
      conditions.push("st.user_id = ?");
      values.push(userId);
    }

    if (status && status !== "all") {
      conditions.push("st.status = ?");
      values.push(status);
    }

    if (conditions.length > 0) {
      queryParts.push(`WHERE ${conditions.join(" AND ")}`);
    }

    queryParts.push("ORDER BY st.last_message_at DESC, st.id DESC");

    const [tickets] = await connection.query(queryParts.join(" "), values);

    return tickets.map(buildTicketSummary);
  } finally {
    connection.release();
  }
};

const getSupportTicketById = async (ticketId) => {
  const connection = await db.getConnection();

  try {
    const [tickets] = await connection.query(
      `SELECT
        st.*,
        u.first_name,
        u.last_name,
        u.email,
        u.phone
      FROM support_tickets st
      JOIN users u ON st.user_id = u.id
      WHERE st.id = ?`,
      [ticketId]
    );

    if (tickets.length === 0) {
      return null;
    }

    return buildTicketDetail(tickets[0]);
  } finally {
    connection.release();
  }
};

const appendSupportMessage = async (ticketId, messagePayload) => {
  const connection = await db.getConnection();

  try {
    const [tickets] = await connection.query(
      "SELECT messages FROM support_tickets WHERE id = ?",
      [ticketId]
    );

    if (tickets.length === 0) {
      return null;
    }

    const messages = parseMessages(tickets[0].messages);
    messages.push(messagePayload);

    await connection.query(
      `UPDATE support_tickets
       SET messages = ?, last_message_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(messages), ticketId]
    );

    return messagePayload;
  } finally {
    connection.release();
  }
};

const updateSupportTicketStatus = async (ticketId, status) => {
  const connection = await db.getConnection();

  try {
    const [result] = await connection.query(
      `UPDATE support_tickets
       SET status = ?
       WHERE id = ?`,
      [status, ticketId]
    );

    return result.affectedRows > 0;
  } finally {
    connection.release();
  }
};

const deleteSupportMessage = async (ticketId, messageId) => {
  const connection = await db.getConnection();

  try {
    const [tickets] = await connection.query(
      "SELECT messages FROM support_tickets WHERE id = ?",
      [ticketId]
    );

    if (tickets.length === 0) {
      return { found: false, deleted: false };
    }

    const messages = parseMessages(tickets[0].messages);
    const filteredMessages = messages.filter(
      (message) => String(message.id) !== String(messageId)
    );

    if (filteredMessages.length === messages.length) {
      return { found: true, deleted: false };
    }

    await connection.query(
      `UPDATE support_tickets
       SET messages = ?, last_message_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(filteredMessages), ticketId]
    );

    return { found: true, deleted: true };
  } finally {
    connection.release();
  }
};

const deleteSupportTicket = async (ticketId) => {
  const connection = await db.getConnection();

  try {
    const [result] = await connection.query(
      "DELETE FROM support_tickets WHERE id = ?",
      [ticketId]
    );

    return result.affectedRows > 0;
  } finally {
    connection.release();
  }
};

module.exports = {
  createSupportTicket,
  getSupportTickets,
  getSupportTicketById,
  appendSupportMessage,
  updateSupportTicketStatus,
  deleteSupportMessage,
  deleteSupportTicket,
};
