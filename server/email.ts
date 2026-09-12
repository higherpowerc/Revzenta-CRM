/**
 * 3g-4 — shared email module (client intake + welcome emails).
 *
 * Sends via Resend's built-in test sender (`onboarding@resend.dev`) — no
 * domain purchase needed; a real domain comes at Phase 5. The app must NEVER
 * crash or fail a request because email is not configured: when
 * RESEND_API_KEY is unset, `sendEmail` logs a skip line and returns a
 * non-ok result (never throws), so callers can fire-and-forget it from the
 * provisioning/login paths without touching the request that triggered it.
 *
 * Live-test finding #1 (2026-08-15): Resend's test mode returns HTTP 422 for
 * recipients that aren't the account owner's email, and the app still showed
 * "sent" because the old fire-and-forget `sendEmail` swallowed errors. The
 * return value now carries the outcome (`{ ok: true }` vs `{ ok: false,
 * error }`) so the two user-visible flows the owner hit (account
 * provisioning + agreement send) can surface a real "email failed" state.
 *
 * Reference for the exact Resend call shape (Bearer auth, `from` shape,
 * graceful key-missing handling): /home/team/shared/site/src/lib/contact.ts
 */

const RESEND_API = process.env.RESEND_URL ?? "https://api.resend.com/emails";

export function cleanBranding(str: string): string {
  if (!str) return str;
  return str
    .replace(/Elevate\s*Studio\s*CRM/gi, "Revzenta CRM")
    .replace(/Elevate\s*Studio/gi, "Revzenta")
    .replace(/Elevate\s*Capital/gi, "Revzenta")
    .replace(/Elevate\s*CRM/gi, "Revzenta CRM")
    .replace(/\belevate\b/gi, "Revzenta");
}

export function getSendingEmailAddress(): string {
  const env = (process.env.EMAIL_FROM ?? "").trim();
  if (env) {
    const match = env.match(/<([^>]+)>/);
    if (match) return match[1].trim();
    if (env.includes("@")) return env;
  }
  return "onboarding@resend.dev";
}

export function resolveEmailFrom(fromName?: string): string {
  const emailAddr = getSendingEmailAddress();
  const trimmedName = fromName?.trim();
  if (trimmedName) {
    const cleanName = trimmedName.replace(/["<>]/g, "").trim();
    return `${cleanName} <${emailAddr}>`;
  }
  const env = (process.env.EMAIL_FROM ?? "").trim();
  if (env) return cleanBranding(env);
  return `Revzenta <${emailAddr}>`;
}

/** The sender shown on every email. */
export const EMAIL_FROM = resolveEmailFrom();
/** The exact error returned when RESEND_API_KEY is unset — call sites map it
 *  to the "skipped" emailStatus (deliberate no-op, not a failure). */
export const RESEND_KEY_MISSING_ERROR = "RESEND_API_KEY not configured";
/** Outcome of one sendEmail call. Never throws — every failure path returns
 *  `{ ok: false, error }` so callers can report email failures without
 *  try/catch of their own. */
export type SendEmailResult = { ok: true; id?: string } | { ok: false; error: string };
/** App URL used when the triggering request has no usable origin. */
export const DEFAULT_APP_URL = "https://app.revzenta.com";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromName?: string;
  replyTo?: string;
  /** When TEST_EMAIL_TO is set, redirect the delivery there and prefix the
   *  body with "[TEST] Intended for <to>". Defaults to true — this module
   *  only sends client-facing mail (owner mail, when it exists, can opt out
   *  by passing false). */
  testRedirect?: boolean;
  /** Phase 5 — optional file attachments (Resend's `attachments` array).
   *  `content` is base64. The e2e mock records them as-is, so the billing
   *  suite asserts the PDF attachment lands. */
  attachments?: { filename: string; content: string; content_type: string }[];
}

/** The best public URL for the app: the triggering request's origin when one
 *  is present (a browser request usually carries it), else the production
 *  fallback. */
export function appUrlFrom(req?: Request): string {
  if (!req) return DEFAULT_APP_URL;
  const origin = req.headers.get("origin") ?? "";
  if (/^https?:\/\/[^\s/]+/.test(origin)) return origin.replace(/\/+$/, "");

  // Check Referer header (sent on GET requests by browsers)
  const referer = req.headers.get("referer") ?? "";
  if (/^https?:\/\/[^\s/]+/.test(referer)) {
    try {
      const u = new URL(referer);
      return `${u.protocol}//${u.host}`;
    } catch {}
  }

  // Check x-forwarded-host or host headers
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
    return `${proto}://${host}`.replace(/\/+$/, "");
  }

  try {
    const u = new URL(req.url);
    if (u.origin && !u.origin.includes("localhost") && !u.origin.includes("127.0.0.1")) {
      return u.origin;
    }
  } catch {}

  if (host) {
    return `${proto}://${host}`.replace(/\/+$/, "");
  }

  return DEFAULT_APP_URL;
}

