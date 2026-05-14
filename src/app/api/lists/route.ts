import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const FALLBACK_COLLEGES = [
  'College of Liberal Arts and Sciences (CLAS)',
  'College of Business and Financial Science (CBFS)',
  'College of Computing and Information Sciences (CCIS)',
  'College of Continuing, Advanced and Professional Studies (CCAPS)',
  'College of Innovative Teacher Education (CITE)',
  'College of Innovative Teacher Education - Higher School ng UMak (CITE - HSU)',
  'College of Construction Sciences and Engineering (CCSE)',
  'College of Engineering Technology (CET)',
  'College of Governance and Public Policy (CGPP)',
  'College of Tourism and Hospitality Management (CTHM)',
  'Center of Human Kinesthetics (CHK)',
  'School of Law (SOL)',
  'Institute of Pharmacy (IOP)',
  'Institute of Nursing (ION)',
  'Institute of Imaging and Health Sciences (IIHS)',
  'Institute of Accountancy (IOA)',
  'Institute of Technical Education and Skills Training (ITEST)',
  'Institute of Social Development and Nation Building (ISDNB)',
  'Institute of Arts and Design (IAD)',
  'Institute of Psychology (IP)',
  'Institute of Social Work (ISW)',
  'Institute of Disaster and Emergency Management (IDEM)',
  'Other',
];

const FALLBACK_CATEGORIES = [
  'Academic Issues',
  'Behavioral Concerns',
  'Bullying/Harassment',
  'Discrimination',
  'Property Damage',
  'Safety & Security',
  'Sexual Harassment',
  'Theft/Robbery',
  'Vandalism',
  'Violence/Threats',
  'Others',
];

const FALLBACK_YEAR_LEVELS = [
  'Grade 11',
  'Grade 12',
  'First Year Level',
  'Second Year Level',
  'Third Year Level',
  'Fourth Year Level',
  'Fifth Year Level',
];

const FALLBACK_VIOLATION_MINOR = [
  'Not wearing ID',
  'Not wearing prescribed school uniform',
  'Wearing of incomplete uniform',
  'Cross Dressing (for gays/lesbians)',
  'Wearing non-prescribed shoes',
  'Wearing of slippers',
  'Wearing of miniskirts and shorts',
  'Make-Up (for males)',
  'Exhibiting rough behavior',
  'Using of vulgar/abusive/obscene language',
  'Loitering',
  'Littering',
  'Careless/unauthorized use of school property',
  'Hair Color',
  'Unauthorized posting of announcements',
  'Violation of traffic rules/Jaywalking',
  'Male dress code violations (earrings, cap inside classrooms, etc.)',
  'Female dress code violations (multiple earrings, sleeveless, etc.)',
  'General conduct violations',
];

const FALLBACK_VIOLATION_MAJOR = [
  'Writing/Putting feet on tables/chairs/walls',
  'Gambling',
  'Shouting/creating noise',
  "Using/lending another person's ID/COR",
  'Using fake IDs/CORs',
  'Cheating during examination',
  'Oral defamation',
  'Vandalism',
  'Plagiarism',
  'Convictions by court',
  'Immoral/sex-related acts/abortion',
  'Serious physical injury',
  'Theft',
  'Negligence of Duty',
  'Grave Act of Disrespect',
  'Serious Dishonesty',
  'Damaging university property',
  'Illegal assembly',
  'Possession/distribution of pornographic material',
  'Possession/smoking of cigarettes',
  'Tampering of student ID',
  'Unauthorized possession of exam materials',
  'Public Display of Affection',
  'Entering campus under influence',
  'Having someone take exam for another',
  'Bribing/receiving bribes',
  'Misappropriation of organization funds',
  'Hazing',
  'Involvement in rumble/fist fighting/armed combat',
  'Unauthorized collection/extortion',
  'Carrying/possession of firearms',
  'Membership in unrecognized organizations',
  'Drug law violations',
  'Gross Negligence',
  'Indiscriminate use of musical instruments/gadgets',
  'Portrayal of untoward behavior',
  'Grave disrespect to university officials',
  'Direct physical assault',
  'Anti-Hazing Act violations',
  'Exhibiting/exposing nude or half-naked content',
  'Forging/falsifying academic records',
  'Actions dishonoring the university',
  'Faculty Evaluation violations',
  'Wearing unauthorized lanyards (Unofficial)',
  'Wearing unauthorized fraternity insignia (Unofficial)',
];

