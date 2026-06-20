import nodemailer from 'nodemailer';
import { env } from '../config/env.ts';

// creating the transporter for sending emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.emailUser,
    pass: env.emailPass,
  },
});

export default transporter;
