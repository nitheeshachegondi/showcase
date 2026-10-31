/**
 * Email sending for review verification.
 *  - "resend": RESEND_API_KEY + MAIL_FROM are set → real emails via Resend (https://resend.com).
 *  - "dev":    no provider, but not production → the verify link is returned to the browser for testing.
 *  - "off":    production without a provider → review submission is switched off (we never accept
 *              unverifiable reviews).
 */
export type MailMode = "resend" | "dev" | "off";

export function mailMode(): MailMode {
  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) return "resend";
  return process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_REVIEWS !== "1" ? "off" : "dev";
}

export async function sendVerificationEmail(to: string, link: string, productName: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [to],
      subject: `Confirm your review of ${productName}`,
      text: `Thanks for reviewing ${productName}.\n\nConfirm your email to publish your review:\n${link}\n\nIf you didn't write this review, ignore this email and nothing will be published.`,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Could not send the verification email (${res.status}). ${detail.slice(0, 120)}`);
  }
}
