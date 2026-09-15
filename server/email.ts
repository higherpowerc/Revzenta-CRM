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
    `Welcome to ${biz} — The Ultimate Wholesale Platform!`,
    "",
    `Dear ${opts.workspaceName || "Wholesaler"},`,
    "",
    `First and foremost, thank you. We are truly grateful and honored that you have chosen to trust ${biz} as your dedicated partner in your wholesale real estate journey.`,
    "",
    `We know how much dedication, grit, and precision it takes to find motivated sellers, negotiate contracts, and close assignments. Our entire platform was built from the ground up to give you an unfair advantage — from lightning-fast deal underwriting and state-compliant contracts to instant investor flyers and seamless title coordination.`,
    "",
    `========================================`,
    `YOUR WORKSPACE ACCESS DETAILS`,
    `========================================`,
    `Sign In URL:  ${loginUrl}`,
    `Workspace:    ${opts.workspaceName}`,
    `Login Email:  ${opts.email}`,
    ...(opts.password
      ? [`Password:     ${opts.password}`]
      : [`Password:     (The password you chose during registration — or reset anytime via 'Forgot Password')`]),
    `Active Plan:  ${tierName}`,
    "",
    `========================================`,
    `QUICK START TO YOUR NEXT WHOLESALE DEAL`,
    `========================================`,
    `1. Launch CRM: Log into your workspace at ${loginUrl}`,
    `2. Underwrite Deals: Run instant 70% rule MAO calculations & analyze property comps.`,
    `3. Lock & Assign: Generate state-compliant purchase and assignment contracts with 1-click digital e-signatures.`,
    `4. Market Fast: Create instant 1-click investor deal flyers to match cash buyers and close assignments.`,
    "",
    `We are committed to your growth and deal-closing success every step of this journey. If you ever have a question or need assistance, simply reply directly to this email — our team is here for you.`,
    "",
    `With sincere gratitude and to your closing success,`,
    `The ${biz} Team`,
    `${biz} — The Ultimate Wholesale Platform`,
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
    
    <!-- Hero Header -->
    <div style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#06b6d4 100%);padding:36px 28px;text-align:center;">
      <div style="display:inline-block;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.2);padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#e0e7ff;margin-bottom:12px;">
        The Ultimate Wholesale Platform
      </div>
      <h1 style="margin:0;font-size:26px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;text-shadow:0 2px 10px rgba(0,0,0,0.3);">
        ⚡ Welcome to ${biz}
      </h1>
      <p style="margin:8px 0 0;font-size:15px;color:rgba(255,255,255,0.92);font-weight:500;">
        We're honored and grateful to partner with you on your wholesale journey
      </p>
    </div>

    <div style="padding:32px 28px;">
      <!-- Gratitude Message -->
      <div style="background:linear-gradient(135deg,rgba(99,102,241,0.1) 0%,rgba(6,182,212,0.1) 100%);border-left:4px solid #6366f1;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#e2e8f0;font-weight:500;">
          <strong style="color:#ffffff;">Thank you for placing your trust in us.</strong> Building a thriving real estate wholesaling business takes ambition, courage, and relentless execution. We are truly grateful to have you with us, and we are committed to providing you with the ultimate tools to find, lock up, and close more deals.
        </p>
      </div>

      <!-- Account Credentials Card -->
      <div style="background:#131d33;border:1px solid #312e81;border-radius:12px;padding:22px;margin:24px 0;">
        <h2 style="margin:0 0 16px;font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#a5b4fc;font-weight:700;">
          🔑 Your Wholesale Command Center Access
        </h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#e2e8f0;">
          <tr>
            <td style="padding:8px 0;color:#94a3b8;width:120px;">Workspace:</td>
            <td style="padding:8px 0;font-weight:600;color:#ffffff;">${opts.workspaceName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#94a3b8;">Login Email:</td>
            <td style="padding:8px 0;font-weight:600;color:#38bdf8;">${opts.email}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#94a3b8;">Password:</td>
            <td style="padding:8px 0;font-weight:600;color:${opts.password ? "#f43f5e" : "#cbd5e1"};">
              ${opts.password ? `<span style="font-family:monospace;font-weight:700;">${opts.password}</span>` : "The password you chose during signup"}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#94a3b8;">Package Tier:</td>
            <td style="padding:8px 0;font-weight:600;color:#4ade80;">${tierName}</td>
          </tr>
        </table>
      </div>

      <!-- Call to Action -->
      <div style="text-align:center;margin:30px 0;">
        <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 34px;border-radius:10px;box-shadow:0 4px 20px rgba(99,102,241,0.4);">
          Launch Your CRM Workspace &rarr;
        </a>
      </div>

      <!-- Quick Start Guide -->
      <div style="border-top:1px solid #1e293b;padding-top:24px;margin-top:28px;">
        <h3 style="margin:0 0 14px;font-size:15px;color:#f8fafc;font-weight:700;">
          🚀 Fast Start to Closing Deals:
        </h3>
        <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.8;color:#94a3b8;">
          <li><strong style="color:#e2e8f0;">Sign In:</strong> Log into your dedicated workspace at <a href="${loginUrl}" style="color:#38bdf8;text-decoration:none;">${loginUrl}</a>.</li>
          <li><strong style="color:#e2e8f0;">Find & Underwrite:</strong> Pull distress criteria and calculate 70% rule MAO offers in seconds.</li>
          <li><strong style="color:#e2e8f0;">Lock Up Contracts:</strong> Generate state-compliant purchase & assignment agreements with 1-click digital e-signatures.</li>
          <li><strong style="color:#e2e8f0;">Package Deals:</strong> Create instant investor flyers, match cash buyers, and coordinate title smoothly.</li>
        </ol>
      </div>

      <!-- Warm Closing -->
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #1e293b;color:#cbd5e1;font-size:14px;line-height:1.6;">
        <p style="margin:0 0 12px;">
          We are committed to being your most trusted wholesaling partner. If you ever have questions, need workflow tips, or want guidance, just reply directly to this email.
        </p>
        <p style="margin:0;font-weight:600;color:#ffffff;">
          To your closing success,<br>
          <span style="color:#a5b4fc;font-weight:700;">The ${biz} Team</span>
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#090d16;padding:20px 28px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #1e293b;">
      <p style="margin:0;">&copy; ${new Date().getFullYear()} ${biz}. All rights reserved.</p>
      <p style="margin:6px 0 0;">${biz} &bull; The Ultimate Wholesale Platform &bull; Need help? Reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: opts.to,
    fromName: biz,
    replyTo: opts.replyTo,
    subject: `Welcome to ${biz} — We're Grateful to Be on This Wholesale Journey With You!`,
    text,
    html,
  });
}

