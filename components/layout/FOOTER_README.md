# FrogBytes Footer Component

## Overview

A comprehensive, responsive footer component inspired by the midday.ai design, fully integrated with the FrogBytes design system. The footer provides essential navigation, branding, social links, newsletter signup, and features the signature "peeking" FrogBytes text effect.

## Features

### Layout & Structure

- **Six-column responsive grid** that adapts to desktop (6 cols), tablet (4 cols), and mobile (2 cols)
- **Organized link sections**: Product, Company, Resources, and Legal
- **Prominent branding area** with logo, description, and social links
- **Newsletter subscription form** for user engagement
- **Bottom bar** with copyright and utility links

### Visual Design

- **Peeking brand text**: Large "FrogBytes" text emerging from the bottom edge (midday.ai inspired)
- **Subtle background patterns**: Consistent with site's aesthetic using radial gradients
- **Seamless dark/light mode support**: Uses FrogBytes HSL color system
- **Smooth animations**: Fade-in effect for peeking text on mount

### Accessibility

- Semantic HTML5 structure (`<footer>`, proper headings)
- ARIA labels for icon-only social links
- Keyboard navigation support
- Proper focus states on all interactive elements
- Screen reader friendly link descriptions

### SEO & Performance

- Efficient CSS-only animations (no JavaScript required for visuals)
- Minimal bundle impact with tree-shaking friendly imports
- Optimized SVG icons for social media
- Semantic markup for better crawling

## Usage

### Basic Implementation

```tsx
import Footer from '@/components/layout/Footer'

export default function Page() {
  return (
    <main>
      {/* Your page content */}
      <Footer />
    </main>
  )
}
```

### With Root Layout

```tsx
// app/layout.tsx
import Footer from '@/components/layout/Footer'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Footer />
      </body>
    </html>
  )
}
```

## Component Structure

### Main Sections

1. **Logo & Description** (Left column, spans 2 cols on mobile)
   - FrogBytes logo with hover effect
   - Brief product description
   - Social media icons

2. **Product Links**
   - Features
   - Upload
   - Library
   - Dashboard

3. **Company Links**
   - About
   - Feedback
   - Careers
   - Contact

4. **Resources Links**
   - Documentation
   - API
   - Support
   - Status

5. **Legal Links**
   - Privacy
   - Terms
   - Security
   - Cookies

6. **Newsletter Section**
   - Email input field
   - Subscribe button
   - Descriptive text

7. **Bottom Bar**
   - Copyright notice (dynamic year)
   - Utility links (Sitemap, Accessibility, Changelog)

8. **Peeking Brand Text**
   - Absolutely positioned
   - Ultra-light opacity
   - Smooth slide-up animation

## Styling

### Color System

Uses FrogBytes HSL custom properties:

- `--background`: Main background
- `--foreground`: Text color
- `--muted-foreground`: Secondary text
- `--border`: Dividers and borders
- `--primary`: Accent colors

### Typography

- **Font family**: Geist Sans (via `--font-geist-sans`)
- **Heading sizes**: `text-sm` to `text-lg`
- **Body text**: `text-sm` with `text-muted-foreground`
- **Brand text**: `text-[180px]` to `text-[300px]` (responsive)

### Spacing

- Container padding: `px-4`
- Section padding: `pt-16 pb-8`
- Grid gaps: `gap-8 lg:gap-12`
- Consistent with site's spacing scale

## Customization

### Updating Links

Edit the `footerLinks` object in the component:

```tsx
const footerLinks = {
  product: [{ label: 'Your Link', href: '/path' }]
  // ... other sections
}
```

### Updating Social Links

Modify the `socialLinks` array:

```tsx
const socialLinks = [
  {
    name: 'Platform Name',
    href: 'https://...',
    icon: <svg>...</svg>
  }
]
```

### Styling the Peeking Text

Adjust the classes on the peeking text div:

```tsx
<div className="text-[180px] md:text-[240px] lg:text-[300px] ...">
  FrogBytes
</div>
```

## Responsive Behavior

| Breakpoint          | Grid Columns | Notable Changes                 |
| ------------------- | ------------ | ------------------------------- |
| Mobile (<640px)     | 2 columns    | Logo spans 2 cols, stacked form |
| Tablet (640-1024px) | 4 columns    | Balanced layout                 |
| Desktop (>1024px)   | 6 columns    | Full layout, larger text        |

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Graceful degradation for older browsers
- CSS Grid with fallbacks
- No IE11 support required (Next.js 15)

## Performance Considerations

- **CSS-only animations**: No JavaScript overhead
- **Inline SVG icons**: Reduced HTTP requests
- **Client component**: Only for animation state management
- **Optimized re-renders**: Uses `useEffect` with empty deps

## Integration Notes

### With Main Page

Already integrated in `app/page.tsx` after the CTA section.

### With Other Pages

Add the footer to any page by importing and including at the end of the main content:

```tsx
import Footer from '@/components/layout/Footer'

export default function YourPage() {
  return (
    <>
      <Menubar />
      <main>{/* content */}</main>
      <Footer />
    </>
  )
}
```

## File Location

```
components/
└── layout/
    └── Footer.tsx
```

## Dependencies

- `next/link`: Client-side navigation
- `react`: `useEffect`, `useState` hooks
- Tailwind CSS: Styling utilities
- FrogBytes design tokens: HSL color system

## TypeScript

Fully typed with TypeScript, no `any` types used. All props and state are properly typed for type safety.

## Testing Checklist

- [ ] Renders on all breakpoints (mobile, tablet, desktop)
- [ ] All links navigate correctly
- [ ] Social icons open in new tabs
- [ ] Newsletter form prevents default submission
- [ ] Peeking text animates on page load
- [ ] Dark mode displays correctly
- [ ] Keyboard navigation works
- [ ] Screen reader announces links properly

## Future Enhancements

1. **Working newsletter integration**: Connect to email service (Mailchimp, SendGrid)
2. **Dynamic link generation**: Fetch links from CMS or config file
3. **Analytics tracking**: Add event tracking for link clicks
4. **A/B testing**: Test different CTA placements
5. **Localization**: Support multiple languages

## License

Part of the FrogBytes project. See project LICENSE for details.

---

**Created**: 2025
**Last Updated**: 2025
**Component Version**: 1.0.0
