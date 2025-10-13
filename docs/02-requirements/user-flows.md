# User Flows
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Product, UX, Engineering  
**Purpose**: Detailed step-by-step user interaction flows

---

## Flow 1: New User Onboarding (Job Seeker)

```
START
  ↓
[Landing Page] → Click "Sign Up"
  ↓
[Signup Form]
  - Email: user@example.com
  - Password: ••••••••
  - Full Name: Jane Doe
  - Click "Create Account"
  ↓
[Email Verification]
  - "Check your email for verification link"
  - User clicks link in email
  ↓
[Mode Selection]
  - "I'm looking for a job" ← selected
  - "I'm hiring talent"
  - Click "Continue"
  ↓
[Resume Upload]
  - Drag & drop PDF OR click "Browse"
  - File uploads (progress bar)
  - AI extraction (10 seconds)
  - Display extracted: Roles, Skills, Metrics
  - Click "Looks good" OR edit fields
  ↓
[IJP Wizard - Step 1: Values]
  - "Pick your top 3 work values"
  - Options: Work-life balance, Impact, Growth, Compensation...
  - Select 3 → Click "Next"
  ↓
[IJP Wizard - Step 2: Role & Location]
  - Role: Product Manager (dropdown)
  - Locations: San Francisco, Remote (multi-select)
  - Remote OK: ✓ checked
  - Click "Next"
  ↓
[IJP Wizard - Step 3: Company & Industry]
  - Company Size: Startup, Mid-market (checkboxes)
  - Industries: SaaS, Fintech (multi-select)
  - Click "Next"
  ↓
[IJP Wizard - Step 4: Preferences]
  - Min Salary: $150,000
  - Role Level: Senior, Lead
  - Click "Next"
  ↓
[IJP Complete]
  - "Great! We found 43 jobs that match your preferences"
  - Click "See Jobs"
  ↓
[Jobs List]
  - 20 job cards displayed
  - Sorted by match score (85, 82, 78...)
  ↓
END (activated user)
```

**Drop-off Points** (optimize these):
- Signup form → Resume upload: 30% drop (friction point)
- IJP wizard step 2 → step 3: 20% drop (fatigue)

---

## Flow 2: Apply to Job

```
START: User on Jobs List
  ↓
[Job Card] → Hover (shadow appears)
  ↓
Click "Apply" button
  ↓
[Loading Modal] (5-10 seconds)
  - "Finding contacts at Acme Corp..."
  - Progress spinner
  - Background: Enrichment job runs
  ↓
[Success: Contacts Found]
  ↓
["Connect via Email" Modal]
  ├─ To: Sarah Smith (VP Product) ✓
  ├─ To: John Doe (HR Manager) ✓
  ├─ Subject: "Quick advice on PM role at Acme?"
  ├─ Body: (Pre-filled AI draft)
  │   "Hi Sarah,
  │   I spotted the Senior PM opening at Acme...
  │   [User's metric: Reduced churn by 25%]"
  ├─ Disclaimer: "Contact found via Apollo (public source)"
  ├─ Buttons: [Use Author] [Cancel] [Send]
  ↓
User clicks "Send"
  ↓
[Confirmation Toast]
  - "Sequence started! Emails will send within 5 minutes."
  - Auto-dismiss after 4 seconds
  ↓
[Redirect to Tracker]
  - New card in "Applied" column
  - Badge: "Step 1 queued"
  ↓
END

ALTERNATE FLOW: No Contacts Found
  ↓
["No contacts found" message]
  - "We couldn't find contacts at Acme Corp"
  - Options:
    ├─ [Add LinkedIn URL manually]
    └─ [Skip, track application only]
```

---

## Flow 3: Receive Reply Notification

```
START: Backend detects reply (webhook)
  ↓
[Server Processing]
  - Match reply to outreach record
  - Stop sequence (cancel future steps)
  - Update application status (Applied → Interviewing)
  ↓
[Push Notification] (if enabled)
  - "Reply from Sarah Smith at Acme Corp"
  ↓
[Email Notification]
  - Subject: "You got a reply from Acme Corp!"
  - Body: Preview of reply
  - CTA: "View in RoleFerry"
  ↓
User clicks CTA
  ↓
[Tracker Page]
  - Application card has "Reply" badge (green)
  - Card in "Interviewing" column
  ↓
User clicks card
  ↓
[Application Detail Modal]
  - Outreach history timeline:
    ├─ Step 1: Sent Oct 13, 10:00 AM
    ├─ Delivered Oct 13, 10:02 AM
    └─ Replied Oct 14, 2:15 PM ← highlighted
  - Reply preview: "Hi Jane, Love your background..."
  - Actions:
    ├─ [View Full Reply]
    ├─ [Reply via RoleFerry]
    └─ [Log Interview Date]
  ↓
User clicks "Log Interview Date"
  ↓
[Interview Form]
  - Date: Oct 20, 2025 (date picker)
  - Time: 2:00 PM (time picker)
  - Stage: Phone Screen (dropdown)
  - Interviewer: Sarah Smith
  - Notes: (optional text area)
  - Click "Save"
  ↓
[Confirmation]
  - Interview logged
  - Optional: Add to Google Calendar
  ↓
END
```

