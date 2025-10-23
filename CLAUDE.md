# Claude Code Instructions for FrogBytes

## Task Master AI Instructions

**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

## Project Context

FrogBytes is a multifunctional lecture summarization & learning platform that helps students transcribe lectures, generate AI summaries, create study materials, and build a collaborative knowledge base.

**CRITICAL ARCHITECTURE RULE: This is a Next.js 15 monolithic full-stack application. ALL features are implemented within the Next.js framework using:**

- API Routes (`app/api/`) for backend endpoints
- Server Actions for mutations
- Server Components for data fetching
- Client Components only when interactivity is needed
- TypeScript throughout the entire stack

**NEVER introduce separate backend frameworks (FastAPI, Express standalone, etc.). Everything must integrate into the existing Next.js architecture.**

## CRITICAL: No Documentation Files Rule

**NEVER create markdown documentation files (.md) as part of your implementation work. This includes:**

- No `FEATURE_NAME.md` files
- No `IMPLEMENTATION_SUMMARY.md` files
- No `FIX_SUMMARY.md` files
- No `COMMIT_MESSAGE.txt` files
- No technical documentation files of any kind

**Why?** These files are a waste of time and clutter the repository. Focus exclusively on:

- Writing production code
- Fixing bugs
- Implementing features
- Writing tests

**Only exception:** Updating the existing `README.md` if explicitly requested by the user.

**If you need to document something:** Put it in code comments, JSDoc, or commit messages - never in separate .md files.

### Key Technologies

- **Framework**: Next.js 15+ with App Router and Turbopack
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **AI**: Google Gemini API for summarization, ElevenLabs for transcription
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Type System**: TypeScript with strict mode + exactOptionalPropertyTypes
- **Storage**: Supabase Storage + Telegram archival system

### Code Quality Standards

This project enforces **enterprise-grade, Fortune 500 company standards**:

1. **TypeScript Strict Mode**: All strict compiler options enabled
   - `strict: true`
   - `exactOptionalPropertyTypes: true`
   - `noUncheckedIndexedAccess: true`
   - `noUnusedLocals: true`
   - `noUnusedParameters: true`

2. **Zero Tolerance Policy**:
   - No explicit `any` types (use `unknown` and type guards)
   - No unused variables, imports, or parameters
   - ESLint warnings cause build failures
   - All code must be formatted with Prettier
   - No `@ts-ignore` or `@ts-expect-error` without justification

3. **Professional Code Standards**:
   - **ABSOLUTELY NO EMOJIS** in production code (comments, strings, logs, UI text, error messages)
   - **NO console.log/error/warn** in production code - use proper logging utilities
   - **MANDATORY JSDoc comments** for:
     - All exported functions and classes (purpose, parameters, return value, throws)
     - All public API endpoints (request/response schemas, error codes)
     - All React components (purpose, props interface, behavior, examples)
     - Complex algorithms or business logic (algorithm explanation, complexity)
     - Database queries and mutations (purpose, side effects)
   - **Explicit return types** on all functions (no implicit `any`)
   - **Professional error messages** - user-friendly, actionable, no technical jargon
   - **No magic numbers** - use named constants with descriptive names
   - **No abbreviations** in variable names unless industry standard (e.g., `id`, `url`, `api`)
   - **Consistent naming conventions** - camelCase for variables, PascalCase for components
   - **Single responsibility principle** - one function/component per purpose
   - **DRY principle** - extract common logic into reusable utilities

4. **Code Documentation Requirements**:
   - **Function documentation**: Purpose, parameters, return value, exceptions
   - **Component documentation**: Props interface, behavior, usage examples
   - **API endpoint documentation**: Request/response schemas, error codes, rate limits
   - **Complex logic documentation**: Algorithm explanation, business rules
   - **Database schema documentation**: Table purposes, relationships, constraints

5. **Testing Requirements**:
   - 90%+ code coverage (branches, functions, lines, statements)
   - Unit tests for all business logic and utilities
   - Integration tests for API endpoints
   - E2E tests for critical user flows
   - Mock external dependencies (APIs, databases, file systems)
   - Test error scenarios and edge cases

6. **Performance Standards**:
   - Minimize bundle size (analyze with webpack-bundle-analyzer)
   - Optimize re-renders (use React.memo, useMemo, useCallback appropriately)
   - Use React Server Components where possible
   - Implement proper loading states and error boundaries
   - Lazy load non-critical components
   - Optimize images and assets

