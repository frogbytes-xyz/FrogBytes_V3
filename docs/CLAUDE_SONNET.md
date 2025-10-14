# Claude Sonnet Prompt - FrogBytes Development

Dit document bevat gestructureerde prompts en context voor effectieve samenwerking met Claude Sonnet bij FrogBytes development.

## 🎯 Project Context

**Project:** FrogBytes V2  
**Type:** Multifunctional Lecture Summarization & Learning Platform  
**Tech Stack:** Next.js 15, React 18, TypeScript, Tailwind CSS, Supabase, AI (ElevenLabs, Gemini)

### Core Functionaliteit
FrogBytes transformeert lecture recordings (audio/video) in gestructureerde study materials:
1. Upload audio/video (max 500MB) → ElevenLabs transcriptie
2. AI-powered summarization → Gemini genereert samenvattingen
3. Interactive learning → Flashcards, quizzes, notes
4. Export → PDF met LaTeX support
5. Cloud backup → Telegram integratie

### Design System
- **Geïnspireerd door:** Midday.ai (clean, minimalist, dark-first)
- **Kleuren:** HSL-based design tokens in `globals.css`
- **Components:** shadcn/ui met custom styling
- **Typografie:** System font stack, medium weights, tight tracking
- **Layout:** Container-based (max-w-6xl), generous whitespace

---

## 📋 Effectieve Prompt Patterns

### 1. Feature Development

```
Je bent een senior Next.js developer die werkt aan FrogBytes, een lecture 
summarization platform. De codebase gebruikt:
- Next.js 15 met App Router
- TypeScript strict mode
- Tailwind CSS met Midday.ai design system
- Supabase voor backend
- shadcn/ui components

TAAK: [Beschrijf specifieke feature]

CONTEXT:
- Bestaande architectuur: [relevante files/patterns]
- Design requirements: [Midday-style, dark theme, minimal]
- Integratie met: [andere components/services]

REQUIREMENTS:
1. Gebruik bestaande design tokens uit globals.css
2. Volg shadcn/ui component patterns
3. TypeScript types voor alle props/functions
4. Responsive design (mobile-first)
5. Accessibility (WCAG AA)

Genereer de volledige implementatie met comments waar nodig.
```

### 2. Debugging & Fixes

```
PROBLEEM: [Beschrijf het issue]

HUIDIGE CODE:
[Relevante code snippet]

ERROR/GEDRAG:
[Error message of onverwacht gedrag]

PROJECT CONTEXT:
- Next.js 15 App Router
- TypeScript strict
- Supabase client-side queries

Analyseer het probleem, identificeer de root cause, en geef een oplossing 
die:
1. Minimale code changes (surgical fixes)
2. Behoudt bestaande functionaliteit
3. Volgt project conventions
4. Includes error handling waar relevant
```

### 3. Code Review & Refactoring

```
REVIEW DE VOLGENDE CODE:

[Code snippet]

FOCUS AREAS:
- TypeScript type safety
- Next.js 15 best practices (Server/Client Components)
- Performance optimizations
- Accessibility
- Design system consistency (Midday.ai style)

Geef specifieke suggesties met:
1. Wat er verbeterd kan worden
2. Waarom (rationale)
3. Code voorbeeld van verbetering
```

### 4. New Component Creation

```
COMPONENT: [Component naam]

DOEL: [Wat het doet]

REQUIREMENTS:
- Gebruik shadcn/ui als base (indien applicable)
- Dark theme compatible
- Responsive (mobile-first)
- TypeScript typed props
- Accessibility compliant

DESIGN SPECS:
- Style: Midday.ai inspired (minimal, clean, dark)
- Colors: Gebruik design tokens uit globals.css
- Spacing: Generous whitespace, logical grouping
- Typography: font-medium, tight tracking

EXAMPLE USE:
```tsx
<ComponentName prop1="value" prop2={value} />
```

Genereer:
1. Complete component code
2. TypeScript interface voor props
3. Usage example
4. Accessibility notes
```

### 5. Database/Supabase Queries

