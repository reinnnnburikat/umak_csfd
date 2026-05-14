'use client';

import { useWatch, type Control } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

interface ConditionalOtherFieldProps {
  /** The react-hook-form control object */
  control: Control<any>;
  /** The name of the select field to watch (e.g., 'collegeInstitute') */
  watchName: string;
  /** The value that triggers showing the "Other" input (e.g., 'Other') */
  triggerValue: string;
  /** The name of the text input field (e.g., 'collegeInstituteOther') */
  inputName: string;
  /** Label for the text input */
  label: string;
  /** Placeholder for the text input */
  placeholder: string;
  /** Whether the field is required */
  required?: boolean;
}

/**
 * A conditional text input that only renders when a watched select field
 * has a specific value (like "Other"). Uses useWatch to avoid unnecessary
 * re-renders that cause focus loss while typing.
 */
export function ConditionalOtherField({
  control,
  watchName,
  triggerValue,
  inputName,
  label,
  placeholder,
  required = true,
}: ConditionalOtherFieldProps) {
  const watchedValue = useWatch({ control, name: watchName });

  if (watchedValue !== triggerValue) return null;

  return (
    <FormField
      control={control}
      name={inputName}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label} {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Input placeholder={placeholder} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
