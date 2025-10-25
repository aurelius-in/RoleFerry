# UI Specifications
## RoleFerry Platform

**Document Type**: Design Specifications  
**Audience**: Frontend Engineers, Designers, Product  
**Purpose**: Detailed UI component specs and interaction patterns

---

## 1. Design System Overview

### 1.1 Design Principles
1. **Clarity**: Information hierarchy obvious at a glance
2. **Efficiency**: Minimize clicks to complete tasks (Apply in 1 click, not 5)
3. **Feedback**: Immediate visual confirmation of actions
4. **Accessibility**: WCAG 2.1 AA compliance (contrast ratios, keyboard nav)
5. **Consistency**: Reusable patterns across Job Seeker / Recruiter modes

### 1.2 Inspiration References
- **Simplify**: Clean kanban boards, card-based job lists
- **Linear**: Fast keyboard shortcuts, command palette, sleek table views
- **Apollo.io**: Dense data tables, inline editing, bulk actions
- **Instantly**: Health score visualizations, traffic light colors
- **Jobright**: Job card layouts, match scoring, filter systems
- **Welcome to the Jungle**: Preference wizards, user onboarding flows

---

## 2. 10-Tab Workflow UI Specifications

### 2.1 Navigation Structure
**Primary Workflow Tabs** (10 tabs):
- Job Preferences / Ideal Client Profile (ICP)
- Resume / Candidate Profile  
- Job Descriptions
- Pinpoint Match
- Find Contact
- Context (Research)
- Offer Creation
- Compose
- Campaign
- Deliverability / Launch

**Utility Tabs** (4 tabs):
- Dashboard
- Analytics / Insights
- Settings / Account
- Help / Support

### 2.2 Mode Toggle Component
**Location**: Top-right of navigation
**Functionality**: 
- Toggle between "Job Seeker" and "Recruiter" modes
- Dynamic label updates across all tabs
- Persistent state (localStorage)
- Visual feedback with active/inactive states

### 2.3 Tab-Specific UI Patterns

#### Job Preferences/ICP Tab
- **Form Layout**: Multi-column grid for efficient data entry
- **Dynamic Labels**: "Job Preferences" (Job Seeker) vs "Ideal Client Profile (ICP)" (Recruiter)
- **Field Types**: Multi-select dropdowns, text inputs, range sliders
- **Validation**: Real-time feedback on required fields

#### Resume/Candidate Profile Tab
- **File Upload**: Drag-and-drop zone with progress indicator
- **AI Parsing**: Loading states with estimated time remaining
- **Data Display**: Structured cards showing extracted information
- **Edit Capability**: Inline editing of parsed data

#### Pinpoint Match Tab
- **Score Display**: Large circular progress indicator (0-100%)
- **Match Breakdown**: Expandable cards showing challenge → solution → metric
- **Color Coding**: Green (90%+), Blue (75-89%), Yellow (50-74%), Red (<50%)
- **Recalculation**: Prominent button for score updates

#### Find Contact Tab
- **Search Interface**: Auto-complete with company/title suggestions
- **Contact Cards**: Name, title, email with verification badges
- **Verification Badges**: Color-coded (Green=Valid, Yellow=Risky, Red=Invalid)
- **Confidence Scores**: Percentage display with visual indicators

#### Compose Tab
- **Variable Panel**: Sidebar showing available variables with live preview
- **Tone Selector**: Radio buttons for Recruiter/Manager/Exec
- **Jargon Detection**: Highlighted terms with tooltip explanations
- **Live Preview**: Real-time email rendering with variable substitution

#### Campaign Tab
- **Email Steps**: Expandable cards for each email in sequence
- **Timing Controls**: Day/hour selectors for delays
- **Deliverability Panel**: Health checks with pass/warning/fail indicators
- **Launch Controls**: Prominent launch button with pre-flight status

### 2.4 Responsive Design
- **Mobile**: Stacked layout with collapsible sections
- **Tablet**: Two-column layout with sidebar navigation
- **Desktop**: Full 10-tab horizontal navigation with persistent sidebar

---

## 3. Typography

### 2.1 Font Families
- **Primary**: Inter (headings, body text)
- **Monospace**: JetBrains Mono (code, API keys, email addresses)

### 2.2 Scale
| Element | Size | Weight | Line Height | Usage |
|---------|------|--------|-------------|-------|
| **H1** | 32px | 700 | 40px | Page titles ("Jobs", "Tracker") |
| **H2** | 24px | 600 | 32px | Section headings ("Your Applications") |
| **H3** | 18px | 600 | 28px | Card titles (Job title, Company name) |
| **Body** | 16px | 400 | 24px | Paragraphs, descriptions |
| **Small** | 14px | 400 | 20px | Meta info (dates, counts) |
| **Caption** | 12px | 400 | 16px | Hints, helper text |

