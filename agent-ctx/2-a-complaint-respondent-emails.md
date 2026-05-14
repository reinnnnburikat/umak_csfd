# Task 2-a: Add Email Notifications to Complaint Respondents

## Agent: complaint-respondent-emails

## Task
Add email notifications to respondents (people named in a complaint) when:
1. A new complaint is filed
2. Complaint status changes
3. Progress updates are added

## Work Summary

### Step 1: Email Templates Added to `/home/z/my-project/src/lib/email.ts`
Three new exported functions added at the end of the file (after `gmcReleaseEmailHtml`):

1. **`complaintRespondentNotificationHtml`** — For new complaint notifications to respondents
   - Title: "You Have Been Named in a Complaint"
   - Details table: Complaint Number, Subject, Filed By, Status (New)
   - Info box with CSFD instructions

2. **`complaintRespondentStatusUpdateHtml`** — For status change notifications to respondents
   - Title: "Status Update — Complaint Involving You"
   - Details table: Complaint Number, Previous Status, New Status, Reviewed By (optional), Remarks (optional)
   - Uses `getStatusSpecificMessage(newStatus)` for status-specific messages

3. **`complaintRespondentProgressUpdateHtml`** — For progress update notifications to respondents
   - Title: "Progress Update — Complaint Involving You"
   - Details table: Complaint Number, Update Title, Details, As of, Updated By (optional)
   - Info box for tracking

All templates use the same HTML patterns: `headerHtml()`, `footerHtml()`, `infoRow()`, `statusBadge()`, `trackingInfoHtml()`, `emailShell()`, NAVY/GOLD colors.

### Step 2: Updated `/home/z/my-project/src/app/api/complaints/route.ts`
- Added import: `complaintRespondentNotificationHtml`
- Added email sending loop for all respondents after the existing complainant confirmation email
- Iterates `body.respondents`, sends to each that has an email
- No BCC (only complainants get BCC to nuevasrein@gmail.com)

### Step 3: Updated `/home/z/my-project/src/app/api/complaints/[id]/route.ts`
- Added imports: `complaintRespondentStatusUpdateHtml`, `complaintRespondentProgressUpdateHtml`
- Added fire-and-forget (`Promise.resolve().then()`) email blocks for respondents:
  - After progress update email for complainants: sends progress update to all respondents
  - After status change email for complainants: sends status update to all respondents
- Parses `existing.respondents` JSON to get respondent data
- No BCC on respondent emails

## Key Decisions
- Respondent emails do NOT include BCC to nuevasrein@gmail.com (per task spec)
- Used `Promise.resolve().then()` pattern in PATCH route for fire-and-forget, matching existing pattern
- Used try/catch in POST route for respondent emails, matching existing complainant email pattern
- All lint checks pass with zero errors
