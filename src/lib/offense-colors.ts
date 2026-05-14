// Offense color coding system by violation category and offense count
// Also includes action/consequence descriptions per the UMAK CSFD rules:
//   MINOR: 3-tier — 1st=Verbal/written warning, 2nd=Written reprimand + counseling referral, 3rd=100hrs community service
//   MAJOR: 5-tier — 1st=100hrs community service, 2nd-5th=Community service per director's decision
//   OTHER/LATE_*: 5-tier respective — 1st=100hrs, 2nd=50hrs, 3rd-5th=Per director's decision

export interface OffenseColor {
  bg: string;
  text: string;
  border: string;
  hex: string;
  label: string;
  isMajor: boolean;
  action: string; // Action/consequence for this offense level
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// MINOR violations color progression (3-tier)
const MINOR_COLORS: OffenseColor[] = [
  { bg: 'bg-yellow-500', text: 'text-yellow-500', border: 'border-yellow-500', hex: '#eab308', label: '1st Offense', isMajor: false, action: 'Verbal/written warning' },
  { bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500', hex: '#f97316', label: '2nd Offense', isMajor: false, action: 'Written reprimand + counseling referral' },
  { bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500', hex: '#ef4444', label: '3rd Offense', isMajor: true, action: '100 hours community service' },
  { bg: 'bg-violet-500', text: 'text-violet-500', border: 'border-violet-500', hex: '#8b5cf6', label: '4th Offense', isMajor: true, action: '100 hours community service' },
  { bg: 'bg-pink-500', text: 'text-pink-500', border: 'border-pink-500', hex: '#ec4899', label: '5th Offense', isMajor: true, action: '100 hours community service' },
];

// MAJOR violations color progression (5-tier)
const MAJOR_COLORS: OffenseColor[] = [
  { bg: 'bg-red-600', text: 'text-red-600', border: 'border-red-600', hex: '#dc2626', label: '1st Offense', isMajor: true, action: '100 hours community service' },
  { bg: 'bg-violet-600', text: 'text-violet-600', border: 'border-violet-600', hex: '#7c3aed', label: '2nd Offense', isMajor: true, action: 'Community service per director\'s decision' },
  { bg: 'bg-red-700', text: 'text-red-700', border: 'border-red-700', hex: '#b91c1c', label: '3rd Offense', isMajor: true, action: 'Community service per director\'s decision' },
  { bg: 'bg-violet-700', text: 'text-violet-700', border: 'border-violet-700', hex: '#6d28d9', label: '4th Offense', isMajor: true, action: 'Community service per director\'s decision' },
  { bg: 'bg-slate-800', text: 'text-slate-800', border: 'border-slate-800', hex: '#1e293b', label: '5th Offense', isMajor: true, action: 'Community service per director\'s decision' },
];

// LATE FACULTY EVALUATION color progression (5-tier, respective)
const LATE_FACULTY_EVALUATION_COLORS: OffenseColor[] = [
  { bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500', hex: '#f97316', label: '1st Offense', isMajor: true, action: '100 hours community service' },
  { bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500', hex: '#ef4444', label: '2nd Offense', isMajor: true, action: '50 hours community service' },
  { bg: 'bg-violet-500', text: 'text-violet-500', border: 'border-violet-500', hex: '#8b5cf6', label: '3rd Offense', isMajor: true, action: 'Per director\'s decision' },
  { bg: 'bg-violet-600', text: 'text-violet-600', border: 'border-violet-600', hex: '#7c3aed', label: '4th Offense', isMajor: true, action: 'Per director\'s decision' },
  { bg: 'bg-slate-600', text: 'text-slate-600', border: 'border-slate-600', hex: '#475569', label: '5th Offense', isMajor: true, action: 'Per director\'s decision' },
];

// LATE ACCESS OF ROG color progression (5-tier, respective)
const LATE_ACCESS_ROG_COLORS: OffenseColor[] = [
  { bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500', hex: '#f97316', label: '1st Offense', isMajor: true, action: '100 hours community service' },
  { bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500', hex: '#ef4444', label: '2nd Offense', isMajor: true, action: '50 hours community service' },
  { bg: 'bg-violet-500', text: 'text-violet-500', border: 'border-violet-500', hex: '#8b5cf6', label: '3rd Offense', isMajor: true, action: 'Per director\'s decision' },
  { bg: 'bg-violet-600', text: 'text-violet-600', border: 'border-violet-600', hex: '#7c3aed', label: '4th Offense', isMajor: true, action: 'Per director\'s decision' },
  { bg: 'bg-slate-600', text: 'text-slate-600', border: 'border-slate-600', hex: '#475569', label: '5th Offense', isMajor: true, action: 'Per director\'s decision' },
];

// LATE PAYMENT color progression (5-tier, respective)
const LATE_PAYMENT_COLORS: OffenseColor[] = [
  { bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500', hex: '#f97316', label: '1st Offense', isMajor: true, action: '100 hours community service' },
  { bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500', hex: '#ef4444', label: '2nd Offense', isMajor: true, action: '50 hours community service' },
  { bg: 'bg-violet-500', text: 'text-violet-500', border: 'border-violet-500', hex: '#8b5cf6', label: '3rd Offense', isMajor: true, action: 'Per director\'s decision' },
  { bg: 'bg-violet-600', text: 'text-violet-600', border: 'border-violet-600', hex: '#7c3aed', label: '4th Offense', isMajor: true, action: 'Per director\'s decision' },
  { bg: 'bg-slate-600', text: 'text-slate-600', border: 'border-slate-600', hex: '#475569', label: '5th Offense', isMajor: true, action: 'Per director\'s decision' },
];

// OTHER category color progression (5-tier, respective)
const OTHER_COLORS: OffenseColor[] = [
  { bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500', hex: '#f97316', label: '1st Offense', isMajor: true, action: '100 hours community service' },
  { bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500', hex: '#ef4444', label: '2nd Offense', isMajor: true, action: '50 hours community service' },
  { bg: 'bg-violet-500', text: 'text-violet-500', border: 'border-violet-500', hex: '#8b5cf6', label: '3rd Offense', isMajor: true, action: 'Per director\'s decision' },
  { bg: 'bg-violet-600', text: 'text-violet-600', border: 'border-violet-600', hex: '#7c3aed', label: '4th Offense', isMajor: true, action: 'Per director\'s decision' },
  { bg: 'bg-slate-600', text: 'text-slate-600', border: 'border-slate-600', hex: '#475569', label: '5th Offense', isMajor: true, action: 'Per director\'s decision' },
];

// Default color for unknown categories
const DEFAULT_COLOR: OffenseColor = {
  bg: 'bg-muted',
  text: 'text-muted-foreground',
  border: 'border-muted',
  hex: '#94a3b8',
  label: '',
  isMajor: false,
  action: '',
};

function getColorPalette(category: string): OffenseColor[] {
  switch (category) {
    case 'MINOR':
      return MINOR_COLORS;
    case 'MAJOR':
      return MAJOR_COLORS;
    case 'LATE_FACULTY_EVALUATION':
      return LATE_FACULTY_EVALUATION_COLORS;
    case 'LATE_ACCESS_ROG':
      return LATE_ACCESS_ROG_COLORS;
    case 'LATE_PAYMENT':
      return LATE_PAYMENT_COLORS;
    case 'OTHER':
    case 'OTHERS':
      return OTHER_COLORS;
    default:
      return [];
  }
}

/**
 * Returns the Tailwind classes, hex color, and action/consequence for a given violation category and offense count.
 */
export function getOffenseColor(category: string, offenseCount: number): OffenseColor {
  const palette = getColorPalette(category);
  if (palette.length === 0) {
    return { ...DEFAULT_COLOR, label: ordinal(offenseCount) + ' Offense' };
  }

  const index = Math.min(offenseCount - 1, palette.length - 1);
  const clampedIndex = Math.max(0, index);

  // For offense counts beyond the defined palette, use the last color
  const color = palette[clampedIndex];

  if (offenseCount > palette.length) {
    return {
      ...color,
      label: ordinal(offenseCount) + ' Offense',
    };
  }

  return { ...color };
}

/**
 * Returns a readable text color for overlaying on the offense color background.
 * For dark backgrounds (red, violet, slate, rose, pink), use white text.
 * For light backgrounds (yellow, orange), use dark text.
 */
export function getOffenseContrastText(hex: string): string {
  const darkTextColors = ['#eab308', '#f97316'];
  return darkTextColors.includes(hex) ? 'text-slate-900' : 'text-white';
}

/**
 * Returns all defined categories for the violation category dropdown.
 */
export function getViolationCategories(): { value: string; label: string }[] {
  return [
    { value: 'MINOR', label: 'MINOR' },
    { value: 'MAJOR', label: 'MAJOR' },
    { value: 'LATE_FACULTY_EVALUATION', label: 'Late Faculty Evaluation' },
    { value: 'LATE_ACCESS_ROG', label: 'Late Access of ROG' },
    { value: 'LATE_PAYMENT', label: 'Late Payment' },
    { value: 'OTHER', label: 'OTHER' },
  ];
}

/**
 * Returns a human-readable label for a violation category value.
 */
export function getCategoryLabel(category: string): string {
  switch (category) {
    case 'MINOR':
      return 'Minor';
    case 'MAJOR':
      return 'Major';
    case 'LATE_FACULTY_EVALUATION':
      return 'Late Faculty Evaluation';
    case 'LATE_ACCESS_ROG':
      return 'Late Access of ROG';
    case 'LATE_PAYMENT':
      return 'Late Payment';
    case 'OTHER':
    case 'OTHERS':
      return 'Other';
    default:
      return category;
  }
}

/**
 * Returns the full color progression for a given category (useful for preview displays).
 */
export function getColorProgression(category: string): OffenseColor[] {
  const palette = getColorPalette(category);
  if (palette.length === 0) {
    return [{ ...DEFAULT_COLOR, label: 'No color coding' }];
  }
  return palette;
}

/**
 * Returns the counting rule description for a category.
 */
export function getCountingRule(category: string): string {
  const normalized = category === 'OTHERS' ? 'OTHER' : category;
  switch (normalized) {
    case 'MINOR':
      return 'Counted per same violation type (e.g., 2nd "Improper Attire" = 2nd Minor offense)';
    case 'MAJOR':
      return 'Counted across ALL major offenses regardless of specific violation type';
    default:
      return `Counted respectively — only the same "${getCategoryLabel(normalized)}" violation counts toward this offense number`;
  }
}