---

## 3. Color Palette

### 3.1 Brand Colors
```css
--primary: #2563EB; /* Blue 600 - CTAs, links */
--primary-hover: #1D4ED8; /* Blue 700 */
--primary-light: #DBEAFE; /* Blue 100 - backgrounds */
```

### 3.2 Semantic Colors
```css
/* Success (green) */
--success: #10B981; /* Green 500 - Verified, Delivered */
--success-bg: #D1FAE5; /* Green 100 */

/* Warning (yellow) */
--warning: #F59E0B; /* Amber 500 - Fair match, Risky email */
--warning-bg: #FEF3C7; /* Amber 100 */

/* Error (red) */
--error: #EF4444; /* Red 500 - Invalid, Bounced */
--error-bg: #FEE2E2; /* Red 100 */

/* Info (blue) */
--info: #3B82F6; /* Blue 500 - Notifications */
--info-bg: #DBEAFE; /* Blue 100 */
```

### 3.3 Neutrals
```css
--gray-50: #F9FAFB;
--gray-100: #F3F4F6;
--gray-200: #E5E7EB;
--gray-300: #D1D5DB;
--gray-500: #6B7280; /* Text secondary */
--gray-700: #374151; /* Text primary */
--gray-900: #111827; /* Headings */
```

### 3.4 Match Score Colors
```css
--match-low: #EF4444; /* Red - 0-49 */
--match-fair: #F59E0B; /* Amber - 50-74 */
--match-strong: #10B981; /* Green - 75-89 */
--match-excellent: #8B5CF6; /* Purple - 90+ */
```

---

## 4. Spacing System

**Base unit**: 4px (Tailwind-style 4-pt grid)

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

**Usage**:
- Card padding: `space-6` (24px)
- Button padding: `space-3` horizontal, `space-2` vertical
- Section gaps: `space-8` (32px)

---

## 5. Component Specifications

### 5.1 Job Card

**Layout**:
```
┌─────────────────────────────────────────────┐
│ [Logo]  Senior Product Manager              │
│         Acme Corp · San Francisco · Remote  │
│         $150K-$200K · Posted 2 days ago     │
│                                             │
│         [85] Strong Match ▼                 │
│         Experience: 90% Skills: 80%         │
│                                             │
│         [Apply] [Save] [Ask Copilot]       │
└─────────────────────────────────────────────┘
```

**Specs**:
- **Width**: 100% (responsive grid: 1 col mobile, 2 col tablet, 3 col desktop)
- **Height**: Auto (min 180px)
- **Padding**: 24px
- **Border**: 1px solid gray-200
- **Border-radius**: 8px
- **Hover**: Shadow elevation (0 → 4px blur), border → primary

**Match Score Badge**:
- **Shape**: Rounded pill (40px height)
- **Position**: Top-right or below title
- **Colors**: See 3.4 (red/amber/green/purple)
- **Format**: "[Score] Label" (e.g., "85 Strong Match")

**Buttons**:
- **Apply**: Primary button (blue, full-width on mobile)
- **Save**: Secondary button (outline, gray)
- **Ask Copilot**: Ghost button (no border, gray text)

---

### 5.2 Application Card (Tracker Board)

**Layout**:
```
┌─────────────────────────────┐
│ [Logo] Acme Corp            │
│ Senior PM                   │
│                             │
│ Last contact: 2 days ago    │
│ [Step 1 sent]  [1 reply]   │
│                             │
│ ... (notes icon)            │
└─────────────────────────────┘
```

**Specs**:
- **Width**: 280px (fixed for kanban columns)
- **Height**: Auto (min 140px)
- **Draggable**: Yes (drag handle = entire card)
- **Badges**: Sequence status ("Step 1 sent"), reply state ("1 reply")

**Status Colors**:
- **Saved**: Gray
- **Applied**: Blue
- **Interviewing**: Green
- **Offer**: Purple
- **Rejected**: Red

---

### 5.3 Kanban Board (Tracker)

