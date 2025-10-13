# Product Content Strategy
## RoleFerry Platform

**Version**: 1.0  
**Audience**: UX Writers, Product, Marketing  
**Purpose**: Voice, tone, and microcopy standards

---

## 1. Voice & Tone

### Voice (Consistent Personality)
**RoleFerry sounds**:
- **Helpful**: Your partner, not a pushy vendor
- **Confident**: We know job search automation works
- **Transparent**: Honest about how we work
- **Encouraging**: Celebrate wins, support through struggles

**RoleFerry does NOT sound**:
- Overly formal or corporate
- Gimmicky or salesy
- Condescending or patronizing
- Uncertain or wishy-washy

---

### Tone (Context-Dependent)

| Context | Tone | Example |
|---------|------|---------|
| **Error message** | Apologetic + Helpful | "Oops, something went wrong. Try refreshing the page." |
| **Success** | Celebratory | "Application created! We're finding contacts now." |
| **Onboarding** | Encouraging | "Great start! Just 3 more steps to see matched jobs." |
| **Empty state** | Motivating | "No applications yet. Apply to your first job to get started!" |
| **Upsell** | Value-focused | "Upgrade to Pro for unlimited applications" (not "You're missing out!") |

---

## 2. Microcopy Examples

### 2.1 Buttons

**Primary Actions**:
- ✅ "Apply Now" (clear action)
- ✅ "Send Email" (specific)
- ❌ "Submit" (vague)
- ❌ "OK" (unclear)

**Secondary Actions**:
- ✅ "Maybe Later" (friendly)
- ✅ "Not Now" (respectful)
- ❌ "Cancel" (negative)
- ❌ "No Thanks" (abrupt)

---

### 2.2 Form Labels

**Clear & Concise**:
```
Email Address
(not "Enter your email address" - label is enough)

Password
(not "Choose a password" - implied)

Job Preferences
What roles are you looking for?
(secondary text provides context)
```

---

### 2.3 Error Messages

**Bad**:
```
Error 422: Validation failed
```

**Good**:
```
Please enter a valid email address
(specific, actionable)
```

**Bad**:
```
Enrichment job failed with error code E301
```

**Good**:
```
We couldn't find contacts at this company.
Try adding a contact manually or skip this job.
(user-friendly, provides next steps)
```

---

### 2.4 Success Messages

**Toast Notifications**:
```
✓ Application created!
✓ Sequence started
✓ Profile updated
✓ Interview logged
```

**Celebration Moments**:
```
🎉 You got a reply!
[Contact Name] at [Company] just responded.

[View Reply]
```

---

### 2.5 Empty States

**Jobs List** (no matches):
```
No jobs match your preferences yet.

Try:
• Expanding location (add Remote)
• Broadening role types
• Lowering salary minimum

[Refine Preferences]
```

**Tracker** (no applications):
```
You haven't applied to any jobs yet.

Ready to start?
1. Browse matched jobs
2. Click "Apply" on roles you like
3. We'll handle the rest

[See Jobs]
```

---

## 3. Email Content

### 3.1 Transactional Emails

**Subject Lines** (clear, specific):
```
✅ "Verify your email - RoleFerry"
✅ "You got a reply from Acme Corp"
❌ "Action required"
❌ "Important update"
```

**Body** (scannable, action-oriented):
```
Hi [Name],

[One-sentence summary of email purpose]

[Primary CTA button]

[Optional secondary info]

[Footer: Company address, unsubscribe]
```

---

### 3.2 Marketing Emails

**Weekly Newsletter**:
```
Subject: This Week in Job Search (Oct 13-20)

Hi [Name],

Your week:
• Applications: 5
• Replies: 1 (20% rate—above average!)
• Interviews: 1 scheduled

Featured: How to Follow Up After No Response
[Read Article]

Tip: Apply to 3+ jobs/week for best results.

Happy job hunting!
- RoleFerry Team

[Unsubscribe]
```

---

## 4. In-App Messaging

### 4.1 Tooltips

**Good Tooltips** (helpful, brief):
```
Match Score [i]
How well this job fits your profile (0-100).
Based on your experience, skills, and preferences.
```

**Bad Tooltips** (too long, obvious):
```
This is the match score which is calculated by our AI...
(too verbose)

Email [i]
Your email address
(obvious, not helpful)
```

---

### 4.2 Placeholder Text

**Forms**:
```
Email: you@example.com
Password: ••••••••
Company: Acme Corp
Job Title: Senior Product Manager
```

**Search**:
```
Search jobs... (try "Product Manager" or "Remote Engineer")
```

---

## 5. Accessibility & Inclusivity

### 5.1 Inclusive Language

**Use**:
- ✅ "Job seeker" (not "job hunter" - implies desperation)
- ✅ "Hiring manager" (not "recruiter" for internal folks)
- ✅ "They/them" (when gender unknown)
- ✅ "Folks" (not "guys")

**Avoid**:
- ❌ Ableist language ("crazy," "insane" for "unexpected")
- ❌ Violent metaphors ("kill," "crush")
- ❌ Gendered assumptions (he/she)

---

### 5.2 Plain Language

**Before** (jargon):
```
"Leverage RoleFerry's AI-powered enrichment waterfall to synergize with decision-makers."
```

**After** (plain):
```
"RoleFerry finds hiring managers and sends personalized emails for you."
```

**Principle**: 8th-grade reading level (accessible to all)

---

## 6. Localization (Future - Phase 3)

### Supported Languages (Priority Order)
1. **English** (US, UK, Australia, Canada)
2. **Spanish** (Mexico, Spain)
3. **French** (France, Canada)
4. **German** (Germany, Austria, Switzerland)

### Translation Keys
```typescript
// i18n/en.json
{
  "apply_button": "Apply Now",
  "tracker_title": "Your Applications",
  "empty_state_jobs": "No jobs match your preferences yet."
}

// i18n/es.json
{
  "apply_button": "Aplicar Ahora",
  "tracker_title": "Tus Aplicaciones",
  "empty_state_jobs": "Aún no hay trabajos que coincidan con tus preferencias."
}
```

---

## 7. Content Checklist

### Before Publishing (Any User-Facing Text)
- [ ] Clear and concise (remove unnecessary words)
- [ ] Actionable (what should user do next?)
- [ ] Accessible (8th-grade reading level)
- [ ] Inclusive (no gendered/ableist language)
- [ ] On-brand (matches voice & tone)
- [ ] Proofread (no typos, grammar errors)

---

## 8. Acceptance Criteria

- [ ] Voice & tone guidelines documented
- [ ] Microcopy examples provided (buttons, errors, empty states)
- [ ] Email templates standardized (transactional, marketing)
- [ ] In-app messaging patterns defined (tooltips, placeholders)
- [ ] Inclusive language guide published
- [ ] Content review process established (who approves copy?)

---

**Document Owner**: Content Lead, UX Writer  
**Version**: 1.0  
**Date**: October 2025

