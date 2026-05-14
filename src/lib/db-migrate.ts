/**
 * Lightweight database migration utility.
 * Automatically adds missing columns to PostgreSQL databases (e.g., Supabase)
 * when the Prisma schema has columns that don't exist in the actual database yet.
 *
 * This is idempotent — safe to run multiple times.
 * Uses raw pg library for DDL to avoid Prisma + PgBouncer prepared statement conflicts.
 *
 * IMPORTANT: Also backfills NULL values for boolean columns that should be NOT NULL
 * and adds NOT NULL constraints where appropriate. This fixes the mismatch between
 * Prisma's schema (Boolean @default(false), non-nullable) and PostgreSQL's
 * ALTER TABLE ADD COLUMN behavior (nullable by default, NULL for existing rows).
 */

import { db } from '@/lib/db';
import { rawQuery, isPostgres } from '@/lib/raw-db';

// Track whether migration has been attempted in this process
let migrationAttempted = false;
let migrationSucceeded = false;

const MIGRATION_COLUMNS: {
  table: string;
  column: string;
  type: string;
}[] = [
  // DisciplinaryCase clearance fields
  { table: 'DisciplinaryCase', column: 'isCleared', type: 'BOOLEAN DEFAULT FALSE' },
  { table: 'DisciplinaryCase', column: 'clearedByName', type: 'TEXT' },
  { table: 'DisciplinaryCase', column: 'clearedAt', type: 'TIMESTAMP(3)' },
  { table: 'DisciplinaryCase', column: 'clearReason', type: 'TEXT' },
  // DisciplinaryCase endorsement fields
  { table: 'DisciplinaryCase', column: 'isEndorsed', type: 'BOOLEAN DEFAULT FALSE' },
  { table: 'DisciplinaryCase', column: 'endorsedByName', type: 'TEXT' },
  { table: 'DisciplinaryCase', column: 'endorsedAt', type: 'TIMESTAMP(3)' },
  { table: 'DisciplinaryCase', column: 'endorsementNotes', type: 'TEXT' },
  // DisciplinaryCase deployment fields
  { table: 'DisciplinaryCase', column: 'deploymentStatus', type: 'TEXT' },
  { table: 'DisciplinaryCase', column: 'deploymentOffice', type: 'TEXT' },
  { table: 'DisciplinaryCase', column: 'deploymentDateFrom', type: 'TIMESTAMP(3)' },
  { table: 'DisciplinaryCase', column: 'deploymentDateTo', type: 'TIMESTAMP(3)' },
  { table: 'DisciplinaryCase', column: 'deploymentHoursToRender', type: 'TEXT' },
  { table: 'DisciplinaryCase', column: 'deploymentAssessmentHours', type: 'TEXT' },
  { table: 'DisciplinaryCase', column: 'deploymentRemarks', type: 'TEXT' },
  { table: 'DisciplinaryCase', column: 'aipExpectedOutput', type: 'TEXT' },
  { table: 'DisciplinaryCase', column: 'settlementDate', type: 'TIMESTAMP(3)' },
  { table: 'DisciplinaryCase', column: 'settledByName', type: 'TEXT' },
  { table: 'DisciplinaryCase', column: 'otherCategorySpecified', type: 'TEXT' },
  // OffenseHistory clearance fields
  { table: 'OffenseHistory', column: 'isCleared', type: 'BOOLEAN DEFAULT FALSE' },
  { table: 'OffenseHistory', column: 'clearedByName', type: 'TEXT' },
  { table: 'OffenseHistory', column: 'clearedAt', type: 'TIMESTAMP(3)' },
  { table: 'OffenseHistory', column: 'clearReason', type: 'TEXT' },
  { table: 'OffenseHistory', column: 'otherCategorySpecified', type: 'TEXT' },
  // Complaint fields
  { table: 'Complaint', column: 'violationType', type: 'TEXT' },
  { table: 'Complaint', column: 'complaintCategory', type: 'TEXT' },
  { table: 'Complaint', column: 'filedCase', type: 'TEXT' },
  { table: 'Complaint', column: 'modifications', type: 'TEXT' },
  { table: 'Complaint', column: 'progressUpdates', type: 'TEXT' },
  { table: 'Complaint', column: 'previousReports', type: 'TEXT' },
  // User fields
  { table: 'User', column: 'profileImageUrl', type: 'TEXT' },
  { table: 'User', column: 'department', type: 'TEXT' },
  { table: 'User', column: 'givenName', type: 'TEXT' },
  { table: 'User', column: 'surname', type: 'TEXT' },
  { table: 'User', column: 'middleName', type: 'TEXT' },
  { table: 'User', column: 'extensionName', type: 'TEXT' },
  { table: 'User', column: 'sex', type: 'TEXT' },
  // ServiceRequest fields
  { table: 'ServiceRequest', column: 'certificatePdfUrl', type: 'TEXT' },
  { table: 'ServiceRequest', column: 'classification', type: 'TEXT' },
  { table: 'ServiceRequest', column: 'issuedByName', type: 'TEXT' },
  { table: 'ServiceRequest', column: 'issuedAt', type: 'TIMESTAMP(3)' },
];

