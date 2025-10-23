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

### Mandatory Code Review Checklist

Before any code is considered complete, it MUST pass this checklist:

#### 1. TypeScript & Type Safety

- [ ] No `any` types (use `unknown` and type guards)
- [ ] All functions have explicit return types
- [ ] All parameters are properly typed
- [ ] No unused variables, imports, or parameters
- [ ] Proper handling of `null` and `undefined` cases
- [ ] Type guards used for runtime type checking

#### 2. Code Documentation (JSDoc)

- [ ] All exported functions have complete JSDoc
- [ ] All React components have JSDoc with props interface
- [ ] All API endpoints have JSDoc with request/response schemas
- [ ] Complex algorithms have explanatory comments
- [ ] Business logic has clear documentation

#### 3. Professional Standards

- [ ] NO emojis anywhere in the codebase
- [ ] NO console.log/error/warn statements
- [ ] Professional error messages (user-friendly, actionable)
- [ ] No magic numbers (use named constants)
- [ ] Consistent naming conventions
- [ ] Single responsibility principle followed

#### 4. Performance & Security

- [ ] Input validation with Zod schemas
- [ ] Proper error handling and logging
- [ ] No security vulnerabilities
- [ ] Optimized re-renders (React.memo, useMemo, useCallback)
- [ ] Bundle size impact considered

#### 5. Testing Requirements

- [ ] Unit tests for business logic
- [ ] Integration tests for API endpoints
- [ ] Error scenarios tested
- [ ] Edge cases handled
- [ ] Mock external dependencies

### Code Quality Gates

The following will cause immediate rejection:

1. **Emoji Usage**: Any emoji in code, comments, strings, or UI text
2. **Console Statements**: Any console.log/error/warn in production code
3. **Missing Documentation**: Exported functions without JSDoc
4. **Type Safety Violations**: Any `any` types or missing return types
5. **Security Issues**: Unvalidated inputs, SQL injection risks
6. **Performance Issues**: Unnecessary re-renders, large bundle sizes
7. **Unprofessional Messages**: Technical jargon in user-facing text

### Automated Quality Checks

Run these commands before every commit:

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Formatting
npm run format

# Testing
npm run test:unit
npm run test:e2e

# Bundle analysis
npm run analyze
```

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