7. **Security Standards**:
   - Validate all inputs with Zod schemas
   - Sanitize user inputs before processing
   - Use parameterized queries (no SQL injection)
   - Implement proper authentication and authorization
   - Rate limit API endpoints
   - Log security events for monitoring

8. **Error Handling Standards**:
   - Use proper error types and error boundaries
   - Log errors with sufficient context for debugging
   - Provide user-friendly error messages
   - Handle edge cases explicitly (null, undefined, empty arrays)
   - Implement retry logic for transient failures
   - Use structured logging with correlation IDs

### Project Structure

```
app/                    # Next.js pages and API routes
components/             # React components (organized by feature)
  ├── features/         # Feature-specific components
  ├── layout/           # Layout components (Menubar, Footer)
  └── ui/               # Reusable UI primitives (Radix UI based)
lib/                    # Core business logic
  ├── api-keys/         # API key rotation and management
  ├── services/         # Business logic services
  ├── summarization/    # AI summarization logic
  ├── transcription/    # Audio transcription
  └── pdf/              # PDF compilation with LaTeX
services/               # Data access layer (Supabase queries)
supabase/               # Database schema and migrations
types/                  # Shared TypeScript types
hooks/                  # React hooks (useAuth, useVoting, etc.)
```

### Important Patterns

1. **Database Access**:
   - Always use the Supabase client from `services/supabase/`
   - Respect Row Level Security (RLS) policies
   - Use typed queries with database types from `types/database.ts`

2. **Error Handling**:
   - Provide user-friendly error messages
   - Log errors with context for debugging
   - Handle edge cases explicitly (null, undefined, empty arrays)

3. **Component Structure**:
   - Use Server Components by default
   - Add `'use client'` only when needed (state, effects, event handlers)
   - Extract complex logic into custom hooks
   - Keep components focused and single-purpose

4. **API Routes**:
   - Validate all inputs with Zod or similar
   - Use proper HTTP status codes
   - Implement rate limiting for expensive operations
   - Add JSDoc comments for all public endpoints

### Common Gotchas

1. **Optional Properties with `exactOptionalPropertyTypes`**:
   - Use conditional spreading: `{...(value ? { prop: value } : {})}`
   - Or build objects incrementally: `if (value) obj.prop = value`
   - Type guards don't always narrow as expected with this flag

2. **Supabase Client**:
   - Use `createClient()` from `services/supabase/client` for client components
   - Use server-side client for API routes and Server Components
   - Auth state may be null - always check before accessing

3. **File Uploads**:
   - Max size: 500MB
   - Supported formats: MP3, WAV, MP4, M4A, MOV, MPEG
   - Files are stored in Supabase Storage + archived to Telegram