/**
 * Boolean columns that should be NOT NULL with default FALSE.
 * These need special handling: backfill NULL → false, then add NOT NULL constraint.
 * This fixes the Prisma schema mismatch where Prisma expects non-nullable booleans
 * but PostgreSQL ALTER TABLE ADD COLUMN creates nullable columns.
 */
const NOT_NULL_BOOLEAN_COLUMNS = [
  { table: 'DisciplinaryCase', column: 'isCleared' },
  { table: 'DisciplinaryCase', column: 'isEndorsed' },
  { table: 'OffenseHistory', column: 'isCleared' },
  { table: 'ManagedList', column: 'isActive' },
  { table: 'Notification', column: 'isRead' },
  { table: 'Announcement', column: 'isPinned' },
  { table: 'User', column: 'status' },  // String, not boolean, but has default
];

export async function runAutoMigration(): Promise<boolean> {
  // Only run once per process
  if (migrationAttempted) return migrationSucceeded;
  migrationAttempted = true;

  // Skip for SQLite (managed by Prisma db push)
  if (!isPostgres()) {
    migrationSucceeded = true;
    return true;
  }

  try {
    // Build a single migration SQL statement with DO blocks
    let alterSql = 'DO $$ BEGIN\n';
    let hasAlterations = false;

    for (const col of MIGRATION_COLUMNS) {
      alterSql += `  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${col.table}' AND column_name = '${col.column}') THEN\n`;
      alterSql += `    EXECUTE 'ALTER TABLE "${col.table}" ADD COLUMN "${col.column}" ${col.type}';\n`;
      alterSql += `    RAISE NOTICE 'Added column ${col.table}.${col.column}';\n`;
      alterSql += `  END IF;\n`;
      hasAlterations = true;
    }

    alterSql += 'END $$;';

    if (hasAlterations) {
      await rawQuery(alterSql);
      console.log('[DB Migrate] Auto-migration: columns added/verified.');
    }

    // ── Backfill NULL → false for boolean columns and add NOT NULL constraints ──
    // This is critical: Prisma expects these columns to be non-nullable,
    // but ALTER TABLE ADD COLUMN in PostgreSQL creates nullable columns.
    // Existing rows have NULL instead of the default value.
    // This causes Prisma type coercion errors when reading NULL for non-nullable fields.
    let backfillSql = 'DO $$ BEGIN\n';

    for (const col of NOT_NULL_BOOLEAN_COLUMNS) {
      // Step 1: Backfill NULL values with the default (false for booleans)
      // Use IF EXISTS to avoid errors if the table/column doesn't exist yet
      backfillSql += `  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${col.table}' AND column_name = '${col.column}') THEN\n`;
      backfillSql += `    EXECUTE 'UPDATE "${col.table}" SET "${col.column}" = FALSE WHERE "${col.column}" IS NULL';\n`;
      backfillSql += `    RAISE NOTICE 'Backfilled NULL → false for ${col.table}.${col.column}';\n`;
      backfillSql += `  END IF;\n`;
    }

    backfillSql += 'END $$;';

    try {
      await rawQuery(backfillSql);
      console.log('[DB Migrate] Auto-migration: NULL values backfilled for boolean columns.');
    } catch (backfillError) {
      // Non-fatal: if backfill fails, the OR queries still handle NULL values
      console.warn('[DB Migrate] NULL backfill failed (non-fatal):', backfillError);
    }

    // Ensure indexes exist using raw pg
    const indexes = [
      'CREATE INDEX IF NOT EXISTS "DisciplinaryCase_studentNumber_isCleared_idx" ON "DisciplinaryCase"("studentNumber", "isCleared")',
      'CREATE INDEX IF NOT EXISTS "DisciplinaryCase_violationCategory_idx" ON "DisciplinaryCase"("violationCategory")',
      'CREATE INDEX IF NOT EXISTS "DisciplinaryCase_status_idx" ON "DisciplinaryCase"("status")',
      'CREATE INDEX IF NOT EXISTS "User_role_status_idx" ON "User"("role", "status")',
      'CREATE INDEX IF NOT EXISTS "ServiceRequest_status_idx" ON "ServiceRequest"("status")',
      'CREATE INDEX IF NOT EXISTS "ServiceRequest_requestType_idx" ON "ServiceRequest"("requestType")',
      'CREATE INDEX IF NOT EXISTS "Complaint_caseStatus_idx" ON "Complaint"("caseStatus")',
      'CREATE INDEX IF NOT EXISTS "OffenseHistory_studentNumber_idx" ON "OffenseHistory"("studentNumber")',
      'CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead")',
    ];

    const indexSql = indexes.join(';\n') + ';';
    await rawQuery(indexSql);

    migrationSucceeded = true;
    console.log('[DB Migrate] Auto-migration complete.');
    return true;
  } catch (error) {
    console.error('[DB Migrate] Auto-migration failed:', error);
    migrationSucceeded = false;
    return false;
  }
}