/**
 * POST a plain-text (optionally HTML) email through Resend. NEVER throws and
 * NEVER rejects: every failure path returns `{ ok: false, error }` so callers
 * can fire and forget without try/catch of their own — and, since the
 * live-test finding, can SEE when a send actually failed (e.g. Resend's 422
 * test-mode rejection) instead of believing it went out.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY ?? "";
  if (!apiKey) {
    console.log(
      `[email] RESEND_API_KEY not configured — skipping ${input.subject} to ${input.to}`,
    );
    return { ok: false, error: RESEND_KEY_MISSING_ERROR };
  }
  try {
    const testTo = (process.env.TEST_EMAIL_TO ?? "").trim();
    const redirect = input.testRedirect !== false && testTo !== "";
    const to = redirect ? testTo : input.to;
    const text = redirect ? `[TEST] Intended for ${input.to}\n\n${input.text}` : input.text;
    const fromSender = resolveEmailFrom(input.fromName);
    const body: Record<string, unknown> = {
      from: fromSender,
      to: [to],
      subject: cleanBranding(input.subject),
      text: cleanBranding(text),
    };
    if (input.replyTo && input.replyTo.trim()) {
      body.reply_to = input.replyTo.trim();
    }
    if (input.html) body.html = cleanBranding(input.html);
    if (input.attachments && input.attachments.length > 0) body.attachments = input.attachments;
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // Resend rejects with a JSON body: { message: "..." } (e.g. the 422
      // test-mode rejection). Surface the message so the UI can show the
      // owner exactly why the email didn't go out.
      const detail = await res.text().catch(() => "");
      let message = detail;
      try {
        const parsed = JSON.parse(detail) as { message?: unknown };
        if (typeof parsed.message === "string" && parsed.message.trim() !== "") {
          message = parsed.message;
        }
      } catch {
        /* non-JSON body — keep the raw text */
      }
      console.error(`[email] Resend returned ${res.status} for "${input.subject}" to ${to}: ${message}`);
      return { ok: false, error: `Resend returned ${res.status}: ${message}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    console.log(`[email] Sent "${input.subject}" to ${to} (resend id: ${data.id ?? "unknown"})`);
    return { ok: true, id: data.id };
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error(`[email] Resend request failed for "${input.subject}": ${m}`);
    return { ok: false, error: m };
  }
}

/** 3g-4 intake email — sent right after a sold lead's workspace is
 *  auto-provisioned: login credentials + a pointer to onboarding. */
export function sendIntakeEmail(opts: {
  to: string;
  orgName: string;
  loginEmail: string;
  tempPassword: string;
  appUrl: string;
  businessName?: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const biz = opts.businessName?.trim() || opts.orgName?.trim() || "Revzenta";
  const text = [
    "Hi there,",
    "",
    `Great news — your ${opts.orgName} workspace is ready.`,
    "",
    `Sign in here: ${opts.appUrl}`,
    "",
    `Email:    ${opts.loginEmail}`,
    `Password: ${opts.tempPassword}`,
    "",
    "Once you're in, you can finish setting up your workspace: add your clients,",
    "set up your pipeline, and start tracking tasks and invoices.",
    "",
    `Your ${biz} team is here if you need anything.`,
    "",
    `— ${biz}`,
  ].join("\n");
  return sendEmail({
    to: opts.to,
    fromName: biz,
    replyTo: opts.replyTo,
    subject: `Welcome to ${biz} — your workspace is ready`,
    text,
  });
}

/** 3g-4 welcome email — sent once, on the member's first successful login.
 *  Orientation only — deliberately no credentials in this one. */
export function sendWelcomeEmail(opts: {
  to: string;
  orgName: string;
  appUrl: string;
  businessName?: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const biz = opts.businessName?.trim() || opts.orgName?.trim() || "Revzenta";
  const text = [
    "Hi there,",
    "",
    `Welcome to ${biz}. Your workspace is set up and ready to go — here's a quick orientation:`,
    "",
    "1. Set up your workspace — rename your pipeline stages and pick your accent color in Settings.",
    "2. Add your clients and move them through your pipeline as work comes in.",
    "3. Track your tasks and invoices to stay on top of everything.",
    "",
    `Sign in anytime at: ${opts.appUrl}`,
    "",
    `— ${biz}`,
  ].join("\n");
  return sendEmail({
    to: opts.to,
    fromName: biz,
    replyTo: opts.replyTo,
    subject: `Welcome to ${biz} — let's get started`,
    text,
  });
}

