# FrogBytes Footer - Visual Structure Guide

## Layout Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FOOTER COMPONENT                              │
│                      (Subtle dot pattern background)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┬──────────┬──────────┬──────────┬──────────┬─────────┐ │
│  │   LOGO &    │ Product  │ Company  │Resources │  Legal   │         │ │
│  │ DESCRIPTION │          │          │          │          │         │ │
│  │             │          │          │          │          │         │ │
│  │  🐸 FrogBytes│ Features │  About   │   Docs   │ Privacy  │         │ │
│  │             │  Upload  │ Feedback │   API    │  Terms   │         │ │
│  │  Transform  │ Library  │ Careers  │ Support  │ Security │         │ │
│  │  lectures...│Dashboard │ Contact  │  Status  │ Cookies  │         │ │
│  │             │          │          │          │          │         │ │
│  │  [GitHub]   │          │          │          │          │         │ │
│  │  [Twitter]  │          │          │          │          │         │ │
│  │  [LinkedIn] │          │          │          │          │         │ │
│  │  [Discord]  │          │          │          │          │         │ │
│  └─────────────┴──────────┴──────────┴──────────┴──────────┴─────────┘ │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                          NEWSLETTER SECTION                             │
│  Stay updated                                                           │
│  Get the latest updates on new features and improvements.               │
│  ┌──────────────────────────────────────┐  ┌──────────────┐            │
│  │ Enter your email                     │  │  Subscribe   │            │
│  └──────────────────────────────────────┘  └──────────────┘            │
├─────────────────────────────────────────────────────────────────────────┤
│                           BOTTOM BAR                                    │
│  © 2025 FrogBytes. All rights reserved.                                │
│                              Sitemap | Accessibility | Changelog        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                         ╔═══════════════╗                               │
│                         ║  FrogBytes    ║  ← Peeking brand text        │
│                         ╚═══════════════╝     (ultra-light opacity)    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Responsive Breakdowns

### Desktop (>1024px)

```
┌─────────────────────────────────────────────────────────────────┐
│  Logo (2 cols)  │  Product  │  Company  │  Resources  │  Legal  │
│  + Description  │           │           │             │         │
│  + Social       │ 4 links   │ 4 links   │   4 links   │ 4 links │
└─────────────────────────────────────────────────────────────────┘
     Newsletter (full width)
     Bottom bar (full width)
     Peeking text (300px font, 3% opacity)
```

### Tablet (640-1024px)

```
┌─────────────────────────────────────────────────────────┐
│  Logo + Desc (2 cols)  │  Product  │  Company           │
├────────────────────────┼───────────┼─────────────────── │
│        (empty)         │ Resources │  Legal             │
└─────────────────────────────────────────────────────────┘
     Newsletter (adjusted width)
     Bottom bar (stacked)
     Peeking text (240px font)
```

### Mobile (<640px)

```
┌─────────────────────────────┐
│  Logo + Description         │
│  (spans 2 columns)          │
│  Social Icons               │
├─────────────────┬───────────┤
│    Product      │  Company  │
├─────────────────┼───────────┤
│   Resources     │   Legal   │
└─────────────────┴───────────┘
     Newsletter (stacked)
     Bottom bar (centered)
     Peeking text (180px font)
```

## Color Scheme

### Light Mode

```css
Background:        hsl(0, 0%, 100%)      /* Pure white */
Text:              hsl(222, 47%, 11%)    /* Dark blue-gray */
Muted Text:        hsl(215, 16%, 47%)    /* Medium gray */
Borders:           hsl(214, 32%, 91%)    /* Light gray */
Primary:           hsl(222, 47%, 11%)    /* Dark blue-gray */
Hover:             hsl(222, 47%, 11%)    /* Foreground color */
Pattern Opacity:   0.02                   /* Very subtle */
Peeking Text:      0.02 opacity          /* Ultra subtle */
```

### Dark Mode

```css
Background:        hsl(0, 0%, 7%)        /* Near black */
Text:              hsl(0, 0%, 98%)       /* Off white */
Muted Text:        hsl(240, 5%, 64.9%)   /* Light gray */
Borders:           hsl(0, 0%, 17%)       /* Dark gray */
Primary:           hsl(0, 0%, 98%)       /* Off white */
Hover:             hsl(0, 0%, 98%)       /* Foreground color */
Pattern Opacity:   0.03                   /* Slightly more visible */
Peeking Text:      0.03 opacity          /* Slightly more visible */
```

## Typography Scale

```
Brand Logo:     text-lg (18px), font-medium
Section Heads:  text-sm (14px), font-medium
Links:          text-sm (14px), text-muted-foreground
Newsletter H3:  text-sm (14px), font-medium
Newsletter P:   text-sm (14px), text-muted-foreground
Copyright:      text-xs (12px), text-muted-foreground
Peeking Text:   180px/240px/300px (responsive), ultra-light
```

## Spacing System