```
DATABASE QUERY NEEDED:

TAAK: [Beschrijf wat je wilt ophalen/muteren]

TABLES:
- [Table naam]: [relevante columns]

CONTEXT:
- Supabase client-side in Next.js 15
- TypeScript types voor responses
- Error handling required

Genereer:
1. Type-safe Supabase query
2. Error handling
3. TypeScript types voor response
4. Usage example in component
```

---

## 🏗️ Project Architectuur

### Directory Structure
```
FrogBytes_V2/
├── app/                    # Next.js 15 App Router
│   ├── page.tsx           # Homepage (dark themed, Midday style)
│   ├── layout.tsx         # Root layout (dark class on html)
│   ├── globals.css        # Design system CSS variables
│   ├── upload/            # Upload flow
│   ├── library/           # Public library
│   ├── dashboard/         # User dashboard
│   └── api/               # API routes
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── Navigation.tsx     # Global nav
│   ├── FileUpload.tsx     # Drag-drop uploader
│   └── PDFViewer.tsx      # PDF preview
├── lib/
│   └── supabase/          # Supabase client setup
└── supabase/
    └── migrations/        # DB schema
```

### Key Files Context

**`app/globals.css`**
- Design tokens (HSL-based)
- Dark theme as default
- Midday.ai inspired colors
- Custom utilities

**`app/page.tsx`**
- Homepage component
- Dark themed, minimal design
- Hero → Features → Process → CTA → Footer
- Uses existing UI components

**`components/ui/`**
- shadcn/ui base components
- Customized for dark theme
- Consistent styling across app

---

## 🎨 Design Guidelines

### Midday.ai Style Characteristics

**Colors:**
- Background: `hsl(0, 0%, 7%)` (near black)
- Foreground: `hsl(0, 0%, 98%)` (near white)
- Muted: `hsl(240, 5%, 65%)` (subtle gray)
- Accent: `hsl(0, 0%, 11%)` (slightly lighter than bg)
- Borders: `hsl(0, 0%, 17%)` (subtle borders)

**Typography:**
- Font weights: 400 (regular), 500 (medium), 700 (bold)
- Tracking: Tight (-0.01em to -0.02em)
- Line height: 1.1 voor headings, 1.6 voor body
- Sizes: Responsive clamp() voor fluid scaling

**Spacing:**
- Generous whitespace (py-20, py-24 voor sections)
- Consistent gaps (gap-3, gap-4, gap-6)
- Max-width containers (max-w-4xl, max-w-6xl)

**Components:**
- Minimal borders
- Subtle hover states (bg-accent/50)
- Rounded corners (rounded-lg, rounded-xl)
- Shadow gebruik: zeer subtiel of geen

**Animations:**
- Subtle transitions (0.2s - 0.3s)
- Hover state changes
- No heavy animations (respect prefers-reduced-motion)

---

## 🔧 Common Tasks & Patterns

### 1. Creating a New Page

```typescript
// app/new-page/page.tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Title - FrogBytes',
  description: 'Page description',
};

export default function NewPage() {
  return (
    <main className="min-h-screen">
      <section className="py-20 px-4">
        <div className="container max-w-4xl">
          {/* Content */}
        </div>
      </section>
    </main>
  );
}
```

### 2. Supabase Query Pattern

```typescript
import { createClient } from '@/lib/supabase/client';

async function fetchData() {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('table_name')
    .select('*')
    .eq('column', 'value');
    
  if (error) {
    console.error('Error:', error);
    return null;
  }
  
  return data;
}
```

### 3. shadcn/ui Component Usage

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// In component:
<Card className="hover:bg-accent/50 transition-colors">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
</Card>
```

### 4. Responsive Design Pattern

```typescript
// Mobile-first approach
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Content */}
</div>

// Responsive typography
<h1 className="text-3xl md:text-4xl lg:text-5xl font-medium">
  Heading