/**
 * Owner Notification:
 * Dispatches an instant alert to the platform owner whenever a new customer
 * signs up or pays for a subscription plan.
 */
export function sendNewSignupOwnerAlertEmail(opts: {
  to: string;
  subscriberEmail: string;
  workspaceName: string;
  tier: string;
  billing: string;
  appUrl: string;
  businessName?: string;
  mrr?: number;
}): Promise<SendEmailResult> {
  const biz = opts.businessName?.trim() || "Revzenta";
  const tierName =
    opts.tier === "scale"
      ? "Scale Empire Plan ($79/mo)"
      : opts.tier === "starter"
      ? "Starter Wholesaler Plan ($24.99/mo)"
      : "Wholesale Pro Plan ($59.99/mo)";
  const billingLabel = opts.billing === "annual" ? "Annual (Paid Upfront)" : "Monthly";
  const mrrFormatted = opts.mrr !== undefined ? `$${opts.mrr.toFixed(2)}/mo` : (
    opts.tier === "scale" ? "$79.00/mo" : opts.tier === "starter" ? "$24.99/mo" : "$59.99/mo"
  );
  const dashboardUrl = `${opts.appUrl}/#/subscribers`;

  const text = [
    `🎉 New Revzenta Subscriber Alert!`,
    "",
    `A new wholesale client has just activated their workspace.`,
    "",
    `========================================`,
    `SUBSCRIBER & WORKSPACE DETAILS`,
    `========================================`,
    `Workspace:     ${opts.workspaceName}`,
    `Subscriber:    ${opts.subscriberEmail}`,
    `Plan:          ${tierName}`,
    `Billing Cycle: ${billingLabel}`,
    `MRR Impact:    +${mrrFormatted}`,
    `Timestamp:     ${new Date().toLocaleString("en-US", { timeZoneName: "short" })}`,
    "",
    `View subscriber in Owner Dashboard: ${dashboardUrl}`,
    "",
    `— ${biz} Automated Billing Engine`,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Revzenta Signup</title>
</head>
<body style="margin:0;padding:0;background-color:#090d16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;">
  <div style="max-width:600px;margin:30px auto;background:#0f172a;border-radius:16px;border:1px solid #1e293b;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.6);">
    <div style="background:linear-gradient(135deg,#10b981 0%,#059669 50%,#047857 100%);padding:28px;text-align:center;">
      <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;text-shadow:0 2px 10px rgba(0,0,0,0.3);">
        🚀 New Subscriber Signed Up!
      </h1>
      <p style="margin:8px 0 0;font-size:15px;color:rgba(255,255,255,0.9);font-weight:600;">
        +${mrrFormatted} New MRR Added
      </p>
    </div>
    <div style="padding:28px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 0;font-size:13px;color:#94a3b8;font-weight:600;">Workspace</td>
          <td style="padding:10px 0;font-size:14px;color:#ffffff;font-weight:700;text-align:right;">${opts.workspaceName}</td>
        </tr>
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 0;font-size:13px;color:#94a3b8;font-weight:600;">Subscriber Email</td>
          <td style="padding:10px 0;font-size:14px;color:#38bdf8;font-weight:700;text-align:right;">${opts.subscriberEmail}</td>
        </tr>
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 0;font-size:13px;color:#94a3b8;font-weight:600;">Plan / Tier</td>
          <td style="padding:10px 0;font-size:14px;color:#10b981;font-weight:700;text-align:right;">${tierName}</td>
        </tr>
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 0;font-size:13px;color:#94a3b8;font-weight:600;">Billing Cycle</td>
          <td style="padding:10px 0;font-size:14px;color:#ffffff;font-weight:600;text-align:right;">${billingLabel}</td>
        </tr>
      </table>
      <div style="text-align:center;margin-top:20px;">
        <a href="${dashboardUrl}" style="background:#10b981;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block;">
          Open Subscriber in Cockpit &rarr;
        </a>
      </div>
    </div>
    <div style="padding:16px;background:#0b132b;border-top:1px solid #1e293b;text-align:center;font-size:12px;color:#64748b;">
      Revzenta Automated Notification Engine
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to: opts.to,
    fromName: biz,
    subject: `🚀 New Subscriber: ${opts.workspaceName} (${tierName})`,
    text,
    html,
  });
}