```
Container:
  - Max width: 1280px (max-w-7xl)
  - Padding: 16px (px-4)

Section Spacing:
  - Top padding: 64px (pt-16)
  - Bottom padding: 32px (pb-8)
  - Grid gaps: 32px/48px (gap-8/lg:gap-12)

Newsletter:
  - Top border: 32px padding (pt-8)
  - Bottom: 32px padding (pb-8)

Bottom Bar:
  - Top border: 32px padding (pt-8)
  - Flex gap: 16px (gap-4)

Internal Spacing:
  - Logo to description: 16px (space-y-4)
  - Section title to links: 12px (space-y-3)
  - Links to each other: 8px (space-y-2)
  - Social icons: 12px gaps (gap-3)
```

## Interactive States

### Links

```
Default:   text-muted-foreground
Hover:     text-foreground + transition-colors
Focus:     ring-2 ring-ring (Tailwind default)
```

### Newsletter Input

```
Default:   border-input
Focus:     ring-2 ring-ring, border-transparent
```

### Newsletter Button

```
Default:   bg-primary text-primary-foreground
Hover:     bg-primary/90
```

### Social Icons

```
Default:   text-muted-foreground, w-5 h-5
Hover:     text-foreground + transition-colors
```

## Animation Details

### Peeking Text Animation

```css
Initial State:    translateY(100%) - Below viewport
Final State:      translateY(0)    - Partially visible
Duration:         1000ms
Easing:          ease-out
Trigger:         Component mount (useEffect)
```

The text is positioned absolutely at `-bottom-8` (32px below footer), creating the "peeking" effect where only the top portion is visible.

## Accessibility Features

### Semantic Structure

```html
<footer>                    ← Main landmark
  <div>                     ← Container
    <Link> with logo        ← Navigation
    <h3>Section Title</h3>  ← Proper heading hierarchy
    <ul>                    ← Unordered list for links
      <li><Link /></li>     ← List items with links
    </ul>
  </div>
  <form>                    ← Newsletter form
    <input aria-label="...">
    <button>Subscribe</button>
  </form>
  <div aria-hidden="true">  ← Decorative peeking text
</footer>
```

### ARIA Labels

```html
Social Links: aria-label="GitHub" (for icon-only) Email Input: aria-label="Email
address" Peeking Text: aria-hidden="true" (decorative only)
```

### Focus Management

- All interactive elements have visible focus rings
- Logical tab order (left to right, top to bottom)
- Skip link compatible (doesn't interfere with navigation)

## Implementation Details

### Component Type

```typescript
'use client'                  // Client component for animation
export default function Footer() {
  const [isVisible, useState] // Animation state
  useEffect(() => {})         // Mount trigger
  return <footer>...</footer>
}
```

### Data Structures

```typescript
footerLinks = {
  product: Link[],
  company: Link[],
  resources: Link[],
  legal: Link[]
}

socialLinks = {
  name: string,
  href: string,
  icon: JSX.Element
}[]
```

### Styling Approach

- Utility-first with Tailwind CSS
- Design system tokens (CSS custom properties)
- Responsive utilities (md:, lg:)
- Hover states with transition classes
- Dark mode with `dark:` variants

## Performance Characteristics

### Bundle Impact

```
Component size:   ~3KB gzipped
SVG icons:        Inline (no HTTP requests)
Animations:       CSS-only (no JS overhead)
Rendering:        Single pass, no layout shifts
```

### Runtime Performance

```
Initial render:   Fast (static content)
Hydration:        Minimal (one state variable)
Re-renders:       None (after mount animation)
Memory:           Negligible footprint
```

## Browser Compatibility Matrix

| Browser     | Support | Notes                  |
| ----------- | ------- | ---------------------- |
| Chrome 90+  | ✅ Full | Recommended            |
| Firefox 88+ | ✅ Full | Recommended            |
| Safari 14+  | ✅ Full | iOS/macOS              |
| Edge 90+    | ✅ Full | Chromium-based         |
| Opera 76+   | ✅ Full | Chromium-based         |
| IE 11       | ❌ None | Next.js 15 unsupported |

## Testing Checklist

### Visual Testing

- [ ] Footer renders at bottom of all pages
- [ ] Peeking text appears with smooth animation
- [ ] All spacing matches design spec
- [ ] Colors correct in light/dark modes
- [ ] Responsive breakpoints work correctly

### Functional Testing

- [ ] All links navigate to correct pages
- [ ] Social links open in new tabs
- [ ] Newsletter form accepts input
- [ ] Form submission handled (preventDefault)
- [ ] External links have rel="noopener noreferrer"

### Accessibility Testing

- [ ] Screen reader announces all content
- [ ] Keyboard navigation works smoothly
- [ ] Focus indicators visible
- [ ] Sufficient color contrast (WCAG AA)
- [ ] No accessibility errors in Lighthouse

### Performance Testing

- [ ] Lighthouse score >90
- [ ] No layout shifts (CLS = 0)
- [ ] Fast initial render
- [ ] No console errors
- [ ] Minimal bundle impact

---

**Visual Reference**: See `reference/inspo1.png` for midday.ai inspiration
**Component Location**: `components/layout/Footer.tsx`
**Documentation**: `components/layout/FOOTER_README.md`