</h1>
```

---

## 📊 Data Models

### Key Supabase Tables

**`lecture_files`**
- `id` (uuid, PK)
- `user_id` (uuid, FK)
- `file_name` (text)
- `file_path` (text)
- `file_size` (bigint)
- `mime_type` (text)
- `created_at` (timestamp)

**`summaries`**
- `id` (uuid, PK)
- `lecture_file_id` (uuid, FK)
- `title` (text)
- `summary_type` (text)
- `content` (text)
- `metadata` (jsonb)
- `is_public` (boolean)
- `created_at` (timestamp)

**`transcriptions`**
- `id` (uuid, PK)
- `lecture_file_id` (uuid, FK)
- `transcription_text` (text)
- `timestamps` (jsonb)
- `status` (text)
- `created_at` (timestamp)

---

## 🚀 Development Workflow

### 1. Nieuwe Feature
1. Analyseer requirements
2. Check bestaande patterns in codebase
3. Maak component/page
4. Test responsiveness
5. Check accessibility
6. Commit met duidelijke message

### 2. Bug Fix
1. Reproduceer issue
2. Identificeer root cause
3. Minimal code change (surgical fix)
4. Test edge cases
5. Verify geen regressions

### 3. Refactoring
1. Identify code smell
2. Propose improvement
3. Maintain backwards compatibility
4. Test thoroughly

---

## 🎯 Prompt Templates voor Specifieke Taken

### UI Component Aanpassing

```
COMPONENT: [Path naar component]

HUIDIGE STATE: [Beschrijf hoe het nu werkt]

GEWENSTE VERANDERING: [Wat moet er anders]

DESIGN CONSTRAINTS:
- Behoud Midday.ai style
- Dark theme compatible
- Responsive behavior intact

Genereer de aangepaste code met minimal changes.
```

### API Route Development

```
API ENDPOINT: /api/[route]

DOEL: [Wat de endpoint doet]

INPUT: [Request body/params]
OUTPUT: [Response format]

REQUIREMENTS:
- TypeScript typed
- Error handling
- Input validation
- Supabase integration (indien nodig)

Genereer complete API route met error handling.
```

### Database Migration

```
DATABASE CHANGE NEEDED:

TYPE: [Table creation/alteration/etc]

SCHEMA:
- Table: [naam]
- Columns: [specs]
- Relations: [foreign keys]

Genereer Supabase migration SQL met:
1. Up migration
2. Down migration (rollback)
3. RLS policies (indien nodig)
```

---

## 💡 Best Practices Checklist

Bij elke code generation, check:

- [ ] **TypeScript:** Alle types expliciet gedefineerd
- [ ] **Accessibility:** ARIA labels, semantic HTML, keyboard nav
- [ ] **Responsive:** Mobile-first, test op alle breakpoints
- [ ] **Performance:** Lazy loading, code splitting waar relevant
- [ ] **Design System:** Gebruik design tokens uit globals.css
- [ ] **Error Handling:** Try/catch, user-friendly error messages
- [ ] **Security:** Input validation, SQL injection preventie
- [ ] **Consistency:** Volg bestaande patterns in codebase

---

## 📝 Example Prompts

### Example 1: Feature Addition

```
Je bent een senior developer aan FrogBytes. Ik wil een nieuwe feature toevoegen:

FEATURE: "Recent uploads" sectie op dashboard

REQUIREMENTS:
- Toon laatste 5 uploads van user
- Include: file naam, upload datum, status (transcribed/processing/failed)
- Click op item → navigeer naar detail page
- Gebruik existing Card component
- Midday.ai style (dark theme)
- Skeleton loading state

TECH:
- Server Component (fetch in component)
- Supabase query naar lecture_files table
- TypeScript typed
- Link naar /dashboard/lecture/[id]

Genereer de complete dashboard component update.
```

### Example 2: Bug Fix

```
BUG: PDF export knop doet niets bij click

HUIDIGE CODE:
[Code snippet van button/handler]

ERROR IN CONSOLE:
[Error message indien van toepassing]

PROJECT CONTEXT:
- Next.js 15 Client Component
- PDF generation via API route /api/generate-pdf
- Supabase storage voor PDF files

Debug en fix het issue. Explain wat er mis was en waarom de fix werkt.
```

### Example 3: Style Update

```
STYLE UPDATE: Homepage hero section

CURRENT: Light background, blue accent
TARGET: Volledig Midday.ai style (dark, minimal, subtle)

CHANGES NEEDED:
- Dark background (use --background token)
- Subtle border accents
- Tighter line-height op heading
- More generous vertical spacing
- Status badge met animated dot

