# Onboarding Flow
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Product, UX, Engineering  
**Purpose**: Design effective first-time user experience

---

## 1. Onboarding Goals

### Success Metrics
- **D1 Activation**: 60% apply to 1+ job (within 24 hours)
- **D7 Retention**: 70% return within 7 days
- **Time to First Apply**: <10 minutes (signup → first application)

---

## 2. Onboarding Flow (Job Seeker)

### Step 1: Sign Up (30 seconds)

**Fields**:
- Email
- Password (8+ characters)
- [Optional] "How did you hear about us?" (dropdown)

**No friction**:
- ❌ Don't ask for name (collect later)
- ❌ Don't require email verification upfront (verify later)
- ✅ Social login (Google, LinkedIn) for speed

**CTA**: "Start Finding Jobs"

---

### Step 2: Mode Selection (10 seconds)

**Question**: "What brings you to RoleFerry?"

**Options**:
- 🔍 **I'm looking for a job** → Job Seeker mode
- 🧑‍💼 **I'm hiring** → Recruiter mode

**Why**: Determines UI labels, default settings

---

### Step 3: Intent & Job Preferences (IJP Wizard) (5 minutes)

**Goal**: Collect enough data to show matched jobs

**Screens** (5 total, progress bar):

**3.1 Current Role**:
```
What's your current (or most recent) role?

[Text Input: e.g., "Senior Product Manager"]

(We'll use this to match you with similar roles)
```

**3.2 Desired Roles**:
```
What roles are you looking for? (Select all that apply)

☐ Product Manager
☐ Senior Product Manager
☐ Director of Product
☐ VP Product
☐ Other: [Text Input]

[Next]
```

**3.3 Location**:
```
Where do you want to work?

☐ Remote (anywhere)
☐ Specific location: [City, State]
☐ Willing to relocate

[Next]
```

**3.4 Salary (Optional)**:
```
What's your minimum salary?

$ [Input] /year

(Optional, but helps us match you better)

[Next]
```

**3.5 Resume Upload**:
```
Upload your resume (PDF or DOCX)

[Drag & Drop or Click to Upload]

Or paste LinkedIn URL: [Input]

(We'll use this to personalize your outreach)

[Finish Setup]
```

**Note**: Keep it short (5 screens max, <5 min). Can refine later in Settings.

---

### Step 4: First Matched Jobs (Immediate)

**Show**: 10 matched jobs (based on IJP)

**UI**:
```
Great! Here are 10 jobs that match your profile:

[Job Card 1: Senior PM at Acme Corp | 82% Match | $150K-$180K | Remote]
  [Apply] [Save]

[Job Card 2: ...]

💡 Tip: Apply to 3-5 jobs to see how RoleFerry works.
```

**Goal**: Get user to apply to first job (activation)

---

### Step 5: First Apply Experience (Tutorial)

**When**: User clicks "Apply" on first job

**Modal** (Tutorial):
```
Here's what happens when you Apply:

1. ✅ We find the hiring manager (or recruiter)
2. ✅ AI drafts a personalized email
3. ✅ We send it from our warmed domains
4. ✅ Track replies in your Tracker

Ready?

[Let's Do It!]
```

**Then**: Standard apply flow (see below)

---

## 3. Apply Flow (Core Action)

### 3.1 Find Contacts (10-30 seconds)

**UI** (Loading state):
```
Finding contacts at [Company]...

[Spinner]

✓ Company domain found
✓ Searching for hiring managers...
```

**Success**:
```
Found 2 contacts:

[Contact Card 1: Sarah Smith | VP Engineering | sarah@acme.com ✓ Verified]
[Contact Card 2: John Doe | Head of Talent | john@acme.com ✓ Verified]

Who should we email?
☑ Sarah Smith (Recommended)
☐ John Doe

[Next]
```

**Failure** (No contacts found):
```
We couldn't find contacts at [Company].

This can happen for:
• Small or private companies
• Startups with limited data

Options:
• Add a contact manually (paste LinkedIn URL)
• Skip this job and try another

[Add Manually] [Skip]
```

---

### 3.2 Draft Email (AI-Generated)