4. **Testing**:
   - Tests are not yet implemented (will be added in Task #20)
   - Configuration files exist: `vitest.config.ts` and `playwright.config.ts`
   - Test directory structure: `__tests__/` for unit, `tests/e2e/` for E2E

### Development Workflow

```bash
# Before starting work
npm run type-check        # Verify no TypeScript errors
npm run lint              # Check for linting issues

# During development
npm run dev               # Start dev server with Turbopack
npm run db:start          # Start local Supabase (if needed)

# Before committing
npm run lint:fix          # Auto-fix linting issues
npm run format            # Format all files
npm run type-check        # Final TypeScript check
npm run test:unit         # Run tests (when implemented)
```

### Current State (Post-Cleanup)

Recent refactoring has established a clean foundation:

- ✅ TypeScript strict mode fully enforced (zero errors)
- ✅ Jest removed in favor of Vitest
- ✅ Documentation consolidated (only README.md and this file remain)
- ✅ Test infrastructure prepared (configs ready, implementation pending)
- 🚧 Component organization needs improvement (Task #23)
- 🚧 Comprehensive testing to be implemented (Task #20)

## PRO-MODE: Enterprise Code Quality Enforcement

### CRITICAL: Pre-Commit Workflow (MANDATORY)

**ALWAYS run this workflow before committing to prevent CI/CD failures:**

```bash
# 1. Type check (MUST pass - zero errors)
npm run type-check

# 2. Lint (MUST pass - zero warnings)
npm run lint

# 3. Format check (MUST pass)
npm run format:check

# 4. Security audit (MUST pass)
npm run security-audit

# 5. Circular dependencies check (MUST pass)
npm run check-deps

# If format:check fails, auto-fix:
npm run format

# If lint fails with auto-fixable issues:
npm run lint:fix
```

**Use the `/pre-commit` slash command to run all checks automatically.**

### React Hooks Best Practices (CRITICAL)

**All hooks MUST follow exhaustive-deps rules to prevent CI failures:**

#### 1. useCallback Dependencies

```typescript
// ❌ WRONG - Missing dependencies causes CI failure
const fetchData = useCallback(async () => {
  await fetchStatus()
  await fetchKeys() // fetchKeys not in deps array
}, [])

// ✅ CORRECT - All dependencies included
const fetchData = useCallback(async () => {
  await fetchStatus()
  await fetchKeys()
}, [fetchKeys, fetchStatus])
```

#### 2. Function Declaration Order (TypeScript Hoisting)

```typescript
// ❌ WRONG - Functions used before declaration
const fetchData = useCallback(() => {
  fetchKeys()  // Error: used before declaration
}, [fetchKeys])

const fetchKeys = useCallback(() => { ... }, [])

// ✅ CORRECT - Declare functions before use
const fetchKeys = useCallback(() => { ... }, [])

const fetchData = useCallback(() => {
  fetchKeys()  // Now defined
}, [fetchKeys])
```

#### 3. Stable Functions and Arrays

```typescript
// ❌ WRONG - Array created on every render
const supportedFormats = ['.mp3', '.wav', '.mp4']

const validateFile = useCallback(
  file => {
    return supportedFormats.includes(file.ext)
  },
  [supportedFormats]
) // supportedFormats changes every render

// ✅ CORRECT - Memoize array
const supportedFormats = useMemo(() => ['.mp3', '.wav', '.mp4'], [])

const validateFile = useCallback(
  file => {
    return supportedFormats.includes(file.ext)
  },
  [supportedFormats]
) // Stable reference
```

#### 4. When to Use eslint-disable

```typescript
// Only use when function is stable but ESLint can't detect it
const handleUpload = useCallback(async () => {
  await pollJobStatus(jobId)  // pollJobStatus is stable useCallback below
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [jobId])  // Don't include pollJobStatus - causes hoisting issues

const pollJobStatus = useCallback(async (id) => { ... }, [])
```

### Mandatory Code Review Checklist

Before any code is considered complete, it MUST pass this checklist:

#### 1. TypeScript & Type Safety

- [ ] No `any` types (use `unknown` and type guards)
- [ ] All functions have explicit return types
- [ ] All parameters are properly typed
- [ ] No unused variables, imports, or parameters
- [ ] Proper handling of `null` and `undefined` cases
- [ ] Type guards used for runtime type checking
- [ ] All React hooks imported (useCallback, useMemo, useEffect, etc.)
- [ ] Function declarations ordered to prevent hoisting errors

#### 2. React Hooks Compliance

- [ ] All useCallback/useMemo have complete dependency arrays
- [ ] Functions declared before use in dependency arrays
- [ ] Stable arrays/objects wrapped in useMemo
- [ ] No exhaustive-deps ESLint warnings
- [ ] eslint-disable comments justified with explanation

#### 3. Code Documentation (JSDoc)

- [ ] All exported functions have complete JSDoc
- [ ] All React components have JSDoc with props interface
- [ ] All API endpoints have JSDoc with request/response schemas
- [ ] Complex algorithms have explanatory comments
- [ ] Business logic has clear documentation

#### 4. Professional Standards

- [ ] NO emojis anywhere in the codebase
- [ ] NO console.log/error/warn statements
- [ ] Professional error messages (user-friendly, actionable)
- [ ] No magic numbers (use named constants)
- [ ] Consistent naming conventions
- [ ] Single responsibility principle followed

#### 5. Performance & Security

- [ ] Input validation with Zod schemas
- [ ] Proper error handling and logging
- [ ] No security vulnerabilities (run `npm audit`)
- [ ] Optimized re-renders (React.memo, useMemo, useCallback)
- [ ] Bundle size impact considered

#### 6. Testing Requirements

- [ ] Unit tests for business logic
- [ ] Integration tests for API endpoints
- [ ] Error scenarios tested
- [ ] Edge cases handled
- [ ] Mock external dependencies

#### 7. CI/CD Compliance

- [ ] All pre-commit checks pass locally
- [ ] No Prettier formatting issues
- [ ] Security audit passes
- [ ] No circular dependencies
- [ ] All dev dependencies installed (check package.json)

### Code Quality Gates

The following will cause immediate CI/CD rejection:

1. **Emoji Usage**: Any emoji in code, comments, strings, or UI text
2. **Console Statements**: Any console.log/error/warn in production code
3. **Missing Documentation**: Exported functions without JSDoc
4. **Type Safety Violations**: Any `any` types or missing return types
5. **Security Issues**: Unvalidated inputs, SQL injection risks, vulnerable dependencies
6. **Performance Issues**: Unnecessary re-renders, large bundle sizes
7. **Unprofessional Messages**: Technical jargon in user-facing text
8. **React Hooks Violations**: Missing dependencies, hoisting errors
9. **Formatting Issues**: Code not formatted with Prettier
10. **Missing Dependencies**: Tools like madge, prettier not in package.json

### Automated Quality Checks

Run these commands before every commit:

```bash
# MANDATORY PRE-COMMIT WORKFLOW
npm run type-check      # Zero TypeScript errors
npm run lint           # Zero ESLint warnings
npm run format:check   # Prettier compliance
npm run security-audit # No vulnerabilities
npm run check-deps     # No circular deps

# Auto-fix commands if needed
npm run format         # Fix formatting
npm run lint:fix       # Fix auto-fixable lint issues
npm audit fix          # Fix security issues
npm audit fix --force  # Fix breaking changes (use cautiously)

# Testing (when implemented)
npm run test:unit
npm run test:e2e
```

### GitHub Actions & CI/CD Environment

**CRITICAL**: GitHub Actions require environment variables for successful builds:

#### Required Environment Variables (GitHub Secrets)

Add these in **GitHub Repository → Settings → Secrets and variables → Actions**:

```bash
# Supabase Configuration (REQUIRED for build)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional but recommended for production
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

#### CI/CD Workflow Files

- `.github/workflows/ci.yml` - Main CI/CD pipeline (type-check, lint, test, security scan)
- `.github/workflows/vercel-deployment.yml` - Vercel deployment workflow

#### Common CI/CD Failures and Solutions

1. **Build fails with "supabaseUrl is required"**
   - Solution: Add NEXT_PUBLIC_SUPABASE_URL to GitHub secrets

2. **ESLint warnings cause failure**
   - Solution: Fix warnings locally with `npm run lint` before pushing
   - CI runs with `--max-warnings 0` flag (zero tolerance)

3. **Security audit failures**
   - Solution: Run `npm audit fix` locally before pushing
   - Use `npm audit fix --force` for breaking changes (test thoroughly)

4. **Prettier formatting failures**
   - Solution: Run `npm run format` before committing
   - CI runs `npm run format:check` which fails on unformatted code

5. **Missing dev dependencies (e.g., madge)**
   - Solution: Install locally and commit package.json
   - Verify with `npm ci` in clean environment

6. **CodeQL upload failures**
   - Solution: Ensure workflow has `security-events: write` permission
   - Use CodeQL action v3 (not deprecated v2)

#### Pre-Push Checklist

```bash
# Run ALL checks before pushing to avoid CI failures
npm run type-check      # Must pass
npm run lint           # Must pass
npm run format:check   # Must pass
npm run security-audit # Must pass
npm run check-deps     # Must pass

# If any fail, fix them:
npm run format         # Auto-fix formatting
npm run lint:fix       # Auto-fix linting
npm audit fix          # Fix security issues
```

**Pro Tip**: Use the `/pre-commit` command to run all checks automatically.

### When Making Changes

1. **CRITICAL: Maintain Architecture Consistency** - This is a Next.js 15 full-stack application. NEVER create separate backend directories (Python, Express, etc.). ALL backend logic goes in `app/api/` routes, `lib/` for business logic, and `services/` for data access. Any new feature must integrate into the existing Next.js architecture.
2. **Read existing code first** - understand patterns before adding new code
3. **Follow the existing structure** - don't introduce new patterns without reason
4. **Type safety is paramount** - prefer type-safe solutions over quick hacks
5. **Test your changes** - ensure TypeScript compiles and linting passes
6. **Document complex logic** - add JSDoc for non-obvious behavior
7. **Performance matters** - profile before optimizing, but be aware of bundle size
8. **Security first** - validate inputs, sanitize outputs, respect RLS
9. **Professional standards** - no emojis, proper logging, user-friendly messages
10. **Code review** - all changes must pass the mandatory checklist

### Resources

- Database types: Auto-generated in `types/database.ts`
- UI components: Based on Radix UI in `components/ui/`
- API documentation: JSDoc comments in route files
- Supabase docs: https://supabase.com/docs
- Next.js 15 docs: https://nextjs.org/docs
