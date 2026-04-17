const db = require("../../config/Connection");
const { sendEmail } = require("../../config/emailService");

// Get all meetings for the logged-in user (Applicant)
const getMyMeetings = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.userId;
    const [meetings] = await connection.query(
      `SELECT m.*, u.first_name, u.last_name, u.email 
       FROM meetings m 
       JOIN users u ON m.user_id = u.id 
       WHERE m.user_id = ? 
       ORDER BY m.meeting_date DESC, m.meeting_time DESC`,
      [userId]
    );
    return res.status(200).json({ success: true, data: meetings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// Get all meetings (Admin)
const getAllMeetings = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const [meetings] = await connection.query(
      `SELECT m.*, u.first_name, u.last_name, u.email, u.phone 
       FROM meetings m 
       JOIN users u ON m.user_id = u.id 
       ORDER BY m.meeting_date DESC, m.meeting_time DESC`
    );
    return res.status(200).json({ success: true, data: meetings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// Check if a date is already booked
const checkDateAvailability = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { date } = req.query;
    const [existing] = await connection.query(
      `SELECT id FROM meetings 
       WHERE meeting_date = ? AND status IN ('pending', 'approved')`,
      [date]
    );
    return res.status(200).json({ 
      success: true, 
      available: existing.length === 0,
      message: existing.length > 0 ? 'This date is already booked' : 'Date is available'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// Get booked dates (for calendar display)
const getBookedDates = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const [bookedDates] = await connection.query(
      `SELECT meeting_date, status FROM meetings 
       WHERE status IN ('pending', 'approved')
       ORDER BY meeting_date ASC`
    );
    return res.status(200).json({ success: true, data: bookedDates });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// Schedule a new meeting (Applicant)
const scheduleMeeting = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.userId;
    const { meeting_date, meeting_time, purpose, notes } = req.body;

    // Check if date is already booked
    const [existing] = await connection.query(
      `SELECT id FROM meetings 
       WHERE meeting_date = ? AND status IN ('pending', 'approved')`,
      [meeting_date]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'This date is already booked. Please select another date.' 
      });
    }

    // Get user info for email
    const [users] = await connection.query(
      `SELECT first_name, last_name, email, phone FROM users WHERE id = ?`,
      [userId]
    );
    const user = users[0];

    // Insert meeting
    const [result] = await connection.query(
      `INSERT INTO meetings (user_id, meeting_date, meeting_time, purpose, notes, status) 
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [userId, meeting_date, meeting_time, purpose || 'Visa Consultation', notes]
    );

    // Send email to Super Admin
    try {
      const [admins] = await connection.query(
        `SELECT u.email, u.first_name FROM users u 
         JOIN user_roles ur ON u.id = ur.user_id 
         WHERE ur.role_id = 1`
      );

      console.log('Found admins for email:', admins);

      if (admins.length > 0) {
        const adminEmail = admins[0].email;
        console.log('Sending meeting request email to admin:', adminEmail);
        
        const formattedDate = new Date(meeting_date).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        await sendEmail({
          to: adminEmail,
          subject: 'New Meeting Request - Visa Consultancy',
          htmlBody: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0;">New Meeting Request</h1>
              </div>
              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
                <h2 style="color: #333; margin-top: 0;">Applicant Information</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #667eea;">Name:</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${user.first_name} ${user.last_name}</td></tr>
                  <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #667eea;">Email:</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${user.email}</td></tr>
                  <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #667eea;">Phone:</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${user.phone || 'N/A'}</td></tr>
                  <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #667eea;">Date:</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${formattedDate}</td></tr>
                  <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #667eea;">Time:</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${meeting_time}</td></tr>
                  <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #667eea;">Purpose:</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${purpose || 'Visa Consultation'}</td></tr>
                  ${notes ? `<tr><td style="padding: 10px; font-weight: bold; color: #667eea;">Notes:</td><td style="padding: 10px;">${notes}</td></tr>` : ''}
                </table>
                <p style="margin-top: 20px; color: #666;">Please login to the admin panel to approve or reject this meeting request.</p>
              </div>
            </div>
          `
        });
        console.log('Email sent to admin successfully');
      } else {
        console.log('No admin found with role_id = 1');
      }
    } catch (emailError) {
      console.error('Failed to send email to admin:', emailError.message);
    }

    return res.status(201).json({ 
      success: true, 
      message: 'Meeting scheduled successfully. Waiting for approval.',
      data: { id: result.insertId }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// Approve meeting (Admin)
const approveMeeting = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;

    const [meetings] = await connection.query(
      `SELECT m.*, u.first_name, u.last_name, u.email 
       FROM meetings m 
       JOIN users u ON m.user_id = u.id 
       WHERE m.id = ?`,
      [id]
    );

    if (meetings.length === 0) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const meeting = meetings[0];

    await connection.query(
      `UPDATE meetings SET status = 'approved' WHERE id = ?`,
      [id]
    );

    // Send approval email to applicant
    try {
      console.log('Sending approval email to applicant:', meeting.email);
      
      const formattedDate = new Date(meeting.meeting_date).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      await sendEmail({
        to: meeting.email,
        subject: 'Meeting Approved - Visa Consultancy',
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">Meeting Approved!</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #333;">Dear ${meeting.first_name} ${meeting.last_name},</p>
              <p style="color: #666;">Great news! Your meeting request has been approved.</p>
              <div style="background: white; padding: 20px; border-radius: 8px; border: 2px solid #10b981; margin: 20px 0;">
                <h3 style="color: #10b981; margin-top: 0;">Meeting Details</h3>
                <p style="margin: 8px 0;"><strong>Date:</strong> ${formattedDate}</p>
                <p style="margin: 8px 0;"><strong>Time:</strong> ${meeting.meeting_time}</p>
                <p style="margin: 8px 0;"><strong>Purpose:</strong> ${meeting.purpose || 'Visa Consultation'}</p>
              </div>
              <p style="color: #666;">Please make sure to be available at the scheduled time.</p>
              <p style="color: #666; margin-top: 20px;">Best regards,<br>Visa Consultancy Team</p>
            </div>
          </div>
        `
      });
      console.log('Approval email sent successfully');
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError.message);
    }

    return res.status(200).json({ success: true, message: 'Meeting approved successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// Reject meeting (Admin)
const rejectMeeting = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;

    const [meetings] = await connection.query(
      `SELECT m.*, u.first_name, u.last_name, u.email 
       FROM meetings m 
       JOIN users u ON m.user_id = u.id 
       WHERE m.id = ?`,
      [id]
    );

    if (meetings.length === 0) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const meeting = meetings[0];

    await connection.query(
      `UPDATE meetings SET status = 'rejected' WHERE id = ?`,
      [id]
    );

    // Send rejection email to applicant
    try {
      console.log('Sending rejection email to applicant:', meeting.email);
      
      const formattedDate = new Date(meeting.meeting_date).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      await sendEmail({
        to: meeting.email,
        subject: 'Meeting Request Update - Visa Consultancy',
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">Meeting Request Update</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
              <p style="font-size: 16px; color: #333;">Dear ${meeting.first_name} ${meeting.last_name},</p>
              <p style="color: #666;">We regret to inform you that your meeting request could not be approved at this time.</p>
              <div style="background: white; padding: 20px; border-radius: 8px; border: 2px solid #ef4444; margin: 20px 0;">
                <h3 style="color: #ef4444; margin-top: 0;">Meeting Details</h3>
                <p style="margin: 8px 0;"><strong>Date:</strong> ${formattedDate}</p>
                <p style="margin: 8px 0;"><strong>Time:</strong> ${meeting.meeting_time}</p>
              </div>
              <p style="color: #666;">Please feel free to schedule another meeting at a different time.</p>
              <p style="color: #666; margin-top: 20px;">Best regards,<br>Visa Consultancy Team</p>
            </div>
          </div>
        `
      });
      console.log('Rejection email sent successfully');
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError.message);
    }

    return res.status(200).json({ success: true, message: 'Meeting rejected' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

// Cancel meeting (Applicant)
const cancelMeeting = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const [result] = await connection.query(
      `UPDATE meetings SET status = 'cancelled' WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    return res.status(200).json({ success: true, message: 'Meeting cancelled successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

module.exports = {
  getMyMeetings,
  getAllMeetings,
  checkDateAvailability,
  getBookedDates,
  scheduleMeeting,
  approveMeeting,
  rejectMeeting,
  cancelMeeting
};
