import nodemailer from "nodemailer";
import "dotenv/config";
import crypto from "crypto";

const transport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.Owner_Email,
    pass: process.env.Owner_password,
  },
});

export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  html: string,
) => {
  const mailOptions = {
    from: process.env.Owner_Email, // Sender's email address
    to, // Recipient's email address
    subject, // Email subject
    text, // Plain text version of the email
    html, // HTML version of the email
  };

  try {
    const data = await transport.sendMail(mailOptions);
    console.log(`Email sent: ${data.messageId}`);
    return data;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
};