/** 3k — password reset email, sent from the forgot-password flow. The raw
 *  token appears ONLY in this email (the server stores a SHA-256 hash); the
 *  link is a single-use, time-boxed reset page in the SPA. `appUrl` comes
 *  from appUrlFrom(req) exactly like the 3g-4 emails, so the link points at
 *  the origin the user actually came from (production fallback otherwise). */
export function sendPasswordResetEmail(opts: {
  to: string;
  appUrl: string;
  token: string;
  businessName?: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const biz = opts.businessName?.trim() || "Revzenta";
  const resetUrl = `${opts.appUrl}/#/reset?token=${opts.token}`;
  const text = [
    "Hi there,",
    "",
    `We got a request to reset your ${biz} password. Open the link below to choose a new one:`,
    "",
    resetUrl,
    "",
    "This link works for 45 minutes and can only be used once.",
    "",
    "If you didn't ask to reset your password, you can safely ignore this email — your password won't change.",
    "",
    `— ${biz}`,
  ].join("\n");
  return sendEmail({
    to: opts.to,
    fromName: biz,
    replyTo: opts.replyTo,
    subject: `Reset your ${biz} password`,
    text,
  });
}

/** Native e-signature (owner direction 2026-08-15) — the client's unique
 *  agreement signing link. The token appears ONLY in this email (the server
 *  stores its SHA-256 hash); the link is one-time use and expires after 30
 *  days. `appUrl` comes from appUrlFrom(req) exactly like the 3g-4 emails. */
export function sendAgreementEmail(opts: {
  to: string;
  clientName: string;
  appUrl: string;
  token: string;
  businessName?: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const biz = opts.businessName?.trim() || "Revzenta";
  const signUrl = `${opts.appUrl}/sign/${opts.token}`;
  const text = [
    `Hi ${opts.clientName},`,
    "",
    `Good news — your agreement with ${biz} is ready to review and sign.`,
    "",
    "Open the link below to read the agreement and sign it electronically:",
    "",
    signUrl,
    "",
    "The link is unique to you, works once, and expires in 30 days.",
    "",
    "If you have any questions, just reply to this email.",
    "",
    `— ${biz}`,
  ].join("\n");
  return sendEmail({
    to: opts.to,
    fromName: biz,
    replyTo: opts.replyTo,
    subject: `Your agreement with ${biz} is ready to sign`,
    text,
  });
}

/** Phase 5 prep — Stripe payment link (live-test finding 2026-08-17): the
 *  client's unique payment link for their subscription / invoice. Sent
 *  only when the payment-link endpoint successfully created the Stripe link
 *  (the caller checks Stripe success BEFORE calling this). The amount is the
 *  OWNER-entered figure at bill time (no hard-coded rates) — it shows in the
 *  email so the client knows what they're approving. */
export function sendPaymentLinkEmail(opts: {
  to: string;
  clientName: string;
  linkUrl: string;
  amountCents?: number;
  interval?: "month" | "one_time";
  businessName?: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const biz = opts.businessName?.trim() || "Revzenta";
  const amountText =
    opts.amountCents && opts.amountCents > 0
      ? `Your ${opts.interval === "one_time" ? "invoice" : "monthly"} amount is ${fmtUsd(opts.amountCents)}.`
      : "";
  const lines = [
    `Hi ${opts.clientName},`,
    "",
    `Your invoice / payment link from ${biz} is ready.`,
    "",
  ];
  if (amountText) lines.push(amountText, "");
  lines.push(
    "Use the secure payment link below to complete your payment:",
    "",
    opts.linkUrl,
    "",
    "The link is unique to you and takes you straight to checkout.",
    "",
    "If you have any questions, just reply to this email.",
    "",
    `— ${biz}`,
  );
  return sendEmail({
    to: opts.to,
    fromName: biz,
    replyTo: opts.replyTo,
    subject: `Payment link from ${biz}`,
    text: lines.join("\n"),
  });
}

/** Arizona MST helpers — demo times are stored as naive "YYYY-MM-DDTHH:MM"
 *  Arizona wall-clock strings (UTC-7, no DST), so we format them with pure
 *  string math — never through a Date/timezone object, so the time can't
 *  shift into the reader's timezone. Mirrors src/demoTime.ts on the client. */
function fmtMstTime(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? "").trim());
  if (!m) return hhmm;
  const hh = parseInt(m[1], 10);
  const mm = m[2];
  const ap = hh >= 12 ? "PM" : "AM";
  let h12 = hh % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${mm} ${ap} MST`;
}
const MST_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
/** "2026-08-26T16:00" -> "Wed, Aug 26 at 4:00 PM MST (Arizona, UTC-7, no DST)" */
function fmtMstDateTime(dt: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{1,2}):(\d{2})$/.exec((dt ?? "").trim());
  if (!m) return dt;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(y, mo - 1, d, 12).getDay()];
  return `${dow}, ${MST_MONTHS[mo - 1]} ${d}, ${y} at ${fmtMstTime(`${m[4]}:${m[5]}`)} (Arizona, UTC-7, no DST)`;
}

/** Owner 2026-08-20 sales rework — demo-call confirmation email. Sent when
 *  the owner clicks "Schedule Demo" on a lead: the prospect gets the date/time
 *  of their demo call (Arizona MST), the pasted meeting link
 *  (Zoom/Google Meet) if provided, and a short calendar line. We do NOT
 *  integrate Zoom/Google APIs — purely "send the provided link in the invite
 *  email". Fire-and-forget (sendEmail never throws) — a delivery failure is
 *  surfaced to the owner as a notice, never a crash. */
export function sendDemoCallEmail(opts: {
  to: string;
  clientName: string;
  scheduledAt: string;
  meetingLink?: string;
  businessName?: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const biz = opts.businessName?.trim() || "Revzenta";
  const when = fmtMstDateTime(opts.scheduledAt);
  const text: string[] = [
    `Great news, ${opts.clientName}!`,
    "",
    `Your call with ${biz} is scheduled for ${when}.`,
  ];
  if (opts.meetingLink) {
    text.push("", `Join the meeting here: ${opts.meetingLink}`, "");
  }
  text.push(
    "Calendar: add this to your calendar — " + when + ` ${biz} call.`,
    "",
    "If you need to reschedule, just reply to this email.",
    "",
    `— ${biz}`,
  );
  return sendEmail({
    to: opts.to,
    fromName: biz,
    replyTo: opts.replyTo,
    subject: `Your ${biz} appointment is scheduled`,
    text: text.join("\n"),
  });
}

/** Appointments production (backlog 5a104eae) — the "appointment tomorrow"
 *  reminder. The two action links are the credential: each carries
 *  the appointment's unguessable token so the recipient can Confirm (flips
 *  status → confirmed) or Reschedule (pick a new time) WITHOUT logging in.
 *  reminderKind (owner 2026-08-27): demo-call appointments are reminded
 *  1 hour before the call ("hour" → "is in 1 hour" subject/lead line);
 *  every other appointment keeps the classic day-before wording ("day",
 *  the default). Fire-and-forget like every transactional email. */
export function sendAppointmentReminderEmail(opts: {
  to: string;
  clientName: string;
  scheduledAt: string;
  confirmUrl: string;
  rescheduleUrl: string;
  reminderKind?: "day" | "hour";
  businessName?: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const biz = opts.businessName?.trim() || "Revzenta";
  const when = fmtMstDateTime(opts.scheduledAt);
  const hour = opts.reminderKind === "hour";
  const text = [
    `Hi ${opts.clientName},`,
    "",
    hour
      ? `A reminder that your appointment with ${biz} is in 1 hour: ${when}.`
      : `A reminder that your appointment with ${biz} is coming up: ${when}.`,
    "",
    "Please confirm so we know you're still coming:",
    opts.confirmUrl,
    "",
    "Need a different time? Reschedule here:",
    opts.rescheduleUrl,
    "",
    `— ${biz}`,
  ].join("\n");
  return sendEmail({
    to: opts.to,
    fromName: biz,
    replyTo: opts.replyTo,
    subject: hour ? `Your ${biz} appointment is in 1 hour` : `Your ${biz} appointment is tomorrow`,
    text,
  });
}
function fmtUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Phase 5 — invoice-paid email. Sent the moment a Stripe webhook records a
 *  real payment: the client gets a short summary + the invoice PDF attached.
 *  `pdfBase64` is the base64 invoice PDF (server/invoices.ts); the mock
 *  Resend the e2e suite uses records the attachment so the suite asserts it. */
export function sendInvoiceEmail(opts: {
  to: string;
  clientName: string;
  amountCents: number;
  paidAt: string;
  invoiceNumber: string;
  pdfBase64: string;
  businessName?: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const biz = opts.businessName?.trim() || "Revzenta";
  const text = [
    `Hi ${opts.clientName},`,
    "",
    `We received your payment of ${fmtUsd(opts.amountCents)} — thank you!`,
    "",
    `Invoice #${opts.invoiceNumber} from ${biz} is paid in full and attached to this email.`,
    "",
    "If you have any questions, just reply to this email.",
    "",
    `— ${biz}`,
  ].join("\n");
  return sendEmail({
    to: opts.to,
    fromName: biz,
    replyTo: opts.replyTo,
    subject: `Invoice ${opts.invoiceNumber} is paid — ${fmtUsd(opts.amountCents)} received`,
    text,
    attachments: [
      {
        filename: `invoice-${opts.invoiceNumber}.pdf`,
        content: opts.pdfBase64,
        content_type: "application/pdf",
      },
    ],
  });
}
/** Owner direction (backlog 58435d2b) — when a CLIENT account submits a
 *  support ticket, alert the owner by email with the account name, the
 *  subject, a short message snippet, and a link into the app (where the owner
 *  opens the ticket and can draft a reply). Fired for tenant-org tickets only
 *  (never the owner's own org — the owner doesn't email themselves). */