---

## Flow 4: Upgrade to Paid (Conversion)

```
START: User hits free tier limit (10 applications)
  ↓
[Apply Button Click]
  ↓
[Upgrade Modal] (blocks action)
  - "You've reached your Free tier limit (10 applications/month)"
  - "Upgrade to Pro for:"
    ✓ Unlimited applications
    ✓ AI Copilot
    ✓ LivePages
  - Pricing: $49/month OR $468/year (save 20%)
  - [Upgrade Now] [Maybe Later]
  ↓
User clicks "Upgrade Now"
  ↓
[Payment Form] (Stripe)
  - Card number
  - Expiry
  - CVC
  - Billing address
  - Click "Subscribe"
  ↓
[Processing] (2-3 seconds)
  ↓
[Success]
  - "Welcome to Pro!"
  - Confetti animation
  - "Your application limit is now unlimited"
  ↓
[Redirect Back]
  - Returns to job where they clicked Apply
  - Apply button now works
  ↓
END
```

---

## Flow 5: Recruiter Bulk Import

```
START: Recruiter on CRM page
  ↓
Click "Import Leads" button
  ↓
[Import Modal]
  - Upload CSV file (drag & drop or browse)
  - Template download link
  - Click "Upload"
  ↓
[File Parsing] (2 seconds)
  ↓
[Preview Table]
  - Shows first 10 rows
  - Columns: Name, LinkedIn URL, Company
  - Validation: ✓ 25 valid, ⚠️ 3 missing LinkedIn URL
  - Options:
    ├─ Skip invalid rows
    └─ Enrich anyway (try company + name)
  - Click "Import"
  ↓
[Enrichment Started]
  - Progress bar: "Enriching 25/25 contacts..."
  - 10 seconds → "Enriching 15/25 contacts..."
  - 20 seconds → "Enriching 5/25 contacts..."
  - 30 seconds → "Complete!"
  ↓
[Results Summary]
  - 25 leads imported
  - 21 emails found (84% success)
  - 4 no email (can add manually)
  - Click "View Leads"
  ↓
[CRM Grid]
  - 25 rows displayed
  - Columns: Name, Title, Email, Verified, Actions
  - Multi-select checkboxes
  ↓
Recruiter selects 21 (with emails)
  ↓
Click "Start Sequence"
  ↓
[Sequence Picker]
  - Templates: "Passive Candidate Outreach" (selected)
  - Preview: 3 steps shown
  - Click "Launch"
  ↓
[Confirmation]
  - "Sequence started for 21 contacts"
  - "First emails will send within 5 minutes"
  ↓
END
```

---

## 6. Error Flows

### Error Flow: Enrichment Timeout

```
User clicks Apply
  ↓
Enrichment job starts
  ↓
30 seconds pass (Apollo + Clay both timeout)
  ↓
[Error Modal]
  - "We're having trouble finding contacts"
  - Options:
    ├─ [Try Again] → Re-queue enrichment
    ├─ [Add Manually] → Open contact form
    └─ [Skip] → Track application only (no outreach)
```

---

### Error Flow: Payment Failure

```
User clicks "Upgrade Now"
  ↓
Enters card details
  ↓
Click "Subscribe"
  ↓
Stripe returns error (card declined)
  ↓
[Error Message]
  - "Payment failed: Card declined"
  - "Try a different card or contact your bank"
  - [Try Again] button
```

---

## 7. Acceptance Criteria

- [ ] All critical flows documented (onboarding, apply, upgrade, import)
- [ ] Drop-off points identified (friction analysis)
- [ ] Error flows defined (fallback UX)
- [ ] Wireframes/mockups aligned with flows
- [ ] Flows validated with user testing (5 users minimum)

---

**Document Owner**: UX Designer, Product Manager  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Bi-weekly (during active development)

