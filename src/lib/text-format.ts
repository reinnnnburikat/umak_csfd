/**
 * Text formatting utilities for user input normalization.
 *
 * These functions ensure consistent capitalization of names and degree titles
 * regardless of how the user enters them (all lowercase, ALL CAPS, etc.).
 */

/**
 * Converts a name to Title Case (every word capitalized).
 *
 * @example
 * toTitleCase("john doe")       → "John Doe"
 * toTitleCase("MARIA FE SAMAREZ") → "Maria Fe Samarez"
 * toTitleCase("  dela  cruz  ")  → "Dela Cruz"
 */
export function toTitleCase(text: string): string {
  if (!text) return text;
  return text
    .trim()
    .replace(/\s+/g, ' ') // normalize whitespace
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Converts a degree/title to Proper Case.
 * Capitalizes the first letter of each word, but keeps articles and
 * prepositions (minor words) lowercase unless they are the first word.
 *
 * @example
 * toProperTitle("bachelor of science in information technology")
 *   → "Bachelor of Science in Information Technology"
 * toProperTitle("MASTER OF ARTS IN EDUCATION")
 *   → "Master of Arts in Education"
 * toProperTitle("doctor of philosophy in business administration")
 *   → "Doctor of Philosophy in Business Administration"
 */
export function toProperTitle(text: string): string {
  if (!text) return text;
  const minorWords = new Set([
    'of', 'in', 'and', 'the', 'a', 'an', 'for', 'to',
    'at', 'by', 'on', 'or', 'nor', 'but', 'so', 'yet',
    'de', 'del', 'la', 'le',
  ]);
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word, index) => {
      const lower = word.toLowerCase();
      // Always capitalize first and last word, and words not in minor list
      if (index === 0 || !minorWords.has(lower)) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return lower;
    })
    .join(' ');
}
