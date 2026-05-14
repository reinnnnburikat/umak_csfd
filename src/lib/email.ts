import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { basename } from 'path';

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Lazy-loaded type-only imports for Vercel Edge compatibility                 */
/*  nodemailer and resend depend on Node.js net/tls which are not available    */
/*  in Edge Runtime. By using dynamic imports, these modules are only loaded   */
/*  when actually sending an email, not at build time or in Edge contexts.     */
/* ──────────────────────────────────────────────────────────────────────────── */

type NodemailerTransporter = import('nodemailer').Transporter;
type ResendClient = import('resend').Resend;

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Email Transport: Nodemailer (primary) with Resend fallback                 */
/* ──────────────────────────────────────────────────────────────────────────── */

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  /**
   * Custom "From" address. When omitted, defaults to SMTP_FROM env variable.
   *
   * ⚠️ IMPORTANT: When using Gmail SMTP, Gmail will rewrite the From header
   * to the authenticated account (e.g., reinernuevas.acads@gmail.com),
   * regardless of what is set here. This is a known Gmail limitation.
   * The custom From will still appear in some email clients that honour
   * the Sender + From combination, and it sets proper expectations for
   * reply-to behaviour.
   */
  from?: string;
  /** BCC recipient address. When provided, a blind carbon copy is sent. */
  bcc?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    cid?: string;
    contentType?: string;
  }>;
}

/**
 * Detect whether SMTP is configured via environment variables.
 */
function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Lazy-initialised Nodemailer transport. Created only when needed.
 */
let _transporter: NodemailerTransporter | null = null;
async function getNodemailerTransporter(): Promise<NodemailerTransporter> {
  if (!_transporter) {
    const nodemailer = await import('nodemailer');
    const host = process.env.SMTP_HOST || '';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';

    _transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: { user, pass },
      // Reasonable defaults for production
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
  }
  return _transporter;
}

/**
 * Lazy-initialised Resend client (fallback).
 */
