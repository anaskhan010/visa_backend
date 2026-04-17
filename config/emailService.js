const axios = require("axios");

const fromEmail = process.env.EMAILIT_FROM_EMAIL || "info@sentrixre.com";
const apiKey = process.env.EMAILIT_API_KEY;

exports.sendEmail = async ({ to, subject, htmlBody }) => {
  try {
    if (!apiKey) {
      throw new Error("EMAILIT_API_KEY is not configured");
    }

    const emailPayload = {
      from: fromEmail,
      to,
      subject,
      html: htmlBody,
    };

    const response = await axios.post(
      "https://api.emailit.com/v1/emails",
      emailPayload,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Email sending failed:",
      error.response?.data || error.message
    );
    throw error;
  }
};

exports.sendVerificationEmail = async (email, verificationToken, verificationLink) => {
  const subject = "Verify Your Email Address";
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Email Verification</h2>
      <p>Thank you for registering with us! Please verify your email address by clicking the link below:</p>
      <p style="margin: 20px 0;">
        <a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Verify Email
        </a>
      </p>
      <p>Or copy and paste this link in your browser:</p>
      <p style="word-break: break-all; color: #666;">${verificationLink}</p>
      <p style="color: #999; font-size: 12px;">This verification link will expire in 5 minutes.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #999; font-size: 12px;">If you didn't create this account, please ignore this email.</p>
    </div>
  `;

  return exports.sendEmail({ to: email, subject, htmlBody });
};

exports.sendPasswordResetOtpEmail = async (email, firstName, otp) => {
  const subject = "Your Password Reset OTP";
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>Hello ${firstName || "User"},</p>
      <p>Use the 4-digit OTP below to reset your password:</p>
      <div style="margin: 24px 0; padding: 16px; background-color: #f7f7f7; border-radius: 8px; text-align: center;">
        <span style="font-size: 32px; letter-spacing: 10px; font-weight: 700; color: #e5a105;">${otp}</span>
      </div>
      <p style="color: #666;">This OTP will expire in 5 minutes.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #999; font-size: 12px;">If you did not request a password reset, please ignore this email.</p>
    </div>
  `;

  return exports.sendEmail({ to: email, subject, htmlBody });
};