Genereer de updated JSX/Tailwind classes voor de hero section.
```

---

## 🔍 Quick Reference

### Design Tokens (globals.css)

```css
/* Dark theme (default) */
--background: 0, 0%, 7%;          /* Near black */
--foreground: 0 0% 98%;           /* Near white */
--muted: 0, 0%, 11%;              /* Subtle background */
--muted-foreground: 240 5% 64.9%; /* Muted text */
--border: 0, 0%, 17%;             /* Subtle borders */
```

### Common Tailwind Classes

```tsx
// Containers
className="container max-w-6xl"

// Sections
className="py-20 px-4 border-t"

// Cards (Midday style)
className="border bg-card hover:bg-accent/50 transition-colors"

// Typography
className="text-3xl md:text-4xl font-medium tracking-tight"

// Buttons
className="inline-flex items-center gap-2 px-4 py-2 rounded-lg"
```

### File Paths

- Components: `@/components/[name]`
- UI Components: `@/components/ui/[name]`
- Lib: `@/lib/[utility]`
- Supabase: `@/lib/supabase/client` of `@/lib/supabase/server`

---

## 🎓 Learning Resources Context

Wanneer je Claude vraagt om uitleg of leert over het project:

```
Explain [concept] in de context van FrogBytes:

PROJECT SETUP:
- Next.js 15 App Router
- TypeScript strict mode
- Midday.ai design system
- Supabase backend

Geef:
1. Conceptuele uitleg
2. Hoe het past in FrogBytes architectuur
3. Code voorbeeld uit het project
4. Best practices voor dit specifieke gebruik
```

---

## 📌 Belangrijke Overwegingen

### Do's ✅
- Gebruik bestaande design tokens
- Volg Midday.ai aesthetic
- TypeScript strict types
- Mobile-first responsive
- Generous whitespace
- Subtle animations
- Accessibility first
- Error handling everywhere

### Don'ts ❌
- Geen custom colors buiten design system
- Geen heavy animations
- Geen inline styles (gebruik Tailwind)
- Geen any types in TypeScript
- Geen hardcoded values (gebruik design tokens)
- Geen accessibility shortcuts

---

## 🔄 Iterative Development Pattern

```
ITERATION 1: Minimale werkende versie
- Core functionaliteit
- Basic styling
- TypeScript types

ITERATION 2: Polish & refinement
- Full Midday.ai styling
- Edge cases handling
- Loading states
- Error states

ITERATION 3: Optimization
- Performance tuning
- Accessibility audit
- Responsive testing
- Code cleanup
```

---

## 📞 Getting Help from Claude

### Good Prompt Structure:

```
CONTEXT: [Project details, relevante files, tech stack]
TASK: [Specifieke taak helder beschreven]
REQUIREMENTS: [Must-haves en constraints]
EXAMPLES: [Code snippets of design references]

[Specifieke vraag of request]
```

### Bad Prompt (te vaag):

```
"Maak een mooie homepage"
```

### Good Prompt (specifiek):

```
"Update de FrogBytes homepage hero section naar Midday.ai style:
- Dark background (hsl(0, 0%, 7%))
- Heading: text-5xl font-medium tracking-tight
- Subtitle: text-muted-foreground with max-w-2xl
- CTA buttons: primary + outline variant
- Animated status badge met groene dot
- Responsive spacing (py-24 md:py-32 lg:py-40)

Gebruik bestaande Button component uit @/components/ui/button.
Generate complete updated section."
```

---

**Last updated:** January 2025  
**Project version:** FrogBytes V2  
**Maintained by:** Development Team

---

## Quick Start Prompt (Copy-Paste Ready)

```
Je bent een expert Next.js developer die werkt aan FrogBytes V2, een lecture 
summarization platform. Tech stack: Next.js 15, TypeScript, Tailwind CSS, 
Supabase. Design: Midday.ai geïnspireerd (dark theme, minimal, clean).

Key info:
- App Router structure in /app directory
- Dark theme default (class="dark" on html)
- Design tokens in globals.css (HSL-based)
- shadcn/ui components in /components/ui
- TypeScript strict mode
- Mobile-first responsive

[Jouw specifieke vraag of taak]
```

Dit document geeft Claude alle context om effectief te helpen bij FrogBytes development! 🐸✨
