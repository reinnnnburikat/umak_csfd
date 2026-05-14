'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ViolationTypeDropdownProps {
  value: string;
  onChange: (value: string, category: string) => void;
  otherValue: string;
  onOtherChange: (value: string) => void;
  error?: string;
  id?: string;
}

interface ViolationItem {
  label: string;
  category: string; // The category to assign when this violation is selected
}

/**
 * Maps a violation_other item label to its specific category.
 * "Late Faculty Evaluation" → LATE_FACULTY_EVALUATION
 * "Late Access of ROG" → LATE_ACCESS_ROG
 * "Late Payment" → LATE_PAYMENT
 * "Late Enrollment" → OTHER
 * Everything else → OTHER
 */
function mapOtherViolationToCategory(label: string): string {
  const lower = label.toLowerCase().trim();
  if (lower.includes('faculty evaluation')) return 'LATE_FACULTY_EVALUATION';
  if (lower.includes('access of rog')) return 'LATE_ACCESS_ROG';
  if (lower.includes('payment')) return 'LATE_PAYMENT';
  if (lower.includes('enrollment')) return 'OTHER';
  return 'OTHER';
}

export function ViolationTypeDropdown({
  value,
  onChange,
  otherValue,
  onOtherChange,
  error,
  id = 'violationType',
}: ViolationTypeDropdownProps) {
  const [minorViolations, setMinorViolations] = useState<ViolationItem[]>([]);
  const [majorViolations, setMajorViolations] = useState<ViolationItem[]>([]);
  const [otherViolations, setOtherViolations] = useState<ViolationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchViolations() {
      try {
        const [minorRes, majorRes, otherRes] = await Promise.all([
          fetch('/api/lists?type=violation_minor'),
          fetch('/api/lists?type=violation_major'),
          fetch('/api/lists?type=violation_other'),
        ]);
        const minorData = await minorRes.json();
        const majorData = await majorRes.json();
        const otherData = await otherRes.json();

        // Each item knows its category based on which list it came from
        setMinorViolations(
          minorData.map((v: { label: string }) => ({ label: v.label, category: 'MINOR' }))
        );
        setMajorViolations(
          majorData.map((v: { label: string }) => ({ label: v.label, category: 'MAJOR' }))
        );
        setOtherViolations(
          otherData.map((v: { label: string }) => ({
            label: v.label,
            category: mapOtherViolationToCategory(v.label),
          }))
        );
      } catch {
        // Fallbacks are handled by the API
      } finally {
        setLoading(false);
      }
    }
    fetchViolations();
  }, []);

  const handleValueChange = (selectedValue: string) => {
    if (selectedValue === '__other__') {
      // "Other, please specify" — category defaults to OTHER, user can override
      onChange('__other__', 'OTHER');
      return;
    }

    // Look up the category from the stored violation lists
    const allViolations = [...minorViolations, ...majorViolations, ...otherViolations];
    const found = allViolations.find((v) => v.label === selectedValue);
    const category = found ? found.category : 'MAJOR'; // fallback to MAJOR

    onChange(selectedValue, category);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        Violation Type <span className="text-destructive">*</span>
      </Label>
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger className="w-full overflow-hidden" id={id}>
          <SelectValue placeholder={loading ? 'Loading violations...' : 'Select violation type...'} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel className="text-amber-600 dark:text-amber-400 font-semibold">MINOR VIOLATIONS</SelectLabel>
            {minorViolations.map((v) => (
              <SelectItem key={`minor-${v.label}`} value={v.label}>{v.label}</SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="text-red-600 dark:text-red-400 font-semibold">MAJOR VIOLATIONS</SelectLabel>
            {majorViolations.map((v) => (
              <SelectItem key={`major-${v.label}`} value={v.label}>{v.label}</SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="text-yellow-600 dark:text-yellow-400 font-semibold">OTHER VIOLATIONS</SelectLabel>
            {otherViolations.map((v) => (
              <SelectItem key={`other-${v.label}`} value={v.label}>{v.label}</SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="text-muted-foreground font-semibold">OTHER</SelectLabel>
            <SelectItem value="__other__">Other, please specify</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      {value === '__other__' && (
        <Input
          placeholder="Please specify the violation type..."
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          className="mt-2"
        />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