**UI**:
```
We wrote this email for you (feel free to edit):

To: Sarah Smith <sarah@acme.com>
Subject: Quick question about Senior PM role

Hi Sarah,

I came across the Senior PM role at Acme Corp and wanted to reach out directly.

I have 5 years of product experience (most recently at XYZ Corp, where I led a team of 8 and launched 3 major features). I'm excited about Acme's mission to [mission].

Would love to chat for 15 minutes if you're open. Happy to send my resume.

Thanks for considering,
[Your Name]

[Edit] [Looks Good, Send!]
```

**Personalization**:
- Uses resume data (years of experience, companies)
- References job description (mission, values)
- Short (5 sentences max)

---

### 3.3 Confirm & Send

**Confirmation**:
```
Ready to send?

✓ Email will be sent from our warmed domain (looks like: you@rf-send-01.com)
✓ Replies come to your email (we forward)
✓ You can track opens & clicks in Tracker

[Send Email] [Cancel]
```

**Success**:
```
✅ Email sent to Sarah Smith!

We'll notify you when she replies.

Track status: [Go to Tracker]

Want to apply to more jobs? [Browse Jobs]
```

---

## 4. Onboarding Checklist (In-App)

**Show**: Sidebar widget (first 7 days)

```
Get Started with RoleFerry

☑ Complete profile (Step 3 done)
☑ Apply to first job
☐ Apply to 5 jobs (1/5)
☐ Customize a draft
☐ Import past applications (CSV)

Progress: 40%
```

**Goal**: Guide user to activation (5+ applications)

---

## 5. Onboarding Emails

### Day 0: Welcome Email (Immediately after signup)

**Subject**: Welcome to RoleFerry 🎉

```
Hi [Name],

Welcome to RoleFerry! You're about to see how direct email outreach gets 3x more interviews than blind applications.

Here's what to do next:
1. Complete your profile (2 min)
2. Apply to 3-5 jobs
3. Check your Tracker for replies

Let's get you hired!

[Get Started]

- RoleFerry Team

P.S. Reply to this email if you have questions. We're here to help!
```

---

### Day 1: Encouragement (If 0 applications)

**Subject**: Ready to apply to your first job?

```
Hi [Name],

You signed up for RoleFerry yesterday—excited to help you find your next role!

Quick question: What's holding you back?
• Not sure which jobs to apply to? (Browse 10K+ matched jobs)
• Nervous about reaching out? (We write the email for you)
• Worried about quality? (Our avg reply rate: 15%)

Let's get started: [Apply to Jobs]

[Your Name]
RoleFerry Team
```

---

### Day 3: First Reply Celebration (If 1+ replies)

**Subject**: 🎉 You got a reply!

```
Hi [Name],

Great news: [Contact Name] at [Company] just replied!

This is exactly why RoleFerry works. Direct email > blind applications.

Next steps:
• Reply within 24 hours (promptness matters)
• Keep applying (build your pipeline)

You're doing awesome!

[View Reply in Tracker]
```

---

## 6. Onboarding Metrics (Dashboard)

| Metric | Target | Current |
|--------|--------|---------|
| **Signup → Profile Complete** | 80% | 📊 TBD |
| **Profile → First Apply** | 60% | 📊 TBD |
| **First Apply → 5 Applies** | 40% | 📊 TBD |
| **D1 Activation** (1+ apply) | 60% | 📊 TBD |
| **D7 Retention** | 70% | 📊 TBD |

**Analysis**: Track where users drop off (funnel analysis)

---

## 7. A/B Testing Opportunities

### Test 1: Resume Upload Timing

**Variant A**: Upload resume in Step 3 (current)  
**Variant B**: Skip resume in onboarding, prompt later (reduce friction)

**Hypothesis**: B has higher signup completion, but lower first-apply rate

**Metric**: D1 activation (1+ apply)

---

### Test 2: IJP Length

**Variant A**: 5 screens (current)  
**Variant B**: 3 screens (role, location, resume only)

**Hypothesis**: B has higher completion, same match quality

**Metric**: IJP completion rate

---

## 8. Acceptance Criteria

- [ ] Onboarding flow designed (5 steps: signup → mode → IJP → jobs → apply)
- [ ] IJP wizard (<5 min, progress bar)
- [ ] First apply tutorial (explains how RoleFerry works)
- [ ] Onboarding checklist (in-app widget)
- [ ] Welcome emails (Day 0, Day 1, Day 3)
- [ ] Metrics tracked (signup funnel, D1 activation, D7 retention)
- [ ] A/B tests planned (resume timing, IJP length)

---

**Document Owner**: Product Manager, UX Designer  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Monthly (optimize based on metrics)