const FALLBACK_VIOLATION_OTHER = [
  'Late Enrollment',
  'Late Payment',
  'Late Faculty Evaluation',
  'Late Access of ROG',
];

function getFallback(type: string) {
  const map: Record<string, string[]> = {
    college_institute: FALLBACK_COLLEGES,
    complaint_category: FALLBACK_CATEGORIES,
    year_level: FALLBACK_YEAR_LEVELS,
    violation_minor: FALLBACK_VIOLATION_MINOR,
    violation_major: FALLBACK_VIOLATION_MAJOR,
    violation_other: FALLBACK_VIOLATION_OTHER,
  };
  const items = map[type];
  if (!items) return [];
  return items.map((label, i) => ({ id: `fallback-${i}`, label, value: label }));
}

/**
 * Deduplicate items by label (case-insensitive), sort alphabetically,
 * and always place "Other" (case-insensitive) at the end.
 */
function dedupeSortAndOther<T extends { label: string }>(items: T[]): T[] {
  // Deduplicate by lowercase label, keeping first occurrence
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const item of items) {
    const key = item.label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  // Separate "Other" items from the rest
  const others = deduped.filter((i) => i.label.toLowerCase() === 'other');
  const rest = deduped.filter((i) => i.label.toLowerCase() !== 'other');

  // Sort non-"Other" items alphabetically by label (case-insensitive)
  rest.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));

  // Append "Other" at the end
  return [...rest, ...others];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type) {
      return NextResponse.json(
        { error: 'Missing type parameter' },
        { status: 400 }
      );
    }

    const items = await db.managedList.findMany({
      where: {
        listType: type,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        label: true,
        value: true,
      },
    });

    // If DB returns items, use them; otherwise use fallback
    if (items.length > 0) {
      // Year levels need custom ordering, not alphabetical
      if (type === 'year_level') {
        return NextResponse.json(orderYearLevels(items));
      }
      return NextResponse.json(dedupeSortAndOther(items));
    }

    // Fallback: year levels already in correct order
    if (type === 'year_level') {
      return NextResponse.json(orderYearLevels(getFallback(type)));
    }
    return NextResponse.json(dedupeSortAndOther(getFallback(type)));
  } catch (error) {
    console.error('Failed to fetch lists:', error);

    // Return fallback on error
    const { searchParams } = new URL(request.url);
    const fallbackType = searchParams.get('type');

    if (fallbackType === 'year_level') {
      return NextResponse.json(orderYearLevels(getFallback(fallbackType)));
    }
    return NextResponse.json(dedupeSortAndOther(getFallback(fallbackType || '')));
  }
}

/**
 * Order year levels in the correct academic sequence:
 * Grade 11 → Grade 12 → First Year → Second Year → ... → Fifth Year
 */
const YEAR_LEVEL_ORDER = [
  'grade 11', 'grade 12',
  'first year', '1st year', 'first year level',
  'second year', '2nd year', 'second year level',
  'third year', '3rd year', 'third year level',
  'fourth year', '4th year', 'fourth year level',
  'fifth year', '5th year', 'fifth year level',
];

function getYearLevelSortIndex(label: string): number {
  const lower = label.toLowerCase();
  for (let i = 0; i < YEAR_LEVEL_ORDER.length; i++) {
    if (lower.includes(YEAR_LEVEL_ORDER[i]) || YEAR_LEVEL_ORDER[i].includes(lower)) {
      // Return the position within its group (grade 11 = 0, grade 12 = 1, first = 2, etc.)
      return Math.floor(i / 3);
    }
  }
  // Unknown year levels go at the end
  return 100;
}

function orderYearLevels<T extends { label: string }>(items: T[]): T[] {
  // Deduplicate by label (case-insensitive)
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const item of items) {
    const key = item.label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  // Sort by the predefined academic order
  deduped.sort((a, b) => getYearLevelSortIndex(a.label) - getYearLevelSortIndex(b.label));

  return deduped;
}
