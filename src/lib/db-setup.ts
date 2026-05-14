import { db } from '@/lib/db';
import { rawQuery, isPostgres } from '@/lib/raw-db';

// ─── SQL Constants (PostgreSQL DDL) ─────────────────────────────────────────

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "givenName" TEXT,
  "surname" TEXT,
  "middleName" TEXT,
  "extensionName" TEXT,
  "studentNumber" TEXT,
  "collegeInstitute" TEXT,
  "yearLevel" TEXT,
  "sex" TEXT,
  "profileImageUrl" TEXT,
  "department" TEXT,
  "role" TEXT NOT NULL DEFAULT 'student_assistant',
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_email_key" UNIQUE ("email")
);

CREATE TABLE IF NOT EXISTS "ServiceRequest" (
  "id" TEXT NOT NULL,
  "requestNumber" TEXT NOT NULL,
  "requestType" TEXT NOT NULL,
  "requestorName" TEXT NOT NULL,
  "requestorEmail" TEXT NOT NULL,
  "classification" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Submitted',
  "formData" TEXT NOT NULL,
  "remarks" TEXT,
  "reviewedByName" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "issuedByName" TEXT,
  "issuedAt" TIMESTAMP(3),
  "trackingToken" TEXT NOT NULL,
  "fileUrls" TEXT,
  "certificatePdfUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServiceRequest_requestNumber_key" UNIQUE ("requestNumber"),
  CONSTRAINT "ServiceRequest_trackingToken_key" UNIQUE ("trackingToken")
);

CREATE TABLE IF NOT EXISTS "Complaint" (
  "id" TEXT NOT NULL,
  "complaintNumber" TEXT NOT NULL,
  "complainants" TEXT NOT NULL,
  "respondents" TEXT NOT NULL,
  "category" TEXT,
  "caseStatus" TEXT NOT NULL DEFAULT 'Pending',
  "subject" TEXT NOT NULL,
  "complaintCategory" TEXT,
  "violationType" TEXT,
  "description" TEXT NOT NULL,
  "desiredOutcome" TEXT,
  "dateOfIncident" TEXT,
  "location" TEXT,
  "isOngoing" TEXT,
  "howOften" TEXT,
  "witnesses" TEXT,
  "previousReports" TEXT,
  "fileUrls" TEXT,
  "encodedByName" TEXT,
  "filedCase" TEXT,
  "trackingToken" TEXT NOT NULL,
  "modifications" TEXT,
  "progressUpdates" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Complaint_complaintNumber_key" UNIQUE ("complaintNumber"),
  CONSTRAINT "Complaint_trackingToken_key" UNIQUE ("trackingToken")
);

CREATE TABLE IF NOT EXISTS "DisciplinaryCase" (
  "id" TEXT NOT NULL,
  "studentName" TEXT NOT NULL,
  "studentNumber" TEXT NOT NULL,
  "sex" TEXT,
  "collegeInstitute" TEXT,
  "umakEmail" TEXT,
  "violationType" TEXT NOT NULL,
  "violationCategory" TEXT NOT NULL,
  "otherCategorySpecified" TEXT,
  "description" TEXT,
  "actionTaken" TEXT,
  "offenseCount" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'First Offense',
  "dateOfInfraction" TEXT,
  "fileUrls" TEXT,
  "officerName" TEXT,
  "isCleared" BOOLEAN NOT NULL DEFAULT false,
  "clearedByName" TEXT,
  "clearedAt" TIMESTAMP(3),
  "clearReason" TEXT,
  "isEndorsed" BOOLEAN NOT NULL DEFAULT false,
  "endorsedByName" TEXT,
  "endorsedAt" TIMESTAMP(3),
  "endorsementNotes" TEXT,
  "deploymentStatus" TEXT,
  "deploymentOffice" TEXT,
  "deploymentDateFrom" TIMESTAMP(3),
  "deploymentDateTo" TIMESTAMP(3),
  "deploymentHoursToRender" TEXT,
  "deploymentAssessmentHours" TEXT,
  "deploymentRemarks" TEXT,
  "aipExpectedOutput" TEXT,
  "settlementDate" TIMESTAMP(3),
  "settledByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DisciplinaryCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Announcement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "postedFrom" TIMESTAMP(3) NOT NULL,
  "postedTo" TIMESTAMP(3) NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'All',
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "fileUrl" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "referenceId" TEXT,
  "referenceType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "performedBy" TEXT,
  "performerName" TEXT,
  "performerRole" TEXT,
  "actionType" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "recordId" TEXT,
  "oldValue" TEXT,
  "newValue" TEXT,
  "remarks" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CmsContent" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CmsContent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CmsContent_key_key" UNIQUE ("key")
);

