# Accessibility Guide (WCAG 2.1 AA)
## RoleFerry Platform

**Standard**: WCAG 2.1 Level AA  
**Audience**: Frontend Engineers, Designers  
**Purpose**: Ensure product is accessible to all users

---

## 1. Accessibility Principles (POUR)

### Perceivable
Users must be able to perceive information and UI components.

### Operable
UI components and navigation must be operable.

### Understandable
Information and UI operation must be understandable.

### Robust
Content must be robust enough for assistive technologies.

---

## 2. Color Contrast Requirements

### 2.1 Text Contrast (4.5:1 minimum)
```css
/* ✅ PASS: Gray-700 on White */
color: #374151;  /* Contrast ratio: 10.2:1 */
background: #FFFFFF;

/* ❌ FAIL: Gray-400 on White */
color: #9CA3AF;  /* Contrast ratio: 2.8:1 */
background: #FFFFFF;
```

**Tool**: WebAIM Contrast Checker (webaim.org/resources/contrastchecker/)

---

### 2.2 Large Text (3:1 minimum)
**Definition**: 18px+ OR 14px+ bold

```css
/* ✅ PASS: Gray-500 on White (large text only) */
font-size: 18px;
color: #6B7280;  /* Contrast: 4.1:1 */
background: #FFFFFF;
```

---

### 2.3 UI Components (3:1 minimum)
**Applies to**: Buttons, form inputs, icons

```css
/* ✅ PASS: Button border */
border: 1px solid #D1D5DB;  /* Contrast: 3.2:1 */

/* ❌ FAIL: Button border too light */
border: 1px solid #F3F4F6;  /* Contrast: 1.2:1 */
```

---

## 3. Keyboard Navigation

### 3.1 Focus Indicators
```css
/* All interactive elements must have visible focus */
button:focus-visible,
input:focus-visible,
a:focus-visible {
  outline: 3px solid #2563EB;  /* Blue, 3px thick */
  outline-offset: 2px;
}

/* Never remove outlines globally */
/* ❌ DON'T DO THIS: */
/* *:focus { outline: none; } */
```

---

### 3.2 Tab Order
**Logical tab order** (top → bottom, left → right):

```html
<!-- ✅ GOOD: Logical order -->
<form>
  <input type="email" />       <!-- Tab 1 -->
  <input type="password" />    <!-- Tab 2 -->
  <button type="submit">Login</button>  <!-- Tab 3 -->
</form>

<!-- ❌ BAD: Using tabindex to override (avoid unless necessary) -->
<button tabindex="3">Third</button>
<button tabindex="1">First</button>
```

---

### 3.3 Skip Links
```html
<!-- Allow keyboard users to skip navigation -->
<a href="#main-content" class="skip-link">
  Skip to main content
</a>

<nav>...</nav>

<main id="main-content">
  <!-- Page content -->
</main>

<style>
.skip-link {
  position: absolute;
  left: -9999px;  /* Hidden by default */
}

.skip-link:focus {
  left: 0;
  top: 0;
  z-index: 9999;
  background: white;
  padding: 10px;
}
</style>
```

---

## 4. ARIA Labels & Roles

### 4.1 Semantic HTML First
```html
<!-- ✅ GOOD: Semantic HTML (implicit roles) -->
<button>Apply</button>  <!-- role="button" implied -->
<nav>...</nav>          <!-- role="navigation" implied -->
<main>...</main>        <!-- role="main" implied -->

<!-- ❌ BAD: Div soup requiring explicit ARIA -->
<div role="button" onclick="...">Apply</div>
```

---

### 4.2 ARIA Labels for Icon Buttons
```tsx
{/* ✅ GOOD: Icon button with label */}
<button aria-label="Delete application">
  <TrashIcon className="w-5 h-5" />
</button>

{/* ❌ BAD: No label */}
<button>
  <TrashIcon />
</button>
```

---

### 4.3 ARIA Live Regions
```tsx
{/* Announce status updates to screen readers */}
<div role="status" aria-live="polite" aria-atomic="true">
  {message}  {/* "Application created successfully!" */}
</div>

{/* For urgent updates */}
<div role="alert" aria-live="assertive">
  {errorMessage}  {/* "Email sending failed" */}
</div>
```

---

## 5. Form Accessibility

### 5.1 Explicit Labels
```html
<!-- ✅ GOOD: Explicit label with for="" -->
<label htmlFor="email">Email Address</label>
<input id="email" type="email" />

<!-- ❌ BAD: Implicit label (some screen readers miss this) -->
<label>
  Email
  <input type="email" />
</label>
```

---

### 5.2 Error Messages
```tsx
<input 
  id="email"
  type="email"
  aria-invalid={error ? "true" : "false"}
  aria-describedby={error ? "email-error" : undefined}
/>
{error && (
  <span id="email-error" role="alert" className="text-red-500">
    {error}  {/* "Please enter a valid email" */}
  </span>
)}
```

---

## 6. Screen Reader Testing

### 6.1 Tools
- **NVDA** (Windows, free)
- **JAWS** (Windows, paid)
- **VoiceOver** (Mac, built-in)
- **ORCA** (Linux, free)

### 6.2 Test Scenarios
1. Navigate Jobs List (can hear job titles, match scores?)
2. Apply to job (modal announces correctly?)
3. Fill out form (labels associated with inputs?)
4. Receive error (error announced to screen reader?)
5. Navigate Tracker (Kanban columns make sense?)

---

## 7. Accessibility Checklist

### Pre-Launch Audit
- [ ] All images have alt text (or alt="" if decorative)
- [ ] Color contrast ≥4.5:1 (normal text), ≥3:1 (large text, UI elements)
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible (3px outline)
- [ ] Form labels explicit (<label for="">)
- [ ] Error messages announced (aria-live)
- [ ] Headings logical (H1 → H2 → H3, no skips)
- [ ] ARIA roles used correctly (validated with axe DevTools)
- [ ] Tested with screen reader (NVDA or VoiceOver)
- [ ] No content flashes >3 times/second

---

## 8. Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| **Low contrast text** | Darken color (gray-400 → gray-700) |
| **Icon-only buttons** | Add aria-label |
| **Div buttons** | Use <button> element instead |
| **Missing form labels** | Add explicit <label for=""> |
| **Modal not announced** | Add role="dialog" + aria-labelledby |
| **Infinite scroll** | Add "Load More" button alternative |

---

## 9. Automated Testing

```typescript
// tests/a11y/accessibility.test.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('JobCard has no accessibility violations', async () => {
  const { container } = render(<JobCard job={mockJob} matchScore={85} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## 10. Acceptance Criteria

- [ ] WCAG 2.1 AA compliant (automated scan passes)
- [ ] Manual screen reader testing completed (5 core flows)
- [ ] Color contrast verified (all text, UI elements)
- [ ] Keyboard navigation works (no mouse required)
- [ ] Forms accessible (labels, error messages)
- [ ] Third-party audit (optional, Phase 2)

---

**Document Owner**: Accessibility Lead, Frontend Lead  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Quarterly (re-test after major UI changes)

