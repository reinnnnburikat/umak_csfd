import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Helper: Ordinal date formatter                                            */
/* ──────────────────────────────────────────────────────────────────────────── */

function toOrdinalDate(date: Date): string {
  const day = date.getDate();
  const suffix = (d: number) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${day}${suffix(day)} day of ${month} ${year}`;
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Helper: Load optional config from CmsContent via DB                        */
/* ──────────────────────────────────────────────────────────────────────────── */

export interface GmcCertificateConfig {
  academicYear: string;
  directorName: string;
  directorTitle: string;
  backgroundPath: string;
  esignaturePath: string;
}

const DEFAULT_CONFIG: GmcCertificateConfig = {
  academicYear: '2025-2026',
  directorName: 'Assoc. Prof. POMPEYO C. ADAMOS III, M.A',
  directorTitle: 'Director, Center for Student Formation and Discipline',
  backgroundPath: join(process.cwd(), 'public', 'certificates', 'GMC_BACKGROUND.png'),
  esignaturePath: join(process.cwd(), 'public', 'certificates', 'DIRECTOR_E-SIGN.png'),
};

function resolveConfig(config?: Partial<GmcCertificateConfig>): GmcCertificateConfig {
  const merged = { ...DEFAULT_CONFIG, ...config };
  return {
    ...merged,
    backgroundPath: config?.backgroundPath || DEFAULT_CONFIG.backgroundPath,
    esignaturePath: config?.esignaturePath || DEFAULT_CONFIG.esignaturePath,
  };
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Certificate text builder with bold segments for name and purpose           */
/* ──────────────────────────────────────────────────────────────────────────── */

interface TextSegment {
  text: string;
  bold: boolean;
}

function getCertificateSegments(
  classification: string,
  params: {
    fullName: string;
    yearLevel?: string;
    collegeInstitute?: string;
    academicYear?: string;
    degreeTitle?: string;
    purpose: string;
    dateIssued: Date;
  }
): TextSegment[][] {
  const { fullName, yearLevel, collegeInstitute, academicYear, degreeTitle, purpose, dateIssued } = params;
  const dateStr = toOrdinalDate(dateIssued);

  // Paragraph 1: "This is to certify that **FULL NAME** is a..."
  // Paragraph 2: "Based on records..."
  // Paragraph 3: "Issued upon request..."

  let para1: TextSegment[];
  switch (classification) {
    case 'currently_enrolled':
      para1 = [
        { text: 'This is to certify that ', bold: false },
        { text: fullName, bold: true },
        { text: ' is bonafide ', bold: false },
        { text: `${yearLevel || 'student'}`, bold: true },
        { text: ' student of ', bold: false },
        { text: collegeInstitute || 'this University', bold: true },
        { text: ` of Academic year ${academicYear || 'N/A'} of this University.`, bold: false },
      ];
      break;
    case 'graduate_college':
      para1 = [
        { text: 'This is to certify that ', bold: false },
        { text: fullName, bold: true },
        { text: ' ', bold: false },
        { text: `graduated at this university with a degree of ${degreeTitle || 'a degree'}`, bold: true },
        { text: '.', bold: false },
      ];
      break;
    case 'graduate_hsu':
      para1 = [
        { text: 'This is to certify that ', bold: false },
        { text: fullName, bold: true },
        { text: ' is a ', bold: false },
        { text: 'graduate of the K to 12 - Senior High School Program', bold: true },
        { text: ' of this University.', bold: false },
      ];
      break;
    case 'former_student':
      para1 = [
        { text: 'This is to certify that ', bold: false },
        { text: fullName, bold: true },
        { text: ' is a ', bold: false },
        { text: 'former student', bold: true },
        { text: ' of this university.', bold: false },
      ];
      break;
    default:
      para1 = [
        { text: 'This is to certify that ', bold: false },
        { text: fullName, bold: true },
        { text: ' is a ', bold: false },
        { text: 'student', bold: true },
        { text: ' of this university.', bold: false },
      ];
  }

  const para2: TextSegment[] = [
    { text: 'Based on records, the above-named student has no derogatory record and has not committed any infraction against the rules and regulations of this University. Thus, of good moral character.', bold: false },
  ];

  const para3: TextSegment[] = [
    { text: `Issued upon request of the concerned person on ${dateStr} at the University of Makati, JP Rizal Ext., West Rembo, Taguig City, for the purpose of ${purpose}.`, bold: false },
  ];

  return [para1, para2, para3];
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Main: Generate GMC Certificate PDF                                         */
/* ──────────────────────────────────────────────────────────────────────────── */

export async function generateGmcCertificate(params: {
  fullName: string;
  classification: string; // 'currently_enrolled' | 'graduate_college' | 'graduate_hsu' | 'former_student'
  yearLevel?: string;
  collegeInstitute?: string; // College/Institute name (e.g., "College of Arts and Sciences")
  academicYear?: string; // Admin-set, e.g., "2025-2026"
  degreeTitle?: string;
  purpose: string;
  requestNumber: string;
  trackingToken: string; // UUID tracking token for footer
  signaturePreference: 'esign' | 'wet_sign';
  dateIssued?: Date; // defaults to now
  config?: Partial<GmcCertificateConfig>;
}): Promise<Buffer> {
  const {
    fullName,
    classification,
    yearLevel,
    collegeInstitute,
    academicYear,
    degreeTitle,
    purpose,
    requestNumber,
    trackingToken,
    signaturePreference,
    dateIssued = new Date(),
    config,
  } = params;

  const resolvedConfig = resolveConfig(config);

  // A4 dimensions in points
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;

  // Margins
  const MARGIN_LEFT = 72;
  const MARGIN_RIGHT = 72;
  const CONTENT_WIDTH = A4_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  // CERTIFICATION heading: top of the word at 1.75 inches from page top
  // 1.75 inches × 72pt/inch = 126pt
  const HEADING_Y = 126;

  // Dynamic import of pdfkit to avoid potential Turbopack bundling issues
  const PDFDocument = (await import('pdfkit')).default;

  // ── Load fonts ──
  // IMPORTANT: We must register custom TTF fonts and NEVER fall back to
  // pdfkit's built-in fonts (Helvetica, Courier, etc.) because their AFM data
  // files are not accessible in Vercel's serverless deployment environment.
  // This causes the "ENOENT: no such file or directory, open '.../Helvetica.afm'" error.
  const fontRegularPath = join(process.cwd(), 'public', 'fonts', 'Metropolis-Regular.ttf');
  const fontBoldPath = join(process.cwd(), 'public', 'fonts', 'Metropolis-Bold.ttf');
  const fontMediumPath = join(process.cwd(), 'public', 'fonts', 'Metropolis-Medium.ttf');
  const fontMarcellusPath = join(process.cwd(), 'public', 'fonts', 'Marcellus-Regular.ttf');

  // Font registration names (used in doc.font() calls below)
  const FONT_REGULAR = 'Metropolis-Regular';
  const FONT_BOLD = 'Metropolis-Bold';
  const FONT_MEDIUM = 'Metropolis-Medium';
  const FONT_MARCELLUS = 'Marcellus';

  // Pre-load font buffers for reliable registration
  // Using Buffer-based registration works in ALL environments including Vercel
  let fontRegularBuf: Buffer | null = null;
  let fontBoldBuf: Buffer | null = null;
  let fontMediumBuf: Buffer | null = null;
  let fontMarcellusBuf: Buffer | null = null;

  try {
    if (existsSync(fontRegularPath)) fontRegularBuf = readFileSync(fontRegularPath);
    if (existsSync(fontBoldPath)) fontBoldBuf = readFileSync(fontBoldPath);
    if (existsSync(fontMediumPath)) fontMediumBuf = readFileSync(fontMediumPath);
    if (existsSync(fontMarcellusPath)) fontMarcellusBuf = readFileSync(fontMarcellusPath);
  } catch (readErr) {
    console.error('[GMC Certificate] Failed to read font files:', readErr);
  }

  if (!fontRegularBuf || !fontBoldBuf) {
    const err = new Error(
      `Required fonts not found. Metropolis-Regular: ${fontRegularBuf ? 'loaded' : 'missing'}, Metropolis-Bold: ${fontBoldBuf ? 'loaded' : 'missing'}. ` +
      `Checked paths: ${fontRegularPath}, ${fontBoldPath}. CWD: ${process.cwd()}. ` +
      `Please ensure font files are in public/fonts/ directory.`
    );
    console.error('[GMC Certificate]', err.message);
    throw err;
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: [A4_WIDTH, A4_HEIGHT],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      bufferPages: true,
    });

    // Register custom TTF fonts using Buffers — this MUST be done before any doc.font() call.
    // Buffer-based registration is reliable in ALL environments (local, Docker, Vercel)
    // and avoids the Helvetica.afm ENOENT error entirely.
    try {
      doc.registerFont(FONT_REGULAR, fontRegularBuf!);
      doc.registerFont(FONT_BOLD, fontBoldBuf!);
      if (fontMediumBuf) doc.registerFont(FONT_MEDIUM, fontMediumBuf);
      if (fontMarcellusBuf) doc.registerFont(FONT_MARCELLUS, fontMarcellusBuf);
    } catch (fontRegErr) {
      console.error('[GMC Certificate] Failed to register fonts:', fontRegErr);
      reject(fontRegErr);
      return;
    }

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Draw background image ──
    if (existsSync(resolvedConfig.backgroundPath)) {
      try {
        doc.image(resolvedConfig.backgroundPath, 0, 0, {
          width: A4_WIDTH,
          height: A4_HEIGHT,
        });
      } catch (err) {
        console.warn('[GMC Certificate] Failed to draw background image:', err);
      }
    } else {
      // Fallback: plain white background
      doc.rect(0, 0, A4_WIDTH, A4_HEIGHT).fill('#ffffff');
    }

    // ── Use registered font names (NOT file paths, NOT Helvetica fallback) ──
    const regularFont = FONT_REGULAR;
    const boldFont = FONT_BOLD;
    const mediumFont = FONT_MEDIUM;
    const marcellusFont = fontMarcellusBuf ? FONT_MARCELLUS : FONT_REGULAR;

    // ── "CERTIFICATION" heading (Marcellus font, 36pt) ──
    const headingFontSize = 36;
    doc.font(marcellusFont);
    doc.fontSize(headingFontSize);
    doc.fillColor('#1a1a2e');
    doc.text('CERTIFICATION', 0, HEADING_Y, {
      width: A4_WIDTH,
      align: 'center',
    });

    // ── Decorative line under heading ──
    const lineWidth = 220;
    const lineX = (A4_WIDTH - lineWidth) / 2;
    const headingBottomY = doc.y;
    doc.moveTo(lineX, headingBottomY + 4).lineTo(lineX + lineWidth, headingBottomY + 4).lineWidth(1.5).strokeColor('#c8a415').stroke();

    // ── Body text ──
    const paragraphs = getCertificateSegments(classification, {
      fullName,
      yearLevel,
      collegeInstitute,
      academicYear,
      degreeTitle,
      purpose,
      dateIssued,
    });

    // 0.5 inch gap from bottom of heading (decorative line) to body text start
    let currentY = headingBottomY + 36;
    const bodyFontSize = 12;
    const lineGap = 6; // 1.5x line spacing: 12pt font + 6pt gap = 18pt total
    const paragraphGap = 18; // One blank line between paragraphs (= one full line height at 1.5x)
    const firstLineIndent = 36; // 0.5 inch first-line indent

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const para = paragraphs[pIdx];

      // CRITICAL FIX: Handle single-segment paragraphs properly.
      // When a paragraph has only 1 segment, sIdx===0 AND isLast===true.
      // We must use continued:false to properly end the text block,
      // otherwise PDFKit stays in "continued" mode and corrupts the next paragraph.
      if (para.length === 1) {
        // Single-segment paragraph: render directly with indent, no continued mode
        const segment = para[0];
        const font = segment.bold ? boldFont : regularFont;
        doc.font(font).fontSize(bodyFontSize).fillColor('#1a1a2e')
          .text(segment.text, MARGIN_LEFT, currentY, {
            width: CONTENT_WIDTH,
            align: 'justify',
            lineGap,
            indent: firstLineIndent,
            continued: false,
          });
      } else {
        // Multi-segment paragraph (e.g., para1 with bold name):
        // Use continued:true to chain segments with font switching,
        // but handle the indent differently — render indent offset on the
        // first call and ensure continued:false on the last segment.
        for (let sIdx = 0; sIdx < para.length; sIdx++) {
          const segment = para[sIdx];
          const isFirst = sIdx === 0;
          const isLast = sIdx === para.length - 1;
          const font = segment.bold ? boldFont : regularFont;

          if (isFirst && isLast) {
            // Shouldn't happen (single-segment handled above), but safety fallback
            doc.font(font).fontSize(bodyFontSize).fillColor('#1a1a2e')
              .text(segment.text, MARGIN_LEFT, currentY, {
                width: CONTENT_WIDTH, align: 'justify', lineGap,
                indent: firstLineIndent, continued: false,
              });
          } else if (isFirst) {
            // First segment of multi-segment paragraph: set position and start continued chain
            // Use indent option for first-line indent (works with continued:true for the first call)
            doc.font(font).fontSize(bodyFontSize).fillColor('#1a1a2e')
              .text(segment.text, MARGIN_LEFT, currentY, {
                width: CONTENT_WIDTH, align: 'justify', lineGap,
                indent: firstLineIndent, continued: true,
              });
          } else if (isLast) {
            // Last segment: close the continued chain
            doc.font(font).fontSize(bodyFontSize).fillColor('#1a1a2e')
              .text(segment.text, { width: CONTENT_WIDTH, align: 'justify', lineGap, continued: false });
          } else {
            // Middle segment: continue the chain
            doc.font(font).fontSize(bodyFontSize).fillColor('#1a1a2e')
              .text(segment.text, { width: CONTENT_WIDTH, align: 'justify', lineGap, continued: true });
          }
        }
      }

      // Move to next paragraph — one blank line gap
      currentY = doc.y + paragraphGap;
    }

    // ── Signature block ──
    // Position lower on the page for balanced layout
    // Dynamically adjusts if body text is long
    const defaultSigY = A4_HEIGHT * 0.72; // lower position (~606pt on A4)
    const minGapAfterBody = 50; // minimum gap between last paragraph and signatory
    const sigBlockY = Math.max(currentY + minGapAfterBody, defaultSigY);

    // E-signature: overlaps the director's name (sits right on top of it)
    if (signaturePreference === 'esign' && existsSync(resolvedConfig.esignaturePath)) {
      // Original image: 189w x 147h → aspect ratio ≈ 1.286
      try {
        const sigImageWidth = 160;
        const sigImageHeight = Math.round(sigImageWidth / (189 / 147)); // preserve aspect ratio ≈ 124pt
        // Position so bottom portion overlaps with the director name
        // sigBlockY = name baseline, overlap ~40pt into name area
        const sigImageTopCalc = sigBlockY - sigImageHeight + 40;
        doc.image(resolvedConfig.esignaturePath, MARGIN_LEFT, sigImageTopCalc, {
          width: sigImageWidth,
          height: sigImageHeight,
        });
      } catch (err) {
        console.warn('[GMC Certificate] Failed to draw e-signature image:', err);
      }
    }

    // Director name - BOLD, 12pt, left-aligned at left margin
    doc.font(boldFont);
    doc.fontSize(12);
    doc.fillColor('#1a1a2e');
    doc.text(resolvedConfig.directorName, MARGIN_LEFT, sigBlockY, {
      width: A4_WIDTH, // use full page width so name doesn't wrap
      align: 'left',
    });

    // Director title - regular weight, 10pt, left-aligned
    doc.font(regularFont);
    doc.fontSize(10);
    doc.fillColor('#4a4a5a');
    doc.text(resolvedConfig.directorTitle, MARGIN_LEFT, sigBlockY + 16, {
      width: A4_WIDTH, // use full page width so title doesn't wrap
      align: 'left',
    });

    // ── Footer: seal disclaimer + tracking token ──
    doc.font(regularFont);
    doc.fontSize(8);
    doc.fillColor('#999999');
    doc.text('This document is not valid without official seal.', 0, A4_HEIGHT - 50, {
      width: A4_WIDTH,
      align: 'center',
    });
    doc.text(`Token: ${trackingToken}`, 0, A4_HEIGHT - 38, {
      width: A4_WIDTH,
      align: 'center',
    });

    doc.end();
  });
}
