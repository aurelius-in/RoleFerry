# Design System
## RoleFerry Platform

**Version**: 1.0  
**Tool**: Figma, shadcn/ui, Tailwind CSS  
**Audience**: Designers, Frontend Engineers

---

## 1. Design Tokens

### Colors
```css
/* Primary (Blue) */
--primary-50: #EFF6FF;
--primary-100: #DBEAFE;
--primary-500: #3B82F6;
--primary-600: #2563EB;  /* Primary CTA */
--primary-700: #1D4ED8;

/* Semantic */
--success-500: #10B981;  /* Green - Verified, Delivered */
--warning-500: #F59E0B;  /* Amber - Fair match, Risky */
--error-500: #EF4444;    /* Red - Invalid, Bounced */

/* Neutrals */
--gray-50: #F9FAFB;
--gray-100: #F3F4F6;
--gray-500: #6B7280;
--gray-700: #374151;
--gray-900: #111827;
```

### Typography
```css
font-family: 'Inter', -apple-system, system-ui, sans-serif;
font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';  /* Inter features */

/* Scale */
--text-xs: 12px;    /* Captions */
--text-sm: 14px;    /* Small text */
--text-base: 16px;  /* Body */
--text-lg: 18px;    /* H3 */
--text-xl: 20px;
--text-2xl: 24px;   /* H2 */
--text-3xl: 30px;
--text-4xl: 36px;   /* H1 */
```

### Spacing
```css
/* 4px base unit */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
--space-12: 48px;
```

### Border Radius
```css
--radius-sm: 4px;   /* Badges */
--radius-md: 6px;   /* Buttons, inputs */
--radius-lg: 8px;   /* Cards */
--radius-xl: 12px;  /* Modals */
--radius-full: 9999px;  /* Pills */
```

---

## 2. Components

### Button
**Variants**: Primary, Secondary, Ghost, Danger

```tsx
<Button variant="primary" size="md">
  Apply Now
</Button>
```

**Specifications**:
- Height: 40px (md), 32px (sm), 48px (lg)
- Padding: 12px 20px
- Font: 16px, weight 600
- Border radius: 6px
- Hover: Darken 10%
- Active: Scale 0.98

---

### Card
**Usage**: Job cards, application cards, stats

```tsx
<Card>
  <CardHeader>
    <CardTitle>Senior Product Manager</CardTitle>
  </CardHeader>
  <CardContent>
    Acme Corp · San Francisco · Remote
  </CardContent>
</Card>
```

**Specifications**:
- Padding: 24px
- Border: 1px solid gray-200
- Border radius: 8px
- Hover: Shadow (0 4px 6px rgba(0,0,0,0.1))

---

### Badge
**Usage**: Match scores, status indicators

```tsx
<Badge variant="success">85 Strong Match</Badge>
```

**Variants**:
- Success (green), Warning (amber), Error (red), Info (blue), Default (gray)

**Specifications**:
- Padding: 4px 12px
- Font: 14px, weight 600
- Border radius: 16px (pill)

---

### Input
```tsx
<Input 
  label="Email" 
  type="email"
  placeholder="you@example.com"
  error="Invalid email format"
/>
```

**States**: Default, Focus, Error, Disabled

---

### Modal
```tsx
<Modal>
  <ModalHeader>
    <ModalTitle>Connect via Email</ModalTitle>
  </ModalHeader>
  <ModalBody>
    {/* Content */}
  </ModalBody>
  <ModalFooter>
    <Button variant="secondary">Cancel</Button>
    <Button variant="primary">Send</Button>
  </ModalFooter>
</Modal>
```

**Specifications**:
- Max width: 600px (sm), 800px (lg)
- Padding: 32px
- Backdrop: rgba(0,0,0,0.5) with blur

---

## 3. Layout

### Grid System
- Desktop: 12-column grid, 24px gutter
- Tablet: 8-column grid, 16px gutter
- Mobile: 4-column grid, 16px gutter

### Breakpoints
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

---

## 4. Icons

**Library**: Lucide React (consistent, lightweight)

**Usage**:
```tsx
import { Mail, User, Calendar } from 'lucide-react';

<Mail className="w-5 h-5" />
```

**Sizes**: 16px (sm), 20px (md), 24px (lg)

---

## 5. Accessibility

### Focus Indicators
```css
:focus-visible {
  outline: 3px solid var(--primary-600);
  outline-offset: 2px;
}
```

### Color Contrast
- Text on white: 4.5:1 minimum (WCAG AA)
- Large text (18px+): 3:1 minimum

### ARIA Labels
```tsx
<button aria-label="Apply to Senior PM at Acme Corp">
  Apply
</button>
```

---

## 6. Animation

### Durations
```css
--duration-fast: 150ms;    /* Hover, button press */
--duration-normal: 300ms;  /* Modal, drawer */
--duration-slow: 500ms;    /* Page transition */
```

### Easing
```css
--ease-out: cubic-bezier(0.22, 0.61, 0.36, 1);
```

---

**Document Owner**: Design Lead  
**Version**: 1.0  
**Date**: October 2025

