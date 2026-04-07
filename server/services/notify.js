// server/services/notify.js
import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} = process.env;

// If SMTP isn't configured, we "mock" email by logging to console.
// This keeps dev flows working without failing the agent.
const smtpEnabled = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

// Create a single pooled, rate-limited transporter so Mailtrap Testing
// doesn’t 550-throttle ("Too many emails per second").
let transporter = null;

if (smtpEnabled) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: String(SMTP_SECURE) === "true", // false for 587/2525 (STARTTLS)
    auth: { user: SMTP_USER, pass: SMTP_PASS },

    // ✅ Pool + rate limit
    pool: true,
    maxConnections: 1,   // only one SMTP connection
    maxMessages: Infinity,
    rateDelta: 1000,     // 1s window
    rateLimit: 1,        // 1 message per second
  });
}

/**
 * Send an HTML email. If SMTP is not configured, this will log instead.
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 * @returns {Promise<{messageId?: string, mocked?: boolean}>}
 */
export async function sendEmail(to, subject, html) {
  if (!smtpEnabled) {
    console.log("[EMAIL MOCK]", { to, subject });
    return { mocked: true };
  }

  const info = await transporter.sendMail({
    from: SMTP_FROM || "PriceKlick <no-reply@priceklick.com>",
    to,
    subject,
    html,
  });

  return { messageId: info.messageId };
}

/**
 * Optional: verify SMTP connection at startup or in a health check.
 * Will throw if creds/host are wrong.
 */
export async function verifyEmailTransport() {
  if (!smtpEnabled) return { ok: true, mocked: true };
  await transporter.verify();
  return { ok: true, mocked: false };
}
