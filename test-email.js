require('dotenv').config();

let brevoApiKey = (process.env.BREVO_API_KEY || '').trim();
let smtpPass = (process.env.BREVO_SMTP_KEY || '').trim();
const smtpHost = process.env.BREVO_SMTP_HOST || process.env.SMTP_HOST || 'smtp-relay.brevo.com';
const smtpPort = Number(process.env.BREVO_SMTP_PORT || process.env.SMTP_PORT || 587);
const smtpUser = (process.env.BREVO_SMTP_USER || process.env.EMAIL_USER || 'wearegoalcreatives@gmail.com').trim();
const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || 'wearegoalcreatives@gmail.com').trim();
const senderName = process.env.BREVO_SENDER_NAME || 'GC Studio';

if (brevoApiKey.startsWith('xsmtpsib-') && !smtpPass) {
  smtpPass = brevoApiKey;
  brevoApiKey = '';
  console.log('NOTE: Key starts with "xsmtpsib-", automatically routing to Brevo SMTP Relay!');
}

console.log('=== BREVO EMAIL DIAGNOSTIC ===');
console.log('BREVO_API_KEY:', Boolean(brevoApiKey), brevoApiKey ? `(length: ${brevoApiKey.length})` : '');
console.log('BREVO_SMTP_USER:', smtpUser);
console.log('BREVO_SMTP_KEY:', Boolean(smtpPass), smtpPass ? `(length: ${smtpPass.length})` : '');
console.log('BREVO_SENDER_EMAIL:', senderEmail);
console.log('BREVO_SMTP_HOST:', smtpHost, 'PORT:', smtpPort);
console.log('==============================');

async function testBrevoApi() {
  console.log('\n[Method 1] Testing Brevo REST API (HTTPS port 443)...');
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: senderEmail, name: 'Admin' }],
        subject: 'GC Studio - Brevo API Test',
        textContent: 'Testing Brevo REST API via HTTPS port 443.',
        htmlContent: '<p>Testing Brevo REST API via HTTPS port 443. <strong>Working!</strong></p>'
      })
    });

    const data = await res.json();
    if (res.ok) {
      console.log('SUCCESS: Brevo REST API sent email successfully!', data);
      return true;
    } else {
      console.error('FAILED: Brevo REST API returned error:', data);
      return false;
    }
  } catch (err) {
    console.error('ERROR: Could not connect to Brevo REST API:', err);
    return false;
  }
}

async function testBrevoSmtp() {
  console.log('\n[Method 2] Testing Brevo SMTP Relay via Nodemailer (' + smtpHost + ':' + smtpPort + ')...');
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  try {
    console.log('Verifying connection...');
    await transporter.verify();
    console.log('SUCCESS: Brevo SMTP connection verified!');

    console.log('Sending test email to ' + senderEmail + '...');
    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: senderEmail,
      subject: 'GC Studio - Brevo SMTP Test',
      text: 'Testing Brevo SMTP relay via Nodemailer. Working!'
    });
    console.log('SUCCESS: Brevo SMTP email sent! MessageId:', info.messageId);
    return true;
  } catch (err) {
    console.error('FAILED: Brevo SMTP error:', err);
    return false;
  }
}

async function main() {
  if (brevoApiKey) {
    await testBrevoApi();
  } else if (smtpPass) {
    await testBrevoSmtp();
  } else {
    console.error('ERROR: No key found!');
  }
}

main();
