"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
async function sendEmail({ to, subject, text, html, recipientName }) {
    let brevoApiKey = (process.env.BREVO_API_KEY || '').trim();
    let smtpPass = (process.env.BREVO_SMTP_KEY || '').trim();
    const smtpUser = (process.env.BREVO_SMTP_USER || process.env.EMAIL_USER || 'wearegoalcreatives@gmail.com').trim();
    const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || 'wearegoalcreatives@gmail.com').trim();
    const senderName = process.env.BREVO_SENDER_NAME || 'GC Studio';
    // If user pasted an SMTP key (starts with xsmtpsib-) into BREVO_API_KEY, automatically route to SMTP Relay!
    if (brevoApiKey.startsWith('xsmtpsib-') && !smtpPass) {
        smtpPass = brevoApiKey;
        brevoApiKey = '';
    }
    // 1. Try Brevo REST API via HTTPS (Port 443 - fastest, never blocked by cloud firewall)
    if (brevoApiKey && !brevoApiKey.startsWith('xsmtpsib-')) {
        const payload = {
            sender: { name: senderName, email: senderEmail },
            to: [{ email: to, name: recipientName || to.split('@')[0] }],
            subject,
            textContent: text,
            htmlContent: html || `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #111;">${subject}</h2>
        <p style="white-space: pre-line; font-size: 15px;">${text}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0 10px;" />
        <p style="font-size: 12px; color: #888;">This is an automated message from ${senderName}. Please do not reply directly to this email.</p>
      </div>`
        };
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': brevoApiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            let errorBody = '';
            try {
                const errorJson = await res.json();
                errorBody = errorJson.message || JSON.stringify(errorJson);
            }
            catch {
                errorBody = await res.text();
            }
            throw new Error(`Brevo API error (${res.status}): ${errorBody}`);
        }
        return await res.json();
    }
    // 2. Brevo SMTP Relay via Nodemailer (Port 587)
    const smtpHost = process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST || 'smtp-relay.brevo.com';
    const smtpPort = Number(process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT || 587);
    if (!smtpPass && !brevoApiKey) {
        throw new Error('No email credentials configured. Please set BREVO_API_KEY or BREVO_SMTP_KEY in .env');
    }
    const transporter = nodemailer_1.default.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
            user: smtpUser,
            pass: smtpPass
        }
    });
    return await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to,
        subject,
        text,
        html: html || `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #111;">${subject}</h2>
      <p style="white-space: pre-line; font-size: 15px;">${text}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0 10px;" />
      <p style="font-size: 12px; color: #888;">This is an automated message from ${senderName}. Please do not reply directly to this email.</p>
    </div>`
    });
}