**Layout**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Board] [Table]                          [Import CSV] [Export CSV]      │
├────────────┬────────────┬──────────────┬───────────┬───────────────────┤
│  Saved (5) │ Applied(12)│ Interviewing │  Offer(1) │  Rejected (3)     │
│            │            │      (3)     │           │                   │
│  [Card 1]  │  [Card A]  │  [Card X]    │  [Card Z] │  [Card R1]        │
│  [Card 2]  │  [Card B]  │  [Card Y]    │           │  [Card R2]        │
│  ...       │  ...       │              │           │  ...              │
│            │            │              │           │                   │
│  + Add     │  + Add     │  + Add       │  + Add    │  + Add            │
└────────────┴────────────┴──────────────┴───────────┴───────────────────┘
```

**Specs**:
- **Column width**: 300px (fixed)
- **Horizontal scroll**: On mobile/tablet (columns don't wrap)
- **Column header**: Title + count badge
- **Drag & drop**: Smooth animation (200ms ease-out)
- **Empty state**: "No applications" placeholder + "Add" button

---

### 5.4 Table View (Tracker)

**Columns**:
| Column | Width | Sortable | Filterable |
|--------|-------|----------|------------|
| Company (logo + name) | 200px | Yes | Text search |
| Title | 250px | Yes | Text search |
| Status | 120px | Yes | Dropdown |
| Date Applied | 120px | Yes | Date range |
| Last Contact | 120px | Yes | Date range |
| Reply Status | 100px | Yes | Dropdown |
| Match Score | 100px | Yes | Range slider |

**Specs**:
- **Row height**: 56px
- **Hover**: Background → gray-50
- **Selection**: Checkbox (multi-select for bulk actions)
- **Actions**: Row click → Opens detail modal
- **Pagination**: 50 rows/page, "Load more" button

---

### 5.5 Buttons

#### Primary Button
```css
background: var(--primary);
color: white;
padding: 10px 20px;
border-radius: 6px;
font-weight: 600;
```
**States**:
- Hover: background → primary-hover
- Active: Scale 0.98
- Disabled: opacity 0.5, cursor not-allowed

#### Secondary Button (Outline)
```css
background: transparent;
border: 1px solid var(--gray-300);
color: var(--gray-700);
```

#### Ghost Button
```css
background: transparent;
border: none;
color: var(--gray-600);
```

**Sizes**:
- **Small**: 32px height, 14px text
- **Medium**: 40px height, 16px text (default)
- **Large**: 48px height, 18px text

---

### 5.6 Form Inputs

#### Text Input
```css
border: 1px solid var(--gray-300);
border-radius: 6px;
padding: 10px 12px;
font-size: 16px;
```
**States**:
- Focus: border → primary, box-shadow (0 0 0 3px primary-light)
- Error: border → error, helper text in red
- Disabled: background → gray-100

#### Dropdown (Select)
- **Style**: Native `<select>` with custom arrow icon
- **Multi-select**: Checkboxes with search (shadcn Combobox)

#### Checkbox / Radio
- **Custom styled**: Tailwind @apply (checkmark icon on check)
- **Label**: Click entire label to toggle

---

### 5.7 Modals

**Layout**:
```
┌────────────────────────────────────────┐
│  [X] Close                             │
│  Modal Title                           │
│  ────────────────────────────────────  │
│  Content area                          │
│  (form, text, etc.)                    │
│                                        │
│                                        │
│  ────────────────────────────────────  │
│  [Cancel]              [Confirm CTA]   │
└────────────────────────────────────────┘
```

**Specs**:
- **Max width**: 600px (small modal), 800px (large)
- **Padding**: 32px
- **Backdrop**: rgba(0,0,0,0.5), blur 4px
- **Animation**: Fade + scale in (200ms)
- **Close**: X button, ESC key, click backdrop

**Types**:
- **Confirmation**: "Delete account?" → Cancel + Delete buttons
- **Form**: "Add Contact" → Input fields + Save button
- **Info**: "Match Score Breakdown" → Read-only, close only

---

### 5.8 Copilot Panel (Right Rail)

**Layout**:
```
┌────────────────────────┐
│  🤖 Copilot            │
│  ────────────────────  │
│  Quick actions:        │
│  • Why is this a fit? │
│  • Write an email     │
│  • Show insiders      │
│  ────────────────────  │
│  Ask anything...       │
│  [Text input]          │
│  [Send]                │
│  ────────────────────  │
│  Response area         │
│  (streaming text)      │
└────────────────────────┘
```

**Specs**:
- **Width**: 320px (desktop), full-width (mobile drawer)
- **Position**: Fixed right rail (scrolls independently)
- **Background**: White with subtle border-left
- **Streaming**: Text appears word-by-word (typewriter effect)

---

### 5.9 Badges & Pills

**Match Score Pill**:
```css
display: inline-flex;
align-items: center;
padding: 4px 12px;
border-radius: 16px;
font-size: 14px;
font-weight: 600;
```
**Colors**: See 3.4 (match score colors)

**Status Badge**:
```css
padding: 2px 8px;
border-radius: 4px;
font-size: 12px;
text-transform: uppercase;
```
**Examples**:
- "Verified" → Green background, dark green text
- "Queued" → Gray background
- "Sent" → Blue background

---

### 5.10 Empty States

**Layout**:
```
┌─────────────────────────────┐
│                             │
│     [Icon/Illustration]     │
│                             │
│     No jobs found           │
│     Try adjusting filters   │
│                             │
│     [Primary CTA]           │
│                             │
└─────────────────────────────┘
```

**Specs**:
- **Center-aligned** (both horizontal and vertical)
- **Icon**: 64px, gray-300 color
- **Text**: Friendly, actionable (not "Error" or "Nothing here")
- **CTA**: Optional (e.g., "Refine Preferences", "Import CSV")

---

## 6. Interaction Patterns

### 6.1 Loading States

**Skeleton Loaders**:
- Use for job cards, application cards (shimmer effect)
- **Never** show blank screens or spinners alone

**Spinner**:
- Only for button actions (e.g., "Applying..." with spinner in button)

**Progress Bars**:
- For file uploads, CSV imports (show % completion)

---

### 6.2 Toasts (Notifications)

**Position**: Top-right (desktop), bottom (mobile)  
**Auto-dismiss**: 4 seconds (success), 6 seconds (error), no auto-dismiss (critical)

**Types**:
```
[✓] Success:  "Application created!"
[i] Info:     "Enrichment started..."
[⚠] Warning:  "Some emails unverified"
[✗] Error:    "Failed to send email"
```

**Dismissible**: X button always visible

---

### 6.3 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + /` | Toggle Copilot |
| `Cmd/Ctrl + B` | Switch to Board view |
| `Cmd/Ctrl + T` | Switch to Table view |
| `ESC` | Close modal / Clear search |
| `→` / `←` | Navigate cards (in detail view) |

