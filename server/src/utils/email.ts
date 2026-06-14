import nodemailer from 'nodemailer';

// validating email credentials from environment variables
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error(
    'EMAIL_USER and EMAIL_PASS env variables must be set for sending emails'
  );

  throw new Error(
    'EMAIL_USER and EMAIL_PASS env variables must be set for sending emails'
  );
}

// creating the transporter for sending emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export default transporter;