export function sendTicketOwnerAlertEmail(opts: {
  to: string;
  clientName: string;
  subject: string;
  messageSnippet: string;
  appUrl: string;
  businessName?: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const biz = opts.businessName?.trim() || "Revzenta";
  const text = [
    `New support ticket from ${opts.clientName}:`,
    "",
    `Subject: ${opts.subject}`,
    "",
    `Message:`,
    opts.messageSnippet,
    "",
    `Open the ticket: ${opts.appUrl}/`,
    "",
    "Reply to the ticket in the app — drafts are only mailed to the client",
    "after you approve them.",
    "",
    `— ${biz}`,
  ].join("\n");
  return sendEmail({
    to: opts.to,
    fromName: biz,
    replyTo: opts.replyTo,
    subject: `New support ticket from ${opts.clientName}: ${opts.subject}`,
    text,
  });
}
/** Owner direction (backlog 58435d2b) — after the owner confirms ("Approve &
 *  send") a ticket reply in the app, email the reply body to the submitting
 *  account's contact. Only ever called at the explicit send step — a draft is
 *  never emailed. */
export function sendTicketReplyEmail(opts: {
  to: string;
  ticketSubject: string;
  replyBody: string;
  businessName?: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const biz = opts.businessName?.trim() || "Revzenta";
  const text = [
    `Re: ${opts.ticketSubject}`,
    "",
    opts.replyBody,
    "",
    "If you have more questions, just reply to this email or submit another",
    `ticket in your ${biz} workspace.`,
    "",
    `— ${biz}`,
  ].join("\n");
  return sendEmail({
    to: opts.to,
    fromName: biz,
    replyTo: opts.replyTo,
    subject: `Re: ${opts.ticketSubject}`,
    text,
  });
}

/**
 * Client Checkout & Self-Serve Signup:
 * Dispatches a comprehensive welcome email containing the new member's
 * login credentials (URL, email, password), workspace details, package tier,
 * and quick-start guide.
 */
export function sendSignupWelcomeEmail(opts: {
  to: string;
  workspaceName: string;
  email: string;
  password?: string;
  tier: string;
  appUrl: string;
  businessName?: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const biz = opts.businessName?.trim() || "Revzenta";
  const loginUrl = `${opts.appUrl}/#/login`;
  const tierName =
    opts.tier === "scale"
      ? "Scale Empire Plan ($79/mo)"
      : opts.tier === "starter"
      ? "Starter Wholesaler Plan ($24.99/mo)"
      : "Wholesale Pro Plan ($59.99/mo)";

  const text = [
    `Welcome to ${biz}!`,
    "",
    `Your wholesale real estate workspace has been provisioned and is ready for action.`,
    "",
    `========================================`,
    `YOUR LOGIN CREDENTIALS & WORKSPACE ACCESS`,
    `========================================`,
    `Sign In URL: ${loginUrl}`,
    `Workspace:   ${opts.workspaceName}`,
    `Email:       ${opts.email}`,
    ...(opts.password ? [`Password:    ${opts.password}`] : []),
    `Active Plan: ${tierName}`,
    "",
    `========================================`,
    `WHOLESALE REAL ESTATE QUICK START GUIDE`,
    `========================================`,
    `1. Launch your CRM: Log in at ${loginUrl} using your credentials above.`,
    `2. Pipeline & Leads: Import or add distressed property sellers directly to your pipeline.`,
    `3. Fast MAO Calculation: Use the built-in Wholesale Calculator (MAO = ARV * 70% - Repairs - Wholesale Fee) to formulate unbeatable offers.`,
    `4. Instant Contracts: Generate legally binding Purchase and Assignment Agreements with 1-click PDF stamping and digital signatures.`,
    `5. Transaction Hub & Title Coordination: Track Earnest Money Deposits (EMD) and coordinate closing seamlessly with your title company.`,
    "",
    `Need assistance or have questions? Simply reply to this email or submit a ticket in your CRM.`,
    "",
    `To your closing success,`,
    `The ${biz} Team`,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${biz}</title>
</head>
<body style="margin:0;padding:0;background-color:#090d16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;">
  <div style="max-width:600px;margin:30px auto;background:#0f172a;border-radius:16px;border:1px solid #1e293b;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.6);">
    <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#06b6d4 100%);padding:32px 28px;text-align:center;">
      <h1 style="margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;text-shadow:0 2px 10px rgba(0,0,0,0.3);">
        ⚡ Welcome to ${biz}
      </h1>
      <p style="margin:8px 0 0;font-size:15px;color:rgba(255,255,255,0.9);font-weight:500;">
        Your Wholesale Real Estate Command Center is Live
      </p>
    </div>

    <div style="padding:32px 28px;">
      <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#cbd5e1;">
        Congratulations! Your account has been activated with the <strong style="color:#38bdf8;">${tierName}</strong>. You now have full access to our high-performance wholesaling CRM, automated contracts, and transaction coordination tools.
      </p>

      <div style="background:#131d33;border:1px solid #312e81;border-radius:12px;padding:22px;margin:24px 0;">
        <h2 style="margin:0 0 16px;font-size:16px;text-transform:uppercase;letter-spacing:1px;color:#a5b4fc;">
          🔑 Your Account Credentials
        </h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#e2e8f0;">
          <tr>
            <td style="padding:6px 0;color:#94a3b8;width:120px;">Workspace:</td>
            <td style="padding:6px 0;font-weight:600;color:#ffffff;">${opts.workspaceName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#94a3b8;">Login Email:</td>
            <td style="padding:6px 0;font-weight:600;color:#38bdf8;">${opts.email}</td>
          </tr>
          ${
            opts.password
              ? `<tr>
            <td style="padding:6px 0;color:#94a3b8;">Password:</td>
            <td style="padding:6px 0;font-family:monospace;font-weight:700;color:#f43f5e;">${opts.password}</td>
          </tr>`
              : ""
          }
          <tr>
            <td style="padding:6px 0;color:#94a3b8;">Package Tier:</td>
            <td style="padding:6px 0;font-weight:600;color:#4ade80;">${tierName}</td>
          </tr>
        </table>
      </div>

      <div style="text-align:center;margin:32px 0;">
        <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 34px;border-radius:10px;box-shadow:0 4px 20px rgba(99,102,241,0.4);">
          Launch Your CRM Workspace &rarr;
        </a>
      </div>

      <div style="border-top:1px solid #1e293b;padding-top:24px;margin-top:28px;">
        <h3 style="margin:0 0 14px;font-size:15px;color:#f8fafc;font-weight:700;">
          🚀 Wholesale Quick Start:
        </h3>
        <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#94a3b8;">
          <li><strong style="color:#e2e8f0;">Sign In:</strong> Log into your new workspace using the button above.</li>
          <li><strong style="color:#e2e8f0;">Track Seller Leads:</strong> Add motivated sellers, track distress criteria, and follow pipeline stages.</li>
          <li><strong style="color:#e2e8f0;">Run Deal Numbers:</strong> Calculate 70% rule MAO and maximum cash offers in seconds.</li>
          <li><strong style="color:#e2e8f0;">Generate Agreements:</strong> Create purchase and assignment agreements with digital e-signatures.</li>
          <li><strong style="color:#e2e8f0;">Coordinate Title:</strong> Keep title companies, earnest money deposits, and closing dates synchronized.</li>
        </ol>
      </div>
    </div>

    <div style="background:#090d16;padding:20px 28px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #1e293b;">
      <p style="margin:0;">&copy; ${new Date().getFullYear()} ${biz}. All rights reserved.</p>
      <p style="margin:6px 0 0;">Questions? Reply directly to this email for priority support.</p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: opts.to,
    fromName: biz,
    replyTo: opts.replyTo,
    subject: `Welcome to ${biz} — Your Login Credentials & Wholesale Workspace Access`,
    text,
    html,
  });
}