CREATE TABLE IF NOT EXISTS "EmailTemplate" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "bodyHtml" TEXT NOT NULL,
  "variables" TEXT,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailTemplate_eventType_key" UNIQUE ("eventType")
);

CREATE TABLE IF NOT EXISTS "OffenseHistory" (
  "id" TEXT NOT NULL,
  "studentNumber" TEXT NOT NULL,
  "violationType" TEXT NOT NULL,
  "violationCategory" TEXT NOT NULL,
  "otherCategorySpecified" TEXT,
  "offenseCount" INTEGER NOT NULL,
  "disciplinaryCaseId" TEXT,
  "dateOfInfraction" TEXT,
  "isCleared" BOOLEAN NOT NULL DEFAULT false,
  "clearedByName" TEXT,
  "clearedAt" TIMESTAMP(3),
  "clearReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OffenseHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ManagedList" (
  "id" TEXT NOT NULL,
  "listType" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "extra" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagedList_pkey" PRIMARY KEY ("id")
);
`;

const ADD_CONSTRAINTS_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Announcement_createdById_fkey') THEN
    ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Notification_userId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'AuditLog_performedBy_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CmsContent_updatedBy_fkey') THEN
    ALTER TABLE "CmsContent" ADD CONSTRAINT "CmsContent_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'EmailTemplate_updatedBy_fkey') THEN
    ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'OffenseHistory_disciplinaryCaseId_fkey') THEN
    ALTER TABLE "OffenseHistory" ADD CONSTRAINT "OffenseHistory_disciplinaryCaseId_fkey" FOREIGN KEY ("disciplinaryCaseId") REFERENCES "DisciplinaryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`;

const ADD_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS "Announcement_createdById_idx" ON "Announcement"("createdById");
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_performedBy_idx" ON "AuditLog"("performedBy");
CREATE INDEX IF NOT EXISTS "ManagedList_listType_idx" ON "ManagedList"("listType");
CREATE INDEX IF NOT EXISTS "ServiceRequest_requestType_idx" ON "ServiceRequest"("requestType");
CREATE INDEX IF NOT EXISTS "ServiceRequest_status_idx" ON "ServiceRequest"("status");
CREATE INDEX IF NOT EXISTS "Complaint_caseStatus_idx" ON "Complaint"("caseStatus");
CREATE INDEX IF NOT EXISTS "OffenseHistory_studentNumber_idx" ON "OffenseHistory"("studentNumber");
CREATE INDEX IF NOT EXISTS "OffenseHistory_disciplinaryCaseId_idx" ON "OffenseHistory"("disciplinaryCaseId");
CREATE INDEX IF NOT EXISTS "DisciplinaryCase_studentNumber_isCleared_idx" ON "DisciplinaryCase"("studentNumber", "isCleared");
CREATE INDEX IF NOT EXISTS "DisciplinaryCase_violationCategory_idx" ON "DisciplinaryCase"("violationCategory");
CREATE INDEX IF NOT EXISTS "DisciplinaryCase_status_idx" ON "DisciplinaryCase"("status");
CREATE INDEX IF NOT EXISTS "User_role_status_idx" ON "User"("role", "status");
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
`;

// ─── Internal helpers ───────────────────────────────────────────────────

/**
 * Create all tables using native pg library (bypasses Prisma + PgBouncer issue).
 * Executes all CREATE TABLE statements in a single connection to avoid prepared statement conflicts.
 */
async function createAllTables(): Promise<void> {
  // Execute DDL in one batch through a single raw pg connection
  await rawQuery(CREATE_TABLES_SQL);

  // Add foreign key constraints (non-critical — wrapped in try/catch)
  try { await rawQuery(ADD_CONSTRAINTS_SQL); } catch { /* non-critical */ }

  // Add indexes (non-critical — each is idempotent with IF NOT EXISTS)
  try { await rawQuery(ADD_INDEXES_SQL); } catch { /* non-critical */ }
}

async function seedUsers(): Promise<void> {
  const { hashSync } = await import('bcryptjs');

  await db.user.upsert({
    where: { email: 'reinernuevas.acads@gmail.com' },
    update: {
      passwordHash: hashSync('@CSFDSARein03082026', 10),
      fullName: 'REINER NUEVAS',
      givenName: 'Reiner',
      surname: 'Nuevas',
      role: 'superadmin',
      status: 'active',
    },
    create: {
      email: 'reinernuevas.acads@gmail.com',
      passwordHash: hashSync('@CSFDSARein03082026', 10),
      fullName: 'REINER NUEVAS',
      givenName: 'Reiner',
      surname: 'Nuevas',
      role: 'superadmin',
      status: 'active',
    },
  });

  await db.user.upsert({
    where: { email: 'adamos.pompeyoiii@umak.edu.ph' },
    update: {
      passwordHash: hashSync('@CSFDDIRPoms03082026', 10),
      fullName: 'POMPEYO ADAMOS III',
      givenName: 'Pompeyo',
      surname: 'Adamos III',
      role: 'admin',
      status: 'active',
      profileImageUrl: '/profiles/pompeyo.png',
    },
    create: {
      email: 'adamos.pompeyoiii@umak.edu.ph',
      passwordHash: hashSync('@CSFDDIRPoms03082026', 10),
      fullName: 'POMPEYO ADAMOS III',
      givenName: 'Pompeyo',
      surname: 'Adamos III',
      role: 'admin',
      status: 'active',
      profileImageUrl: '/profiles/pompeyo.png',
    },
  });

  await db.user.upsert({
    where: { email: 'mariafe.samares@umak.edu.ph' },
    update: {
      passwordHash: hashSync('@CSFDAS1SAM03082026', 10),
      fullName: 'MARIA FE SAMARES-ROXAS',
      givenName: 'Maria Fe',
      surname: 'Samares-Roxas',
      role: 'staff',
      status: 'active',
      profileImageUrl: '/profiles/sam.png',
    },
    create: {
      email: 'mariafe.samares@umak.edu.ph',
      passwordHash: hashSync('@CSFDAS1SAM03082026', 10),
      fullName: 'MARIA FE SAMARES-ROXAS',
      givenName: 'Maria Fe',
      surname: 'Samares-Roxas',
      role: 'staff',
      status: 'active',
      profileImageUrl: '/profiles/sam.png',
    },
  });

  await db.user.upsert({
    where: { email: 'alma.fraginal@umak.edu.ph' },
    update: {
      passwordHash: hashSync('@CSFDAS2ALMA03082026', 10),
      fullName: 'ALMA FRAGINAL',
      givenName: 'Alma',
      surname: 'Fraginal',
      role: 'staff',
      status: 'active',
      profileImageUrl: '/profiles/alma.png',
    },
    create: {
      email: 'alma.fraginal@umak.edu.ph',
      passwordHash: hashSync('@CSFDAS2ALMA03082026', 10),
      fullName: 'ALMA FRAGINAL',
      givenName: 'Alma',
      surname: 'Fraginal',
      role: 'staff',
      status: 'active',
      profileImageUrl: '/profiles/alma.png',
    },
  });

  await db.user.upsert({
    where: { email: 'cbasilio@umak.edu.ph' },
    update: {
      passwordHash: hashSync('@CSFDAS3CATH03082026', 10),
      fullName: 'CATHERINE BASILIO',
      givenName: 'Catherine',
      surname: 'Basilio',
      role: 'staff',
      status: 'active',
    },
    create: {
      email: 'cbasilio@umak.edu.ph',
      passwordHash: hashSync('@CSFDAS3CATH03082026', 10),
      fullName: 'CATHERINE BASILIO',
      givenName: 'Catherine',
      surname: 'Basilio',
      role: 'staff',
      status: 'active',
    },
  });
}

async function seedManagedLists(): Promise<void> {
  const listTypesToSync = ['college_institute', 'violation_minor', 'violation_major', 'violation_other', 'complaint_category'];
  for (const listType of listTypesToSync) {
    await db.managedList.deleteMany({ where: { listType } });
  }

  const lists: Array<{ listType: string; label: string; value: string; sortOrder: number }> = [
    // Minor violations
    { listType: 'violation_minor', label: 'Not wearing ID', value: 'Not wearing ID', sortOrder: 1 },
    { listType: 'violation_minor', label: 'Not wearing prescribed school uniform', value: 'Not wearing prescribed school uniform', sortOrder: 2 },
    { listType: 'violation_minor', label: 'Wearing of incomplete uniform', value: 'Wearing of incomplete uniform', sortOrder: 3 },
    { listType: 'violation_minor', label: 'Cross Dressing (for gays/lesbians)', value: 'Cross Dressing (for gays/lesbians)', sortOrder: 4 },
    { listType: 'violation_minor', label: 'Wearing non-prescribed shoes', value: 'Wearing non-prescribed shoes', sortOrder: 5 },
    { listType: 'violation_minor', label: 'Wearing of slippers', value: 'Wearing of slippers', sortOrder: 6 },
    { listType: 'violation_minor', label: 'Wearing of miniskirts and shorts', value: 'Wearing of miniskirts and shorts', sortOrder: 7 },
    { listType: 'violation_minor', label: 'Make-Up (for males)', value: 'Make-Up (for males)', sortOrder: 8 },
    { listType: 'violation_minor', label: 'Exhibiting rough behavior', value: 'Exhibiting rough behavior', sortOrder: 9 },
    { listType: 'violation_minor', label: 'Using of vulgar/abusive/obscene language', value: 'Using of vulgar/abusive/obscene language', sortOrder: 10 },
    { listType: 'violation_minor', label: 'Loitering', value: 'Loitering', sortOrder: 11 },
    { listType: 'violation_minor', label: 'Littering', value: 'Littering', sortOrder: 12 },
    { listType: 'violation_minor', label: 'Careless/unauthorized use of school property', value: 'Careless/unauthorized use of school property', sortOrder: 13 },
    { listType: 'violation_minor', label: 'Hair Color', value: 'Hair Color', sortOrder: 14 },
    { listType: 'violation_minor', label: 'Unauthorized posting of announcements', value: 'Unauthorized posting of announcements', sortOrder: 15 },
    { listType: 'violation_minor', label: 'Violation of traffic rules/Jaywalking', value: 'Violation of traffic rules/Jaywalking', sortOrder: 16 },
    { listType: 'violation_minor', label: 'Male dress code violations (earrings, cap inside classrooms, etc.)', value: 'Male dress code violations (earrings, cap inside classrooms, etc.)', sortOrder: 17 },
    { listType: 'violation_minor', label: 'Female dress code violations (multiple earrings, sleeveless, etc.)', value: 'Female dress code violations (multiple earrings, sleeveless, etc.)', sortOrder: 18 },
    { listType: 'violation_minor', label: 'General conduct violations', value: 'General conduct violations', sortOrder: 19 },
    // Major violations
    { listType: 'violation_major', label: 'Writing/Putting feet on tables/chairs/walls', value: 'Writing/Putting feet on tables/chairs/walls', sortOrder: 1 },
    { listType: 'violation_major', label: 'Gambling', value: 'Gambling', sortOrder: 2 },
    { listType: 'violation_major', label: 'Shouting/creating noise', value: 'Shouting/creating noise', sortOrder: 3 },
    { listType: 'violation_major', label: "Using/lending another person's ID/COR", value: "Using/lending another person's ID/COR", sortOrder: 4 },
    { listType: 'violation_major', label: 'Using fake IDs/CORs', value: 'Using fake IDs/CORs', sortOrder: 5 },
    { listType: 'violation_major', label: 'Cheating during examination', value: 'Cheating during examination', sortOrder: 6 },
    { listType: 'violation_major', label: 'Oral defamation', value: 'Oral defamation', sortOrder: 7 },
    { listType: 'violation_major', label: 'Vandalism', value: 'Vandalism', sortOrder: 8 },
    { listType: 'violation_major', label: 'Plagiarism', value: 'Plagiarism', sortOrder: 9 },
    { listType: 'violation_major', label: 'Convictions by court', value: 'Convictions by court', sortOrder: 10 },
    { listType: 'violation_major', label: 'Immoral/sex-related acts/abortion', value: 'Immoral/sex-related acts/abortion', sortOrder: 11 },
    { listType: 'violation_major', label: 'Serious physical injury', value: 'Serious physical injury', sortOrder: 12 },
    { listType: 'violation_major', label: 'Theft', value: 'Theft', sortOrder: 13 },
    { listType: 'violation_major', label: 'Negligence of Duty', value: 'Negligence of Duty', sortOrder: 14 },
    { listType: 'violation_major', label: 'Grave Act of Disrespect', value: 'Grave Act of Disrespect', sortOrder: 15 },
    { listType: 'violation_major', label: 'Serious Dishonesty', value: 'Serious Dishonesty', sortOrder: 16 },
    { listType: 'violation_major', label: 'Damaging university property', value: 'Damaging university property', sortOrder: 17 },
    { listType: 'violation_major', label: 'Illegal assembly', value: 'Illegal assembly', sortOrder: 18 },
    { listType: 'violation_major', label: 'Possession/distribution of pornographic material', value: 'Possession/distribution of pornographic material', sortOrder: 19 },
    { listType: 'violation_major', label: 'Possession/smoking of cigarettes', value: 'Possession/smoking of cigarettes', sortOrder: 20 },
    { listType: 'violation_major', label: 'Tampering of student ID', value: 'Tampering of student ID', sortOrder: 21 },
    { listType: 'violation_major', label: 'Unauthorized possession of exam materials', value: 'Unauthorized possession of exam materials', sortOrder: 22 },
    { listType: 'violation_major', label: 'Public Display of Affection', value: 'Public Display of Affection', sortOrder: 23 },
    { listType: 'violation_major', label: 'Entering campus under influence', value: 'Entering campus under influence', sortOrder: 24 },
    { listType: 'violation_major', label: 'Having someone take exam for another', value: 'Having someone take exam for another', sortOrder: 25 },
    { listType: 'violation_major', label: 'Bribing/receiving bribes', value: 'Bribing/receiving bribes', sortOrder: 26 },
    { listType: 'violation_major', label: 'Misappropriation of organization funds', value: 'Misappropriation of organization funds', sortOrder: 27 },
    { listType: 'violation_major', label: 'Hazing', value: 'Hazing', sortOrder: 28 },
    { listType: 'violation_major', label: 'Involvement in rumble/fist fighting/armed combat', value: 'Involvement in rumble/fist fighting/armed combat', sortOrder: 29 },
    { listType: 'violation_major', label: 'Unauthorized collection/extortion', value: 'Unauthorized collection/extortion', sortOrder: 30 },
    { listType: 'violation_major', label: 'Carrying/possession of firearms', value: 'Carrying/possession of firearms', sortOrder: 31 },
    { listType: 'violation_major', label: 'Membership in unrecognized organizations', value: 'Membership in unrecognized organizations', sortOrder: 32 },
    { listType: 'violation_major', label: 'Drug law violations', value: 'Drug law violations', sortOrder: 33 },
    { listType: 'violation_major', label: 'Gross Negligence', value: 'Gross Negligence', sortOrder: 34 },
    { listType: 'violation_major', label: 'Indiscriminate use of musical instruments/gadgets', value: 'Indiscriminate use of musical instruments/gadgets', sortOrder: 35 },
    { listType: 'violation_major', label: 'Portrayal of untoward behavior', value: 'Portrayal of untoward behavior', sortOrder: 36 },
    { listType: 'violation_major', label: 'Grave disrespect to university officials', value: 'Grave disrespect to university officials', sortOrder: 37 },
    { listType: 'violation_major', label: 'Direct physical assault', value: 'Direct physical assault', sortOrder: 38 },
    { listType: 'violation_major', label: 'Anti-Hazing Act violations', value: 'Anti-Hazing Act violations', sortOrder: 39 },
    { listType: 'violation_major', label: 'Exhibiting/exposing nude or half-naked content', value: 'Exhibiting/exposing nude or half-naked content', sortOrder: 40 },
    { listType: 'violation_major', label: 'Forging/falsifying academic records', value: 'Forging/falsifying academic records', sortOrder: 41 },
    { listType: 'violation_major', label: 'Actions dishonoring the university', value: 'Actions dishonoring the university', sortOrder: 42 },
    { listType: 'violation_major', label: 'Faculty Evaluation violations', value: 'Faculty Evaluation violations', sortOrder: 43 },
    { listType: 'violation_major', label: 'Wearing unauthorized lanyards (Unofficial)', value: 'Wearing unauthorized lanyards (Unofficial)', sortOrder: 44 },
    { listType: 'violation_major', label: 'Wearing unauthorized fraternity insignia (Unofficial)', value: 'Wearing unauthorized fraternity insignia (Unofficial)', sortOrder: 45 },
    // Other violations
    { listType: 'violation_other', label: 'Late Enrollment', value: 'Late Enrollment', sortOrder: 1 },
    { listType: 'violation_other', label: 'Late Payment', value: 'Late Payment', sortOrder: 2 },
    { listType: 'violation_other', label: 'Late Faculty Evaluation', value: 'Late Faculty Evaluation', sortOrder: 3 },
    // Complaint categories
    { listType: 'complaint_category', label: 'Academic', value: 'Academic', sortOrder: 1 },
    { listType: 'complaint_category', label: 'Behavioral', value: 'Behavioral', sortOrder: 2 },
    { listType: 'complaint_category', label: 'Facilities', value: 'Facilities', sortOrder: 3 },
    { listType: 'complaint_category', label: 'Harassment', value: 'Harassment', sortOrder: 4 },
    { listType: 'complaint_category', label: 'Others', value: 'Others', sortOrder: 5 },
    // Colleges
    { listType: 'college_institute', label: 'College of Liberal Arts and Sciences (CLAS)', value: 'College of Liberal Arts and Sciences (CLAS)', sortOrder: 1 },
    { listType: 'college_institute', label: 'College of Business and Financial Science (CBFS)', value: 'College of Business and Financial Science (CBFS)', sortOrder: 2 },
    { listType: 'college_institute', label: 'College of Computing and Information Sciences (CCIS)', value: 'College of Computing and Information Sciences (CCIS)', sortOrder: 3 },
    { listType: 'college_institute', label: 'College of Continuing, Advanced and Professional Studies (CCAPS)', value: 'College of Continuing, Advanced and Professional Studies (CCAPS)', sortOrder: 4 },
    { listType: 'college_institute', label: 'College of Innovative Teacher Education (CITE)', value: 'College of Innovative Teacher Education (CITE)', sortOrder: 5 },
    { listType: 'college_institute', label: 'College of Innovative Teacher Education - Higher School ng UMak (CITE - HSU)', value: 'College of Innovative Teacher Education - Higher School ng UMak (CITE - HSU)', sortOrder: 6 },
    { listType: 'college_institute', label: 'College of Construction Sciences and Engineering (CCSE)', value: 'College of Construction Sciences and Engineering (CCSE)', sortOrder: 7 },
    { listType: 'college_institute', label: 'College of Engineering Technology (CET)', value: 'College of Engineering Technology (CET)', sortOrder: 8 },
    { listType: 'college_institute', label: 'College of Governance and Public Policy (CGPP)', value: 'College of Governance and Public Policy (CGPP)', sortOrder: 9 },
    { listType: 'college_institute', label: 'College of Tourism and Hospitality Management (CTHM)', value: 'College of Tourism and Hospitality Management (CTHM)', sortOrder: 10 },
    { listType: 'college_institute', label: 'Center of Human Kinesthetics (CHK)', value: 'Center of Human Kinesthetics (CHK)', sortOrder: 11 },
    { listType: 'college_institute', label: 'School of Law (SOL)', value: 'School of Law (SOL)', sortOrder: 12 },
    { listType: 'college_institute', label: 'Institute of Pharmacy (IOP)', value: 'Institute of Pharmacy (IOP)', sortOrder: 13 },
    { listType: 'college_institute', label: 'Institute of Nursing (ION)', value: 'Institute of Nursing (ION)', sortOrder: 14 },
    { listType: 'college_institute', label: 'Institute of Imaging and Health Sciences (IIHS)', value: 'Institute of Imaging and Health Sciences (IIHS)', sortOrder: 15 },
    { listType: 'college_institute', label: 'Institute of Accountancy (IOA)', value: 'Institute of Accountancy (IOA)', sortOrder: 16 },
    { listType: 'college_institute', label: 'Institute of Technical Education and Skills Training (ITEST)', value: 'Institute of Technical Education and Skills Training (ITEST)', sortOrder: 17 },
    { listType: 'college_institute', label: 'Institute of Social Development and Nation Building (ISDNB)', value: 'Institute of Social Development and Nation Building (ISDNB)', sortOrder: 18 },
    { listType: 'college_institute', label: 'Institute of Arts and Design (IAD)', value: 'Institute of Arts and Design (IAD)', sortOrder: 19 },
    { listType: 'college_institute', label: 'Institute of Psychology (IP)', value: 'Institute of Psychology (IP)', sortOrder: 20 },
    { listType: 'college_institute', label: 'Institute of Social Work (ISW)', value: 'Institute of Social Work (ISW)', sortOrder: 21 },
    { listType: 'college_institute', label: 'Institute of Disaster and Emergency Management (IDEM)', value: 'Institute of Disaster and Emergency Management (IDEM)', sortOrder: 22 },
    { listType: 'college_institute', label: 'Other', value: 'Other', sortOrder: 23 },
  ];

  // Insert in batches to avoid timeout
  const BATCH_SIZE = 20;
  for (let i = 0; i < lists.length; i += BATCH_SIZE) {
    await db.managedList.createMany({ data: lists.slice(i, i + BATCH_SIZE) });
  }
}

async function seedAnnouncements(): Promise<void> {
  const superadmin = await db.user.findUnique({ where: { email: 'reinernuevas.acads@gmail.com' } });
  const admin = await db.user.findUnique({ where: { email: 'adamos.pompeyoiii@umak.edu.ph' } });
  if (!superadmin) return;

  const now = new Date();
  await db.announcement.createMany({
    data: [
      {
        title: 'Welcome to iCSFD+ Digital Platform',
        body: 'We are excited to launch the iCSFD+ digital platform for the University of Makati Center for Student Formation and Discipline. This platform allows you to submit service requests, file complaints, and track your applications online.',
        postedFrom: now,
        postedTo: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        visibility: 'All',
        isPinned: true,
        createdById: superadmin.id,
      },
      {
        title: 'Office Hours: Monday to Friday, 8:00 AM - 5:00 PM',
        body: 'The CSFD office is open from Monday to Friday, 8:00 AM to 5:00 PM. Please visit during office hours for any concerns that require personal assistance.',
        postedFrom: now,
        postedTo: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
        visibility: 'All',
        isPinned: true,
        createdById: admin?.id || superadmin.id,
      },
    ],
  });
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Ensures the database is fully ready for use.
 * Automatically called by the login endpoint on first Vercel deployment.
 *
 * - Creates all tables if they don't exist (PostgreSQL only, using raw pg)
 * - Seeds 5 default staff/admin users if none exist
 * - Seeds managed lists (colleges, violations, categories) if none exist
 * - Creates default welcome announcements if none exist
 */
export async function ensureDatabaseReady(): Promise<void> {
  // SQLite is managed by Prisma locally — just seed users if needed
  if (!isPostgres()) {
    try {
      const count = await db.user.count();
      if (count === 0) {
        console.log('[DB Auto-Setup] SQLite: Seeding users...');
        await seedUsers();
      }
    } catch (err) {
      console.error('[DB Auto-Setup] SQLite seed failed:', err);
    }
    return;
  }

  // ── PostgreSQL (Vercel / Supabase) ──
  try {
    // Step 1: Check if User table exists using raw pg
    const { Pool } = await import('pg');
    const dbUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
    const checkPool = new Pool({ connectionString: dbUrl, max: 1 });
    const checkResult = await checkPool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'User'
      ) as exists`
    );
    await checkPool.end();
    const userTableExists = checkResult.rows[0]?.exists ?? false;

    if (!userTableExists) {
      console.log('[DB Auto-Setup] No tables found — creating all tables via raw pg...');
      await createAllTables();
    }

    // Step 2: Seed users if none exist (using Prisma ORM — these are simple queries)
    const userCount = await db.user.count();
    if (userCount === 0) {
      console.log('[DB Auto-Setup] No users found — seeding default accounts...');
      await seedUsers();
    }

    // Step 3: Seed managed lists if none exist
    try {
      const listCount = await db.managedList.count();
      if (listCount === 0) {
        console.log('[DB Auto-Setup] Seeding managed lists...');
        await seedManagedLists();
      }
    } catch (err) {
      console.error('[DB Auto-Setup] Managed lists seed failed:', err);
    }

    // Step 4: Create welcome announcements if none exist
    try {
      const annCount = await db.announcement.count();
      if (annCount === 0) {
        console.log('[DB Auto-Setup] Creating welcome announcements...');
        await seedAnnouncements();
      }
    } catch (err) {
      console.error('[DB Auto-Setup] Announcements seed failed:', err);
    }

    console.log('[DB Auto-Setup] Database is ready.');
  } catch (err) {
    console.error('[DB Auto-Setup] Failed:', err);
    // Don't throw — let the login proceed and show its own error message
  }
}