---

## 7. Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 640px) { ... }

/* Tablet */
@media (min-width: 641px) and (max-width: 1024px) { ... }

/* Desktop */
@media (min-width: 1025px) { ... }
```

**Layout changes**:
- **Mobile**: Single column, bottom nav, drawer-based Copilot
- **Tablet**: 2-column job grid, collapsible sidebar
- **Desktop**: 3-column job grid, persistent right rail Copilot

---

## 8. Accessibility

### 8.1 WCAG 2.1 AA Compliance

**Color Contrast**:
- Text on white: Minimum 4.5:1 ratio (body text)
- Large text (18px+): Minimum 3:1
- UI controls: 3:1 (buttons, inputs)

**Keyboard Navigation**:
- All interactive elements focusable (tab order logical)
- Focus indicator visible (blue outline, 3px)
- Skip links for screen readers ("Skip to main content")

**ARIA Labels**:
```html
<button aria-label="Apply to Senior PM at Acme Corp">Apply</button>
<div role="alert" aria-live="polite">Application created!</div>
```

### 8.2 Screen Reader Support
- Image alt text (company logos, user avatars)
- Form labels (explicit `<label for="...">`)
- Status announcements (toast notifications use `aria-live`)

---

## 9. Animation & Motion

**Durations**:
- **Fast**: 150ms (hover effects, button presses)
- **Medium**: 300ms (modal open/close, page transitions)
- **Slow**: 500ms (skeleton → content fade-in)

**Easing**:
```css
--ease-out: cubic-bezier(0.22, 0.61, 0.36, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

**Reduced Motion**:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. Dark Mode (Optional - Phase 2)

**Colors**:
```css
/* Dark mode overrides */
--bg-primary: #1F2937; /* Gray 800 */
--bg-secondary: #111827; /* Gray 900 */
--text-primary: #F9FAFB; /* Gray 50 */
--text-secondary: #D1D5DB; /* Gray 300 */
```

**Toggle**: Settings → Appearance → "System" / "Light" / "Dark"

---

## 11. Acceptance Criteria

- [ ] All components specified with dimensions, colors, states
- [ ] Responsive breakpoints defined
- [ ] Accessibility requirements met (WCAG 2.1 AA)
- [ ] Keyboard shortcuts documented
- [ ] Animation durations and easings defined
- [ ] Design system implemented in Storybook (optional)

---

**Document Owner**: UX/UI Designer, Frontend Lead  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Bi-weekly during design/dev phase

