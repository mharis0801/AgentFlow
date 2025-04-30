
'use server';
/**
 * @fileOverview Defines a Genkit tool for sending emails using Nodemailer with Gmail.
 * Requires environment variables: GMAIL_EMAIL (your app's Gmail address)
 * and GMAIL_APP_PASSWORD (an App Password generated for your Gmail account).
 * @see https://support.google.com/accounts/answer/185833?hl=en for App Passwords.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import nodemailer from 'nodemailer';

// Ensure environment variables are set
if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_APP_PASSWORD) {
    console.warn(`
        ****************************************************
        * WARNING: GMAIL_EMAIL or GMAIL_APP_PASSWORD       *
        * environment variables not set.                   *
        * Email sending will fail.                         *
        * Please set them in your .env file.               *
        * See https://support.google.com/accounts/answer/185833?hl=en
        * for generating an App Password.                 *
        ****************************************************
    `);
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_EMAIL, // Your Gmail address
        pass: process.env.GMAIL_APP_PASSWORD, // Your Gmail App Password
    },
    tls: {
        // Necessary for some environments, ensures connection security
        rejectUnauthorized: false
    }
});

export const sendEmailTool = ai.defineTool(
  {
    name: 'sendEmail',
    description: 'Sends an email from the dedicated assistant email address using Gmail. Use this to send confirmations, scheduled messages, or meeting invitations.',
    inputSchema: z.object({
      to: z.string().min(1).describe('The recipient\'s email address or a comma-separated list of email addresses.'),
      subject: z.string().describe('The subject line of the email.'),
      body: z.string().describe('The HTML or plain text content of the email body.'),
    }),
    outputSchema: z.object({
      success: z.boolean().describe('Indicates whether the email was successfully sent (or queued for sending).'),
      messageId: z.string().optional().describe('The ID of the sent message provided by the email service, if available.'),
      details: z.string().optional().describe('Additional details or status message from the sending process.'),
    }),
  },
  async (input) => {
    console.log(`Attempting to send email via Nodemailer/Gmail to: ${input.to}`);
    console.log(`Subject: ${input.subject}`);

     // Basic validation for recipient emails
     const recipients = input.to.split(',').map(email => email.trim()).filter(Boolean);
     if (recipients.length === 0) {
       return { success: false, details: "No valid recipient email addresses provided." };
     }
     const invalidEmails = recipients.filter(email => !z.string().email().safeParse(email).success);
     if (invalidEmails.length > 0) {
        return { success: false, details: `Invalid email format(s): ${invalidEmails.join(', ')}` };
     }

     // Check if credentials are theoretically present (they might still be invalid)
     if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_APP_PASSWORD) {
         return {
             success: false,
             details: "Email sending is not configured. Missing GMAIL_EMAIL or GMAIL_APP_PASSWORD."
         };
     }


    const mailOptions = {
      from: `"AgentFlow Assistant" <${process.env.GMAIL_EMAIL}>`, // Sender address
      to: input.to, // List of receivers (comma-separated string is fine)
      subject: input.subject, // Subject line
      html: input.body, // HTML body content
      // text: // Optional: Add plain text version for non-HTML clients
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully via Nodemailer/Gmail:', info.messageId);
      return {
        success: true,
        messageId: info.messageId,
        details: `Email successfully sent to ${input.to}. Message ID: ${info.messageId}`,
      };
    } catch (error: any) {
      console.error('Error sending email via Nodemailer/Gmail:', error);
      return {
        success: false,
        messageId: undefined,
        // Provide a more specific error message if possible
        details: `Failed to send email: ${error.message || 'Unknown Nodemailer error.'} (Code: ${error.code})`,
      };
    }
  }
);