let _resend: ResendClient | null = null;
async function getResend(): Promise<ResendClient> {
  if (!_resend) {
    const { Resend } = await import('resend');
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    _resend = new Resend(key);
  }
  return _resend;
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Logo handling — read local logo files as CID attachments                    */
/* ──────────────────────────────────────────────────────────────────────────── */

let _umakLogoBuffer: Buffer | null = null;
let _csfdLogoBuffer: Buffer | null = null;
let _logoReadAttempted = false;

/**
 * Read logo files from /public/logos/ into buffers for CID embedding.
 * Only attempted once; if files are missing we gracefully fall back to URLs.
 */
function ensureLogosLoaded(): void {
  if (_logoReadAttempted) return;
  _logoReadAttempted = true;

  try {
    const umakPath = join(process.cwd(), 'public', 'logos', 'UMAK LOGO.png');
    if (existsSync(umakPath)) {
      _umakLogoBuffer = readFileSync(umakPath);
    }
  } catch (err) {
    console.warn('Could not read UMak logo file:', err);
  }

  try {
    const csfdPath = join(process.cwd(), 'public', 'logos', 'CSFD LOGO.png');
    if (existsSync(csfdPath)) {
      _csfdLogoBuffer = readFileSync(csfdPath);
    }
  } catch (err) {
    console.warn('Could not read CSFD logo file:', err);
  }
}

/**
 * Build the attachments array for Nodemailer CID-embedded logos.
 */
function getLogoAttachments(): EmailPayload['attachments'] {
  ensureLogosLoaded();
  const attachments: EmailPayload['attachments'] = [];
  if (_umakLogoBuffer) {
    attachments.push({
      filename: 'umak-logo.png',
      content: _umakLogoBuffer,
      cid: 'umak-logo',
      contentType: 'image/png',
    });
  }
  if (_csfdLogoBuffer) {
    attachments.push({
      filename: 'csfd-logo.png',
      content: _csfdLogoBuffer,
      cid: 'csfd-logo',
      contentType: 'image/png',
    });
  }
  return attachments.length > 0 ? attachments : undefined;
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  File attachment helper — download files from URLs for email attachments     */
/* ──────────────────────────────────────────────────────────────────────────── */

/**
 * Download files from URLs and return them as email-compatible attachments.
 * Skips files that fail to download (graceful degradation).
 * Limits total attachment size to 25MB to stay within email provider limits.
 */
export async function downloadFilesAsAttachments(
  fileUrls: string[],
  maxTotalSizeBytes: number = 25 * 1024 * 1024 // 25 MB default
): Promise<Array<{ filename: string; content: Buffer; contentType?: string }>> {
  const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
  let totalSize = 0;

  for (const url of fileUrls) {
    if (!url || typeof url !== 'string') continue;

    // Handle base64 data URLs
    if (url.startsWith('data:')) {
      try {
        const match = url.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const contentType = match[1] || 'application/octet-stream';
          const base64Data = match[2];
          const buffer = Buffer.from(base64Data, 'base64');

          if (totalSize + buffer.length > maxTotalSizeBytes) {
            console.warn('[Email Attach] Skipping data URL: would exceed total size limit');
            continue;
          }

          // Determine filename from content type
          const ext = contentType.split('/')[1] || 'bin';
          const filename = `attachment-${attachments.length + 1}.${ext}`;

          attachments.push({ filename, content: buffer, contentType });
          totalSize += buffer.length;
        }
      } catch (err) {
        console.warn('[Email Attach] Failed to parse data URL:', err instanceof Error ? err.message : String(err));
      }
      continue;
    }

    try {
      // Resolve relative URLs to absolute
      const resolvedUrl = url.startsWith('/')
        ? `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${url}`
        : url;

      const response = await fetch(resolvedUrl, {
        signal: AbortSignal.timeout(15_000), // 15 second timeout per file
      });

      if (!response.ok) {
        console.warn(`[Email Attach] Failed to download ${url}: HTTP ${response.status}`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Check size limit
      if (totalSize + buffer.length > maxTotalSizeBytes) {
        console.warn(`[Email Attach] Skipping ${url}: would exceed total size limit`);
        continue;
      }

      // Determine filename from URL
      const urlPath = new URL(resolvedUrl).pathname;
      const filename = decodeURIComponent(basename(urlPath)) || `attachment-${attachments.length + 1}`;

      // Determine content type
      const contentType = response.headers.get('content-type') || undefined;

      attachments.push({
        filename,
        content: buffer,
        contentType,
      });

      totalSize += buffer.length;
    } catch (err) {
      console.warn(`[Email Attach] Failed to download ${url}:`, err instanceof Error ? err.message : String(err));
    }
  }

  return attachments;
}

/**
 * Parse a JSON string of file URLs, returning an array of strings.
 * Returns empty array on parse failure.
 */
export function parseFileUrls(fileUrlsJson: string | null | undefined): string[] {
  if (!fileUrlsJson) return [];
  try {
    const parsed = JSON.parse(fileUrlsJson);
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Send an email. Uses Nodemailer (SMTP) as primary transport.
 * Falls back to Resend if SMTP is not configured.
 * Console fallback if neither is configured.
 */
export async function sendEmail({ to, subject, html, from, attachments, bcc }: EmailPayload): Promise<void> {
  // 1. Try Nodemailer SMTP first
  if (isSmtpConfigured()) {
    try {
      const transporter = await getNodemailerTransporter();
      // Use custom "from" if provided, otherwise fall back to SMTP_FROM env variable
      // ⚠️ Note: Gmail SMTP may rewrite the From header to the authenticated account
      const fromAddress = from || process.env.SMTP_FROM || '"CSFD - University of Makati" <no-reply@umak.edu.ph>';
      const logoAttachments = getLogoAttachments();

      await transporter.sendMail({
        from: fromAddress,
        to,
        bcc: bcc || undefined,
        subject,
        html,
        attachments: [...(logoAttachments || []), ...(attachments || [])],
      });
      console.log(`[Email] Sent via SMTP to ${to} — ${subject}`);
      return;
    } catch (err) {
      console.error('[Email] SMTP send failed, trying fallback:', err);
    }
  }

  // 2. Try Resend as fallback
  if (process.env.RESEND_API_KEY) {
    try {
      const client = await getResend();
      // Build Resend-compatible attachments
      const resendAttachments = attachments?.map(att => {
        // Resend requires base64 content for attachments
        const contentStr = typeof att.content === 'string' ? att.content : att.content.toString('base64');
        return {
          filename: att.filename,
          content: contentStr,
          ...(att.contentType ? { contentType: att.contentType } : {}),
        };
      });
      const { error } = await client.emails.send({
        from: 'CSFD - University of Makati <onboarding@resend.dev>',
        to,
        bcc: bcc || undefined,
        subject,
        html,
        ...(resendAttachments && resendAttachments.length > 0 ? { attachments: resendAttachments } : {}),
      });
      if (error) {
        console.error('[Email] Resend error:', error);
      } else {
        console.log(`[Email] Sent via Resend to ${to} — ${subject}`);
        return;
      }
    } catch (err) {
      console.error('[Email] Resend send failed:', err);
    }
  }

  // 3. Console fallback
  console.log('━━━ EMAIL (no transport — console fallback) ━━━');
  console.log('To:', to);
  console.log('Subject:', subject);
  console.log('HTML:', html);
  console.log('━━━ END EMAIL ━━━');
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Shared layout helpers — Official UMAK Branding                             */
/* ──────────────────────────────────────────────────────────────────────────── */

// Official UMAK colors per task spec
const NAVY = '#111c4e';
const GOLD = '#ffc400';
const LIGHT_BG = '#f4f5f7';

// Fallback external logo URLs (used when CID images aren't available, e.g. Resend)
const UMAK_LOGO_URL = 'https://umak.edu.ph/wp-content/uploads/2020/01/UMak-Logo.png';
// For CSFD logo, we construct an absolute URL using VERCEL_URL or NEXTAUTH_URL env var.
// On Vercel deployments, VERCEL_URL is automatically set. For local dev, we use localhost.
// This is needed because emails require absolute URLs — relative paths won't work in email clients.
function getCsfdLogoUrl(): string {
  const host = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${host}/logos/CSFD%20LOGO.png`;
}
const CSFD_LOGO_URL = getCsfdLogoUrl();

/**
 * Determine whether to use CID-embedded or URL-based logos.
 * Nodemailer supports CID, Resend does not (easily), so we check.
 */
function umakLogoSrc(): string {
  ensureLogosLoaded();
  return _umakLogoBuffer ? 'cid:umak-logo' : UMAK_LOGO_URL;
}

function csfdLogoSrc(): string {
  ensureLogosLoaded();
  return _csfdLogoBuffer ? 'cid:csfd-logo' : CSFD_LOGO_URL;
}

/** Return the full <html> document wrapping `bodyContent`. */
function emailShell(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>University of Makati – CSFD</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: ${LIGHT_BG}; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .fluid { width: 100% !important; max-width: 100% !important; height: auto !important; }
      .stack-column { display: block !important; width: 100% !important; max-width: 100% !important; }
      .stack-column-center { text-align: center !important; }
      .center-on-mobile { text-align: center !important; display: block !important; margin-left: auto !important; margin-right: auto !important; float: none !important; }
      .padding-mobile { padding-left: 16px !important; padding-right: 16px !important; }
      .logo-cell { display: block !important; width: 100% !important; text-align: center !important; padding-bottom: 12px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:${LIGHT_BG}; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">

  <!-- Preheader (hidden text for inbox preview) -->
  <div style="display:none; font-size:1px; color:${LIGHT_BG}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    University of Makati – Center for Student Formation &amp; Discipline
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${LIGHT_BG};">
    <tr>
      <td align="center" style="padding: 24px 8px;">
        <!-- Inner container -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="email-container" style="max-width:600px; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); background-color:#ffffff;">

${bodyContent}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Header with UMak logo + CSFD logo + branding. */
function headerHtml(): string {
  const csfdSrc = csfdLogoSrc();
  const csfdLogoCell = csfdSrc
    ? `<td class="logo-cell" style="width:72px; vertical-align:middle; padding-right:16px;">
        <img src="${csfdSrc}" alt="CSFD Logo" width="60" height="60" style="display:inline-block; border-radius:50%; background:#ffffff; padding:4px;" />
      </td>`
    : '';

  return `          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg, ${NAVY} 0%, #1a2d6d 100%); padding:28px 32px 24px 32px; text-align:center;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td class="logo-cell" style="width:72px; vertical-align:middle; padding-right:16px;">
                          <img src="${umakLogoSrc()}" alt="UMak Logo" width="60" height="60" style="display:inline-block; border-radius:50%; background:#ffffff; padding:4px;" />
                        </td>
                        ${csfdLogoCell}
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:22px; font-weight:700; color:#ffffff; letter-spacing:0.5px; padding-bottom:4px;">
                    University of Makati
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:13px; font-weight:600; color:${GOLD}; letter-spacing:1.5px; text-transform:uppercase; padding-bottom:2px;">
                    Center for Student Formation &amp; Discipline
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Gold accent bar -->
          <tr>
            <td style="height:4px; background:${GOLD}; font-size:0; line-height:0;">&nbsp;</td>
          </tr>`;
}

/** Footer with CSFD contact info and office address. */
function footerHtml(): string {
  return `          <!-- FOOTER -->
          <tr>
            <td style="padding:24px 32px; background:#f4f5f7; border-top:3px solid ${GOLD};" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:12px; color:#6b7280; line-height:1.7;">
                    <p style="margin:0 0 6px 0; font-weight:700; color:${NAVY}; font-size:13px;">iCSFD+ Automated Notification</p>
                    <p style="margin:0 0 4px 0;">This is an automated message from <strong style="color:${NAVY};">iCSFD+</strong> — the online portal of the Center for Student Formation &amp; Discipline, University of Makati.</p>
                    <p style="margin:8px 0 2px 0; font-weight:600; color:${NAVY};">CSFD Office</p>
                    <p style="margin:0 0 2px 0;">5th Floor, Administrative Building, University of Makati</p>
                    <p style="margin:2px 0 2px 0;">J.P. Rizal Extension, West Rembo, Makati City</p>
                    <p style="margin:6px 0 2px 0;">📧 <a href="mailto:csfd@umak.edu.ph" style="color:${NAVY}; text-decoration:underline;">csfd@umak.edu.ph</a></p>
                    <p style="margin:8px 0 0 0; font-size:11px; color:#9ca3af;">Please do not reply to this email. For inquiries, visit the CSFD Office or email csfd@umak.edu.ph</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

/** Build a styled info-row for the details table. */
function infoRow(label: string, value: string, opts?: { monospace?: boolean; bold?: boolean; color?: string }): string {
  const styleValue = [
    'padding:12px 16px',
    'border-bottom:1px solid #f0f0f0',
    opts?.monospace ? "font-family:'Courier New',monospace; font-size:13px" : '',
    opts?.bold ? 'font-weight:600' : '',
    opts?.color ? `color:${opts.color}` : '',
  ].filter(Boolean).join('; ');

  return `                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #f0f0f0; font-weight:600; color:${NAVY}; width:38%; vertical-align:top; font-size:14px;">${label}</td>
                  <td style="${styleValue}; font-size:14px; vertical-align:top;">${value}</td>
                </tr>`;
}

/** Color-coded status badge as inline HTML. */
function statusBadge(status: string): string {
  const map: Record<string, { bg: string; color: string }> = {
    'New':           { bg: '#e0f2fe', color: '#0369a1' },
    'Pending':       { bg: '#e0f2fe', color: '#0369a1' },
    'Submitted':     { bg: '#e0f2fe', color: '#0369a1' },
    'Processing':    { bg: '#fef3c7', color: '#92400e' },
    'Under Review':  { bg: '#fef3c7', color: '#92400e' },
    'For Review':    { bg: '#fef3c7', color: '#92400e' },
    'For Issuance':  { bg: '#d1fae5', color: '#065f46' },
    'Issued':        { bg: '#d1fae5', color: '#065f46' },
    'Ready for Pickup': { bg: '#d1fae5', color: '#065f46' },
    'Released':      { bg: '#dcfce7', color: '#166534' },
    'Resolved':      { bg: '#d1fae5', color: '#065f46' },
    'Hold':          { bg: '#fef9c3', color: '#854d0e' },
    'On Hold':       { bg: '#fef9c3', color: '#854d0e' },
    'Dismissed':     { bg: '#f3f4f6', color: '#374151' },
    'Rejected':      { bg: '#fee2e2', color: '#991b1b' },
    'Reopened':      { bg: '#fef3c7', color: '#92400e' },
  };
  const s = map[status] || { bg: '#f3f4f6', color: '#374151' };
  return `<span style="display:inline-block; padding:4px 14px; border-radius:20px; font-size:13px; font-weight:600; background:${s.bg}; color:${s.color}; letter-spacing:0.3px;">${status}</span>`;
}

/** Tracking info section — token display + instruction text. */
function trackingInfoHtml(trackingToken: string): string {
  return `          <!-- TRACKING INFO -->
          <tr>
            <td style="padding:24px 32px 8px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0f4ff; border:1px solid #c7d2fe; border-radius:8px;">
                <tr>
                  <td style="padding:16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:14px; color:${NAVY}; line-height:1.6; text-align:center;">
                    <strong style="font-size:15px;">Track Your Request</strong><br/>
                    <span style="font-size:13px; color:#4b5563;">Use your tracking token at our website to track your request status.</span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 16px 16px 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto; background:#ffffff; border:1px dashed #a5b4fc; border-radius:6px;">
                      <tr>
                        <td style="padding:8px 20px; font-family:'Courier New',monospace; font-size:12px; color:#6b7280; letter-spacing:1px; text-align:center;">
                          ${trackingToken}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Complaint details section — shared by all complaint email templates        */
/* ──────────────────────────────────────────────────────────────────────────── */

interface ComplaintDetailFields {
  complaintNumber: string;
  category?: string | null;
  complaintCategory?: string | null;
  violationType?: string | null;
  description?: string | null;
  location?: string | null;
  dateOfIncident?: string | null;
  desiredOutcome?: string | null;
  isOngoing?: string | null;
  howOften?: string | null;
  witnesses?: string | null;
  previousReports?: string | null;
  complainantNames?: string | null;
  respondentNames?: string | null;
  filedCase?: string | null;
}

function complaintDetailsSection(fields: ComplaintDetailFields): string {
  const rows = [
    infoRow('Complaint Number', fields.complaintNumber, { bold: true, color: NAVY }),
    fields.category ? infoRow('Category', fields.category) : '',
    fields.complaintCategory ? infoRow('Complaint Category', fields.complaintCategory) : '',
    fields.violationType ? infoRow('Violation Type', fields.violationType) : '',
    fields.description ? infoRow('Description', fields.description.replace(/\n/g, '<br/>')) : '',
    fields.location ? infoRow('Location', fields.location) : '',
    fields.dateOfIncident ? infoRow('Date of Incident', fields.dateOfIncident) : '',
    fields.desiredOutcome ? infoRow('Desired Outcome', fields.desiredOutcome.replace(/\n/g, '<br/>')) : '',
    fields.isOngoing ? infoRow('Ongoing', fields.isOngoing) : '',
    fields.howOften ? infoRow('Frequency', fields.howOften) : '',
    fields.witnesses ? infoRow('Witnesses', fields.witnesses) : '',
    fields.previousReports ? infoRow('Previous Reports', fields.previousReports) : '',
    fields.complainantNames ? infoRow('Complainant(s)', fields.complainantNames) : '',
    fields.respondentNames ? infoRow('Respondent(s)', fields.respondentNames) : '',
    fields.filedCase ? infoRow('Filed Case', fields.filedCase) : '',
  ].filter(Boolean).join('\n');

  return `          <!-- COMPLAINT DETAILS -->
          <tr>
            <td style="padding:0 32px;" class="padding-mobile">
              <p style="margin:0 0 8px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:16px; font-weight:700; color:${NAVY};">Case Details</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
${rows}
              </table>
            </td>
          </tr>`;
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Certificate type labels                                                    */
/* ──────────────────────────────────────────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  GMC: 'Good Moral Certificate',
  UER: 'Uniform Exemption Request',
  CDC: 'Cross-Dressing Clearance',
  CAC: 'Child Admission Clearance',
};

function typeLabelWithBadge(requestType: string): string {
  const label = TYPE_LABELS[requestType] || requestType;
  return `<span style="display:inline-block; padding:2px 10px; border-radius:4px; font-size:12px; font-weight:600; background:${NAVY}10; color:${NAVY}; border:1px solid ${NAVY}30;">${requestType}</span>&nbsp; ${label}`;
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Status-specific messages for service request updates                       */
/* ──────────────────────────────────────────────────────────────────────────── */

function getStatusSpecificMessage(status: string): string {
  const messages: Record<string, { icon: string; text: string; bgColor: string; borderColor: string; textColor: string }> = {
    'Processing': {
      icon: '⚙️',
      text: 'Your request is now being processed. The CSFD staff is working on your certificate.',
      bgColor: '#fffbeb',
      borderColor: '#fde68a',
      textColor: '#92400e',
    },
    'For Review': {
      icon: '📋',
      text: 'Your request is now being reviewed by the CSFD staff. You will be notified once it is ready for issuance.',
      bgColor: '#fffbeb',
      borderColor: '#fde68a',
      textColor: '#92400e',
    },
    'For Issuance': {
      icon: '📄',
      text: 'Your certificate has been prepared and is ready for issuance. Please wait for the final issuance notification.',
      bgColor: '#ecfdf5',
      borderColor: '#a7f3d0',
      textColor: '#065f46',
    },
    'Issued': {
      icon: '✅',
      text: 'Your certificate is ready for pickup at <strong>CSFD Office, 5th Floor, Administrative Building</strong>. Please bring a valid ID when claiming.',
      bgColor: '#ecfdf5',
      borderColor: '#a7f3d0',
      textColor: '#065f46',
    },
    'Ready for Pickup': {
      icon: '✅',
      text: 'Your certificate is ready for pickup at <strong>CSFD Office, 5th Floor, Administrative Building</strong>. Please bring a valid ID when claiming.',
      bgColor: '#ecfdf5',
      borderColor: '#a7f3d0',
      textColor: '#065f46',
    },
    'Released': {
      icon: '🎉',
      text: 'Your certificate has been released. Thank you for using iCSFD+!',
      bgColor: '#f0fdf4',
      borderColor: '#bbf7d0',
      textColor: '#166534',
    },
    'Hold': {
      icon: '⏸️',
      text: 'Your request is on hold. Please contact <strong>CSFD</strong> at csfd@umak.edu.ph or visit the CSFD Office for details.',
      bgColor: '#fefce8',
      borderColor: '#fde68a',
      textColor: '#854d0e',
    },
    'On Hold': {
      icon: '⏸️',
      text: 'Your request is on hold. Please contact <strong>CSFD</strong> at csfd@umak.edu.ph or visit the CSFD Office for details.',
      bgColor: '#fefce8',
      borderColor: '#fde68a',
      textColor: '#854d0e',
    },
    'Rejected': {
      icon: '❌',
      text: 'Your request has been rejected. Please contact <strong>CSFD</strong> at csfd@umak.edu.ph or visit the CSFD Office for details.',
      bgColor: '#fef2f2',
      borderColor: '#fecaca',
      textColor: '#991b1b',
    },
  };

  const msg = messages[status];
  if (!msg) {
    return `          <!-- STATUS MESSAGE -->
          <tr>
            <td style="padding:0 32px 28px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0f7ff; border:1px solid #bfdbfe; border-radius:8px;">
                <tr>
                  <td style="padding:16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:13px; color:#1e40af; line-height:1.6;">
                    <strong>Need more details?</strong><br/>
                    Use your tracking token to check the full details and progress of your request on the iCSFD+ portal.
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  }

  return `          <!-- STATUS MESSAGE -->
          <tr>
            <td style="padding:0 32px 28px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${msg.bgColor}; border:1px solid ${msg.borderColor}; border-radius:8px;">
                <tr>
                  <td style="padding:16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:14px; color:${msg.textColor}; line-height:1.6;">
                    ${msg.icon} ${msg.text}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Template: Service Request Confirmation (GMC / UER / CDC / CAC)             */
/* ──────────────────────────────────────────────────────────────────────────── */

export function serviceRequestConfirmationHtml(params: {
  requestorName: string;
  requestType: string;
  requestNumber: string;
  trackingToken: string;
  dateSubmitted?: string;
  processedByName?: string;
}): string {
  const { requestorName, requestType, requestNumber, trackingToken, dateSubmitted, processedByName } = params;

  const submittedDate = dateSubmitted || new Date().toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const staffName = processedByName || 'Pending assignment';

  const body = `${headerHtml()}

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 32px 0 32px;" class="padding-mobile">
              <p style="margin:0 0 4px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:22px; font-weight:700; color:${NAVY};">Request Submitted Successfully</p>
              <p style="margin:0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151;">Hello, <strong>${requestorName}</strong>! Your service request has been successfully submitted to the CSFD office.</p>
            </td>
          </tr>

          <!-- DETAILS TABLE -->
          <tr>
            <td style="padding:20px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
${infoRow('Request ID', requestNumber, { bold: true, color: NAVY })}
${infoRow('Certificate Type', typeLabelWithBadge(requestType))}
${infoRow('Requestor', requestorName)}
${infoRow('Date Submitted', submittedDate)}
${infoRow('Estimated Processing Time', '3–5 working days')}
${infoRow('Staff Assigned', staffName, { color: staffName === 'Pending assignment' ? '#9ca3af' : '#374151' })}
${infoRow('Status', statusBadge('Pending'))}
              </table>
            </td>
          </tr>

${trackingInfoHtml(trackingToken)}

          <!-- NEXT STEPS -->
          <tr>
            <td style="padding:0 32px 28px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px;">
                <tr>
                  <td style="padding:16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:13px; color:#92400e; line-height:1.6;">
                    <strong style="color:${NAVY};">What happens next?</strong><br/>
                    Your request is now in the queue. The CSFD staff will review your submission and process it within <strong>3–5 working days</strong>. You will receive an email notification whenever the status changes. Please keep your tracking token safe — you can use it anytime to check your request status on the iCSFD+ portal.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

${footerHtml()}`;

  return emailShell(body);
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Template: Complaint Filing Confirmation                                    */
/* ──────────────────────────────────────────────────────────────────────────── */

export function complaintConfirmationHtml(params: {
  complainantName: string;
  complaintNumber: string;
  trackingToken: string;
  subject: string;
  description?: string | null;
  location?: string | null;
  dateOfIncident?: string | null;
  desiredOutcome?: string | null;
  complaintCategory?: string | null;
  violationType?: string | null;
  isOngoing?: string | null;
  howOften?: string | null;
  witnesses?: string | null;
  previousReports?: string | null;
  filedCase?: string | null;
  category?: string | null;
  complainantNames?: string | null;
  respondentNames?: string | null;
}): string {
  const { complainantName, complaintNumber, trackingToken, subject: complaintSubject } = params;

  const body = `${headerHtml()}

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 32px 0 32px;" class="padding-mobile">
              <p style="margin:0 0 4px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:22px; font-weight:700; color:${NAVY};">Complaint Filed</p>
              <p style="margin:0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151;">Hello, <strong>${complainantName}</strong>! Your complaint has been successfully filed and is now in the queue for review.</p>
            </td>
          </tr>

          <!-- SUMMARY TABLE -->
          <tr>
            <td style="padding:20px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
${infoRow('Complaint Number', complaintNumber, { bold: true, color: NAVY })}
${infoRow('Subject', complaintSubject)}
${infoRow('Status', statusBadge('New'))}
              </table>
            </td>
          </tr>

${complaintDetailsSection(params)}

${trackingInfoHtml(trackingToken)}

          <!-- NEXT STEPS -->
          <tr>
            <td style="padding:0 32px 28px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px;">
                <tr>
                  <td style="padding:16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:13px; color:#92400e; line-height:1.6;">
                    <strong style="color:${NAVY};">What happens next?</strong><br/>
                    Your complaint is now being reviewed by the CSFD office. A staff member will be assigned to your case and you will be notified of any status changes. Please keep your tracking token safe — you can use it anytime to check your complaint status on the iCSFD+ portal.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

${footerHtml()}`;

  return emailShell(body);
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Template: Complaint Status Update                                          */
/* ──────────────────────────────────────────────────────────────────────────── */

export function complaintStatusUpdateHtml(params: {
  complainantName: string;
  complaintNumber: string;
  previousStatus: string;
  newStatus: string;
  trackingToken: string;
  remarks?: string;
  reviewedByName?: string;
  description?: string | null;
  location?: string | null;
  dateOfIncident?: string | null;
  desiredOutcome?: string | null;
  complaintCategory?: string | null;
  violationType?: string | null;
  isOngoing?: string | null;
  howOften?: string | null;
  witnesses?: string | null;
  previousReports?: string | null;
  filedCase?: string | null;
  category?: string | null;
  complainantNames?: string | null;
  respondentNames?: string | null;
}): string {
  const { complainantName, complaintNumber, previousStatus, newStatus, trackingToken, remarks, reviewedByName } = params;

  const processedByRow = reviewedByName
    ? infoRow('Reviewed By', reviewedByName)
    : '';

  const remarksRow = remarks
    ? infoRow('Remarks', remarks)
    : '';

  const body = `${headerHtml()}

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 32px 0 32px;" class="padding-mobile">
              <p style="margin:0 0 4px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:22px; font-weight:700; color:${NAVY};">Status Update</p>
              <p style="margin:0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151;">Hello, <strong>${complainantName}</strong>. The status of your complaint has been updated.</p>
            </td>
          </tr>

          <!-- DETAILS TABLE -->
          <tr>
            <td style="padding:20px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
${infoRow('Complaint Number', complaintNumber, { bold: true, color: NAVY })}
${infoRow('Previous Status', statusBadge(previousStatus))}
${infoRow('New Status', statusBadge(newStatus))}
${processedByRow}
${remarksRow}
              </table>
            </td>
          </tr>

${complaintDetailsSection(params)}

${trackingInfoHtml(trackingToken)}

${getStatusSpecificMessage(newStatus)}

${footerHtml()}`;

  return emailShell(body);
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Template: Complaint Progress Update                                        */
/* ──────────────────────────────────────────────────────────────────────────── */

export function complaintProgressUpdateHtml(params: {
  complainantName: string;
  complaintNumber: string;
  trackingToken: string;
  progressSubject: string;
  progressDetails: string;
  asOf: string;
  updatedByName?: string;
  description?: string | null;
  location?: string | null;
  dateOfIncident?: string | null;
  desiredOutcome?: string | null;
  complaintCategory?: string | null;
  violationType?: string | null;
  isOngoing?: string | null;
  howOften?: string | null;
  witnesses?: string | null;
  previousReports?: string | null;
  filedCase?: string | null;
  category?: string | null;
  complainantNames?: string | null;
  respondentNames?: string | null;
}): string {
  const { complainantName, complaintNumber, trackingToken, progressSubject, progressDetails, asOf, updatedByName } = params;

  const updatedByRow = updatedByName
    ? infoRow('Updated By', updatedByName)
    : '';

  const body = `${headerHtml()}

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 32px 0 32px;" class="padding-mobile">
              <p style="margin:0 0 4px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:22px; font-weight:700; color:${NAVY};">Update on Your Complaint</p>
              <p style="margin:0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151;">Hello, <strong>${complainantName}</strong>. A new progress update has been added to your complaint.</p>
            </td>
          </tr>

          <!-- DETAILS TABLE -->
          <tr>
            <td style="padding:20px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
${infoRow('Complaint Number', complaintNumber, { bold: true, color: NAVY })}
${infoRow('Update Title', progressSubject, { bold: true })}
${infoRow('Details', progressDetails.replace(/\n/g, '<br/>'))}
${infoRow('As of', `<em style="color:${NAVY};">${asOf}</em>`)}
${updatedByRow}
              </table>
            </td>
          </tr>

${complaintDetailsSection(params)}

${trackingInfoHtml(trackingToken)}

          <!-- INFO MESSAGE -->
          <tr>
            <td style="padding:0 32px 28px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0f7ff; border:1px solid #bfdbfe; border-radius:8px;">
                <tr>
                  <td style="padding:16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:13px; color:#1e40af; line-height:1.6;">
                    <strong>Track your complaint</strong><br/>
                    Use your tracking token to check the full details and progress of your complaint on the iCSFD+ portal. You will receive an email each time an update is added.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

${footerHtml()}`;

  return emailShell(body);
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Template: Service Request Status Update                                    */
/* ──────────────────────────────────────────────────────────────────────────── */

export function serviceRequestStatusUpdateHtml(params: {
  requestorName: string;
  requestNumber: string;
  previousStatus: string;
  newStatus: string;
  remarks?: string | null;
  trackingToken: string;
  reviewedByName?: string;
  requestType?: string;
  issuedByName?: string | null;
  issuedAt?: string | null;
}): string {
  const { requestorName, requestNumber, previousStatus, newStatus, remarks, trackingToken, reviewedByName, requestType, issuedByName, issuedAt } = params;

  const requestTypeRow = requestType
    ? infoRow('Certificate Type', typeLabelWithBadge(requestType))
    : '';

  const processedByRow = reviewedByName
    ? infoRow('Processed By', reviewedByName)
    : '';

  const issuedByRow = issuedByName
    ? infoRow('Issued By', `${issuedByName}${issuedAt ? ` — ${issuedAt}` : ''}`, { color: '#065f46' })
    : '';

  const remarksRow = remarks
    ? infoRow('Remarks', remarks)
    : '';

  const body = `${headerHtml()}

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 32px 0 32px;" class="padding-mobile">
              <p style="margin:0 0 4px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:22px; font-weight:700; color:${NAVY};">Status Update</p>
              <p style="margin:0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151;">Hello, <strong>${requestorName}</strong>. The status of your service request has been updated.</p>
            </td>
          </tr>

          <!-- DETAILS TABLE -->
          <tr>
            <td style="padding:20px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
${infoRow('Request Number', requestNumber, { bold: true, color: NAVY })}
${requestTypeRow}
${infoRow('Previous Status', statusBadge(previousStatus))}
${infoRow('New Status', statusBadge(newStatus))}
${processedByRow}
${issuedByRow}
${remarksRow}
              </table>
            </td>
          </tr>

${trackingInfoHtml(trackingToken)}

${getStatusSpecificMessage(newStatus)}

${footerHtml()}`;

  return emailShell(body);
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Template: GMC Release — Dry Seal Instructions                              */
/* ──────────────────────────────────────────────────────────────────────────── */

export function gmcReleaseEmailHtml(params: {
  requestorName: string;
  requestNumber: string;
  formattedDate: string; // pre-formatted date string like "May 5, 2026"
  issuedByName?: string;
}): string {
  const { requestorName, requestNumber, formattedDate, issuedByName } = params;

  const issuedBySection = issuedByName
    ? `<p style="margin:0 0 12px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:14px; color:#374151; line-height:1.6;">
        Issued by: <strong style="color:#065f46;">${issuedByName}</strong> — Center for Student Formation &amp; Discipline
      </p>`
    : '';

  const body = `${headerHtml()}

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 32px 0 32px;" class="padding-mobile">
              <p style="margin:0 0 16px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151;">
                Good day!
              </p>
              <p style="margin:0 0 12px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151; line-height:1.6;">
                Please print the attached <strong>Good Moral Certificate (GMC)</strong> on <strong>A4-size paper</strong> in your preferred number of copies.
              </p>
              <p style="margin:0 0 12px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151; line-height:1.6;">
                After printing, kindly <em>place the document inside a brown envelope</em> and proceed to the <strong>Center for Student Formation and Discipline (CSFD) Office</strong> for the official stamping of the document with the <strong>University dry seal</strong> on <strong>${formattedDate}</strong>.
              </p>
              <p style="margin:0 0 8px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151; line-height:1.6;">
                Please ensure that the printed document is:
              </p>
              <ul style="margin:0 0 16px 20px; padding:0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151; line-height:1.8;">
                <li style="margin-bottom:4px;"><strong>Clean and free from folds or creases</strong></li>
                <li style="margin-bottom:4px;"><strong>Not crumpled, stained, or damaged</strong></li>
                <li style="margin-bottom:4px;"><strong>Clearly printed</strong> (not blurred, cut, or misaligned)</li>
                <li><strong>Properly aligned and complete</strong></li>
              </ul>
              <p style="margin:0 0 12px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#dc2626; line-height:1.6;">
                Documents that are <strong>crumpled, dirty, improperly aligned, blurred, or cut off</strong> will <strong>NOT be accepted</strong>, and you will be required to reprint the Good Moral Certificate before it can be stamped.
              </p>

              <!-- PROMINENT INVALID WARNING BOX -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px 0; background:#fef2f2; border:2px solid #dc2626; border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#991b1b; line-height:1.6; text-align:center;">
                    <strong style="font-size:16px; color:#dc2626;">⚠ IMPORTANT: The Good Moral Certificate is INVALID without the University dry seal.</strong><br/>
                    <span style="font-size:13px; color:#7f1d1d;">You must proceed to the CSFD Office to have the dry seal affixed. Uncertified copies hold no official validity.</span>
                  </td>
                </tr>
              </table>

              ${issuedBySection}
              <p style="margin:0 0 4px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151;">
                For your guidance and <strong>strict compliance</strong>.
              </p>
              <p style="margin:0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:14px; color:#6b7280; line-height:1.5;">
                For concerns, please contact:<br/>
                <em><a href="mailto:csfdgoodmoral@umak.edu.ph" style="color:${NAVY};">csfdgoodmoral@umak.edu.ph</a></em>
              </p>
            </td>
          </tr>

${footerHtml()}`;

  return emailShell(body);
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Template: Complaint Respondent Notification (New Complaint Filed)           */
/* ──────────────────────────────────────────────────────────────────────────── */

export function complaintRespondentNotificationHtml(params: {
  respondentName: string;
  complaintNumber: string;
  subject: string;
  complainantName: string;
  trackingToken: string;
  description?: string | null;
  location?: string | null;
  dateOfIncident?: string | null;
  desiredOutcome?: string | null;
  complaintCategory?: string | null;
  violationType?: string | null;
  isOngoing?: string | null;
  howOften?: string | null;
  witnesses?: string | null;
  previousReports?: string | null;
  filedCase?: string | null;
  category?: string | null;
  complainantNames?: string | null;
  respondentNames?: string | null;
}): string {
  const { respondentName, complaintNumber, subject: complaintSubject, complainantName, trackingToken } = params;

  const body = `${headerHtml()}

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 32px 0 32px;" class="padding-mobile">
              <p style="margin:0 0 4px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:22px; font-weight:700; color:${NAVY};">You Have Been Named in a Complaint</p>
              <p style="margin:0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151;">Hello, <strong>${respondentName}</strong>. You have been named as a respondent in a complaint filed with the CSFD office.</p>
            </td>
          </tr>

          <!-- SUMMARY TABLE -->
          <tr>
            <td style="padding:20px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
${infoRow('Complaint Number', complaintNumber, { bold: true, color: NAVY })}
${infoRow('Subject', complaintSubject)}
${infoRow('Filed By', complainantName)}
${infoRow('Status', statusBadge('New'))}
              </table>
            </td>
          </tr>

${complaintDetailsSection(params)}

${trackingInfoHtml(trackingToken)}

          <!-- INFO BOX -->
          <tr>
            <td style="padding:0 32px 28px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0f7ff; border:1px solid #bfdbfe; border-radius:8px;">
                <tr>
                  <td style="padding:16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:13px; color:#1e40af; line-height:1.6;">
                    This is an official notification from the CSFD office. You are named as a respondent in this complaint. The CSFD office will contact you with further instructions. Please monitor your email for updates regarding this case.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

${footerHtml()}`;

  return emailShell(body);
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Template: Complaint Respondent Status Update                                */
/* ──────────────────────────────────────────────────────────────────────────── */

export function complaintRespondentStatusUpdateHtml(params: {
  respondentName: string;
  complaintNumber: string;
  previousStatus: string;
  newStatus: string;
  trackingToken: string;
  remarks?: string;
  reviewedByName?: string;
  description?: string | null;
  location?: string | null;
  dateOfIncident?: string | null;
  desiredOutcome?: string | null;
  complaintCategory?: string | null;
  violationType?: string | null;
  isOngoing?: string | null;
  howOften?: string | null;
  witnesses?: string | null;
  previousReports?: string | null;
  filedCase?: string | null;
  category?: string | null;
  complainantNames?: string | null;
  respondentNames?: string | null;
}): string {
  const { respondentName, complaintNumber, previousStatus, newStatus, trackingToken, remarks, reviewedByName } = params;

  const processedByRow = reviewedByName
    ? infoRow('Reviewed By', reviewedByName)
    : '';

  const remarksRow = remarks
    ? infoRow('Remarks', remarks)
    : '';

  const body = `${headerHtml()}

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 32px 0 32px;" class="padding-mobile">
              <p style="margin:0 0 4px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:22px; font-weight:700; color:${NAVY};">Status Update — Complaint Involving You</p>
              <p style="margin:0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151;">Hello, <strong>${respondentName}</strong>. The status of a complaint you are involved in as a respondent has been updated.</p>
            </td>
          </tr>

          <!-- DETAILS TABLE -->
          <tr>
            <td style="padding:20px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
${infoRow('Complaint Number', complaintNumber, { bold: true, color: NAVY })}
${infoRow('Previous Status', statusBadge(previousStatus))}
${infoRow('New Status', statusBadge(newStatus))}
${processedByRow}
${remarksRow}
              </table>
            </td>
          </tr>

${complaintDetailsSection(params)}

${trackingInfoHtml(trackingToken)}

${getStatusSpecificMessage(newStatus)}

${footerHtml()}`;

  return emailShell(body);
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Template: Complaint Respondent Progress Update                              */
/* ──────────────────────────────────────────────────────────────────────────── */

export function complaintRespondentProgressUpdateHtml(params: {
  respondentName: string;
  complaintNumber: string;
  trackingToken: string;
  progressSubject: string;
  progressDetails: string;
  asOf: string;
  updatedByName?: string;
  description?: string | null;
  location?: string | null;
  dateOfIncident?: string | null;
  desiredOutcome?: string | null;
  complaintCategory?: string | null;
  violationType?: string | null;
  isOngoing?: string | null;
  howOften?: string | null;
  witnesses?: string | null;
  previousReports?: string | null;
  filedCase?: string | null;
  category?: string | null;
  complainantNames?: string | null;
  respondentNames?: string | null;
}): string {
  const { respondentName, complaintNumber, trackingToken, progressSubject, progressDetails, asOf, updatedByName } = params;

  const updatedByRow = updatedByName
    ? infoRow('Updated By', updatedByName)
    : '';

  const body = `${headerHtml()}

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 32px 0 32px;" class="padding-mobile">
              <p style="margin:0 0 4px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:22px; font-weight:700; color:${NAVY};">Progress Update — Complaint Involving You</p>
              <p style="margin:0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151;">Hello, <strong>${respondentName}</strong>. A progress update has been added to a complaint you are involved in as a respondent.</p>
            </td>
          </tr>

          <!-- DETAILS TABLE -->
          <tr>
            <td style="padding:20px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
${infoRow('Complaint Number', complaintNumber, { bold: true, color: NAVY })}
${infoRow('Update Title', progressSubject, { bold: true })}
${infoRow('Details', progressDetails.replace(/\n/g, '<br/>'))}
${infoRow('As of', `<em style="color:${NAVY};">${asOf}</em>`)}
${updatedByRow}
              </table>
            </td>
          </tr>

${complaintDetailsSection(params)}

${trackingInfoHtml(trackingToken)}

          <!-- INFO MESSAGE -->
          <tr>
            <td style="padding:0 32px 28px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0f7ff; border:1px solid #bfdbfe; border-radius:8px;">
                <tr>
                  <td style="padding:16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:13px; color:#1e40af; line-height:1.6;">
                    <strong>Track this complaint</strong><br/>
                    Use the tracking token above to check the full details and progress of this complaint on the iCSFD+ portal. You will receive an email each time an update is added.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

${footerHtml()}`;

  return emailShell(body);
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Violation-specific badge helpers                                            */
/* ──────────────────────────────────────────────────────────────────────────── */

function violationCategoryBadge(category: string): string {
  const map: Record<string, { bg: string; color: string }> = {
    'MINOR': { bg: '#fef3c7', color: '#92400e' },
    'MAJOR': { bg: '#fee2e2', color: '#991b1b' },
    'OTHER': { bg: '#e0f2fe', color: '#0369a1' },
    'LATE_FACULTY_EVALUATION': { bg: '#e0f2fe', color: '#0369a1' },
    'LATE_PAYMENT': { bg: '#e0f2fe', color: '#0369a1' },
    'LATE_ACCESS_ROG': { bg: '#e0f2fe', color: '#0369a1' },
  };
  const s = map[category] || { bg: '#f3f4f6', color: '#374151' };
  return `<span style="display:inline-block; padding:4px 14px; border-radius:20px; font-size:13px; font-weight:600; background:${s.bg}; color:${s.color}; letter-spacing:0.3px;">${category}</span>`;
}

function offenseCountBadge(count: number, label: string): string {
  const colors = count === 1
    ? { bg: '#d1fae5', color: '#065f46' }
    : count === 2
      ? { bg: '#fef3c7', color: '#92400e' }
      : { bg: '#fee2e2', color: '#991b1b' };
  return `<span style="display:inline-block; padding:4px 14px; border-radius:20px; font-size:13px; font-weight:600; background:${colors.bg}; color:${colors.color}; letter-spacing:0.3px;">${label}</span>`;
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Template: Violation Citation Notice                                         */
/* ──────────────────────────────────────────────────────────────────────────── */

export function violationCitationHtml(params: {
  studentName: string;
  violationType: string;
  violationCategory: string;
  offenseCount: number;
  offenseLabel: string;
  actionTaken: string;
  dateOfInfraction?: string;
  description?: string;
  officerName?: string;
}): string {
  const { studentName, violationType, violationCategory, offenseCount, offenseLabel, actionTaken, dateOfInfraction, description, officerName } = params;

  const dateRow = dateOfInfraction
    ? infoRow('Date of Infraction', dateOfInfraction)
    : '';

  const descriptionRow = description
    ? infoRow('Description', description.replace(/\n/g, '<br/>'))
    : '';

  const officerRow = officerName
    ? infoRow('Recorded By', officerName)
    : '';

  const body = `${headerHtml()}

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 32px 0 32px;" class="padding-mobile">
              <p style="margin:0 0 4px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:22px; font-weight:700; color:${NAVY};">Violation Citation Notice</p>
              <p style="margin:0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151;">Hello, <strong>${studentName}</strong>. This is an official notice that a violation citation has been recorded against your name at the Center for Student Formation &amp; Discipline (CSFD), University of Makati.</p>
            </td>
          </tr>

          <!-- DETAILS TABLE -->
          <tr>
            <td style="padding:20px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
${infoRow('Violation Type', violationType, { bold: true, color: NAVY })}
${infoRow('Category', violationCategoryBadge(violationCategory))}
${infoRow('Offense Count', offenseCountBadge(offenseCount, offenseLabel))}
${infoRow('Action Taken', actionTaken)}
${dateRow}
${descriptionRow}
${officerRow}
              </table>
            </td>
          </tr>

          <!-- INFO BOX -->
          <tr>
            <td style="padding:0 32px 28px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px;">
                <tr>
                  <td style="padding:16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:13px; color:#92400e; line-height:1.6;">
                    <strong style="color:${NAVY};">What happens next?</strong><br/>
                    This citation has been recorded in the CSFD database. Depending on the offense level and count, you may be required to attend a disciplinary conference, perform community service, or other actions as determined by the CSFD office. Please visit the CSFD Office at 5th Floor, Administrative Building, or contact <a href="mailto:csfd@umak.edu.ph" style="color:${NAVY}; text-decoration:underline;">csfd@umak.edu.ph</a> for more information.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

${footerHtml()}`;

  return emailShell(body);
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Template: Violation Status Update                                           */
/* ──────────────────────────────────────────────────────────────────────────── */

export function violationStatusUpdateHtml(params: {
  studentName: string;
  violationType: string;
  violationCategory: string;
  action: string;
  actionLabel: string;
  details?: string;
  performedByName?: string;
  // Deployment info
  deploymentStatus?: string | null;
  deploymentOffice?: string | null;
  deploymentDateFrom?: string | null;
  deploymentDateTo?: string | null;
  deploymentHoursToRender?: string | null;
  deploymentAssessmentHours?: string | null;
  deploymentRemarks?: string | null;
  aipExpectedOutput?: string | null;
  // Settlement info
  settlementDate?: string | null;
  settledByName?: string | null;
}): string {
  const { studentName, violationType, violationCategory, action, actionLabel, details, performedByName,
    deploymentStatus, deploymentOffice, deploymentDateFrom, deploymentDateTo,
    deploymentHoursToRender, deploymentAssessmentHours, deploymentRemarks, aipExpectedOutput,
    settlementDate, settledByName } = params;

  const detailsRow = details
    ? infoRow('Details', details.replace(/\n/g, '<br/>'))
    : '';

  const performedByRow = performedByName
    ? infoRow('Performed By', performedByName)
    : '';

  // Build deployment details section if any deployment field is present
  const hasDeploymentInfo = deploymentStatus || deploymentOffice || deploymentDateFrom || deploymentDateTo
    || deploymentHoursToRender || deploymentAssessmentHours || deploymentRemarks || aipExpectedOutput;

  const deploymentRows = [
    deploymentStatus ? infoRow('Deployment Status', deploymentStatus) : '',
    deploymentOffice ? infoRow('Office', deploymentOffice) : '',
    deploymentDateFrom ? infoRow('Date From', deploymentDateFrom) : '',
    deploymentDateTo ? infoRow('Date To', deploymentDateTo) : '',
    deploymentHoursToRender ? infoRow('Hours to Render', deploymentHoursToRender) : '',
    deploymentAssessmentHours ? infoRow('Assessment Hours', deploymentAssessmentHours) : '',
    deploymentRemarks ? infoRow('Remarks', deploymentRemarks.replace(/\n/g, '<br/>')) : '',
    aipExpectedOutput ? infoRow('AIP Expected Output', aipExpectedOutput.replace(/\n/g, '<br/>')) : '',
  ].filter(Boolean).join('\n');

  const deploymentSection = hasDeploymentInfo
    ? `
          <!-- DEPLOYMENT DETAILS -->
          <tr>
            <td style="padding:4px 32px 0 32px;" class="padding-mobile">
              <p style="margin:0 0 8px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:16px; font-weight:700; color:${NAVY};">Deployment Details</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 20px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
${deploymentRows}
              </table>
            </td>
          </tr>`
    : '';

  // Build settlement details section if any settlement field is present
  const hasSettlementInfo = settlementDate || settledByName;

  const settlementRows = [
    settlementDate ? infoRow('Settlement Date', settlementDate) : '',
    settledByName ? infoRow('Settled By', settledByName) : '',
  ].filter(Boolean).join('\n');

  const settlementSection = hasSettlementInfo
    ? `
          <!-- SETTLEMENT DETAILS -->
          <tr>
            <td style="padding:4px 32px 0 32px;" class="padding-mobile">
              <p style="margin:0 0 8px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:16px; font-weight:700; color:${NAVY};">Settlement Details</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 20px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
${settlementRows}
              </table>
            </td>
          </tr>`
    : '';

  // Status-specific message boxes
  let statusMessageHtml = '';
  if (action === 'clear') {
    statusMessageHtml = `          <!-- STATUS MESSAGE -->
          <tr>
            <td style="padding:0 32px 28px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px;">
                <tr>
                  <td style="padding:16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:14px; color:#065f46; line-height:1.6;">
                    ✅ Your offense has been cleared. The CSFD office has resolved this violation. You no longer have a pending record for this offense.
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  } else if (action === 'endorse') {
    statusMessageHtml = `          <!-- STATUS MESSAGE -->
          <tr>
            <td style="padding:0 32px 28px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px;">
                <tr>
                  <td style="padding:16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:14px; color:#92400e; line-height:1.6;">
                    📋 Your case has been endorsed for community service. You will receive further instructions regarding your deployment schedule and requirements.
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  } else if (action === 'deploy') {
    statusMessageHtml = `          <!-- STATUS MESSAGE -->
          <tr>
            <td style="padding:0 32px 28px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#e0f2fe; border:1px solid #93c5fd; border-radius:8px;">
                <tr>
                  <td style="padding:16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:14px; color:#0369a1; line-height:1.6;">
                    📋 Your deployment information has been updated. Please check the details above and report to the assigned office as scheduled.
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  } else if (action === 'settle') {
    statusMessageHtml = `          <!-- STATUS MESSAGE -->
          <tr>
            <td style="padding:0 32px 28px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px;">
                <tr>
                  <td style="padding:16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:14px; color:#065f46; line-height:1.6;">
                    🎉 Your community service has been marked as settled. Thank you for completing the required hours.
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  } else {
    // Generic update message
    statusMessageHtml = `          <!-- STATUS MESSAGE -->
          <tr>
            <td style="padding:0 32px 28px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0f7ff; border:1px solid #bfdbfe; border-radius:8px;">
                <tr>
                  <td style="padding:16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:13px; color:#1e40af; line-height:1.6;">
                    <strong>Need more details?</strong><br/>
                    If you have questions about this update, please visit the CSFD Office at 5th Floor, Administrative Building, or contact <a href="mailto:csfd@umak.edu.ph" style="color:${NAVY}; text-decoration:underline;">csfd@umak.edu.ph</a>.
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  }

  const body = `${headerHtml()}

          <!-- GREETING -->
          <tr>
            <td style="padding:28px 32px 0 32px;" class="padding-mobile">
              <p style="margin:0 0 4px 0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:22px; font-weight:700; color:${NAVY};">${actionLabel}</p>
              <p style="margin:0; font-family:'Segoe UI',Arial,Helvetica,sans-serif; font-size:15px; color:#374151;">Hello, <strong>${studentName}</strong>. The status of your violation record has been updated.</p>
            </td>
          </tr>

          <!-- DETAILS TABLE -->
          <tr>
            <td style="padding:20px 32px;" class="padding-mobile">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
${infoRow('Violation Type', violationType, { bold: true, color: NAVY })}
${infoRow('Category', violationCategoryBadge(violationCategory))}
${infoRow('Action', statusBadge(actionLabel))}
${detailsRow}
${performedByRow}
              </table>
            </td>
          </tr>

${deploymentSection}

${settlementSection}

${statusMessageHtml}

${footerHtml()}`;

  return emailShell(body);
}
